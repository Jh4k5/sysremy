"use client";

/**
 * Systemy (تكامل Life-os) — بطاقة مؤقت التركيز بمحرك التقنيات
 * نقل مفاهيم محرك التركيز من Life-os `app/(tabs)/more/focus/index.tsx:28-33,109-195`
 * إلى لهجة Systemy: ٤ تقنيات (بومودورو ٢٥/٥×٤ · ٥٢/١٧ · عميق ٩٠/٢٠×٢ · مخصص)
 * وآلة مراحل (تركيز ← استراحة قصيرة ← … ← استراحة طويلة بعد اكتمال الدورات)
 * تتقدم تلقائياً مع نغمة الاكتمال.
 * التسجيل الصادق (تميّز Life-os): إنهاء الجلسة في منتصف مرحلة تركيز يُسجّل
 * FocusSession بالدقائق الفعلية (completed: false) بدل إهدارها، مع ملاحظة
 * «سُجّلت ١٢ دقيقة جزئية» — والمرجاني للمقطوعة وحدها.
 * المحفوظ من v3: كتلة التقويم التلقائية (addBlock بنوع work)، نغمة Web Audio،
 * العدّ بطوابع زمنية (ينجو من تبديل التبويب)، Select المهمة، واللغة البصرية.
 * تذييل الإحصاءات من focusWeekStats — رقائق ribbon-soft لكل تقنية.
 */

import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { motion } from "framer-motion";
import {
  Brain,
  Check,
  Coffee,
  Pause,
  Play,
  RotateCcw,
  SkipForward,
  Sofa,
  Square,
  Zap,
  type LucideIcon,
} from "lucide-react";
import { toast } from "sonner";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { addBlock, addFocusSession, focusWeekStats } from "@/lib/actions";
import { nowHHMM, todayISO } from "@/lib/format";
import { FOCUS_TECHNIQUES, type FocusSession, type FocusTechnique, type Task } from "@/lib/types";
import { GlassCard, widgetEnter } from "@/components/systemy/glass";
import { cn } from "@/lib/utils";

/* ═══════════════ ثوابت التصميم — لغة «الشريط» V5 ═══════════════
 * أدوات الشريط غير حاضرة في globals.css بهذه البيئة (فرع التكامل مبنيّ على
 * أساس ما قبل V5) فتُعرَّف محلياً بنفس قيم --grad-ribbon الأصلية —
 * نفس منهج قوالب العادات (شريحة E1) — بلا أي لمسة لملفات خارج الحد المسموح. */

/** تدرّج الشريط الكامل — للتقدّم والإبراز */
const RIBBON_GRAD = "linear-gradient(90deg, #00cdfe, #3e9bf6 32%, #febb18 66%, #fd4c10)";

/** خلفية شريط خافتة للأسطح (ما يعادل .ribbon-soft) */
const RIBBON_SOFT =
  "linear-gradient(90deg, rgba(0,205,254,0.14), rgba(62,155,246,0.14) 32%, rgba(254,187,24,0.16) 66%, rgba(253,76,16,0.14))";

/** ضغط V5 — 0.96 بالضبط، انتقالات محدّدة الخصائص (ممنوع transition:all) */
const press =
  "transition-[transform,color,background-color,border-color] duration-150 ease-out active:scale-[0.96]";

/** أرقام هندية للعدّادات الصغيرة (الدورات/الطاقة/الإحصاءات) — التايمر الكبير لاتيني tabular كالمعهود */
const AR_DIGITS = ["٠", "١", "٢", "٣", "٤", "٥", "٦", "٧", "٨", "٩"];
const ar = (n: number) => String(n).replace(/\d/g, (d) => AR_DIGITS[+d]);

const clamp = (n: number, lo: number, hi: number) => Math.max(lo, Math.min(hi, n));

const TICK_MS = 300;
const TECH_KEYS: FocusTechnique[] = ["pomodoro", "52-17", "deep", "custom"];
const ENERGY_LEVELS = [1, 2, 3, 4, 5];

type Phase = "focus" | "short" | "long";

/** إعداد المراحل الجاري — يُثبَّت عند بدء الجلسة (cfgRef) */
interface PhaseCfg {
  focus: number;
  short: number;
  long: number;
  cycles: number;
}

const PHASE_META: Record<Phase, { label: string; icon: LucideIcon; hint: string }> = {
  focus: { label: "تركيز", icon: Brain, hint: "لا شيء غير المهمة أمامك" },
  short: { label: "استراحة قصيرة", icon: Coffee, hint: "قف، تمدّد، وارتشفة ماء" },
  long: { label: "استراحة طويلة", icon: Sofa, hint: "أنهيت دورة كاملة — خذ راحة تستحقها" },
};

const minutesFor = (p: Phase, cfg: PhaseCfg) => (p === "focus" ? cfg.focus : p === "long" ? cfg.long : cfg.short);

const selectTriggerCls =
  "h-12 rounded-xl glass-soft border border-black/[0.07] px-4 text-[13.5px] text-foreground focus:ring-0";

type WeekStat = { technique: FocusTechnique; minutes: number; sessions: number };

/** ملخص ما بعد إنهاء الجلسة — rounds = دورات كاملة، partialMin = دقائق مرحلة مقطوعة */
interface EndedSummary {
  rounds: number;
  partialMin: number;
}

export function FocusTimerCard({ openTasks }: { openTasks: Task[] }) {
  // ---------- إعداد الجلسة (قبل البدء) ----------
  const [techKey, setTechKey] = useState<FocusTechnique>("pomodoro");
  const [customFocus, setCustomFocus] = useState(25);
  const [customBreak, setCustomBreak] = useState(5);
  const [taskId, setTaskId] = useState("");
  const [energy, setEnergy] = useState<number | null>(null);

  // ---------- حالة التشغيل ----------
  const [running, setRunning] = useState(false);
  const [phase, setPhase] = useState<Phase>("focus");
  const [cycle, setCycle] = useState(0); // دورات التركيز المكتملة (تراكمي)
  const [elapsedBase, setElapsedBase] = useState(0);
  const [runStart, setRunStart] = useState<number | null>(null);
  const [nowTick, setNowTick] = useState(() => Date.now());
  const [busy, setBusy] = useState(false);
  const [ended, setEnded] = useState<EndedSummary | null>(null);

  // ---------- إحصاءات الأسبوع ----------
  const [weekStats, setWeekStats] = useState<WeekStat[] | null>(null);

  // ---------- مراجع تقرؤها الحفظة دون إعادة إنشاء (نمط v3 القائم) ----------
  const cfgRef = useRef<PhaseCfg>({ focus: 25, short: 5, long: 15, cycles: 4 });
  const phaseRef = useRef<Phase>("focus");
  const cycleRef = useRef(0);
  const techRef = useRef<FocusTechnique>("pomodoro");
  const energyRef = useRef<number | null>(null);
  const taskRef = useRef<{ id: string; title: string } | null>(null);
  const phaseWallRef = useRef<{ date: string; time: string } | null>(null);
  const savedRef = useRef(false); // حماية من تكرار تسجيل المرحلة الواحدة
  const completingRef = useRef(false); // حماية من ازدواج لحظة الاكتمال
  const audioRef = useRef<AudioContext | null>(null);

  const selectedTask = taskId ? openTasks.find((t) => t.id === taskId) ?? null : null;

  useEffect(() => {
    taskRef.current = selectedTask ? { id: selectedTask.id, title: selectedTask.title } : null;
  }, [selectedTask]);

  // إعداد التقنية الحالية (يُقفل في cfgRef عند البدء)
  const cfg = useMemo<PhaseCfg>(() => {
    if (techKey === "custom") {
      const brk = clamp(customBreak, 1, 60);
      return {
        focus: clamp(customFocus, 5, 180),
        short: brk,
        long: Math.max(FOCUS_TECHNIQUES.custom.longBreak, brk),
        cycles: FOCUS_TECHNIQUES.custom.cycles,
      };
    }
    const d = FOCUS_TECHNIQUES[techKey];
    return { focus: d.focusMin, short: d.shortBreak, long: d.longBreak, cycles: d.cycles };
  }, [techKey, customFocus, customBreak]);

  // ---------- الصوت (نغمة اكتمال — محفوظة من v3) ----------
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

  // ---------- الإحصاءات ----------
  const loadStats = useCallback(async () => {
    try {
      setWeekStats(await focusWeekStats());
    } catch {
      // القراءة تحسين
    }
  }, []);

  useEffect(() => {
    void loadStats();
  }, [loadStats]);

  // ---------- تسجيل مرحلة تركيز (كتلة التقويم + جلسة صادقة) ----------
  const logPhase = useCallback(
    async (minutes: number, completed: boolean) => {
      if (savedRef.current) return;
      savedRef.current = true;
      setBusy(true);
      const t = taskRef.current;
      const started = phaseWallRef.current ?? { date: todayISO(), time: nowHHMM() };
      try {
        // سلوك v3 المحفوظ: كتلة عمل على التقويم لكل جلسة تركيز
        await addBlock({
          title: `جلسة تركيز: ${t ? t.title : "عام"}`,
          type: "work",
          date: started.date,
          startTime: started.time,
          endTime: nowHHMM(),
          taskId: t?.id,
          icon: "timer",
        });
        // تسجيل Life-os الصادق: المكتملة والجزئية سواء
        const session: Omit<FocusSession, "id" | "createdAt"> = {
          technique: techRef.current,
          task: t?.title ?? "جلسة تركيز",
          taskId: t?.id,
          minutes,
          energyBefore: energyRef.current ?? undefined,
          completed,
          date: todayISO(),
        };
        await addFocusSession(session);
        void loadStats();
      } catch {
        // التسجيل تحسين — لا يفشل التدفق
      } finally {
        setBusy(false);
      }
    },
    [loadStats],
  );

  // ---------- آلة المراحل ----------
  const startPhase = useCallback((p: Phase) => {
    phaseRef.current = p;
    setPhase(p);
    phaseWallRef.current = { date: todayISO(), time: nowHHMM() };
    completingRef.current = false;
    savedRef.current = false;
    setElapsedBase(0);
    const now = Date.now();
    setRunStart(now); // تتقدم المراحل بلا توقف تلقائي
    setNowTick(now);
  }, []);

  /** اكتمال المرحلة طبيعياً → تسجيل + نغمة + المرحلة التالية (نقل Life-os advance) */
  const completePhase = useCallback(async () => {
    const p = phaseRef.current;
    chime();
    if (typeof navigator !== "undefined" && "vibrate" in navigator) navigator.vibrate?.(200);
    if (p === "focus") {
      const focusMin = minutesFor("focus", cfgRef.current);
      await logPhase(focusMin, true);
      const nextCycle = cycleRef.current + 1;
      cycleRef.current = nextCycle;
      setCycle(nextCycle);
      const next: Phase = nextCycle % cfgRef.current.cycles === 0 ? "long" : "short";
      startPhase(next);
      toast.success("اكتملت دورة تركيز 🎉", {
        description: `${ar(focusMin)} دقيقة${taskRef.current ? ` على «${taskRef.current.title}»` : " من التركيز الخالص"} — ${next === "long" ? "استراحة طويلة" : "استراحة قصيرة"} الآن`,
      });
    } else {
      startPhase("focus");
      toast("انتهت الاستراحة", { description: "عُد إلى التركيز — دورة جديدة تبدأ الآن" });
    }
  }, [chime, logPhase, startPhase]);

  // ---------- النبض — طوابع زمنية لا عدّ فواصل (نمط v3 المحفوظ) ----------
  useEffect(() => {
    if (!running || ended || runStart === null) return;
    const totalMs = minutesFor(phase, cfgRef.current) * 60_000;
    const id = window.setInterval(() => {
      const t = Date.now();
      const elapsed = elapsedBase + (t - runStart);
      if (elapsed >= totalMs) {
        if (completingRef.current) return;
        completingRef.current = true;
        setNowTick(t);
        void completePhase();
      } else {
        setNowTick(t);
      }
    }, TICK_MS);
    return () => window.clearInterval(id);
  }, [running, ended, runStart, elapsedBase, phase, completePhase]);

  // ---------- الإجراءات ----------
  const start = () => {
    primeAudio();
    cfgRef.current = cfg;
    techRef.current = techKey;
    energyRef.current = energy;
    cycleRef.current = 0;
    setCycle(0);
    setEnded(null);
    setRunning(true);
    startPhase("focus");
  };

  const pauseResume = () => {
    if (!running || ended) return;
    if (runStart === null) {
      const now = Date.now();
      setRunStart(now);
      setNowTick(now);
    } else {
      setElapsedBase((b) => b + (Date.now() - runStart));
      setRunStart(null);
    }
  };

  /** تخطي الاستراحة → دورة تركيز جديدة فوراً (الاستراحات لا تُسجَّل) */
  const skipBreak = () => {
    if (phaseRef.current === "focus") return;
    startPhase("focus");
  };

  /**
   * إنهاء الجلسة — التسجيل الصادق: منتصف مرحلة تركيز تُسجَّل بالدقائق الفعلية
   * (completed: false) مع ملاحظة «سُجّلت N دقيقة جزئية»، وأقل من دقيقة تُصفَّر.
   */
  const endSession = async () => {
    if (busy) return;
    const p = phaseRef.current;
    const elapsed = elapsedBase + (runStart !== null ? Date.now() - runStart : 0);
    const minutes = Math.floor(elapsed / 60_000);
    const rounds = cycleRef.current;
    let partialMin = 0;
    if (p === "focus" && minutes >= 1) {
      partialMin = minutes;
      await logPhase(minutes, false);
    } else if (p === "focus") {
      savedRef.current = true; // أقل من دقيقة — بلا تسجيل (سلوك v3)
    }
    setRunStart(null);
    setElapsedBase(0);
    setRunning(false);
    setEnded({ rounds, partialMin });
    const t = taskRef.current?.title;
    if (partialMin > 0) {
      toast.success("سُجّلت جلسة جزئية ✓", {
        description: `${ar(partialMin)} دقيقة${t ? ` على «${t}»` : " من التركيز"} — مقطوعة قبل اكتمال الدورة`,
      });
    } else if (rounds === 0) {
      toast("أنهيت الجلسة دون تسجيل", { description: "أقل من دقيقة تركيز" });
    } else {
      toast.success("أنهيت جلسة التركيز ✓", { description: `${ar(rounds)} دورة تركيز كاملة` });
    }
  };

  const newSession = () => {
    setEnded(null);
    setRunning(false);
    setCycle(0);
    cycleRef.current = 0;
    setElapsedBase(0);
    setRunStart(null);
    setPhase("focus");
    phaseRef.current = "focus";
    phaseWallRef.current = null;
    savedRef.current = false;
  };

  // ---------- قيم العرض ----------
  const phaseMinutes = minutesFor(phase, cfg);
  const totalMs = phaseMinutes * 60_000;
  const elapsedMs = running ? Math.max(0, elapsedBase + (runStart !== null ? nowTick - runStart : 0)) : 0;
  const remainingMs = Math.max(0, totalMs - elapsedMs);
  const progress = totalMs > 0 ? Math.min(1, elapsedMs / totalMs) : 0;
  const totalSec = Math.ceil(remainingMs / 1000);
  const mm = String(Math.floor(totalSec / 60)).padStart(2, "0");
  const ss = String(totalSec % 60).padStart(2, "0");
  const isBreak = phase !== "focus";
  const paused = running && runStart === null;

  // الدورة الحالية ضمن الطقم (١/٤ …) — بعد الاستراحة الطويلة يبدأ طقم جديد
  const currentRound = phase === "focus" ? (cycle % cfg.cycles) + 1 : cycle % cfg.cycles === 0 ? cfg.cycles : cycle % cfg.cycles;
  const dotsFilled = phase === "focus" ? cycle % cfg.cycles : currentRound;

  const totalWeekMin = weekStats?.reduce((a, s) => a + s.minutes, 0) ?? 0;
  const totalWeekSessions = weekStats?.reduce((a, s) => a + s.sessions, 0) ?? 0;

  const techDef = FOCUS_TECHNIQUES[techKey];
  const hintLine =
    techKey === "custom"
      ? `${ar(cfg.cycles)} دورات × ${ar(cfg.focus)} دقيقة · استراحة ${ar(cfg.short)} د`
      : `${techDef.hint} · استراحة طويلة ${ar(cfg.long)} د`;

  const PhaseIcon = PHASE_META[phase].icon;

  return (
    <motion.div {...widgetEnter(0.08)} className="mb-3">
      <GlassCard className="overflow-hidden">
        {/* ═══ رأس البطاقة ═══ */}
        <div className="flex items-center justify-between gap-2 border-b border-black/[0.05] px-4 py-3">
          <span className="flex items-center gap-2 text-[13px] font-semibold text-foreground/90">
            <Brain className="h-4 w-4 shrink-0 text-cyan" aria-hidden="true" />
            مؤقت التركيز
          </span>
          <span className="flex items-center gap-1.5 text-[10px] text-muted-foreground">
            {running ? (
              <span
                className={cn(
                  "tabular rounded-full px-2 py-0.5 font-bold",
                  paused ? "bg-black/[0.04]" : "bg-cyan/15 text-cyan",
                )}
              >
                {paused ? "متوقفة" : "جارية"}
              </span>
            ) : ended ? (
              <span className="tabular rounded-full bg-mint/15 px-2 py-0.5 font-bold text-mint">منتهية</span>
            ) : (
              <span className="rounded-full px-2 py-0.5 font-bold text-foreground/80" style={{ background: RIBBON_SOFT }}>
                {techDef.label}
              </span>
            )}
          </span>
        </div>

        <div className="space-y-4 p-4">
          {/* ═══ إعداد الجلسة (قبل البدء) ═══ */}
          {!running && !ended && (
            <>
              {/* رقائق التقنيات */}
              <div className="flex flex-wrap gap-2" role="radiogroup" aria-label="تقنية جلسة التركيز">
                {TECH_KEYS.map((k) => {
                  const active = techKey === k;
                  return (
                    <button
                      key={k}
                      type="button"
                      role="radio"
                      aria-checked={active}
                      aria-label={`${FOCUS_TECHNIQUES[k].label} — ${FOCUS_TECHNIQUES[k].hint}`}
                      onClick={() => setTechKey(k)}
                      className={cn(
                        "h-11 min-h-11 rounded-xl border px-3.5 text-[12.5px] font-bold",
                        press,
                        active
                          ? "border-white/25 text-foreground"
                          : "glass-soft border-black/[0.07] text-foreground/75 hover:bg-black/[0.04]",
                      )}
                      style={active ? { background: RIBBON_SOFT } : undefined}
                    >
                      {FOCUS_TECHNIQUES[k].label}
                    </button>
                  );
                })}
              </div>
              <p className="text-[11px] text-muted-foreground">{hintLine}</p>

              {/* مدخلات المخصص */}
              {techKey === "custom" && (
                <div className="grid grid-cols-2 gap-2.5">
                  <label className="block">
                    <span className="mb-1 block text-[10.5px] font-bold text-muted-foreground">دقائق التركيز (٥–١٨٠)</span>
                    <input
                      type="number"
                      inputMode="numeric"
                      dir="ltr"
                      min={5}
                      max={180}
                      value={customFocus}
                      onChange={(e) => setCustomFocus(clamp(parseInt(e.target.value || "0", 10) || 5, 5, 180))}
                      className="tabular h-12 w-full rounded-xl glass-soft border border-black/[0.07] px-3 text-center text-[14px] font-bold text-foreground focus:border-primary/40 focus:outline-none"
                      aria-label="دقائق التركيز للمخصص، من ٥ إلى ١٨٠"
                    />
                  </label>
                  <label className="block">
                    <span className="mb-1 block text-[10.5px] font-bold text-muted-foreground">دقائق الاستراحة</span>
                    <input
                      type="number"
                      inputMode="numeric"
                      dir="ltr"
                      min={1}
                      max={60}
                      value={customBreak}
                      onChange={(e) => setCustomBreak(clamp(parseInt(e.target.value || "0", 10) || 1, 1, 60))}
                      className="tabular h-12 w-full rounded-xl glass-soft border border-black/[0.07] px-3 text-center text-[14px] font-bold text-foreground focus:border-primary/40 focus:outline-none"
                      aria-label="دقائق الاستراحة للمخصص"
                    />
                  </label>
                </div>
              )}

              {/* المهمة الاختيارية */}
              <Select
                value={taskId || "none"}
                onValueChange={(v) => setTaskId(v === "none" ? "" : v)}
                dir="rtl"
              >
                <SelectTrigger className={selectTriggerCls} aria-label="اختيار مهمة للجلسة">
                  <SelectValue placeholder="تركيز عام (بدون مهمة)" />
                </SelectTrigger>
                <SelectContent className="max-h-64 rounded-xl border-black/[0.08] bg-white">
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

              {/* الطاقة قبل البدء (اختياري) */}
              <div>
                <p className="mb-1.5 flex items-center gap-1.5 text-[10.5px] font-bold text-muted-foreground">
                  <Zap className="h-3.5 w-3.5 shrink-0 text-gold" aria-hidden="true" />
                  طاقتك قبل البدء (اختياري — تُسجَّل مع الجلسة)
                </p>
                <div className="flex gap-2" role="radiogroup" aria-label="مستوى الطاقة قبل الجلسة، من ١ إلى ٥">
                  {ENERGY_LEVELS.map((n) => {
                    const active = energy === n;
                    return (
                      <button
                        key={n}
                        type="button"
                        role="radio"
                        aria-checked={active}
                        aria-label={`طاقة ${ar(n)} من ٥`}
                        onClick={() => setEnergy((cur) => (cur === n ? null : n))}
                        className={cn(
                          "h-11 w-11 min-h-11 rounded-xl border text-[14px] font-bold tabular",
                          press,
                          active
                            ? "border-white/25 text-foreground"
                            : "glass-soft border-black/[0.07] text-foreground/70 hover:bg-black/[0.04]",
                        )}
                        style={active ? { background: RIBBON_SOFT } : undefined}
                      >
                        {ar(n)}
                      </button>
                    );
                  })}
                </div>
              </div>
            </>
          )}

          {/* ═══ ملخص ما بعد الجلسة ═══ */}
          {ended && (
            <motion.div
              initial={{ scale: 0.85, opacity: 0 }}
              animate={{ scale: 1, opacity: 1 }}
              transition={{ type: "spring", stiffness: 200, damping: 18 }}
              className="flex flex-col items-center gap-1.5 py-1 text-center"
            >
              <span className="flex h-12 w-12 items-center justify-center rounded-full bg-mint/15 text-mint">
                <Check className="h-6 w-6" strokeWidth={2.5} aria-hidden="true" />
              </span>
              <p className="text-[15px] font-bold text-foreground">
                {ended.rounds > 0 ? `أنهيت الجلسة — ${ar(ended.rounds)} دورة كاملة` : "أنهيت الجلسة"}
              </p>
              {/* التسجيل الصادق: الجزئية المقاطعة تُذكر صراحة — المرجاني للمقطوعة وحدها */}
              {ended.partialMin > 0 ? (
                <p className="flex flex-wrap items-center justify-center gap-1.5 text-[11.5px] text-muted-foreground">
                  <span className="rounded-full border border-coral/40 bg-coral/10 px-2 py-0.5 text-[10px] font-bold text-coral">
                    مقطوعة
                  </span>
                  سُجّلت {ar(ended.partialMin)} دقيقة جزئية
                </p>
              ) : ended.rounds > 0 ? (
                <p className="text-[11px] text-muted-foreground">
                  سُجّلت على التقويم{selectedTask ? ` وربطت بـ«${selectedTask.title}»` : ""}
                </p>
              ) : (
                <p className="text-[11px] text-muted-foreground">أقل من دقيقة — لم تُسجَّل</p>
              )}
            </motion.div>
          )}

          {/* ═══ التايمر والمراحل (أثناء التشغيل) ═══ */}
          {running && (
            <div className="space-y-2.5 pt-1 text-center" role="timer" aria-label={`${PHASE_META[phase].label}، متبقٍ ${mm}:${ss}`}>
              <motion.div
                key={phase}
                initial={{ opacity: 0, y: 6 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ duration: 0.25, ease: [0.22, 1, 0.36, 1] }}
                className="flex flex-wrap items-center justify-center gap-2"
              >
                {/* حبة المرحلة — شريط V5 */}
                <span
                  className="inline-flex items-center gap-1.5 rounded-full px-3 py-1 text-[11px] font-bold"
                  style={isBreak ? { background: RIBBON_SOFT, color: "var(--foreground)" } : { background: RIBBON_GRAD, color: "#071019" }}
                >
                  <PhaseIcon className="h-3.5 w-3.5 shrink-0" aria-hidden="true" />
                  {PHASE_META[phase].label}
                </span>
                <span className="tabular text-[11px] font-bold text-muted-foreground">
                  {phase === "focus" ? `الدورة ${ar(currentRound)}/${ar(cfg.cycles)}` : `بعد الدورة ${ar(currentRound)}/${ar(cfg.cycles)}`}
                </span>
                {/* نقاط الدورات */}
                <span className="flex items-center gap-1" aria-hidden="true">
                  {Array.from({ length: cfg.cycles }).map((_, i) => (
                    <span
                      key={i}
                      className="h-2 w-2 rounded-full transition-colors duration-150"
                      style={i < dotsFilled ? { background: RIBBON_GRAD } : { background: "rgba(255,255,255,0.14)" }}
                    />
                  ))}
                </span>
              </motion.div>

              <p className="num-display tabular text-[46px] leading-none" dir="ltr" aria-hidden="true">
                {mm}:{ss}
              </p>
              <p className="text-[11px] text-muted-foreground">
                {paused
                  ? "متوقف مؤقتاً — استأنف متى شئت"
                  : phase === "focus"
                    ? selectedTask
                      ? `تركيز على «${selectedTask.title}»`
                      : "تركيز خالص — لا شيء آخر"
                    : PHASE_META[phase].hint}
              </p>

              {/* شريط التقدم — تعبئة الشريط (قاعدة V5: الشريط للتقدّم) */}
              <div
                className="h-1.5 overflow-hidden rounded-full bg-black/[0.04]"
                role="progressbar"
                aria-valuenow={Math.round(progress * 100)}
                aria-valuemin={0}
                aria-valuemax={100}
                aria-label={`تقدم ${PHASE_META[phase].label}`}
              >
                <motion.div
                  className="h-full rounded-full"
                  style={{ background: RIBBON_GRAD }}
                  initial={false}
                  animate={{ width: `${progress * 100}%` }}
                  transition={{ duration: 0.3, ease: "linear" }}
                />
              </div>
            </div>
          )}

          {/* ═══ الأزرار — كلها ≥44px ═══ */}
          {ended ? (
            <button
              type="button"
              onClick={newSession}
              className={cn("flex h-14 w-full items-center justify-center gap-2 rounded-2xl bg-primary text-[15px] font-bold text-primary-foreground glow-gold", press)}
            >
              <RotateCcw className="h-5 w-5" aria-hidden="true" />
              جلسة جديدة
            </button>
          ) : running ? (
            <div className={cn("grid gap-2.5", isBreak ? "grid-cols-3" : "grid-cols-2")}>
              {isBreak && (
                <button
                  type="button"
                  onClick={skipBreak}
                  className={cn("flex h-14 items-center justify-center gap-1.5 rounded-2xl glass-soft border border-black/[0.07] text-[13px] font-bold text-foreground/80 hover:bg-black/[0.04]", press)}
                  aria-label="تخطي الاستراحة والعودة للتركيز"
                >
                  <SkipForward className="h-5 w-5" aria-hidden="true" />
                  تخطي
                </button>
              )}
              <button
                type="button"
                onClick={pauseResume}
                className={cn("flex h-14 items-center justify-center gap-2 rounded-2xl glass-soft border border-black/[0.07] text-[13.5px] font-bold hover:bg-black/[0.04]", press)}
              >
                {runStart !== null ? (
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
                className={cn(
                  "flex h-14 items-center justify-center gap-2 rounded-2xl border border-coral/40 text-[13.5px] font-bold text-coral hover:bg-coral/10 disabled:opacity-50",
                  press,
                )}
              >
                <Square className="h-5 w-5" aria-hidden="true" />
                {busy ? "جارٍ التسجيل…" : "إنهاء الجلسة"}
              </button>
            </div>
          ) : (
            <button
              type="button"
              onClick={start}
              className={cn("flex h-14 w-full items-center justify-center gap-2 rounded-2xl bg-primary text-[15px] font-bold text-primary-foreground glow-gold", press)}
            >
              <Play className="h-5 w-5" aria-hidden="true" />
              ابدأ التركيز — <span className="tabular">{ar(cfg.focus)}</span> دقيقة
            </button>
          )}

          {/* ═══ تذييل الإحصاءات — هذا الأسبوع ═══ */}
          <div className="border-t border-black/[0.05] pt-3">
            {weekStats === null ? (
              <p className="text-[11px] text-muted-foreground">…</p>
            ) : totalWeekMin === 0 ? (
              <p className="text-[11px] text-muted-foreground">لا جلسات تركيز هذا الأسبوع بعد — أول دورة تُحسب فوراً</p>
            ) : (
              <div className="space-y-2">
                <p className="text-[11.5px] text-muted-foreground">
                  هذا الأسبوع:{" "}
                  <span className="tabular font-bold text-foreground">{ar(totalWeekMin)}</span> دقيقة تركيز
                  <span className="tabular"> في {ar(totalWeekSessions)} جلسة</span>
                </p>
                <div className="flex flex-wrap gap-1.5">
                  {weekStats.map((s) => (
                    <span
                      key={s.technique}
                      className="tabular rounded-full px-2.5 py-1 text-[10.5px] font-bold text-foreground/85"
                      style={{ background: RIBBON_SOFT }}
                      aria-label={`${FOCUS_TECHNIQUES[s.technique].label}: ${ar(s.minutes)} دقيقة في ${ar(s.sessions)} جلسة`}
                    >
                      {FOCUS_TECHNIQUES[s.technique].label} {ar(s.minutes)}د
                    </span>
                  ))}
                </div>
              </div>
            )}
          </div>
        </div>
      </GlassCard>
    </motion.div>
  );
}
