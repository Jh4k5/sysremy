"use client";

/**
 * مخزن حالة المزامنة — ما تراه الشارة وبطاقة الحساب، بلا تجميل:
 * كل حالة مقابل حقيقة على الأرض، والتوقيت الأخير معروض دائماً.
 */

import { create } from "zustand";

export type SyncPhase =
  | "idle" // لم تبدأ بعد (قبل الدخول)
  | "syncing" // دفع/سحب جارٍ الآن
  | "synced" // آخر دورة تمت — كل شيء محلياً = سحابياً
  | "offline" // بلا اتصال — التطبيق يعمل طبيعياً وسيُزامن عند العودة
  | "setup-needed" // جدول المزامنة لم يُنشأ في Supabase بعد (هجرة SQL)
  | "error"; // خطأ آخر (جلسة منتهية…) — الصادق عرضه

interface SyncStatusState {
  phase: SyncPhase;
  /** عدد العمليات المحلية المنتظرة الدفع */
  pending: number;
  /** آخر لحظة اكتملت فيها دورة (إيبوك مللي) */
  lastSyncAt: number | null;
  /** آخر خطأ برسالة مفهومة */
  lastError: string | null;

  setPhase: (p: SyncPhase) => void;
  setPending: (n: number) => void;
  setSynced: () => void;
  setError: (msg: string) => void;
  reset: () => void;
}

export const useSyncStore = create<SyncStatusState>((set) => ({
  phase: "idle",
  pending: 0,
  lastSyncAt: null,
  lastError: null,

  setPhase: (p) => set({ phase: p }),
  setPending: (n) => set({ pending: n }),
  setSynced: () => set({ phase: "synced", lastSyncAt: Date.now(), lastError: null }),
  setError: (msg) => set({ phase: "error", lastError: msg }),
  reset: () => set({ phase: "idle", pending: 0, lastSyncAt: null, lastError: null }),
}));
