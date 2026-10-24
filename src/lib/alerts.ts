/**
 * Systemy v2 — مركز التنبيهات (تنبيهات مفيدة مشتقة من كل الأنظمة)
 * لا تُخزَّن — تُحسب لحظياً من قاعدة البيانات، بحد أقصى 6، الأكثر إلحاحاً أولاً.
 * كل تنبيه يقود لإجراء: فتح الشاشة المناسبة / إتمام / تجاهل (يومياً).
 */
import type {
  AppAlert,
  Debt,
  Goal,
  Habit,
  HabitLog,
  Recurring,
  Task,
  Transaction,
  Category,
  Settings,
  TimeBlock,
} from "./types";
import type { Envelope, SafeToSpend } from "./money";
import { budgetPacing, envelopes, safeToSpend } from "./money";
import { diffDays, formatMoney, formatNumber, hhmmToMinutes, nowHHMM, todayISO } from "./format";

const DISMISSED_KEY = "systemy-dismissed-alerts";

export function getDismissed(): Record<string, string> {
  try {
    return JSON.parse(localStorage.getItem(DISMISSED_KEY) ?? "{}") as Record<string, string>;
  } catch {
    return {};
  }
}

export function dismissAlert(key: string): void {
  try {
    const d = getDismissed();
    d[key] = todayISO();
    localStorage.setItem(DISMISSED_KEY, JSON.stringify(d));
  } catch {
    /* تجاهل */
  }
}

/**
 * بناء تنبيهات اليوم من كل الأنظمة — الترابط الحي:
 * مهام متأخرة، التزامات وديون مستحقة، مظاريف تجاوزت، رصيد آمن منخفض،
 * عادات تنتظر، حدث تقويم قادم، هدف وصل.
 */
export function buildAlerts(
  settings: Settings,
  txs: Transaction[],
  categories: Category[],
  recurrings: Recurring[],
  debts: Debt[],
  tasks: Task[],
  habits: Habit[],
  habitLogs: HabitLog[],
  goals: Goal[],
  blocks: TimeBlock[],
): AppAlert[] {
  const today = todayISO();
  const dismissed = getDismissed();
  const isDismissed = (key: string) => dismissed[key] === today;

  const alerts: AppAlert[] = [];
  const push = (a: AppAlert) => {
    if (a.dismissKey && isDismissed(a.dismissKey)) return;
    if (alerts.length >= 6) return;
    alerts.push(a);
  };

  // 1) مهام متأخرة أو عاجلة اليوم
  const open = tasks.filter((t) => !t.done);
  const overdue = open.filter((t) => t.date < today);
  if (overdue.length > 0) {
    push({
      id: "tasks-overdue",
      severity: "danger",
      icon: "alert",
      title: `${formatNumber(overdue.length)} مهمة متأخرة`,
      detail: overdue[0].title,
      targetView: "today",
      actionLabel: "افتح اليوم",
      dismissKey: "tasks-overdue",
    });
  }
  const todayHigh = open.filter((t) => t.date === today && t.priority === "high");
  if (todayHigh.length > 0 && overdue.length === 0) {
    push({
      id: "tasks-high",
      severity: "warning",
      icon: "clock",
      title: todayHigh.length === 1 ? `مهمة عاجلة اليوم: ${todayHigh[0].title}` : `${formatNumber(todayHigh.length)} مهام عاجلة اليوم`,
      targetView: "today",
      actionLabel: "افتح",
      dismissKey: "tasks-high",
    });
  }

  // 2) التزامات وديون تستحق خلال 3 أيام
  for (const r of recurrings) {
    if (!r.active) continue;
    const d = diffDays(today, r.nextDate);
    const window = Math.max(1, r.reminderDays ?? 2);
    if (d >= 0 && d <= window) {
      push({
        id: `due-rec-${r.id}`,
        severity: "info",
        icon: "wallet",
        title: `${r.name} يستحق ${d === 0 ? "اليوم" : d === 1 ? "غداً" : `بعد ${formatNumber(d)} أيام`}`,
        detail: formatMoney(r.amount, settings.currency),
        targetView: "money",
        actionLabel: "افتح المال",
        dismissKey: `due-rec-${r.id}-${r.nextDate}`,
      });
    }
  }
  for (const debt of debts) {
    if (!debt.dueDate || debt.direction !== "payable" || debt.paid >= debt.amount) continue;
    const d = diffDays(today, debt.dueDate);
    if (d >= 0 && d <= 3) {
      push({
        id: `due-debt-${debt.id}`,
        severity: d === 0 ? "danger" : "info",
        icon: "hand-coins",
        title: `${debt.name} (${debt.person}) يستحق ${d === 0 ? "اليوم" : d === 1 ? "غداً" : `بعد ${formatNumber(d)} أيام`}`,
        detail: formatMoney(debt.amount - debt.paid, settings.currency),
        targetView: "money",
        actionLabel: "افتح المال",
        dismissKey: `due-debt-${debt.id}-${debt.dueDate}`,
      });
    }
  }

  // 3) مظاريف تجاوزت 80%
  const w = { start: "", end: "" };
  void w;
  const envs = envelopesWithWindow(settings, txs, categories);
  for (const b of envs) {
    if (b.percent >= 80) {
      push({
        id: `budget-${b.category.id}`,
        severity: b.percent >= 100 ? "danger" : "warning",
        icon: "gauge",
        title: `مظروف ${b.category.name} تجاوز ${b.percent >= 100 ? "100" : "80"}%`,
        detail: `أنفقت ${formatMoney(b.spent, settings.currency)} من ${formatMoney(b.budget, settings.currency)}`,
        targetView: "money",
        actionLabel: "افتح المال",
        dismissKey: `budget-${b.category.id}-${today.slice(0, 7)}`,
      });
    }
  }

  // 3-b) وتيرة ميزانية الصرف الشهرية (اليوم/الأسبوع/الشهر) — من محرك budgetPacing
  const pacing = budgetPacing(settings, categories, txs);
  if (pacing.status !== "unset") {
    if (pacing.status === "over") {
      push({
        id: `budget-month-${today.slice(0, 7)}`,
        severity: "danger",
        icon: "gauge",
        title: "تجاوزت ميزانية الشهر",
        detail: `صرفت ${formatMoney(pacing.spent, settings.currency)} من ${formatMoney(
          pacing.monthlyBudget,
          settings.currency,
        )} — الباقي من جيبك`,
        targetView: "money",
        actionLabel: "افتح الميزانية",
        dismissKey: `budget-month-${today.slice(0, 7)}`,
      });
    } else if (pacing.projectedOver > 0) {
      push({
        id: `budget-projected-${today.slice(0, 7)}`,
        severity: "warning",
        icon: "gauge",
        title: "بهذا الإيقاع ستتجاوز الميزانية",
        detail: `المتوقع نهاية الشهر ${formatMoney(pacing.projected, settings.currency)} — تجاوز ${formatMoney(
          pacing.projectedOver,
          settings.currency,
        )}`,
        targetView: "money",
        actionLabel: "افتح الميزانية",
        dismissKey: `budget-projected-${today.slice(0, 7)}`,
      });
    } else if (pacing.delta > 0) {
      push({
        id: `budget-pace-${today.slice(0, 7)}`,
        severity: "info",
        icon: "gauge",
        title: `خلف وتيرة ميزانيتك بـ ${formatMoney(pacing.delta, settings.currency)}`,
        detail: `الوتيرة المستهدفة حتى اليوم ${formatMoney(pacing.expectedByNow, settings.currency)}`,
        targetView: "money",
        actionLabel: "افتح الميزانية",
        dismissKey: `budget-pace-${today.slice(0, 7)}`,
      });
    }
    if (pacing.weekRemaining < 0 && pacing.spent > 0) {
      push({
        id: `budget-week-${today.slice(0, 7)}`,
        severity: "warning",
        icon: "gauge",
        title: "تجاوزت حصة الأسبوع",
        detail: `متبقي الأسبوع ${formatMoney(pacing.weekRemaining, settings.currency)} — عدّل من تبويب الميزانية`,
        targetView: "money",
        actionLabel: "افتح الميزانية",
        dismissKey: `budget-week-${today.slice(0, 7)}`,
      });
    }
  }

  // 4) رصيد آمن منخفض
  const safe = safeToSpendWith(settings, txs, recurrings, goals);
  if (safe.amount <= 0 && safe.spent > 0) {
    push({
      id: "safe-zero",
      severity: "danger",
      icon: "trending-down",
      title: "الرصيد الآمن صفر هذا الشهر",
      detail: "راجع مظروفاً متجاوزاً أو أدخل دخلاً مسجلاً",
      targetView: "money",
      actionLabel: "افتح المال",
    });
  }

  // 5) عادات تنتظر اليوم (لو مفعلة تذكيراتها أو دائماً بحد واحد)
  const pending = habits.filter((h) => {
    if (h.archived) return false;
    const log = habitLogs.find((l) => l.habitId === h.id && l.date === today);
    return !log || log.count < h.target;
  });
  if (pending.length > 0) {
    push({
      id: "habits-pending",
      severity: "info",
      icon: "flame",
      title: `${formatNumber(pending.length)} ${pending.length === 1 ? "عادة تنتظرك" : "عادات تنتظرك"}`,
      detail: pending.slice(0, 2).map((h) => h.name).join("، ") + (pending.length > 2 ? " وغيرها" : ""),
      targetView: "habits",
      actionLabel: "افتح العادات",
      dismissKey: "habits-pending",
    });
  }

  // 6) حدث تقويم خلال الساعتين القادمتين
  const nowMin = hhmmToMinutes(nowHHMM());
  for (const b of blocks) {
    if (b.date !== today) continue;
    const start = hhmmToMinutes(b.startTime);
    const diff = start - nowMin;
    if (diff >= 0 && diff <= 120) {
      push({
        id: `block-soon-${b.id}`,
        severity: "info",
        icon: "calendar",
        title: `${b.title} ${diff === 0 ? "الآن" : `بعد ${formatNumber(Math.round(diff / 60)) === "0" ? formatNumber(diff) + " دقيقة" : ""}`}`.trim(),
        detail: b.title,
        targetView: "calendar",
        actionLabel: "افتح التقويم",
        dismissKey: `block-soon-${b.id}-${today}`,
      });
      break; // واحد يكفي
    }
  }

  // 7) هدف وصل لهذا الشهر
  for (const g of goals) {
    if (g.archived || g.targetAmount <= 0) continue;
    const pct = Math.round((g.savedAmount / g.targetAmount) * 100);
    if (pct >= 100) {
      push({
        id: `goal-done-${g.id}`,
        severity: "info",
        icon: "target",
        title: `هدف «${g.name}» اكتمل 🎉`,
        detail: `${g.emoji} وصلت ${formatMoney(g.savedAmount, settings.currency)}`,
        targetView: "money",
        actionLabel: "شارك الفرحة",
        dismissKey: `goal-done-${g.id}`,
      });
    }
  }

  // الترتيب: خطر ثم تحذير ثم معلومات
  const order = { danger: 0, warning: 1, info: 2 } as const;
  return alerts.sort((a, b) => order[a.severity] - order[b.severity]).slice(0, 6);
}

// مساعدات داخلية (تغلف حساب النافذة مرة واحدة)
import { financeMonthEnd, financeMonthStart } from "./format";
import type { MonthWindow } from "./money";
import { monthWindow as mw } from "./money";

function windowOf(settings: Settings): MonthWindow {
  return mw(settings, todayISO());
}

function envelopesWithWindow(settings: Settings, txs: Transaction[], categories: Category[]): Envelope[] {
  const w = windowOf(settings);
  return envelopes(categories, txs, w);
}

function safeToSpendWith(
  settings: Settings,
  txs: Transaction[],
  recurrings: Recurring[],
  goals: Goal[],
): SafeToSpend {
  return safeToSpend(settings, txs, recurrings, goals);
}

export { financeMonthStart, financeMonthEnd };
