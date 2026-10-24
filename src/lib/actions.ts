/**
 * Systemy v2 — طبقة الإجراءات (Service Layer)
 * كل تعديل في التطبيق يمر من هنا: شاشات→إجراءات→قاعدة البيانات.
 * هنا يعيش الترابط: كل إجراء يبني الروابط الصحيحة بين الأنظمة
 * (التزام→معاملة، هدف→تحويل، عادة→ادخار، مهمة→تذكير…)
 * والبقية تتحدث تلقائياً عبر liveQuery.
 */
"use client";

import { toast } from "sonner";
import { db, getSettings, nowLocal, saveSettings, uid } from "./db";
import type {
  Account,
  Asset,
  Category,
  Course,
  Debt,
  DocumentRecord,
  Flashcard,
  Goal,
  GradeItem,
  Habit,
  HealthKind,
  HomeItem,
  ListItem,
  Mood,
  Note,
  Person,
  Project,
  Recurring,
  Reminder,
  Task,
  TimeBlock,
  Transaction,
  Trip,
} from "./types";
import { DOC_TYPE_LABELS, HEALTH_META, LEITNER_INTERVALS } from "./types";
import { advanceRecurringDate, guessCategory } from "./money";
import { formatMoney, nowHHMM, todayISO } from "./format";
import { markNotified } from "./notifications";
import { financeMonthKey, leftoverOfPreviousMonth, previousMonthWindow } from "./budget-engine";

const nowISO = () => new Date().toISOString();
const ok = (msg: string, desc?: string) => toast.success(msg, desc ? { description: desc } : undefined);

// ═══════════════════════ المعاملات ═══════════════════════

export async function addTransaction(input: {
  type: Transaction["type"];
  amount: number;
  description: string;
  accountId: string;
  toAccountId?: string;
  categoryId?: string;
  date?: string; // ISODateTime
  merchant?: string;
  tags?: string;
  person?: string;
  notes?: string;
  source?: Transaction["source"];
  recurringId?: string;
  goalId?: string;
  /** v4: صرف خارج ميزانية المعيشة */
  outsideBudget?: boolean;
}): Promise<Transaction | null> {
  if (!(input.amount > 0)) {
    toast.error("أدخل مبلغاً صحيحاً أكبر من صفر");
    return null;
  }
  if (!input.description.trim()) {
    toast.error("أضف وصفاً قصيراً");
    return null;
  }
  const account = await db.accounts.get(input.accountId);
  if (!account) {
    toast.error("الحساب غير موجود");
    return null;
  }
  const now = nowISO();
  const tx: Transaction = {
    id: uid(),
    type: input.type,
    amount: Math.round(input.amount * 100) / 100,
    description: input.description.trim(),
    merchant: input.merchant?.trim() || undefined,
    accountId: input.accountId,
    toAccountId: input.toAccountId || undefined,
    categoryId: input.categoryId || undefined,
    date: input.date || nowLocal(),
    source: input.source ?? "manual",
    tags: input.tags ?? "",
    person: input.person?.trim() || undefined,
    notes: input.notes?.trim() || undefined,
    recurringId: input.recurringId || undefined,
    goalId: input.goalId || undefined,
    outsideBudget: input.outsideBudget === true ? true : undefined,
    createdAt: now,
    updatedAt: now,
  };
  await db.transactions.add(tx);
  const settings = await getSettings();
  ok(
    input.type === "income" ? "سُجل الدخل ✓" : input.type === "transfer" ? "تم التحويل ✓" : "سُجل المصروف ✓",
    `${input.description} · ${formatMoney(tx.amount, settings.currency)} · في أقل من 3 ثوانٍ`
  );
  return tx;
}

export async function updateTransaction(id: string, patch: Partial<Transaction>): Promise<void> {
  await db.transactions.update(id, { ...patch, updatedAt: nowISO() });
  ok("حُدّثت المعاملة ✓");
}

export async function deleteTransaction(id: string): Promise<void> {
  await db.transactions.delete(id);
  ok("حُذفت المعاملة — كل الأرصدة صُححت تلقائياً");
}

/** تعديل كامل لمعاملة (استبدال) */
export async function replaceTransaction(id: string, input: Parameters<typeof addTransaction>[0]): Promise<boolean> {
  const existing = await db.transactions.get(id);
  if (!existing) return false;
  if (!(input.amount > 0)) {
    toast.error("أدخل مبلغاً صحيحاً");
    return false;
  }
  await db.transactions.put({
    ...existing,
    type: input.type,
    amount: Math.round(input.amount * 100) / 100,
    description: input.description.trim() || existing.description,
    merchant: input.merchant?.trim() || undefined,
    accountId: input.accountId,
    toAccountId: input.toAccountId || undefined,
    categoryId: input.categoryId || undefined,
    date: input.date || existing.date,
    tags: input.tags ?? existing.tags,
    person: input.person?.trim() || undefined,
    notes: input.notes?.trim() || undefined,
    updatedAt: nowISO(),
  });
  ok("حُدّثت المعاملة ✓");
  return true;
}

// ═══════════════════════ الحسابات والفئات ═══════════════════════

export async function addAccount(input: Omit<Account, "id" | "createdAt">): Promise<Account> {
  const account: Account = { ...input, id: uid(), createdAt: nowISO() };
  await db.accounts.add(account);
  ok("أُضيف الحساب ✓", account.name);
  return account;
}

/**
 * ضمان وجود حساب نشط واحد على الأقل — مسار التعافي الحاسم.
 * إن لم يوجد أي حساب نشط (تخطّى المستخدم خطوة النقد في الإعداد الأولي)
 * يُنشأ حساب «نقد» برصيد 0 فوراً كي لا يصطدم التسجيل بجدار صامت.
 * يعيد { account, created } — created=true إن أُنشئ الآن.
 */
export async function ensureDefaultAccount(): Promise<{ account: Account; created: boolean }> {
  // v4 fix: يستثني حسابات الادخار ويرتب بالترتيب — كي لا يلتقط «ادخار» كمصدر افتراضي
  const active = (await db.accounts.toArray())
    .filter((a) => !a.archived)
    .sort((a, b) => a.order - b.order);
  const spendable = active.filter((a) => a.type !== "savings");
  if (spendable.length > 0) return { account: spendable[0], created: false };
  if (active.length > 0) return { account: active[0], created: false };
  const account = await addAccount({
    name: "نقد",
    type: "cash",
    color: "#F5B95C",
    icon: "banknote",
    startingBalance: 0,
    archived: false,
    order: 1,
  });
  return { account, created: true };
}

/* ═══════ v4: الدخل / الادخار / كنس فائض الشهر ═══════ */

/** يضمن وجود حساب ادخار — يُنشأ «ادخار» إن لم يوجد */
export async function ensureSavingsAccount(): Promise<{ account: Account; created: boolean }> {
  const savings = (await db.accounts.toArray()).filter((a) => a.type === "savings" && !a.archived);
  if (savings.length > 0) return { account: savings[0], created: false };
  const account = await addAccount({
    name: "ادخار",
    type: "savings",
    color: "#6EE7A8",
    icon: "piggy-bank",
    startingBalance: 0,
    archived: false,
    order: 90,
  });
  return { account, created: true };
}

/**
 * تسجيل دخل — «وصلني مبلغ» من أي جهة.
 * يزيد رصيد الحساب فوراً ولا يدخل في حساب ميزانية المعيشة.
 */
export async function addIncome(input: {
  amount: number;
  description: string;
  accountId?: string;
  categoryId?: string;
  date?: string;
  tags?: string;
}): Promise<Transaction | null> {
  const { account } = await ensureDefaultAccount();
  return addTransaction({
    type: "income",
    amount: input.amount,
    description: input.description,
    accountId: input.accountId ?? account.id,
    categoryId: input.categoryId,
    date: input.date,
    tags: input.tags,
    source: "manual",
  });
}

/**
 * إضافة مبلغ إلى الادخار — تحويل من حساب المصدر (افتراضي «نقد») إلى حساب الادخار.
 * لا يغيّر صافي الثروة — ينقل المال إلى وعاء الادخار.
 */
export async function addToSavings(input: {
  amount: number;
  description?: string;
  fromAccountId?: string;
  date?: string;
}): Promise<Transaction | null> {
  if (!(input.amount > 0)) {
    toast.error("أدخل مبلغاً صحيحاً أكبر من صفر");
    return null;
  }
  const savings = await ensureSavingsAccount();
  // المصدر: الحساب المحدد أو الحساب الافتراضي — وحراسة من التحويل الذاتي (ادخار→ادخار)
  let from: Account | undefined;
  if (input.fromAccountId) {
    from = await db.accounts.get(input.fromAccountId);
  } else {
    from = (await ensureDefaultAccount()).account;
  }
  if (!from || from.id === savings.account.id) {
    const active = (await db.accounts.toArray())
      .filter((a) => !a.archived && a.id !== savings.account.id && a.type !== "savings")
      .sort((a, b) => a.order - b.order);
    if (active.length > 0) {
      from = active[0];
    } else {
      // لا مصدر غير الادخار — أنشئ «نقد» ليكون المصدر
      from = (await addAccount({
        name: "نقد",
        type: "cash",
        color: "#F5B95C",
        icon: "banknote",
        startingBalance: 0,
        archived: false,
        order: 1,
      })) as Account;
      toast.info("أنشأنا حساب «نقد» كمصدر للتحويل");
    }
  }
  const res = await addTransaction({
    type: "transfer",
    amount: input.amount,
    description: input.description?.trim() || "تحويل للادخار",
    accountId: from.id,
    toAccountId: savings.account.id,
    date: input.date,
    source: "manual",
  });
  if (res && savings.created) {
    toast.info("أنشأنا حساب «ادخار» لك تلقائياً", { description: "وعاؤك الآمن — تراكمي ومرتبط بأهدافك" });
  }
  return res;
}

/** قفل تشغيل واحد — يمنع سباق الاستدعاءات المتزامنة (strict mode + الحفظ) */
let sweepInFlight: Promise<{ amount: number } | null> | null = null;

/**
 * كنس فائض الشهر المالي السابق إلى الادخار — يعمل مرة واحدة لكل شهر.
 * • يشترط settings.autoSweep مفعل و monthlyBudget محددة.
 * • الفائض = monthlyBudget − صرف معيشة الشهر السابق (موجب فقط).
 * • يتخطى الشهور التي لم تُسجّل فيها أي معاملة أصلاً (شهر غير متتبع — لا كنس مفاجئ).
 * • يُنشئ تحويلاً بتاريخ نهاية الشهر السابق، مصدره "sweep"، ويقيّد lastSweepMonth.
 * • يعيد null إن لا كنس مطلوب؛ وإلا مبلغ الكنس.
 */
export function sweepMonthLeftover(): Promise<{ amount: number } | null> {
  if (!sweepInFlight) {
    sweepInFlight = doSweepMonthLeftover().finally(() => {
      sweepInFlight = null;
    });
  }
  return sweepInFlight;
}

async function doSweepMonthLeftover(): Promise<{ amount: number } | null> {
  const settings = await getSettings();
  const monthlyBudget = settings.monthlyBudget ?? 0;
  if (!settings.autoSweep || !(monthlyBudget > 0)) return null;

  const thisMonthKey = financeMonthKey(settings);
  if (settings.lastSweepMonth === thisMonthKey) return null; // كُنس هذا الشهر مسبقاً

  const allTxs = await db.transactions.toArray();

  // الشهر السابق لم يكن متتبعاً أصلاً (لا أي معاملة فيه) → لا كنس مفاجئ
  const prev = previousMonthWindow(settings);
  const prevHadActivity = allTxs.some((t) => {
    const d = (t.date || "").slice(0, 10);
    return d >= prev.start && d <= prev.end;
  });
  if (!prevHadActivity) {
    await db.settings.update("app", { lastSweepMonth: thisMonthKey, updatedAt: nowISO() });
    return null;
  }

  const leftover = leftoverOfPreviousMonth(
    { monthStartDay: settings.monthStartDay, monthlyBudget },
    allTxs,
  );
  if (leftover <= 0) {
    // لا فائض — نسجّل الشهر حتى لا نعيد الحساب كل تحميل
    await db.settings.update("app", { lastSweepMonth: thisMonthKey, updatedAt: nowISO() });
    return null;
  }

  const savings = await ensureSavingsAccount();
  const res = await addTransaction({
    type: "transfer",
    amount: leftover,
    description: `فائض شهر ${prev.start.slice(0, 7)} → الادخار`,
    accountId: (await ensureDefaultAccount()).account.id,
    toAccountId: savings.account.id,
    date: `${prev.end}T23:59`,
    source: "sweep",
  });
  await db.settings.update("app", { lastSweepMonth: thisMonthKey, updatedAt: nowISO() });
  if (res) {
    toast.success("كنسنا فائض الشهر إلى الادخار 🎉", {
      description: `${formatMoney(leftover, settings.currency)} — رصيدك المتراكم يزيد تلقائياً`,
    });
  }
  return { amount: leftover };
}

export async function updateAccount(id: string, patch: Partial<Account>): Promise<void> {
  await db.accounts.update(id, patch);
  ok("حُدّث الحساب ✓");
}

export async function deleteAccount(id: string): Promise<void> {
  const count = await db.transactions.where("accountId").equals(id).count();
  if (count > 0) {
    await db.accounts.update(id, { archived: true });
    ok("أُرشِف الحساب", `${count} معاملة مرتبطة تبقى في السجل`);
    return;
  }
  await db.accounts.delete(id);
  ok("حُذف الحساب ✓");
}

export async function addCategory(input: Omit<Category, "id" | "createdAt">): Promise<Category> {
  const c: Category = { ...input, id: uid(), createdAt: nowISO() };
  await db.categories.add(c);
  ok("أُضيفت الفئة ✓", c.name);
  return c;
}

export async function updateCategory(id: string, patch: Partial<Category>): Promise<void> {
  await db.categories.update(id, patch);
  ok("حُدّثت الفئة ✓");
}

export async function deleteCategory(id: string): Promise<void> {
  const count = await db.transactions.where("categoryId").equals(id).count();
  if (count > 0) {
    await db.categories.update(id, { archived: true });
    ok("أُرشِفت الفئة", `${count} معاملة تحتفظ بتصنيفها`);
    return;
  }
  await db.categories.delete(id);
  ok("حُذفت الفئة ✓");
}

// ═══════════════════════ الالتزامات المتكررة ═══════════════════════

export async function addRecurring(input: Omit<Recurring, "id" | "createdAt">): Promise<Recurring> {
  const r: Recurring = { ...input, id: uid(), createdAt: nowISO() };
  await db.recurrings.add(r);
  // تذكير قبل الاستحقاق
  await scheduleRecurringReminder(r);
  ok("أُضيف الالتزام ✓", `${r.name} · يستحق ${r.nextDate}`);
  return r;
}

async function scheduleRecurringReminder(r: Recurring): Promise<void> {
  if (!r.active) return;
  const remindDays = Math.max(0, r.reminderDays ?? 2);
  const due = new Date(r.nextDate + "T09:00:00");
  due.setDate(due.getDate() - remindDays);
  const dueAt = `${r.nextDate}T09:00`;
  void due;
  await db.reminders.add({
    id: uid(),
    title: `${r.name} يستحق ${r.reminderDays ? `بعد ${r.reminderDays} يوم` : "اليوم"}`,
    dueAt,
    sourceType: "recurring",
    sourceId: r.id,
    done: false,
    createdAt: nowISO(),
  });
}

export async function updateRecurring(id: string, patch: Partial<Recurring>): Promise<void> {
  await db.recurrings.update(id, patch);
  ok("حُدّث الالتزام ✓");
}

export async function deleteRecurring(id: string): Promise<void> {
  await db.transaction("rw", db.recurrings, db.reminders, async () => {
    await db.recurrings.delete(id);
    await db.reminders.where("sourceId").equals(id).delete();
  });
  ok("حُذف الالتزام ✓");
}

/**
 * سداد التزام متكرر — الترابط الأمثل:
 * ينشئ معاملة مرتبطة بالفئة والحساب، يقدّم تاريخ الاستحقاق التالي،
 * وينشئ التذكير التالي. كل الشاشات تتحدث فوراً.
 */
export async function payRecurring(id: string, overrides?: { date?: string; amount?: number; accountId?: string }): Promise<void> {
  const r = await db.recurrings.get(id);
  if (!r) return;
  const settings = await getSettings();
  const amount = overrides?.amount ?? r.amount;
  const accountId = overrides?.accountId ?? r.accountId;
  if (!accountId) {
    toast.error("اختر الحساب أولاً من إعدادات الالتزام");
    return;
  }
  const nextDate = advanceRecurringDate(r.nextDate, r.frequency);
  await db.recurrings.update(id, { nextDate });

  const now = nowISO();
  await db.transactions.add({
    id: uid(),
    type: r.type === "income" ? "income" : "expense",
    amount,
    description: r.name,
    accountId,
    categoryId: r.categoryId,
    date: (overrides?.date ?? `${r.nextDate}T${nowHHMM()}`),
    source: "recurring",
    tags: "متكرر",
    recurringId: r.id,
    createdAt: now,
    updatedAt: now,
  });
  // التذكير التالي
  await db.reminders.where("sourceId").equals(id).delete();
  const updated = await db.recurrings.get(id);
  if (updated) await scheduleRecurringReminder(updated);

  ok(
    r.type === "income" ? "سُجل الدخل المتكرر ✓" : "سُدد الالتزام ✓",
    `${r.name} · ${formatMoney(amount, settings.currency)} · الاستحقاق التالي ${nextDate}`
  );
}

// ═══════════════════════ الأهداف (الأوعية) ═══════════════════════

export async function addGoal(input: Omit<Goal, "id" | "createdAt">): Promise<Goal> {
  const g: Goal = { ...input, id: uid(), createdAt: nowISO() };
  await db.goals.add(g);
  ok("أُضيف الهدف ✓", `${g.emoji} ${g.name}`);
  return g;
}

export async function updateGoal(id: string, patch: Partial<Goal>): Promise<void> {
  await db.goals.update(id, patch);
  ok("حُدّث الهدف ✓");
}

export async function deleteGoal(id: string): Promise<void> {
  await db.goals.delete(id);
  ok("حُذف الهدف ✓");
}

/**
 * مساهمة في هدف — الترابط: ينشئ تحويلاً (أو مصروفاً) مرتبطاً بالهدف
 * ويحدّث رصيد الوعاء، فتتحدث نسبة الهدف والرصيد الآمن والتقويم معاً.
 */
export async function contributeGoal(
  goalId: string,
  amount: number,
  opts?: { accountId?: string; date?: string },
): Promise<void> {
  const g = await db.goals.get(goalId);
  if (!g || !(amount > 0)) return;
  const settings = await getSettings();
  await db.goals.update(goalId, { savedAmount: Math.round((g.savedAmount + amount) * 100) / 100 });
  if (opts?.accountId) {
    const now = nowISO();
    await db.transactions.add({
      id: uid(),
      type: "transfer",
      amount: Math.round(amount * 100) / 100,
      description: `مساهمة في «${g.name}»`,
      accountId: opts.accountId,
      toAccountId: "goal:" + goalId,
      date: opts.date || nowLocal(),
      source: "goal",
      tags: "ادخار",
      goalId,
      createdAt: now,
      updatedAt: now,
    });
  }
  const pct = Math.min(100, Math.round(((g.savedAmount + amount) / g.targetAmount) * 100));
  ok(
    pct >= 100 ? `اكتمل هدف «${g.name}» 🎉` : "أُضيفت المساهمة ✓",
    `${formatMoney(amount, settings.currency)} · ${pct}% من الهدف`
  );
}

/** سحب من هدف */
export async function withdrawGoal(goalId: string, amount: number, opts?: { accountId?: string }): Promise<void> {
  const g = await db.goals.get(goalId);
  if (!g || !(amount > 0)) return;
  const settings = await getSettings();
  await db.goals.update(goalId, { savedAmount: Math.max(0, Math.round((g.savedAmount - amount) * 100) / 100) });
  if (opts?.accountId) {
    const now = nowISO();
    await db.transactions.add({
      id: uid(),
      type: "income",
      amount: Math.round(amount * 100) / 100,
      description: `سحب من «${g.name}»`,
      accountId: opts.accountId,
      date: nowLocal(),
      source: "goal",
      tags: "ادخار",
      goalId,
      createdAt: now,
      updatedAt: now,
    });
  }
  ok("سُحب من الهدف", formatMoney(amount, settings.currency));
}

// ═══════════════════════ الأصول والديون ═══════════════════════

export async function addAsset(input: Omit<Asset, "id" | "createdAt">): Promise<Asset> {
  const a: Asset = { ...input, id: uid(), createdAt: nowISO() };
  await db.assets.add(a);
  ok("أُضيف الأصل ✓", a.name);
  return a;
}

export async function updateAsset(id: string, patch: Partial<Asset>): Promise<void> {
  await db.assets.update(id, patch);
  ok("حُدّث الأصل ✓");
}

export async function deleteAsset(id: string): Promise<void> {
  await db.assets.delete(id);
  ok("حُذف الأصل ✓");
}

export async function addDebt(input: Omit<Debt, "id" | "createdAt">): Promise<Debt> {
  const d: Debt = { ...input, id: uid(), createdAt: nowISO() };
  await db.debts.add(d);
  if (d.dueDate && d.direction === "payable" && d.paid < d.amount) {
    await db.reminders.add({
      id: uid(),
      title: `${d.name} (${d.person}) يستحق`,
      dueAt: `${d.dueDate}T09:00`,
      sourceType: "debt",
      sourceId: d.id,
      done: false,
      createdAt: nowISO(),
    });
  }
  ok("أُضيف الدين ✓", `${d.name} · ${d.person}`);
  return d;
}

export async function updateDebt(id: string, patch: Partial<Debt>): Promise<void> {
  await db.debts.update(id, patch);
  ok("حُدّث الدين ✓");
}

export async function deleteDebt(id: string): Promise<void> {
  await db.transaction("rw", db.debts, db.reminders, async () => {
    await db.debts.delete(id);
    await db.reminders.where("sourceId").equals(id).delete();
  });
  ok("حُذف الدين ✓");
}

/** تسديد دين — ينشئ معاملة مرتبطة ويحدّث المتبقي */
export async function settleDebt(id: string, amount: number, accountId?: string): Promise<void> {
  const d = await db.debts.get(id);
  if (!d || !(amount > 0)) return;
  const settings = await getSettings();
  const paid = Math.min(d.amount, Math.round((d.paid + amount) * 100) / 100);
  await db.debts.update(id, { paid });
  if (accountId && d.direction === "payable") {
    const now = nowISO();
    await db.transactions.add({
      id: uid(),
      type: "expense",
      amount,
      description: `تسديد: ${d.name}`,
      accountId,
      date: nowLocal(),
      source: "manual",
      tags: "دين",
      person: d.person,
      createdAt: now,
      updatedAt: now,
    });
  }
  ok(paid >= d.amount ? "سُدّد الدين بالكامل ✓" : "سُجّل جزء من الدين ✓", formatMoney(amount, settings.currency));
}

/** استلام دين مستحق لك */
export async function receiveDebt(id: string, amount: number, accountId?: string): Promise<void> {
  const d = await db.debts.get(id);
  if (!d || !(amount > 0)) return;
  const settings = await getSettings();
  const paid = Math.min(d.amount, Math.round((d.paid + amount) * 100) / 100);
  await db.debts.update(id, { paid });
  if (accountId) {
    const now = nowISO();
    await db.transactions.add({
      id: uid(),
      type: "income",
      amount,
      description: `استلام: ${d.name}`,
      accountId,
      date: nowLocal(),
      source: "manual",
      tags: "دين",
      person: d.person,
      createdAt: now,
      updatedAt: now,
    });
  }
  ok(paid >= d.amount ? "استُلم الدين بالكامل ✓" : "سُجّل جزء من الاستلام ✓", formatMoney(amount, settings.currency));
}

// ═══════════════════════ العادات ═══════════════════════

export async function addHabit(input: Omit<Habit, "id" | "createdAt">): Promise<Habit> {
  const h: Habit = { ...input, id: uid(), createdAt: nowISO() };
  await db.habits.add(h);
  ok("أُضيفت العادة ✓", h.name);
  return h;
}

export async function updateHabit(id: string, patch: Partial<Habit>): Promise<void> {
  await db.habits.update(id, patch);
  ok("حُدّثت العادة ✓");
}

export async function deleteHabit(id: string): Promise<void> {
  await db.transaction("rw", db.habits, db.habitLogs, db.reminders, async () => {
    await db.habits.delete(id);
    await db.habitLogs.where("habitId").equals(id).delete();
    await db.reminders.where("sourceId").equals(id).delete();
  });
  ok("حُذفت العادة وسجلاتها ✓");
}

/**
 * تسجيل عادة — الترابط: إن كانت مرتبطة بهدف ادخار تُضاف المساهمة
 * تلقائياً للوعاء عند بلوغ الهدف اليومي.
 */
export async function logHabit(habitId: string, count?: number, minutes?: number): Promise<{ done: boolean; count: number; minutes: number } | null> {
  const h = await db.habits.get(habitId);
  if (!h) return null;
  const today = todayISO();
  const existing = await db.habitLogs.where("habitId").equals(habitId).filter((l) => l.date === today).first();

  let logCount: number;
  let logMinutes: number;
  let done: boolean;
  if (existing) {
    const next = (count ?? existing.count + h.target) - existing.count;
    if (next <= 0) {
      // تراجع عن إنجاز اليوم
      await db.habitLogs.delete(existing.id);
      ok(`تراجعت عن «${h.name}»`);
      return { done: false, count: 0, minutes: 0 };
    }
    logCount = Math.min(h.target, existing.count + next);
    logMinutes = (existing.minutes ?? 0) + (minutes ?? 0);
    await db.habitLogs.update(existing.id, { count: logCount, minutes: logMinutes, updatedAt: nowISO() });
    done = logCount >= h.target;
  } else {
    logCount = Math.min(h.target, count ?? h.target);
    logMinutes = minutes ?? 0;
    await db.habitLogs.add({ id: uid(), habitId, date: today, count: logCount, minutes: logMinutes, updatedAt: nowISO() });
    done = logCount >= h.target;
  }

  // ربط الادخار: عند اكتمال الهدف اليومي (مرة واحدة يومياً)
  if (done && h.saveAmount && h.goalId) {
    const alreadyCounted = existing ? existing.count >= h.target : false;
    if (!alreadyCounted) {
      const g = await db.goals.get(h.goalId);
      if (g) {
        await db.goals.update(h.goalId, { savedAmount: Math.round((g.savedAmount + h.saveAmount) * 100) / 100 });
        ok(`+${formatMoney(h.saveAmount)} في «${g.name}» 🎯`, `مكافأة عادة «${h.name}»`);
      }
    }
  }
  return { done, count: logCount, minutes: logMinutes };
}

// ═══════════════════════ المهام ═══════════════════════

export async function addTask(input: Omit<Task, "id" | "createdAt" | "updatedAt">): Promise<Task> {
  const now = nowISO();
  const t: Task = { ...input, id: uid(), createdAt: now, updatedAt: now };
  await db.tasks.add(t);
  // تذكير تلقائي إن كان للوقت
  if (t.time && t.priority === "high") {
    await db.reminders.add({
      id: uid(),
      title: `مهمة: ${t.title}`,
      dueAt: `${t.date}T${t.time}`,
      sourceType: "task",
      sourceId: t.id,
      done: false,
      createdAt: now,
    });
  }
  ok("أُضيفت المهمة ✓", t.title);
  return t;
}

export async function updateTask(id: string, patch: Partial<Task>): Promise<void> {
  await db.tasks.update(id, { ...patch, updatedAt: nowISO() });
}

export async function toggleTask(id: string): Promise<boolean> {
  const t = await db.tasks.get(id);
  if (!t) return false;
  const done = !t.done;
  await db.tasks.update(id, { done, completedAt: done ? nowISO() : undefined, updatedAt: nowISO() });
  if (done) {
    await db.reminders.where("sourceId").equals(id).delete();
    ok("أنجزت مهمة ✓", t.title);
  }
  return done;
}

export async function deleteTask(id: string): Promise<void> {
  await db.transaction("rw", db.tasks, db.reminders, db.blocks, async () => {
    await db.tasks.delete(id);
    await db.reminders.where("sourceId").equals(id).delete();
    await db.blocks.where("taskId").equals(id).delete();
  });
  ok("حُذفت المهمة ✓");
}

// ═══════════════════════ الملاحظات والمزاج ═══════════════════════

export async function addNote(input: Omit<Note, "id" | "createdAt" | "updatedAt">): Promise<Note> {
  const now = nowISO();
  const n: Note = { ...input, id: uid(), createdAt: now, updatedAt: now };
  await db.notes.add(n);
  ok(input.type === "journal" ? "دُوّنت اليومية ✓" : "حُفظت الملاحظة ✓", n.title || n.content.slice(0, 40));
  return n;
}

export async function updateNote(id: string, patch: Partial<Note>): Promise<void> {
  await db.notes.update(id, { ...patch, updatedAt: nowISO() });
}

export async function deleteNote(id: string): Promise<void> {
  await db.notes.delete(id);
  ok("حُذفت الملاحظة ✓");
}

/** تسجيل مزاج اليوم (upsert) */
export async function saveMood(score: number, factors = "", note?: string): Promise<void> {
  const today = todayISO();
  const existing = await db.moods.where("date").equals(today).first();
  if (existing) {
    await db.moods.update(existing.id, { score, factors, note });
  } else {
    await db.moods.add({ id: uid(), score, factors, note, date: today, createdAt: nowISO() });
  }
  ok("سُجل مزاج اليوم ✓", "ستظهر الارتباطات في الرؤى بعد أسابيع من البيانات");
}

// ═══════════════════════ التقويم ═══════════════════════

export async function addBlock(input: Omit<TimeBlock, "id" | "createdAt" | "updatedAt">): Promise<TimeBlock> {
  const now = nowISO();
  const b: TimeBlock = { ...input, id: uid(), createdAt: now, updatedAt: now };
  await db.blocks.add(b);
  // تذكير قبل الحدث بساعة إن كان اليوم
  if (b.date === todayISO()) {
    await db.reminders.add({
      id: uid(),
      title: `${b.title}`,
      dueAt: `${b.date}T${b.startTime}`,
      sourceType: "block",
      sourceId: b.id,
      done: false,
      createdAt: now,
    });
  }
  ok("أُضيف الحدث ✓", `${b.title} · ${b.startTime}`);
  return b;
}

export async function updateBlock(id: string, patch: Partial<TimeBlock>): Promise<void> {
  await db.blocks.update(id, { ...patch, updatedAt: nowISO() });
  ok("حُدّث الحدث ✓");
}

export async function deleteBlock(id: string): Promise<void> {
  await db.transaction("rw", db.blocks, db.reminders, async () => {
    await db.blocks.delete(id);
    await db.reminders.where("sourceId").equals(id).delete();
  });
  ok("حُذف الحدث ✓");
}

// ═══════════════════════ التذكيرات ═══════════════════════

export async function addReminder(input: Omit<Reminder, "id" | "createdAt">): Promise<Reminder> {
  const r: Reminder = { ...input, id: uid(), createdAt: nowISO() };
  await db.reminders.add(r);
  ok("أُضيف التذكير ✓", r.title);
  return r;
}

export async function completeReminder(id: string): Promise<void> {
  await db.reminders.update(id, { done: true });
}

export async function snoozeReminder(id: string, minutes = 30): Promise<void> {
  const r = await db.reminders.get(id);
  if (!r) return;
  const d = new Date(r.snoozedUntil || r.dueAt);
  d.setMinutes(d.getMinutes() + minutes);
  await db.reminders.update(id, { snoozedUntil: d.toISOString().slice(0, 16) });
  ok("أُجّل التذكير", `بعد ${minutes} دقيقة`);
}

export async function deleteReminder(id: string): Promise<void> {
  await db.reminders.delete(id);
}

/** إطلاق تذكير (إشعار + تعليم كمُبلَّغ) — يستدعيه المجدول */
export async function fireReminder(r: Reminder): Promise<void> {
  const settings = await getSettings();
  if (settings.notificationsEnabled) {
    const { showAppNotification } = await import("./notifications");
    showAppNotification(r.title, { tag: r.id });
  }
  markNotified(todayISO(), r.id);
}

// ═══════════════════════ الإعدادات ═══════════════════════

export async function updateSettings(patch: Parameters<typeof saveSettings>[0]): Promise<void> {
  await saveSettings(patch);
}

/** إتمام الإعداد الأولي + البذور الهيكلية */
export async function completeOnboarding(input: {
  displayName: string;
  avatarEmoji: string;
  currency: string;
  weekStart: "sat" | "sun" | "mon";
  monthStartDay: number;
  monthlyIncome: number;
  cashBalance?: number | null;
}): Promise<void> {
  await saveSettings({
    displayName: input.displayName.trim(),
    avatarEmoji: input.avatarEmoji,
    currency: input.currency,
    weekStart: input.weekStart,
    monthStartDay: input.monthStartDay,
    monthlyIncome: input.monthlyIncome,
    onboardingDone: true,
    seeded: false,
  });
  const { seedStructure } = await import("./db");
  await seedStructure();
  // حساب النقد يُنشأ دائماً — حتى لو تخطّى المستخدم الخطوة الاختيارية (رصيد 0)،
  // كي لا يواجه «البانل لا يعمل» عند أول تسجيل مصروف/دخل بلا حساب.
  const activeAccounts = (await db.accounts.toArray()).filter((a) => !a.archived);
  if (activeAccounts.length === 0) {
    await addAccount({
      name: "نقد",
      type: "cash",
      color: "#F5B95C",
      icon: "banknote",
      startingBalance: input.cashBalance ?? 0,
      archived: false,
      order: 1,
    });
  }
  const { setCurrency } = await import("./format");
  setCurrency(input.currency);
  ok(`أهلاً بك في Systemy يا ${input.displayName.trim()} 🌙`, "ابدأ بزر + — سجّل أول شيء يخطر ببالك");
}

// ═══════════════════════ تصنيف ذكي للمعاملات ═══════════════════════

/** تخمين فئة من نص — يُستخدم في النماذج والالتقاط */
export async function guessCategoryFor(text: string, kind: "expense" | "income"): Promise<Category | null> {
  const cats = await db.categories.toArray();
  return guessCategory(text, cats, kind);
}

// ═══════════════════════ الصحة (v3) ═══════════════════════

/** تسجيل قياس صحي — upsert لليوم نفسه والنوع نفسه */
export async function logHealth(kind: HealthKind, value: number, note?: string): Promise<void> {
  if (!(value > 0) && kind !== "weight") {
    toast.error("أدخل قيمة صحيحة");
    return;
  }
  const today = todayISO();
  const meta = HEALTH_META[kind];
  const existing = await db.healthLogs
    .where("date")
    .equals(today)
    .filter((l) => l.kind === kind)
    .first();
  if (existing) {
    await db.healthLogs.update(existing.id, { value: Math.round(value * 100) / 100, note: note ?? existing.note });
  } else {
    await db.healthLogs.add({
      id: uid(),
      date: today,
      kind,
      value: Math.round(value * 100) / 100,
      unit: meta.unit,
      note,
      createdAt: nowISO(),
    });
  }
  ok(`سُجّل ${meta.label} ✓`, `${value} ${meta.unit}`);
}

export async function deleteHealthLog(id: string): Promise<void> {
  await db.healthLogs.delete(id);
}

// ═══════════════════════ التعلم (v3) ═══════════════════════

export async function addCourse(input: Omit<Course, "id" | "createdAt">): Promise<Course> {
  const c: Course = { ...input, id: uid(), createdAt: nowISO() };
  await db.courses.add(c);
  ok("أُضيف المقرر ✓", c.name);
  return c;
}

export async function updateCourse(id: string, patch: Partial<Course>): Promise<void> {
  await db.courses.update(id, patch);
  ok("حُدّث المقرر ✓");
}

export async function deleteCourse(id: string): Promise<void> {
  await db.transaction("rw", db.courses, db.flashcards, db.tasks, async () => {
    await db.courses.delete(id);
    await db.flashcards.where("courseId").equals(id).delete();
    // فك ارتباط المهام بالمقرر المحذوف — المهمة نفسها تبقى
    const linked = await db.tasks.where("courseId").equals(id).toArray();
    for (const t of linked) await db.tasks.update(t.id, { courseId: undefined });
  });
  ok("حُذف المقرر ✓", "بطاقاته فُك ارتباطها ومهامه بقيت");
}

/** إضافة بند درجة إلى مقرر (weight %, score/max) */
export async function addGradeItem(courseId: string, item: GradeItem): Promise<void> {
  const c = await db.courses.get(courseId);
  if (!c) return;
  const items: GradeItem[] = safeParseItems(c.gradeItems);
  items.push({ ...item, weight: Math.max(0, item.weight), score: Math.max(0, item.score), max: Math.max(1, item.max) });
  await db.courses.update(courseId, { gradeItems: JSON.stringify(items) });
  ok("أُضيف بند الدرجة ✓", `${item.name} · وزن ${item.weight}%`);
}

export async function removeGradeItem(courseId: string, index: number): Promise<void> {
  const c = await db.courses.get(courseId);
  if (!c) return;
  const items = safeParseItems(c.gradeItems);
  items.splice(index, 1);
  await db.courses.update(courseId, { gradeItems: JSON.stringify(items) });
  ok("حُذف بند الدرجة");
}

function safeParseItems(json: string): GradeItem[] {
  try {
    const arr = JSON.parse(json || "[]");
    return Array.isArray(arr) ? arr : [];
  } catch {
    return [];
  }
}

/** الدرجة المرجّحة الحالية: مجموع (الوزن × النسبة) للبنود المسجلة */
export function computeCourseGrade(items: GradeItem[]): { current: number; coveredWeight: number } {
  let acc = 0;
  let covered = 0;
  for (const it of items) {
    if (it.max > 0 && it.score >= 0) {
      acc += (it.score / it.max) * it.weight;
      covered += it.weight;
    }
  }
  return { current: Math.round(acc * 10) / 10, coveredWeight: covered };
}

// ═══ بطاقات المراجعة المتباعدة ═══

export async function addFlashcard(input: Omit<Flashcard, "id" | "createdAt" | "box" | "nextReview"> & { box?: number }): Promise<Flashcard> {
  const f: Flashcard = {
    ...input,
    id: uid(),
    box: input.box ?? 1,
    nextReview: todayISO(),
    createdAt: nowISO(),
  };
  await db.flashcards.add(f);
  ok("أُضيفت بطاقة ✓", f.question.slice(0, 40));
  return f;
}

export async function deleteFlashcard(id: string): Promise<void> {
  await db.flashcards.delete(id);
  ok("حُذفت البطاقة");
}

/** مراجعة بطاقة (لايتنر): إجابة صحيحة ترفع الصندوق وتؤجل المراجعة */
export async function reviewFlashcard(id: string, good: boolean): Promise<void> {
  const f = await db.flashcards.get(id);
  if (!f) return;
  const box = good ? Math.min(5, f.box + 1) : 1;
  const days = LEITNER_INTERVALS[box] ?? 1;
  const d = new Date(todayISO() + "T12:00:00");
  d.setDate(d.getDate() + days);
  await db.flashcards.update(id, { box, nextReview: d.toISOString().slice(0, 10) });
}

// ═══════════════════════ المشاريع (v3) ═══════════════════════

export async function addProject(input: Omit<Project, "id" | "createdAt">): Promise<Project> {
  const p: Project = { ...input, id: uid(), createdAt: nowISO() };
  await db.projects.add(p);
  ok("أُضيف المشروع ✓", p.name);
  return p;
}

export async function updateProject(id: string, patch: Partial<Project>): Promise<void> {
  await db.projects.update(id, patch);
  ok("حُدّث المشروع ✓");
}

export async function deleteProject(id: string): Promise<void> {
  await db.transaction("rw", db.projects, db.tasks, db.blocks, db.transactions, async () => {
    await db.projects.delete(id);
    const linkedTasks = await db.tasks.where("projectId").equals(id).toArray();
    for (const t of linkedTasks) await db.tasks.update(t.id, { projectId: undefined });
    const linkedBlocks = await db.blocks.where("projectId").equals(id).toArray();
    for (const b of linkedBlocks) await db.blocks.update(b.id, { projectId: undefined });
    const linkedTx = await db.transactions.where("projectId").equals(id).toArray();
    for (const t of linkedTx) await db.transactions.update(t.id, { projectId: undefined });
  });
  ok("حُذف المشروع ✓", "مهامه وجلساته ومعاملاته بقيت — بلا ربط");
}

// ═══════════════════════ الأشخاص (v3) ═══════════════════════

export async function addPerson(input: Omit<Person, "id" | "createdAt">): Promise<Person> {
  const p: Person = { ...input, id: uid(), createdAt: nowISO() };
  await db.people.add(p);
  ok("أُضيف الشخص ✓", p.name);
  return p;
}

export async function updatePerson(id: string, patch: Partial<Person>): Promise<void> {
  await db.people.update(id, patch);
  ok("حُدّث الملف ✓");
}

export async function deletePerson(id: string): Promise<void> {
  await db.transaction("rw", db.people, db.tasks, db.transactions, db.reminders, async () => {
    await db.people.delete(id);
    const linkedTasks = await db.tasks.where("personId").equals(id).toArray();
    for (const t of linkedTasks) await db.tasks.update(t.id, { personId: undefined });
    const linkedTx = await db.transactions.where("personId").equals(id).toArray();
    for (const t of linkedTx) await db.transactions.update(t.id, { personId: undefined });
    await db.reminders.where("sourceId").equals(id).delete();
  });
  ok("حُذف ملف الشخص ✓", "معاملاته ومهامه بقيت — بلا ربط");
}

/** تسجيل تواصل — يحدّث «آخر تواصل» لليوم */
export async function logContact(personId: string): Promise<void> {
  const p = await db.people.get(personId);
  if (!p) return;
  await db.people.update(personId, { lastContact: todayISO() });
  ok(`سُجّل تواصل مع ${p.name} ✓`);
}

// ═══════════════════════ المستندات — الخزانة (v3) ═══════════════════════

export async function addDocument(input: Omit<DocumentRecord, "id" | "createdAt">): Promise<DocumentRecord> {
  const d: DocumentRecord = { ...input, id: uid(), createdAt: nowISO() };
  await db.documents.add(d);
  // تذكير انتهاء تلقائي قبل 30 يوماً
  if (d.expiryDate) {
    await db.reminders.add({
      id: uid(),
      title: `${DOC_TYPE_LABELS[d.type]} «${d.title}» ينتهي قريباً`,
      dueAt: `${d.expiryDate}T09:00`,
      sourceType: "document",
      sourceId: d.id,
      done: false,
      createdAt: nowISO(),
    });
  }
  ok("أُضيف المستند ✓", d.title);
  return d;
}

export async function updateDocument(id: string, patch: Partial<DocumentRecord>): Promise<void> {
  const existing = await db.documents.get(id);
  await db.documents.update(id, patch);
  // إعادة جدولة التذكير إن تغير تاريخ الانتهاء
  if (patch.expiryDate !== undefined && existing) {
    await db.reminders.where("sourceId").equals(id).delete();
    if (patch.expiryDate) {
      await db.reminders.add({
        id: uid(),
        title: `${DOC_TYPE_LABELS[patch.type ?? existing.type]} «${patch.title ?? existing.title}» ينتهي قريباً`,
        dueAt: `${patch.expiryDate}T09:00`,
        sourceType: "document",
        sourceId: id,
        done: false,
        createdAt: nowISO(),
      });
    }
  }
  ok("حُدّث المستند ✓");
}

export async function deleteDocument(id: string): Promise<void> {
  await db.transaction("rw", db.documents, db.reminders, async () => {
    await db.documents.delete(id);
    await db.reminders.where("sourceId").equals(id).delete();
  });
  ok("حُذف المستند ✓");
}

// ═══════════════════════ السفر (v3) ═══════════════════════

export async function addTrip(input: Omit<Trip, "id" | "createdAt">): Promise<Trip> {
  const t: Trip = { ...input, id: uid(), createdAt: nowISO() };
  await db.trips.add(t);
  ok("أُضيفت الرحلة ✓", `${t.name} · ${t.destination}`);
  return t;
}

export async function updateTrip(id: string, patch: Partial<Trip>): Promise<void> {
  await db.trips.update(id, patch);
  ok("حُدّثت الرحلة ✓");
}

export async function deleteTrip(id: string): Promise<void> {
  await db.transaction("rw", [db.trips, db.listItems, db.blocks, db.transactions, db.tasks, db.reminders], async () => {
    await db.trips.delete(id);
    await db.listItems.where("ownerId").equals(id).delete();
    const linkedBlocks = await db.blocks.where("tripId").equals(id).toArray();
    for (const b of linkedBlocks) await db.blocks.update(b.id, { tripId: undefined });
    const linkedTx = await db.transactions.where("tripId").equals(id).toArray();
    for (const t of linkedTx) await db.transactions.update(t.id, { tripId: undefined });
    const linkedTasks = await db.tasks.where("tripId").equals(id).toArray();
    for (const t of linkedTasks) await db.tasks.update(t.id, { tripId: undefined });
    await db.reminders.where("sourceId").equals(id).delete();
  });
  ok("حُذفت الرحلة ✓", "مصاريفها وبرنامجها بقيت — بلا ربط");
}

// ═══════════════════════ القوائم المشتركة (بقالة/تجهيز) (v3) ═══════════════════════

export async function addListItem(
  scope: ListItem["scope"],
  text: string,
  opts?: { ownerId?: string; qty?: string },
): Promise<void> {
  if (!text.trim()) return;
  await db.listItems.add({
    id: uid(),
    scope,
    ownerId: opts?.ownerId,
    text: text.trim(),
    qty: opts?.qty?.trim() || undefined,
    done: false,
    createdAt: nowISO(),
  });
}

export async function toggleListItem(id: string): Promise<void> {
  const item = await db.listItems.get(id);
  if (!item) return;
  await db.listItems.update(id, { done: !item.done });
}

export async function deleteListItem(id: string): Promise<void> {
  await db.listItems.delete(id);
}

/** مسح المنجزين فقط من قائمة (لا يمس البنود المعلقة) */
export async function clearDoneItems(scope: ListItem["scope"], ownerId?: string): Promise<void> {
  const items = await db.listItems.where("scope").equals(scope).toArray();
  const target = items.filter((i) => i.done && (scope === "grocery" || i.ownerId === ownerId));
  for (const i of target) await db.listItems.delete(i.id);
}

// ═══════════════════════ المنزل — الممتلكات والصيانة (v3) ═══════════════════════

export async function addHomeItem(input: Omit<HomeItem, "id" | "createdAt">): Promise<HomeItem> {
  const h: HomeItem = { ...input, id: uid(), createdAt: nowISO() };
  await db.homeItems.add(h);
  if (h.nextService) {
    await db.reminders.add({
      id: uid(),
      title: `صيانة «${h.name}» مستحقة`,
      dueAt: `${h.nextService}T09:00`,
      sourceType: "home",
      sourceId: h.id,
      done: false,
      createdAt: nowISO(),
    });
  }
  ok("أُضيف للممتلكات ✓", h.name);
  return h;
}

export async function updateHomeItem(id: string, patch: Partial<HomeItem>): Promise<void> {
  await db.homeItems.update(id, patch);
  ok("حُدّث الممتلك ✓");
}

export async function deleteHomeItem(id: string): Promise<void> {
  await db.transaction("rw", db.homeItems, db.reminders, async () => {
    await db.homeItems.delete(id);
    await db.reminders.where("sourceId").equals(id).delete();
  });
  ok("حُذف الممتلك ✓");
}
