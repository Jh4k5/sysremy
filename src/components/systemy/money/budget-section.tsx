"use client";

/**
 * Systemy v5 — قسم «الميزانية» بهوية «الشريط»
 *
 * كل فلس له بيت: دخل → ميزانية معيشة شهرية → أسابيع مالية ملتزِمة →
 * حد يومي حي يُعاد حسابه كل لحظة، والتجاوز يظهر بالسالب ويُرحَّل،
 * والالتزامات خارج المعيشة معزولة عن الحد اليومي/الأسبوعي،
 * وفائض الشهر يُكنَس للادخار تلقائياً نهاية كل شهر مالي.
 *
 * المحرك الوحيد: weeklyStatus() من budget-engine — لا حسابات يدوية هنا.
 * V5: الشريط = لغة التقدّم (PaceBar/أعمدة الأسبوع/رقاقة اليومي)،
 * الذهبي = القيمة والإجراء، والتجاوز يبقى مرجانياً (الأحمر عالمي).
 */

import { useMemo, useState } from "react";
import { motion } from "framer-motion";
import {
  AlertTriangle,
  BadgeCheck,
  Banknote,
  CalendarDays,
  Gauge,
  Inbox,
  Pencil,
  PiggyBank,
  Plus,
  Receipt,
} from "lucide-react";
import { toast } from "sonner";
import { Switch } from "@/components/ui/switch";
import {
  addIncome,
  addTransaction,
  addToSavings,
  ensureDefaultAccount,
  sweepMonthLeftover,
} from "@/lib/actions";
import { financeMonthWeeks, weeklyStatus } from "@/lib/budget-engine";
import { saveSettings } from "@/lib/db";
import {
  addDaysISO,
  dayNameShort,
  formatDate,
  formatCompact,
  formatMoney,
  formatNumber,
  todayISO,
} from "@/lib/format";
import { accountBalance, envelopes, type BudgetPacing, type Envelope } from "@/lib/money";
import type { Settings, Transaction } from "@/lib/types";
import { Chip, GlassCard, PrivateAmount, widgetEnter } from "@/components/systemy/glass";
import { EmptyState, Field, FormShell, inputCls } from "@/components/systemy/ui-bits";
import { IconBubble, SheetShell, type MoneyData, type MoneyTabId } from "./money-screen";
import { cn } from "@/lib/utils";

/** ضغط V5 — 0.96 بالضبط، انتقالات محدّدة الخصائص (ممنوع transition:all) */
const press =
  "transition-[transform,color,background-color,border-color] duration-150 ease-out active:scale-[0.96]";

/* ═══════════════════════ خرائط الألوان والحالة (مشتركة — يستوردها overview) ═══════════════════════ */

/** خريطة حالة إيقاع الميزانية — V5: نقطة «على المسار» شريط متدرج (بقية الحالات بألوانها الدلالية) */
export const BP_META: Record<BudgetPacing["status"], { label: string; cls: string; dot: string }> = {
  great: { label: "أمام الوتيرة 👏", cls: "text-mint", dot: "bg-mint" },
  good: { label: "على المسار", cls: "text-foreground/80", dot: "ribbon" },
  careful: { label: "خلف الوتيرة", cls: "text-gold", dot: "bg-gold" },
  over: { label: "تجاوزت الشهري", cls: "text-coral", dot: "bg-coral" },
  unset: { label: "غير محددة", cls: "text-muted-foreground", dot: "bg-muted-foreground/60" },
};

/**
 * لون شريط استهلاك الميزانية — V5: تدرج الشريط هو توقيع التقدّم،
 * والتجاوز وحده يبقى مرجانياً صلباً (الأحمر = تجاوز، عالمي).
 */
export function budgetBarColor(status: BudgetPacing["status"]): string {
  if (status === "over") return "#FF8E7A";
  return "var(--grad-ribbon)";
}

/**
 * شريط استهلاك الميزانية مع علامة الوتيرة المستهدفة — عنصر التوقيع V5:
 * الجزء المصروف بتدرج الشريط، المسار أبيض/8، والعلامة خط متقطع أبيض/40.
 * مشترك بين هذا القسم وبطاقة النظرة العامة المختصرة.
 */
export function PaceBar({
  percent,
  pacePercent,
  color,
  ariaLabel,
  className,
}: {
  percent: number;
  pacePercent: number;
  color: string;
  ariaLabel?: string;
  className?: string;
}) {
  const pct = Math.min(100, Math.max(0, Math.round(percent)));
  const pace = Math.min(100, Math.max(0, Math.round(pacePercent)));
  return (
    <div
      className={cn("relative h-2 rounded-full bg-white/[0.08]", className)}
      role={ariaLabel ? "progressbar" : undefined}
      aria-label={ariaLabel}
      aria-valuenow={ariaLabel ? Math.max(0, Math.min(100, Math.round(percent))) : undefined}
      aria-valuemin={ariaLabel ? 0 : undefined}
      aria-valuemax={ariaLabel ? 100 : undefined}
      aria-hidden={ariaLabel ? undefined : true}
    >
      <div className="h-full rounded-full" style={{ width: `${pct}%`, background: color }} />
      {pace > 0 && (
        <span
          title="الوتيرة المستهدفة حتى الآن"
          aria-hidden="true"
          className="absolute -top-[3px] -bottom-[3px] w-0 border-s-2 border-dashed border-white/40"
          style={{ insetInlineStart: `calc(${pace}% - 1px)` }}
        />
      )}
    </div>
  );
}

/** موضع علامة الوتيرة المستهدفة (٪ من الميزانية) */
function pacePercentOf(month: { budget: number; expectedByNow: number }): number {
  return month.budget > 0 ? (month.expectedByNow / month.budget) * 100 : 0;
}

const ENV_COLOR: Record<Envelope["status"], string> = {
  great: "#6EE7A8",
  good: "#F5B95C",
  careful: "#FFB4A2",
  over: "#FF8E7A",
};

/** خيارات مصير فائض/عجز الأسبوع */
const CARRY_OPTIONS: Array<{ k: NonNullable<Settings["carryOver"]>; v: string; hint: string }> = [
  { k: "next", v: "يُرحّل للأسبوع التالي", hint: "فائض أو عجز كل أسبوع ينتقل معك للأسبوع التالي داخل الشهر — العجز يظهر بالسالب." },
  { k: "savings", v: "يُحفظ للادخار نهاية الشهر", hint: "لا ترحيل بين الأسابيع — فائض كل أسبوع يبقى محفوظاً ويُكنَس للادخار نهاية الشهر." },
  { k: "reset", v: "يُصفّر كل أسبوع", hint: "كل أسبوع يبدأ من حدّه كاملاً — بلا ترحيل ولا تراكم." },
];

/* ═══ تدرجات أعمدة الأسبوع V5 — من الشريط الخافت إلى الشريط الكامل ═══ */

/** عمود يوم عادي مع نشاط: تدرج رأسي بألوان الشريط (خافت أسفله ← مكتمل أعلاه) */
const DAY_BAR_SOFT =
  "linear-gradient(to top, rgba(0,205,254,0.18), rgba(62,155,246,0.45) 50%, rgba(254,187,24,0.78))";
/** عمود اليوم: الشريط كاملاً (سماوي → أزرق → ذهبي → برتقالي) + حلقة بيضاء */
const DAY_BAR_TODAY =
  "linear-gradient(to top, #00cdfe, #3e9bf6 45%, #febb18 78%, #fd4c10)";

/* ═══════════════════════ أدوات مساعدة صغيرة ═══════════════════════ */

function inWin(t: Transaction, w: { start: string; end: string }): boolean {
  const d = (t.date || "").slice(0, 10);
  return d >= w.start && d <= w.end;
}

function byDateDesc(a: Transaction, b: Transaction): number {
  return a.date < b.date ? 1 : a.date > b.date ? -1 : 0;
}

/** أيام الأسبوع الحالي مع صرف المعيشة لكل يوم (للأعمدة المصغّرة) */
interface WeekDayCell {
  iso: string;
  label: string;
  spent: number;
  isToday: boolean;
  isFuture: boolean;
}

function weekDaysSpent(week: { start: string; end: string } | null, txs: Transaction[], today: string): WeekDayCell[] {
  if (!week) return [];
  const spentByDay = new Map<string, number>();
  for (const t of txs) {
    if (t.type !== "expense" || t.outsideBudget) continue;
    const d = (t.date || "").slice(0, 10);
    if (d < week.start || d > week.end) continue;
    spentByDay.set(d, Math.round(((spentByDay.get(d) ?? 0) + t.amount) * 100) / 100);
  }
  const out: WeekDayCell[] = [];
  let cur = week.start;
  let guard = 0;
  while (cur <= week.end && guard++ < 8) {
    out.push({
      iso: cur,
      label: dayNameShort(cur),
      spent: spentByDay.get(cur) ?? 0,
      isToday: cur === today,
      isFuture: cur > today,
    });
    cur = addDaysISO(cur, 1);
  }
  return out;
}

/* ═══════════════════════ القسم ═══════════════════════ */

type QuickFormKind = "income" | "savings" | "outside" | null;

export function BudgetSection({ data, onGoToTab }: { data: MoneyData; onGoToTab: (t: MoneyTabId) => void }) {
  const { settings, accounts, categories, txs } = data;
  const cur = settings.currency || "ر.س";
  const [sheetOpen, setSheetOpen] = useState(false);
  const [quickForm, setQuickForm] = useState<QuickFormKind>(null);
  const [formBusy, setFormBusy] = useState(false);

  const view = useMemo(() => {
    const today = todayISO();
    const ws = weeklyStatus(settings, txs, today);
    const w = ws.monthWindow;
    return {
      today,
      ws,
      envs: envelopes(categories, txs, w),
      envelopesSum: Math.round(
        categories.filter((c) => !c.archived && c.kind === "expense").reduce((s, c) => s + (c.budget ?? 0), 0),
      ),
      days: weekDaysSpent(ws.week, txs, today),
      outsideTxs: txs
        .filter((t) => t.type === "expense" && t.outsideBudget === true && inWin(t, w))
        .sort(byDateDesc)
        .slice(0, 5),
      uncategorized: Math.round(
        txs
          .filter((t) => t.type === "expense" && !t.categoryId && !t.outsideBudget && inWin(t, w))
          .reduce((s, t) => s + t.amount, 0),
      ),
      savingsAccounts: accounts.filter((a) => a.type === "savings" && !a.archived),
      savingsBalance:
        Math.round(accounts.filter((a) => a.type === "savings" && !a.archived).reduce((s, a) => s + accountBalance(a, txs), 0) * 100) / 100,
      liquidTotal:
        Math.round(accounts.filter((a) => !a.archived).reduce((s, a) => s + accountBalance(a, txs), 0) * 100) / 100,
      lastSweep: txs.filter((t) => t.source === "sweep" && t.type === "transfer").sort(byDateDesc)[0] ?? null,
    };
  }, [settings, accounts, categories, txs]);

  const { ws, envs, envelopesSum, days, outsideTxs, uncategorized, savingsAccounts, savingsBalance, liquidTotal, lastSweep } = view;
  const unset = ws.month.status === "unset";
  const meta = BP_META[ws.month.status];
  const monthPercent = ws.month.budget > 0 ? (ws.month.spent / ws.month.budget) * 100 : 0;
  const maxDaySpent = Math.max(1, ...days.map((d) => d.spent));
  const overWeek = ws.weekRemaining < 0;
  /** حصة الادخار من الأرصدة السائلة — تعبئة شريط الادخار (V5) */
  const savingsShare =
    liquidTotal > 0 ? Math.max(0, Math.min(100, Math.round((savingsBalance / liquidTotal) * 100))) : 0;

  /* ══ إجراءات سريعة: دخل / ادخار / خارج المعيشة ══ */

  const submitIncome = async (amount: number, description: string) => {
    setFormBusy(true);
    try {
      const res = await addIncome({ amount, description: description || "دخل إضافي" });
      if (res) setQuickForm(null);
    } finally {
      setFormBusy(false);
    }
  };

  const submitSavings = async (amount: number, description: string) => {
    setFormBusy(true);
    try {
      const res = await addToSavings({ amount, description: description || undefined });
      if (res) setQuickForm(null);
    } finally {
      setFormBusy(false);
    }
  };

  const submitOutside = async (amount: number, description: string) => {
    setFormBusy(true);
    try {
      const { account } = await ensureDefaultAccount();
      const res = await addTransaction({
        type: "expense",
        amount,
        description: description || "التزام خارج المعيشة",
        accountId: account.id,
        outsideBudget: true,
      });
      if (res) setQuickForm(null);
    } finally {
      setFormBusy(false);
    }
  };

  const toggleAutoSweep = async (v: boolean) => {
    try {
      await saveSettings({ autoSweep: v });
      if (v) {
        toast.success("فُعّل الكنس التلقائي ✓", {
          description: "نهاية كل شهر مالي، الفائض يتحول للادخار تلقائياً",
        });
        // كنس فوري لأي فائض معلّق من الشهر السابق (يعمل مرة واحدة فقط)
        void sweepMonthLeftover();
      } else {
        toast.info("أُوقف الكنس التلقائي", { description: "فائض الشهر يبقى معك كما هو" });
      }
    } catch {
      toast.error("تعذر تحديث الإعداد — جرّب مجدداً");
    }
  };

  const weekDaysAria = days.length
    ? `صرف المعيشة يومياً هذا الأسبوع: ${days.map((d) => `${d.label} ${formatCompact(d.spent)}`).join("، ")}`
    : "";

  return (
    <div className="space-y-3">
      {/* ═══ 1) بطاقة «ميزانية الشهر» — البطل ═══ */}
      {unset ? (
        <motion.div {...widgetEnter(0)}>
          <GlassCard className="p-2">
            <EmptyState
              icon={<Gauge className="w-6 h-6" />}
              title="حدّد ميزانية معيشتك الشهرية"
              hint="منها نشتق حد كل أسبوع وحدك اليومي الحي — وكل مصروف يحدّث المتبقي لحظياً"
              actionLabel="اضبط الميزانية"
              onAction={() => setSheetOpen(true)}
            />
          </GlassCard>
        </motion.div>
      ) : (
        <motion.div {...widgetEnter(0)}>
          <GlassCard className={cn("p-5 ribbon-hairline", ws.month.status === "great" && "glow-gold")}>
            <div className="flex items-center justify-between gap-2">
              <span className="text-[12px] text-muted-foreground">ميزانية الشهر — {ws.monthLabel}</span>
              <button
                type="button"
                onClick={() => setSheetOpen(true)}
                aria-label="تعديل إعدادات الميزانية"
                className={cn(
                  "w-11 h-11 rounded-xl glass-soft border border-white/[0.08] flex items-center justify-center text-primary hover:bg-white/[0.07] shrink-0",
                  press,
                )}
              >
                <Pencil className="w-4 h-4" aria-hidden="true" />
              </button>
            </div>

            {ws.month.remaining < 0 ? (
              <div className="mt-2 flex items-baseline gap-2 flex-wrap">
                <span className="text-[13px] font-bold text-coral">تجاوزت بـ</span>
                <PrivateAmount className="num-display text-[34px] leading-none text-coral block">
                  {formatMoney(-ws.month.remaining, cur)}
                </PrivateAmount>
              </div>
            ) : (
              <div className="mt-2 flex items-baseline gap-2">
                <PrivateAmount className="num-display text-[38px] leading-none text-primary text-glow-gold block">
                  {formatMoney(ws.month.remaining, cur)}
                </PrivateAmount>
                <span className="text-[12px] text-muted-foreground">متبقي</span>
              </div>
            )}

            <div className="mt-2.5 flex flex-wrap items-center gap-x-3 gap-y-1.5">
              <span className={cn("flex items-center gap-1.5 text-[11px] font-medium", meta.cls)}>
                <span className={cn("w-1.5 h-1.5 rounded-full", meta.dot)} aria-hidden="true" />
                {meta.label}
              </span>
              <span className="text-[10px] text-muted-foreground tabular">
                اليوم {formatNumber(ws.month.dayOfCycle)} من {formatNumber(ws.month.daysInCycle)}
              </span>
            </div>

            <p className="mt-2 text-[11px] text-muted-foreground leading-relaxed tabular">
              الحد الشهري{" "}
              <PrivateAmount className="font-semibold text-foreground/80">{formatCompact(ws.month.budget)}</PrivateAmount>
              {" "}• المصرف{" "}
              <PrivateAmount className="font-semibold text-foreground/80">{formatCompact(ws.month.spent)}</PrivateAmount>
              {" "}• الوتيرة{" "}
              <PrivateAmount className="font-semibold text-foreground/80">{formatCompact(ws.month.expectedByNow)}</PrivateAmount>
              {" "}{cur}
            </p>

            <div className="mt-3">
              <PaceBar
                percent={monthPercent}
                pacePercent={pacePercentOf(ws.month)}
                color={budgetBarColor(ws.month.status)}
                ariaLabel="نسبة استهلاك ميزانية الشهر مع علامة الوتيرة المستهدفة"
              />
            </div>

            <p className="mt-2.5 text-[11px] leading-relaxed">
              <span className="text-muted-foreground">بهذه الوتيرة ستُنهي الشهر عند </span>
              <PrivateAmount className="font-semibold text-foreground/85">{formatMoney(ws.month.projected, cur)}</PrivateAmount>
              {ws.month.projected > ws.month.budget ? (
                <span className="text-coral"> — فوق الحد بـ {formatMoney(ws.month.projected - ws.month.budget, cur)}</span>
              ) : (
                <span className="text-mint"> — داخل الحد ✓</span>
              )}
            </p>
          </GlassCard>
        </motion.div>
      )}

      {/* ═══ 2) بطاقة «هذا الأسبوع» — قلب الحساب اليومي ═══ */}
      {!unset && ws.week && (
        <motion.div {...widgetEnter(0.04)}>
          <GlassCard className="p-4">
            <div className="flex items-center justify-between gap-2 flex-wrap">
              <span className="text-[12px] text-muted-foreground flex items-center gap-1.5">
                <CalendarDays className="w-4 h-4 text-cyan" aria-hidden="true" />
                هذا الأسبوع — {ws.week.label} من {formatNumber(ws.weeksSpent.length)}
              </span>
              <span className="text-[10.5px] text-muted-foreground/80 tabular shrink-0">
                {formatDate(ws.week.start)} ← {formatDate(ws.week.end)}
              </span>
            </div>

            {/* صف الحد/المرحّل/المصرف */}
            <div className="grid grid-cols-3 gap-2 mt-3">
              <div className="glass-soft rounded-2xl p-2.5 text-center min-w-0">
                <p className="text-[10px] text-muted-foreground">الحد</p>
                <PrivateAmount className="block mt-0.5 font-bold text-[16px] leading-tight text-foreground/90 truncate">
                  {formatCompact(ws.weeklyBudget)}
                </PrivateAmount>
              </div>
              <div className="glass-soft rounded-2xl p-2.5 text-center min-w-0">
                <p className="text-[10px] text-muted-foreground">المرحّل</p>
                <PrivateAmount
                  className={cn(
                    "block mt-0.5 font-bold text-[16px] leading-tight truncate",
                    ws.carryIn > 0 ? "text-mint" : ws.carryIn < 0 ? "text-coral" : "text-muted-foreground/60",
                  )}
                >
                  {ws.carryIn > 0
                    ? `+${formatCompact(ws.carryIn)}`
                    : ws.carryIn < 0
                      ? `−${formatCompact(-ws.carryIn)}`
                      : formatNumber(0)}
                </PrivateAmount>
              </div>
              <div className="glass-soft rounded-2xl p-2.5 text-center min-w-0">
                <p className="text-[10px] text-muted-foreground">المصرف</p>
                <PrivateAmount className="block mt-0.5 font-bold text-[16px] leading-tight text-foreground/90 truncate">
                  {formatCompact(ws.weekSpent)}
                </PrivateAmount>
              </div>
            </div>

            {/* المتبقي البارز جداً + الحد اليومي الحي */}
            <div className="mt-3 rounded-2xl glass-soft p-3.5 border border-white/[0.05]">
              {overWeek ? (
                <>
                  <p className="text-[11px] font-bold text-coral flex items-center gap-1.5">
                    <AlertTriangle className="w-3.5 h-3.5" aria-hidden="true" />
                    ⚠ تجاوزت حد الأسبوع
                  </p>
                  <PrivateAmount className="block mt-1 num-display text-[30px] leading-none text-coral">
                    {formatMoney(-ws.weekRemaining, cur)}
                  </PrivateAmount>
                </>
              ) : (
                <>
                  <p className="text-[11px] text-muted-foreground">متبقي الأسبوع</p>
                  <PrivateAmount className="block mt-1 num-display text-[30px] leading-none text-mint">
                    {formatMoney(ws.weekRemaining, cur)}
                  </PrivateAmount>
                </>
              )}

              {/* الحد اليومي الحي — رقيقة الشريط: خلفية شريطية خافتة ورقم بلون سماوي الشريط */}
              <div className="mt-3 ribbon-soft rounded-xl border border-white/[0.06] px-3 py-2.5 flex items-baseline justify-between gap-2 flex-wrap">
                <p className="text-[11.5px] text-foreground/75">حدك اليومي المتبقي</p>
                <PrivateAmount
                  className={cn(
                    "num-display text-[24px] font-bold leading-none",
                    overWeek ? "text-coral" : "text-[color:var(--ribbon-cyan)]",
                  )}
                >
                  {formatMoney(ws.dailyLimit, cur)}
                </PrivateAmount>
              </div>
              <p className="mt-1.5 text-[10.5px] text-muted-foreground">
                لـ{formatNumber(ws.daysLeftInWeek)} أيام متبقية · اليوم صرفت{" "}
                <PrivateAmount className="font-semibold text-foreground/85">{formatMoney(ws.todaySpent, cur)}</PrivateAmount>
              </p>
            </div>

            {/* أعمدة أيام الأسبوع المصغّرة */}
            {days.length > 0 && (
              <div className="mt-3.5" role="img" aria-label={weekDaysAria}>
                <div className="flex items-end gap-1">
                  {days.map((d) => {
                    const barH = d.spent > 0 ? Math.max(6, Math.round((d.spent / maxDaySpent) * 52)) : 3;
                    return (
                      <div
                        key={d.iso}
                        title={`${d.label} · ${formatMoney(d.spent, cur)}`}
                        className={cn(
                          "flex-1 min-w-0 flex flex-col items-center gap-1 rounded-lg pt-1",
                          d.isToday && "bg-white/[0.04]",
                        )}
                      >
                        <span
                          className={cn(
                            "h-3.5 text-[8.5px] tabular leading-none flex items-end",
                            d.spent > 0
                              ? d.isToday
                                ? "text-primary font-bold"
                                : "text-muted-foreground/80"
                              : "text-transparent",
                          )}
                        >
                          {d.spent > 0 ? formatCompact(d.spent) : "0"}
                        </span>
                        {/* V5: تدرج الشريط الخافت للأيام، واليوم شريط كامل + حلقة بيضاء */}
                        <div
                          className={cn("w-full max-w-[22px] rounded-[5px]", d.isToday && "ring-1 ring-white/70")}
                          style={{
                            height: barH,
                            background:
                              d.spent === 0 ? "rgba(255,255,255,0.06)" : d.isToday ? DAY_BAR_TODAY : DAY_BAR_SOFT,
                          }}
                        />
                        <span
                          className={cn(
                            "text-[9px] leading-none",
                            d.isToday ? "text-primary font-bold" : d.isFuture ? "text-muted-foreground/40" : "text-muted-foreground/60",
                          )}
                        >
                          {d.label}
                        </span>
                      </div>
                    );
                  })}
                </div>
              </div>
            )}

            {/* رقائق أسابيع الشهر */}
            <div className="mt-3 flex gap-1.5 overflow-x-auto no-scrollbar" role="group" aria-label="صرف المعيشة في كل أسبوع من الشهر">
              {ws.weeksSpent.map((wk) => {
                const active = ws.week?.index === wk.index;
                const over = wk.budget > 0 && wk.spent > wk.budget;
                return (
                  <span
                    key={wk.index}
                    className={cn(
                      "shrink-0 rounded-full px-2.5 py-1 text-[10px] font-semibold tabular glass-soft border",
                      active ? "border-primary/50 text-primary" : "border-white/[0.06] text-muted-foreground",
                      over && "text-coral border-coral/25",
                    )}
                  >
                    أسبوع {formatNumber(wk.index)}: {formatCompact(wk.spent)}/{formatCompact(wk.budget)}
                  </span>
                );
              })}
            </div>
          </GlassCard>
        </motion.div>
      )}

      {/* ═══ 3) بطاقة «الادخار والفائض» ═══ */}
      <motion.div {...widgetEnter(0.08)}>
        <GlassCard className="p-4">
          <div className="flex items-center justify-between gap-2">
            <span className="text-[12px] text-muted-foreground flex items-center gap-1.5">
              <PiggyBank className="w-4 h-4 text-mint" aria-hidden="true" />
              الادخار والفائض
            </span>
            {savingsAccounts.length > 0 ? (
              <PrivateAmount className="num-display text-[15px] font-bold text-mint">{formatMoney(savingsBalance, cur)}</PrivateAmount>
            ) : (
              <Chip className="text-muted-foreground">لا حساب ادخار بعد</Chip>
            )}
          </div>
          {savingsAccounts.length === 0 && (
            <p className="mt-1.5 text-[10.5px] text-muted-foreground/80 leading-relaxed">
              أول تحويل ينشئ حساب «ادخار» تلقائياً — وعاؤك المتراكم الآمن
            </p>
          )}
          {lastSweep && (
            <p className="mt-1.5 text-[10.5px] text-mint/90 flex items-center gap-1.5">
              <BadgeCheck className="w-3.5 h-3.5 shrink-0" aria-hidden="true" />
              كُنِس فائض <PrivateAmount className="font-semibold">{formatMoney(lastSweep.amount, cur)}</PrivateAmount>
              للادخار · {formatDate(lastSweep.date)}
            </p>
          )}

          {/* V5 — حصة الادخار من الأرصدة السائلة: تعبئة شريطية، الأيقونة نعناعية كما هي */}
          {savingsAccounts.length > 0 && liquidTotal > 0 && (
            <div
              className="mt-2.5"
              role="progressbar"
              aria-label="نسبة الادخار من أرصدتك السائلة"
              aria-valuenow={savingsShare}
              aria-valuemin={0}
              aria-valuemax={100}
            >
              <div className="h-1.5 rounded-full bg-white/[0.07] overflow-hidden">
                <div className="h-full rounded-full ribbon" style={{ width: `${savingsShare}%` }} />
              </div>
              <p className="mt-1 text-[9.5px] text-muted-foreground tabular">
                {formatNumber(savingsShare)}٪ من أرصدتك السائلة محفوظة
              </p>
            </div>
          )}

          <div className="mt-3 grid grid-cols-2 gap-2">
            <button
              type="button"
              onClick={() => setQuickForm(quickForm === "income" ? null : "income")}
              aria-label="تسجيل دخل يدوي"
              aria-expanded={quickForm === "income"}
              className={cn(
                "min-h-11 px-3 rounded-xl border flex items-center justify-center gap-1.5 text-[12px] font-bold",
                quickForm === "income"
                  ? "bg-mint/15 border-mint/40 text-mint"
                  : "glass-soft border-white/[0.08] text-foreground/85 hover:bg-white/[0.07]",
                press,
              )}
            >
              <Banknote className="w-4 h-4" aria-hidden="true" />
              سجّل دخلاً
            </button>
            <button
              type="button"
              onClick={() => setQuickForm(quickForm === "savings" ? null : "savings")}
              aria-label="تحويل مبلغ للادخار"
              aria-expanded={quickForm === "savings"}
              className={cn(
                "min-h-11 px-3 rounded-xl border flex items-center justify-center gap-1.5 text-[12px] font-bold",
                quickForm === "savings"
                  ? "bg-primary/25 border-primary/50 text-primary"
                  : "bg-primary/15 border-primary/30 text-primary hover:bg-primary/25",
                press,
              )}
            >
              <PiggyBank className="w-4 h-4" aria-hidden="true" />
              حوّل للادخار
            </button>
          </div>

          {quickForm === "income" && (
            <QuickAmountForm
              title="سجّل دخلاً"
              hint="يضاف لرصيدك فوراً ولا يدخل في حساب ميزانية المعيشة"
              submitLabel="سجّل الدخل"
              busy={formBusy}
              cur={cur}
              descPlaceholder="مثال: راتب، هدية، مبلغ إضافي"
              onSubmit={(amount, description) => void submitIncome(amount, description)}
              onCancel={() => setQuickForm(null)}
            />
          )}
          {quickForm === "savings" && (
            <QuickAmountForm
              title="حوّل للادخار"
              hint="تحويل من «نقد» إلى حساب الادخار — لا يغيّر صافي ثروتك"
              submitLabel="حوّل الآن"
              busy={formBusy}
              cur={cur}
              descPlaceholder="وصف اختياري — مثال: فائض الأسبوع"
              onSubmit={(amount, description) => void submitSavings(amount, description)}
              onCancel={() => setQuickForm(null)}
            />
          )}

          <div className="mt-3 flex items-center justify-between gap-3 rounded-xl glass-soft p-3.5 min-h-11">
            <div className="flex-1 min-w-0">
              <p className="text-[12.5px] font-semibold">كنس فائض الشهر تلقائياً</p>
              <p className="text-[10.5px] text-muted-foreground mt-0.5 leading-relaxed">
                نهاية كل شهر مالي، الفائض يتحول للادخار تلقائياً
              </p>
            </div>
            <Switch
              checked={settings.autoSweep === true}
              onCheckedChange={(v) => void toggleAutoSweep(v)}
              aria-label="تفعيل كنس فائض الشهر تلقائياً"
            />
          </div>
        </GlassCard>
      </motion.div>

      {/* ═══ 4) بطاقة «خارج ميزانية المعيشة» ═══ */}
      <motion.div {...widgetEnter(0.12)}>
        <GlassCard className="p-4">
          <div className="flex items-center justify-between gap-2">
            <span className="text-[12px] text-muted-foreground flex items-center gap-1.5 min-w-0">
              <Receipt className="w-4 h-4 text-gold shrink-0" aria-hidden="true" />
              <span className="truncate">خارج ميزانية المعيشة</span>
            </span>
            <PrivateAmount className="text-[13px] font-bold tabular text-gold shrink-0">
              {formatMoney(ws.outsideSpent, cur)}
            </PrivateAmount>
          </div>
          <p className="mt-1 text-[10.5px] text-muted-foreground/80 leading-relaxed">
            التزامات واستثنائيات لا تدخل في حد المعيشة اليومي/الأسبوعي
          </p>

          {outsideTxs.length === 0 ? (
            <div className="py-3">
              <EmptyState
                compact
                icon={<BadgeCheck className="w-6 h-6 text-mint" />}
                title="لا صرف خارج المعيشة هذا الشهر — ممتاز!"
              />
            </div>
          ) : (
            <div className="mt-1">
              {outsideTxs.map((t) => (
                <div key={t.id} className="py-2 flex items-center gap-2.5 border-t border-white/[0.05] first:border-t-0">
                  <IconBubble
                    icon={t.recurringId ? "repeat" : "receipt"}
                    color={t.recurringId ? "#F5B95C" : "#94A3B8"}
                    className="w-9 h-9"
                    iconClassName="w-4 h-4"
                  />
                  <div className="flex-1 min-w-0">
                    <p className="text-[12.5px] font-medium truncate">{t.description}</p>
                    <p className="text-[10px] text-muted-foreground mt-0.5">
                      {t.recurringId ? "التزام متكرر" : "استثنائية"} · {formatDate(t.date)}
                    </p>
                  </div>
                  <PrivateAmount className="text-[13px] font-bold tabular shrink-0">
                    {formatMoney(t.amount, cur)}
                  </PrivateAmount>
                </div>
              ))}
            </div>
          )}

          <button
            type="button"
            onClick={() => setQuickForm(quickForm === "outside" ? null : "outside")}
            aria-label="تسجيل التزام أو صرف خارج ميزانية المعيشة"
            aria-expanded={quickForm === "outside"}
            className={cn(
              "mt-3 w-full min-h-11 rounded-xl border flex items-center justify-center gap-1.5 text-[12px] font-bold",
              quickForm === "outside"
                ? "bg-gold/20 border-gold/45 text-gold"
                : "glass-soft border-gold/25 text-gold/90 hover:bg-gold/10",
              press,
            )}
          >
            <Plus className="w-4 h-4" aria-hidden="true" />
            سجّل التزاماً/صرفاً خارج المعيشة
          </button>

          {quickForm === "outside" && (
            <QuickAmountForm
              title="صرف خارج المعيشة"
              hint="لا يخصم من حدك اليومي/الأسبوعي — للالتزامات والاستثنائيات"
              submitLabel="سجّله"
              busy={formBusy}
              cur={cur}
              descPlaceholder="مثال: الإيجار، قسط السيارة، هدية استثنائية"
              onSubmit={(amount, description) => void submitOutside(amount, description)}
              onCancel={() => setQuickForm(null)}
            />
          )}
        </GlassCard>
      </motion.div>

      {/* ═══ 5) مصروف غير مصنّف ═══ */}
      {uncategorized > 0 && !unset && (
        <motion.div {...widgetEnter(0.16)}>
          <GlassCard className="p-4">
            <div className="flex items-center justify-between gap-2 mb-2">
              <span className="text-[12px] text-muted-foreground flex items-center gap-1.5">
                <Inbox className="w-4 h-4 text-gold" aria-hidden="true" />
                مصروف غير مصنّف
              </span>
              <button
                type="button"
                onClick={() => onGoToTab("transactions")}
                aria-label="تصنيف المصروفات غير المصنفة في تبويب المعاملات"
                className={cn(
                  "text-[11px] text-primary font-medium min-h-11 px-2 -my-2 flex items-center rounded-lg hover:bg-primary/10",
                  press,
                )}
              >
                صنّفها في المعاملات
              </button>
            </div>
            <p className="text-[12px] text-muted-foreground">
              غير مصنّف:{" "}
              <PrivateAmount className="font-semibold text-foreground/90">{formatMoney(uncategorized, cur)}</PrivateAmount> من إجمالي{" "}
              <PrivateAmount>{formatMoney(ws.month.spent, cur)}</PrivateAmount>
            </p>
            <div className="h-1.5 rounded-full bg-white/[0.05] mt-2 overflow-hidden" aria-hidden="true">
              <div
                className="h-full rounded-full bg-gold"
                style={{ width: `${Math.min(100, ws.month.spent > 0 ? (uncategorized / ws.month.spent) * 100 : 0)}%` }}
              />
            </div>
          </GlassCard>
        </motion.div>
      )}

      {/* ═══ 6) المظاريف — كامل القائمة ═══ */}
      <motion.div {...widgetEnter(0.2)}>
        <GlassCard className="p-4">
          <div className="flex items-center justify-between mb-1">
            <span className="text-[12px] text-muted-foreground">المظاريف — كل الفئات</span>
            <button
              type="button"
              onClick={() => onGoToTab("categories")}
              aria-label="تحرير مظاريف الفئات"
              className={cn(
                "text-[11px] text-primary font-medium min-h-11 px-2 -my-2 flex items-center rounded-lg hover:bg-primary/10",
                press,
              )}
            >
              تحرير المظاريف
            </button>
          </div>
          {envs.length === 0 ? (
            <p className="text-[11.5px] text-muted-foreground py-4 text-center leading-relaxed">
              لا مظاريف بعد — أضف ميزانية للفئات من تبويب الفئات
            </p>
          ) : (
            <div className="max-h-96 overflow-y-auto sys-scroll">
              {envs.map((e) => (
                <div key={e.category.id} className="py-2.5 border-t border-white/[0.05] first:border-t-0">
                  <div className="flex items-center gap-2.5">
                    <IconBubble icon={e.category.icon} color={e.category.color} className="w-8 h-8" iconClassName="w-4 h-4" />
                    <span className="text-[12.5px] font-medium flex-1 truncate">{e.category.name}</span>
                    <span
                      className={cn(
                        "text-[10.5px] font-bold tabular shrink-0",
                        e.status === "over" ? "text-coral" : e.status === "careful" ? "text-gold" : "text-muted-foreground",
                      )}
                    >
                      {formatNumber(e.percent)}%
                    </span>
                  </div>
                  <div className="h-1.5 rounded-full bg-white/[0.05] mt-2 overflow-hidden" aria-hidden="true">
                    <div
                      className="h-full rounded-full"
                      style={{ width: `${Math.min(100, e.percent)}%`, background: ENV_COLOR[e.status] }}
                    />
                  </div>
                  <p className="text-[10px] text-muted-foreground mt-1">
                    {formatMoney(e.spent, cur)} من {formatMoney(e.budget, cur)}
                    {e.remaining >= 0 ? ` · بقي ${formatMoney(e.remaining, cur)}` : ` · تجاوزت ${formatMoney(-e.remaining, cur)}`}
                  </p>
                </div>
              ))}
            </div>
          )}
        </GlassCard>
      </motion.div>

      {/* ═══ نموذج إعدادات الميزانية (ورقة سفلية) ═══ */}
      {sheetOpen && (
        <BudgetSettingsSheet
          settings={settings}
          envelopesSum={envelopesSum}
          cur={cur}
          onClose={() => setSheetOpen(false)}
        />
      )}
    </div>
  );
}

/* ═══════════════════════ عناصر فرعية ═══════════════════════ */

/** نموذج مبلغ+وصف سريع — مشترك بين الدخل/الادخار/خارج المعيشة */
function QuickAmountForm({
  title,
  hint,
  submitLabel,
  busy,
  cur,
  descPlaceholder,
  onSubmit,
  onCancel,
}: {
  title: string;
  hint?: string;
  submitLabel: string;
  busy: boolean;
  cur: string;
  descPlaceholder?: string;
  onSubmit: (amount: number, description: string) => void;
  onCancel: () => void;
}) {
  const [amount, setAmount] = useState("");
  const [desc, setDesc] = useState("");

  const submit = () => {
    const v = Number(amount.trim());
    if (!Number.isFinite(v) || v <= 0) {
      toast.error("أدخل مبلغاً صحيحاً أكبر من صفر");
      return;
    }
    onSubmit(Math.round(v * 100) / 100, desc.trim());
  };

  return (
    <div className="mt-3 pt-3 border-t border-white/[0.07] space-y-2.5">
      <div>
        <p className="text-[12.5px] font-semibold text-foreground/90">{title}</p>
        {hint && <p className="text-[10.5px] text-muted-foreground mt-0.5 leading-relaxed">{hint}</p>}
      </div>
      <input
        type="number"
        inputMode="decimal"
        min={0}
        value={amount}
        onChange={(e) => setAmount(e.target.value.replace(/[^\d.]/g, ""))}
        placeholder="0"
        aria-label={`مبلغ ${title} بالعملة ${cur}`}
        dir="ltr"
        className={cn(inputCls, "num-display text-[18px] font-bold text-center")}
      />
      <input
        type="text"
        value={desc}
        onChange={(e) => setDesc(e.target.value)}
        placeholder={descPlaceholder ?? "وصف اختياري"}
        aria-label={`وصف ${title}`}
        className={cn(inputCls, "h-11")}
      />
      <div className="flex gap-2">
        <button
          type="button"
          onClick={submit}
          disabled={busy}
          className={cn(
            "flex-1 min-h-11 rounded-xl bg-primary/20 border border-primary/40 text-primary text-[13px] font-bold hover:bg-primary/30 disabled:opacity-50",
            press,
          )}
        >
          {busy ? "جارٍ الحفظ…" : submitLabel}
        </button>
        <button
          type="button"
          onClick={onCancel}
          className={cn(
            "flex-1 min-h-11 rounded-xl glass-soft border border-white/[0.08] text-foreground/80 text-[13px] font-semibold hover:bg-white/[0.07]",
            press,
          )}
        >
          إلغاء
        </button>
      </div>
    </div>
  );
}

/** ورقة إعدادات الميزانية — الدخل والحدود ومصير الفائض والكنس التلقائي */
function BudgetSettingsSheet({
  settings,
  envelopesSum,
  cur,
  onClose,
}: {
  settings: Settings;
  envelopesSum: number;
  cur: string;
  onClose: () => void;
}) {
  const weeksCount = Math.max(1, financeMonthWeeks(settings).length);
  const [income, setIncome] = useState(settings.monthlyIncome > 0 ? String(Math.round(settings.monthlyIncome)) : "");
  const [monthly, setMonthly] = useState(
    settings.monthlyBudget && settings.monthlyBudget > 0 ? String(Math.round(settings.monthlyBudget)) : "",
  );
  const [weekly, setWeekly] = useState(
    settings.weeklyBudget && settings.weeklyBudget > 0 ? String(Math.round(settings.weeklyBudget)) : "",
  );
  const [carry, setCarry] = useState<NonNullable<Settings["carryOver"]>>(settings.carryOver ?? "next");
  const [sweep, setSweep] = useState(settings.autoSweep === true);
  const [busy, setBusy] = useState(false);

  const incomeNum = Number(income.trim());
  const monthlyNum = Number(monthly.trim());
  const weeklyPlaceholder =
    Number.isFinite(monthlyNum) && monthlyNum > 0
      ? String(Math.round(monthlyNum / weeksCount))
      : String(Math.round(envelopesSum > 0 ? envelopesSum / weeksCount : 200));
  const carryHint = CARRY_OPTIONS.find((o) => o.k === carry)?.hint ?? "";

  const save = async () => {
    const incomeRaw = income.trim();
    const monthlyRaw = monthly.trim();
    const weeklyRaw = weekly.trim();

    const incomeV = Number(incomeRaw);
    const monthlyV = Number(monthlyRaw);
    const weeklyV = weeklyRaw === "" ? undefined : Number(weeklyRaw);

    if (incomeRaw !== "" && (!Number.isFinite(incomeV) || incomeV < 0)) {
      toast.error("أدخل دخلاً شهرياً صالحاً — صفر أو أكثر");
      return;
    }
    if (monthlyRaw !== "" && (!Number.isFinite(monthlyV) || monthlyV <= 0)) {
      toast.error("أدخل ميزانية شهرية صالحة — أكبر من صفر");
      return;
    }
    if (weeklyV !== undefined && (!Number.isFinite(weeklyV) || weeklyV <= 0)) {
      toast.error("أدخل حد أسبوع صالحاً — أو اتركه فارغاً للاشتقاق التلقائي");
      return;
    }

    setBusy(true);
    try {
      const monthlySaved = monthlyRaw === "" ? 0 : Math.round(monthlyV);
      await saveSettings({
        monthlyIncome: incomeRaw === "" ? 0 : Math.round(incomeV),
        monthlyBudget: monthlySaved,
        weeklyBudget: weeklyV === undefined ? undefined : Math.round(weeklyV),
        carryOver: carry,
        autoSweep: sweep,
      });
      const effWeekly =
        weeklyV !== undefined
          ? Math.round(weeklyV)
          : monthlySaved > 0
            ? Math.round((monthlySaved / weeksCount) * 100) / 100
            : 0;
      toast.success("حُفظت إعدادات الميزانية ✓", {
        description:
          monthlySaved > 0
            ? `حد الأسبوع ${formatMoney(effWeekly, cur)} عبر ${formatNumber(weeksCount)} أسابيع هذا الشهر`
            : "يمكنك تحديدها لاحقاً من قلم التعديل",
      });
      onClose();
    } catch {
      toast.error("تعذر حفظ الإعدادات — جرّب مجدداً");
    } finally {
      setBusy(false);
    }
  };

  const chipCls = cn(
    "min-h-11 px-3.5 rounded-xl glass-soft border border-white/[0.08] text-[11.5px] font-medium text-foreground/85 hover:bg-white/[0.07]",
    press,
  );

  return (
    <SheetShell title="إعدادات الميزانية" desc="الدخل، الحدود، ومصير الفائض" onClose={onClose}>
      <FormShell onSave={() => void save()} busy={busy} saveLabel="حفظ الإعدادات">
        <Field label="الدخل الشهري (تقديري)" hint="مثال: 1300 — يساعد في الرصيد الآمن والنسب السريعة">
          <input
            type="number"
            inputMode="decimal"
            min={0}
            value={income}
            onChange={(e) => setIncome(e.target.value.replace(/[^\d.]/g, ""))}
            placeholder="1300"
            aria-label="الدخل الشهري التقديري"
            dir="ltr"
            className={cn(inputCls, "num-display text-[16px] font-bold text-center")}
          />
        </Field>

        <Field label="ميزانية المعيشة الشهرية" hint="منها تُشتق الأسابيع تلقائياً — مثال: 800">
          <input
            type="number"
            inputMode="decimal"
            min={0}
            value={monthly}
            onChange={(e) => setMonthly(e.target.value.replace(/[^\d.]/g, ""))}
            placeholder={envelopesSum > 0 ? String(envelopesSum) : "800"}
            aria-label="ميزانية المعيشة الشهرية"
            dir="ltr"
            className={cn(inputCls, "num-display text-[16px] font-bold text-center")}
          />
          {(envelopesSum > 0 || (income.trim() !== "" && incomeNum > 0)) && (
            <div className="flex flex-wrap gap-2 mt-2" role="group" aria-label="قيم جاهزة لميزانية الشهر">
              {envelopesSum > 0 && (
                <button type="button" onClick={() => setMonthly(String(envelopesSum))} className={chipCls}>
                  اعتمد المظاريف · {formatMoney(envelopesSum, cur)}
                </button>
              )}
              {income.trim() !== "" && incomeNum > 0 && (
                <>
                  <button type="button" onClick={() => setMonthly(String(Math.round(incomeNum * 0.5)))} className={chipCls}>
                    50% من الدخل
                  </button>
                  <button type="button" onClick={() => setMonthly(String(Math.round(incomeNum * 0.7)))} className={chipCls}>
                    70% من الدخل
                  </button>
                </>
              )}
            </div>
          )}
        </Field>

        <Field
          label="حد الأسبوع"
          hint={`فارغ = تلقائي (الشهري ÷ ${formatNumber(weeksCount)} أسابيع هذا الشهر)`}
        >
          <input
            type="number"
            inputMode="decimal"
            min={0}
            value={weekly}
            onChange={(e) => setWeekly(e.target.value.replace(/[^\d.]/g, ""))}
            placeholder={weeklyPlaceholder}
            aria-label="حد الأسبوع — اتركه فارغاً للاشتقاق التلقائي"
            dir="ltr"
            className={cn(inputCls, "num-display text-[16px] font-bold text-center")}
          />
          {settings.weeklyBudget && settings.weeklyBudget > 0 && (
            <button
              type="button"
              onClick={() => setWeekly("")}
              className={cn(
                "mt-2 text-[11px] text-primary font-medium min-h-11 px-2 -my-2 flex items-center rounded-lg hover:bg-primary/10",
                press,
              )}
              aria-label="مسح الحد الأسبوعي للرجوع للاشتقاق التلقائي"
            >
              امسحه للرجوع للاشتقاق التلقائي
            </button>
          )}
        </Field>

        <div className="space-y-2">
          <p className="text-[11.5px] font-medium text-muted-foreground">مصير فائض/عجز الأسبوع</p>
          <div className="grid grid-cols-3 gap-2" role="radiogroup" aria-label="مصير فائض أو عجز الأسبوع">
            {CARRY_OPTIONS.map((o) => {
              const active = carry === o.k;
              return (
                <button
                  key={o.k}
                  type="button"
                  role="radio"
                  aria-checked={active}
                  onClick={() => setCarry(o.k)}
                  className={cn(
                    "min-h-11 rounded-xl border px-2 py-2.5 text-[10.5px] font-semibold leading-snug text-center",
                    active
                      ? "bg-primary/20 border-primary/50 text-primary"
                      : "glass-soft border-white/[0.08] text-foreground/75 hover:bg-white/[0.06]",
                    press,
                  )}
                >
                  {o.v}
                </button>
              );
            })}
          </div>
          <p className="text-[10.5px] text-muted-foreground/80 leading-relaxed">{carryHint}</p>
        </div>

        <div className="flex items-center justify-between gap-3 rounded-xl glass-soft p-3.5 min-h-11">
          <div className="flex-1 min-w-0">
            <p className="text-[12.5px] font-semibold">كنس فائض الشهر تلقائياً</p>
            <p className="text-[10.5px] text-muted-foreground mt-0.5 leading-relaxed">
              نهاية كل شهر مالي، الفائض يتحول للادخار تلقائياً
            </p>
          </div>
          <Switch checked={sweep} onCheckedChange={setSweep} aria-label="تفعيل كنس فائض الشهر تلقائياً" />
        </div>
      </FormShell>
    </SheetShell>
  );
}
