"use client";

/**
 * محرك المزامنة 5.2 — أوفلاين أولاً بدقة عالية:
 *
 * الدفع (push):   كتابة محلية → خطاف يختم syncMs ويسجل في syncOutbox
 *                 → دفع دفعات عبر RPC ‏sync_push بمنطق «آخر كتابة تفوز».
 * السحب (pull):   صفوف تغيّرت بعد المؤشر → تطبيق محلي بـ LWW مع
 *                 شواهد القبور (deleted) — بلا أثر شبح على أي جهاز.
 *
 * المحفزات: كتابة محلية (تراجع 1.5ث) · عودة الاتصال · كل 60ث ·
 * رجوع التبويب للمقدمة · فور الدخول. الجدول غير موجود؟ حالة صادقة
 * «setup-needed» مع إعادة محاولة دورية — تنقلب «متزامن» تلقائياً
 * فور تشغيل المالك هجرة SQL.
 */

import type { Table } from "dexie";
import { supabase } from "@/lib/supabase";
import {
  currentDB,
  ALL_TABLES,
  flushOps,
  getSyncState,
  setApplyingRemote,
  setSyncState,
  onLocalOps,
  bufferedOps,
  type OutboxOp,
  type TableName,
} from "@/lib/db";
import { useSyncStore } from "./sync-store";
import { initNet, netState, stopNet, subscribeNet } from "./net";

const CURSOR_KEY = "pullCursor";
const EPOCH = "1970-01-01T00:00:00.000Z";
const PUSH_BATCH = 100;
const PULL_PAGE = 500;

/** صف record كما يصل من Supabase */
interface RemoteRecord {
  id: string;
  kind: string;
  data: Record<string, unknown> | null;
  client_ms: number;
  deleted: boolean;
  updated_at: string;
}

// ─── حالة المحرك ───────────────────────────────────────────────

let active = false;
let activeUid: string | null = null;
let busy = false;

let pushTimer: ReturnType<typeof setTimeout> | null = null;
let fullTimer: ReturnType<typeof setTimeout> | null = null;
let cycleInterval: ReturnType<typeof setInterval> | null = null;
let unsubOps: (() => void) | null = null;
let unsubNet: (() => void) | null = null;
let onVisibility: (() => void) | null = null;
let wasOnline = true;

const KINDS = new Set<string>(ALL_TABLES);

function tableOf(kind: string): Table<Record<string, unknown>, string> | null {
  if (!KINDS.has(kind)) return null;
  return (currentDB() as unknown as Record<string, Table<Record<string, unknown>, string>>)[kind];
}

// ─── تصنيف أخطاء Supabase بصدق ─────────────────────────────────

function classifyRemoteError(err: unknown): "setup" | "auth" | "net" | "other" {
  const e = err as { code?: string; message?: string } | null;
  const code = e?.code ?? "";
  const msg = e?.message ?? "";
  if (code === "PGRST205" || code === "PGRST202" || /could not find|does not exist|not found/i.test(msg))
    return "setup";
  if (/401|jwt|token|invalid API key/i.test(code + " " + msg)) return "auth";
  if (/fetch|network|timeout/i.test(msg)) return "net";
  return "other";
}

function failAs(kind: "setup" | "auth" | "net" | "other", err: unknown): void {
  const store = useSyncStore.getState();
  const e = err as { message?: string } | null;
  if (kind === "setup") {
    store.setPhase("setup-needed");
    return; // بلا lastError — هذه ليست أعطالاً بل تهيئة ناقصة معروفة
  }
  if (kind === "net") {
    store.setPhase("offline");
    return;
  }
  store.setError(
    kind === "auth"
      ? "جلستك منتهية أو غير صالحة — سجّل خروجك ودخولك من جديد"
      : `تعذرت المزامنة: ${e?.message ?? "خطأ غير معروف"}`
  );
}

// ─── الدفع ─────────────────────────────────────────────────────

async function pushOutbox(): Promise<"ok" | "stopped" | "failed"> {
  if (!supabase) return "stopped";
  const store = useSyncStore.getState();
  for (let round = 0; round < 60; round++) {
    if (!active) return "stopped";
    const ops: OutboxOp[] = await currentDB().syncOutbox.orderBy("at").limit(PUSH_BATCH).toArray();
    if (ops.length === 0) break;

    const items: Array<Record<string, unknown>> = [];
    for (const op of ops) {
      if (op.op === "del") {
        items.push({ id: op.rid, kind: op.table, data: {}, client_ms: op.at, deleted: true });
        continue;
      }
      const t = tableOf(op.table);
      const row = t ? await t.get(op.rid) : undefined;
      if (!row) {
        // المحلي اختفى (حذف لاحق) — ادفعه قبراً ليتطابق الطرفان
        items.push({ id: op.rid, kind: op.table, data: {}, client_ms: op.at, deleted: true });
        continue;
      }
      items.push({
        id: op.rid,
        kind: op.table,
        data: row,
        client_ms: typeof row.syncMs === "number" ? row.syncMs : op.at,
        deleted: false,
      });
    }

    const { error } = await supabase.rpc("sync_push", { items });
    if (error) {
      failAs(classifyRemoteError(error), error);
      return "failed";
    }
    // نجح — احذف ما دُفع بالضبط (الجديد أثناء الدفع يبقى)
    await currentDB().syncOutbox.bulkDelete(ops.map((o) => o.id));
    store.setPending(await currentDB().syncOutbox.count() + bufferedOps());
  }
  return "ok";
}

// ─── السحب والتطبيق ────────────────────────────────────────────

async function applyRow(row: RemoteRecord): Promise<void> {
  const t = tableOf(row.kind);
  if (!t) return; // نوع لا يعرفه هذا الإصدار — تجاهل بأمان
  const data = row.data ?? {};
  const local = await t.get(row.id);
  const localMs = typeof (local as { syncMs?: unknown } | undefined)?.syncMs === "number"
    ? (local as { syncMs: number }).syncMs
    : 0;

  if (row.deleted) {
    if (local && row.client_ms >= localMs) {
      await t.delete(row.id);
    }
    // القبر وصل — أي عملية معلقة لهذا العنصر لم تعد مطلوبة
    await currentDB().syncOutbox.delete(`${row.kind}:${row.id}`);
    return;
  }

  if (!local) {
    // قادم جديد — إلا إذا عندنا قبر محلي معلق أحدث (حذفنا أوفلاين قبل الدفع)
    const tomb = await currentDB().syncOutbox.get(`${row.kind}:${row.id}`);
    if (tomb && tomb.op === "del" && tomb.at > row.client_ms) return;
    await t.put({ ...data, id: row.id, syncMs: row.client_ms });
    return;
  }

  if (row.client_ms > localMs) {
    // البعيد أحدث — نسختنا المحلية الأقدم تُستبدل، وعملية الدفع المعلقة تسقط
    await t.put({ ...data, id: row.id, syncMs: row.client_ms });
    await currentDB().syncOutbox.delete(`${row.kind}:${row.id}`);
  }
  // else: محلي أحدث (سينتصر عند الدفع) أو مساوٍ (صدى دفعنا) — تخطَّ
}

async function pullSince(): Promise<"ok" | "stopped" | "failed"> {
  if (!supabase) return "stopped";
  let cursor = (await getSyncState(CURSOR_KEY)) ?? EPOCH;
  for (let page = 0; page < 40; page++) {
    if (!active) return "stopped";
    const { data, error } = await supabase
      .from("records")
      .select("id,kind,data,client_ms,deleted,updated_at")
      .gte("updated_at", cursor)
      .order("updated_at", { ascending: true })
      .limit(PULL_PAGE);
    if (error) {
      failAs(classifyRemoteError(error), error);
      return "failed";
    }
    if (!data || data.length === 0) break;

    setApplyingRemote(true); // قاطع: الخطافات تعمل تزامنياً لحظة الكتابة
    try {
      for (const row of data as RemoteRecord[]) {
        await applyRow(row);
      }
    } finally {
      setApplyingRemote(false);
    }

    cursor = (data as RemoteRecord[])[data.length - 1].updated_at;
    await setSyncState(CURSOR_KEY, cursor);
    if (data.length < PULL_PAGE) break;
  }
  return "ok";
}

// ─── الدورة الكاملة ────────────────────────────────────────────

async function fullCycle(): Promise<void> {
  if (!active || busy) return;
  busy = true;
  const store = useSyncStore.getState();
  try {
    if (netState() !== "online") {
      store.setPhase("offline");
      return;
    }
    store.setPhase("syncing");
    await flushOps();
    if (!active) return;

    const pushResult = await pushOutbox();
    if (!active || pushResult === "failed") return;
    const pullResult = await pullSince();
    if (!active || pullResult === "failed") return;

    // اكتملت الدورة بلا فشل — إن لم يعلن مصنّف خطأٍ حالة أدق، فهذه «متزامن»
    const st = useSyncStore.getState();
    if (st.phase === "syncing" || st.phase === "synced") {
      st.setSynced();
      st.setPending(await currentDB().syncOutbox.count() + bufferedOps());
    }
  } catch (err) {
    useSyncStore.getState().setError(err instanceof Error ? err.message : String(err));
  } finally {
    busy = false;
  }
}

function scheduleFull(delayMs: number): void {
  if (fullTimer) clearTimeout(fullTimer);
  fullTimer = setTimeout(() => {
    fullTimer = null;
    void fullCycle();
  }, delayMs);
}

function schedulePush(delayMs: number): void {
  if (pushTimer) clearTimeout(pushTimer);
  pushTimer = setTimeout(() => {
    pushTimer = null;
    void fullCycle();
  }, delayMs);
}

// ─── التشغيل والإيقاف ──────────────────────────────────────────

/** تفعيل المزامنة لمستخدم — يُستدعى بعد setActiveUser مباشرة */
export function activateSync(userId: string): void {
  if (!supabase) return; // بلا تهيئة سحابية — البوابة تعرض الخطأ البيئي
  if (active && activeUid === userId) return;
  deactivateSync();
  active = true;
  activeUid = userId;
  wasOnline = netState() === "online";

  initNet();

  unsubNet = subscribeNet((s) => {
    if (!active) return;
    if (s === "online") {
      if (!wasOnline) {
        // عودة الاتصال — دورة فورية تلحق كل ما تراكم محلياً
        scheduleFull(200);
      }
      wasOnline = true;
    } else {
      wasOnline = false;
      useSyncStore.getState().setPhase("offline");
    }
  });

  unsubOps = onLocalOps(() => {
    if (active) schedulePush(1500);
  });

  cycleInterval = setInterval(() => {
    if (active) void fullCycle();
  }, 60_000);

  onVisibility = () => {
    if (document.visibilityState === "visible" && active) scheduleFull(400);
  };
  document.addEventListener("visibilitychange", onVisibility);

  // أول دورة فورية — السحب الكامل عند أول دخول ثم اللحاق التدريجي
  scheduleFull(300);
}

/** إيقاف كامل — عند الخروج أو تبديل المستخدم */
export function deactivateSync(): void {
  active = false;
  activeUid = null;
  busy = false;
  if (pushTimer) clearTimeout(pushTimer);
  if (fullTimer) clearTimeout(fullTimer);
  pushTimer = null;
  fullTimer = null;
  if (cycleInterval) clearInterval(cycleInterval);
  cycleInterval = null;
  if (unsubOps) {
    unsubOps();
    unsubOps = null;
  }
  if (unsubNet) {
    unsubNet();
    unsubNet = null;
  }
  if (onVisibility) {
    document.removeEventListener("visibilitychange", onVisibility);
    onVisibility = null;
  }
  stopNet();
  useSyncStore.getState().reset();
}

/** مزامنة يدوية — زر «زامن الآن» في بطاقة الحساب */
export function syncNow(): void {
  scheduleFull(0);
}

/** اسم قاعدة المستخدم النشطة — تشخيص فقط */
export function activeUserDBName(): string {
  return currentDB().name;
}
