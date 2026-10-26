"use client";

/**
 * كشف الاتصال الحقيقي — navigator.onLine يكذب أحياناً (يقول «متصل»
 * وخلف جدار/بروكسي ميت). لذا نتحقق من الوصول الفعلي إلى Supabase
 * نفسها بنبضة خفيفة، مع الاستمرار في الاعتماد على أحداث المتصفح
 * كمحفّز للفحص، ونبضة دورية تكتشف الانقطاع الصامت والعودة الصامتة.
 */

import { SUPABASE_URL, supabasePublishableKey } from "@/lib/supabase";

export type NetState = "online" | "offline";

type NetListener = (state: NetState) => void;
const listeners = new Set<NetListener>();

let state: NetState = "online";
let probing = false;
let heartbeat: ReturnType<typeof setInterval> | null = null;
let started = false;

function emit(): void {
  for (const l of listeners) {
    try {
      l(state);
    } catch {
      /* تجاهل */
    }
  }
}

function setState(next: NetState): void {
  if (state === next) return;
  state = next;
  emit();
}

/** نبضة واحدة إلى خادم المصادقة — أي رد (حتى 4xx) يعني «نصل إليه» */
async function probe(): Promise<void> {
  if (probing || !SUPABASE_URL) return;
  probing = true;
  try {
    const ctrl = new AbortController();
    const timer = setTimeout(() => ctrl.abort(), 6000);
    try {
      await fetch(`${SUPABASE_URL}/auth/v1/health`, {
        method: "GET",
        headers: supabasePublishableKey ? { apikey: supabasePublishableKey } : undefined,
        signal: ctrl.signal,
        cache: "no-store",
      });
      setState("online"); // وصلنا لأي رد — الخدمة حية
    } finally {
      clearTimeout(timer);
    }
  } catch {
    setState("offline"); // انقطاع/مهلة/إجهاض — غير متصلين فعلياً
  } finally {
    probing = false;
  }
}

function onNavigatorEvent(): void {
  if (typeof navigator === "undefined") return;
  if (navigator.onLine) {
    // المتصفح يقول متصل — تحقق أن Supabase ذاتها ترد
    void probe();
  } else {
    setState("offline");
  }
}

/** بدء المراقبة — مرة واحدة لكل تحميل صفحة */
export function initNet(): void {
  if (started || typeof window === "undefined") return;
  started = true;
  state = typeof navigator !== "undefined" && navigator.onLine ? "online" : "offline";
  window.addEventListener("online", onNavigatorEvent);
  window.addEventListener("offline", onNavigatorEvent);
  // نبضة دورية: تكشف الانقطاع الصامت والعودة الصامتة خلف الأحداث
  heartbeat = setInterval(() => void probe(), 20_000);
  void probe();
}

/** إيقاف المراقبة (تسجيل الخروج/إغلاق) */
export function stopNet(): void {
  if (!started) return;
  started = false;
  window.removeEventListener("online", onNavigatorEvent);
  window.removeEventListener("offline", onNavigatorEvent);
  if (heartbeat) clearInterval(heartbeat);
  heartbeat = null;
}

/** الحالة الراهنة */
export function netState(): NetState {
  return state;
}

/** الاشتراك في تغيرات الحالة — يعيد دالة إلغاء */
export function subscribeNet(l: NetListener): () => void {
  listeners.add(l);
  return () => listeners.delete(l);
}
