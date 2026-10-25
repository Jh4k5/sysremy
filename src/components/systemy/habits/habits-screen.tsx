"use client";

/**
 * Systemy v2 — شاشة العادات (المدير الكامل)
 * بطاقات عادات بنقاط آخر 7 أيام وتقدم اليوم — لمسة واحدة تُنجز اليوم،
 * و+1 للعدّادات المتعددة، ومؤقت تركيز للعادات ذات المدة.
 * إحصاءات: أفضل سلسلة، إنجاز الأسبوع، وخريطة حرارية 30 يوماً لكل عادة.
 * قسم مؤرشفة قابل للطي مع استعادة وحذف.
 */

import { useMemo, useState, type CSSProperties, type ReactNode } from "react";
import { AnimatePresence, motion } from "framer-motion";
import {
  Archive,
  ArchiveRestore,
  Bell,
  CalendarCheck2,
  Check,
  ChevronDown,
  Flame,
  LayoutTemplate,
  MoreVertical,
  Pencil,
  Play,
  Plus,
  Target,
  Timer,
  Trash2,
  TrendingUp,
} from "lucide-react";
import { toast } from "sonner";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { db, getSettings, useLive } from "@/lib/db";
import { deleteHabit, logHabit, updateHabit } from "@/lib/actions";
import { habitStreak, type Habit, type HabitLog } from "@/lib/types";
import {
  addDaysISO,
  diffDays,
  formatMoney,
  formatTimeAr,
  fromISODate,
  startOfWeekISO,
  todayISO,
  type WeekStart,
} from "@/lib/format";
import { ConfirmBar, EmptyState, iconByName } from "@/components/systemy/ui-bits";
import { GlassCard, widgetEnter } from "@/components/systemy/glass";
import { cn } from "@/lib/utils";
import { HabitFormDialog } from "./habit-form-dialog";
import { HabitTimer } from "./habit-timer";

const DAY_LETTERS = ["ح", "ن", "ث", "ر", "خ", "ج", "س"]; // الأحد..السبت

/** أيقونة عادة بالاسم — تُبنى داخل إغلاق خريطة (نمط ثابت آمن لقواعد الخطافات) */
function HabitGlyph({
  name,
  className,
  style,
}: {
  name: string;
  className?: string;
  style?: CSSProperties;
}) {
  return (
    <>
      {[name.toLowerCase()].map((n) => {
        const I = iconByName(n);
        return <I key={n} className={className} style={style} aria-hidden="true" />;
      })}
    </>
  );
}

/** شاشة العادات — المدير الكامل */
export function HabitsScreen() {
  const settings = useLive(() => getSettings(), []);
  const habits = useLive(() => db.habits.toArray(), []);
  const logs = useLive(() => db.habitLogs.toArray(), []);
  const goals = useLive(() => db.goals.toArray(), []);

  const [formOpen, setFormOpen] = useState(false);
  const [formHabit, setFormHabit] = useState<Habit | null>(null);
  /** فتح النموذج مع لوحة القوالب الجاهزة مفتوحة مسبقاً (زر «قوالب» في الرأس) */
  const [formTemplates, setFormTemplates] = useState(false);
  const [timerHabitId, setTimerHabitId] = useState<string | null>(null);
  const [deleting, setDeleting] = useState<Habit | null>(null);
  const [statsOpen, setStatsOpen] = useState(false);
  const [archivedOpen, setArchivedOpen] = useState(false);

  const today = todayISO();
  const weekStart: WeekStart = settings?.weekStart ?? "sat";
  const currency = settings?.currency ?? "ر.س";

  // ---------- مشتقات ----------
  const byHabit = useMemo(() => {
    const m = new Map<string, HabitLog[]>();
    for (const l of logs ?? []) {
      const arr = m.get(l.habitId);
      if (arr) arr.push(l);
      else m.set(l.habitId, [l]);
    }
    return m;
  }, [logs]);

  const active = useMemo(
    () =>
      (habits ?? [])
        .filter((h) => !h.archived)
        .sort((a, b) => a.order - b.order || a.createdAt.localeCompare(b.createdAt)),
    [habits],
  );
  const archived = useMemo(() => (habits ?? []).filter((h) => h.archived), [habits]);

  const weekStartIso = useMemo(() => startOfWeekISO(today, weekStart), [today, weekStart]);

  interface HabitRow {
    habit: Habit;
    logs: HabitLog[];
    countToday: number;
    minutesToday: number;
    doneToday: boolean;
    streak: number;
    weekHits: number;
    last7: Array<{ date: string; count: number }>;
  }

  const rows = useMemo<HabitRow[]>(
    () =>
      active.map((h) => {
        const hlogs = byHabit.get(h.id) ?? [];
        const target = Math.max(1, h.target);
        const todayLog = hlogs.find((l) => l.date === today);
        const countToday = todayLog?.count ?? 0;
        return {
          habit: h,
          logs: hlogs,
          countToday,
          minutesToday: todayLog?.minutes ?? 0,
          doneToday: countToday >= target,
          streak: h.cadence === "daily" ? habitStreak(hlogs, today, target) : 0,
          weekHits: hlogs.filter((l) => l.date >= weekStartIso && l.date <= today && l.count >= target).length,
          last7: Array.from({ length: 7 }, (_, i) => addDaysISO(today, i - 6)).map((d) => ({
            date: d,
            count: hlogs.find((l) => l.date === d)?.count ?? 0,
          })),
        };
      }),
    [active, byHabit, today, weekStartIso],
  );

  const doneCount = rows.filter((r) => r.doneToday).length;
  const allDone = rows.length > 0 && doneCount === rows.length;
  const bestRow = rows.reduce<HabitRow | null>((acc, r) => (r.streak > (acc?.streak ?? 0) ? r : acc), null);

  const weekStats = useMemo(() => {
    const daysSoFar = diffDays(weekStartIso, today) + 1;
    let expected = 0;
    let hits = 0;
    for (const h of active) {
      const target = Math.max(1, h.target);
      const hlogs = byHabit.get(h.id) ?? [];
      hits += hlogs.filter((l) => l.date >= weekStartIso && l.date <= today && l.count >= target).length;
      expected += h.cadence === "daily" ? daysSoFar : Math.min(h.daysPerWeek ?? 1, daysSoFar);
    }
    return { expected, hits, pct: expected > 0 ? Math.round((hits / expected) * 100) : 0 };
  }, [active, byHabit, today, weekStartIso]);

  const heatDays = useMemo(
    () => Array.from({ length: 30 }, (_, i) => addDaysISO(today, i - 29)),
    [today],
  );
  const countsByHabit = useMemo(() => {
    const m = new Map<string, Map<string, number>>();
    for (const r of rows) {
      const cm = new Map<string, number>();
      for (const l of r.logs) if (l.count > 0) cm.set(l.date, l.count);
      m.set(r.habit.id, cm);
    }
    return m;
  }, [rows]);

  const timerHabit = timerHabitId ? (habits ?? []).find((h) => h.id === timerHabitId) ?? null : null;

  // ---------- إجراءات ----------
  const celebrate = (h: Habit, res: { done: boolean } | null) => {
    if (res?.done && !(h.saveAmount && h.goalId)) {
      toast.success(`اكتملت «${h.name}» اليوم 🎉`);
    }
  };

  const toggleHabit = async (h: Habit) => {
    celebrate(h, await logHabit(h.id));
  };

  const bumpOne = async (h: Habit, countToday: number) => {
    celebrate(h, await logHabit(h.id, countToday + 1));
  };

  const openForm = (h: Habit | null, withTemplates = false) => {
    setFormHabit(h);
    setFormTemplates(withTemplates);
    setFormOpen(true);
  };

  // ---------- الهيكل ----------
  if (!habits || !settings) {
    return (
      <div
        className="h-full overflow-y-auto sys-scroll px-4 pt-3 pb-28"
        aria-busy="true"
        aria-label="جارٍ تحميل العادات"
      >
        <div className="glass-soft mb-3 h-14 animate-pulse rounded-3xl" />
        <div className="glass-soft mb-3 h-24 animate-pulse rounded-3xl" />
        <div className="glass-soft mb-3 h-44 animate-pulse rounded-3xl" />
        <div className="glass-soft h-44 animate-pulse rounded-3xl" />
      </div>
    );
  }

  return (
    <div className="h-full overflow-y-auto sys-scroll px-4 pt-3 pb-28">
      {/* ═══ الترويسة ═══ */}
      <motion.header {...widgetEnter(0)} className="mb-3 flex items-center justify-between gap-2 px-1">
        <div className="min-w-0">
          <h1 className="text-[22px] font-bold leading-tight">العادات</h1>
          <p className="mt-0.5 flex items-center gap-1 text-[11px] text-muted-foreground">
            {bestRow && bestRow.streak > 0 ? (
              <>
                <Flame className="h-3 w-3 shrink-0 text-gold" aria-hidden="true" />
                <span className="truncate">
                  أطول سلسلة <span className="tabular font-bold text-foreground">{bestRow.streak}</span> يوم —{" "}
                  {bestRow.habit.name}
                </span>
              </>
            ) : rows.length > 0 ? (
              "ابدأ سلسلتك الأولى اليوم"
            ) : (
              "عادات صغيرة، أثر كبير"
            )}
          </p>
        </div>
        <div className="flex shrink-0 items-center gap-2">
          {/* قوالب جاهزة — ٢١ فكرة تعبّئ النموذج فوراً (من Life-os) */}
          <motion.button
            type="button"
            whileTap={{ scale: 0.92 }}
            onClick={() => openForm(null, true)}
            className="flex h-11 items-center gap-1.5 rounded-2xl border border-primary/40 bg-primary/15 px-3 text-[11.5px] font-bold text-primary transition-colors hover:bg-primary/25"
            aria-label="قوالب جاهزة — تصفح ٢١ فكرة عادة"
          >
            <LayoutTemplate className="h-4 w-4" strokeWidth={2.4} aria-hidden="true" />
            قوالب
          </motion.button>
          <motion.button
            type="button"
            whileTap={{ scale: 0.9 }}
            onClick={() => openForm(null)}
            className="flex h-11 w-11 items-center justify-center rounded-2xl border border-primary/40 bg-primary/15 text-primary transition-colors hover:bg-primary/25"
            aria-label="إضافة عادة"
          >
            <Plus className="h-5 w-5" strokeWidth={2.4} aria-hidden="true" />
          </motion.button>
        </div>
      </motion.header>

      {/* ═══ بداية نظيفة ═══ */}
      {habits.length === 0 && (
        <motion.div {...widgetEnter(0.05)}>
          <GlassCard className="p-2">
            <EmptyState
              icon={<Flame className="h-6 w-6" />}
              title="لا عادات بعد"
              hint="عادة واحدة صغيرة تكفي — عدّاد نقرات، جلسة بمؤقت، أو التزام بسيط يبني سلسلتك 🔥"
              actionLabel="أضف عادتك الأولى"
              onAction={() => openForm(null)}
            />
          </GlassCard>
        </motion.div>
      )}

      {habits.length > 0 && active.length === 0 && (
        <motion.div {...widgetEnter(0.05)}>
          <GlassCard className="p-2">
            <EmptyState
              icon={<ArchiveRestore className="h-6 w-6" />}
              title="لا عادات نشطة"
              hint="كل عاداتك مؤرشفة — استعدها أو أضف جديدة"
              actionLabel="عرض المؤرشفة"
              onAction={() => setArchivedOpen(true)}
            />
          </GlassCard>
        </motion.div>
      )}

      {/* ═══ التزام اليوم ═══ */}
      {rows.length > 0 && (
        <motion.div {...widgetEnter(0.05)} className="mb-3">
          <GlassCard className="space-y-3 p-4">
            <div className="flex items-center justify-between">
              <span className="text-[12px] text-muted-foreground">التزام اليوم</span>
              <span className="tabular text-[11.5px] text-muted-foreground">
                <span className="text-[15px] font-bold text-foreground">{doneCount}</span> من{" "}
                <span className="font-bold">{rows.length}</span>
              </span>
            </div>
            <div
              className="h-2 overflow-hidden rounded-full bg-black/[0.04]"
              role="progressbar"
              aria-valuenow={doneCount}
              aria-valuemin={0}
              aria-valuemax={rows.length}
              aria-label={`عادات اليوم المكتملة: ${doneCount} من ${rows.length}`}
            >
              <motion.div
                className="h-full rounded-full bg-primary"
                initial={false}
                animate={{ width: `${(doneCount / rows.length) * 100}%` }}
                transition={{ type: "spring", stiffness: 120, damping: 20 }}
              />
            </div>
            <div className="flex items-center justify-between gap-2">
              <p
                className={cn(
                  "text-[11.5px] font-bold",
                  allDone ? "text-mint" : doneCount === 0 ? "text-primary" : "text-gold"
                )}
              >
                {allDone ? "يوم مثالي! 🎉" : doneCount === 0 ? "ابدأ بواحدة الآن" : "بقي القليل — أنت قريب"}
              </p>
              <div className="flex flex-wrap items-center gap-1.5" aria-hidden="true">
                {rows.map((r) => (
                  <span
                    key={r.habit.id}
                    className="h-2 w-2 rounded-full transition-opacity"
                    style={{ backgroundColor: r.habit.color, opacity: r.doneToday ? 1 : 0.3 }}
                  />
                ))}
              </div>
            </div>
          </GlassCard>
        </motion.div>
      )}

      {/* ═══ بطاقات العادات ═══ */}
      {rows.length > 0 && (
        <div className="mb-3 space-y-3">
          {rows.map((r, idx) => (
            <HabitCard
              key={r.habit.id}
              row={r}
              delay={0.08 + idx * 0.04}
              onToggle={() => void toggleHabit(r.habit)}
              onBumpOne={() => void bumpOne(r.habit, r.countToday)}
              onEdit={() => openForm(r.habit)}
              onArchiveToggle={() =>
                void updateHabit(r.habit.id, { archived: !r.habit.archived })
              }
              onDelete={() => setDeleting(r.habit)}
              onStartTimer={() => setTimerHabitId(r.habit.id)}
            />
          ))}
        </div>
      )}

      {/* ═══ الإحصاءات ═══ */}
      {rows.length > 0 && (
        <motion.div {...widgetEnter(0.14)} className="mb-3">
          <GlassCard className="overflow-hidden">
            <button
              type="button"
              onClick={() => setStatsOpen((o) => !o)}
              aria-expanded={statsOpen}
              aria-controls="habits-stats"
              className="flex w-full items-center justify-between gap-2 px-4 py-3.5 transition-colors hover:bg-black/[0.02]"
            >
              <span className="flex items-center gap-2 text-[13px] font-semibold">
                <TrendingUp className="h-4 w-4 shrink-0 text-primary" aria-hidden="true" />
                الإحصاءات
              </span>
              <span className="flex shrink-0 items-center gap-2">
                <span className="tabular text-[10px] text-muted-foreground">
                  {rows.length} عادات · الأسبوع {weekStats.pct}%
                </span>
                <ChevronDown
                  className={cn(
                    "h-4 w-4 text-muted-foreground transition-transform duration-200",
                    statsOpen && "rotate-180"
                  )}
                  aria-hidden="true"
                />
              </span>
            </button>
            {statsOpen && (
              <div id="habits-stats" className="space-y-4 border-t border-black/[0.05] px-4 pb-4 pt-3">
                <div className="grid grid-cols-3 gap-2">
                  <StatTile icon={<Target className="h-4 w-4" />} value={rows.length} label="عادات نشطة" />
                  <StatTile icon={<Flame className="h-4 w-4" />} value={bestRow?.streak ?? 0} label="أفضل سلسلة" />
                  <StatTile
                    icon={<CalendarCheck2 className="h-4 w-4" />}
                    value={`${weekStats.pct}%`}
                    label="إنجاز الأسبوع"
                  />
                </div>

                <div className="space-y-2.5">
                  <p className="text-[11px] text-muted-foreground">آخر 30 يوماً — كثافة الإنجاز</p>
                  {rows.map((r) => (
                    <HeatRow
                      key={r.habit.id}
                      habit={r.habit}
                      target={Math.max(1, r.habit.target)}
                      counts={countsByHabit.get(r.habit.id) ?? new Map<string, number>()}
                      days={heatDays}
                    />
                  ))}
                  <div className="flex items-center justify-center gap-4 pt-1 text-[9.5px] text-muted-foreground/80">
                    <span className="flex items-center gap-1.5">
                      <span className="h-2.5 w-2.5 rounded-[3px] bg-primary" aria-hidden="true" /> اكتمل
                    </span>
                    <span className="flex items-center gap-1.5">
                      <span className="h-2.5 w-2.5 rounded-[3px] bg-primary/40" aria-hidden="true" /> جزئي
                    </span>
                    <span className="flex items-center gap-1.5">
                      <span className="h-2.5 w-2.5 rounded-[3px] bg-black/[0.05]" aria-hidden="true" /> بدون
                    </span>
                  </div>
                </div>
              </div>
            )}
          </GlassCard>
        </motion.div>
      )}

      {/* ═══ المؤرشفة ═══ */}
      {archived.length > 0 && (
        <motion.div {...widgetEnter(0.18)}>
          <GlassCard className="overflow-hidden">
            <button
              type="button"
              onClick={() => setArchivedOpen((o) => !o)}
              aria-expanded={archivedOpen}
              aria-controls="habits-archived"
              className="flex w-full items-center justify-between gap-2 px-4 py-3.5 transition-colors hover:bg-black/[0.02]"
            >
              <span className="flex items-center gap-2 text-[13px] font-semibold text-foreground/80">
                <Archive className="h-4 w-4 shrink-0 text-muted-foreground" aria-hidden="true" />
                المؤرشفة
                <span className="tabular text-[10px] text-muted-foreground">({archived.length})</span>
              </span>
              <ChevronDown
                className={cn(
                  "h-4 w-4 text-muted-foreground transition-transform duration-200",
                  archivedOpen && "rotate-180"
                )}
                aria-hidden="true"
              />
            </button>
            {archivedOpen && (
              <div id="habits-archived" className="sys-scroll max-h-72 space-y-2 overflow-y-auto border-t border-black/[0.05] p-3">
                {archived.map((h) => {
                  const Icon = iconByName(h.icon.toLowerCase());
                  return (
                    <div
                      key={h.id}
                      className="flex items-center gap-2.5 rounded-xl glass-soft border border-black/[0.05] p-2.5"
                    >
                      <span
                        className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl opacity-60"
                        style={{
                          background: `${h.color}1a`,
                          border: `1px solid ${h.color}33`,
                          color: h.color,
                        }}
                      >
                        <Icon className="h-5 w-5" aria-hidden="true" />
                      </span>
                      <div className="min-w-0 flex-1">
                        <p className="truncate text-[13px] font-bold">{h.name}</p>
                        <p className="text-[9.5px] text-muted-foreground">مؤرشف</p>
                      </div>
                      <button
                        type="button"
                        onClick={() => void updateHabit(h.id, { archived: false })}
                        className="flex h-11 shrink-0 items-center gap-1.5 rounded-xl border border-primary/40 bg-primary/15 px-3 text-[11.5px] font-bold text-primary transition-colors hover:bg-primary/25"
                        aria-label={`استعادة «${h.name}»`}
                      >
                        <ArchiveRestore className="h-4 w-4" aria-hidden="true" />
                        <span className="hidden sm:inline">استعادة</span>
                      </button>
                      <button
                        type="button"
                        onClick={() => setDeleting(h)}
                        className="flex h-11 w-11 shrink-0 items-center justify-center rounded-xl glass-soft border border-black/[0.05] text-muted-foreground transition-colors hover:text-coral"
                        aria-label={`حذف «${h.name}»`}
                      >
                        <Trash2 className="h-4 w-4" aria-hidden="true" />
                      </button>
                    </div>
                  );
                })}
              </div>
            )}
          </GlassCard>
        </motion.div>
      )}

      {/* ═══ الحوارات والطبقات ═══ */}
      <HabitFormDialog
        open={formOpen}
        onOpenChange={setFormOpen}
        habit={formHabit}
        goals={goals ?? []}
        nextOrder={habits.length + 1}
        digits={settings.digits}
        currency={currency}
        templatesAutoOpen={formTemplates}
      />

      <HabitTimer habit={timerHabit} onClose={() => setTimerHabitId(null)} />

      <Dialog open={deleting !== null} onOpenChange={(o) => !o && setDeleting(null)}>
        <DialogContent
          dir="rtl"
          className="mx-auto max-w-sm rounded-3xl border-black/[0.08] bg-white/95 p-5 backdrop-blur-xl shadow-[0_24px_60px_-20px_rgba(23,33,43,0.35)]"
        >
          <DialogHeader className="text-right">
            <DialogTitle className="text-right text-[15px]">حذف العادة؟</DialogTitle>
          </DialogHeader>
          {deleting && (
            <ConfirmBar
              message={`سيُحذف «${deleting.name}» نهائياً مع سجلها بالكامل — لا يمكن التراجع.`}
              confirmLabel="حذف نهائي"
              onConfirm={() => {
                void deleteHabit(deleting.id);
                setDeleting(null);
              }}
              onCancel={() => setDeleting(null)}
            />
          )}
        </DialogContent>
      </Dialog>
    </div>
  );
}

// ------------------------------------------------------------
// بطاقة عادة واحدة
// ------------------------------------------------------------

interface HabitCardProps {
  row: {
    habit: Habit;
    countToday: number;
    minutesToday: number;
    doneToday: boolean;
    streak: number;
    weekHits: number;
    last7: Array<{ date: string; count: number }>;
  };
  delay: number;
  onToggle: () => void;
  onBumpOne: () => void;
  onEdit: () => void;
  onArchiveToggle: () => void;
  onDelete: () => void;
  onStartTimer: () => void;
}

function HabitCard({
  row,
  delay,
  onToggle,
  onBumpOne,
  onEdit,
  onArchiveToggle,
  onDelete,
  onStartTimer,
}: HabitCardProps) {
  const { habit: h, countToday, minutesToday, doneToday, streak, weekHits, last7 } = row;
  const target = Math.max(1, h.target);
  const weekly = h.cadence === "weekly";
  const weekGoal = h.daysPerWeek ?? 1;
  const pct = Math.min(100, (countToday / target) * 100);
  const unit = h.unit || "مرة";
  const showBump = target > 1 && !doneToday;
  const showTimer = h.timerMinutes != null;

  return (
    <motion.div {...widgetEnter(delay)}>
      <GlassCard
        onClick={onToggle}
        className="cursor-pointer space-y-3 p-4 transition-transform duration-200 hover:scale-[1.01] active:scale-[0.99]"
      >
        {/* الرأس */}
        <div className="flex items-start gap-3">
          <span className="relative shrink-0">
            <span
              className="flex h-12 w-12 items-center justify-center rounded-2xl"
              style={{
                background: `${h.color}1f`,
                border: `1px solid ${h.color}44`,
                color: doneToday ? "#6EE7A8" : h.color,
              }}
            >
              <HabitGlyph name={h.icon} className="h-6 w-6" />
            </span>
            <AnimatePresence>
              {doneToday && (
                <motion.span
                  initial={{ scale: 0 }}
                  animate={{ scale: 1 }}
                  exit={{ scale: 0 }}
                  transition={{ type: "spring", stiffness: 500, damping: 25 }}
                  className="absolute -bottom-1 -start-1 flex h-4 w-4 items-center justify-center rounded-full border-2 border-[#0B0F1A] bg-mint text-[#06281f]"
                  aria-hidden="true"
                >
                  <Check className="h-2.5 w-2.5" strokeWidth={3.5} />
                </motion.span>
              )}
            </AnimatePresence>
          </span>

          <div className="min-w-0 flex-1 space-y-1">
            <div className="flex flex-wrap items-center gap-1.5">
              <p className="text-[14px] font-bold leading-tight break-words">{h.name}</p>
              {doneToday && (
                <span className="rounded-full bg-mint/15 px-2 py-0.5 text-[9.5px] font-bold text-mint">
                  أُنجزت اليوم
                </span>
              )}
              {weekly && (
                <span className="tabular rounded-full glass-soft px-2 py-0.5 text-[9.5px] font-bold text-muted-foreground">
                  {weekHits} من {weekGoal} أسبوعياً
                </span>
              )}
            </div>
            <div className="flex flex-wrap items-center gap-1.5 text-[9.5px]">
              {!weekly && streak > 0 && (
                <span
                  className="tabular inline-flex items-center gap-1 rounded-full bg-gold/10 px-2 py-0.5 font-bold text-gold"
                  title={`سلسلة ${streak} يوم متتالٍ`}
                >
                  <Flame className="h-3 w-3" aria-hidden="true" />
                  {streak} يوم
                </span>
              )}
              {target > 1 && (
                <span className="tabular rounded-full glass-soft px-2 py-0.5 font-bold text-muted-foreground">
                  {target} {unit}/يوم
                </span>
              )}
              {h.timerMinutes != null && (
                <span className="tabular inline-flex items-center gap-1 rounded-full glass-soft px-2 py-0.5 font-bold text-muted-foreground">
                  <Timer className="h-3 w-3" aria-hidden="true" />
                  {h.timerMinutes} د
                </span>
              )}
              {h.remindAt && (
                <span className="tabular inline-flex items-center gap-1 rounded-full glass-soft px-2 py-0.5 font-bold text-muted-foreground">
                  <Bell className="h-3 w-3" aria-hidden="true" />
                  {formatTimeAr(h.remindAt)}
                </span>
              )}
              {h.saveAmount && h.goalId && (
                <span className="tabular inline-flex items-center gap-1 rounded-full bg-gold/10 px-2 py-0.5 font-bold text-gold">
                  +{formatMoney(h.saveAmount)} للهدف
                </span>
              )}
            </div>
          </div>

          <DropdownMenu>
            <DropdownMenuTrigger asChild>
              <button
                type="button"
                onClick={(e) => e.stopPropagation()}
                aria-label={`خيارات ${h.name}`}
                className="flex h-9 w-9 shrink-0 items-center justify-center rounded-xl glass-soft border border-black/[0.05] text-muted-foreground transition-colors hover:text-foreground"
              >
                <MoreVertical className="h-4 w-4" aria-hidden="true" />
              </button>
            </DropdownMenuTrigger>
            <DropdownMenuContent align="end" className="rounded-xl border-black/[0.08] bg-white">
              <DropdownMenuItem onClick={(e) => { e.stopPropagation(); onEdit(); }} className="text-[13px]">
                <Pencil aria-hidden="true" /> تعديل
              </DropdownMenuItem>
              <DropdownMenuItem onClick={(e) => { e.stopPropagation(); onArchiveToggle(); }} className="text-[13px]">
                <Archive aria-hidden="true" /> أرشفة
              </DropdownMenuItem>
              <DropdownMenuItem
                onClick={(e) => { e.stopPropagation(); onDelete(); }}
                variant="destructive"
                className="text-[13px]"
              >
                <Trash2 aria-hidden="true" /> حذف
              </DropdownMenuItem>
            </DropdownMenuContent>
          </DropdownMenu>
        </div>

        {/* نقاط آخر 7 أيام */}
        <div className="flex items-start justify-between px-0.5">
          {last7.map(({ date, count }) => {
            const full = count >= target;
            const partial = !full && count > 0;
            const isToday = date === last7[6].date;
            return (
              <span key={date} className="flex flex-col items-center gap-1" title={`${date}: ${count}/${target}`}>
                <span
                  className={cn("h-2 w-2 rounded-full transition-all", isToday && "ring-1 ring-inset ring-white/30")}
                  style={
                    full
                      ? { backgroundColor: h.color }
                      : partial
                        ? { backgroundColor: h.color, opacity: 0.4 }
                        : { backgroundColor: "rgba(255,255,255,0.09)" }
                  }
                  aria-hidden="true"
                />
                <span className="text-[8px] leading-none text-muted-foreground/60">
                  {DAY_LETTERS[fromISODate(date).getDay()]}
                </span>
              </span>
            );
          })}
        </div>

        {/* تقدم اليوم */}
        <div className="space-y-1.5">
          <div className="tabular flex items-center justify-between text-[11px]">
            <span className="text-muted-foreground">اليوم</span>
            <span>
              <span className="font-bold">{countToday}</span>
              <span className="text-muted-foreground"> / {target} {unit}</span>
            </span>
          </div>
          <div
            className="h-1.5 overflow-hidden rounded-full bg-black/[0.04]"
            role="progressbar"
            aria-valuenow={countToday}
            aria-valuemin={0}
            aria-valuemax={target}
            aria-label={`تقدم اليوم: ${countToday} من ${target}`}
          >
            <div
              className="h-full rounded-full transition-all duration-300"
              style={{ width: `${pct}%`, backgroundColor: doneToday ? "#6EE7A8" : h.color }}
            />
          </div>
        </div>

        {/* أزرار: +1 للعدّادات، وتشغيل المؤقت */}
        {(showBump || showTimer) && (
          <div className="flex gap-2">
            {showBump && (
              <motion.button
                type="button"
                whileTap={{ scale: 0.96 }}
                onClick={(e) => {
                  e.stopPropagation();
                  onBumpOne();
                }}
                className="h-11 flex-1 rounded-xl border text-[12px] font-bold transition-colors"
                style={{ borderColor: `${h.color}44`, background: `${h.color}14`, color: h.color }}
                aria-label={`إضافة ${unit} واحدة إلى «${h.name}»`}
              >
                +1 {unit}
              </motion.button>
            )}
            {showTimer && (
              <motion.button
                type="button"
                whileTap={{ scale: 0.96 }}
                onClick={(e) => {
                  e.stopPropagation();
                  onStartTimer();
                }}
                className="flex h-11 flex-1 items-center justify-center gap-1.5 rounded-xl glass-soft border border-black/[0.07] text-[12px] font-bold text-foreground/90 transition-colors hover:bg-black/[0.04]"
                aria-label={`بدء مؤقت «${h.name}»`}
              >
                <Play className="h-4 w-4 shrink-0" style={{ color: h.color }} aria-hidden="true" />
                <span className="tabular">مؤقت {h.timerMinutes} د</span>
                {minutesToday > 0 && (
                  <span className="tabular text-[10px] text-muted-foreground">
                    · {minutesToday} د اليوم
                  </span>
                )}
              </motion.button>
            )}
          </div>
        )}
      </GlassCard>
    </motion.div>
  );
}

// ------------------------------------------------------------
// إحصاءات صغيرة
// ------------------------------------------------------------

function StatTile({ icon, value, label }: { icon: ReactNode; value: string | number; label: string }) {
  return (
    <div className="flex flex-col items-center gap-0.5 rounded-xl glass-soft p-2.5">
      <span className="text-primary" aria-hidden="true">
        {icon}
      </span>
      <p className="num-display tabular text-[16px] leading-tight">{value}</p>
      <p className="text-[9.5px] leading-tight text-muted-foreground">{label}</p>
    </div>
  );
}

/** صف خريطة حرارية لعادة واحدة — 30 مربعاً بكثافة ذهبية حسب count/target */
function HeatRow({
  habit,
  target,
  counts,
  days,
}: {
  habit: Habit;
  target: number;
  counts: Map<string, number>;
  days: string[];
}) {
  return (
    <div className="flex items-center gap-2">
      <HabitGlyph name={habit.icon} className="h-3.5 w-3.5 shrink-0" style={{ color: habit.color }} />
      <span className="w-[68px] shrink-0 truncate text-[10.5px] text-foreground/80">{habit.name}</span>
      <div className="grid flex-1 grid-cols-[repeat(15,minmax(0,1fr))] gap-[3px]">
        {days.map((d) => {
          const c = counts.get(d) ?? 0;
          const alpha = c >= target ? 1 : c > 0 ? 0.3 + 0.4 * (c / target) : 0;
          return (
            <span
              key={d}
              title={`${d}: ${c}/${target}`}
              className="aspect-square rounded-[3px]"
              style={
                alpha > 0
                  ? { backgroundColor: `rgba(245,185,92,${alpha.toFixed(2)})` }
                  : { backgroundColor: "rgba(255,255,255,0.05)" }
              }
              aria-hidden="true"
            />
          );
        })}
      </div>
    </div>
  );
}
