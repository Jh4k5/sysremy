"use client";

/**
 * Systemy v3 — شاشة «المهام والوقت والتركيز» (المدير الكامل)
 * هيرو: مهام اليوم المفتوحة + منجزة اليوم + «التالي» (أقرب مهمة موقوتة) — كل رقم يفلتر القائمة.
 * فلاتر: اليوم / الوارد (بلا تاريخ أو متأخرة) / القادمة / منجزة آخر 7 أيام.
 * مؤقت تركيز بومودورو + صفوف مهام برقائق الوقت والأولوية وروابط الأنظمة،
 * حوار تفاصيل (تعديل مباشر/حذف/جدولة على التقويم)، وسطر روابط حية أسفل الشاشة.
 * كل الكتابة عبر actions الجاهزة والقراءة عبر useLive واحد (Dexie محلي).
 */

import { useState, type ReactNode } from "react";
import { motion } from "framer-motion";
import { Brain, CalendarDays, Check, Clock, ListTodo, Plus } from "lucide-react";
import type { LucideIcon } from "lucide-react";
import { db, useLive } from "@/lib/db";
import { toggleTask } from "@/lib/actions";
import { addDaysISO, formatTimeAr, nowHHMM, relativeDay, todayISO } from "@/lib/format";
import type { Task } from "@/lib/types";
import { EmptyState, iconByName } from "@/components/systemy/ui-bits";
import { GlassCard, widgetEnter } from "@/components/systemy/glass";
import { useUIStore } from "@/store/ui-store";
import { cn } from "@/lib/utils";
import { FocusTimerCard } from "./focus-timer-card";
import { TaskDetailDialog } from "./task-detail-dialog";
import { TaskFormDialog } from "./task-form-dialog";
import { taskLinkChips, type TaskLinkChip, type TaskLinkOptions } from "./task-fields";

// ═══════════════════════ الفلاتر ═══════════════════════

type TaskFilter = "today" | "inbox" | "upcoming" | "done";

const FILTERS: Array<{ k: TaskFilter; v: string }> = [
  { k: "today", v: "اليوم" },
  { k: "inbox", v: "الوارد" },
  { k: "upcoming", v: "القادمة" },
  { k: "done", v: "منجزة" },
];

const PRIORITY_RANK: Record<Task["priority"], number> = { high: 0, normal: 1, low: 2 };

const EMPTY_META: Record<TaskFilter, { title: string; hint: string }> = {
  today: { title: "لا مهام اليوم", hint: "يومك مفتوح — أضف مهمة أو ابدأ جلسة تركيز الآن" },
  inbox: { title: "الوارد فارغ", hint: "لا مهام بلا تاريخ ولا مهام متأخرة — رتّب قلبك 👌" },
  upcoming: { title: "لا مهام قادمة", hint: "المستقبل مفتوح — خطّط لمهمة قادمة بتاريخها" },
  done: { title: "لا إنجازات خلال 7 أيام", hint: "أنجز أي مهمة وستظهر هنا مع عدّاد اليوم" },
};

// ═══════════════════════ الشاشة ═══════════════════════

export function TasksScreen() {
  const setView = useUIStore((s) => s.setView);
  const goToCalendar = useUIStore((s) => s.goToCalendar);

  // قراءة واحدة حية: المهام + جداول الروابط + جلسات التركيز (إحصاء صادق يشمل الجزئية)
  const data = useLive(
    () =>
      Promise.all([
        db.tasks.toArray(),
        db.projects.toArray(),
        db.courses.toArray(),
        db.people.toArray(),
        db.goals.toArray(),
        db.trips.toArray(),
        db.focusSessions.toArray(),
      ]),
    [],
  );

  const [filter, setFilter] = useState<TaskFilter>("today");
  const [formOpen, setFormOpen] = useState(false);
  const [detailId, setDetailId] = useState<string | null>(null);

  const today = todayISO();
  const weekAgo = addDaysISO(today, -6);

  // ---------- حالة التحميل ----------
  if (!data) {
    return (
      <div
        className="h-full overflow-y-auto sys-scroll px-4 pt-3 pb-28"
        aria-busy="true"
        aria-label="جارٍ تحميل المهام"
      >
        <div className="glass-soft mb-3 h-14 animate-pulse rounded-3xl" />
        <div className="glass-soft mb-3 h-36 animate-pulse rounded-3xl" />
        <div className="glass-soft mb-3 h-80 animate-pulse rounded-3xl" />
        <div className="glass-soft h-14 animate-pulse rounded-3xl" />
      </div>
    );
  }

  const [tasks, projects, courses, people, goals, trips, focusSessions] = data;
  const links: TaskLinkOptions = { projects, courses, people, goals, trips };

  // ---------- مشتقات حية ----------
  const open = tasks.filter((t) => !t.done);
  const todayOpen = open.filter((t) => t.date === today);
  const inbox = open.filter((t) => !t.date || t.date < today);
  const upcoming = open.filter((t) => t.date > today);
  const done7 = tasks.filter((t) => t.done && (t.completedAt ? t.completedAt.slice(0, 10) : t.date) >= weekAgo);
  const doneToday = tasks.filter(
    (t) => t.done && (t.completedAt ? t.completedAt.slice(0, 10) === today : t.date === today),
  );

  /** أقرب مهمة موقوتة غير منجزة (أقدم تاريخ+وقت) */
  const nextTask =
    [...open]
      .filter((t) => t.time)
      .sort((a, b) => (`${a.date}T${a.time}`).localeCompare(`${b.date}T${b.time}`))[0] ?? null;
  const nextLabel = !nextTask
    ? ""
    : nextTask.date === today
      ? (nextTask.time ?? "") >= nowHHMM()
        ? "التالي · اليوم"
        : "التالي · فات وقتها"
      : `التالي · ${relativeDay(nextTask.date)}`;

  /** جلسات التركيز هذا الأسبوع — من focusSessions مباشرة (المكتملة والجزئية سواءً) */
  const focusWeek = focusSessions.filter((s) => s.date >= weekAgo && s.date <= today).length;

  // ---------- ترتيب القوائم ----------
  const todaySorted = [...todayOpen].sort((a, b) => {
    if (a.time && b.time) return a.time.localeCompare(b.time);
    if (a.time) return -1;
    if (b.time) return 1;
    return PRIORITY_RANK[a.priority] - PRIORITY_RANK[b.priority] || a.createdAt.localeCompare(b.createdAt);
  });
  const inboxSorted = [...inbox].sort(
    (a, b) =>
      a.date.localeCompare(b.date) ||
      PRIORITY_RANK[a.priority] - PRIORITY_RANK[b.priority] ||
      a.createdAt.localeCompare(b.createdAt),
  );
  const upcomingSorted = [...upcoming].sort(
    (a, b) =>
      a.date.localeCompare(b.date) ||
      (a.time ?? "99:99").localeCompare(b.time ?? "99:99") ||
      PRIORITY_RANK[a.priority] - PRIORITY_RANK[b.priority],
  );
  const doneSorted = [...done7].sort((a, b) =>
    (b.completedAt ?? b.updatedAt).localeCompare(a.completedAt ?? a.updatedAt),
  );

  const filterLists: Record<TaskFilter, Task[]> = {
    today: todaySorted,
    inbox: inboxSorted,
    upcoming: upcomingSorted,
    done: doneSorted,
  };
  const filterCounts: Record<TaskFilter, number> = {
    today: todayOpen.length,
    inbox: inbox.length,
    upcoming: upcoming.length,
    done: done7.length,
  };
  const list = filterLists[filter];

  /** مهام مفتوحة لاختيار جلسة التركيز (اليوم ثم الوارد ثم القادمة) */
  const openTasksForFocus = [...todaySorted, ...inboxSorted, ...upcomingSorted].slice(0, 50);

  const detailTask = detailId ? tasks.find((t) => t.id === detailId) ?? null : null;

  // ═══════════════════════ الهيكل ═══════════════════════
  return (
    <div className="h-full overflow-y-auto sys-scroll px-4 pt-3 pb-28">
      {/* ═══ الترويسة ═══ */}
      <motion.header {...widgetEnter(0)} className="mb-4 px-1">
        <h1 className="text-[22px] font-bold leading-tight">المهام والوقت والتركيز</h1>
        <p className="mt-0.5 text-[12px] text-muted-foreground">
          {tasks.length === 0
            ? "نظّم يومك بمهام موقوتة وجلسات تركيز"
            : `${open.length} مفتوحة · ${doneToday.length} أُنجزت اليوم · ${focusWeek} جلسة تركيز هذا الأسبوع`}
        </p>
      </motion.header>

      {/* ═══ الهيرو ═══ */}
      <motion.div {...widgetEnter(0.03)} className="mb-3">
        <GlassCard className="p-4">
          <div className="grid grid-cols-2 gap-2.5">
            <button
              type="button"
              onClick={() => setFilter("today")}
              aria-label={`مهام اليوم المفتوحة: ${todayOpen.length} — عرض قائمة اليوم`}
              className="rounded-2xl glass-soft border border-white/[0.06] p-3 text-right transition-colors hover:bg-white/[0.06] active:scale-[0.98]"
            >
              <p className="text-[11px] text-muted-foreground">مفتوحة اليوم</p>
              <p className="num-display tabular mt-0.5 text-[34px] leading-none text-cyan">{todayOpen.length}</p>
            </button>
            <button
              type="button"
              onClick={() => setFilter("done")}
              aria-label={`مهام منجزة اليوم: ${doneToday.length} — عرض المنجزة`}
              className="rounded-2xl glass-soft border border-white/[0.06] p-3 text-right transition-colors hover:bg-white/[0.06] active:scale-[0.98]"
            >
              <p className="text-[11px] text-muted-foreground">منجزة اليوم</p>
              <p className="num-display tabular mt-0.5 text-[34px] leading-none text-mint">{doneToday.length}</p>
            </button>
          </div>

          {/* التالي — أقرب مهمة موقوتة */}
          {nextTask ? (
            <button
              type="button"
              onClick={() => setDetailId(nextTask.id)}
              aria-label={`التالي: ${nextTask.title} — ${formatTimeAr(nextTask.time ?? "")} — عرض التفاصيل`}
              className="mt-3 flex w-full items-center justify-between gap-3 rounded-2xl border border-cyan/25 bg-cyan/[0.07] px-3.5 py-2.5 text-right transition-colors hover:bg-cyan/[0.12]"
            >
              <span className="min-w-0">
                <span className="flex items-center gap-1.5 text-[10px] font-bold text-cyan/90">
                  <Clock className="h-3 w-3 shrink-0" aria-hidden="true" />
                  {nextLabel}
                </span>
                <span className="mt-0.5 block truncate text-[13px] font-bold leading-snug">{nextTask.title}</span>
              </span>
              <span className="tabular shrink-0 rounded-xl bg-cyan/15 px-2.5 py-1 text-[12px] font-bold text-cyan" dir="ltr">
                {formatTimeAr(nextTask.time ?? "")}
              </span>
            </button>
          ) : (
            <p className="mt-3 rounded-2xl glass-soft px-3.5 py-2.5 text-[11px] leading-relaxed text-muted-foreground">
              لا مهمة موقوتة — حدّد وقتاً لمهمة وستظهر هنا كتاليةً لك.
            </p>
          )}
        </GlassCard>
      </motion.div>

      {/* ═══ مؤقت التركيز (بومودورو) ═══ */}
      <FocusTimerCard openTasks={openTasksForFocus} />

      {/* ═══ زر مهمة جديدة البارز ═══ */}
      <motion.div {...widgetEnter(0.12)} className="mb-3">
        <button
          type="button"
          onClick={() => setFormOpen(true)}
          className="flex h-14 w-full items-center justify-center gap-2 rounded-2xl bg-primary text-[15px] font-bold text-primary-foreground glow-gold transition-transform active:scale-[0.98]"
          aria-label="إضافة مهمة جديدة"
        >
          <Plus className="h-5 w-5" strokeWidth={2.4} aria-hidden="true" />
          مهمة جديدة
        </button>
      </motion.div>

      {/* ═══ فلاتر الرقائق ═══ */}
      <motion.div {...widgetEnter(0.15)} className="mb-3 flex gap-2 overflow-x-auto no-scrollbar" role="tablist" aria-label="فلترة المهام">
        {FILTERS.map((f) => {
          const active = filter === f.k;
          return (
            <button
              key={f.k}
              type="button"
              role="tab"
              aria-selected={active}
              onClick={() => setFilter(f.k)}
              className={cn(
                "h-11 min-h-11 shrink-0 rounded-full border px-4 text-[12.5px] font-bold transition-colors",
                active
                  ? "border-primary/50 bg-primary/20 text-primary"
                  : "glass-soft border-white/[0.08] text-foreground/75 hover:bg-white/[0.06]"
              )}
            >
              {f.v}
              <span className="tabular mr-1 opacity-70">({filterCounts[f.k]})</span>
            </button>
          );
        })}
      </motion.div>

      {/* ═══ القائمة ═══ */}
      <div className="space-y-2.5">
        {tasks.length === 0 ? (
          <motion.div {...widgetEnter(0.18)}>
            <GlassCard className="p-2">
              <EmptyState
                icon={<ListTodo className="h-6 w-6" />}
                title="لا مهام بعد"
                hint="أضف أول مهمة بوقت وأولوية — أو ابدأ جلسة تركيز من 15 دقيقة الآن"
                actionLabel="أضف أول مهمة"
                onAction={() => setFormOpen(true)}
              />
            </GlassCard>
          </motion.div>
        ) : list.length === 0 ? (
          <motion.div {...widgetEnter(0.18)}>
            <GlassCard className="p-2">
              <EmptyState
                compact
                icon={<ListTodo className="h-6 w-6" />}
                title={EMPTY_META[filter].title}
                hint={EMPTY_META[filter].hint}
                actionLabel="مهمة جديدة"
                onAction={() => setFormOpen(true)}
              />
            </GlassCard>
          </motion.div>
        ) : (
          list.map((t, i) => (
            <TaskRow
              key={t.id}
              task={t}
              chips={taskLinkChips(t, links)}
              delay={Math.min(0.18 + i * 0.035, 0.45)}
              onToggle={() => void toggleTask(t.id)}
              onOpen={() => setDetailId(t.id)}
            />
          ))
        )}
      </div>

      {/* ═══ الروابط الحية أسفل الشاشة ═══ */}
      <motion.div {...widgetEnter(0.22)} className="mt-4">
        <GlassCard className="p-3">
          <div className="flex flex-wrap items-center justify-between gap-2">
            <p className="flex items-center gap-1.5 text-[11.5px] text-muted-foreground">
              <Brain className="h-3.5 w-3.5 shrink-0 text-cyan" aria-hidden="true" />
              <span className="tabular text-[15px] font-bold text-foreground">{focusWeek}</span>
              جلسة تركيز هذا الأسبوع
            </p>
            <div className="flex gap-2">
              <button
                type="button"
                onClick={() => goToCalendar()}
                className="flex h-11 min-h-11 items-center gap-1.5 rounded-xl glass-soft border border-white/[0.08] px-3.5 text-[12px] font-bold text-foreground/80 transition-colors hover:bg-white/[0.06]"
                aria-label="فتح التقويم"
              >
                <CalendarDays className="h-4 w-4 shrink-0" aria-hidden="true" />
                التقويم
              </button>
              <button
                type="button"
                onClick={() => setView("projects")}
                className="flex h-11 min-h-11 items-center gap-1.5 rounded-xl glass-soft border border-white/[0.08] px-3.5 text-[12px] font-bold text-foreground/80 transition-colors hover:bg-white/[0.06]"
                aria-label="فتح شاشة المشاريع"
              >
                المشاريع
              </button>
            </div>
          </div>
        </GlassCard>
      </motion.div>

      {/* ═══ الحوارات ═══ */}
      <TaskFormDialog open={formOpen} onOpenChange={setFormOpen} links={links} />
      <TaskDetailDialog
        task={detailTask}
        onOpenChange={(o) => {
          if (!o) setDetailId(null);
        }}
        links={links}
      />
    </div>
  );
}

// ═══════════════════════ صف المهمة ═══════════════════════

function TaskRow({
  task,
  chips,
  delay,
  onToggle,
  onOpen,
}: {
  task: Task;
  chips: TaskLinkChip[];
  delay: number;
  onToggle: () => void;
  onOpen: () => void;
}) {
  const today = todayISO();
  return (
    <motion.div {...widgetEnter(delay)}>
      <GlassCard className="p-3">
        <div className="flex items-start gap-1">
          {/* خانة إنجاز دائرية */}
          <button
            type="button"
            onClick={onToggle}
            aria-pressed={task.done}
            aria-label={task.done ? `إرجاع إنجاز «${task.title}»` : `إنجاز «${task.title}»`}
            className="flex h-11 w-11 shrink-0 items-center justify-center rounded-full transition-transform active:scale-90"
          >
            <span
              className={cn(
                "flex h-6 w-6 items-center justify-center rounded-full border-2 transition-colors",
                task.done
                  ? "border-mint bg-mint text-[#07130c]"
                  : task.priority === "high"
                    ? "border-coral/70"
                    : "border-white/25"
              )}
            >
              {task.done && <Check className="h-4 w-4" strokeWidth={3} aria-hidden="true" />}
            </span>
          </button>

          {/* العنوان + الرقائق */}
          <button
            type="button"
            onClick={onOpen}
            aria-label={`تفاصيل «${task.title}»`}
            className="min-h-11 flex-1 rounded-xl px-1.5 py-0.5 text-right transition-colors hover:bg-white/[0.03]"
          >
            <p
              className={cn(
                "text-[14px] font-semibold leading-snug",
                task.done && "line-through text-muted-foreground"
              )}
            >
              {task.title}
            </p>
            <div className="mt-1.5 flex flex-wrap items-center gap-1.5">
              {task.time && <MetaChip icon={Clock}>{formatTimeAr(task.time)}</MetaChip>}
              {task.date !== today && <MetaChip icon={CalendarDays}>{relativeDay(task.date)}</MetaChip>}
              <PriorityChip priority={task.priority} />
              {chips.map((c) => (
                <LinkChip key={`${c.label}-${c.icon}`} chip={c} />
              ))}
            </div>
          </button>
        </div>
      </GlassCard>
    </motion.div>
  );
}

/** شريحة وصفية صغيرة (وقت/تاريخ) */
function MetaChip({ icon: Icon, children }: { icon: LucideIcon; children: ReactNode }) {
  return (
    <span className="inline-flex items-center gap-1 rounded-full glass-soft px-2 py-0.5 text-[10px] font-medium tabular text-foreground/70">
      <Icon className="h-3 w-3 shrink-0" aria-hidden="true" />
      {children}
    </span>
  );
}

/** شريحة الأولوية — عاجلة بمرجاني #FF8E7A والباقي محايد */
function PriorityChip({ priority }: { priority: Task["priority"] }) {
  const meta: Record<Task["priority"], { label: string; cls: string }> = {
    high: { label: "عاجلة", cls: "border-coral/40 bg-coral/10 text-coral" },
    normal: { label: "عادية", cls: "border-white/[0.08] bg-white/[0.04] text-foreground/65" },
    low: { label: "هادئة", cls: "border-white/[0.08] bg-white/[0.03] text-muted-foreground/80" },
  };
  const m = meta[priority] ?? meta.normal;
  return (
    <span className={cn("rounded-full border px-2 py-0.5 text-[10px] font-bold", m.cls)}>{m.label}</span>
  );
}

/** شريحة رابط النظام — بلون الكيان وأيقونته */
function LinkChip({ chip }: { chip: TaskLinkChip }) {
  return (
    <span
      className="inline-flex max-w-[140px] items-center gap-1 rounded-full border px-2 py-0.5 text-[10px] font-bold"
      style={{ borderColor: `${chip.color}44`, background: `${chip.color}14`, color: chip.color }}
    >
      {[chip.icon.toLowerCase()].map((n) => {
        const I = iconByName(n);
        return <I key={n} className="h-3 w-3 shrink-0" aria-hidden="true" />;
      })}
      <span className="truncate">{chip.label}</span>
    </span>
  );
}
