"use client";

/**
 * Systemy v3 — تفاصيل هدف الادخار (درج سفلي غني)
 * مساهمة سريعة (50/100/200 + مخصص + حساب اختياري) · سحب · محاكاة «ماذا لو»
 * حية · المهام المرتبطة · العادات المرتبطة · رابط سجل المساهمات في المال
 * · تعديل وحذف بتأكيد. كل الكتابات عبر actions الجاهزة فقط.
 */

import { useEffect, useState } from "react";
import {
  ArrowLeft,
  CalendarDays,
  Check,
  ChevronLeft,
  PiggyBank,
  Plus,
  Repeat,
  Sparkles,
  Target,
  Trash2,
  TrendingDown,
  TrendingUp,
} from "lucide-react";
import { toast } from "sonner";
import {
  Drawer,
  DrawerContent,
  DrawerDescription,
  DrawerHeader,
  DrawerTitle,
} from "@/components/ui/drawer";
import {
  addTask,
  contributeGoal,
  deleteGoal,
  toggleTask,
  withdrawGoal,
} from "@/lib/actions";
import {
  diffDays,
  formatDate,
  formatMoney,
  formatNumber,
  todayISO,
} from "@/lib/format";
import type { Account, Goal, Habit, Task, Transaction } from "@/lib/types";
import { Chip, PrivateAmount } from "@/components/systemy/glass";
import { ConfirmBar, iconByName, inputCls } from "@/components/systemy/ui-bits";
import { useUIStore } from "@/store/ui-store";
import { cn } from "@/lib/utils";

/* ═══════════════════════ ثوابت ومساعدات ═══════════════════════ */

const QUICK_AMOUNTS = [50, 100, 200] as const;
const SIM_STEPS = [100, 200, 500, 1000, 1500, 2000] as const;

/** لون hex + شفافية سداسية */
const tint = (color: string, alpha = "22"): string =>
  /^#[0-9a-fA-F]{6}$/.test(color) ? `${color}${alpha}` : color;

function monthsAr(n: number): string {
  if (n <= 0) return "أقل من شهر";
  if (n === 1) return "شهراً واحداً";
  if (n === 2) return "شهرين";
  if (n <= 10) return `${formatNumber(n)} أشهر`;
  return `${formatNumber(n)} شهراً`;
}

function daysLeftAr(iso: string): { text: string; late: boolean } {
  const n = diffDays(todayISO(), iso);
  if (n === 0) return { text: "اليوم", late: false };
  if (n > 0) return { text: `بعد ${formatNumber(n)} يوماً`, late: false };
  return { text: `فات ${formatNumber(-n)} يوماً`, late: true };
}

/** عنوان قسم موحد داخل الدرج */
function SectionTitle({ icon, children, badge }: { icon: React.ReactNode; children: React.ReactNode; badge?: string }) {
  return (
    <div className="flex items-center justify-between gap-2 px-1">
      <div className="flex items-center gap-1.5 text-[12.5px] font-semibold text-foreground/90">
        {icon}
        <span>{children}</span>
      </div>
      {badge && <Chip className="text-muted-foreground tabular">{badge}</Chip>}
    </div>
  );
}

export interface GoalDetailsDialogProps {
  /** الهدف الحي (يأتي من useLive في الأب) — null يغلق الدرج */
  goal: Goal | null;
  onClose: () => void;
  onEdit: (goal: Goal) => void;
  accounts: Account[];
  tasks: Task[];
  habits: Habit[];
  txs: Transaction[];
  currency: string;
}

export function GoalDetailsDialog({
  goal,
  onClose,
  onEdit,
  accounts,
  tasks,
  habits,
  txs,
  currency,
}: GoalDetailsDialogProps) {
  const setView = useUIStore((s) => s.setView);
  const goToMoney = useUIStore((s) => s.goToMoney);

  const [amount, setAmount] = useState("");
  const [withdraw, setWithdraw] = useState("");
  const [accountId, setAccountId] = useState("none");
  const [simMonthly, setSimMonthly] = useState(500);
  const [newTask, setNewTask] = useState("");
  const [busy, setBusy] = useState(false);
  const [confirmDelete, setConfirmDelete] = useState(false);

  // تصفير الحركات المحلية عند تغيير الهدف
  useEffect(() => {
    if (!goal) return;
    setAmount("");
    setWithdraw("");
    setAccountId("none");
    setSimMonthly(goal.monthly > 0 ? goal.monthly : 500);
    setNewTask("");
    setConfirmDelete(false);
  }, [goal?.id]);

  if (!goal) return null;

  const cur = currency;
  const pct = goal.targetAmount > 0 ? Math.min(100, Math.round((goal.savedAmount / goal.targetAmount) * 100)) : 0;
  const remaining = Math.max(0, goal.savedAmount < goal.targetAmount ? goal.targetAmount - goal.savedAmount : 0);
  const done = pct >= 100;
  const activeAccounts = accounts.filter((a) => !a.archived);
  const goalTasks = tasks
    .filter((t) => t.goalId === goal.id)
    .sort((a, b) => Number(a.done) - Number(b.done) || a.date.localeCompare(b.date));
  const goalHabits = habits.filter((h) => h.goalId === goal.id && !h.archived);
  const goalTxs = txs.filter((t) => t.goalId === goal.id);
  const due = goal.targetDate ? daysLeftAr(goal.targetDate) : null;
  const simMonths = simMonthly > 0 && remaining > 0 ? Math.ceil(remaining / simMonthly) : 0;

  /* ---------- الحركات ---------- */

  const doContribute = async () => {
    const value = Number(amount);
    if (!(value > 0)) {
      toast.error("أدخل مبلغاً صحيحاً أكبر من صفر");
      return;
    }
    setBusy(true);
    try {
      await contributeGoal(goal.id, value, accountId === "none" ? undefined : { accountId });
      setAmount("");
    } finally {
      setBusy(false);
    }
  };

  const doWithdraw = async () => {
    const value = Number(withdraw);
    if (!(value > 0)) {
      toast.error("أدخل مبلغاً صحيحاً أكبر من صفر");
      return;
    }
    if (value > goal.savedAmount) {
      toast.error(`المحفوظ ${formatMoney(goal.savedAmount, cur)} فقط`);
      return;
    }
    setBusy(true);
    try {
      await withdrawGoal(goal.id, value, accountId === "none" ? undefined : { accountId });
      setWithdraw("");
    } finally {
      setBusy(false);
    }
  };

  const addLinkedTask = async () => {
    const title = newTask.trim();
    if (!title) {
      toast.error("اكتب عنوان المهمة");
      return;
    }
    setBusy(true);
    try {
      await addTask({ title, date: todayISO(), priority: "normal", done: false, goalId: goal.id });
      setNewTask("");
    } finally {
      setBusy(false);
    }
  };

  const doDelete = async () => {
    setBusy(true);
    try {
      await deleteGoal(goal.id);
      setConfirmDelete(false);
      onClose();
    } finally {
      setBusy(false);
    }
  };

  /* ---------- الهيكل ---------- */

  return (
    <Drawer open onOpenChange={(o) => { if (!o) onClose(); }}>
      <DrawerContent
        dir="rtl"
        className="mx-auto max-w-md rounded-t-3xl border-white/10 bg-[#0B0F1A]/95 backdrop-blur-2xl"
      >
        <DrawerHeader className="pb-1">
          <DrawerTitle className="flex items-center gap-2.5 text-right text-[15px] font-bold">
            <span
              className="flex h-9 w-9 shrink-0 items-center justify-center rounded-xl text-[18px]"
              style={{ background: tint(goal.color) }}
              aria-hidden="true"
            >
              {goal.emoji}
            </span>
            <span className="truncate">{goal.name}</span>
          </DrawerTitle>
          <DrawerDescription className="text-right text-[11px] tabular">
            {formatMoney(goal.savedAmount, cur)} من {formatMoney(goal.targetAmount, cur)} · {formatNumber(pct)}%
          </DrawerDescription>
        </DrawerHeader>

        <div className="sys-scroll max-h-[74vh] space-y-5 overflow-y-auto px-4 pb-6 pt-2">
          {/* ═══ التقدم ═══ */}
          <div className="space-y-2.5">
            <div
              className="h-2.5 overflow-hidden rounded-full bg-white/[0.06]"
              role="progressbar"
              aria-valuenow={pct}
              aria-valuemin={0}
              aria-valuemax={100}
              aria-label={`تقدم الهدف: ${pct}%`}
            >
              <div
                className="h-full rounded-full transition-all"
                style={{
                  width: `${pct}%`,
                  background: done ? "linear-gradient(90deg, #F5B95C, #6EE7A8)" : goal.color,
                }}
              />
            </div>
            <div className="grid grid-cols-4 gap-2 text-center">
              <div className="glass-soft rounded-xl px-1 py-2">
                <p className="text-[9.5px] text-muted-foreground">المحفوظ</p>
                <PrivateAmount className="block text-[12px] font-bold tabular">
                  {formatMoney(goal.savedAmount, cur)}
                </PrivateAmount>
              </div>
              <div className="glass-soft rounded-xl px-1 py-2">
                <p className="text-[9.5px] text-muted-foreground">المتبقي</p>
                <PrivateAmount className="block text-[12px] font-bold tabular text-gold">
                  {formatMoney(remaining, cur)}
                </PrivateAmount>
              </div>
              <div className="glass-soft rounded-xl px-1 py-2">
                <p className="text-[9.5px] text-muted-foreground">شهرياً</p>
                <PrivateAmount className="block text-[12px] font-bold tabular">
                  {formatMoney(goal.monthly, cur)}
                </PrivateAmount>
              </div>
              <div className="glass-soft rounded-xl px-1 py-2">
                <p className="text-[9.5px] text-muted-foreground">الموعد</p>
                <p className="text-[11px] font-bold tabular text-foreground/85">
                  {goal.targetDate ? formatDate(goal.targetDate) : "—"}
                </p>
              </div>
            </div>
            {due && (
              <Chip
                className={cn(
                  "border",
                  due.late ? "border-coral/30 text-coral" : "border-gold/30 text-gold",
                )}
              >
                <CalendarDays className="h-3 w-3" aria-hidden="true" />
                {done ? "اكتمل 🎉" : due.late ? "متأخر" : "يكتمل"} · {due.text}
              </Chip>
            )}
            {done && !due && <Chip className="border-gold/30 text-gold">🎉 اكتمل الهدف</Chip>}
          </div>

          {/* ═══ مساهمة سريعة ═══ */}
          <div className="space-y-3">
            <SectionTitle icon={<PiggyBank className="h-4 w-4 text-primary" aria-hidden="true" />}>
              مساهمة سريعة
            </SectionTitle>
            <div className="glass-soft space-y-3 rounded-2xl p-3.5">
              <div className="flex gap-2" role="group" aria-label="مبالغ سريعة">
                {QUICK_AMOUNTS.map((q) => (
                  <button
                    key={q}
                    type="button"
                    onClick={() => setAmount(String(q))}
                    aria-pressed={Number(amount) === q}
                    className={cn(
                      "h-11 min-h-11 flex-1 rounded-xl border text-[12.5px] font-bold tabular transition-colors",
                      Number(amount) === q
                        ? "border-primary/60 bg-primary/20 text-primary"
                        : "glass-soft border-white/[0.08] text-foreground/80 hover:bg-white/[0.06]",
                    )}
                  >
                    +{formatNumber(q)}
                  </button>
                ))}
              </div>
              <div className="flex items-center gap-2">
                <input
                  value={amount}
                  onChange={(e) => setAmount(e.target.value.replace(/[^\d.]/g, ""))}
                  inputMode="decimal"
                  placeholder="مبلغ مخصص…"
                  aria-label="مبلغ المساهمة المخصص"
                  className={cn(inputCls, "h-11 flex-1 text-center num-display tabular")}
                />
                <span className="shrink-0 text-[11px] text-muted-foreground">{cur}</span>
              </div>
              <div className="space-y-2">
                <p className="text-[11.5px] font-medium text-muted-foreground">
                  الحساب (اختياري) — يُطبّق على السهم والسحب
                </p>
                <div className="flex gap-2 overflow-x-auto no-scrollbar pb-1" role="radiogroup" aria-label="اختيار الحساب">
                  <button
                    type="button"
                    role="radio"
                    aria-checked={accountId === "none"}
                    onClick={() => setAccountId("none")}
                    className={cn(
                      "h-11 min-h-11 shrink-0 rounded-xl border px-3.5 text-[12px] font-medium transition-all",
                      accountId === "none"
                        ? "bg-primary/20 border-primary/50 text-primary"
                        : "glass-soft border-white/[0.08] text-foreground/75 hover:text-foreground",
                    )}
                  >
                    بدون ربط بحساب
                  </button>
                  {activeAccounts.map((a) => (
                    <button
                      key={a.id}
                      type="button"
                      role="radio"
                      aria-checked={accountId === a.id}
                      aria-label={`الحساب ${a.name}`}
                      onClick={() => setAccountId(a.id)}
                      className={cn(
                        "h-11 min-h-11 flex shrink-0 items-center gap-1.5 rounded-xl border px-3.5 text-[12px] font-medium transition-all",
                        accountId === a.id
                          ? "bg-primary/20 border-primary/50 text-primary"
                          : "glass-soft border-white/[0.08] text-foreground/75 hover:text-foreground",
                      )}
                    >
                      <span className="h-2 w-2 rounded-full" style={{ background: a.color }} aria-hidden="true" />
                      {a.name}
                    </button>
                  ))}
                </div>
              </div>
              <button
                type="button"
                onClick={() => void doContribute()}
                disabled={busy}
                className="h-12 min-h-12 w-full rounded-2xl bg-primary text-[13px] font-bold text-primary-foreground transition-transform active:scale-[0.98] disabled:opacity-50"
                aria-label="إضافة المساهمة للهدف"
              >
                ساهم الآن
              </button>
              <p className="text-[10px] leading-relaxed text-muted-foreground/80">
                بدون حساب: يرتفع الوعاء فقط. مع حساب: تُسجَّل مساهمة كتحويل مرتبط بالهدف في المال.
              </p>
            </div>
          </div>

          {/* ═══ سحب ═══ */}
          {goal.savedAmount > 0 && (
            <div className="space-y-3">
              <SectionTitle icon={<TrendingDown className="h-4 w-4 text-coral" aria-hidden="true" />}>
                سحب من الوعاء
              </SectionTitle>
              <div className="glass-soft space-y-3 rounded-2xl p-3.5">
                <div className="flex items-center gap-2">
                  <input
                    value={withdraw}
                    onChange={(e) => setWithdraw(e.target.value.replace(/[^\d.]/g, ""))}
                    inputMode="decimal"
                    placeholder={`حتى ${formatNumber(goal.savedAmount)}`}
                    aria-label="مبلغ السحب"
                    className={cn(inputCls, "h-11 flex-1 text-center num-display tabular")}
                  />
                  <span className="shrink-0 text-[11px] text-muted-foreground">{cur}</span>
                </div>
                <button
                  type="button"
                  onClick={() => void doWithdraw()}
                  disabled={busy}
                  className="h-11 min-h-11 w-full rounded-xl glass-soft border border-white/[0.08] text-[12.5px] font-bold text-foreground/80 transition-colors hover:bg-white/[0.07] disabled:opacity-50"
                  aria-label="سحب المبلغ من الهدف"
                >
                  اسحب المبلغ
                </button>
                <p className="text-[10px] leading-relaxed text-muted-foreground/80">
                  إن اخترت حساباً يُسجَّل المبلغ دخلاً فيه — مرتبطاً بالهدف.
                </p>
              </div>
            </div>
          )}

          {/* ═══ محاكاة ماذا لو ═══ */}
          <div className="space-y-3">
            <SectionTitle icon={<Sparkles className="h-4 w-4 text-gold" aria-hidden="true" />}>
              محاكاة «ماذا لو»
            </SectionTitle>
            <div className="glass-soft space-y-3 rounded-2xl p-3.5">
              <div className="flex flex-wrap gap-2" role="radiogroup" aria-label="المساهمة الشهرية للمحاكاة">
                {SIM_STEPS.map((m) => (
                  <button
                    key={m}
                    type="button"
                    role="radio"
                    aria-checked={simMonthly === m}
                    aria-label={`مساهمة ${formatNumber(m)} شهرياً`}
                    onClick={() => setSimMonthly(m)}
                    className={cn(
                      "h-11 min-h-11 rounded-xl border px-4 text-[12.5px] font-bold tabular transition-colors",
                      simMonthly === m
                        ? "border-primary/60 bg-primary/20 text-primary"
                        : "glass-soft border-white/[0.08] text-foreground/80 hover:bg-white/[0.06]",
                    )}
                  >
                    {formatNumber(m)}
                  </button>
                ))}
              </div>
              <p className="rounded-xl border border-gold/25 bg-gold/10 px-3 py-2.5 text-[12px] font-medium text-gold tabular" aria-live="polite">
                {done
                  ? "الهدف مكتمل 🎉 — لا متبقٍ للمحاكاة"
                  : simMonths > 0
                    ? `بمساهمة ${formatMoney(simMonthly, cur)} شهرياً يكتمل الهدف في ~${monthsAr(simMonths)}`
                    : "المتبقي صفر — الهدف مكتمل"}
              </p>
              <p className="text-[10px] text-muted-foreground/80">محاكاة فقط — لا تُنشئ شيئاً.</p>
            </div>
          </div>

          {/* ═══ المهام المرتبطة ═══ */}
          <div className="space-y-3">
            <SectionTitle icon={<Check className="h-4 w-4 text-mint" aria-hidden="true" />} badge={`${formatNumber(goalTasks.length)}`}>
              مهام مرتبطة بالهدف
            </SectionTitle>
            <div className="glass-soft space-y-2 rounded-2xl p-3.5">
              {goalTasks.length === 0 ? (
                <p className="py-1 text-center text-[11px] text-muted-foreground">
                  لا مهام بعد — خطوات صغيرة تقربك من «{goal.name}»
                </p>
              ) : (
                <ul className="sys-scroll max-h-56 space-y-1 overflow-y-auto">
                  {goalTasks.map((t) => (
                    <li key={t.id}>
                      <button
                        type="button"
                        onClick={() => void toggleTask(t.id)}
                        aria-pressed={t.done}
                        aria-label={`مهمة ${t.title}${t.done ? " — منجزة" : " — لإتمامها"}`}
                        className="flex min-h-11 w-full items-center gap-2.5 rounded-xl px-2 py-1.5 text-start transition-colors hover:bg-white/[0.05]"
                      >
                        <span
                          className={cn(
                            "flex h-6 w-6 shrink-0 items-center justify-center rounded-full border transition-colors",
                            t.done ? "border-mint bg-mint/20 text-mint" : "border-white/25 text-transparent",
                          )}
                          aria-hidden="true"
                        >
                          <Check className="h-3.5 w-3.5" strokeWidth={3} />
                        </span>
                        <span
                          className={cn(
                            "flex-1 truncate text-[12.5px]",
                            t.done ? "text-muted-foreground line-through" : "text-foreground/90",
                          )}
                        >
                          {t.title}
                        </span>
                        <span className="shrink-0 text-[9.5px] text-muted-foreground tabular">{formatDate(t.date)}</span>
                      </button>
                    </li>
                  ))}
                </ul>
              )}
              <div className="flex gap-2 border-t border-white/[0.06] pt-2.5">
                <input
                  value={newTask}
                  onChange={(e) => setNewTask(e.target.value)}
                  onKeyDown={(e) => {
                    if (e.key === "Enter") void addLinkedTask();
                  }}
                  placeholder="مهمة نحو الهدف…"
                  maxLength={60}
                  aria-label="عنوان مهمة جديدة مرتبطة بالهدف"
                  className={cn(inputCls, "h-11 flex-1")}
                />
                <button
                  type="button"
                  onClick={() => void addLinkedTask()}
                  disabled={busy}
                  aria-label="إضافة مهمة مرتبطة بالهدف"
                  className="flex h-11 min-h-11 w-11 shrink-0 items-center justify-center rounded-xl border border-primary/40 bg-primary/15 text-primary transition-colors hover:bg-primary/25 disabled:opacity-50"
                >
                  <Plus className="h-5 w-5" strokeWidth={2.4} aria-hidden="true" />
                </button>
              </div>
            </div>
          </div>

          {/* ═══ العادات المرتبطة ═══ */}
          <div className="space-y-3">
            <SectionTitle icon={<Repeat className="h-4 w-4 text-cyan" aria-hidden="true" />} badge={`${formatNumber(goalHabits.length)}`}>
              عادات تغذي هذا الهدف
            </SectionTitle>
            <div className="glass-soft space-y-2 rounded-2xl p-3.5">
              {goalHabits.length === 0 ? (
                <p className="py-1 text-center text-[11px] leading-relaxed text-muted-foreground">
                  لا عادات مرتبطة — اربط عادة من شاشة العادات ليتراكم الوعاء كل يوم تُنجزه
                </p>
              ) : (
                <ul className="space-y-1.5">
                  {goalHabits.map((h) => {
                    const HIcon = iconByName(h.icon.toLowerCase());
                    return (
                      <li
                        key={h.id}
                        className="flex items-center gap-2.5 rounded-xl px-2 py-1.5"
                        style={{ background: tint(h.color, "10") }}
                      >
                        <span
                          className="flex h-8 w-8 shrink-0 items-center justify-center rounded-lg"
                          style={{ color: h.color, background: tint(h.color, "22") }}
                          aria-hidden="true"
                        >
                          <HIcon className="h-4 w-4" />
                        </span>
                        <span className="flex-1 truncate text-[12.5px] font-medium">{h.name}</span>
                        {h.saveAmount != null && h.saveAmount > 0 && (
                          <Chip className="text-mint tabular">
                            +{formatMoney(h.saveAmount, cur)} / إنجاز
                          </Chip>
                        )}
                      </li>
                    );
                  })}
                </ul>
              )}
              <button
                type="button"
                onClick={() => {
                  onClose();
                  setView("habits");
                }}
                className="flex h-11 min-h-11 w-full items-center justify-center gap-1.5 rounded-xl glass-soft border border-white/[0.08] text-[12px] font-bold text-foreground/75 transition-colors hover:bg-white/[0.07]"
                aria-label="فتح شاشة العادات"
              >
                <ArrowLeft className="h-4 w-4" aria-hidden="true" />
                افتح العادات
              </button>
            </div>
          </div>

          {/* ═══ رابط المال ═══ */}
          <button
            type="button"
            onClick={() => {
              onClose();
              goToMoney("transactions");
            }}
            className="flex h-11 min-h-11 w-full items-center justify-between gap-2 rounded-xl border border-primary/30 bg-primary/10 px-4 text-[12px] font-bold text-primary transition-colors hover:bg-primary/20"
            aria-label={`سجل مساهمات الهدف في المال — ${goalTxs.length} حركة مرتبطة`}
          >
            <span className="flex items-center gap-1.5">
              <Target className="h-4 w-4" aria-hidden="true" />
              سجل المساهمات في المال
            </span>
            <span className="flex items-center gap-1 tabular">
              <Chip className="text-primary tabular">{formatNumber(goalTxs.length)} حركة</Chip>
              <ChevronLeft className="h-4 w-4" aria-hidden="true" />
            </span>
          </button>

          {/* ═══ تعديل / حذف ═══ */}
          <div className="space-y-2 border-t border-white/[0.06] pt-3">
            {!confirmDelete ? (
              <div className="flex gap-2">
                <button
                  type="button"
                  onClick={() => onEdit(goal)}
                  className="h-11 min-h-11 flex-1 rounded-xl glass-soft border border-white/[0.08] text-[12.5px] font-bold text-foreground/80 transition-colors hover:bg-white/[0.06]"
                  aria-label={`تعديل الهدف ${goal.name}`}
                >
                  تعديل البيانات
                </button>
                <button
                  type="button"
                  onClick={() => setConfirmDelete(true)}
                  disabled={busy}
                  className="flex h-11 min-h-11 w-11 shrink-0 items-center justify-center rounded-xl border border-[#FF8E7A]/30 text-[#FF8E7A] transition-colors hover:bg-[#FF8E7A]/10 disabled:opacity-50"
                  aria-label={`حذف الهدف ${goal.name}`}
                >
                  <Trash2 className="h-4 w-4" aria-hidden="true" />
                </button>
              </div>
            ) : (
              <ConfirmBar
                message={`حذف «${goal.name}» نهائياً؟ المحفوظ فيه ${formatMoney(goal.savedAmount, cur)} يُحذف معه — لا يمكن التراجع.`}
                confirmLabel="حذف نهائي"
                onConfirm={() => void doDelete()}
                onCancel={() => setConfirmDelete(false)}
              />
            )}
            <p className="flex items-center justify-center gap-1.5 pt-0.5 text-[9.5px] text-muted-foreground/70">
              <TrendingUp className="h-3 w-3" aria-hidden="true" />
              كل حركة هنا تنعكس فوراً في المال والتقويم عبر الترابط الحي
            </p>
          </div>
        </div>
      </DrawerContent>
    </Drawer>
  );
}
