/**
 * Systemy v2 — أدوات التقويم (أحداث موحدة من كل الأنظمة)
 * التقويم يجمع: الأحداث المضافة + المهام المجدولة + عادات مؤقتة +
 * استحقاقات الالتزامات — كلها كأحداث يومية موحدة.
 */
import type { Habit, Recurring, Task, TimeBlock, Transaction } from "./types";
import { hhmmToMinutes, minutesToHHMM } from "./format";

/** شبكة اليوم: من 7 صباحاً إلى 23 مساءً */
export const DAY_START_HOUR = 7;
export const DAY_END_HOUR = 23;
export const HOUR_H = 52;
export const HOURS_COUNT = DAY_END_HOUR - DAY_START_HOUR;
export const GRID_H = HOURS_COUNT * HOUR_H;
export const DAY_START_MIN = DAY_START_HOUR * 60;
export const DAY_END_MIN = DAY_END_HOUR * 60;

export const BLOCK_TYPE_LABELS: Record<TimeBlock["type"], string> = {
  work: "عمل",
  personal: "شخصي",
  health: "صحة",
  learning: "تعلم",
  rest: "راحة",
  other: "أخرى",
};

export const BLOCK_TYPE_COLORS: Record<TimeBlock["type"], string> = {
  work: "#F5B95C",
  personal: "#C4B5FD",
  health: "#6EE7A8",
  learning: "#5CE1E6",
  rest: "#FFB4A2",
  other: "#94A3B8",
};

export const BLOCK_TYPE_ICONS: Record<TimeBlock["type"], string> = {
  work: "briefcase",
  personal: "user",
  health: "heart-pulse",
  learning: "graduation-cap",
  rest: "leaf",
  other: "shapes",
};

/** حدث موحّد في الشبكة — من أي نظام */
export interface CalEvent {
  id: string;
  source: "block" | "task" | "recurring" | "habit";
  title: string;
  type: TimeBlock["type"];
  date: string; // ISODate
  start: string; // 'HH:mm'
  end: string; // 'HH:mm'
  allDay?: boolean;
  taskId?: string;
  habitId?: string;
  recurringId?: string;
  note?: string;
  color?: string;
  icon?: string;
  amount?: number;
  taskDone?: boolean;
}

export function blockToEvent(b: TimeBlock): CalEvent {
  return {
    id: b.id,
    source: "block",
    title: b.title,
    type: b.type,
    date: b.date,
    start: b.startTime,
    end: b.endTime,
    taskId: b.taskId,
    habitId: b.habitId,
    note: b.note,
    color: b.color ?? BLOCK_TYPE_COLORS[b.type],
  };
}

/** مهمة لها وقت → حدث، وإلا حدث بلا وقت (allDay) */
export function taskToEvent(t: Task): CalEvent {
  const ev: CalEvent = {
    id: `task-${t.id}`,
    source: "task",
    title: t.title,
    type: "personal",
    date: t.date,
    start: t.time ?? "00:00",
    end: t.time ? minutesToHHMM(hhmmToMinutes(t.time) + Math.max(15, t.estimatedMinutes ?? 45)) : "00:00",
    taskId: t.id,
    taskDone: t.done,
    icon: t.done ? "check-square" : "square",
  };
  if (!t.time) ev.allDay = true;
  return ev;
}

/** التزام متكرر → حدث بلا وقت في يوم استحقاقه */
export function recurringToEvent(r: Recurring): CalEvent {
  return {
    id: `rec-${r.id}`,
    source: "recurring",
    title: r.name,
    type: "work",
    date: r.nextDate,
    start: "00:00",
    end: "00:00",
    allDay: true,
    recurringId: r.id,
    amount: r.amount,
    icon: r.icon,
    color: r.type === "income" ? "#6EE7A8" : "#F5B95C",
  };
}

/** عادة بمؤقت → حدث مقترح في وقت تذكيرها (اختياري للعرض) */
export function habitToEvent(h: Habit): CalEvent | null {
  if (!h.timerMinutes || !h.remindAt) return null;
  return {
    id: `habit-${h.id}`,
    source: "habit",
    title: h.name,
    type: "health",
    start: h.remindAt,
    end: minutesToHHMM(hhmmToMinutes(h.remindAt) + h.timerMinutes),
    date: "", // يُملأ لكل يوم
    habitId: h.id,
    color: h.color,
    icon: h.icon,
  };
}

/** أحداث يوم واحد من كل الأنظمة */
export function dayEvents(
  iso: string,
  blocks: TimeBlock[],
  tasks: Task[],
  recurrings: Recurring[],
  txs: Transaction[] = [],
): CalEvent[] {
  const out: CalEvent[] = [];
  for (const b of blocks) if (b.date === iso) out.push(blockToEvent(b));
  for (const t of tasks) if (t.date === iso) out.push(taskToEvent(t));
  for (const r of recurrings) if (r.active && r.nextDate === iso) out.push(recurringToEvent(r));
  // معاملات اليوم كأحداث بلا وقت (سطر صغير أسفل الشبكة)
  const dayTxs = txs.filter((t) => t.date.slice(0, 10) === iso);
  for (const t of dayTxs) {
    out.push({
      id: `tx-${t.id}`,
      source: "block",
      title: t.description,
      type: "other",
      date: iso,
      start: t.date.slice(11, 16),
      end: t.date.slice(11, 16),
      amount: t.type === "income" ? t.amount : -t.amount,
      icon: t.type === "income" ? "arrow-down-left" : "arrow-up-right",
      color: t.type === "income" ? "#6EE7A8" : "#FF8E7A",
    });
  }
  return out;
}

/** دقائق التداخل بين حدثين (0 = لا تداخل) */
function overlapMin(a: CalEvent, b: CalEvent): number {
  const s = Math.max(hhmmToMinutes(a.start), hhmmToMinutes(b.start));
  const e = Math.min(hhmmToMinutes(a.end), hhmmToMinutes(b.end));
  return e - s;
}

// ------------------------------------------------------------
// تخطيط الأحداث المتداخلة جنبًا إلى جنب
// ------------------------------------------------------------

export interface LaidEvent {
  ev: CalEvent;
  col: number;
  span: number;
  total: number;
}

/** توزيع أحداث يوم واحد في أعمدة حسب التداخل */
export function layoutDay(events: CalEvent[]): LaidEvent[] {
  const timed = events.filter((e) => !e.allDay);
  const sorted = [...timed].sort(
    (a, b) => hhmmToMinutes(a.start) - hhmmToMinutes(b.start) || hhmmToMinutes(b.end) - hhmmToMinutes(a.end),
  );
  const out: LaidEvent[] = [];
  let cluster: CalEvent[] = [];
  let clusterEnd = -Infinity;

  const flush = () => {
    if (cluster.length === 0) return;
    const assign = new Map<string, number>();
    const colEnds: number[] = [];
    for (const ev of cluster) {
      const s = hhmmToMinutes(ev.start);
      let col = colEnds.findIndex((cEnd) => cEnd <= s);
      if (col === -1) {
        col = colEnds.length;
        colEnds.push(hhmmToMinutes(ev.end));
      } else {
        colEnds[col] = hhmmToMinutes(ev.end);
      }
      assign.set(ev.id, col);
    }
    const total = Math.max(1, colEnds.length);
    for (const ev of cluster) {
      const col = assign.get(ev.id) ?? 0;
      let span = 1;
      for (let c = col + 1; c < total; c++) {
        const busy = cluster.some((o) => (assign.get(o.id) ?? 0) === c && overlapMin(ev, o) > 0);
        if (busy) break;
        span++;
      }
      out.push({ ev, col, span, total });
    }
    cluster = [];
    clusterEnd = -Infinity;
  };

  for (const ev of sorted) {
    const s = hhmmToMinutes(ev.start);
    if (cluster.length > 0 && s >= clusterEnd) flush();
    cluster.push(ev);
    clusterEnd = Math.max(clusterEnd, hhmmToMinutes(ev.end));
  }
  flush();
  return out;
}

/** موضع الحدث داخل الشبكة بالبكسل (مثبت داخل الحدود) */
export function eventTopHeight(ev: CalEvent): { top: number; height: number } {
  const s = Math.max(hhmmToMinutes(ev.start), DAY_START_MIN);
  const e = Math.min(Math.max(hhmmToMinutes(ev.end), s + 15), DAY_END_MIN);
  const top = ((s - DAY_START_MIN) / 60) * HOUR_H;
  const height = Math.max(((e - s) / 60) * HOUR_H, 18);
  return { top, height };
}

/** مدة الحدث بالدقائق */
export function eventDurationMin(ev: CalEvent): number {
  return Math.max(0, hhmmToMinutes(ev.end) - hhmmToMinutes(ev.start));
}

/** صيغة ساعات مختصرة: "12 س" / "12 س 30 د" / "45 د" */
export function hoursLabel(minutes: number): string {
  if (minutes <= 0) return "0";
  const h = Math.floor(minutes / 60);
  const m = minutes % 60;
  if (h === 0) return `${m} د`;
  if (m === 0) return `${h} س`;
  return `${h} س ${m} د`;
}

/** التعارضات */
export interface ConflictPair {
  a: CalEvent;
  b: CalEvent;
  day: string;
}

export function findConflicts(events: CalEvent[]): { ids: Set<string>; pairs: ConflictPair[] } {
  const ids = new Set<string>();
  const pairs: ConflictPair[] = [];
  const byDay = new Map<string, CalEvent[]>();
  for (const ev of events) {
    if (ev.allDay) continue;
    const list = byDay.get(ev.date) ?? [];
    list.push(ev);
    byDay.set(ev.date, list);
  }
  for (const [day, list] of byDay) {
    for (let i = 0; i < list.length; i++) {
      for (let j = i + 1; j < list.length; j++) {
        if (overlapMin(list[i], list[j]) > 0) {
          pairs.push({ a: list[i], b: list[j], day });
          ids.add(list[i].id);
          ids.add(list[j].id);
        }
      }
    }
  }
  return { ids, pairs };
}
