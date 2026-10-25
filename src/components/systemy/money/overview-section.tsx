"use client";

/**
 * Systemy v5 — قسم «نظرة عامة» في شاشة المال بهوية «الشريط»
 * هيرو صافي الثروة (خط شريطي) + الرصيد الآمن + ملخص الشهر بشكل الشهر +
 * إيقاع 14 يوماً + أعلى الفئات + المستحق خلال أسبوع مع سداد بضغطة.
 * الشريط = تقدّم/علامة، الذهبي = القيمة، والأرقام tabular دائماً.
 */

import { useMemo, useState } from "react";
import { motion } from "framer-motion";
import {
  CalendarClock,
  Gem,
  Landmark,
  Receipt,
  Repeat,
  ShieldCheck,
  Target,
  TrendingDown,
  TrendingUp,
  Wallet,
} from "lucide-react";
import { payRecurring, settleDebt } from "@/lib/actions";
import { financeMonthLabel, formatCompact, formatMoney, formatNumber, relativeDay, todayISO } from "@/lib/format";
import {
  categorySeries,
  dailySeries,
  dueSoon,
  envelopes,
  monthSummary,
  monthWindow,
  netWorth,
  runway,
  safeToSpend,
  type DueSoonItem,
  type Envelope,
  type SafeToSpend,
} from "@/lib/money";
import { weeklyStatus } from "@/lib/budget-engine";
import { useUIStore } from "@/store/ui-store";
import { Chip, GlassCard, PrivateAmount, widgetEnter } from "@/components/systemy/glass";
import { EmptyState } from "@/components/systemy/ui-bits";
import { IconBubble, type MoneyData, type MoneyTabId } from "./money-screen";
import { BP_META, PaceBar, budgetBarColor } from "./budget-section";
import { cn } from "@/lib/utils";

/** ضغط V5 — 0.96 بالضبط، انتقالات محدّدة الخصائص (ممنوع transition:all) */
const press =
  "transition-[transform,color,background-color,border-color] duration-150 ease-out active:scale-[0.96]";

/* ═══════════════════════ خرائط الألوان والحالة ═══════════════════════ */

const STS_META: Record<SafeToSpend["status"], { label: string; cls: string; dot: string }> = {
  great: { label: "متّسع مريح", cls: "text-gold", dot: "bg-gold" },
  good: { label: "متوازن", cls: "text-foreground/80", dot: "bg-mint" },
  careful: { label: "يوم حذر", cls: "text-coral", dot: "bg-coral" },
};

const ENV_COLOR: Record<Envelope["status"], string> = {
  great: "#6EE7A8",
  good: "#F5B95C",
  careful: "#FFB4A2",
  over: "#FF8E7A",
};

/* ═══════════════════════ القسم ═══════════════════════ */

export function OverviewSection({ data, onGoToTab }: { data: MoneyData; onGoToTab: (t: MoneyTabId) => void }) {
  const openQuickAdd = useUIStore((s) => s.openQuickAdd);
  const { settings, accounts, categories, txs, recurrings, goals, assets, debts } = data;
  const cur = settings.currency || "ر.س";
  const [payingId, setPayingId] = useState<string | null>(null);

  const view = useMemo(() => {
    const w = monthWindow(settings);
    return {
      w,
      nw: netWorth(accounts, txs, assets, debts),
      sts: safeToSpend(settings, txs, recurrings, goals),
      ws: weeklyStatus(settings, txs, todayISO()),
      ms: monthSummary(settings, txs),
      envs: envelopes(categories, txs, w).slice(0, 3),
      daily: dailySeries(txs, 14),
      cats: categorySeries(categories, txs, w, 6),
      rw: runway(accounts, txs),
      due: dueSoon(recurrings, debts, 7),
    };
  }, [settings, accounts, categories, txs, recurrings, goals, assets, debts]);

  const recById = useMemo(() => new Map(recurrings.map((r) => [r.id, r])), [recurrings]);
  const activeAccounts = useMemo(() => accounts.filter((a) => !a.archived), [accounts]);

  const maxSpent = Math.max(1, ...view.daily.map((d) => d.spent));
  const topCatValue = view.cats[0]?.value ?? 1;
  const stsMeta = STS_META[view.sts.status];
  /** شكل الشهر V5: دخل نعناعي × مصروف مرجاني (نسبة كل منهما لأكبرهما) */
  const monthMax = Math.max(view.ms.income, view.ms.spent, 1);
  const incomePct = Math.min(100, Math.round((view.ms.income / monthMax) * 100));
  const expensePct = Math.min(100, Math.round((view.ms.spent / monthMax) * 100));

  const runwayChip =
    view.rw >= 99
      ? { text: "دخلك يغطي مصروفك", cls: "text-mint" }
      : {
          text: `يغطيك ${formatNumber(view.rw, view.rw % 1 === 0 ? 0 : 1)} شهر`,
          cls: view.rw < 1 ? "text-coral" : view.rw < 3 ? "text-gold" : "text-mint",
        };

  /** سداد مستحق — التزام مباشر أو عبر اختيار حساب */
  const handlePay = (item: DueSoonItem) => {
    const direct = item.kind === "recurring" ? recById.get(item.id)?.accountId : undefined;
    if (direct) {
      void payRecurring(item.id);
      return;
    }
    setPayingId(payingId === item.id ? null : item.id);
  };

  const payWith = (item: DueSoonItem, accountId: string) => {
    setPayingId(null);
    if (item.kind === "recurring") void payRecurring(item.id, { accountId });
    else void settleDebt(item.id, item.amount, accountId);
  };

  /* بداية نظيفة: لا حسابات ولا معاملات */
  if (accounts.length === 0 && txs.length === 0) {
    return (
      <GlassCard className="p-2">
        <EmptyState
          icon={<Wallet className="w-6 h-6" />}
          title="رحلتك المالية تبدأ من هنا"
          hint="أضف حسابك الأول (نقد، بنك، محفظة…) وستظهر الأرصدة والرصيد الآمن فوراً"
          actionLabel="أضف حسابك الأول"
          onAction={() => openQuickAdd("account")}
        />
      </GlassCard>
    );
  }

  return (
    <div className="space-y-3">
      {/* ═══ 1) هيرو صافي الثروة — خط الشريط لمسة العلامة ═══ */}
      <motion.div {...widgetEnter(0)}>
        <GlassCard className={cn("p-5 ribbon-hairline", view.sts.status === "great" && "glow-gold")}>
          <div className="flex items-center justify-between gap-2">
            <span className="text-[12px] text-muted-foreground">صافي الثروة</span>
            <Chip className={runwayChip.cls}>
              <ShieldCheck className="w-3 h-3" aria-hidden="true" />
              {runwayChip.text}
            </Chip>
          </div>
          <PrivateAmount className="num-display text-[38px] leading-none mt-2 text-primary text-glow-gold block">
            {formatMoney(view.nw.total, cur)}
          </PrivateAmount>
          <div className="mt-4 grid grid-cols-3 gap-2">
            <BreakStat icon={<Wallet className="w-3.5 h-3.5" />} label="حسابات" value={formatCompact(view.nw.accountsTotal)} />
            <BreakStat icon={<Landmark className="w-3.5 h-3.5" />} label="أصول" value={formatCompact(view.nw.assetsTotal)} />
            <BreakStat icon={<Gem className="w-3.5 h-3.5" />} label="عليك" value={formatCompact(view.nw.liabilities)} />
          </div>
        </GlassCard>
      </motion.div>

      {/* ═══ 2) الميزانية — الأسبوع أولاً (اليومي الحي) ثم الشهر مصغراً ═══ */}
      {view.ws.month.status !== "unset" && (
        <motion.div {...widgetEnter(0.04)}>
          <button
            type="button"
            onClick={() => onGoToTab("budget")}
            aria-label="فتح تبويب الميزانية"
            className="w-full text-start glass rounded-3xl p-5 relative overflow-hidden hover:bg-black/[0.04] active:scale-[0.96] transition-[background-color,transform] duration-150 ease-out"
          >
            <div className="flex items-center justify-between gap-2">
              <span className="text-[12px] text-muted-foreground">الميزانية — {view.ws.monthLabel}</span>
              <span className={cn("flex items-center gap-1.5 text-[11px] font-medium shrink-0", BP_META[view.ws.month.status].cls)}>
                <span className={cn("w-1.5 h-1.5 rounded-full", BP_META[view.ws.month.status].dot)} aria-hidden="true" />
                {BP_META[view.ws.month.status].label}
              </span>
            </div>
            <div className="mt-2.5 flex items-baseline gap-2 flex-wrap">
              <PrivateAmount
                className={cn(
                  "num-display text-[34px] leading-none",
                  view.ws.weekRemaining < 0 ? "text-coral" : "text-glow-gold text-primary",
                )}
              >
                {formatMoney(view.ws.weekRemaining, cur)}
              </PrivateAmount>
              <span className="text-[12px] text-muted-foreground">متبقي الأسبوع{view.ws.weekRemaining < 0 ? " — تجاوزت" : ""}</span>
            </div>
            <p className="mt-1.5 text-[11px] text-muted-foreground">
              {view.ws.week?.label ?? "الأسبوع"} · اليومي{" "}
              <PrivateAmount className={cn("font-bold", view.ws.weekRemaining < 0 ? "text-coral" : "text-primary")}>
                {formatMoney(view.ws.dailyLimit, cur)}
              </PrivateAmount>
              {" · "}اليوم صرفت{" "}
              <PrivateAmount className="font-semibold text-foreground/80">{formatMoney(view.ws.todaySpent, cur)}</PrivateAmount>
            </p>
            <p className="mt-2.5 text-[11px] text-muted-foreground">
              الشهر: متبقي{" "}
              <PrivateAmount className={cn("font-semibold", view.ws.month.remaining < 0 ? "text-coral" : "text-foreground/80")}>
                {formatMoney(view.ws.month.remaining, cur)}
              </PrivateAmount>
            </p>
            <div className="mt-2">
              <PaceBar
                percent={view.ws.month.budget > 0 ? (view.ws.month.spent / view.ws.month.budget) * 100 : 0}
                pacePercent={view.ws.month.budget > 0 ? (view.ws.month.expectedByNow / view.ws.month.budget) * 100 : 0}
                color={budgetBarColor(view.ws.month.status)}
                ariaLabel="نسبة استهلاك ميزانية الشهر مع علامة الوتيرة المستهدفة"
              />
            </div>
          </button>
        </motion.div>
      )}

      {/* ═══ 3) الرصيد الآمن ═══ */}
      <motion.div {...widgetEnter(0.08)}>
        <GlassCard className="p-5">
          <div className="flex items-center justify-between">
            <span className="text-[12px] text-muted-foreground">الآمن صرفه يومياً</span>
            <span className={cn("flex items-center gap-1.5 text-[11px] font-medium", stsMeta.cls)}>
              <span className={cn("w-1.5 h-1.5 rounded-full", stsMeta.dot)} />
              {stsMeta.label}
            </span>
          </div>
          <div className="mt-2.5 flex items-baseline gap-2">
            <PrivateAmount className="num-display text-[42px] leading-none text-glow-gold text-primary">
              {formatMoney(view.sts.amount, cur)}
            </PrivateAmount>
          </div>
          <p className="mt-2 text-[11px] text-muted-foreground">
            حتى نهاية الشهر المالي · <span className="tabular">{formatNumber(view.sts.daysLeft)}</span> يوماً متبقياً
          </p>
          <div className="mt-3.5 pt-3 border-t border-black/[0.06] flex items-center justify-between text-[10px] text-muted-foreground/90 tabular">
            <span>دخل {formatCompact(view.sts.expectedIncome)}</span>
            <span className="opacity-50">−</span>
            <span>التزامات {formatCompact(view.sts.commitments)}</span>
            <span className="opacity-50">−</span>
            <span>أهداف {formatCompact(view.sts.goalContributions)}</span>
            <span className="opacity-50">−</span>
            <span>مصروف {formatCompact(view.sts.spent)}</span>
          </div>
        </GlassCard>
      </motion.div>

      {/* ═══ 4) ملخص الشهر المالي — مع «شكل الشهر» ═══ */}
      <motion.div {...widgetEnter(0.12)}>
        <GlassCard className="p-4">
          <div className="flex items-center justify-between">
            <span className="text-[12px] text-muted-foreground">ملخص {financeMonthLabel(todayISO(), settings.monthStartDay || 1)}</span>
            <Chip className="text-muted-foreground">{formatNumber(view.ms.txCount)} معاملة</Chip>
          </div>
          <div className="grid grid-cols-2 gap-2 mt-3">
            <div className="glass-soft rounded-2xl p-3">
              <p className="text-[10.5px] text-muted-foreground">مصروف</p>
              <PrivateAmount className="text-[16px] font-bold tabular block mt-0.5">{formatMoney(view.ms.spent, cur)}</PrivateAmount>
            </div>
            <div className="glass-soft rounded-2xl p-3">
              <p className="text-[10.5px] text-muted-foreground">دخل</p>
              <PrivateAmount className="text-[16px] font-bold tabular text-mint block mt-0.5">{formatMoney(view.ms.income, cur)}</PrivateAmount>
            </div>
          </div>

          {/* شكل الشهر V5 — دخل نعناعي · مصروف مرجاني · والمغلف الكامل شريط متدرج */}
          {view.ms.txCount > 0 && (
            <div
              className="mt-3"
              role="img"
              aria-label={`شكل الشهر: الدخل ${formatMoney(view.ms.income, cur)} مقابل المصروف ${formatMoney(view.ms.spent, cur)} داخل مظروف الشهر`}
            >
              <div className="space-y-1.5">
                <div className="flex items-center gap-2">
                  <span className="w-9 shrink-0 text-[9.5px] text-mint">دخل</span>
                  <div className="flex-1 h-1.5 rounded-full bg-black/[0.03] overflow-hidden">
                    <div className="h-full rounded-full bg-mint" style={{ width: `${incomePct}%` }} />
                  </div>
                </div>
                <div className="flex items-center gap-2">
                  <span className="w-9 shrink-0 text-[9.5px] text-coral">مصروف</span>
                  <div className="flex-1 h-1.5 rounded-full bg-black/[0.03] overflow-hidden">
                    <div className="h-full rounded-full bg-coral" style={{ width: `${expensePct}%` }} />
                  </div>
                </div>
              </div>
              <div className="mt-2 h-1 rounded-full ribbon opacity-80" aria-hidden="true" />
            </div>
          )}
          <p className="mt-2.5 text-[11px] flex items-center gap-1.5">
            {view.ms.prevSpent === 0 ? (
              <span className="text-muted-foreground">أول شهر مالي — ستظهر المقارنة الشهر القادم</span>
            ) : view.ms.delta > 0 ? (
              <span className="text-coral flex items-center gap-1">
                <TrendingUp className="w-3.5 h-3.5" aria-hidden="true" />
                أعلى بـ {formatNumber(Math.abs(view.ms.delta))}% من الشهر الماضي
              </span>
            ) : view.ms.delta < 0 ? (
              <span className="text-mint flex items-center gap-1">
                <TrendingDown className="w-3.5 h-3.5" aria-hidden="true" />
                أقل بـ {formatNumber(Math.abs(view.ms.delta))}% — أحسنت
              </span>
            ) : (
              <span className="text-muted-foreground">مثل الشهر الماضي تماماً</span>
            )}
          </p>
        </GlassCard>
      </motion.div>

      {/* ═══ 5) إيقاع الصرف — 14 يوماً ═══ */}
      <motion.div {...widgetEnter(0.16)}>
        <GlassCard className="p-4">
          <div className="flex items-center justify-between mb-3">
            <span className="text-[12px] text-muted-foreground">إيقاع الصرف — آخر 14 يوماً</span>
          </div>
          <div className="flex items-end gap-[3px] h-24" dir="rtl" role="img" aria-label="مخطط أعمدة للصرف اليومي خلال آخر 14 يوماً">
            {view.daily.map((d, i) => {
              const isToday = i === view.daily.length - 1;
              const h = Math.max(3, Math.round((d.spent / maxSpent) * 88));
              return (
                <div key={i} className="flex-1 flex flex-col items-center gap-1 min-w-0" title={`${d.day} · ${formatMoney(d.spent, cur)}`}>
                  <div
                    className="w-full rounded-t-[4px]"
                    style={{
                      height: h,
                      background:
                        d.spent === 0
                          ? "rgba(255,255,255,0.07)"
                          : isToday
                            ? "linear-gradient(to top, rgba(245,185,92,0.3), #F5B95C)"
                            : "linear-gradient(to top, rgba(92,225,230,0.2), rgba(92,225,230,0.8))",
                    }}
                  />
                  <span className={cn("text-[8.5px] tabular", isToday ? "text-primary font-bold" : "text-muted-foreground/70")}>
                    {d.day}
                  </span>
                </div>
              );
            })}
          </div>
        </GlassCard>
      </motion.div>

      {/* ═══ 6) أعلى فئات الشهر ═══ */}
      <motion.div {...widgetEnter(0.2)}>
        <GlassCard className="p-4">
          <div className="flex items-center justify-between mb-1">
            <span className="text-[12px] text-muted-foreground">أعلى فئات الشهر</span>
            <button
              onClick={() => onGoToTab("categories")}
              className={cn("text-[11px] text-primary font-medium min-h-11 px-2 -my-2 flex items-center rounded-lg hover:bg-primary/10", press)}
            >
              الفئات
            </button>
          </div>
          {view.cats.length === 0 ? (
            <p className="text-[11.5px] text-muted-foreground py-4 text-center">لا مصروفات مصنّفة هذا الشهر بعد</p>
          ) : (
            view.cats.map((c) => (
              <div key={c.name} className="flex items-center gap-2.5 py-2 border-t border-black/[0.04] first:border-t-0">
                <span className="w-2.5 h-2.5 rounded-full shrink-0" style={{ background: c.color }} aria-hidden="true" />
                <div className="flex-1 min-w-0">
                  <div className="flex items-center justify-between gap-2 text-[12px]">
                    <span className="truncate">{c.name}</span>
                    <PrivateAmount className="tabular font-semibold shrink-0">{formatMoney(c.value, cur)}</PrivateAmount>
                  </div>
                  <div className="h-1.5 rounded-full bg-black/[0.03] mt-1.5 overflow-hidden">
                    <div
                      className="h-full rounded-full"
                      style={{ width: `${Math.max(4, (c.value / topCatValue) * 100)}%`, background: c.color }}
                    />
                  </div>
                </div>
              </div>
            ))
          )}
        </GlassCard>
      </motion.div>

      {/* ═══ 7) أظرف الميزانية — الأكثر استهلاكاً ═══ */}
      {view.envs.length > 0 && (
        <motion.div {...widgetEnter(0.24)}>
          <GlassCard className="p-4">
            <div className="flex items-center justify-between mb-1">
              <span className="text-[12px] text-muted-foreground">أظرف الميزانية — الأكثر استهلاكاً</span>
              <button
                onClick={() => onGoToTab("categories")}
                className={cn("text-[11px] text-primary font-medium min-h-11 px-2 -my-2 flex items-center rounded-lg hover:bg-primary/10", press)}
              >
                الكل
              </button>
            </div>
            {view.envs.map((e) => (
              <div key={e.category.id} className="py-2.5 border-t border-black/[0.04] first:border-t-0">
                <div className="flex items-center gap-2.5">
                  <IconBubble icon={e.category.icon} color={e.category.color} className="w-8 h-8" iconClassName="w-4 h-4" />
                  <span className="text-[12.5px] font-medium flex-1 truncate">{e.category.name}</span>
                  <span
                    className={cn(
                      "text-[10.5px] font-bold tabular shrink-0",
                      e.status === "over" ? "text-coral" : e.status === "careful" ? "text-gold" : "text-muted-foreground"
                    )}
                  >
                    {formatNumber(e.percent)}%
                  </span>
                </div>
                <div className="h-1.5 rounded-full bg-black/[0.03] mt-2 overflow-hidden">
                  <div
                    className="h-full rounded-full"
                    style={{ width: `${Math.min(100, e.percent)}%`, background: ENV_COLOR[e.status] }}
                  />
                </div>
                <p className="text-[10px] text-muted-foreground mt-1 tabular">
                  {formatMoney(e.spent, cur)} من {formatMoney(e.budget, cur)}
                  {e.remaining >= 0 ? ` · بقي ${formatMoney(e.remaining, cur)}` : ` · تجاوزت ${formatMoney(-e.remaining, cur)}`}
                </p>
              </div>
            ))}
          </GlassCard>
        </motion.div>
      )}

      {/* ═══ 8) المستحق خلال أسبوع — مع سداد بضغطة ═══ */}
      {view.due.length > 0 && (
        <motion.div {...widgetEnter(0.28)}>
          <GlassCard className="p-4">
            <div className="flex items-center gap-2 mb-1">
              <CalendarClock className="w-4 h-4 text-primary" aria-hidden="true" />
              <span className="text-[12px] text-muted-foreground">مستحق خلال أسبوع</span>
            </div>
            {view.due.map((item) => {
              const badge =
                item.daysLeft === 0
                  ? { t: "اليوم", cls: "bg-[#FF8E7A]/15 text-coral" }
                  : item.daysLeft === 1
                    ? { t: "غداً", cls: "bg-[#F5B95C]/15 text-gold" }
                    : { t: `بعد ${formatNumber(item.daysLeft)} أيام`, cls: "bg-black/[0.04] text-muted-foreground" };
              return (
                <div key={`${item.kind}:${item.id}`} className="py-2.5 border-t border-black/[0.04] first:border-t-0">
                  <div className="flex items-center gap-3">
                    <IconBubble
                      icon={item.icon}
                      color={item.kind === "debt" ? "#FF8E7A" : "#F5B95C"}
                      className="w-10 h-10"
                      iconClassName="w-[18px] h-[18px]"
                    />
                    <div className="flex-1 min-w-0">
                      <div className="flex items-center gap-2">
                        <span className="text-[13px] font-semibold truncate">{item.name}</span>
                        <span className={cn("text-[9.5px] font-bold rounded-full px-2 py-0.5 shrink-0", badge.cls)}>{badge.t}</span>
                      </div>
                      <span className="text-[10.5px] text-muted-foreground flex items-center gap-1 mt-0.5">
                        {item.kind === "debt" ? <Gem className="w-3 h-3" aria-hidden="true" /> : <Repeat className="w-3 h-3" aria-hidden="true" />}
                        {relativeDay(item.dueDate)}
                      </span>
                    </div>
                    <PrivateAmount className="text-[13px] font-bold tabular shrink-0">{formatMoney(item.amount, cur)}</PrivateAmount>
                    <button
                      onClick={() => handlePay(item)}
                      className={cn(
                        "h-11 px-3.5 rounded-xl bg-primary/15 border border-primary/30 text-primary text-[11.5px] font-bold shrink-0 hover:bg-primary/25",
                        press,
                      )}
                    >
                      سدد
                    </button>
                  </div>
                  {payingId === item.id && (
                    <div className="mt-2.5 flex items-center gap-2 overflow-x-auto no-scrollbar" role="group" aria-label="اختر حساب السداد">
                      {activeAccounts.length === 0 ? (
                        <span className="text-[10.5px] text-muted-foreground">أضف حساباً أولاً لتسجيل السداد كمعاملة</span>
                      ) : (
                        <>
                          <span className="text-[10.5px] text-muted-foreground shrink-0">من حساب:</span>
                          {activeAccounts.map((a) => (
                            <button
                              key={a.id}
                              onClick={() => payWith(item, a.id)}
                              className={cn(
                                "h-11 px-3 rounded-xl glass-soft border border-black/[0.07] flex items-center gap-1.5 shrink-0 hover:bg-black/[0.04]",
                                press,
                              )}
                            >
                              <span className="w-2 h-2 rounded-full" style={{ background: a.color }} aria-hidden="true" />
                              <span className="text-[11.5px] font-medium">{a.name}</span>
                            </button>
                          ))}
                        </>
                      )}
                    </div>
                  )}
                </div>
              );
            })}
          </GlassCard>
        </motion.div>
      )}

      {/* ═══ 9) روابط سريعة للأقسام ═══ */}
      <motion.div {...widgetEnter(0.28)}>
        <div className="grid grid-cols-4 gap-2">
          <QuickLink icon={<Receipt className="w-4 h-4" />} label="معاملات" count={formatNumber(txs.length)} onClick={() => onGoToTab("transactions")} />
          <QuickLink icon={<Wallet className="w-4 h-4" />} label="حسابات" count={formatNumber(accounts.length)} onClick={() => onGoToTab("accounts")} />
          <QuickLink icon={<Target className="w-4 h-4" />} label="أهداف" count={formatNumber(goals.filter((g) => !g.archived).length)} onClick={() => onGoToTab("goals")} />
          <QuickLink icon={<Gem className="w-4 h-4" />} label="ديون" count={formatNumber(debts.length)} onClick={() => onGoToTab("assets")} />
        </div>
      </motion.div>
    </div>
  );
}

/* ═══════════════════════ عناصر فرعية ═══════════════════════ */

function BreakStat({ icon, label, value }: { icon: React.ReactNode; label: string; value: string }) {
  return (
    <div className="glass-soft rounded-2xl px-2.5 py-2 text-center">
      <span className="flex items-center justify-center gap-1 text-[10px] text-muted-foreground">
        {icon}
        {label}
      </span>
      <PrivateAmount className="block text-[13px] font-bold tabular mt-0.5">{value}</PrivateAmount>
    </div>
  );
}

function QuickLink({
  icon,
  label,
  count,
  onClick,
}: {
  icon: React.ReactNode;
  label: string;
  count: string;
  onClick: () => void;
}) {
  return (
    <button
      onClick={onClick}
      className={cn(
        "glass rounded-2xl p-2.5 flex flex-col items-center gap-1 min-h-[70px] justify-center hover:bg-black/[0.04]",
        press,
      )}
      aria-label={`الانتقال إلى ${label}`}
    >
      <span className="text-primary/80">{icon}</span>
      <span className="text-[12px] font-bold tabular">{count}</span>
      <span className="text-[9.5px] text-muted-foreground">{label}</span>
    </button>
  );
}
