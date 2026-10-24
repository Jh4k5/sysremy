/**
 * Systemy v2 — محرك المال المشتق (نقي، بلا حالة)
 * كل رقم مالي مشتق من المعاملات والإعدادات لحظياً:
 * أي إضافة/تعديل/حذف في أي شاشة تنعكس فوراً في كل مكان.
 */
import type {
  Account,
  Asset,
  Category,
  Debt,
  Goal,
  Recurring,
  Settings,
  Transaction,
} from "./types";
import {
  addDaysISO,
  diffDays,
  endOfWeekISO,
  financeMonthEnd,
  financeMonthStart,
  formatNumber,
  fromISODate,
  todayISO,
  type ISODate,
} from "./format";

export interface MonthWindow {
  start: ISODate;
  end: ISODate;
  daysTotal: number;
  daysLeft: number;
  label: string;
}

/** نافذة الشهر المالي الحالي */
export function monthWindow(settings: Pick<Settings, "monthStartDay">, today = todayISO()): MonthWindow {
  const start = financeMonthStart(today, settings.monthStartDay || 1);
  const end = financeMonthEnd(today, settings.monthStartDay || 1);
  const daysTotal = diffDays(start, end) + 1;
  const daysLeft = Math.max(1, diffDays(today, end) + 1);
  const s = fromISODate(start);
  const label = `${s.getFullYear()}-${String(s.getMonth() + 1).padStart(2, "0")}`;
  return { start, end, daysTotal, daysLeft, label };
}

/** هل المعاملة داخل نافذة؟ */
function inMonth(tx: Transaction, w: MonthWindow): boolean {
  const d = tx.date.slice(0, 10);
  return d >= w.start && d <= w.end;
}

// ═══════════════════════ أرصدة الحسابات ═══════════════════════

/**
 * رصيد الحساب الحالي = الافتتاحي + الدخل − المصروف ± التحويلات.
 * مشتق بالكامل: تعديل أي معاملة يصحح الرصيد تلقائياً.
 */
export function accountBalance(account: Account, txs: Transaction[]): number {
  let bal = account.startingBalance;
  for (const t of txs) {
    if (t.type === "income" && t.accountId === account.id) bal += t.amount;
    else if (t.type === "expense" && t.accountId === account.id) bal -= t.amount;
    else if (t.type === "transfer") {
      if (t.accountId === account.id) bal -= t.amount;
      if (t.toAccountId === account.id) bal += t.amount;
    }
  }
  return Math.round(bal * 100) / 100;
}

/** كل الأرصدة دفعة واحدة */
export function accountBalances(accounts: Account[], txs: Transaction[]): Map<string, number> {
  const map = new Map<string, number>();
  for (const a of accounts) map.set(a.id, accountBalance(a, txs));
  return map;
}

// ═══════════════════════ صافي الثروة ═══════════════════════

export interface NetWorth {
  accountsTotal: number;
  liquid: number;
  assetsTotal: number;
  liabilities: number;
  receivable: number;
  total: number;
}

export function netWorth(accounts: Account[], txs: Transaction[], assets: Asset[], debts: Debt[]): NetWorth {
  const balances = accountBalances(accounts, txs);
  const accountsTotal = accounts.reduce((s, a) => s + (balances.get(a.id) ?? 0), 0);
  const liquid = accounts.filter((a) => a.type !== "credit").reduce((s, a) => s + (balances.get(a.id) ?? 0), 0);
  const assetsTotal = assets.reduce((s, a) => s + a.value, 0);
  const receivable = debts.filter((d) => d.direction === "receivable").reduce((s, d) => s + Math.max(0, d.amount - d.paid), 0);
  const liabilities = debts.filter((d) => d.direction === "payable").reduce((s, d) => s + Math.max(0, d.amount - d.paid), 0);
  return {
    accountsTotal: Math.round(accountsTotal),
    liquid: Math.round(liquid),
    assetsTotal: Math.round(assetsTotal),
    liabilities: Math.round(liabilities),
    receivable: Math.round(receivable),
    total: Math.round(accountsTotal + assetsTotal + receivable - liabilities),
  };
}

// ═══════════════════════ الرصيد الآمن (Safe-to-Spend) ═══════════════════════

export interface SafeToSpend {
  amount: number;
  daysLeft: number;
  expectedIncome: number;
  commitments: number;
  goalContributions: number;
  spent: number;
  status: "great" | "good" | "careful";
}

export function safeToSpend(
  settings: Pick<Settings, "monthStartDay" | "monthlyIncome">,
  txs: Transaction[],
  recurrings: Recurring[],
  goals: Goal[],
  today = todayISO(),
): SafeToSpend {
  const w = monthWindow(settings, today);
  const monthTxs = txs.filter((t) => inMonth(t, w));

  const spent = monthTxs.filter((t) => t.type === "expense").reduce((s, t) => s + t.amount, 0);
  const received = monthTxs.filter((t) => t.type === "income").reduce((s, t) => s + t.amount, 0);

  // الدخل المتوقع: المتقاضي + دخل تقديري مضبوط بالنسبة المتبقية
  const monthlyIncome = settings.monthlyIncome || 0;
  const expectedIncome = received + monthlyIncome * (w.daysLeft / w.daysTotal);

  // الالتزامات المتكررة المستحقة خلال الشهر المتبقي
  const commitments = recurrings
    .filter((r) => r.active && r.type === "expense" && r.nextDate <= w.end && r.nextDate >= today)
    .reduce((s, r) => s + r.amount, 0);

  // مساهمات الأهداف الشهرية
  const goalContributions = goals.filter((g) => !g.archived).reduce((s, g) => s + g.monthly, 0);

  const raw = (expectedIncome - commitments - goalContributions - spent) / w.daysLeft;
  const amount = Math.max(0, Math.round(raw));

  const dailyAvgSpent = spent / Math.max(1, diffDays(w.start, today) + 1);
  let status: SafeToSpend["status"] = "good";
  if (amount > dailyAvgSpent * 1.15 || (amount > 0 && spent === 0)) status = "great";
  else if (amount < dailyAvgSpent * 0.6) status = "careful";

  return {
    amount,
    daysLeft: w.daysLeft,
    expectedIncome: Math.round(expectedIncome),
    commitments: Math.round(commitments),
    goalContributions: Math.round(goalContributions),
    spent: Math.round(spent),
    status,
  };
}

// ═══════════════════════ ميزانية الصرف الشهرية (Pacing) ═══════════════════════

/**
 * ميزانية الصرف الشهرية — منفصلة تماماً عن الدخل:
 * «أحدد مبلغاً أصرفه شهرياً → كم متبقي اليوم/الأسبوع/الشهر؟»
 * لو لم تُحدد بعد، تُشتق تلقائياً من مجموع مظاريف الفئات.
 */
export interface BudgetPacing {
  /** الميزانية الفعلية المستخدمة */
  monthlyBudget: number;
  /** true إن اشتُقت من مجموع المظاريف (لم يحددها المستخدم بعد) */
  derived: boolean;
  /** مجموع مظاريف الفئات (لزر «اعتمدها كميزانية») */
  envelopesSum: number;
  /** مصروف الشهر المالي حتى الآن */
  spent: number;
  /** مصروف اليوم */
  spentToday: number;
  /** المتبقي من الميزانية حتى نهاية الشهر */
  monthRemaining: number;
  daysTotal: number;
  daysElapsed: number;
  daysLeft: number;
  /** الحصة اليومية القادمة = المتبقي ÷ الأيام المتبقية */
  perDay: number;
  /** متبقي اليوم حصةً (الحصة − صرف اليوم) — سالب = تجاوزت حصة اليوم */
  todayRemaining: number;
  /** أيام الأسبوع الحالي المتبقية (بما فيها اليوم، مقيّدة بأيام الشهر) */
  weekLeftDays: number;
  /** متبقي هذا الأسبوع (من بداية أسبوعك حتى نهايته) */
  weekRemaining: number;
  /** المستهدف صرفه حتى الآن للاعتدال (الوتيرة) */
  expectedByNow: number;
  /** موجب = صرفت أكثر من الوتيرة */
  delta: number;
  /** الصرف المتوقع نهاية الشهر بمعدلك الحالي */
  projected: number;
  /** التجاوز المتوقع نهاية الشهر */
  projectedOver: number;
  /** نسبة الاستهلاك 0-100+ */
  percent: number;
  status: "unset" | "great" | "good" | "careful" | "over";
}

export function budgetPacing(
  settings: Pick<Settings, "monthStartDay" | "weekStart" | "monthlyBudget">,
  categories: Category[],
  txs: Transaction[],
  today = todayISO(),
): BudgetPacing {
  const w = monthWindow({ monthStartDay: settings.monthStartDay || 1 }, today);
  const envelopesSum = Math.round(
    categories.filter((c) => !c.archived && c.kind === "expense").reduce((s, c) => s + (c.budget ?? 0), 0)
  );
  const configured = settings.monthlyBudget && settings.monthlyBudget > 0 ? Math.round(settings.monthlyBudget) : 0;
  const monthlyBudget = configured || envelopesSum;
  const derived = configured === 0 && envelopesSum > 0;

  const monthTxs = txs.filter((t) => inMonth(t, w));
  const spent = Math.round(monthTxs.filter((t) => t.type === "expense").reduce((s, t) => s + t.amount, 0));
  const spentToday = Math.round(
    txs.filter((t) => t.type === "expense" && t.date.slice(0, 10) === today).reduce((s, t) => s + t.amount, 0)
  );

  const daysTotal = w.daysTotal;
  const daysElapsed = Math.min(daysTotal, Math.max(1, diffDays(w.start, today) + 1));
  const daysLeft = w.daysLeft;
  const monthRemaining = Math.round(monthlyBudget - spent);

  const perDay = Math.round(Math.max(0, monthRemaining) / daysLeft);
  const todayRemaining = Math.round(perDay - spentToday);

  const weekEnd = endOfWeekISO(today, settings.weekStart ?? "sat");
  const weekLeftDays = Math.max(1, Math.min(7, Math.min(diffDays(today, weekEnd) + 1, daysLeft)));
  const weekRemaining = Math.round(perDay * weekLeftDays - spentToday);

  const expectedByNow = Math.round((monthlyBudget * daysElapsed) / daysTotal);
  const delta = Math.round(spent - expectedByNow);
  const dailyAvg = spent / daysElapsed;
  const projected = Math.round(dailyAvg * daysTotal);
  const projectedOver = Math.max(0, Math.round(projected - monthlyBudget));
  const percent = monthlyBudget > 0 ? Math.round((spent / monthlyBudget) * 100) : 0;

  let status: BudgetPacing["status"] = "good";
  if (monthlyBudget <= 0) status = "unset";
  else if (spent > monthlyBudget) status = "over";
  else if (delta > 0 || projectedOver > 0) status = "careful";
  else if (spent === 0 || delta <= -expectedByNow * 0.15) status = "great";

  return {
    monthlyBudget,
    derived,
    envelopesSum,
    spent,
    spentToday,
    monthRemaining,
    daysTotal,
    daysElapsed,
    daysLeft,
    perDay,
    todayRemaining,
    weekLeftDays,
    weekRemaining,
    expectedByNow,
    delta,
    projected,
    projectedOver,
    percent,
    status,
  };
}

/** مصروف ضمن نطاق تاريخي (للأسبوع/اليوم في التقارير والتنبيهات) */
export function spentInRange(txs: Transaction[], from: ISODate, to: ISODate): number {
  return Math.round(
    txs.filter((t) => t.type === "expense" && t.date.slice(0, 10) >= from && t.date.slice(0, 10) <= to).reduce(
      (s, t) => s + t.amount,
      0
    )
  );
}

// ═══════════════════════ مظاريف الميزانية ═══════════════════════

export interface Envelope {
  category: Category;
  budget: number;
  spent: number;
  percent: number;
  remaining: number;
  status: "great" | "good" | "careful" | "over";
}

export function envelopes(categories: Category[], txs: Transaction[], w: MonthWindow): Envelope[] {
  const spentByCat = new Map<string, number>();
  for (const t of txs) {
    if (t.type !== "expense" || !t.categoryId) continue;
    if (!inMonth(t, w)) continue;
    spentByCat.set(t.categoryId, (spentByCat.get(t.categoryId) ?? 0) + t.amount);
  }
  return categories
    .filter((c) => !c.archived && c.kind === "expense" && (c.budget ?? 0) > 0)
    .map((c) => {
      const budget = c.budget as number;
      const spent = Math.round(spentByCat.get(c.id) ?? 0);
      const percent = Math.round((spent / budget) * 100);
      let status: Envelope["status"] = "great";
      if (percent > 100) status = "over";
      else if (percent >= 85) status = "careful";
      else if (percent >= 60) status = "good";
      return { category: c, budget, spent, percent, remaining: Math.round(budget - spent), status };
    })
    .sort((a, b) => b.percent - a.percent);
}

// ═══════════════════════ ملخص الشهر والسلاسل ═══════════════════════

export interface MonthSummary {
  spent: number;
  income: number;
  delta: number; // % مقارنة بالشهر المالي السابق
  prevSpent: number;
  txCount: number;
}

export function monthSummary(settings: Pick<Settings, "monthStartDay">, txs: Transaction[], today = todayISO()): MonthSummary {
  const w = monthWindow(settings, today);
  const prevStart = addDaysISO(w.start, -diffDays(w.start, financeMonthEnd(addDaysISO(w.start, -1), settings.monthStartDay || 1)) - 1);
  const monthTxs = txs.filter((t) => inMonth(t, w));
  const spent = Math.round(monthTxs.filter((t) => t.type === "expense").reduce((s, t) => s + t.amount, 0));
  const income = Math.round(monthTxs.filter((t) => t.type === "income").reduce((s, t) => s + t.amount, 0));
  const prevTxs = txs.filter((t) => {
    const d = t.date.slice(0, 10);
    return t.type === "expense" && d >= prevStart && d < w.start;
  });
  const prevSpent = Math.round(prevTxs.reduce((s, t) => s + t.amount, 0));
  const delta = prevSpent > 0 ? Math.round(((spent - prevSpent) / prevSpent) * 100) : 0;
  return { spent, income, delta, prevSpent, txCount: monthTxs.length };
}

/** صرف كل يوم — آخر N يوماً */
export function dailySeries(txs: Transaction[], days = 14, today = todayISO()): { day: string; spent: number }[] {
  const out: { day: string; spent: number }[] = [];
  for (let i = days - 1; i >= 0; i--) {
    const iso = addDaysISO(today, -i);
    const spent = Math.round(
      txs.filter((t) => t.type === "expense" && t.date.slice(0, 10) === iso).reduce((s, t) => s + t.amount, 0)
    );
    out.push({ day: String(fromISODate(iso).getDate()), spent });
  }
  return out;
}

/** صرف الشهر حسب الفئة — أعلى N */
export function categorySeries(categories: Category[], txs: Transaction[], w: MonthWindow, top = 6): { name: string; value: number; color: string }[] {
  const catById = new Map(categories.map((c) => [c.id, c]));
  const spentByCat = new Map<string, number>();
  for (const t of txs) {
    if (t.type !== "expense" || !t.categoryId || !inMonth(t, w)) continue;
    spentByCat.set(t.categoryId, (spentByCat.get(t.categoryId) ?? 0) + t.amount);
  }
  return [...spentByCat.entries()]
    .map(([id, value]) => ({
      name: catById.get(id)?.name ?? "أخرى",
      value: Math.round(value),
      color: catById.get(id)?.color ?? "#8EC5FF",
    }))
    .sort((a, b) => b.value - a.value)
    .slice(0, top);
}

/** Runway: كم شهر يكفي رصيدك السائل بمعدل صرفك */
export function runway(accounts: Account[], txs: Transaction[], today = todayISO()): number {
  const from = addDaysISO(today, -30);
  const balances = accountBalances(accounts, txs);
  const liquid = accounts.filter((a) => a.type !== "credit").reduce((s, a) => s + (balances.get(a.id) ?? 0), 0);
  const spent = txs.filter((t) => t.type === "expense" && t.date.slice(0, 10) >= from).reduce((s, t) => s + t.amount, 0);
  const income = txs.filter((t) => t.type === "income" && t.date.slice(0, 10) >= from).reduce((s, t) => s + t.amount, 0);
  const net = income - spent;
  if (net >= 0) return 99;
  if (Math.abs(net) === 0) return 99;
  return Math.round((liquid / Math.abs(net)) * 10) / 10;
}

// ═══════════════════════ التزامات وديون قادمة ═══════════════════════

export interface DueSoonItem {
  id: string;
  kind: "recurring" | "debt";
  name: string;
  amount: number;
  dueDate: ISODate;
  daysLeft: number;
  icon: string;
}

/** المستحق خلال N أيام — التزامات وديون (للتنبيهات والتقويم) */
export function dueSoon(recurrings: Recurring[], debts: Debt[], withinDays = 3, today = todayISO()): DueSoonItem[] {
  const out: DueSoonItem[] = [];
  for (const r of recurrings) {
    if (!r.active || r.type !== "expense") continue;
    const d = diffDays(today, r.nextDate);
    if (d >= 0 && d <= withinDays) {
      out.push({ id: r.id, kind: "recurring", name: r.name, amount: r.amount, dueDate: r.nextDate, daysLeft: d, icon: r.icon });
    }
  }
  for (const debt of debts) {
    if (!debt.dueDate || debt.direction !== "payable" || debt.paid >= debt.amount) continue;
    const d = diffDays(today, debt.dueDate);
    if (d >= 0 && d <= withinDays) {
      out.push({ id: debt.id, kind: "debt", name: debt.name, amount: debt.amount - debt.paid, dueDate: debt.dueDate, daysLeft: d, icon: "hand-coins" });
    }
  }
  return out.sort((a, b) => a.daysLeft - b.daysLeft);
}

/** تقديم تاريخ الاستحقاق التالي للتكرار */
export function advanceRecurringDate(nextDate: ISODate, frequency: Recurring["frequency"]): ISODate {
  const d = fromISODate(nextDate);
  switch (frequency) {
    case "daily":
      d.setDate(d.getDate() + 1);
      break;
    case "weekly":
      d.setDate(d.getDate() + 7);
      break;
    case "yearly":
      d.setFullYear(d.getFullYear() + 1);
      break;
    case "monthly":
    default:
      d.setMonth(d.getMonth() + 1);
      break;
  }
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(d.getDate()).padStart(2, "0")}`;
}

/** تصنيف ذكي: أفضل فئة من الوصف/التاجر عبر الكلمات المفتاحية */
export function guessCategory(text: string, categories: Category[], kind: "expense" | "income"): Category | null {
  const t = text.trim();
  if (!t) return null;
  let best: { c: Category; len: number } | null = null;
  for (const c of categories) {
    if (c.archived || c.kind !== kind) continue;
    const words = [c.name, ...c.keywords.split(",").map((k) => k.trim()).filter(Boolean)];
    for (const w of words) {
      if (w.length >= 2 && t.includes(w)) {
        if (!best || w.length > best.len) best = { c, len: w.length };
      }
    }
  }
  return best?.c ?? null;
}

/** إجمالي أنفق على نص في وصف/تاجر/وسوم — لأسئلة Sys */
export function spentOnQuery(txs: Transaction[], q: string, today = todayISO()): { total: number; count: number } {
  const w30 = addDaysISO(today, -30);
  const hits = txs.filter((t) => {
    if (t.type !== "expense" && t.type !== "income") return false;
    const d = t.date.slice(0, 10);
    if (d < w30 || d > today) return false;
    return (
      t.description.includes(q) ||
      (t.merchant ?? "").includes(q) ||
      t.tags.includes(q)
    );
  });
  return {
    total: Math.round(hits.filter((t) => t.type === "expense").reduce((s, t) => s + t.amount, 0)),
    count: hits.length,
  };
}

export { formatNumber };
