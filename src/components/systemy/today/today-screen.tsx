"use client";

/**
 * شاشة «اليوم» v5 — هوية «الشريط»: التقدّم والحدود بلغة الشريط المتدرج،
 * والذهبي للقيمة والإجراء الأساسي. كل المنطق v2 كما هو (useLive/الأفعال/التنقل).
 */
import { useEffect, useState } from "react";
import Image from "next/image";
import { AnimatePresence, motion } from "framer-motion";
import {
  Flame, Zap, Check, History, Sparkles, TrendingUp, TrendingDown,
  NotebookPen, ArrowDownRight, ArrowUpRight, ArrowLeft, Wallet, Bell, Leaf,
} from "lucide-react";
import { toast } from "sonner";
import { db, getSettings, useLive } from "@/lib/db";
import { logHabit, saveMood, toggleTask } from "@/lib/actions";
import { safeToSpend, monthWindow, accountBalance, budgetPacing } from "@/lib/money";
import type { Habit, HabitLog, Note, Task, Transaction, Mood as MoodRow, Settings } from "@/lib/types";
import { habitStreak } from "@/lib/types";
import {
  formatMoney, formatNumber, formatTime, MOOD_FACES, smartGreeting, timeAgo, todayISO, addDaysISO, diffDays,
} from "@/lib/format";
import { useUIStore } from "@/store/ui-store";
import { GlassCard, SectionHeader, Chip, PrivateAmount, widgetEnter } from "../glass";
import { CountUp } from "../count-up";
import { iconByName } from "../ui-bits";
import { cn } from "@/lib/utils";

/** ضغط V5 — 0.96 بالضبط، انتقالات محددة الخصائص (ممنوع transition:all) */
const press =
  "transition-[transform,color,background-color,border-color] duration-150 ease-out active:scale-[0.96]";

export function TodayScreen() {
  const { openQuickAdd, setView, setAlertsOpen, goToMoney } = useUIStore();

  const data = useLive(async () => {
    const [settings, txs, habits, habitLogs, tasks, notes, moods, accounts, recurrings, goals, categories] = await Promise.all([
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
    ]);
    return { settings, txs, habits, habitLogs, tasks, notes, moods, accounts, recurrings, goals, categories };
  }, []);

  if (!data) return <TodaySkeleton />;
  const { settings, txs, habits, habitLogs, tasks, notes, moods, accounts, recurrings, goals, categories } = data;

  const today = todayISO();
  const greeting = smartGreeting(settings.displayName);
  const safe = safeToSpend(settings, txs, recurrings, goals, today);
  const pacing = budgetPacing(settings, categories, txs, today);
  const w = monthWindow(settings, today);

  const activeHabits = habits.filter((h) => !h.archived).sort((a, b) => a.order - b.order);
  const todayHabitLogs = habitLogs.filter((l) => l.date === today);
  const todayTxs = txs.filter((t) => t.date.slice(0, 10) === today).sort((a, b) => b.date.localeCompare(a.date));
  const todayTasks = tasks.filter((t) => t.date === today);
  const todayMood = moods.find((m) => m.date === today) ?? null;

  const statusMeta =
    safe.status === "great"
      ? { label: "يوم مريح", cls: "text-gold", dot: "bg-gold" }
      : safe.status === "careful"
        ? { label: "يوم حذر — خذ راحة", cls: "text-coral", dot: "bg-coral" }
        : { label: "متوازن", cls: "text-foreground/80", dot: "bg-mint" };

  // حالة ميزانية الصرف (لو حُددت) — نقطة «على المسار» شريط V5 (متطابقة مع BP_META في المال)
  const bpMeta =
    pacing.status === "great"
      ? { label: "يوم مريح", cls: "text-mint", dot: "bg-mint" }
      : pacing.status === "good"
        ? { label: "على المسار", cls: "text-foreground/80", dot: "ribbon" }
        : pacing.status === "careful"
          ? { label: "خلف الوتيرة", cls: "text-gold", dot: "bg-gold" }
          : { label: "تجاوزت الشهري", cls: "text-coral", dot: "bg-coral" };

  // شريط اليوم: صُرف اليوم مقابل حصة اليوم — الشريط = تقدّم العلامة، والتجاوز يبقى مرجانياً
  const dayRatio = pacing.perDay > 0 ? pacing.spentToday / pacing.perDay : pacing.spentToday > 0 ? 1.2 : 0;
  const dayBarFill = dayRatio > 1 ? "#FF8E7A" : "var(--grad-ribbon)";

  // ملخص الأسبوع
  const weekStart = addDaysISO(today, -6);
  const weekTxs = txs.filter((t) => t.date.slice(0, 10) >= weekStart && t.date.slice(0, 10) <= today);
  const weekSpent = weekTxs.filter((t) => t.type === "expense").reduce((s, t) => s + t.amount, 0);
  const weekIncome = weekTxs.filter((t) => t.type === "income").reduce((s, t) => s + t.amount, 0);
  const weekLogs = habitLogs.filter((l) => l.date >= weekStart && l.date <= today);
  const habitsDone = weekLogs.reduce((s, l) => s + l.count, 0);

  // الخط الزمني الموحد لليوم
  const timeline = [
    ...todayTxs.map((t) => ({
      id: t.id,
      kind: "tx" as const,
      title: t.description,
      amount: t.amount,
      type: t.type,
      time: t.date,
      icon: t.type === "income" ? "arrow-down-left" : (t.categoryId ? undefined : "wallet"),
      color: t.type === "income" ? "#6EE7A8" : "#F5B95C",
    })),
    ...todayHabitLogs.map((l) => ({
      id: l.id,
      kind: "habit" as const,
      title: habits.find((h) => h.id === l.habitId)?.name ?? "عادة",
      amount: null as number | null,
      type: "",
      time: `${today}T12:00`,
      icon: habits.find((h) => h.id === l.habitId)?.icon ?? "flame",
      color: "#5CE1E6",
    })),
    ...todayTasks.filter((t) => t.done).map((t) => ({
      id: t.id,
      kind: "task" as const,
      title: t.title,
      amount: null as number | null,
      type: "",
      time: t.completedAt ?? `${t.date}T12:00`,
      icon: "check-square",
      color: "#6EE7A8",
    })),
  ]
    .sort((a, b) => b.time.localeCompare(a.time))
    .slice(0, 12);

  // ذكرى «قبل سنة»
  const memory = notes.find((n) => {
    if (n.type !== "journal") return false;
    const d = diffDays(n.date, today);
    return Math.abs(d - 365) <= 3;
  });

  const lastNote = [...notes].sort((a, b) => (b.pinned ? 1 : 0) - (a.pinned ? 1 : 0) || b.date.localeCompare(a.date))[0];

  // الإجراء التالي الأفضل
  const pendingHabits = activeHabits.filter((h) => {
    const log = todayHabitLogs.find((l) => l.habitId === h.id);
    return !log || log.count < h.target;
  }).length;
  const overdueTasks = tasks.filter((t) => !t.done && t.date < today).length;
  const nextAction = overdueTasks > 0
    ? { text: `${formatNumber(overdueTasks)} ${overdueTasks === 1 ? "مهمة متأخرة تنتظرك" : "مهام متأخرة تنتظرك"} — أنجز واحدة صغيرة الآن`, view: "today" as const }
    : todayTasks.some((t) => !t.done)
      ? { text: "لديك مهام اليوم — أنجز أصغرها أولاً", view: "today" as const }
      : pendingHabits > 0
        ? { text: `${formatNumber(pendingHabits)} ${pendingHabits === 1 ? "عادة تنتظرك" : "عادات تنتظرك"} قبل نهاية اليوم`, view: "habits" as const }
        : todayTxs.length === 0
          ? { text: "لم تسجل شيئاً اليوم — أول إدخال يستغرق 3 ثوانٍ", view: null as null }
          : { text: "يومك منظم — لا شيء يحتاج انتباهك الآن", view: null as null };

  return (
    <div className="h-full overflow-y-auto sys-scroll px-4 pt-3 pb-32">
      {/* التحية — بطاقة زجاجية بخط الشريط + لمسة التميّز (روبوت Sys) — زر الخصوصية واحد في الرأس المشترك فقط (§5.2) */}
      <motion.header {...widgetEnter(0)} className="mb-4">
        <GlassCard className="ribbon-hairline p-4 flex items-center gap-3.5">
          <Image
            src="/brand/logo-128.png"
            alt="شعار Systemy — روبوت Sys يلتف حوله شريط الألوان"
            width={32}
            height={32}
            priority
            className="rounded-[10px] shrink-0 select-none shadow-[0_2px_10px_rgba(0,0,0,0.42)] outline outline-1 -outline-offset-1 outline-white/10"
          />
          <div className="min-w-0">
            <h1 className="text-[22px] font-bold leading-tight">{greeting.text}</h1>
            <p className="text-[11px] text-muted-foreground mt-0.5">{greeting.sub}</p>
          </div>
        </GlassCard>
      </motion.header>

      {/* ميزانية اليوم (أو الرصيد الآمن مع دعوة تحديد الميزانية) */}
      <motion.div {...widgetEnter(0.04)}>
        {pacing.status !== "unset" ? (
          <GlassCard className={cn("p-5", pacing.status === "great" && "glow-gold")}>
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
                  "num-display text-[42px] leading-none",
                  pacing.todayRemaining < 0 ? "text-coral" : "text-glow-gold text-primary"
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
              className="h-1.5 rounded-full bg-white/[0.05] mt-3 overflow-hidden"
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
            <div className="mt-3 pt-3 border-t border-white/[0.07] flex items-center justify-between gap-2">
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
                  "min-h-11 px-3 rounded-xl flex items-center gap-1 text-[11.5px] font-semibold text-primary/90 hover:text-primary hover:bg-primary/10 shrink-0",
                  press,
                )}
              >
                الميزانية
                <ArrowLeft className="w-4 h-4" aria-hidden="true" />
              </button>
            </div>
          </GlassCard>
        ) : (
          <GlassCard className={cn("p-5", safe.status === "great" && "glow-gold")}>
            <div className="flex items-center justify-between">
              <span className="text-[12px] text-muted-foreground">الآمن صرفه يومياً</span>
              <span className={cn("flex items-center gap-1.5 text-[11px] font-medium", statusMeta.cls)}>
                <span className={cn("w-1.5 h-1.5 rounded-full", statusMeta.dot)} />
                {statusMeta.label}
              </span>
            </div>
            <div className="mt-2.5 flex items-baseline gap-2">
              <PrivateAmount className="num-display text-[42px] leading-none text-glow-gold text-primary">
                <CountUp value={safe.amount} className="inherit" />
              </PrivateAmount>
              <span className="text-[13px] text-muted-foreground">{settings.currency}</span>
            </div>
            <p className="mt-2 text-[11px] text-muted-foreground">
              حتى نهاية الشهر المالي · <span className="tabular">{formatNumber(safe.daysLeft)}</span> يوماً متبقياً
            </p>
            <div className="mt-3.5 pt-3 border-t border-white/[0.07] flex items-center justify-between text-[10px] text-muted-foreground/90 tabular">
              <span>دخل {formatMoney(safe.expectedIncome, settings.currency)}</span>
              <span className="opacity-50">−</span>
              <span>التزامات {formatMoney(safe.commitments, settings.currency)}</span>
              <span className="opacity-50">−</span>
              <span>أهداف {formatMoney(safe.goalContributions, settings.currency)}</span>
              <span className="opacity-50">−</span>
              <span>مصروف {formatMoney(safe.spent, settings.currency)}</span>
            </div>
            <button
              type="button"
              onClick={() => goToMoney("budget")}
              aria-label="تحديد ميزانية الصرف الشهرية — يفتح تبويب الميزانية"
              className={cn(
                "mt-3 w-full min-h-11 rounded-xl bg-primary/15 border border-primary/30 text-primary text-[12px] font-bold flex items-center justify-center gap-1.5 hover:bg-primary/25",
                press,
              )}
            >
              حدّد ميزانية صرف شهرية
              <ArrowLeft className="w-4 h-4" aria-hidden="true" />
            </button>
          </GlassCard>
        )}
      </motion.div>

      {/* الإجراء التالي + المزاج */}
      <div className="grid grid-cols-5 gap-3 mt-3">
        {nextAction && (
          <motion.div {...widgetEnter(0.08)} className={cn("col-span-3", !nextAction && "hidden")}>
            <GlassCard
              interactive
              onClick={() => {
                if (overdueTasks > 0 || todayTasks.some((t) => !t.done)) setView("today");
                else if (pendingHabits > 0) setView("habits");
                else openQuickAdd();
              }}
              className="p-4 h-full border-dashed border-primary/30"
            >
              <div className="flex items-start gap-3">
                <span className="w-10 h-10 rounded-2xl bg-primary/15 border border-primary/30 flex items-center justify-center text-primary shrink-0">
                  <Zap className="w-[18px] h-[18px]" />
                </span>
                <div className="min-w-0">
                  <div className="text-[10px] text-primary/90 font-semibold mb-1">الآن — اقتراح واحد فقط</div>
                  <p className="text-[12.5px] leading-[1.7] text-foreground/90">{nextAction.text}</p>
                </div>
              </div>
            </GlassCard>
          </motion.div>
        )}
        <motion.div {...widgetEnter(0.12)} className={cn("col-span-2", !nextAction && "col-start-1 col-end-3")}>
          <GlassCard className="p-4 h-full">
            <div className="text-[11px] text-muted-foreground mb-2.5 text-center">كيف حالك؟</div>
            <MoodPicker current={todayMood?.score ?? null} />
          </GlassCard>
        </motion.div>
      </div>

      {/* العادات */}
      <motion.section {...widgetEnter(0.16)} className="mt-5">
        <SectionHeader
          title="عادات اليوم"
          icon={<Flame className="w-4 h-4 text-gold" />}
          action={activeHabits.length > 0 ? "كل العادات" : "أضف عادة"}
          onAction={() => setView("habits")}
        />
        {activeHabits.length === 0 ? (
          <GlassCard className="p-4">
            <button onClick={() => setView("habits")} className={cn("w-full flex flex-col items-center gap-2.5 py-4 min-h-11", press)}>
              <Image
                src="/brand/logo-128.png"
                alt=""
                width={64}
                height={64}
                aria-hidden="true"
                className="rounded-2xl opacity-90 outline outline-1 -outline-offset-1 outline-white/10"
              />
              <span className="text-[12px] text-foreground/80">لا عادات بعد — عادة واحدة صغيرة تغيّر إيقاعك</span>
              <span className="text-[11px] text-primary font-medium">أنشئ أول عادة ←</span>
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

      {/* خط اليوم */}
      <motion.section {...widgetEnter(0.2)} className="mt-5">
        <SectionHeader title="خط اليوم" icon={<History className="w-4 h-4 text-cyan" />} />
        <GlassCard className="p-4">
          {timeline.length === 0 ? (
            <button
              onClick={() => openQuickAdd()}
              className={cn("w-full flex flex-col items-center gap-2.5 py-4 min-h-11", press)}
            >
              <Image
                src="/brand/logo-128.png"
                alt=""
                width={64}
                height={64}
                aria-hidden="true"
                className="rounded-2xl opacity-90 outline outline-1 -outline-offset-1 outline-white/10"
              />
              <span className="text-[12px] text-foreground/80">لا شيء بعد. أول إدخال يستغرق 3 ثوانٍ — جرّبه</span>
            </button>
          ) : (
            <div className="flex gap-1.5 overflow-x-auto no-scrollbar">
              {timeline.map((item, i) => (
                <TimelineNode key={item.id} item={item} isLast={i === timeline.length - 1} />
              ))}
            </div>
          )}
        </GlassCard>
      </motion.section>

      {/* مهام اليوم */}
      <motion.section {...widgetEnter(0.24)} className="mt-5">
        <SectionHeader
          title={`مهام اليوم ${todayTasks.length > 0 ? `${todayTasks.filter((t) => t.done).length}/${todayTasks.length}` : ""}`}
          icon={<Check className="w-4 h-4 text-cyan" />}
          action="المزيد"
          onAction={() => openQuickAdd("task")}
        />
        <GlassCard className="p-2">
          {todayTasks.length === 0 ? (
            <div className="flex flex-col items-center gap-2.5 py-3">
              <Image
                src="/brand/logo-128.png"
                alt=""
                width={64}
                height={64}
                aria-hidden="true"
                className="rounded-2xl opacity-90 outline outline-1 -outline-offset-1 outline-white/10"
              />
              <span className="text-[12px] text-foreground/80">لا مهام اليوم — يومك لك ✓</span>
            </div>
          ) : (
            <ul className="space-y-0.5">
              {todayTasks.map((t) => (
                <TaskRow key={t.id} task={t} />
              ))}
            </ul>
          )}
        </GlassCard>
      </motion.section>

      {/* ملخص الأسبوع */}
      <motion.section {...widgetEnter(0.28)} className="mt-5">
        <SectionHeader title="ملخص الأسبوع" icon={<Sparkles className="w-4 h-4 text-gold" />} action="الرؤى" onAction={() => setView("insights")} />
        <GlassCard className="p-4">
          <div className="grid grid-cols-3 divide-x divide-x-reverse divide-white/[0.07]">
            <WeekStat label="الصرف" value={formatMoney(weekSpent, settings.currency)} />
            <WeekStat label="الدخل" value={formatMoney(weekIncome, settings.currency)} />
            <WeekStat label="العادات" value={`${formatNumber(habitsDone)}/${formatNumber(activeHabits.length * 7)}`} hint="تسجيلات هذا الأسبوع" />
          </div>
        </GlassCard>
      </motion.section>

      {/* ذكرى */}
      {memory && (
        <motion.section {...widgetEnter(0.28)} className="mt-5">
          <SectionHeader title="في مثل هذا اليوم" icon={<History className="w-4 h-4 text-lav" />} />
          <GlassCard className="p-4 border-lav/20 bg-lav/[0.06]">
            <div className="flex items-start gap-3">
              <span className="w-10 h-10 rounded-2xl bg-lav/15 border border-lav/30 flex items-center justify-center shrink-0">
                <NotebookPen className="w-[18px] h-[18px] text-lav" />
              </span>
              <div className="min-w-0">
                <p className="text-[11px] text-lav/90 font-medium">قبل سنة تقريباً · {timeAgo(memory.date)}</p>
                <p className="text-[12.5px] leading-[1.8] text-foreground/85 mt-1 line-clamp-3">{memory.content}</p>
              </div>
            </div>
          </GlassCard>
        </motion.section>
      )}

      {/* آخر ملاحظة */}
      {lastNote && (
        <motion.section {...widgetEnter(0.28)} className="mt-5">
          <SectionHeader title="آخر ملاحظة" icon={<NotebookPen className="w-4 h-4 text-lav" />} action="الدفتر" onAction={() => setView("journal")} />
          <GlassCard interactive onClick={() => setView("journal")} className="p-4">
            <div className="flex items-center justify-between gap-2">
              <span className="text-[13px] font-semibold truncate">{lastNote.title}</span>
              {lastNote.pinned && <Chip className="text-gold border-gold/25">مثبتة</Chip>}
            </div>
            <p className="text-[12px] text-muted-foreground leading-[1.8] mt-1.5 line-clamp-2">{lastNote.content}</p>
          </GlassCard>
        </motion.section>
      )}

      <motion.p {...widgetEnter(0.28)} className="mt-6 mb-1 text-center text-[10px] text-muted-foreground/60 leading-relaxed">
        كل شيء يعمل محلياً على جهازك · {formatNumber(txs.length)} معاملة و{formatNumber(activeHabits.length)} عادة تتحرك معك
      </motion.p>
    </div>
  );
}

/* ═══════════════════════ أدوات فرعية ═══════════════════════ */

function MoodPicker({ current }: { current: number | null }) {
  // قيمة محلية متفائلة — القيمة المحفوظة (current) لها الأولوية فور وصولها
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
              active ? "bg-primary/20 ring-2 ring-primary scale-110" : "hover:bg-white/[0.07]"
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
      style={done ? { borderColor: `${h.color}66`, background: `${h.color}14` } : undefined}
    >
      <div className="relative w-14 h-14">
        <svg viewBox="0 0 56 56" className="w-14 h-14 -rotate-90">
          <circle cx="28" cy="28" r={R} fill="none" stroke="rgba(255,255,255,0.09)" strokeWidth="4.5" />
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
          style={{ color: h.color, background: done ? `${h.color}22` : undefined }}
        >
          {(() => {
            const I = iconByName(h.icon);
            return <I className="w-[21px] h-[21px]" />;
          })()}
        </div>
      </div>
      <span className="text-[10.5px] leading-tight text-center text-foreground/85 line-clamp-2 h-8 flex items-center">{h.name}</span>
      <span className={cn("flex items-center gap-0.5 text-[10px] tabular", streak > 0 ? "text-gold" : "text-muted-foreground/70")}>
        <Flame className="w-3 h-3" />
        {formatNumber(streak)}
      </span>
    </button>
  );
}

function TimelineNode({
  item,
  isLast,
}: {
  item: { id: string; kind: string; title: string; amount: number | null; type: string; time: string; icon?: string; color: string };
  isLast: boolean;
}) {
  const isIn = item.type === "income";
  return (
    <div className={cn("flex shrink-0 items-center gap-1", !isLast && "pe-3")}>
      <div className="flex flex-col items-center gap-1 w-11">
        <span className="text-[9px] text-muted-foreground tabular">{formatTime(item.time)}</span>
        <span
          className="w-9 h-9 rounded-2xl border flex items-center justify-center"
          style={{ color: item.color, borderColor: `${item.color}44`, background: `${item.color}14` }}
        >
          {isIn ? (
            <ArrowDownRight className="w-4 h-4" />
          ) : item.kind === "tx" ? (
            <Wallet className="w-4 h-4" />
          ) : (
            (() => {
              const I = iconByName(item.icon ?? "sparkles");
              return <I className="w-4 h-4" />;
            })()
          )}
        </span>
        <span className="text-[9px] text-muted-foreground tabular">
          {item.amount != null ? `${item.amount > 999 ? Math.round(item.amount / 100) / 10 + "k" : formatNumber(item.amount)}${isIn ? "+" : ""}` : ""}
        </span>
      </div>
      {!isLast && <div className="w-1 h-1 rounded-full bg-white/20" />}
    </div>
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
          "w-full flex items-center gap-3 px-3 py-2.5 rounded-xl hover:bg-white/[0.05] text-start min-h-[44px]",
          press,
        )}
        aria-pressed={done}
      >
        <motion.span
          animate={{ scale: done ? [1, 1.25, 1] : 1 }}
          transition={{ duration: 0.3 }}
          className={cn(
            "w-6 h-6 rounded-full border flex items-center justify-center shrink-0 transition-colors",
            done ? "bg-cyan/20 border-cyan text-cyan" : "border-white/25 text-transparent"
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

function WeekStat({ label, value, hint }: { label: string; value: string; hint?: string }) {
  return (
    <div className="px-2 text-center">
      <div className="text-[10px] text-muted-foreground mb-1">{label}</div>
      <PrivateAmount className="text-[14px] font-semibold tabular">{value}</PrivateAmount>
      {hint && <div className="mt-1 text-[9px] text-muted-foreground/70">{hint}</div>}
    </div>
  );
}

function TodaySkeleton() {
  return (
    <div className="h-full overflow-y-auto sys-scroll px-4 pt-3 pb-32">
      <div className="skeleton-card h-16 rounded-2xl mb-4 bg-white/[0.04] animate-pulse" />
      <div className="h-52 rounded-3xl bg-white/[0.04] animate-pulse mb-3" />
      <div className="grid grid-cols-5 gap-3 mb-3">
        <div className="col-span-3 h-28 rounded-3xl bg-white/[0.04] animate-pulse" />
        <div className="col-span-2 h-28 rounded-3xl bg-white/[0.04] animate-pulse" />
      </div>
      <div className="h-32 rounded-3xl bg-white/[0.04] animate-pulse mb-3" />
      <div className="h-40 rounded-3xl bg-white/[0.04] animate-pulse" />
    </div>
  );
}
