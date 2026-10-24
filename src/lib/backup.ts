/**
 * Systemy v2 — النسخ الاحتياطي (تصدير/استيراد JSON محلي)
 * الملف يحتوي بياناتك الشخصية — يبقى على جهازك.
 */
"use client";

import { toast } from "sonner";
import { ALL_TABLES, db, uid, type TableName } from "./db";
import type { BackupFile } from "./types";

const BACKUP_VERSION = 2;

/** تجميع كل البيانات في كائن واحد */
async function collectData(): Promise<BackupFile> {
  const tables: Record<string, unknown[]> = {};
  for (const name of ALL_TABLES) {
    tables[name] = await (db as unknown as Record<string, { toArray: () => Promise<unknown[]> }>)[name].toArray();
  }
  return { app: "Systemy", version: BACKUP_VERSION, exportedAt: new Date().toISOString(), tables };
}

/** تصدير نسخة احتياطية وتنزيلها كملف JSON */
export async function exportBackup(): Promise<void> {
  try {
    const data = await collectData();
    const blob = new Blob([JSON.stringify(data, null, 2)], { type: "application/json" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    const stamp = new Date().toISOString().slice(0, 10);
    a.href = url;
    a.download = `systemy-backup-${stamp}.json`;
    document.body.appendChild(a);
    a.click();
    a.remove();
    URL.revokeObjectURL(url);
    toast.success("تم تصدير النسخة الاحتياطية", { description: "الملف يحتوي بياناتك الشخصية — احتفظ به بأمان" });
  } catch {
    toast.error("تعذّر التصدير — حاول مجدداً");
  }
}

export type ImportMode = "replace" | "merge";

/** استيراد نسخة احتياطية (استبدال كامل أو دمج) */
export async function importBackup(file: File, mode: ImportMode): Promise<void> {
  let data: BackupFile;
  try {
    data = JSON.parse(await file.text()) as BackupFile;
  } catch {
    toast.error("ملف غير صالح — تعذّرت قراءة JSON");
    return;
  }
  if (data.app !== "Systemy" || !data.tables) {
    toast.error("هذا الملف ليس نسخة احتياطية من Systemy");
    return;
  }

  try {
    if (mode === "replace") {
      await db.transaction("rw", db.tables, async () => {
        for (const name of ALL_TABLES) {
          await (db as unknown as Record<string, { clear: () => Promise<void> }>)[name].clear();
        }
        for (const name of ALL_TABLES) {
          const rows = (data.tables[name] ?? []) as { id?: string }[];
          if (rows.length > 0) {
            await (db as unknown as Record<string, { bulkPut: (r: unknown[]) => Promise<unknown> }>)[name].bulkPut(rows);
          }
        }
      });
      toast.success("تم الاستيراد واستبدال البيانات", { description: "تُحدَّث الواجهة تلقائياً" });
    } else {
      const existing: Record<string, Set<string>> = {};
      for (const name of ALL_TABLES) {
        const rows = await (db as unknown as Record<string, { toArray: () => Promise<{ id: string }[]> }>)[name].toArray();
        existing[name] = new Set(rows.map((r) => r.id));
      }
      await db.transaction("rw", db.tables, async () => {
        for (const name of ALL_TABLES) {
          const rows = ((data.tables[name] ?? []) as { id?: string }[]).filter(
            (r) => !existing[name]?.has(r.id as string)
          );
          const withIds = rows.map((r) => ({ ...r, id: r.id ?? uid() }));
          if (withIds.length > 0) {
            await (db as unknown as Record<string, { bulkPut: (r: unknown[]) => Promise<unknown> }>)[name].bulkPut(withIds);
          }
        }
      });
      toast.success("تم الدمج — أُضيفت العناصر الجديدة فقط");
    }
  } catch (e) {
    console.error(e);
    toast.error("حدث خطأ أثناء الاستيراد");
  }
}

/** إحصاء سريع لملف نسخة (قبل الاستيراد) */
export async function peekBackup(file: File): Promise<{ ok: boolean; counts: Record<string, number>; exportedAt?: string }> {
  try {
    const data = JSON.parse(await file.text()) as BackupFile;
    if (data.app !== "Systemy") return { ok: false, counts: {} };
    const counts: Record<string, number> = {};
    for (const name of ALL_TABLES) {
      const rows = data.tables[name];
      if (Array.isArray(rows) && rows.length > 0) counts[name] = rows.length;
    }
    return { ok: true, counts, exportedAt: data.exportedAt };
  } catch {
    return { ok: false, counts: {} };
  }
}

/** تجزئة رمز القفل (SHA-256 مع ملح محلي) */
export async function hashPin(pin: string): Promise<string> {
  const salt = "systemy-local-salt";
  const bytes = new TextEncoder().encode(salt + pin + salt);
  const digest = await crypto.subtle.digest("SHA-256", bytes);
  return Array.from(new Uint8Array(digest))
    .map((b) => b.toString(16).padStart(2, "0"))
    .join("");
}

/** مفاتيح localStorage الخاصة بالتطبيق — تُمسح عند حذف الحساب */
export const LOCAL_KEYS = [
  "systemy-notified-v1",
  "systemy-dismissed-alerts",
  "systemy.localdb.v2",
];

/** حذف الحساب نهائياً: قاعدة البيانات + كل المفاتيح المحلية ثم إعادة تشغيل */
export async function deleteAccountForever(): Promise<void> {
  const { resetAll } = await import("./db");
  await resetAll();
  for (const key of LOCAL_KEYS) {
    try {
      localStorage.removeItem(key);
    } catch {
      /* تجاهل */
    }
  }
  toast.success("حُذف الحساب وكل البيانات نهائياً", { description: "تُعاد تشغيل شاشة الترحيب…" });
  setTimeout(() => window.location.reload(), 900);
}

/** التحقق من سلامة كل الجداول (تشخيص) */
export async function healthCheck(): Promise<Array<{ table: TableName | "settings"; count: number }>> {
  const out: Array<{ table: TableName | "settings"; count: number }> = [];
  for (const name of ALL_TABLES) {
    const count = await (db as unknown as Record<string, { count: () => Promise<number> }>)[name].count();
    out.push({ table: name, count });
  }
  return out;
}
