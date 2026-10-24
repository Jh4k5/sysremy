"use client";

/**
 * Systemy v3 — بطاقة مؤقت التركيز (بومودورو)
 * مدة 15/25/45/60 دقيقة برقائق + مهمة اختيارية + وقت متبقٍ بخط كبير tabular.
 * عدّ بطوابع زمنية دقيقة (لا يضيع وقتاً عند إيقاف المؤقت مؤقتاً أو التنقل داخل الشاشة
 * — البطاقة مركّبة دائماً في جذر شاشة المهام فلا تُفكَّك بتغيير الفلاتر أو الحوارات).
 * عند الاكتمال: نغمة (Web Audio) + توست نجاح + addBlock بنوع work
 * بعنوان «جلسة تركيز: {المهمة أو عام}» ووقت البدء الفعلي ووقت الآن.
 */

import { useCallback, useEffect, useRef, useState } from "react";
import { motion } from "framer-motion";
import { Brain, Check, Pause, Play, RotateCcw, Square } from "lucide-react";
import { toast } from "sonner";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { addBlock } from "@/lib/actions";
import { nowHHMM, todayISO } from "@/lib/format";
import type { Task } from "@/lib/types";
import { GlassCard, widgetEnter } from "@/components/systemy/glass";
import { cn } from "@/lib/utils";

const DURATIONS = [15, 25, 45, 60];
const TICK_MS = 300;

const selectTriggerCls =
  "h-12 rounded-xl glass-soft border border-white/[0.08] px-4 text-[13.5px] text-foreground focus:ring-0";

export function FocusTimerCard({ openTasks }: { openTasks: Task[] }) {
  const [durationMin, setDurationMin] = useState(25);
  const [taskId, setTaskId] = useState("");
  const [elapsedBase, setElapsedBase] = useState(0);
  const [runStart, setRunStart] = useState<number | null>(null);
  const [nowTick, setNowTick] = useState(() => Date.now());
  const [finished, setFinished] = useState(false);
  const [busy, setBusy] = useState(false);

  const startedWallRef = useRef<{ date: string; time: string } | null>(null);
  const savedRef = useRef(false);
  const audioRef = useRef<AudioContext | null>(null);
  const taskRef = useRef<{ id: string; title: string } | null>(null);

  const selectedTask = taskId ? openTasks.find((t) => t.id === taskId) ?? null : null;

  // آخر مهمة مختارة — تقرأها الحفظة دون إعادة إنشاء
  useEffect(() => {
    taskRef.current = selectedTask ? { id: selectedTask.id, title: selectedTask.title } : null;
  }, [selectedTask]);

  // ---------- الصوت (نغمة اكتمال) ----------
  const primeAudio = useCallback(() => {
    try {
      const g = globalThis as unknown as { AudioContext?: typeof AudioContext; webkitAudioContext?: typeof AudioContext };
      const Ctx = g.AudioContext ?? g.webkitAudioContext;
      if (!Ctx) return;
      let ctx = audioRef.current;
      if (!ctx || ctx.state === "closed") {
        ctx = new Ctx();
        audioRef.current = ctx;
      }
      if (ctx.state === "suspended") void ctx.resume().catch(() => undefined);
    } catch {
      // الصوت تحسين فقط
    }
  }, []);

  const chime = useCallback(() => {
    try {
      primeAudio();
      const ctx = audioRef.current;
      if (!ctx || ctx.state === "closed") return;
      // نغمة صاعدة ثلاثية (C5 · E5 · G5)
      [523.25, 659.25, 783.99].forEach((freq, i) => {
        const osc = ctx.createOscillator();
        const gain = ctx.createGain();
        osc.type = "sine";
        osc.frequency.value = freq;
        const t0 = ctx.currentTime + i * 0.16;
        gain.gain.setValueAtTime(0.0001, t0);
        gain.gain.exponentialRampToValueAtTime(0.22, t0 + 0.04);
        gain.gain.exponentialRampToValueAtTime(0.0001, t0 + 0.5);
        osc.connect(gain);
        gain.connect(ctx.destination);
        osc.start(t0);
        osc.stop(t0 + 0.55);
      });
    } catch {
      // لا يفشل التدفق أبداً
    }
  }, [primeAudio]);

  // ---------- حفظ الجلسة (addBlock) ----------
  const saveSession = useCallback(async (minutes: number, startedAt?: { date: string; time: string }) => {
    if (savedRef.current) return;
    savedRef.current = true;
    setBusy(true);
    try {
      const started = startedAt ?? startedWallRef.current ?? { date: todayISO(), time: nowHHMM() };
      const t = taskRef.current;
      await addBlock({
        title: `جلسة تركيز: ${t ? t.title : "عام"}`,
        type: "work",
        date: started.date,
        startTime: started.time,
        endTime: nowHHMM(),
        taskId: t?.id,
        icon: "timer",
      });
    } finally {
      setBusy(false);
    }
  }, []);

  // ---------- النبض — طوابع زمنية لا عدّ فواصل ----------
  useEffect(() => {
    if (runStart === null || finished) return;
    const id = window.setInterval(() => {
      const t = Date.now();
      const elapsed = elapsedBase + (t - runStart);
      if (elapsed >= durationMin * 60_000) {
        setFinished(true);
        setElapsedBase(durationMin * 60_000);
        setRunStart(null);
        setNowTick(t);
        // اكتمال: نغمة + توست + جلسة على التقويم
        chime();
        if (typeof navigator !== "undefined" && "vibrate" in navigator) navigator.vibrate?.(200);
        const minutes = durationMin;
        const title = taskRef.current?.title;
        void saveSession(minutes)
          .then(() => {
            toast.success("اكتملت جلسة التركيز 🎉", {
              description: `${minutes} دقيقة${title ? ` على «${title}»` : " من التركيز الخالص"}`,
            });
          })
          .catch(() => undefined);
      } else {
        setNowTick(t);
      }
    }, TICK_MS);
    return () => window.clearInterval(id);
  }, [runStart, elapsedBase, durationMin, finished, chime, saveSession]);

  // ---------- قيم العرض ----------
  const running = runStart !== null;
  const sessionActive = !finished && (running || elapsedBase > 0);
  const elapsedMs = Math.max(0, elapsedBase + (running ? nowTick - runStart : 0));
  const totalMs = durationMin * 60_000;
  const remainingMs = Math.max(0, totalMs - elapsedMs);
  const progress = totalMs > 0 ? Math.min(1, elapsedMs / totalMs) : 0;
  const totalSec = Math.ceil(remainingMs / 1000);
  const mm = String(Math.floor(totalSec / 60)).padStart(2, "0");
  const ss = String(totalSec % 60).padStart(2, "0");

  // ---------- الإجراءات ----------
  const start = () => {
    primeAudio();
    const now = Date.now();
    if (!startedWallRef.current) startedWallRef.current = { date: todayISO(), time: nowHHMM() };
    savedRef.current = false;
    setRunStart(now);
    setNowTick(now);
  };

  const pauseResume = () => {
    if (finished) return;
    if (runStart === null) {
      const now = Date.now();
      setRunStart(now);
      setNowTick(now);
    } else {
      setElapsedBase((b) => b + (Date.now() - runStart));
      setRunStart(null);
    }
  };

  /** إنهاء مبكر: يُسجَّل ما مضى إن بلغ دقيقة، وإلا يُصفَّر بلا تسجيل */
  const endSession = async () => {
    if (busy) return;
    const elapsed = elapsedBase + (runStart !== null ? Date.now() - runStart : 0);
    const minutes = Math.floor(elapsed / 60_000);
    const title = taskRef.current?.title;
    const started = startedWallRef.current;
    setRunStart(null);
    setElapsedBase(0);
    setFinished(false);
    startedWallRef.current = null;
    if (minutes >= 1) {
      await saveSession(minutes, started ?? undefined);
      toast.success("سُجّلت جلسة تركيز ✓", {
        description: `${minutes} دقيقة${title ? ` على «${title}»` : " من التركيز"}`,
      });
    } else {
      savedRef.current = true;
      toast("أنهيت الجلسة دون تسجيل", { description: "أقل من دقيقة تركيز" });
    }
  };

  const newSession = () => {
    setFinished(false);
    setElapsedBase(0);
    setRunStart(null);
    startedWallRef.current = null;
    savedRef.current = false;
  };

  return (
    <motion.div {...widgetEnter(0.08)} className="mb-3">
      <GlassCard className="overflow-hidden">
        {/* رأس البطاقة */}
        <div className="flex items-center justify-between gap-2 border-b border-white/[0.06] px-4 py-3">
          <span className="flex items-center gap-2 text-[13px] font-semibold text-foreground/90">
            <Brain className="h-4 w-4 shrink-0 text-cyan" aria-hidden="true" />
            مؤقت التركيز
          </span>
          <span className="flex items-center gap-1.5 text-[10px] text-muted-foreground">
            {sessionActive || finished ? (
              <span
                className={cn(
                  "tabular rounded-full px-2 py-0.5 font-bold",
                  finished ? "bg-mint/15 text-mint" : running ? "bg-cyan/15 text-cyan" : "bg-white/[0.06]"
                )}
              >
                {finished ? "اكتملت" : running ? "جارية" : "متوقفة"}
              </span>
            ) : (
              <span className="tabular">بومودورو</span>
            )}
          </span>
        </div>

        <div className="space-y-4 p-4">
          {/* المدة */}
          <div className={cn("flex flex-wrap gap-2", sessionActive && "opacity-50")} role="radiogroup" aria-label="مدة جلسة التركيز">
            {DURATIONS.map((m) => {
              const active = durationMin === m;
              return (
                <button
                  key={m}
                  type="button"
                  role="radio"
                  aria-checked={active}
                  aria-label={`${m} دقيقة`}
                  disabled={sessionActive}
                  onClick={() => setDurationMin(m)}
                  className={cn(
                    "h-11 min-h-11 rounded-xl border px-4 text-[12.5px] font-bold transition-colors disabled:cursor-not-allowed",
                    active
                      ? "border-primary/60 bg-primary/20 text-primary"
                      : "glass-soft border-white/[0.08] text-foreground/80 hover:bg-white/[0.06]"
                  )}
                >
                  <span className="tabular">{m}</span> د
                </button>
              );
            })}
          </div>

          {/* المهمة الاختيارية */}
          <div className={cn(sessionActive && "opacity-50")}>
            <Select
              value={taskId || "none"}
              onValueChange={(v) => setTaskId(v === "none" ? "" : v)}
              dir="rtl"
              disabled={sessionActive}
            >
              <SelectTrigger className={selectTriggerCls} aria-label="اختيار مهمة للجلسة">
                <SelectValue placeholder="تركيز عام (بدون مهمة)" />
              </SelectTrigger>
              <SelectContent className="max-h-64 rounded-xl border-white/10 bg-[#10152a]">
                <SelectItem value="none" className="text-[13px]">
                  تركيز عام (بدون مهمة)
                </SelectItem>
                {openTasks.map((t) => (
                  <SelectItem key={t.id} value={t.id} className="text-[13px]">
                    <span className="max-w-[220px] truncate">{t.title}</span>
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>

          {/* الوقت المتبقي */}
          <div className="space-y-2.5 pt-1 text-center" role="timer" aria-label={finished ? "اكتملت جلسة التركيز" : `متبقٍ ${mm}:${ss}`}>
            {finished ? (
              <motion.div
                initial={{ scale: 0.85, opacity: 0 }}
                animate={{ scale: 1, opacity: 1 }}
                transition={{ type: "spring", stiffness: 200, damping: 18 }}
                className="flex flex-col items-center gap-1.5 py-1"
              >
                <span className="flex h-12 w-12 items-center justify-center rounded-full bg-mint/15 text-mint">
                  <Check className="h-6 w-6" strokeWidth={2.5} aria-hidden="true" />
                </span>
                <p className="text-[15px] font-bold text-mint">أحسنت — جلسة مكتملة</p>
                <p className="text-[11px] text-muted-foreground">
                  سُجّلت على التقويم{selectedTask ? ` وربطت بـ«${selectedTask.title}»` : ""}
                </p>
              </motion.div>
            ) : (
              <>
                <p className="num-display tabular text-[46px] leading-none" dir="ltr" aria-hidden="true">
                  {mm}:{ss}
                </p>
                <p className="text-[11px] text-muted-foreground">
                  {running
                    ? selectedTask
                      ? `تركيز على «${selectedTask.title}»`
                      : "تركيز خالص — لا شيء آخر"
                    : elapsedBase > 0
                      ? "متوقف مؤقتاً — استأنف متى شئت"
                      : `جلسة ${durationMin} دقيقة${selectedTask ? ` على «${selectedTask.title}»` : ""}`}
                </p>
              </>
            )}

            {/* شريط التقدم */}
            <div
              className="h-1.5 overflow-hidden rounded-full bg-white/[0.06]"
              role="progressbar"
              aria-valuenow={Math.round(progress * 100)}
              aria-valuemin={0}
              aria-valuemax={100}
              aria-label="تقدم جلسة التركيز"
            >
              <motion.div
                className={cn("h-full rounded-full", finished ? "bg-mint" : "bg-cyan")}
                initial={false}
                animate={{ width: `${progress * 100}%` }}
                transition={{ duration: 0.3, ease: "linear" }}
              />
            </div>
          </div>

          {/* الأزرار — كلها ≥44px */}
          {finished ? (
            <button
              type="button"
              onClick={newSession}
              className="flex h-14 w-full items-center justify-center gap-2 rounded-2xl bg-primary text-[15px] font-bold text-primary-foreground glow-gold transition-transform active:scale-[0.98]"
            >
              <RotateCcw className="h-5 w-5" aria-hidden="true" />
              جلسة جديدة
            </button>
          ) : sessionActive ? (
            <div className="grid grid-cols-2 gap-2.5">
              <button
                type="button"
                onClick={pauseResume}
                className="flex h-14 items-center justify-center gap-2 rounded-2xl glass-soft border border-white/[0.08] text-[13.5px] font-bold transition-all hover:bg-white/[0.06] active:scale-[0.97]"
              >
                {running ? (
                  <>
                    <Pause className="h-5 w-5" aria-hidden="true" />
                    إيقاف مؤقت
                  </>
                ) : (
                  <>
                    <Play className="h-5 w-5" aria-hidden="true" />
                    استئناف
                  </>
                )}
              </button>
              <button
                type="button"
                onClick={() => void endSession()}
                disabled={busy}
                className="flex h-14 items-center justify-center gap-2 rounded-2xl border border-coral/40 text-[13.5px] font-bold text-coral transition-colors hover:bg-coral/10 active:scale-[0.97] disabled:opacity-50"
              >
                <Square className="h-5 w-5" aria-hidden="true" />
                {busy ? "جارٍ التسجيل…" : "إنهاء الجلسة"}
              </button>
            </div>
          ) : (
            <button
              type="button"
              onClick={start}
              className="flex h-14 w-full items-center justify-center gap-2 rounded-2xl bg-primary text-[15px] font-bold text-primary-foreground glow-gold transition-transform active:scale-[0.98]"
            >
              <Play className="h-5 w-5" aria-hidden="true" />
              ابدأ التركيز — <span className="tabular">{durationMin}</span> دقيقة
            </button>
          )}
        </div>
      </GlassCard>
    </motion.div>
  );
}
