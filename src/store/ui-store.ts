/**
 * Systemy v2 — مخزن حالة الواجهة (Zustand)
 * البيانات في Dexie — هنا حالات العرض والتنقل والطبقات فقط.
 */
"use client";

import { create } from "zustand";
import type { QuickAddTab, ViewId } from "@/lib/types";

interface UIState {
  /** الشاشة الحالية */
  view: ViewId;
  setView: (v: ViewId) => void;

  /** تاريخ محدد مسبقاً للتقويم (يُستهلك مرة) */
  calendarDate: string | null;
  goToCalendar: (date?: string) => void;
  consumeCalendarDate: () => string | null;

  /** تبويب مسبق لشاشة المال (يُستهلك مرة) */
  moneyTab: string | null;
  goToMoney: (tab?: string) => void;
  consumeMoneyTab: () => string | null;

  /** تاريخ مسبق لنموذج الإضافة (يوم سابق مثلاً) */
  quickAddDate: string | null;

  /** نافذة الإضافة السريعة — زر + الحقيقي */
  quickAddOpen: boolean;
  quickAddTab: QuickAddTab;
  /** معاملة قيد التعديل (تبويب المصروف) */
  quickAddEditTxId: string | null;
  openQuickAdd: (tab?: QuickAddTab, opts?: { date?: string; editTxId?: string }) => void;
  closeQuickAdd: () => void;
  setQuickAddTab: (t: QuickAddTab) => void;

  /** لوحة الأوامر (Ctrl+K) */
  commandOpen: boolean;
  setCommandOpen: (b: boolean) => void;

  /** مركز التنبيهات */
  alertsOpen: boolean;
  setAlertsOpen: (b: boolean) => void;

  /** محادثة Sys */
  sysOpen: boolean;
  setSysOpen: (b: boolean) => void;

  /** شاشة الحساب السحابي (Supabase) */
  authOpen: boolean;
  authStart: "login" | "signup" | "forgot" | "reset" | null;
  openAuth: (mode?: "login" | "signup" | "forgot" | "reset") => void;
  closeAuth: () => void;

  /** وضع الخصوصية (إخفاء المبالغ) */
  privacyMode: boolean;
  togglePrivacy: () => void;

  /** القفل */
  locked: boolean;
  setLocked: (b: boolean) => void;

  /** آخر التقاط — لتلميح الإنجاز */
  lastCapture: { description: string; amount: number | null } | null;
  setLastCapture: (v: { description: string; amount: number | null } | null) => void;

  /** مفتاح تحديث عام (يلتقطه مجدول التذكيرات) */
  tick: number;
  bumpTick: () => void;
}

export const useUIStore = create<UIState>((set) => ({
  view: "today",
  setView: (v) => set({ view: v }),

  calendarDate: null,
  goToCalendar: (date) => set({ view: "calendar", calendarDate: date ?? null }),
  consumeCalendarDate: () => {
    const d = useUIStore.getState().calendarDate;
    if (d) set({ calendarDate: null });
    return d;
  },

  moneyTab: null,
  goToMoney: (tab) => set({ view: "money", moneyTab: tab ?? null }),
  consumeMoneyTab: () => {
    const t = useUIStore.getState().moneyTab;
    if (t) set({ moneyTab: null });
    return t;
  },

  quickAddDate: null,
  quickAddOpen: false,
  quickAddTab: "expense",
  quickAddEditTxId: null,
  /** النوع الافتراضي يشتق من الشاشة التي فُتحت منها اللوحة (Master Prompt §7.1) */
  openQuickAdd: (tab, opts) => {
    const view = useUIStore.getState().view;
    const contextual: QuickAddTab =
      view === "money" ? "expense" :
      view === "tasks" || view === "learning" || view === "projects" ? "task" :
      view === "habits" ? "habit" :
      view === "journal" || view === "notes" ? "note" :
      view === "calendar" ? "block" :
      "expense";
    set({
      quickAddOpen: true,
      quickAddTab: tab ?? contextual,
      quickAddDate: opts?.date ?? null,
      quickAddEditTxId: opts?.editTxId ?? null,
    });
  },
  closeQuickAdd: () => set({ quickAddOpen: false, quickAddDate: null, quickAddEditTxId: null }),
  setQuickAddTab: (t) => set({ quickAddTab: t }),

  commandOpen: false,
  setCommandOpen: (b) => set({ commandOpen: b }),

  alertsOpen: false,
  setAlertsOpen: (b) => set({ alertsOpen: b }),

  sysOpen: false,
  setSysOpen: (b) => set({ sysOpen: b }),

  authOpen: false,
  authStart: null,
  openAuth: (mode) => set({ authOpen: true, authStart: mode ?? "login" }),
  closeAuth: () => set({ authOpen: false, authStart: null }),

  privacyMode: false,
  togglePrivacy: () => set((s) => ({ privacyMode: !s.privacyMode })),

  locked: false,
  setLocked: (b) => set({ locked: b }),

  lastCapture: null,
  setLastCapture: (v) => set({ lastCapture: v }),

  tick: 0,
  bumpTick: () => set((s) => ({ tick: s.tick + 1 })),
}));
