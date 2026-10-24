"use client";

/**
 * Systemy v3 — شاشة «الأهداف والادخار» (المدير الكامل)
 * بطل: إجمالي الادخار الحالي + عدد الأهداف النشطة + أقرب موعد.
 * بطاقة لكل هدف بتقدم حي وموعد (ذهبي «يكتمل يوم…» / أحمر «متأخر»)
 * → لمسة تفتح تفاصيل غنية: مساهمة سريعة، سحب، محاكاة «ماذا لو»،
 * المهام والعادات المرتبطة، رابط سجل المساهمات في المال، تعديل وحذف.
 * قراءة useLive حصراً — كتابة عبر actions فقط. محلي بالكامل بلا fetch.
 */

import { useMemo, useState } from "react";
import { motion } from "framer-motion";
import { CalendarClock, ChevronLeft, Plus, Target } from "lucide-react";
import { db, getSettings, useLive } from "@/lib/db";
import { diffDays, formatDate, formatMoney, formatNumber, todayISO } from "@/lib/format";
import type { Goal } from "@/lib/types";
import { Chip, GlassCard, PrivateAmount, widgetEnter } from "@/components/systemy/glass";
import { EmptyState } from "@/components/systemy/ui-bits";
import { cn } from "@/lib/utils";
import { GoalFormDialog } from "./goal-form-dialog";
import { GoalDetailsDialog } from "./goal-details-dialog";

/* ═══════════════════════ مساعدات ═══════════════════════ */

/** لون hex + شفافية سداسية */
const tint = (color: string, alpha = "22"): string =>
  /^#[0-9a-fA-F]{6}$/.test(color) ? `${color}${alpha}` : color;

/* ═══════════════════════ الشاشة ═══════════════════════ */

export function GoalsScreen() {
  const settings = useLive(() => getSettings(), []);
  const goals = useLive(() => db.goals.toArray(), []);
  const tasks = useLive(() => db.tasks.toArray(), []);
  const habits = useLive(() => db.habits.toArray(), []);
  const txs = useLive(() => db.transactions.toArray(), []);
  const accounts = useLive(() => db.accounts.toArray(), []);

  const [formOpen, setFormOpen] = useState(false);
  const [formGoal, setFormGoal] = useState<Goal | null>(null);
  const [detailsId, setDetailsId] = useState<string | null>(null);

  const today = todayISO();
  const cur = settings?.currency ?? "ر.س";
  const digits = settings?.digits ?? "latn";

  const live = useMemo(
    () => (goals ?? []).filter((g) => !g.archived).sort((a, b) => a.order - b.order),
    [goals],
  );

  const totalSaved = live.reduce((s, g) => s + g.savedAmount, 0);
  const totalTarget = live.reduce((s, g) => s + g.targetAmount, 0);

  /** أقرب موعد قادم بين الأهداف غير المؤرشفة */
  const nearest = useMemo(() => {
    const upcoming = live
      .filter((g) => g.targetDate && g.targetDate >= today)
      .sort((a, b) => (a.targetDate ?? "").localeCompare(b.targetDate ?? ""));
    return upcoming[0] ?? null;
  }, [live, today]);

  const detailsGoal = detailsId ? (goals ?? []).find((g) => g.id === detailsId) ?? null : null;
  const nextOrder = (goals ?? []).reduce((m, g) => Math.max(m, g.order), 0) + 1;

  const openForm = (g: Goal | null) => {
    setFormGoal(g);
    setFormOpen(true);
  };

  /* ---------- تحميل ---------- */
  if (!goals || !settings) {
    return (
      <div
        className="h-full overflow-y-auto sys-scroll px-4 pt-3 pb-28"
        aria-busy="true"
        aria-label="جارٍ تحميل الأهداف"
      >
        <header className="mb-4">
          <div className="h-7 w-40 animate-pulse rounded-lg bg-white/[0.05]" />
          <div className="mt-2 h-3.5 w-56 animate-pulse rounded bg-white/[0.04]" />
        </header>
        <div className="glass-soft mb-3 h-24 animate-pulse rounded-3xl" />
        <div className="glass-soft mb-3 h-36 animate-pulse rounded-3xl" />
        <div className="glass-soft h-36 animate-pulse rounded-3xl" />
      </div>
    );
  }

  /* ---------- الهيكل ---------- */
  return (
    <div className="h-full overflow-y-auto sys-scroll px-4 pt-3 pb-28">
      {/* ═══ الترويسة ═══ */}
      <motion.header {...widgetEnter(0)} className="mb-4 flex items-center justify-between gap-2 px-1">
        <div className="min-w-0">
          <h1 className="text-[22px] font-bold leading-tight">الأهداف والادخار</h1>
          <p className="mt-0.5 text-[12px] text-muted-foreground">
            أوعية مسمّاة بمواعيد ومحاكاة — متصلة بالمال والعادات
          </p>
        </div>
        <motion.button
          type="button"
          whileTap={{ scale: 0.9 }}
          onClick={() => openForm(null)}
          className="flex h-11 w-11 shrink-0 items-center justify-center rounded-2xl border border-primary/40 bg-primary/15 text-primary transition-colors hover:bg-primary/25"
          aria-label="إضافة هدف جديد"
        >
          <Plus className="h-5 w-5" strokeWidth={2.4} aria-hidden="true" />
        </motion.button>
      </motion.header>

      {/* ═══ بداية نظيفة ═══ */}
      {goals.length === 0 && (
        <motion.div {...widgetEnter(0.05)}>
          <GlassCard className="p-2">
            <EmptyState
              icon={<Target className="h-6 w-6" />}
              title="أنشئ هدفك الأول — مادي أو معنوي"
              hint="وعاء مسمّى بموعد ومساهمة شهرية: حجة، لابتوب، سداد دين، أو قراءة كتاب — المحاكاة تخبرك متى يكتمل"
              actionLabel="أنشئ الهدف الأول"
              onAction={() => openForm(null)}
            />
          </GlassCard>
        </motion.div>
      )}

      {/* ═══ البطل ═══ */}
      {live.length > 0 && (
        <motion.div {...widgetEnter(0.05)} className="mb-3">
          <GlassCard className="space-y-3 p-4">
            <div className="flex items-start justify-between gap-3">
              <div className="min-w-0">
                <p className="text-[11.5px] text-muted-foreground">إجمالي الادخار الحالي</p>
                <p className="text-[10.5px] text-muted-foreground/70 mt-0.5 tabular">
                  من {formatMoney(totalTarget, cur)} عبر {formatNumber(live.length)} أهداف
                </p>
              </div>
              <PrivateAmount className="num-display shrink-0 text-[24px] tabular text-mint">
                {formatMoney(totalSaved, cur)}
              </PrivateAmount>
            </div>

            <div className="flex flex-wrap items-center gap-2 border-t border-white/[0.06] pt-3">
              <Chip className="tabular text-foreground/85">
                <Target className="h-3 w-3 text-primary" aria-hidden="true" />
                {formatNumber(live.length)} هدف نشط
              </Chip>
              {nearest?.targetDate ? (
                <Chip className="border border-gold/30 text-gold">
                  <CalendarClock className="h-3 w-3" aria-hidden="true" />
                  <span className="truncate">
                    أقرب موعد: {nearest.emoji} {nearest.name} — {formatDate(nearest.targetDate)} (
                    {(() => {
                      const n = diffDays(today, nearest.targetDate);
                      return n === 0 ? "اليوم" : `بعد ${formatNumber(n)} يوماً`;
                    })()}
                    )
                  </span>
                </Chip>
              ) : (
                <Chip className="text-muted-foreground">لا مواعيد قادمة بعد</Chip>
              )}
            </div>
          </GlassCard>
        </motion.div>
      )}

      {/* ═══ بطاقات الأهداف ═══ */}
      {live.length > 0 && (
        <div className="space-y-3">
          {live.map((g, idx) => (
            <GoalCard
              key={g.id}
              goal={g}
              currency={cur}
              today={today}
              delay={0.08 + idx * 0.04}
              onOpen={() => setDetailsId(g.id)}
            />
          ))}
        </div>
      )}

      {/* ═══ الحوارات ═══ */}
      <GoalFormDialog
        open={formOpen}
        onOpenChange={setFormOpen}
        goal={formGoal}
        nextOrder={nextOrder}
        digits={digits}
        currency={cur}
      />
      {detailsGoal && (
        <GoalDetailsDialog
          goal={detailsGoal}
          onClose={() => setDetailsId(null)}
          onEdit={(g) => {
            setDetailsId(null);
            openForm(g);
          }}
          accounts={accounts ?? []}
          tasks={tasks ?? []}
          habits={habits ?? []}
          txs={txs ?? []}
          currency={cur}
        />
      )}
    </div>
  );
}

/* ═══════════════════════ بطاقة هدف ═══════════════════════ */

function GoalCard({
  goal,
  currency,
  today,
  delay,
  onOpen,
}: {
  goal: Goal;
  currency: string;
  today: string;
  delay: number;
  onOpen: () => void;
}) {
  const pct = goal.targetAmount > 0 ? Math.min(100, Math.round((goal.savedAmount / goal.targetAmount) * 100)) : 0;
  const remaining = Math.max(0, goal.targetAmount - goal.savedAmount);
  const done = pct >= 100;
  const days = goal.targetDate ? diffDays(today, goal.targetDate) : null;
  const late = days != null && days < 0;

  return (
    <motion.div {...widgetEnter(delay)}>
      <GlassCard
        interactive
        onClick={onOpen}
        className={cn("p-4", done && "glow-gold border-primary/40")}
      >
        <div className="flex items-center gap-3">
          <span
            className="flex h-12 w-12 shrink-0 items-center justify-center rounded-2xl text-[24px]"
            style={{ background: tint(goal.color) }}
            aria-hidden="true"
          >
            {goal.emoji}
          </span>
          <div className="min-w-0 flex-1">
            <div className="flex items-center gap-2">
              <span className="truncate text-[14px] font-semibold">{goal.name}</span>
              {done ? (
                <Chip className="shrink-0 text-gold">🎉 اكتمل</Chip>
              ) : (
                <Chip className="shrink-0 text-muted-foreground tabular">{formatNumber(pct)}%</Chip>
              )}
            </div>
            <p className="mt-0.5 truncate text-[11px] text-muted-foreground tabular">
              <PrivateAmount className="font-semibold text-foreground/80">
                {formatMoney(goal.savedAmount, currency)}
              </PrivateAmount>
              {" من "}
              {formatMoney(goal.targetAmount, currency)}
            </p>
          </div>
          <span className="flex h-11 w-11 shrink-0 items-center justify-center text-muted-foreground" aria-hidden="true">
            <ChevronLeft className="h-5 w-5" />
          </span>
        </div>

        <div
          className="mt-3 h-2 overflow-hidden rounded-full bg-white/[0.06]"
          role="progressbar"
          aria-valuenow={pct}
          aria-valuemin={0}
          aria-valuemax={100}
          aria-label={`تقدم «${goal.name}»: ${pct}%`}
        >
          <div
            className="h-full rounded-full transition-all"
            style={{ width: `${pct}%`, background: done ? "linear-gradient(90deg, #F5B95C, #6EE7A8)" : goal.color }}
          />
        </div>

        <div className="mt-2 flex flex-wrap items-center gap-x-2 gap-y-1.5 text-[10.5px] text-muted-foreground tabular">
          {!done && (
            <span>
              متبقٍ{" "}
              <PrivateAmount className="font-semibold text-gold">{formatMoney(remaining, currency)}</PrivateAmount>
            </span>
          )}
          {goal.monthly > 0 && <span>· شهرياً {formatMoney(goal.monthly, currency)}</span>}
          {goal.targetDate && (
            <>
              <Chip
                className={cn("border", late ? "border-coral/30 text-coral" : "border-gold/30 text-gold")}
              >
                {done ? "اكتمل" : late ? "متأخر" : "يكتمل"} {formatDate(goal.targetDate)}
              </Chip>
              <span>
                {days === 0
                  ? "اليوم"
                  : days != null && days > 0
                    ? `بعد ${formatNumber(days)} يوماً`
                    : days != null
                      ? `فات ${formatNumber(-days)} يوماً`
                      : ""}
              </span>
            </>
          )}
        </div>
      </GlassCard>
    </motion.div>
  );
}
