"use client";

/**
 * Systemy v2 — شبكة الأسبوع (7 أعمدة أيام × 16 ساعة)
 * RTL: عمود الساعات يميناً ثم أول أيام الأسبوع على اليمين.
 * المس فراغاً في عمود يوم → إضافة حدث عند أقرب نصف ساعة لموضع اللمس.
 * خط «الآن» الذهبي يتحدث كل دقيقة حين يكون اليوم ضمن الأسبوع المعروض.
 */

import { useEffect, useMemo, useState, type MouseEvent as ReactMouseEvent, type RefObject } from "react";
import { CheckSquare, Square } from "lucide-react";
import type { CalEvent } from "@/lib/calendar-utils";
import {
  BLOCK_TYPE_COLORS,
  DAY_END_MIN,
  DAY_START_HOUR,
  DAY_START_MIN,
  DAY_END_HOUR,
  GRID_H,
  HOUR_H,
  eventTopHeight,
  layoutDay,
} from "@/lib/calendar-utils";
import { formatTimeAr, hhmmToMinutes, minutesToHHMM, nowHHMM, todayISO } from "@/lib/format";
import { cn } from "@/lib/utils";

const HOURS = Array.from({ length: DAY_END_HOUR - DAY_START_HOUR }, (_, i) => DAY_START_HOUR + i);

export interface WeekGridProps {
  days: string[];
  eventsByDay: Map<string, CalEvent[]>;
  conflictIds: Set<string>;
  onSlotTap: (date: string, startMinute: number) => void;
  onEventTap: (ev: CalEvent) => void;
  nowLineRef?: RefObject<HTMLDivElement | null>;
}

export function WeekGrid({
  days,
  eventsByDay,
  conflictIds,
  onSlotTap,
  onEventTap,
  nowLineRef,
}: WeekGridProps) {
  const today = todayISO();
  const todayInView = days.includes(today);

  // خط «الآن» — يُحدَّث كل دقيقة، فقط حين يكون اليوم ضمن الأسبوع المعروض
  const [nowMin, setNowMin] = useState<number>(() => hhmmToMinutes(nowHHMM()));
  useEffect(() => {
    if (!todayInView) return;
    const sync = () => setNowMin(hhmmToMinutes(nowHHMM()));
    const t0 = setTimeout(sync, 0); // مزامنة أولى مؤجلة خارج جسم التأثير
    const t = setInterval(sync, 60_000);
    return () => {
      clearTimeout(t0);
      clearInterval(t);
    };
  }, [todayInView]);

  const nowVisible = todayInView && nowMin >= DAY_START_MIN && nowMin < DAY_END_MIN;
  const nowTop = ((nowMin - DAY_START_MIN) / 60) * HOUR_H;

  return (
    <div className="flex select-none" aria-label="شبكة الأسبوع الزمنية">
      {/* عمود الساعات — على اليمين في RTL */}
      <div className="w-11 shrink-0 relative border-e border-black/[0.05]" style={{ height: GRID_H }} aria-hidden="true">
        {HOURS.map((h) => (
          <div
            key={h}
            className="absolute inset-x-0 flex justify-center"
            style={{ top: (h - DAY_START_HOUR) * HOUR_H, height: HOUR_H }}
          >
            <span className="tabular -translate-y-1/2 text-[9px] text-muted-foreground/80">
              {formatTimeAr(`${h}:00`)}
            </span>
          </div>
        ))}
        {nowVisible && (
          <div className="absolute inset-x-1 z-10 flex justify-center -translate-y-1/2" style={{ top: nowTop }}>
            <span className="tabular rounded bg-white/90 px-1 text-[8.5px] font-bold text-gold shadow-[0_0_0_1px_rgba(23,33,43,0.08)]">
              {formatTimeAr(minutesToHHMM(nowMin))}
            </span>
          </div>
        )}
      </div>

      {/* أعمدة الأيام — أولها على اليمين */}
      {days.map((day) => (
        <DayColumn
          key={day}
          day={day}
          isToday={day === today}
          events={eventsByDay.get(day) ?? []}
          conflictIds={conflictIds}
          nowTop={nowVisible && day === today ? nowTop : null}
          nowLineRef={day === today ? nowLineRef : undefined}
          onSlotTap={onSlotTap}
          onEventTap={onEventTap}
        />
      ))}
    </div>
  );
}

// ------------------------------------------------------------
// عمود يوم واحد
// ------------------------------------------------------------

interface DayColumnProps {
  day: string;
  isToday: boolean;
  events: CalEvent[];
  conflictIds: Set<string>;
  nowTop: number | null;
  nowLineRef?: RefObject<HTMLDivElement | null>;
  onSlotTap: (date: string, startMinute: number) => void;
  onEventTap: (ev: CalEvent) => void;
}

function DayColumn({
  day,
  isToday,
  events,
  conflictIds,
  nowTop,
  nowLineRef,
  onSlotTap,
  onEventTap,
}: DayColumnProps) {
  const laid = useMemo(() => layoutDay(events), [events]);

  /** المس فراغ → أقرب نصف ساعة لموضع اللمس */
  const handleTap = (e: ReactMouseEvent<HTMLDivElement>) => {
    const rect = e.currentTarget.getBoundingClientRect();
    const y = e.clientY - rect.top;
    const minute = DAY_START_MIN + Math.max(0, Math.floor(((y / HOUR_H) * 60) / 30) * 30);
    onSlotTap(day, Math.min(minute, DAY_END_MIN - 30));
  };

  const keyboardSlot = () => {
    const base = isToday ? hhmmToMinutes(nowHHMM()) : 10 * 60;
    onSlotTap(day, Math.min(Math.max(base, DAY_START_MIN), DAY_END_MIN - 60));
  };

  return (
    <div
      className={cn("relative min-w-0 flex-1", isToday && "bg-primary/[0.04]")}
      style={{ height: GRID_H }}
    >
      {/* طبقة اللمس (الفراغ) */}
      <div
        className="absolute inset-0 z-0 cursor-pointer transition-colors active:bg-black/[0.03]"
        role="button"
        tabIndex={0}
        aria-label={`عمود يوم ${day} — المس لإضافة حدث`}
        onClick={handleTap}
        onKeyDown={(e) => {
          if (e.key === "Enter" || e.key === " ") {
            e.preventDefault();
            keyboardSlot();
          }
        }}
      />

      {/* خطوط الساعات */}
      {HOURS.map((h) => (
        <div
          key={h}
          className="pointer-events-none absolute inset-x-0 border-t border-black/[0.04]"
          style={{ top: (h - DAY_START_HOUR) * HOUR_H, height: HOUR_H }}
          aria-hidden="true"
        />
      ))}

      {/* خط «الآن» */}
      {nowTop !== null && (
        <div
          ref={nowLineRef}
          className="pointer-events-none absolute inset-x-0 z-[6]"
          style={{ top: nowTop }}
          aria-hidden="true"
        >
          <div className="h-[2px] bg-primary shadow-[0_0_10px_rgba(245,185,92,0.85)]" />
          <span className="absolute -top-[3px] start-0 h-2 w-2 rounded-full bg-primary" />
        </div>
      )}

      {/* الأحداث */}
      {laid.map(({ ev, col, span, total }) => {
        const { top, height } = eventTopHeight(ev);
        const color = ev.color ?? BLOCK_TYPE_COLORS[ev.type];
        const conflicted = conflictIds.has(ev.id);
        const isTask = ev.source === "task";
        const showTime = height >= 40;
        return (
          <button
            key={ev.id}
            type="button"
            onClick={(e) => {
              e.stopPropagation();
              onEventTap(ev);
            }}
            aria-label={`${ev.title}، من ${formatTimeAr(ev.start)} إلى ${formatTimeAr(ev.end)}${conflicted ? "، متعارض مع حدث آخر" : ""}`}
            className="absolute z-[5] overflow-hidden rounded-lg px-1 pt-[3px] text-right shadow-sm transition-transform active:scale-[0.97] focus:outline-none focus-visible:ring-1 focus-visible:ring-primary"
            style={{
              top,
              height,
              right: `${((col / total) * 100).toFixed(3)}%`,
              width: `calc(${((span / total) * 100).toFixed(3)}% - 3px)`,
              background: `${color}22`,
              border: `1px solid ${conflicted ? "#FF8E7A" : `${color}66`}`,
              boxShadow: conflicted ? "0 0 0 1.5px rgba(255,142,122,0.45)" : undefined,
              color: "#f2f5fb",
              touchAction: "manipulation",
            }}
          >
            <span className="flex items-center gap-[3px]">
              {isTask &&
                (ev.taskDone ? (
                  <CheckSquare className="h-2.5 w-2.5 shrink-0" aria-hidden="true" />
                ) : (
                  <Square className="h-2.5 w-2.5 shrink-0" aria-hidden="true" />
                ))}
              <span
                className={cn(
                  "block truncate text-[9px] font-bold leading-[1.25]",
                  ev.taskDone && "line-through opacity-60"
                )}
              >
                {ev.title}
              </span>
            </span>
            {showTime && (
              <span className="tabular mt-[1px] block text-[7.5px] leading-none opacity-80" dir="ltr">
                {formatTimeAr(ev.start)}
              </span>
            )}
          </button>
        );
      })}
    </div>
  );
}
