"use client";

/**
 * Systemy v3 — شاشة الصحة والجسم (التنفيذ الكامل)
 * بطل: شبكة القياسات الست مع −/+ سريع وأهداف. اتجاهات 7/30 يوماً برسم SVG يدوي.
 * مزاج اليوم + سلسلة أسبوع + روابط حية مع العادات والدفتر.
 * كل الكتابة عبر actions (logHealth / deleteHealthLog / saveMood) — لغة تزامن لا تشخيص.
 */

import { useMemo, useState } from "react";
import { motion } from "framer-motion";
import {
  Activity,
  Dumbbell,
  Footprints,
  GlassWater,
  HeartPulse,
  Minus,
  Moon,
  NotebookPen,
  Plus,
  Scale,
  TrendingUp,
  Zap,
  type LucideIcon,
} from "lucide-react";
import { Skeleton } from "@/components/ui/skeleton";
import { Chip, GlassCard, SectionHeader, widgetEnter } from "@/components/systemy/glass";
import { EmptyState } from "@/components/systemy/ui-bits";
import { MetricDialog } from "./metric-dialog";
import { Sparkline, type SparkPoint } from "./sparkline";
import { db, getSettings, useLive } from "@/lib/db";
import { logHealth, saveMood } from "@/lib/actions";
import { HEALTH_META, type HealthKind, type HealthLog } from "@/lib/types";
import {
  MOOD_FACES,
  MOOD_LABELS,
  addDaysISO,
  dayNameShort,
  formatNumber,
  todayISO,
} from "@/lib/format";
import { useUIStore } from "@/store/ui-store";
import { cn } from "@/lib/utils";

/* ═══ ثوابت العرض ═══ */

const KIND_ORDER: HealthKind[] = ["water", "sleep", "energy", "weight", "exercise", "steps"];

const KIND_ICONS: Record<HealthKind, LucideIcon> = {
  water: GlassWater,
  sleep: Moon,
  energy: Zap,
  weight: Scale,
  exercise: Dumbbell,
  steps: Footprints,
};

/** ألوان دوائر المزاج حسب الدرجة 1..5 (نفس لغة الدفتر) */
const MOOD_COLORS = ["#FF8E7A", "#F5B95C", "#C4B5FD", "#6EE7A8", "#5CE1E6"];

/** كلمات تربط العادة بالصحة */
const HEALTH_WORDS = ["صحة", "ماء", "نوم", "تمرين"];

function fmtVal(v: number): string {
  return formatNumber(v, Math.abs(v % 1) > 0.001 ? 1 : 0);
}

/* ═══ بطاقة قياس (البطل) ═══ */

function MetricCard({
  kind,
  value,
  onOpen,
  onBump,
  minusDisabled,
}: {
  kind: HealthKind;
  value: number | null;
  onOpen: () => void;
  onBump: (dir: 1 | -1) => void;
  minusDisabled: boolean;
}) {
  const meta = HEALTH_META[kind];
  const Icon = KIND_ICONS[kind];
  const pct = meta.target > 0 && value != null ? Math.min(100, Math.round((value / meta.target) * 100)) : 0;

  return (
    <GlassCard className="p-3.5">
      {/* جسم البطاقة — ضغطة تفتح الإدخال الدقيق */}
      <div
        role="button"
        tabIndex={0}
        onClick={onOpen}
        onKeyDown={(e) => {
          if (e.key === "Enter" || e.key === " ") {
            e.preventDefault();
            onOpen();
          }
        }}
        aria-label={`إدخال ${meta.label} بدقة — المسجّل اليوم ${value != null ? `${fmtVal(value)} ${meta.unit}` : "لا شيء"}`}
        className="outline-none rounded-2xl cursor-pointer transition-colors hover:bg-black/[0.02] focus-visible:ring-2 focus-visible:ring-primary/40"
      >
        <div className="flex items-center justify-between gap-1.5">
          <span className="flex items-center gap-1.5 min-w-0">
            <span
              className="w-7 h-7 rounded-xl flex items-center justify-center shrink-0"
              style={{ backgroundColor: `${meta.color}1E`, color: meta.color }}
            >
              <Icon className="w-4 h-4" aria-hidden="true" />
            </span>
            <span className="text-[12px] font-semibold truncate">{meta.label}</span>
          </span>
          {meta.target > 0 && (
            <span className="text-[9.5px] text-muted-foreground shrink-0 tabular-nums">
              الهدف {formatNumber(meta.target)}
            </span>
          )}
        </div>

        <div className="mt-2.5 flex items-baseline gap-1">
          <span
            className="text-[26px] leading-none font-bold tabular-nums"
            style={{ color: value != null ? meta.color : undefined }}
          >
            {value != null ? fmtVal(value) : "—"}
          </span>
          <span className="text-[10.5px] text-muted-foreground">{meta.unit}</span>
        </div>

        <div className="mt-2.5 h-1.5 rounded-full bg-black/[0.04] overflow-hidden">
          <div
            className="h-full rounded-full transition-all duration-500"
            style={{ width: `${pct}%`, backgroundColor: meta.color }}
            aria-hidden="true"
          />
        </div>
        {meta.target > 0 && (
          <p className="mt-1.5 text-[9.5px] text-muted-foreground/80 tabular-nums">
            {value != null ? `${formatNumber(pct)}٪ من الهدف` : `الهدف ${formatNumber(meta.target)} ${meta.unit}`}
          </p>
        )}
        {meta.target === 0 && <p className="mt-1.5 text-[9.5px] text-muted-foreground/80">تتبّع حرّ بلا هدف</p>}
      </div>

      {/* أزرار سريعة */}
      <div className="mt-2.5 flex gap-2">
        <button
          type="button"
          disabled={minusDisabled}
          onClick={() => onBump(-1)}
          aria-label={`إنقاص ${meta.label} بمقدار ${fmtVal(meta.step)}`}
          className="flex-1 h-11 min-h-11 rounded-xl glass-soft border border-black/[0.07] flex items-center justify-center text-muted-foreground transition-all hover:bg-black/[0.05] hover:text-foreground active:scale-95 disabled:opacity-30 disabled:cursor-not-allowed"
        >
          <Minus className="w-4 h-4" aria-hidden="true" />
        </button>
        <button
          type="button"
          onClick={() => onBump(1)}
          aria-label={`زيادة ${meta.label} بمقدار ${fmtVal(meta.step)}`}
          className="flex-1 h-11 min-h-11 rounded-xl flex items-center justify-center text-white transition-all active:scale-95 hover:brightness-110"
          style={{ backgroundColor: `${meta.color}2E`, border: `1px solid ${meta.color}55` }}
        >
          <Plus className="w-4 h-4" aria-hidden="true" />
        </button>
      </div>
    </GlassCard>
  );
}

/* ═══ هيكل التحميل ═══ */

function HealthSkeleton() {
  return (
    <div className="h-full overflow-y-auto sys-scroll px-4 pt-3 pb-28" aria-busy="true" aria-label="جارٍ تحميل الصحة">
      <div className="h-14 mb-4 space-y-2">
        <Skeleton className="h-7 w-36 rounded-lg bg-black/[0.04]" />
        <Skeleton className="h-3.5 w-60 rounded-md bg-black/[0.04]" />
      </div>
      <div className="grid grid-cols-2 sm:grid-cols-3 gap-3 mb-4">
        {Array.from({ length: 6 }, (_, i) => (
          <Skeleton key={i} className="h-[136px] rounded-3xl bg-black/[0.03]" />
        ))}
      </div>
      <Skeleton className="h-11 rounded-full bg-black/[0.03] mb-3" />
      <Skeleton className="h-[152px] rounded-3xl bg-black/[0.03] mb-3" />
      <Skeleton className="h-20 rounded-3xl bg-black/[0.03]" />
    </div>
  );
}

/* ═══ الشاشة ═══ */

export function HealthScreen() {
  const setView = useUIStore((s) => s.setView);

  const logs = useLive(() => db.healthLogs.toArray(), []);
  const moods = useLive(() => db.moods.toArray(), []);
  const habits = useLive(() => db.habits.toArray(), []);
  const settings = useLive(() => getSettings(), []);

  const today = todayISO();
  const digits = settings?.digits ?? "latn";

  const [dialogKind, setDialogKind] = useState<HealthKind | null>(null);
  const [range, setRange] = useState<7 | 30>(7);
  const [moodSaving, setMoodSaving] = useState(false);

  /* ─── مشتقات اليوم ─── */
  const todayLogByKind = useMemo(() => {
    const m = new Map<HealthKind, HealthLog>();
    for (const l of logs ?? []) if (l.date === today) m.set(l.kind, l);
    return m;
  }, [logs, today]);

  const totalLogged = logs?.length ?? 0;

  /* ─── الاتجاهات (sparkline يدوي) ─── */
  const trendRows = useMemo(() => {
    if (!logs) return [];
    const days = Array.from({ length: range }, (_, i) => addDaysISO(today, i - (range - 1)));
    const out: Array<{ kind: HealthKind; points: SparkPoint[]; avg: number; max: number }> = [];
    for (const kind of KIND_ORDER) {
      const byDate = new Map<string, number>();
      for (const l of logs) if (l.kind === kind) byDate.set(l.date, l.value);
      const points: SparkPoint[] = [];
      const vals: number[] = [];
      days.forEach((d, i) => {
        const v = byDate.get(d);
        if (v != null) {
          points.push({ x: range > 1 ? i / (range - 1) : 0.5, v });
          vals.push(v);
        }
      });
      if (vals.length >= 3) {
        out.push({
          kind,
          points,
          avg: vals.reduce((a, b) => a + b, 0) / vals.length,
          max: Math.max(...vals),
        });
      }
    }
    return out;
  }, [logs, range, today]);

  /* ─── المزاج ─── */
  const moodByDate = useMemo(() => {
    const m = new Map<string, number>();
    for (const x of moods ?? []) m.set(x.date, x.score);
    return m;
  }, [moods]);

  const moodToday = moodByDate.get(today) ?? null;

  /** سلسلة آخر 7 أيام — الأقدم أقصى اليمين باتجاه القراءة */
  const moodDays = useMemo(
    () =>
      Array.from({ length: 7 }, (_, i) => {
        const iso = addDaysISO(today, i - 6);
        return { iso, score: moodByDate.get(iso) ?? null };
      }),
    [moodByDate, today],
  );

  const moodAvg7 = useMemo(() => {
    const scores = moodDays.map((d) => d.score).filter((s): s is number => s != null);
    if (!scores.length) return null;
    return scores.reduce((a, b) => a + b, 0) / scores.length;
  }, [moodDays]);

  /* ─── الروابط الحية: عادات مرتبطة بالصحة ─── */
  const healthHabits = useMemo(
    () =>
      (habits ?? []).filter(
        (h) =>
          !h.archived &&
          (h.systemKey === "health" || HEALTH_WORDS.some((w) => h.name.includes(w)))
      ),
    [habits],
  );

  /* ─── إجراءات ─── */
  async function quickBump(kind: HealthKind, dir: 1 | -1) {
    const meta = HEALTH_META[kind];
    const cur = todayLogByKind.get(kind)?.value ?? 0;
    const next = Math.round((cur + dir * meta.step) * 100) / 100;
    if (next <= 0) return;
    // الوزن: + بلا قيمة حالية لا معنى لها — نفتح الإدخال الدقيق
    if (kind === "weight" && cur <= 0 && dir === 1) {
      setDialogKind("weight");
      return;
    }
    await logHealth(kind, next);
  }

  async function handleMood(score: number) {
    if (moodSaving) return;
    setMoodSaving(true);
    try {
      await saveMood(score);
    } finally {
      setMoodSaving(false);
    }
  }

  /* ─── التحميل ─── */
  if (!logs || !moods || !habits) return <HealthSkeleton />;

  const dialogLog = dialogKind ? todayLogByKind.get(dialogKind) ?? null : null;

  return (
    <div className="h-full overflow-y-auto sys-scroll px-4 pt-3 pb-28">
      {/* ═══ الترويسة ═══ */}
      <header className="mb-4">
        <h1 className="text-[22px] font-bold leading-tight">الصحة والجسم</h1>
        <p className="mt-0.5 text-[12px] text-muted-foreground">
          ماء ونوم ووزن ونشاط — اتجاهات تتزامن مع مزاجك، بلا تشخيص
        </p>
      </header>

      {/* ═══ البطل: القياسات الست ═══ */}
      {totalLogged === 0 ? (
        <motion.div {...widgetEnter(0.04)} className="mb-4">
          <GlassCard className="p-4">
            <EmptyState
              icon={<GlassWater className="w-6 h-6" />}
              title="سجّل أول قياس — الماء أسهل بداية"
              hint="نقرة واحدة على زر البدء تفتح الماء مباشرة، أو جرّب + على أي بطاقة لاحقاً"
              actionLabel="ابدأ بالماء الآن"
              onAction={() => setDialogKind("water")}
            />
          </GlassCard>
        </motion.div>
      ) : (
        <motion.section {...widgetEnter(0.04)} className="mb-4">
          <SectionHeader
            title="قياسات اليوم"
            icon={<HeartPulse className="w-3.5 h-3.5 text-mint" />}
            action="إدخال دقيق"
            onAction={() => setDialogKind("water")}
          />
          <div className="grid grid-cols-2 sm:grid-cols-3 gap-3">
            {KIND_ORDER.map((kind) => {
              const meta = HEALTH_META[kind];
              const cur = todayLogByKind.get(kind)?.value ?? null;
              const minusDisabled =
                cur == null || Math.round((cur - meta.step) * 100) / 100 <= 0;
              return (
                <MetricCard
                  key={kind}
                  kind={kind}
                  value={cur}
                  onOpen={() => setDialogKind(kind)}
                  onBump={(dir) => void quickBump(kind, dir)}
                  minusDisabled={minusDisabled}
                />
              );
            })}
          </div>
        </motion.section>
      )}

      {/* ═══ الاتجاه — آخر 7/30 يوماً ═══ */}
      {trendRows.length > 0 && (
        <motion.section {...widgetEnter(0.1)} className="mb-4">
          <div className="flex items-center justify-between px-1 mb-2.5">
            <div className="flex items-center gap-2 text-[13px] font-semibold text-foreground/90">
              <TrendingUp className="w-3.5 h-3.5 text-gold" aria-hidden="true" />
              <span>الاتجاه</span>
            </div>
            <div
              className="flex glass-soft rounded-full p-0.5"
              role="radiogroup"
              aria-label="نطاق الاتجاه الزمني"
            >
              {([7, 30] as const).map((r) => (
                <button
                  key={r}
                  type="button"
                  role="radio"
                  aria-checked={range === r}
                  aria-label={`آخر ${r} يوماً`}
                  onClick={() => setRange(r)}
                  className={cn(
                    "h-11 min-h-11 px-4 rounded-full text-[11.5px] font-semibold transition-colors",
                    range === r
                      ? "bg-primary/20 text-primary"
                      : "text-muted-foreground hover:text-foreground"
                  )}
                >
                  {r} يوم
                </button>
              ))}
            </div>
          </div>
          <GlassCard className="p-2.5 sm:p-3.5">
            {trendRows.map((row, i) => {
              const meta = HEALTH_META[row.kind];
              const Icon = KIND_ICONS[row.kind];
              return (
                <div
                  key={row.kind}
                  className={cn(
                    "flex items-center gap-2.5 py-2.5 px-1.5",
                    i > 0 && "border-t border-black/[0.04]"
                  )}
                >
                  <button
                    type="button"
                    onClick={() => setDialogKind(row.kind)}
                    aria-label={`تسجيل ${meta.label}`}
                    className="flex items-center gap-1.5 w-[74px] shrink-0 text-start"
                  >
                    <Icon
                      className="w-4 h-4 shrink-0"
                      style={{ color: meta.color }}
                      aria-hidden="true"
                    />
                    <span className="text-[11.5px] font-semibold truncate">{meta.label}</span>
                  </button>
                  <div className="flex-1 min-w-0">
                    <Sparkline
                      points={row.points}
                      color={meta.color}
                      label={`اتجاه ${meta.label} — آخر ${range} يوماً`}
                    />
                  </div>
                  <div className="shrink-0 text-end leading-tight w-[78px]">
                    <p className="text-[9.5px] text-muted-foreground">
                      متوسط{" "}
                      <span className="text-foreground/90 font-semibold tabular-nums">
                        {fmtVal(row.avg)}
                      </span>
                    </p>
                    <p className="text-[9.5px] text-muted-foreground">
                      أعلى{" "}
                      <span className="text-foreground/90 font-semibold tabular-nums">
                        {fmtVal(row.max)}
                      </span>
                    </p>
                  </div>
                </div>
              );
            })}
          </GlassCard>
        </motion.section>
      )}

      {/* ═══ المزاج ═══ */}
      <motion.section {...widgetEnter(0.16)} className="mb-4">
        <GlassCard className="p-4">
          <div className="flex items-center justify-between mb-3">
            <span className="text-[12.5px] font-semibold">مزاج اليوم</span>
            {moodAvg7 != null ? (
              <Chip className="text-mint">متوسط 7 أيام {formatNumber(moodAvg7, 1)}</Chip>
            ) : (
              <Chip className="text-muted-foreground">نقرة تكفي</Chip>
            )}
          </div>

          <div className="flex items-center justify-between gap-1.5">
            {MOOD_FACES.map((face, i) => {
              const score = i + 1;
              const selected = moodToday === score;
              return (
                <motion.button
                  key={score}
                  type="button"
                  disabled={moodSaving}
                  onClick={() => void handleMood(score)}
                  whileTap={{ scale: 0.9 }}
                  initial={{ scale: 0.85, opacity: 0 }}
                  animate={{ scale: selected ? 1.08 : 1, opacity: moodSaving ? 0.6 : 1 }}
                  transition={{ type: "spring", stiffness: 380, damping: 16 }}
                  aria-label={`مزاج اليوم: ${MOOD_LABELS[i]}`}
                  title={MOOD_LABELS[i]}
                  className={cn(
                    "flex-1 h-12 min-h-12 rounded-2xl text-[22px] flex items-center justify-center glass-soft transition-colors duration-200 hover:bg-black/[0.05] disabled:cursor-wait",
                    selected && "ring-2 ring-primary shadow-[0_0_20px_-4px_rgba(245,185,92,0.55)]"
                  )}
                >
                  {face}
                </motion.button>
              );
            })}
          </div>

          {/* سلسلة آخر 7 أيام */}
          <div className="mt-3.5">
            <div
              className="flex items-start justify-between gap-1"
              role="img"
              aria-label="سلسلة المزاج لآخر 7 أيام — الأقدم يميناً"
            >
              {moodDays.map(({ iso, score }) => (
                <div key={iso} className="flex flex-col items-center gap-1 flex-1 min-w-0">
                  <span
                    title={`${dayNameShort(iso)}${score != null ? ` · ${MOOD_LABELS[score - 1]}` : ""}`}
                    className={cn(
                      "w-7 h-7 rounded-full transition-colors",
                      score == null && "bg-black/[0.04]",
                      iso === today && "ring-1 ring-primary/70 ring-offset-0"
                    )}
                    style={
                      score != null
                        ? { backgroundColor: MOOD_COLORS[score - 1], opacity: 0.45 + score * 0.11 }
                        : undefined
                    }
                  />
                  <span className="text-[9px] text-muted-foreground/70">{dayNameShort(iso)}</span>
                </div>
              ))}
            </div>
            <div className="mt-1 flex items-center justify-between text-[9.5px] text-muted-foreground/70">
              <span>قبل 6 أيام</span>
              <span>اليوم</span>
            </div>
          </div>

          <button
            type="button"
            onClick={() => setView("journal")}
            aria-label="افتح الدفتر — العقل واليوميات"
            className="mt-3 w-full h-11 min-h-11 rounded-2xl glass-soft border border-black/[0.05] flex items-center justify-center gap-2 text-[12px] text-foreground/85 hover:bg-black/[0.04] transition-colors"
          >
            <NotebookPen className="w-4 h-4 text-lav" aria-hidden="true" />
            اكتب في الدفتر — العقل واليوميات
          </button>
        </GlassCard>
      </motion.section>

      {/* ═══ الروابط الحية: العادات ═══ */}
      <motion.section {...widgetEnter(0.22)}>
        <GlassCard className="p-3.5">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-2xl bg-mint/15 flex items-center justify-center shrink-0">
              <Activity className="w-5 h-5 text-mint" aria-hidden="true" />
            </div>
            <div className="flex-1 min-w-0">
              <div className="flex items-baseline gap-1.5">
                <p className="text-[12.5px] font-semibold">روابط حية</p>
                <span className="text-[10.5px] text-mint font-semibold tabular-nums">
                  {formatNumber(healthHabits.length)} عادة
                </span>
              </div>
              <div className="mt-1 flex flex-wrap gap-1.5">
                {healthHabits.length > 0 ? (
                  healthHabits.slice(0, 3).map((h) => (
                    <Chip key={h.id} className="text-muted-foreground max-w-full">
                      <span className="truncate">{h.name}</span>
                    </Chip>
                  ))
                ) : (
                  <span className="text-[10.5px] text-muted-foreground">
                    لا عادات مرتبطة بعد — أنشئ عادة ماء أو تمرين
                  </span>
                )}
              </div>
            </div>
            <button
              type="button"
              onClick={() => setView("habits")}
              aria-label="افتح شاشة العادات"
              className="h-11 min-h-11 px-3.5 rounded-2xl bg-primary/15 border border-primary/30 text-primary text-[11.5px] font-bold hover:bg-primary/25 transition-colors shrink-0"
            >
              افتح العادات
            </button>
          </div>
        </GlassCard>
      </motion.section>

      {/* ═══ حوار الإدخال الدقيق ═══ */}
      <MetricDialog
        kind={dialogKind ?? "water"}
        open={dialogKind != null}
        onOpenChange={(o) => {
          if (!o) setDialogKind(null);
        }}
        todayValue={dialogLog?.value ?? null}
        todayNote={dialogLog?.note}
        todayLogId={dialogLog?.id ?? null}
        digits={digits}
      />
    </div>
  );
}
