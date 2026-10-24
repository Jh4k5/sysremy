/**
 * Systemy v4 — محرك الميزانية الدقيق (بالفلس)
 *
 * يحوّل ميزانية شهرية واحدة إلى منظومة حية:
 *   دخل 1300 → معيشة 800/شهر → أسابيع مالية داخل الشهر المالي
 *   → حد أسبوعي (200) → حد يومي متبقٍ حي → عجز يظهر بالسالب ويُرحّل.
 *
 * مبادئ الحساب:
 * - «صرف المعيشة» = معاملات expense **غير** خارج الميزانية (outsideBudget ≠ true)
 *   داخل نافذة الأسبوع/الشهر المالي.
 * - الالتزامات المتكررة (خارج المعيشة) والدخل والادخار لا تدخل في هذا الحساب.
 * - carryOver = "next" (الافتراضي): فائض/عجز كل أسبوع يُرحّل للأسبوع التالي داخل الشهر.
 * - نهاية الشهر: sweepMonthLeftover() (في actions) يكنس الفائض إلى الادخار.
 */

import type { ISODate, Settings, Transaction } from "./types";
import { monthWindow, type MonthWindow } from "./money";

/* ═══════════════════════ نوافذ الأسابيع المالية ═══════════════════════ */

export interface WeekWindow {
  /** ترتيب الأسبوع داخل الشهر المالي (1..n) */
  index: number;
  start: ISODate;
  /** آخر يوم ضمن الشهر المالي (شامل) */
  end: ISODate;
  label: string;
}

const DAY_MS = 86_400_000;

function toISO(d: Date): ISODate {
  const y = d.getFullYear();
  const m = `${d.getMonth() + 1}`.padStart(2, "0");
  const day = `${d.getDate()}`.padStart(2, "0");
  return `${y}-${m}-${day}`;
}

function fromISO(iso: ISODate): Date {
  const [y, m, d] = iso.split("-").map(Number);
  return new Date(y, m - 1, d);
}

/** رقم يوم بداية الأسبوع حسب إعداد weekStart: سبت=6 أحد=0 اثنين=1 */
function weekStartDow(weekStart: Settings["weekStart"]): number {
  return weekStart === "sat" ? 6 : weekStart === "mon" ? 1 : 0;
}

/**
 * أسابيع الشهر المالي: تُقطع نافذة الشهر المالي إلى أسابيع تبدأ في يوم weekStart،
 * أول/آخر أسبوع قد يكونان جزئيين ويُقيدان بحدود الشهر المالي.
 */
export function financeMonthWeeks(
  settings: Pick<Settings, "monthStartDay" | "weekStart">,
  today = new Date(),
): WeekWindow[] {
  const w = monthWindow(settings, toISO(today instanceof Date ? today : today));
  const startDow = weekStartDow(settings.weekStart);
  const weeks: WeekWindow[] = [];
  let cursor = fromISO(w.start);
  const end = fromISO(w.end);
  let guard = 0;
  while (cursor <= end && guard++ < 12) {
    // نهاية الأسبوع الحالي: أول يوم بداية-أسبوع بعد cursor − يوم واحد، مقيدة بـ end
    let e = new Date(cursor);
    let steps = 0;
    while (e < end && steps++ < 7) {
      e = new Date(e.getTime() + DAY_MS);
      if (e.getDay() === startDow) break;
    }
    if (e > end) e = end;
    weeks.push({
      index: weeks.length + 1,
      start: toISO(cursor),
      end: toISO(e),
      label: `الأسبوع ${weeks.length + 1}`,
    });
    cursor = new Date(e.getTime() + DAY_MS);
  }
  return weeks;
}

/* ═══════════════════════ الحالة الأسبوعية الحية ═══════════════════════ */

export interface MonthPulse {
  /** الحد الشهري للمعيشة */
  budget: number;
  /** صرف المعيشة هذا الشهر المالي */
  spent: number;
  /** المتبقي — قد يكون سالباً */
  remaining: number;
  /** الوتيرة المستهدفة حتى الآن (budget × نسبة اليوم من أيام الدورة) */
  expectedByNow: number;
  dayOfCycle: number;
  daysInCycle: number;
  /** متوسط الصرف اليومي الفعلي */
  dailyAvg: number;
  /** الإسقاط نهاية الشهر بالوتيرة الحالية */
  projected: number;
  status: "great" | "good" | "careful" | "over" | "unset";
}

export interface WeeklyStatus {
  /** الشهر المالي (تسمية + نافذة) */
  monthLabel: string;
  monthWindow: MonthWindow;
  month: MonthPulse;
  /** أسبوع اليوم الحالي — null إن كان اليوم خارج أسابيع الشهر (نظرياً لا يحدث) */
  week: WeekWindow | null;
  /** كل أسابيع الشهر مع صرف كل منها (للشريط المصغّر) */
  weeksSpent: Array<WeekWindow & { spent: number; budget: number }>;
  /** الحد الأسبوعي الفعّال */
  weeklyBudget: number;
  /** الرصيد المُرحّل من أسابيع الشهر السابقة (فائض موجب / عجز سالب — حسب carryOver) */
  carryIn: number;
  /** صرف المعيشة في أسبوع اليوم */
  weekSpent: number;
  /** متبقي الأسبوع = weeklyBudget + carryIn − weekSpent (سالب = تجاوز) */
  weekRemaining: number;
  /** حدك اليومي الحي = max(0, weekRemaining) ÷ الأيام المتبقية (شامل اليوم) */
  dailyLimit: number;
  /** صرف المعيشة اليوم */
  todaySpent: number;
  /** أيام متبقية في الأسبوع شاملة اليوم (1..7) */
  daysLeftInWeek: number;
  /** إجمالي صرف المعيشة خارج الميزانية هذا الشهر (التزامات واستثنائيات) */
  outsideSpent: number;
}

function txDateDay(tx: Transaction): string {
  return (tx.date || "").slice(0, 10);
}

/** صرف المعيشة فقط — expense وغير خارج الميزانية */
function livingSpentInRange(txs: Transaction[], from: ISODate, to: ISODate): number {
  let sum = 0;
  for (const t of txs) {
    if (t.type !== "expense" || t.outsideBudget) continue;
    const d = txDateDay(t);
    if (d >= from && d <= to) sum += t.amount;
  }
  return Math.round(sum * 100) / 100;
}

function outsideSpentInRange(txs: Transaction[], from: ISODate, to: ISODate): number {
  let sum = 0;
  for (const t of txs) {
    if (t.type !== "expense" || !t.outsideBudget) continue;
    const d = txDateDay(t);
    if (d >= from && d <= to) sum += t.amount;
  }
  return Math.round(sum * 100) / 100;
}

function daysBetween(a: ISODate, b: ISODate): number {
  return Math.round((fromISO(b).getTime() - fromISO(a).getTime()) / DAY_MS);
}

/** تسمية الشهر المالي بالعربية — من monthWindow بدون استيراد دائري */
function monthLabelOf(w: MonthWindow): string {
  try {
  const d = fromISO(w.start);
  return d.toLocaleDateString("ar", { month: "long", year: "numeric" });
  } catch {
    return w.start.slice(0, 7);
  }
}

/**
 * الحالة الأسبوعية/اليومية/الشهرية الكاملة — نقطة استدعاء واحدة لكل الواجهات.
 */
export function weeklyStatus(
  settings: Pick<Settings, "monthStartDay" | "weekStart" | "monthlyBudget" | "weeklyBudget" | "carryOver" | "monthlyIncome">,
  txs: Transaction[],
  todayISO_: string,
): WeeklyStatus {
  const w = monthWindow(settings, todayISO_);
  const today = todayISO_;
  const weeks = financeMonthWeeks(settings, fromISO(today));

  // عدد الأسابيع الفعلي في هذا الشهر المالي
  const weeksCount = Math.max(1, weeks.length);
  const monthlyBudget = settings.monthlyBudget ?? 0;
  const weeklyBudget =
    settings.weeklyBudget && settings.weeklyBudget > 0
      ? settings.weeklyBudget
      : monthlyBudget > 0
        ? Math.round((monthlyBudget / weeksCount) * 100) / 100
        : 0;

  // بيانات كل أسبوع
  const weeksSpent = weeks.map((wk) => ({
    ...wk,
    spent: livingSpentInRange(txs, wk.start, wk.end),
    budget: weeklyBudget,
  }));

  // أسبوع اليوم
  const week = weeks.find((wk) => today >= wk.start && today <= wk.end) ?? null;

  // الترحيل من الأسابيع السابقة داخل الشهر
  let carryIn = 0;
  const carryMode = settings.carryOver ?? "next";
  if (carryMode === "next" && week) {
    for (const wk of weeksSpent) {
      if (wk.index >= week.index) break;
      carryIn += weeklyBudget - wk.spent;
    }
    carryIn = Math.round(carryIn * 100) / 100;
  } else if (carryMode === "reset" || carryMode === "savings") {
    carryIn = 0; // savings: الفائض يُكنس نهاية الشهر (sweep) — لا يُرحّل بين الأسابيع
  }

  const weekSpent = week ? livingSpentInRange(txs, week.start, week.end) : 0;
  const weekRemaining = Math.round((weeklyBudget + carryIn - weekSpent) * 100) / 100;

  const daysLeftInWeek = week ? Math.max(1, daysBetween(today, week.end) + 1) : 1;
  const dailyLimit =
    weekRemaining > 0
      ? Math.round((weekRemaining / daysLeftInWeek) * 100) / 100
      : 0;

  const todaySpent = livingSpentInRange(txs, today, today);

  // نبض الشهر
  const dayOfCycle = Math.max(1, daysBetween(w.start, today) + 1);
  const daysInCycle = Math.max(1, daysBetween(w.start, w.end) + 1);
  const monthSpent = livingSpentInRange(txs, w.start, w.end);
  const monthRemaining = Math.round((monthlyBudget - monthSpent) * 100) / 100;
  const expectedByNow =
    monthlyBudget > 0 ? Math.round((monthlyBudget * (dayOfCycle / daysInCycle)) * 100) / 100 : 0;
  const dailyAvg = Math.round((monthSpent / dayOfCycle) * 100) / 100;
  const projected = Math.round(dailyAvg * daysInCycle * 100) / 100;

  let status: MonthPulse["status"] = "unset";
  if (monthlyBudget > 0) {
    if (monthSpent > monthlyBudget) status = "over";
    else if (monthSpent > expectedByNow * 1.15) status = "careful";
    else if (monthSpent > expectedByNow) status = "good";
    else status = "great";
  }

  return {
    monthLabel: monthLabelOf(w),
    monthWindow: w,
    month: {
      budget: monthlyBudget,
      spent: monthSpent,
      remaining: monthRemaining,
      expectedByNow,
      dayOfCycle,
      daysInCycle,
      dailyAvg,
      projected,
      status,
    },
    week,
    weeksSpent,
    weeklyBudget,
    carryIn,
    weekSpent,
    weekRemaining,
    dailyLimit,
    todaySpent,
    daysLeftInWeek,
    outsideSpent: outsideSpentInRange(txs, w.start, w.end),
  };
}

/* ═══════════════════════ الكنس التلقائي (حساب فائض الشهر) ═══════════════════════ */

import { todayISO as _todayISO } from "./format";

export { _todayISO as todayISORef };

/**
 * مفتاح الشهر المالي الحالي — يُستخدم كـ lastSweepMonth لمنع تكرار الكنس.
 * مثال: بداية 25/09 → مفتاح "2026-09".
 */
export function financeMonthKey(settings: Pick<Settings, "monthStartDay">, today = _todayISO()): string {
  const w = monthWindow(settings, today);
  return w.start.slice(0, 7);
}

/**
 * نافذة الشهر المالي **السابق** — لحساب فائضه عند الكنس.
 */
export function previousMonthWindow(
  settings: Pick<Settings, "monthStartDay">,
  today = _todayISO(),
): MonthWindow {
  const w = monthWindow(settings, today);
  // نتراجع يوماً واحداً قبل بداية الشهر الحالي ثم نحسب نافذة ذلك اليوم
  const before = toISO(new Date(fromISO(w.start).getTime() - DAY_MS));
  return monthWindow(settings, before);
}

/**
 * فائض الشهر المالي السابق القابل للكنس (إن وُجد):
 * monthlyBudget − صرف المعيشة في الشهر السابق (موجب فقط).
 */
export function leftoverOfPreviousMonth(
  settings: Pick<Settings, "monthStartDay" | "monthlyBudget">,
  txs: Transaction[],
  today = _todayISO(),
): number {
  const prev = previousMonthWindow(settings, today);
  const budget = settings.monthlyBudget ?? 0;
  if (budget <= 0) return 0;
  const spent = livingSpentInRange(txs, prev.start, prev.end);
  const leftover = Math.round((budget - spent) * 100) / 100;
  return leftover > 0 ? leftover : 0;
}
