"use client";

/**
 * Systemy v2 — مؤقت العادة (جلسة تركيز بملء الشاشة)
 * عدّ تنازلي MM:SS من timerMinutes بطوابع زمنية (لا يضيع وقتاً عند الإيقاف)،
 * حلقة تقدم بلون العادة، إيقاف/استئناف، +5 دقائق، وإنهاء وتسجيل.
 * الوصول للصفر → تسجيل تلقائي عبر logHabit(id, target, elapsedMinutes)
 * مع الحفاظ على إنجاز اليوم إن كانت مكتملة (تُضاف الدقائق فقط).
 */

import { useCallback, useEffect, useRef, useState } from "react";
import { motion } from "framer-motion";
import { Check, Pause, Play, Plus, X } from "lucide-react";
import { toast } from "sonner";
import { db } from "@/lib/db";
import { logHabit } from "@/lib/actions";
import { todayISO } from "@/lib/format";
import type { Habit } from "@/lib/types";
import { ConfirmBar, iconByName } from "@/components/systemy/ui-bits";
import { cn } from "@/lib/utils";

const TICK_MS = 300;
const AUTO_SAVE_DELAY_MS = 1200;
const R = 100;
const CIRC = 2 * Math.PI * R;

export interface HabitTimerProps {
  /** العادة — null يعني مغلق */
  habit: Habit | null;
  onClose: () => void;
}

/** مؤقت ملء الشاشة — يُركَّب لكل جلسة على حدة */
export function HabitTimer({ habit, onClose }: HabitTimerProps) {
  if (!habit) return null;
  return <HabitTimerSession key={habit.id} habit={habit} onClose={onClose} />;
}

function HabitTimerSession({ habit, onClose }: { habit: Habit; onClose: () => void }) {
  const totalMs = Math.max(1, habit.timerMinutes ?? 15) * 60_000;

  const [durationMs, setDurationMs] = useState(totalMs);
  const [elapsedBase, setElapsedBase] = useState(0);
  const [runStart, setRunStart] = useState<number | null>(() => Date.now());
  const [nowTick, setNowTick] = useState<number>(() => Date.now());
  const [finished, setFinished] = useState(false);
  const [confirmExit, setConfirmExit] = useState(false);
  const [busy, setBusy] = useState(false);
  const [savedMinutes, setSavedMinutes] = useState<number | null>(null);

  const savedRef = useRef(false);
  const liveRef = useRef({ elapsedMs: 0 });

  // آخر قيمة للمنقضي — يقرؤها تنظيف إلغاء التركيب
  useEffect(() => {
    liveRef.current.elapsedMs = elapsedBase + (runStart !== null ? Date.now() - runStart : 0);
  });

  /** التسجيل الفعلي — يحافظ على إنجاز اليوم إن كانت مكتملة مسبقاً */
  const saveLog = useCallback(async (minutes: number) => {
    const target = Math.max(1, habit.target);
    const existing = await db.habitLogs
      .where("habitId")
      .equals(habit.id)
      .filter((l) => l.date === todayISO())
      .first();
    if (existing && existing.count >= target) {
      // مكتملة اليوم: نضيف الدقائق ونُبقي الإنجاز (بلا مكافأة ادخار مكررة)
      await logHabit(habit.id, undefined, minutes);
    } else {
      await logHabit(habit.id, target, minutes);
    }
  }, [habit.id, habit.target]);

  const complete = useCallback(
    async (minutes: number, auto: boolean) => {
      if (savedRef.current) return;
      savedRef.current = true;
      setBusy(true);
      try {
        await saveLog(minutes);
        setSavedMinutes(minutes);
        toast.success(
          auto ? `أحسنت! أنجزت ${minutes} دقيقة 🎉` : `سُجّلت ${minutes} دقيقة على «${habit.name}» ✓`
        );
      } finally {
        setBusy(false);
      }
    },
    [habit.name, saveLog]
  );

  // تسجيل تلقائي عند إلغاء التركيب إن مرّت دقيقة ولم يُسجَّل شيء
  useEffect(() => {
    return () => {
      const mins = Math.round(liveRef.current.elapsedMs / 60_000);
      if (savedRef.current || mins < 1) return;
      void saveLog(mins).catch(() => undefined);
    };
  }, [saveLog]);

  // النبض — طوابع زمنية لا عدّ فواصل ساذج
  useEffect(() => {
    if (runStart === null || finished) return;
    const id = window.setInterval(() => {
      const t = Date.now();
      const elapsed = elapsedBase + (t - runStart);
      if (elapsed >= durationMs) {
        setFinished(true);
        setElapsedBase(durationMs);
        setRunStart(null);
        setNowTick(t);
        window.setTimeout(
          () => void complete(Math.max(1, Math.round(durationMs / 60_000)), true),
          AUTO_SAVE_DELAY_MS
        );
      } else {
        setNowTick(t);
      }
    }, TICK_MS);
    return () => window.clearInterval(id);
  }, [runStart, elapsedBase, durationMs, finished, complete]);

  // ---------- قيم العرض ----------
  const running = runStart !== null;
  const elapsedMs = Math.max(0, elapsedBase + (running ? nowTick - runStart : 0));
  const remainingMs = Math.max(0, durationMs - elapsedMs);
  const progress = durationMs > 0 ? Math.min(1, elapsedMs / durationMs) : 0;
  const totalSec = Math.ceil(remainingMs / 1000);
  const mm = String(Math.floor(totalSec / 60)).padStart(2, "0");
  const ss = String(totalSec % 60).padStart(2, "0");
  const plannedMinutes = Math.max(1, Math.round(durationMs / 60_000));
  const estimatedMinutes = Math.max(1, Math.round(elapsedMs / 60_000));
  const underMinute = elapsedMs < 60_000;

  // ---------- الإجراءات ----------
  const pauseResume = () => {
    if (finished) return;
    if (runStart === null) {
      setRunStart(Date.now());
      setNowTick(Date.now());
    } else {
      setElapsedBase((b) => b + (Date.now() - runStart));
      setRunStart(null);
    }
  };

  const addFive = () => {
    if (finished) return;
    setDurationMs((d) => d + 5 * 60_000);
  };

  const finishEarly = async () => {
    setConfirmExit(false);
    if (underMinute) {
      savedRef.current = true; // منع التسجيل التلقائي عند التفكيك
      toast("خرجت دون تسجيل الوقت", { description: "مرّ أقل من دقيقة على المؤقت" });
      onClose();
      return;
    }
    await complete(estimatedMinutes, false);
    onClose();
  };

  const finishAndClose = async () => {
    if (!savedRef.current) await complete(plannedMinutes, true);
    onClose();
  };

  const askExit = () => {
    if (savedRef.current) {
      onClose();
      return;
    }
    if (finished) {
      void finishAndClose();
      return;
    }
    if (underMinute) {
      onClose();
      return;
    }
    setConfirmExit(true);
  };

  const Icon = iconByName(habit.icon.toLowerCase());
  const ringColor = finished ? "#6EE7A8" : habit.color;

  return (
    <div
      className="glass-deep fixed inset-0 z-[70] flex flex-col"
      role="dialog"
      aria-modal="true"
      aria-label={`مؤقت العادة ${habit.name}`}
    >
      <motion.div
        initial={{ opacity: 0, y: 18 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.35, ease: [0.22, 1, 0.36, 1] }}
        className="flex h-full flex-col"
      >
        {/* الرأس */}
        <header className="flex items-center justify-between gap-3 border-b border-white/[0.07] p-4">
          <div className="flex min-w-0 items-center gap-2.5">
            <span
              className="flex h-11 w-11 shrink-0 items-center justify-center rounded-2xl"
              style={{
                background: `${habit.color}1f`,
                border: `1px solid ${habit.color}44`,
                color: habit.color,
              }}
            >
              <Icon className="h-5 w-5" aria-hidden="true" />
            </span>
            <div className="min-w-0">
              <p className="truncate text-[14px] font-bold leading-tight">{habit.name}</p>
              <p className="tabular text-[11px] text-muted-foreground">
                جلسة تركيز · الهدف {plannedMinutes} دقيقة
              </p>
            </div>
          </div>
          <button
            type="button"
            onClick={askExit}
            aria-label="إغلاق المؤقت"
            className="flex h-11 w-11 shrink-0 items-center justify-center rounded-2xl glass-soft border border-white/[0.08] text-muted-foreground transition-colors hover:text-foreground"
          >
            <X className="h-5 w-5" aria-hidden="true" />
          </button>
        </header>

        <div className="sys-scroll flex flex-1 flex-col items-center justify-center gap-8 overflow-y-auto px-6 py-8">
          {/* حلقة العدّاد */}
          <div
            className="relative shrink-0"
            role="timer"
            aria-label={finished ? `اكتمل مؤقت ${habit.name}` : `${mm}:${ss} متبقية`}
          >
            <svg viewBox="0 0 240 240" className="h-60 w-60 -rotate-90" aria-hidden="true">
              <circle cx="120" cy="120" r={R} fill="none" stroke="rgba(255,255,255,0.08)" strokeWidth="11" />
              <circle
                cx="120"
                cy="120"
                r={R}
                fill="none"
                stroke={ringColor}
                strokeWidth="11"
                strokeLinecap="round"
                strokeDasharray={CIRC}
                strokeDashoffset={CIRC * (1 - progress)}
                style={{ transition: "stroke-dashoffset 0.35s linear" }}
              />
            </svg>
            <div className="absolute inset-0 flex flex-col items-center justify-center gap-1.5">
              {finished ? (
                <>
                  <Check className="h-10 w-10 text-mint" aria-hidden="true" />
                  <p className="text-[15px] font-bold text-mint">أحسنت!</p>
                </>
              ) : (
                <>
                  <p className="num-display tabular text-[52px] leading-none" dir="ltr">
                    {mm}:{ss}
                  </p>
                  {!running && <p className="text-[11px] text-muted-foreground">متوقف مؤقتاً</p>}
                </>
              )}
            </div>
          </div>

          {confirmExit ? (
            <div className="w-full max-w-xs">
              <ConfirmBar
                message={`تسجيل ${estimatedMinutes} دقيقة على «${habit.name}» قبل الخروج؟`}
                confirmLabel="تسجيل وخروج"
                danger={false}
                onConfirm={() => void finishEarly()}
                onCancel={() => setConfirmExit(false)}
              />
            </div>
          ) : finished ? (
            <div className="w-full max-w-xs space-y-3 text-center">
              <p className="text-[13.5px] font-bold leading-relaxed">
                أنجزت <span className="tabular text-mint">{plannedMinutes}</span> دقيقة من «{habit.name}»
              </p>
              <p
                className={cn(
                  "text-[11.5px]",
                  savedMinutes !== null ? "font-bold text-mint" : "text-muted-foreground"
                )}
              >
                {savedMinutes !== null ? "سُجّلت في عدّاد اليوم ✓" : "يُسجَّل تلقائياً بعد لحظات…"}
              </p>
              <button
                type="button"
                onClick={() => void finishAndClose()}
                disabled={busy}
                className="flex h-14 w-full items-center justify-center gap-2 rounded-2xl bg-primary text-[15px] font-bold text-primary-foreground glow-gold transition-transform active:scale-[0.98] disabled:opacity-50"
              >
                <Check className="h-5 w-5" aria-hidden="true" />
                {busy ? "جارٍ التسجيل…" : "أكملت"}
              </button>
            </div>
          ) : (
            <div className="w-full max-w-xs space-y-2.5">
              <div className="flex items-center justify-center gap-2 text-[11px] text-muted-foreground">
                <span className="glass-soft tabular rounded-full px-2.5 py-1">
                  الهدف <span className="font-bold">{plannedMinutes}</span> د
                </span>
                <span className="glass-soft tabular rounded-full px-2.5 py-1">
                  مضى <span className="font-bold">{Math.floor(elapsedMs / 60_000)}</span> د
                </span>
              </div>
              <div className="grid grid-cols-2 gap-2.5">
                <button
                  type="button"
                  onClick={pauseResume}
                  className="flex h-14 items-center justify-center gap-2 rounded-2xl glass-soft border border-white/[0.08] text-[13.5px] font-bold transition-all hover:bg-white/[0.06] active:scale-[0.97]"
                >
                  {running ? (
                    <Pause className="h-5 w-5" aria-hidden="true" />
                  ) : (
                    <Play className="h-5 w-5" aria-hidden="true" />
                  )}
                  {running ? "إيقاف مؤقت" : "استئناف"}
                </button>
                <button
                  type="button"
                  onClick={addFive}
                  className="flex h-14 items-center justify-center gap-2 rounded-2xl glass-soft border border-white/[0.08] text-[13.5px] font-bold transition-all hover:bg-white/[0.06] active:scale-[0.97]"
                >
                  <Plus className="h-5 w-5" aria-hidden="true" />
                  <span className="tabular">5</span> دقائق
                </button>
              </div>
              <button
                type="button"
                onClick={() => void finishEarly()}
                className="flex h-14 w-full items-center justify-center gap-2 rounded-2xl border border-primary/40 bg-primary/10 text-[13.5px] font-bold text-primary transition-colors hover:bg-primary/20 active:scale-[0.98]"
              >
                <Check className="h-5 w-5" aria-hidden="true" />
                أكملت — سجّل <span className="tabular">{estimatedMinutes}</span> دقيقة
              </button>
            </div>
          )}
        </div>
      </motion.div>
    </div>
  );
}
