"use client";

/**
 * Systemy v2 — شاشة التقويم (عرض أسبوعي RTL)
 * تجمع الأحداث من كل الأنظمة عبر dayEvents: كتل زمنية + مهام مجدولة +
 * استحقاقات الالتزامات + معاملات اليوم. شريط «طول اليوم» فوق الشبكة
 * يعرض التزامات اليوم المحدد، والمس الشبكة يفتح نموذج حدث عند أقرب نصف ساعة.
 */

import { useEffect, useMemo, useRef, useState } from "react";
import { motion } from "framer-motion";
import {
  AlertTriangle,
  CheckSquare,
  ChevronLeft,
  ChevronRight,
  Clock3,
  Plus,
  Square,
} from "lucide-react";
import { toast } from "sonner";
import { db, getSettings, useLive } from "@/lib/db";
import { toggleTask } from "@/lib/actions";
import { dayEvents, findConflicts, type CalEvent } from "@/lib/calendar-utils";
import {
  addDaysISO,
  dayNameShort,
  formatDate,
  formatMoney,
  fromISODate,
  hhmmToMinutes,
  nowHHMM,
  todayISO,
  weekDays,
  type WeekStart,
} from "@/lib/format";
import { useUIStore } from "@/store/ui-store";
import { GlassCard, widgetEnter } from "@/components/systemy/glass";
import { iconByName } from "@/components/systemy/ui-bits";
import { cn } from "@/lib/utils";
import { WeekGrid } from "./week-grid";
import { BlockFormDialog, type BlockFormInit } from "./block-form-dialog";
import { BlockDetailsDialog } from "./block-details-dialog";

/** شاشة التقويم — أسبوع كامل قابل للتنقل */
export function CalendarScreen() {
  const settings = useLive(() => getSettings(), []);
  const data = useLive(async () => {
    const [blocks, tasks, recurrings, transactions, habits] = await Promise.all([
      db.blocks.toArray(),
      db.tasks.toArray(),
      db.recurrings.toArray(),
      db.transactions.toArray(),
      db.habits.toArray(),
    ]);
    return { blocks, tasks, recurrings, transactions, habits };
  }, []);

  // تاريخ مطلوب مسبقاً من شاشة أخرى (اليوم → التقويم) — يُستهلك مرة عند التركيب.
  // (يُقرأ من المخزن في التهيئة ثم يُستهلك في التأثير — قاعدة set-state-in-effect تمنع
  // استدعاء setAnchor مباشرة داخل جسم التأثير، والسلوك المطابق للمواصفة محفوظ)
  const consumeCalendarDate = useUIStore((s) => s.consumeCalendarDate);
  const [anchor, setAnchor] = useState<string>(() => useUIStore.getState().calendarDate ?? todayISO());
  const [selected, setSelected] = useState<string>(() => useUIStore.getState().calendarDate ?? todayISO());
  const [formOpen, setFormOpen] = useState(false);
  const [formInit, setFormInit] = useState<BlockFormInit | null>(null);
  const [detailsEvent, setDetailsEvent] = useState<CalEvent | null>(null);

  useEffect(() => {
    consumeCalendarDate();
  }, [consumeCalendarDate]);

  const weekStart: WeekStart = settings?.weekStart ?? "sat";
  const currency = settings?.currency ?? "ر.س";
  const days = useMemo(() => weekDays(anchor, weekStart), [anchor, weekStart]);
  const today = todayISO();
  const isCurrentWeek = days.includes(today);

  // أحداث كل يوم من كل الأنظمة (مع إخفاء المهام المرتبطة بكتلة — تظهر ككتلة)
  const eventsByDay = useMemo(() => {
    const map = new Map<string, CalEvent[]>();
    if (!data) return map;
    for (const d of days) {
      const evs = dayEvents(d, data.blocks, data.tasks, data.recurrings, data.transactions);
      const linkedTaskIds = new Set(
        evs.filter((e) => e.source === "block" && e.taskId).map((e) => e.taskId as string),
      );
      map.set(
        d,
        evs.filter((e) => !(e.source === "task" && e.taskId && linkedTaskIds.has(e.taskId))),
      );
    }
    return map;
  }, [data, days]);

  // التعارضات (بدون المعاملات — ليست حجوزات زمنية)
  const conflicts = useMemo(() => {
    const weekEvents = days.flatMap((d) => eventsByDay.get(d) ?? []);
    return findConflicts(weekEvents.filter((e) => !e.id.startsWith("tx-")));
  }, [days, eventsByDay]);

  const selectedEvents = eventsByDay.get(selected) ?? [];
  const allDay = selectedEvents.filter((e) => e.allDay);
  const openTasks = useMemo(
    () => (data?.tasks ?? []).filter((t) => !t.done).slice(0, 40),
    [data],
  );
  const activeHabits = useMemo(
    () => (data?.habits ?? []).filter((h) => !h.archived).slice(0, 40),
    [data],
  );

  // التمرير التلقائي لخط «الآن» عند أول تحميل
  const rootRef = useRef<HTMLDivElement>(null);
  const nowLineRef = useRef<HTMLDivElement | null>(null);
  const didAutoScroll = useRef(false);
  useEffect(() => {
    if (didAutoScroll.current || !data || !days.includes(today)) return;
    didAutoScroll.current = true;
    requestAnimationFrame(() => {
      const root = rootRef.current;
      const el = nowLineRef.current;
      if (!root || !el) return;
      const r = root.getBoundingClientRect();
      const n = el.getBoundingClientRect();
      root.scrollTo({
        top: root.scrollTop + (n.top - r.top) - r.height * 0.38,
        behavior: "smooth",
      });
    });
  }, [data, days, today]);

  // ---------- التنقل ----------
  const shiftWeek = (delta: number) => {
    setAnchor((a) => addDaysISO(a, delta * 7));
    setSelected((s) => addDaysISO(s, delta * 7));
  };
  const goToday = () => {
    setAnchor(today);
    setSelected(today);
  };

  // ---------- فتح النوافذ ----------
  const openFormAt = (date: string, startMinute: number, durationMinutes = 60) => {
    setFormInit({ date, startMinute, durationMinutes });
    setFormOpen(true);
  };

  const openAddDefault = () => {
    const date = selected;
    const base = date === today ? hhmmToMinutes(nowHHMM()) : 10 * 60;
    const snapped = Math.min(Math.max(Math.ceil(base / 30) * 30, 7 * 60), 22 * 60);
    openFormAt(date, snapped);
  };

  const openEditFromEvent = (ev: CalEvent) => {
    if (ev.source !== "block" || ev.id.startsWith("tx-") || !data) return;
    const block = data.blocks.find((b) => b.id === ev.id);
    if (!block) return;
    setDetailsEvent(null);
    setFormInit({
      id: block.id,
      date: block.date,
      startMinute: hhmmToMinutes(block.startTime),
      durationMinutes:
        Math.max(15, hhmmToMinutes(block.endTime) - hhmmToMinutes(block.startTime)) || 30,
      type: block.type,
      title: block.title,
      note: block.note,
      taskId: block.taskId,
      habitId: block.habitId,
    });
    setFormOpen(true);
  };

  const showConflicts = () => {
    if (conflicts.pairs.length === 0) return;
    toast.warning(`${conflicts.pairs.length} تداخل زمني في أسبوعك`, {
      description: conflicts.pairs
        .slice(0, 3)
        .map((p) => `${p.a.title} ↔ ${p.b.title}`)
        .join(" · "),
    });
  };

  // ---------- عنوان الأسبوع ----------
  const { monthLabel, rangeLabel } = useMemo(() => {
    const d0 = fromISODate(days[0]);
    const d6 = fromISODate(days[6]);
    const sameMonth = d0.getMonth() === d6.getMonth() && d0.getFullYear() === d6.getFullYear();
    const monthOf = (iso: string) => formatDate(iso).split(" ").slice(1).join(" ");
    const m0 = monthOf(days[0]);
    const m6 = monthOf(days[6]);
    return {
      monthLabel: sameMonth ? `${m6} ${d6.getFullYear()}` : `${m0} — ${m6}`,
      rangeLabel: sameMonth
        ? `${d0.getDate()} – ${d6.getDate()} ${m6}`
        : `${formatDate(days[0])} – ${formatDate(days[6])}`,
    };
  }, [days]);

  // ---------- الهيكل ----------
  if (!data || !settings) {
    return (
      <div
        className="h-full overflow-y-auto sys-scroll px-4 pt-3 pb-28"
        aria-busy="true"
        aria-label="جارٍ تحميل التقويم"
      >
        <div className="glass-soft mb-3 h-16 animate-pulse rounded-3xl" />
        <div className="glass-soft mb-3 h-14 animate-pulse rounded-3xl" />
        <div className="glass-soft h-[560px] animate-pulse rounded-3xl" />
      </div>
    );
  }

  return (
    <div ref={rootRef} className="h-full overflow-y-auto sys-scroll px-4 pt-3 pb-28">
      {/* ═══ ترويسة التنقل الأسبوعي ═══ */}
      <motion.header {...widgetEnter(0)} className="mb-3 flex items-center justify-between gap-2 px-1">
        <div className="min-w-0">
          <div className="flex items-center gap-2">
            <h1 className="truncate text-[16px] font-bold leading-tight">{monthLabel}</h1>
            {conflicts.pairs.length > 0 && (
              <button
                type="button"
                onClick={showConflicts}
                className="flex h-7 shrink-0 items-center gap-1 rounded-full border border-coral/30 bg-coral/15 px-2 text-[10px] font-bold text-coral transition-transform active:scale-95"
                aria-label={`عرض تعارضات الأسبوع: ${conflicts.pairs.length}`}
              >
                <AlertTriangle className="h-3 w-3" aria-hidden="true" />
                <span className="tabular">{conflicts.pairs.length}</span> تعارض
              </button>
            )}
          </div>
          <p className="tabular mt-0.5 text-[10.5px] text-muted-foreground">
            {rangeLabel} · {isCurrentWeek ? "الأسبوع الحالي" : "أسبوع"}
          </p>
        </div>

        <div className="flex shrink-0 items-center gap-1.5">
          <button
            type="button"
            onClick={() => shiftWeek(-1)}
            className="flex h-11 w-11 items-center justify-center rounded-2xl glass-soft border border-white/[0.08] transition-all hover:bg-white/[0.06] active:scale-95"
            aria-label="الأسبوع السابق"
          >
            <ChevronRight className="h-5 w-5" aria-hidden="true" />
          </button>
          <button
            type="button"
            onClick={goToday}
            disabled={isCurrentWeek && selected === today}
            className="h-11 rounded-2xl glass-soft border border-white/[0.08] px-3.5 text-[12px] font-bold text-foreground/90 transition-all hover:bg-white/[0.06] active:scale-95 disabled:opacity-40"
            aria-label="الانتقال إلى اليوم"
          >
            اليوم
          </button>
          <button
            type="button"
            onClick={() => shiftWeek(1)}
            className="flex h-11 w-11 items-center justify-center rounded-2xl glass-soft border border-white/[0.08] transition-all hover:bg-white/[0.06] active:scale-95"
            aria-label="الأسبوع التالي"
          >
            <ChevronLeft className="h-5 w-5" aria-hidden="true" />
          </button>
          <motion.button
            type="button"
            whileTap={{ scale: 0.9 }}
            onClick={openAddDefault}
            className="flex h-11 w-11 items-center justify-center rounded-2xl border border-primary/40 bg-primary/15 text-primary transition-colors hover:bg-primary/25"
            aria-label="إضافة حدث"
          >
            <Plus className="h-5 w-5" strokeWidth={2.4} aria-hidden="true" />
          </motion.button>
        </div>
      </motion.header>

      {/* ═══ بطاقة الأسبوع: صف الأيام + شريط طول اليوم + الشبكة ═══ */}
      <motion.div {...widgetEnter(0.06)}>
        <GlassCard className="overflow-hidden">
          {/* صف الأيام — محاذٍ لأعمدة الشبكة */}
          <div className="flex border-b border-white/[0.06]">
            <div
              className="flex w-11 shrink-0 items-center justify-center border-e border-white/[0.06]"
              aria-hidden="true"
            >
              <Clock3 className="h-3.5 w-3.5 text-muted-foreground/50" />
            </div>
            <div className="grid flex-1 grid-cols-7">
              {days.map((day) => {
                const isToday = day === today;
                const isSelected = day === selected;
                const dayCount = eventsByDay.get(day)?.length ?? 0;
                return (
                  <button
                    key={day}
                    type="button"
                    onClick={() => setSelected(day)}
                    aria-label={`تحديد ${day}${dayCount > 0 ? `، ${dayCount} أحداث` : ""}`}
                    aria-pressed={isSelected}
                    className="flex min-h-[56px] flex-col items-center justify-center gap-1 py-1.5 transition-colors hover:bg-white/[0.04] active:bg-white/[0.07]"
                  >
                    <span className="text-[10px] text-muted-foreground">{dayNameShort(day)}</span>
                    <span
                      className={cn(
                        "tabular flex h-7 w-7 items-center justify-center rounded-full text-[12px] font-bold transition-all",
                        isToday
                          ? "bg-primary text-primary-foreground shadow-[0_0_14px_rgba(245,185,92,0.5)]"
                          : "text-foreground",
                        isSelected && !isToday && "ring-2 ring-primary/60",
                        isSelected &&
                          isToday &&
                          "ring-2 ring-primary/50 ring-offset-2 ring-offset-[#0B0F1A]"
                      )}
                    >
                      {Number(day.slice(8, 10))}
                    </span>
                    {/* نقاط عدد الأحداث — حتى ثلاث */}
                    <span className="flex h-1 items-center justify-center gap-[3px]" aria-hidden="true">
                      {Array.from({ length: Math.min(3, dayCount) }, (_, i) => (
                        <span key={i} className="h-1 w-1 rounded-full bg-primary/85" />
                      ))}
                    </span>
                  </button>
                );
              })}
            </div>
          </div>

          {/* شريط «طول اليوم»: التزامات مستحقة + مهام بلا وقت لليوم المحدد */}
          {allDay.length > 0 && (
            <div className="no-scrollbar flex gap-2 overflow-x-auto border-b border-white/[0.06] px-3 py-2.5">
              {allDay.map((ev) => {
                if (ev.source === "task") {
                  const done = ev.taskDone === true;
                  return (
                    <button
                      key={ev.id}
                      type="button"
                      onClick={() => void toggleTask(ev.taskId as string)}
                      aria-label={`${done ? "إرجاع إنجاز" : "إنجاز"} ${ev.title}`}
                      className={cn(
                        "flex h-9 shrink-0 items-center gap-1.5 rounded-full border px-3 text-[11px] font-medium transition-all active:scale-95",
                        done
                          ? "border-mint/30 bg-mint/10 text-mint/80"
                          : "border-cyan/30 bg-cyan/10 text-cyan"
                      )}
                    >
                      {done ? (
                        <CheckSquare className="h-3.5 w-3.5 shrink-0" aria-hidden="true" />
                      ) : (
                        <Square className="h-3.5 w-3.5 shrink-0" aria-hidden="true" />
                      )}
                      <span className={cn("max-w-[140px] truncate", done && "line-through opacity-70")}>
                        {ev.title}
                      </span>
                    </button>
                  );
                }
                const rColor = ev.color ?? "#F5B95C";
                const RecIcon = iconByName((ev.icon ?? "bell").toLowerCase());
                return (
                  <button
                    key={ev.id}
                    type="button"
                    onClick={() => setDetailsEvent(ev)}
                    aria-label={`تفاصيل ${ev.title}`}
                    className="flex h-9 shrink-0 items-center gap-1.5 rounded-full border px-3 text-[11px] font-medium transition-transform active:scale-95"
                    style={{ borderColor: `${rColor}55`, background: `${rColor}1c`, color: rColor }}
                  >
                    <RecIcon className="h-3.5 w-3.5 shrink-0" aria-hidden="true" />
                    <span className="max-w-[130px] truncate">{ev.title}</span>
                    {ev.amount != null && (
                      <span className="tabular shrink-0 text-[10px] font-bold">
                        {formatMoney(ev.amount, currency)}
                      </span>
                    )}
                  </button>
                );
              })}
            </div>
          )}

          {/* تلميح اليوم الفارغ */}
          {selectedEvents.length === 0 && (
            <div className="border-b border-white/[0.06] px-4 py-5 text-center">
              <p className="text-[12px] text-muted-foreground">
                يومك فارغ — <span className="font-medium text-primary/90">المس الشبكة لإضافة حدث</span>
              </p>
            </div>
          )}

          {/* الشبكة الزمنية */}
          <WeekGrid
            days={days}
            eventsByDay={eventsByDay}
            conflictIds={conflicts.ids}
            onSlotTap={(date, startMinute) => openFormAt(date, startMinute)}
            onEventTap={(ev) => setDetailsEvent(ev)}
            nowLineRef={nowLineRef}
          />

          <p className="border-t border-white/[0.06] px-3 py-2 text-[10px] leading-relaxed text-muted-foreground/70">
            المس أي فراغ لإضافة حدث · الأحداث المتداخلة تظهر بإطار مرجاني · الشبكة من 7 صباحاً حتى 11 مساءً
          </p>
        </GlassCard>
      </motion.div>

      {/* ═══ النوافذ ═══ */}
      <BlockFormDialog
        open={formOpen}
        onOpenChange={setFormOpen}
        init={formInit}
        tasks={openTasks}
        habits={activeHabits}
      />
      <BlockDetailsDialog
        event={detailsEvent}
        onOpenChange={(o) => {
          if (!o) setDetailsEvent(null);
        }}
        onEdit={openEditFromEvent}
        tasks={data.tasks}
        habits={data.habits}
        currency={currency}
      />
    </div>
  );
}
