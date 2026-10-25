"use client";

/**
 * شاشة «اليوم» 5.1 — لوحة قيادة شخصية مختصرة، يفهم المستخدم يومه من أول نظرة.
 * الأوزان البصرية متدرجة عمداً (لا وزن متساوٍ لكل العناصر):
 *   1) تحية قصيرة (سطر — ليست بطاقة)
 *   2) بطاقة رئيسية واحدة: أهم شيء الآن / الإجراء التالي
 *   3) ملخص مالي يومي: المتبقي الآمن للصرف + مصدر الرقم بوضوح
 *   4) أهم 3 مهام بإتمام سريع
 *   5) عادات اليوم بحلقات تقدم مريحة
 *   6) شريط أسبوعي للمواعيد القريبة يفتح التقويم
 *   7) توازن/صحة مختصر عند توفر البيانات
 *   8) ذكرى/آخر ملاحظة عند وجود بيانات حقيقية فقط
 * كل المنطق v5 كما هو (useLive/الأفعال/التنقل) — إعادة تصميم بصري وبنيوي فقط.
 */
import { useEffect, useState } from "react";
import { motion } from "framer-motion";
import {
  Flame, Zap, Check, Sparkles,
  NotebookPen, ChevronLeft, CalendarDays, Droplets,
} from "lucide-react";
import { toast } from "sonner";
import { db, getSettings, useLive } from "@/lib/db";
import { logHabit, saveMood, toggleTask } from "@/lib/actions";
import { safeToSpend, budgetPacing } from "@/lib/money";
import type { Habit, HabitLog, Note, Task, TimeBlock } from "@/lib/types";
import { habitStreak } from "@/lib/types";
import {
  formatMoney, formatNumber, MOOD_FACES, smartGreeting, timeAgo, todayISO, diffDays, dayNameShort, weekDays,
} from "@/lib/format";
import { useUIStore } from "@/store/ui-store";
import { GlassCard, SectionHeader, Chip, PrivateAmount, widgetEnter } from "../glass";
import { CountUp } from "../count-up";
import { iconByName } from "../ui-bits";
import { SysMark } from "../logo";
import { cn } from "@/lib/utils";

/** ضغط 5.1 — 0.96 بالضبط، انتقالات محددة الخصائص (ممنوع transition:all) */
const press =
  "transition-[transform,color,background-color,border-color] duration-150 ease-out active:scale-[0.96]";

export function TodayScreen() {
  const { openQuickAdd, setView, goToMoney, goToCalendar } = useUIStore();

  const data = useLive(async () => {
    const [settings, txs, habits, habitLogs, tasks, notes, moods, accounts, recurrings, goals, categories, blocks, healthLogs] = await Promise.all([
      getSettings(),
      db.transactions.toArray(),
      db.habits.toArray(),
      db.habitLogs.toArray(),
      db.tasks.toArray(),
      db.notes.toArray(),
      db.moods.toArray(),
      db.accounts.toArray(),
      db.recurrings.toArray(),
      db.goals.toArray(),
      db.categories.toArray(),
      db.blocks.toArray(),
      db.healthLogs.toArray(),
    ]);
    return { settings, txs, habits, habitLogs, tasks, notes, moods, accounts, recurrings, goals, categories, blocks, healthLogs };
  }, []);

  if (!data) return <TodaySkeleton />;
  const { settings, txs, habits, habitLogs, tasks, notes, moods, accounts, recurrings, goals, categories, blocks, healthLogs } = data;

  const today = todayISO();
  const greeting = smartGreeting(settings.displayName);
  const safe = safeToSpend(settings, txs, recurrings, goals, today);
  const pacing = budgetPacing(settings, categories, txs, today);

  const activeHabits = habits.filter((h) => !h.archived).sort((a, b) => a.order - b.order);
  const todayHabitLogs = habitLogs.filter((l) => l.date === today);
  const todayTxs = txs.filter((t) => t.date.slice(0, 10) === today);
  const todayTasks = tasks.filter((t) => t.date === today).sort((a, b) => Number(a.done) - Number(b.done));
  const todayMood = moods.find((m) => m.date === today) ?? null;
  const todayHealth = healthLogs.filter((l) => l.date === today);

  const statusMeta =
    safe.status === "great"
      ? { label: "يوم مريح", cls: "text-gold", dot: "bg-gold" }
      : safe.status === "careful"
        ? { label: "يوم حذر — خذ راحة", cls: "text-coral", dot: "bg-coral" }
        : { label: "متوازن", cls: "text-mint", dot: "bg-mint" };

  // حالة ميزانية الصرف (لو حُددت) — مطابقة لِ BP_META في شاشة المال
  const bpMeta =
    pacing.status === "great"
      ? { label: "يوم مريح", cls: "text-mint", dot: "bg-mint" }
      : pacing.status === "good"
        ? { label: "على المسار", cls: "text-foreground/80", dot: "ribbon" }
        : pacing.status === "careful"
          ? { label: "خلف الوتيرة", cls: "text-gold", dot: "bg-gold" }
          : { label: "تجاوزت الشهري", cls: "text-coral", dot: "bg-coral" };

  // شريط اليوم: صُرف اليوم مقابل حصة اليوم
  const dayRatio = pacing.perDay > 0 ? pacing.spentToday / pacing.perDay : pacing.spentToday > 0 ? 1.2 : 0;
  const dayBarFill = dayRatio > 1 ? "var(--coral)" : "var(--grad-ribbon)";

  // الإجراء التالي الأفضل — نص بطاقة «الآن» الرئيسية
  const pendingHabits = activeHabits.filter((h) => {
    const log = todayHabitLogs.find((l) => l.habitId === h.id);
    return !log || log.count < h.target;
  }).length;
  const overdueTasks = tasks.filter((t) => !t.done && t.date < today).length;
  const nextAction =
    overdueTasks > 0
      ? { text: `${formatNumber(overdueTasks)} ${overdueTasks === 1 ? "مهمة متأخرة تنتظرك" : "مهام متأخرة تنتظرك"} — أنجز واحدة صغيرة الآن`, view: "today" as const, cta: "افتح المهام" }
      : todayTasks.some((t) => !t.done)
        ? { text: "لديك مهام اليوم — أنجز أصغرها أولاً", view: "today" as const, cta: "المهام" }
        : pendingHabits > 0
          ? { text: `${formatNumber(pendingHabits)} ${pendingHabits === 1 ? "عادة تنتظرك" : "عادات تنتظرك"} قبل نهاية اليوم`, view: "habits" as const, cta: "العادات" }
          : todayTxs.length === 0
            ? { text: "لم تسجل شيئاً اليوم — أول إدخال يستغرق 3 ثوانٍ", view: null, cta: "سجّل الآن" }
            : { text: "يومك منظم — لا شيء يحتاج انتباهك الآن", view: null, cta: null };

  // ذكرى «قبل سنة»
  const memory = notes.find((n) => {
    if (n.type !== "journal") return false;
    const d = diffDays(n.date, today);
    return Math.abs(d - 365) <= 3;
  });
  const lastNote = [...notes].sort((a, b) => (b.pinned ? 1 : 0) - (a.pinned ? 1 : 0) || b.date.localeCompare(a.date))[0];

  return (
    <div className="h-full overflow-y-auto sys-scroll px-4 pt-2 pb-32">
      {/* التحية — سطر قصير لا بطاقة */}
      <motion.div {...widgetEnter(0)} className="mb-3.5 px-1">
        <h2 className="text-[19px] font-bold leading-tight">{greeting.text}</h2>
      </motion.div>

      {/* ═══ البطاقة الرئيسية — أهم شيء الآن ═══ */}
      <motion.div {...widgetEnter(0.03)}>
        <GlassCard
          interactive
          onClick={() => {
            if (nextAction.view) setView(nextAction.view);
            else openQuickAdd();
          }}
          className="ribbon-frame p-4"
        >
          <div className="flex items-center gap-3.5">
            <span className="w-11 h-11 rounded-2xl bg-primary/12 border border-primary/25 flex items-center justify-center text-gold shrink-0">
              <Zap className="w-[19px] h-[19px]" strokeWidth={2.2} />
            </span>
            <div className="min-w-0 flex-1">
              <div className="text-[10px] text-gold font-bold mb-0.5 tracking-wide">الآن</div>
              <p className="text-[13px] leading-[1.65] font-medium text-foreground/90">{nextAction.text}</p>
            </div>
            {nextAction.cta && (
              <span className="shrink-0 w-8 h-8 rounded-full bg-primary/12 border border-primary/25 flex items-center justify-center text-gold">
                <ChevronLeft className="w-4 h-4" strokeWidth={2.4} aria-hidden="true" />
              </span>
            )}
          </div>
        </GlassCard>
      </motion.div>

      {/* ═══ الملخص المالي اليومي ═══ */}
      <motion.div {...widgetEnter(0.07)} className="mt-3">
        {pacing.status !== "unset" ? (
          <GlassCard className="p-5">
            <div className="flex items-center justify-between">
              <span className="text-[12px] text-muted-foreground">ميزانية الصرف — متبقي اليوم</span>
              <span className={cn("flex items-center gap-1.5 text-[11px] font-medium", bpMeta.cls)}>
                <span className={cn("w-1.5 h-1.5 rounded-full", bpMeta.dot)} />
                {bpMeta.label}
              </span>
            </div>
            <div className="mt-2.5 flex items-baseline gap-2">
              <PrivateAmount
                className={cn(
                  "num-display text-[40px] leading-none",
                  pacing.todayRemaining < 0 ? "text-coral" : "text-foreground"
                )}
              >
                <CountUp value={pacing.todayRemaining} className="inherit" />
              </PrivateAmount>
              <span className="text-[13px] text-muted-foreground">{settings.currency}</span>
            </div>
            {pacing.todayRemaining < 0 && (
              <p className="mt-2 text-[11px] text-coral">
                تجاوزت حصة اليوم بـ{" "}
                <PrivateAmount className="font-semibold">{formatMoney(-pacing.todayRemaining, settings.currency)}</PrivateAmount>
              </p>
            )}
            <p className="mt-2 text-[11px] text-muted-foreground">
              حصة اليوم <PrivateAmount>{formatMoney(pacing.perDay, settings.currency)}</PrivateAmount>
              {" · "}صُرف اليوم <PrivateAmount>{formatMoney(pacing.spentToday, settings.currency)}</PrivateAmount>
            </p>
            <div
              className="h-1.5 rounded-full bg-black/[0.06] mt-3 overflow-hidden"
              role="progressbar"
              aria-label="صرف اليوم مقابل حصة اليوم"
              aria-valuenow={Math.round(Math.min(100, dayRatio * 100))}
              aria-valuemin={0}
              aria-valuemax={100}
            >
              <div
                className="h-full rounded-full"
                style={{ width: `${Math.min(100, dayRatio * 100)}%`, background: dayBarFill }}
              />
            </div>
            <div className="mt-3 pt-3 border-t border-black/[0.06] flex items-center justify-between gap-2">
              <div className="flex items-center gap-2 min-w-0">
                <Chip className={cn("shrink-0", pacing.weekRemaining < 0 && "text-coral")}>
                  الأسبوع{" "}
                  <PrivateAmount className="font-semibold">{formatMoney(pacing.weekRemaining, settings.currency)}</PrivateAmount>
                </Chip>
                <Chip className={cn("shrink-0", pacing.monthRemaining < 0 && "text-coral")}>
                  الشهر{" "}
                  <PrivateAmount className="font-semibold">{formatMoney(pacing.monthRemaining, settings.currency)}</PrivateAmount>
                </Chip>
              </div>
              <button
                type="button"
                onClick={() => goToMoney("budget")}
                aria-label="فتح تبويب الميزانية"
                className={cn(
                  "min-h-11 px-3 rounded-xl flex items-center gap-1 text-[11.5px] font-semibold text-gold hover:bg-primary/10 shrink-0",
                  press
                )}
              >
                الميزانية
                <ChevronLeft className="w-4 h-4" aria-hidden="true" />
              </button>
            </div>
          </GlassCard>
        ) : (
          <GlassCard className="p-5">
            <div className="flex items-center justify-between">
              <span className="text-[12px] text-muted-foreground">الآمن صرفه يومياً</span>
              <span className={cn("flex items-center gap-1.5 text-[11px] font-medium", statusMeta.cls)}>
                <span className={cn("w-1.5 h-1.5 rounded-full", statusMeta.dot)} />
                {statusMeta.label}
              </span>
            </div>
            <div className="mt-2.5 flex items-baseline gap-2">
              <PrivateAmount className="num-display text-[40px] leading-none text-foreground">
                <CountUp value={safe.amount} className="inherit" />
              </PrivateAmount>
              <span className="text-[13px] text-muted-foreground">{settings.currency}</span>
            </div>
            {/* مصدر الرقم — سطر واحد مفهوم */}
            <p className="mt-2 text-[11px] text-muted-foreground">
              حتى نهاية الشهر المالي · <span className="tabular">{formatNumber(safe.daysLeft)}</span> يوماً متبقياً
            </p>
            <div className="mt-3 pt-3 border-t border-black/[0.06] flex items-center flex-wrap justify-center gap-x-1.5 gap-y-1 text-[10px] text-muted-foreground tabular">
              <span>دخل {formatMoney(safe.expectedIncome, settings.currency)}</span>
              <span className="opacity-40">−</span>
              <span>التزامات {formatMoney(safe.commitments, settings.currency)}</span>
              <span className="opacity-40">−</span>
              <span>أهداف {formatMoney(safe.goalContributions, settings.currency)}</span>
              <span className="opacity-40">−</span>
              <span>مصروف {formatMoney(safe.spent, settings.currency)}</span>
            </div>
            <button
              type="button"
              onClick={() => goToMoney("budget")}
              aria-label="تحديد ميزانية الصرف الشهرية — يفتح تبويب الميزانية"
              className={cn(
                "mt-3 w-full min-h-11 rounded-xl bg-primary/12 border border-primary/30 text-gold text-[12px] font-bold flex items-center justify-center gap-1.5 hover:bg-primary/18",
                press
              )}
            >
              حدّد ميزانية صرف شهرية
              <ChevronLeft className="w-4 h-4" aria-hidden="true" />
            </button>
          </GlassCard>
        )}
      </motion.div>

      {/* ═══ أهم 3 مهام ═══ */}
      <motion.section {...widgetEnter(0.11)} className="mt-5">
        <SectionHeader
          title={`مهام اليوم ${todayTasks.length > 0 ? `${todayTasks.filter((t) => t.done).length}/${todayTasks.length}` : ""}`}
          icon={<Check className="w-4 h-4 text-cyan" />}
          action="الكل"
          onAction={() => setView("tasks")}
        />
        <GlassCard className="p-2">
          {todayTasks.length === 0 ? (
            <div className="flex flex-col items-center gap-2.5 py-4">
              <SysMark size={40} className="opacity-70" />
              <span className="text-[12px] text-foreground/80">لا مهام اليوم — يومك لك ✓</span>
              <button
                onClick={() => openQuickAdd("task")}
                className={cn("min-h-11 px-4 rounded-xl bg-primary/12 border border-primary/25 text-gold text-[12px] font-bold", press)}
              >
                أضف أول مهمة
              </button>
            </div>
          ) : (
            <ul className="space-y-0.5">
              {todayTasks.slice(0, 3).map((t) => (
                <TaskRow key={t.id} task={t} />
              ))}
            </ul>
          )}
        </GlassCard>
      </motion.section>

      {/* ═══ عادات اليوم ═══ */}
      <motion.section {...widgetEnter(0.15)} className="mt-5">
        <SectionHeader
          title="عادات اليوم"
          icon={<Flame className="w-4 h-4 text-gold" />}
          action={activeHabits.length > 0 ? "كل العادات" : "أضف عادة"}
          onAction={() => setView("habits")}
        />
        {activeHabits.length === 0 ? (
          <GlassCard className="p-4">
            <button onClick={() => setView("habits")} className={cn("w-full flex flex-col items-center gap-2.5 py-3 min-h-11", press)}>
              <SysMark size={40} className="opacity-70" />
              <span className="text-[12px] text-foreground/80">عادة واحدة صغيرة تغيّر إيقاع يومك</span>
              <span className="text-[11.5px] text-gold font-semibold">أنشئ أول عادة من مكتبة القوالب ←</span>
            </button>
          </GlassCard>
        ) : (
          <div className="flex gap-3 overflow-x-auto no-scrollbar -mx-1 px-1 pt-1 pb-1">
            {activeHabits.slice(0, 8).map((h) => (
              <HabitRing key={h.id} habit={h} logs={habitLogs} />
            ))}
          </div>
        )}
      </motion.section>

      {/* ═══ المواعيد القريبة — شريط أسبوعي يفتح التقويم ═══ */}
      <motion.section {...widgetEnter(0.19)} className="mt-5">
        <SectionHeader
          title="أسبوعك"
          icon={<CalendarDays className="w-4 h-4 text-cyan" />}
          action="التقويم"
          onAction={() => goToCalendar()}
        />
        <WeekStrip blocks={blocks} today={today} onOpen={(d) => goToCalendar(d)} />
      </motion.section>

      {/* ═══ التوازن — مختصر عند توفر بيانات ═══ */}
      {(todayMood || todayHealth.length > 0) && (
        <motion.section {...widgetEnter(0.23)} className="mt-5">
          <SectionHeader title="توازنك" icon={<Sparkles className="w-4 h-4 text-mint" />} />
          <GlassCard className="p-4 flex items-center gap-4">
            <div className="flex-1 min-w-0">
              <div className="text-[11px] text-muted-foreground mb-2">كيف حالك؟</div>
              <MoodPicker current={todayMood?.score ?? null} />
            </div>
            {todayHealth.length > 0 && (
              <button
                type="button"
                onClick={() => setView("health")}
                className={cn("shrink-0 flex items-center gap-2.5 px-3 py-2.5 rounded-2xl glass-soft min-h-11", press)}
                aria-label="فتح شاشة الصحة"
              >
                <Droplets className="w-[18px] h-[18px] text-cyan" />
                <span className="text-start">
                  <span className="block text-[12px] font-bold tabular">{formatNumber(todayHealth.length)}</span>
                  <span className="block text-[9.5px] text-muted-foreground">قياسات اليوم</span>
                </span>
              </button>
            )}
          </GlassCard>
        </motion.section>
      )}

      {/* ═══ ذكرى «في مثل هذا اليوم» — ببيانات حقيقية فقط ═══ */}
      {memory && (
        <motion.section {...widgetEnter(0.25)} className="mt-5">
          <SectionHeader title="في مثل هذا اليوم" icon={<NotebookPen className="w-4 h-4 text-cyan" />} />
          <GlassCard className="p-4 border-cyan/15 bg-cyan/[0.05]">
            <div className="flex items-start gap-3">
              <span className="w-10 h-10 rounded-2xl bg-cyan/10 border border-cyan/25 flex items-center justify-center shrink-0 text-cyan">
                <NotebookPen className="w-[18px] h-[18px]" />
              </span>
              <div className="min-w-0">
                <p className="text-[11px] text-cyan font-medium">قبل سنة تقريباً · {timeAgo(memory.date)}</p>
                <p className="text-[12.5px] leading-[1.8] text-foreground/85 mt-1 line-clamp-3">{memory.content}</p>
              </div>
            </div>
          </GlassCard>
        </motion.section>
      )}

      {/* ═══ آخر ملاحظة ═══ */}
      {!memory && lastNote && (
        <motion.section {...widgetEnter(0.25)} className="mt-5">
          <SectionHeader title="آخر ملاحظة" icon={<NotebookPen className="w-4 h-4 text-cyan" />} action="الدفتر" onAction={() => setView("journal")} />
          <GlassCard interactive onClick={() => setView("journal")} className="p-4">
            <div className="flex items-center justify-between gap-2">
              <span className="text-[13px] font-semibold truncate">{lastNote.title}</span>
              {lastNote.pinned && <Chip className="text-gold border-gold/25">مثبتة</Chip>}
            </div>
            <p className="text-[12px] text-muted-foreground leading-[1.8] mt-1.5 line-clamp-2">{lastNote.content}</p>
          </GlassCard>
        </motion.section>
      )}

      <motion.p {...widgetEnter(0.28)} className="mt-6 mb-1 text-center text-[10px] text-muted-foreground/70 leading-relaxed">
        كل شيء يعمل محلياً على جهازك · {formatNumber(txs.length)} معاملة و{formatNumber(activeHabits.length)} عادة تتحرك معك
      </motion.p>
    </div>
  );
}

/* ═══════════════════════ أدوات فرعية ═══════════════════════ */

/** شريط الأسبوع — 7 أيام بنقاط أحداث، ينفتح على التقويم */
function WeekStrip({ blocks, today, onOpen }: { blocks: TimeBlock[]; today: string; onOpen: (date: string) => void }) {
  const days = weekDays(today).map((d) => {
    const dayBlocks = blocks.filter((b) => b.date.slice(0, 10) === d);
    return { iso: d, count: dayBlocks.length, isToday: d === today };
  });

  return (
    <GlassCard className="p-3">
      <div className="flex items-stretch justify-between gap-1" role="list" aria-label="أيام الأسبوع ومواعيدها">
        {days.map((d) => {
          const dayNum = Number(d.iso.slice(8, 10));
          return (
            <button
              key={d.iso}
              type="button"
              onClick={() => onOpen(d.iso)}
              role="listitem"
              aria-label={`${dayNameShort(d.iso)} ${dayNum} — ${d.count > 0 ? `${d.count} مواعيد` : "لا مواعيد"}`}
              className={cn(
                "flex-1 min-h-[64px] rounded-2xl flex flex-col items-center justify-center gap-1 transition-colors",
                d.isToday ? "bg-primary/12 border border-primary/30" : "hover:bg-black/[0.03]",
                press
              )}
            >
              <span className={cn("text-[9.5px]", d.isToday ? "text-gold font-bold" : "text-muted-foreground")}>
                {dayNameShort(d.iso)}
              </span>
              <span className={cn("text-[15px] font-bold tabular leading-none", d.isToday ? "text-foreground" : "text-foreground/75")}>
                {formatNumber(dayNum)}
              </span>
              <span className="h-[7px] flex items-center gap-[3px]" aria-hidden="true">
                {d.count > 0 ? (
                  Array.from({ length: Math.min(3, d.count) }).map((_, i) => (
                    <span key={i} className={cn("w-[5px] h-[5px] rounded-full", d.isToday ? "bg-gold" : "bg-cyan/70")} />
                  ))
                ) : (
                  <span className="w-[3px] h-[3px] rounded-full bg-black/10" />
                )}
              </span>
            </button>
          );
        })}
      </div>
    </GlassCard>
  );
}

function MoodPicker({ current }: { current: number | null }) {
  const [optimistic, setOptimistic] = useState<number | null>(null);
  const selected = current ?? optimistic;

  const pick = async (score: number) => {
    setOptimistic(score);
    try {
      await saveMood(score);
    } catch {
      toast.error("تعذر تسجيل المزاج — جرّب مجدداً");
    }
  };

  return (
    <div className="flex items-center justify-between gap-1" role="group" aria-label="اختيار المزاج">
      {MOOD_FACES.map((face, i) => {
        const score = i + 1;
        const active = selected === score;
        return (
          <motion.button
            key={score}
            whileTap={{ scale: 0.96 }}
            onClick={() => void pick(score)}
            aria-label={`مزاج ${score} من 5`}
            className={cn(
              "w-9 h-9 rounded-full flex items-center justify-center text-[17px] transition-[background-color,box-shadow,transform] duration-150 ease-out",
              active ? "bg-primary/15 ring-2 ring-primary scale-110" : "hover:bg-black/[0.04]"
            )}
          >
            {face}
          </motion.button>
        );
      })}
    </div>
  );
}

function HabitRing({ habit: h, logs }: { habit: Habit; logs: HabitLog[] }) {
  const [busy, setBusy] = useState(false);
  const today = todayISO();
  const todayLog = logs.find((l) => l.habitId === h.id && l.date === today);
  const done = Boolean(todayLog && todayLog.count >= h.target);
  const streak = habitStreak(
    logs.filter((l) => l.habitId === h.id).map((l) => ({ date: l.date, count: l.count })),
    today,
    h.target
  );

  const toggle = async () => {
    if (busy) return;
    setBusy(true);
    try {
      const res = await logHabit(h.id);
      if (res?.done && res.count >= h.target && streak >= 0) {
        toast(`✨ ${h.name}`, {
          description: streak + 1 > 0 ? `إنجاز اليوم اكتمل — سلسلة ${formatNumber(streak + 1)} ${streak + 1 === 1 ? "يوم" : "أيام"}` : "إنجاز اليوم اكتمل",
        });
      }
    } finally {
      setBusy(false);
    }
  };

  const R = 24;
  const C = 2 * Math.PI * R;

  return (
    <button
      onClick={() => void toggle()}
      aria-label={`${h.name} — ${done ? "إنجاز اليوم مسجل" : "سجّل إنجاز اليوم"}`}
      aria-pressed={done}
      className={cn(
        "glass rounded-3xl px-3 py-3.5 flex flex-col items-center gap-1.5 w-[92px] shrink-0 transition-[background-color,border-color,transform] duration-150 ease-out active:scale-[0.96]",
        done && "border-transparent"
      )}
      style={done ? { borderColor: `${h.color}55`, background: `${h.color}12` } : undefined}
    >
      <div className="relative w-14 h-14">
        <svg viewBox="0 0 56 56" className="w-14 h-14 -rotate-90">
          <circle cx="28" cy="28" r={R} fill="none" stroke="rgba(23,33,43,0.08)" strokeWidth="4.5" />
          <motion.circle
            cx="28"
            cy="28"
            r={R}
            fill="none"
            stroke={h.color}
            strokeWidth="4.5"
            strokeLinecap="round"
            strokeDasharray={C}
            animate={{ strokeDashoffset: done ? 0 : C }}
            transition={{ duration: 0.55, ease: [0.22, 1, 0.36, 1] }}
          />
        </svg>
        <div
          className="absolute inset-0 flex items-center justify-center rounded-full"
          style={{ color: h.color, background: done ? `${h.color}20` : undefined }}
        >
          {(() => {
            const I = iconByName(h.icon);
            return <I className="w-[21px] h-[21px]" />;
          })()}
        </div>
      </div>
      <span className="text-[10.5px] leading-tight text-center text-foreground/85 line-clamp-2 h-8 flex items-center">{h.name}</span>
      <span className={cn("flex items-center gap-0.5 text-[10px] tabular", streak > 0 ? "text-gold" : "text-muted-foreground/80")}>
        <Flame className="w-3 h-3" />
        {formatNumber(streak)}
      </span>
    </button>
  );
}

function TaskRow({ task }: { task: Task }) {
  const [done, setDone] = useState(task.done);
  const [busy, setBusy] = useState(false);
  useEffect(() => setDone(task.done), [task.done]);

  const toggle = async () => {
    if (busy) return;
    setBusy(true);
    const next = !done;
    setDone(next);
    try {
      await toggleTask(task.id);
    } catch {
      setDone(!next);
      toast.error("تعذر التحديث");
    } finally {
      setBusy(false);
    }
  };

  return (
    <li>
      <button
        onClick={() => void toggle()}
        className={cn(
          "w-full flex items-center gap-3 px-3 py-2.5 rounded-xl hover:bg-black/[0.03] text-start min-h-[44px]",
          press
        )}
        aria-pressed={done}
      >
        <motion.span
          animate={{ scale: done ? [1, 1.25, 1] : 1 }}
          transition={{ duration: 0.3 }}
          className={cn(
            "w-6 h-6 rounded-full border flex items-center justify-center shrink-0 transition-colors",
            done ? "bg-cyan/15 border-cyan text-cyan" : "border-black/25 text-transparent"
          )}
        >
          <Check className="w-3.5 h-3.5" strokeWidth={3} />
        </motion.span>
        <span className={cn("text-[13px] leading-relaxed transition-colors duration-150", done ? "text-muted-foreground line-through" : "text-foreground/90")}>
          {task.title}
        </span>
        {task.time && <span className="ms-auto text-[10px] text-muted-foreground tabular shrink-0">{task.time}</span>}
        {task.priority === "high" && !done && <span className="ms-auto w-1.5 h-1.5 rounded-full bg-coral shrink-0" />}
      </button>
    </li>
  );
}

function TodaySkeleton() {
  return (
    <div className="h-full overflow-y-auto sys-scroll px-4 pt-2 pb-32">
      <div className="h-7 w-40 rounded-lg mb-4 bg-black/[0.04] animate-pulse" />
      <div className="h-20 rounded-3xl bg-black/[0.04] animate-pulse mb-3" />
      <div className="h-48 rounded-3xl bg-black/[0.04] animate-pulse mb-3" />
      <div className="h-36 rounded-3xl bg-black/[0.04] animate-pulse mb-3" />
      <div className="h-28 rounded-3xl bg-black/[0.04] animate-pulse mb-3" />
      <div className="h-24 rounded-3xl bg-black/[0.04] animate-pulse" />
    </div>
  );
}
