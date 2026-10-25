"use client";

/**
 * Systemy v2 — شاشة الرؤى (محلية بالكامل)
 * كل الأرقام مشتقة لحظياً من قاعدة Dexie عبر useLive واحدة:
 * الدرجة (40 مال / 40 عادات / 20 دفتر) + قصة الأسبوع + الارتباطات
 * + التنبؤ النقدي + كشف الشذوذ + مخططا المزاج والصرف-مقابل-المزاج.
 */

import { useMemo, useState } from "react";
import { motion } from "framer-motion";
import {
  Activity,
  Banknote,
  Bot,
  CalendarClock,
  CheckCircle2,
  Coffee,
  FileText,
  Flame,
  Info,
  Loader2,
  Smile,
  Sparkles,
  TrendingUp,
  Wallet,
  type LucideIcon,
} from "lucide-react";
import { toast } from "sonner";
import { Skeleton } from "@/components/ui/skeleton";
import { Chip, GlassCard, PrivateAmount, SectionHeader, widgetEnter } from "@/components/systemy/glass";
import { CountUp } from "@/components/systemy/count-up";
import { EmptyState } from "@/components/systemy/ui-bits";
import { db, getSettings, useLive } from "@/lib/db";
import { useUIStore } from "@/store/ui-store";
import {
  MOOD_FACES,
  MOOD_LABELS,
  addDaysISO,
  diffDays,
  formatDate,
  formatMoney,
  formatNumber,
  fromISODate,
  maskMoney,
  relativeDay,
  todayISO,
} from "@/lib/format";
import { accountBalances, envelopes, monthSummary, monthWindow, netWorth } from "@/lib/money";
import { downloadHTMLReport } from "@/lib/report";
import type {
  Account,
  Asset,
  Category,
  Debt,
  Goal,
  Habit,
  HabitLog,
  Mood,
  Note,
  Recurring,
  Settings,
  Transaction,
} from "@/lib/types";
import { cn } from "@/lib/utils";

/* ═══════════════════════ الأنواع المشتقة ═══════════════════════ */

type Tone = "gold" | "cyan" | "mint" | "coral" | "lav";

const TONE_HEX: Record<Tone, string> = {
  gold: "#F5B95C",
  cyan: "#5CE1E6",
  mint: "#6EE7A8",
  coral: "#FF8E7A",
  lav: "#C4B5FD",
};

const FACTOR_COLORS = ["#F5B95C", "#5CE1E6", "#6EE7A8"];

interface Factor {
  key: "money" | "habits" | "journal";
  label: string;
  value: number;
  hint: string;
}

interface StorySection {
  title: string;
  body: string;
  tone: Tone;
  icon: LucideIcon;
}

interface Correlation {
  icon: LucideIcon;
  text: string;
  confidence: string;
}

interface Anomaly {
  icon: LucideIcon;
  text: string;
}

interface Insights {
  score: { value: number; grade: string; factors: Factor[]; step: string };
  story: { headline: string; sections: StorySection[]; suggestion: string };
  correlations: Correlation[];
  predictions: {
    balance: number;
    days30: number;
    days60: number;
    days90: number;
    critical: string | null;
  };
  anomalies: Anomaly[];
  moodSeries: Array<{ iso: string; day: string; score: number | null }>;
  spendVsMood: Array<{ mood: number; avgSpend: number; count: number }>;
  moodSummary: string;
  nwTotal: number;
  monthSpent: number;
  monthIncome: number;
  monthDelta: number;
  hasAnyData: boolean;
  showPredictions: boolean;
}

/** حزمة كل الجداول — قراءة تفاعلية واحدة */
interface InsightsData {
  settings: Settings;
  txs: Transaction[];
  habits: Habit[];
  habitLogs: HabitLog[];
  moods: Mood[];
  notes: Note[];
  recurrings: Recurring[];
  goals: Goal[];
  accounts: Account[];
  categories: Category[];
  assets: Asset[];
  debts: Debt[];
}

/* ═══════════════════════ الحساب المحلي ═══════════════════════ */

const clamp100 = (n: number) => Math.max(0, Math.min(100, n));

function computeInsights(d: InsightsData): Insights {
  const today = todayISO();
  const w30 = addDaysISO(today, -29);
  const w7 = addDaysISO(today, -6);
  const prev7from = addDaysISO(today, -13);
  const prev7to = addDaysISO(today, -7);
  const dayOf = (t: Transaction) => t.date.slice(0, 10);

  /* خرائط مساعدة */
  const spendByDay = new Map<string, number>();
  for (const t of d.txs) {
    if (t.type !== "expense") continue;
    const day = dayOf(t);
    spendByDay.set(day, (spendByDay.get(day) ?? 0) + t.amount);
  }
  const moodByDate = new Map<string, number>();
  for (const m of d.moods) moodByDate.set(m.date, m.score);
  const habitById = new Map<string, Habit>(d.habits.map((h) => [h.id, h]));
  const habitTargetMet = (l: HabitLog) => {
    const h = habitById.get(l.habitId);
    return h ? l.count >= Math.max(1, h.target) : l.count > 0;
  };

  const mw = monthWindow(d.settings);
  const envs = envelopes(d.categories, d.txs, mw);
  const ms = monthSummary(d.settings, d.txs);
  const nw = netWorth(d.accounts, d.txs, d.assets, d.debts);
  const activeHabits = d.habits.filter((h) => !h.archived);

  /* ─── العوامل الثلاثة ─── */
  let moneyFactor: Factor;
  if (d.txs.length === 0) {
    moneyFactor = { key: "money", label: "الصحة المالية", value: 0, hint: "سجّل أول معاملة لتُحسب" };
  } else if (envs.length === 0) {
    moneyFactor = { key: "money", label: "الصحة المالية", value: 70, hint: "حدّد ميزانية لفئاتك لقياس أدق" };
  } else {
    const avgOverage = envs.reduce((s, e) => s + Math.max(0, e.percent - 100), 0) / envs.length;
    const overCount = envs.filter((e) => e.percent > 100).length;
    moneyFactor = {
      key: "money",
      label: "الصحة المالية",
      value: clamp100(Math.round(100 - avgOverage)),
      hint:
        overCount > 0
          ? `${formatNumber(overCount)} مظروف فوق حدّه`
          : "كل المظاريف ضمن حدودها 🌱",
    };
  }

  let habitsFactor: Factor;
  if (activeHabits.length === 0) {
    habitsFactor = { key: "habits", label: "العادات", value: 0, hint: "أضف عادة واحدة — صغيرة تكفي" };
  } else {
    const rates = activeHabits.map((h) => {
      const need = Math.max(1, h.target);
      const days = new Set(
        d.habitLogs
          .filter((l) => l.habitId === h.id && l.date >= w30 && l.date <= today && l.count >= need)
          .map((l) => l.date)
      ).size;
      return days / 30;
    });
    const avg = rates.reduce((a, b) => a + b, 0) / rates.length;
    habitsFactor = {
      key: "habits",
      label: "العادات",
      value: Math.round(avg * 100),
      hint: `${formatNumber(activeHabits.length)} نشطة · ${formatNumber(Math.round(avg * 30))} يوم إنجاز من 30`,
    };
  }

  const journal30 = d.notes.filter((n) => n.type === "journal" && n.date >= w30 && n.date <= today).length;
  const journalFactor: Factor = {
    key: "journal",
    label: "الدفتر",
    value: Math.min(100, Math.round((journal30 / 30) * 100)),
    hint: journal30 === 0 ? "دوّن أول يومية الليلة" : `${formatNumber(journal30)} يومية في 30 يوماً`,
  };

  const factors = [moneyFactor, habitsFactor, journalFactor];
  const scoreValue = Math.round(
    0.4 * moneyFactor.value + 0.4 * habitsFactor.value + 0.2 * journalFactor.value
  );
  const grade =
    scoreValue >= 80 ? "ممتاز" : scoreValue >= 65 ? "جيد جداً" : scoreValue >= 50 ? "جيد" : "بداية طيبة";
  const weakest = factors.reduce((m, f) => (f.value < m.value ? f : m), factors[0]);
  const topOver = envs.filter((e) => e.percent > 100).sort((a, b) => b.percent - a.percent)[0];
  const step =
    weakest.key === "money"
      ? topOver
        ? `رجّع مظروف «${topOver.category.name}» تحت حدّه — أسرع ربح للدرجة`
        : "حدّد ميزانية لفئتك الأكثر صرفاً والتزم بها أسبوعاً"
      : weakest.key === "habits"
        ? "أنجز عادة واحدة اليوم — سلسلة صغيرة ترفع العامل كله"
        : "دوّن يومية قصيرة الليلة — ثلاث جمل تكفي";

  /* ─── قصة الأسبوع ─── */
  const spent7 = d.txs
    .filter((t) => t.type === "expense" && dayOf(t) >= w7)
    .reduce((s, t) => s + t.amount, 0);
  const spentPrev7 = d.txs
    .filter((t) => t.type === "expense" && dayOf(t) >= prev7from && dayOf(t) <= prev7to)
    .reduce((s, t) => s + t.amount, 0);
  const delta = spentPrev7 > 0 ? Math.round(((spent7 - spentPrev7) / spentPrev7) * 100) : 0;
  const expenses7Count = d.txs.filter((t) => t.type === "expense" && dayOf(t) >= w7).length;
  const habitsDone7 = d.habitLogs.filter((l) => l.date >= w7 && l.date <= today && habitTargetMet(l)).length;
  const moods7 = d.moods.filter((m) => m.date >= w7 && m.date <= today);
  const avgMood7 = moods7.length ? moods7.reduce((s, m) => s + m.score, 0) / moods7.length : null;
  const income7 = d.txs
    .filter((t) => t.type === "income" && dayOf(t) >= w7)
    .reduce((s, t) => s + t.amount, 0);

  const headline =
    spent7 === 0 && spentPrev7 === 0
      ? "أسبوع هادئ — الدفتر ينتظر أول حركة"
      : spentPrev7 === 0
        ? `أنفقت ${formatMoney(spent7)} هذا الأسبوع`
        : delta <= -10
          ? `أنفقت ${formatMoney(spent7)} — أقل بـ${formatNumber(Math.abs(delta))}% من الأسبوع الماضي`
          : delta >= 10
            ? `أنفقت ${formatMoney(spent7)} — أعلى بـ${formatNumber(delta)}% من الأسبوع الماضي`
            : `إيقاع ثابت: ${formatMoney(spent7)} هذا الأسبوع`;

  const sections: StorySection[] = [
    {
      title: "الإنفاق",
      tone: "gold",
      icon: Wallet,
      body:
        spentPrev7 > 0 && delta !== 0
          ? `${delta < 0 ? "أقل" : "أعلى"} بـ${formatNumber(Math.abs(delta))}% من الأسبوع الماضي`
          : spent7 > 0
            ? `${formatNumber(expenses7Count)} معاملة هذا الأسبوع`
            : "لا مصروفات هذا الأسبوع — جيب مرتاح",
    },
    {
      title: "العادات",
      tone: "cyan",
      icon: Flame,
      body:
        habitsDone7 > 0
          ? `${formatNumber(habitsDone7)} تسجيل إنجاز — استمرارية تُحسب لك`
          : activeHabits.length > 0
            ? "لا تسجيلات هذا الأسبوع — عادة واحدة تكسر الجمود"
            : "لا عادات بعد — أضف واحدة صغيرة",
    },
    {
      title: "المزاج",
      tone: "mint",
      icon: Smile,
      body:
        avgMood7 != null
          ? `متوسط مزاجك «${MOOD_LABELS[Math.round(avgMood7) - 1]}» ${MOOD_FACES[Math.round(avgMood7) - 1]}`
          : "لم تسجّل مزاجك هذا الأسبوع — نقرة واحدة تكفي",
    },
    {
      title: "الدخل",
      tone: "lav",
      icon: Banknote,
      body: income7 > 0 ? `دخل ${formatMoney(income7)} هذا الأسبوع` : "لا دخل مسجّل هذا الأسبوع — لا بأس",
    },
  ];

  const suggestion =
    weakest.key === "money"
      ? "جرّب أسبوعاً بلا «قهوة خارجية» — وفّر المبلغ لهدف صغير"
      : weakest.key === "habits"
        ? "جرّب ربط عادة بمبلغ ادخار — كل إنجاز يقرّب هدفك"
        : "جرّب تدوين ثلاث جمل كل ليلة — امتنان واحد يكفي";

  /* ─── الارتباطات ─── */
  const correlations: Correlation[] = [];
  const conf = (n: number) => (n >= 8 ? "متوسطة" : "منخفضة");

  const lowDays: string[] = [];
  const highDays: string[] = [];
  for (const m of d.moods) {
    if (m.date < w30) continue;
    if (m.score <= 2) lowDays.push(m.date);
    else if (m.score >= 4) highDays.push(m.date);
  }
  if (lowDays.length >= 2 && highDays.length >= 2) {
    const avg = (days: string[]) =>
      days.reduce((s, iso) => s + (spendByDay.get(iso) ?? 0), 0) / days.length;
    const avgLow = avg(lowDays);
    const avgHigh = avg(highDays);
    if (avgLow > 0) {
      const pct = Math.round(((avgHigh - avgLow) / avgLow) * 100);
      const confidence = conf(lowDays.length + highDays.length);
      if (pct <= -10)
        correlations.push({
          icon: Smile,
          text: `في أيام مزاجك المرتفع، صرفك أقل بـ${formatNumber(Math.abs(pct))}% — لافت ولطيف`,
          confidence,
        });
      else if (pct >= 10)
        correlations.push({
          icon: Smile,
          text: `في أيام مزاجك المرتفع، صرفك أعلى بـ${formatNumber(pct)}% — احتفال صغير ربما`,
          confidence,
        });
      else
        correlations.push({ icon: Activity, text: "مزاجك وصرفك يمشيان معاً بلا مبالغة", confidence });
    }
  }

  const busyMoodScores: number[] = [];
  const quietMoodScores: number[] = [];
  const loggedDays = new Set(
    d.habitLogs.filter((l) => l.date >= w30 && habitTargetMet(l)).map((l) => l.date)
  );
  for (const m of d.moods) {
    if (m.date < w30) continue;
    if (loggedDays.has(m.date)) busyMoodScores.push(m.score);
    else quietMoodScores.push(m.score);
  }
  if (busyMoodScores.length >= 2 && quietMoodScores.length >= 2) {
    const avg = (a: number[]) => a.reduce((s, x) => s + x, 0) / a.length;
    const diff = avg(busyMoodScores) - avg(quietMoodScores);
    const confidence = conf(busyMoodScores.length + quietMoodScores.length);
    if (diff >= 0.5)
      correlations.push({
        icon: Flame,
        text: `في الأيام التي تنجز فيها عاداتك، مزاجك أعلى بـ${formatNumber(Math.round(diff * 10) / 10)} درجة تقريباً`,
        confidence,
      });
    else if (diff <= -0.5)
      correlations.push({
        icon: Flame,
        text: `أيام جمود العادات مزاجك فيها أخفض بـ${formatNumber(Math.abs(Math.round(diff * 10) / 10))} درجة — انظر لها بلطف`,
        confidence,
      });
    else correlations.push({ icon: CheckCircle2, text: "الإنجاز والمزاج عندك مستقران معاً", confidence });
  }

  /* ─── التنبؤ ─── */
  const balances = accountBalances(
    d.accounts.filter((a) => !a.archived),
    d.txs
  );
  const balance = Math.round([...balances.values()].reduce((s, v) => s + v, 0));
  const spent30 = d.txs
    .filter((t) => t.type === "expense" && dayOf(t) >= w30)
    .reduce((s, t) => s + t.amount, 0);
  const income30 = d.txs
    .filter((t) => t.type === "income" && dayOf(t) >= w30)
    .reduce((s, t) => s + t.amount, 0);
  const netDaily = (income30 - spent30) / 30;
  const days30 = Math.round(balance + netDaily * 30);
  const days60 = Math.round(balance + netDaily * 60);
  const days90 = Math.round(balance + netDaily * 90);
  let critical: string | null = null;
  if (balance < 0) {
    critical = "مجموع أرصدة حساباتك سالب الآن — أولوية قصوى قبل أي تنبؤ";
  } else if (netDaily < 0 && days90 < 0) {
    const daysToZero = Math.max(1, Math.round(balance / Math.abs(netDaily)));
    critical = `بهذا الإيقاع ينفد رصيدك خلال ~${formatNumber(daysToZero)} يوماً — راجع أكبر مظروفين أو زد دخلاً صغيراً`;
  }

  /* ─── كشف الشذوذ ─── */
  const anomalies: Anomaly[] = [];
  const expenses30 = d.txs.filter((t) => t.type === "expense" && dayOf(t) >= w30);
  if (expenses30.length >= 3) {
    const biggest = expenses30.reduce((m, t) => (t.amount > m.amount ? t : m));
    const cat = biggest.categoryId
      ? d.categories.find((c) => c.id === biggest.categoryId)
      : undefined;
    const peers = expenses30.filter((t) => t.id !== biggest.id && t.categoryId === biggest.categoryId);
    if (cat && peers.length >= 2) {
      const avgCat = peers.reduce((s, t) => s + t.amount, 0) / peers.length;
      if (avgCat > 0 && biggest.amount > avgCat * 2) {
        const pct = Math.round(((biggest.amount - avgCat) / avgCat) * 100);
        anomalies.push({
          icon: TrendingUp,
          text: `أكبر مصروف: «${biggest.description}» بـ${formatMoney(biggest.amount)} — يفوق متوسط فئة «${cat.name}» بـ${formatNumber(pct)}%`,
        });
      }
    }
  }
  const soonRecurrings = d.recurrings
    .filter((r) => {
      if (!r.active || r.type !== "expense") return false;
      const dd = diffDays(today, r.nextDate);
      return dd >= 0 && dd <= 3;
    })
    .slice(0, 2);
  for (const r of soonRecurrings) {
    anomalies.push({
      icon: CalendarClock,
      text: `التزام «${r.name}» يتجدد ${relativeDay(r.nextDate)} — ${formatMoney(r.amount)}`,
    });
  }
  const overEnv = envs.filter((e) => e.percent > 100).sort((a, b) => b.percent - a.percent)[0];
  if (overEnv) {
    anomalies.push({
      icon: Coffee,
      text: `مظروف «${overEnv.category.name}» تجاوز حدّه — ${formatMoney(overEnv.spent)} من ${formatMoney(overEnv.budget)} (${formatNumber(overEnv.percent)}%)`,
    });
  }

  /* ─── سلاسل المزاج ─── */
  const moodSeries = Array.from({ length: 14 }, (_, i) => {
    const iso = addDaysISO(today, -(13 - i));
    return { iso, day: String(fromISODate(iso).getDate()), score: moodByDate.get(iso) ?? null };
  });

  const spendVsMoodMap = new Map<number, { total: number; count: number }>();
  for (const m of d.moods) {
    if (m.date < w30) continue;
    const cur = spendVsMoodMap.get(m.score) ?? { total: 0, count: 0 };
    cur.total += spendByDay.get(m.date) ?? 0;
    cur.count += 1;
    spendVsMoodMap.set(m.score, cur);
  }
  const spendVsMood = [...spendVsMoodMap.entries()]
    .map(([mood, v]) => ({ mood, avgSpend: Math.round(v.total / v.count), count: v.count }))
    .sort((a, b) => a.mood - b.mood);

  let moodSummary = "كل يوم تسجّل فيه مزاجك، تُضاف قطعة للصورة — بلا أحكام";
  const lowM = spendVsMood.filter((s) => s.mood <= 2);
  const highM = spendVsMood.filter((s) => s.mood >= 4);
  if (lowM.length && highM.length) {
    const avgLow = lowM.reduce((s, x) => s + x.avgSpend, 0) / lowM.length;
    const avgHigh = highM.reduce((s, x) => s + x.avgSpend, 0) / highM.length;
    if (avgLow > 0) {
      const pct = Math.round(((avgHigh - avgLow) / avgLow) * 100);
      if (pct <= -10)
        moodSummary = `في أيام مزاجك المرتفع، صرفك أقل بـ${formatNumber(Math.abs(pct))}% — لافت ولطيف`;
      else if (pct >= 10)
        moodSummary = `في أيام مزاجك المرتفع، صرفك أعلى بـ${formatNumber(pct)}% — احتفال صغير ربما`;
    }
  }

  const hasMoney = d.txs.length > 0;
  const hasAccounts = d.accounts.some((a) => !a.archived);

  return {
    score: { value: scoreValue, grade, factors, step },
    story: { headline, sections, suggestion },
    correlations,
    predictions: { balance, days30, days60, days90, critical },
    anomalies,
    moodSeries,
    spendVsMood,
    moodSummary,
    nwTotal: nw.total,
    monthSpent: ms.spent,
    monthIncome: ms.income,
    monthDelta: ms.delta,
    hasAnyData: hasMoney || activeHabits.length > 0 || d.moods.length > 0 || d.notes.length > 0,
    showPredictions: hasMoney || hasAccounts,
  };
}

/* ═══════════════════════ الرسوم (SVG نقية) ═══════════════════════ */

const RING_R = 54;
const RING_C = 2 * Math.PI * RING_R;

function moodDotColor(score: number): string {
  switch (score) {
    case 1:
      return "#FF8E7A";
    case 2:
      return "#F5B95C";
    case 3:
      return "#C4B5FD";
    case 4:
      return "#6EE7A8";
    default:
      return "#5CE1E6";
  }
}

/** مخطط التنبؤ بالنقد — نقطة اليوم ذهبية والبقية سماوية */
function FlowChart({
  points,
  privacy,
}: {
  points: Array<{ label: string; value: number }>;
  privacy: boolean;
}) {
  const W = 300;
  const H = 132;
  const top = 14;
  const bottom = 100;
  const rawMin = Math.min(...points.map((p) => p.value));
  const rawMax = Math.max(...points.map((p) => p.value));
  const span = Math.max(rawMax - rawMin, Math.abs(rawMax) * 0.08, 60);
  const lo = rawMin - span * 0.18;
  const hi = rawMax + span * 0.18;
  const x = (i: number) => 30 + (i * (W - 60)) / (points.length - 1);
  const y = (v: number) => bottom - ((v - lo) / (hi - lo)) * (bottom - top);
  const pts = points.map((p, i) => ({ ...p, cx: x(i), cy: y(p.value) }));
  const line = pts.map((p) => `${p.cx},${p.cy}`).join(" ");
  const area = `M ${pts[0].cx},${bottom} L ${pts.map((p) => `${p.cx},${p.cy}`).join(" L ")} L ${pts[pts.length - 1].cx},${bottom} Z`;
  const fmt = (v: number) => (privacy ? maskMoney() : formatMoney(v));

  return (
    <div dir="ltr" className="h-[132px] -mx-2">
      <svg viewBox={`0 0 ${W} ${H}`} className="w-full h-full" role="img" aria-label="مخطط التنبؤ بالتدفق النقدي">
        <defs>
          <linearGradient id="flowFillV2" x1="0" y1="0" x2="0" y2="1">
            <stop offset="0%" stopColor="#5CE1E6" stopOpacity={0.26} />
            <stop offset="100%" stopColor="#5CE1E6" stopOpacity={0.02} />
          </linearGradient>
        </defs>
        {lo < 0 && hi > 0 && (
          <line x1={18} x2={W - 18} y1={y(0)} y2={y(0)} stroke="rgba(255,142,122,0.4)" strokeWidth={1} strokeDasharray="4 4" />
        )}
        <path d={area} fill="url(#flowFillV2)" />
        <motion.polyline
          points={line}
          fill="none"
          stroke="#5CE1E6"
          strokeWidth={2.5}
          strokeLinecap="round"
          strokeLinejoin="round"
          initial={{ pathLength: 0 }}
          animate={{ pathLength: 1 }}
          transition={{ duration: 1.1, ease: [0.22, 1, 0.36, 1] }}
        />
        {pts.map((p, i) => (
          <g key={p.label}>
            {i === 0 ? (
              <>
                <circle cx={p.cx} cy={p.cy} r={8} fill="rgba(245,185,92,0.22)" />
                <circle cx={p.cx} cy={p.cy} r={4.5} fill="#F5B95C" stroke="#0B0F1A" strokeWidth={1.5} />
              </>
            ) : (
              <circle cx={p.cx} cy={p.cy} r={3} fill="#5CE1E6" fillOpacity={0.85} />
            )}
            <title>{`${p.label}: ${fmt(p.value)}`}</title>
            <text x={p.cx} y={H - 8} textAnchor="middle" fontSize={9.5} fill="#8a93a8">
              {p.label}
            </text>
          </g>
        ))}
      </svg>
    </div>
  );
}

/** مزاج آخر 14 يوماً — خط نعناعي ونقاط ملونة بالدرجة */
function MoodChart({ series }: { series: Array<{ iso: string; day: string; score: number | null }> }) {
  const W = 300;
  const H = 108;
  const top = 14;
  const bottom = 78;
  const xs = (i: number) => 12 + (i * (W - 24)) / (series.length - 1);
  const ys = (score: number) => bottom - ((score - 1) / 4) * (bottom - top);
  const pts = series.map((s, i) => ({ ...s, cx: xs(i), cy: s.score == null ? null : ys(s.score) }));
  const segments: Array<[number, number]> = [];
  for (let i = 1; i < pts.length; i++) {
    if (pts[i - 1].cy != null && pts[i].cy != null) segments.push([i - 1, i]);
  }

  return (
    <div dir="ltr" className="h-[108px] -mx-2">
      <svg viewBox={`0 0 ${W} ${H}`} className="w-full h-full" role="img" aria-label="مخطط المزاج لآخر 14 يوماً">
        {[2, 3, 4].map((sc) => (
          <line
            key={sc}
            x1={8}
            x2={W - 8}
            y1={ys(sc)}
            y2={ys(sc)}
            stroke="rgba(255,255,255,0.06)"
            strokeWidth={1}
            strokeDasharray="3 5"
          />
        ))}
        {segments.map(([a, b], i) => (
          <line
            key={i}
            x1={pts[a].cx}
            y1={pts[a].cy as number}
            x2={pts[b].cx}
            y2={pts[b].cy as number}
            stroke="#6EE7A8"
            strokeWidth={2}
            strokeLinecap="round"
            opacity={0.9}
          />
        ))}
        {pts.map((p, i) =>
          p.cy == null ? null : (
            <g key={p.iso}>
              {i === pts.length - 1 && <circle cx={p.cx} cy={p.cy} r={8} fill="rgba(245,185,92,0.2)" />}
              <circle
                cx={p.cx}
                cy={p.cy}
                r={i === pts.length - 1 ? 4.5 : 3.2}
                fill={moodDotColor(p.score ?? 3)}
                stroke="#0B0F1A"
                strokeWidth={1.2}
              />
              <title>{`${formatDate(p.iso)} · ${MOOD_LABELS[(p.score ?? 3) - 1]}`}</title>
            </g>
          )
        )}
        {[0, 7, 13].map((i) => (
          <text key={i} x={xs(i)} y={H - 6} textAnchor="middle" fontSize={8.5} fill="#8a93a8">
            {series[i].day}
          </text>
        ))}
      </svg>
    </div>
  );
}

/** أعمدة الصرف حسب المزاج */
function MoodSpendBars({ data }: { data: Array<{ mood: number; avgSpend: number; count: number }> }) {
  const max = Math.max(...data.map((d) => d.avgSpend), 1);
  return (
    <div className="flex items-end justify-between gap-2" role="img" aria-label="متوسط الصرف اليومي حسب المزاج">
      {data.map((d, i) => (
        <div key={d.mood} className="flex-1 flex flex-col items-center gap-1.5">
          <PrivateAmount className="text-[10px] font-semibold text-muted-foreground">
            {formatMoney(d.avgSpend)}
          </PrivateAmount>
          <div
            className="w-full h-20 flex items-end"
            title={`${MOOD_LABELS[d.mood - 1]} · ${formatNumber(d.count)} ${d.count === 1 ? "يوم" : "أيام"}`}
          >
            <motion.div
              initial={{ height: "6%" }}
              animate={{ height: `${Math.max(6, Math.round((d.avgSpend / max) * 100))}%` }}
              transition={{ duration: 0.7, delay: i * 0.07, ease: [0.22, 1, 0.36, 1] }}
              className="w-full rounded-t-[7px]"
              style={{
                background: d.mood <= 2 ? "#FF8E7A" : d.mood === 3 ? "#C4B5FD" : "#6EE7A8",
                opacity: 0.8,
              }}
            />
          </div>
          <span className="text-[15px] leading-none" title={MOOD_LABELS[d.mood - 1]}>
            {MOOD_FACES[d.mood - 1]}
          </span>
        </div>
      ))}
    </div>
  );
}

/* ═══════════════════════ هيكل التحميل ═══════════════════════ */

function InsightsSkeleton() {
  return (
    <div className="h-full overflow-y-auto sys-scroll px-4 pt-3 pb-28" aria-busy="true" aria-label="جارٍ تجميع الرؤى">
      <div className="flex items-center justify-between mb-1">
        <Skeleton className="h-7 w-24 rounded-lg bg-black/[0.04]" />
        <Skeleton className="h-5 w-16 rounded-full bg-black/[0.04]" />
      </div>
      <Skeleton className="h-3.5 w-52 rounded-md bg-black/[0.04] mb-4" />
      <div className="grid grid-cols-3 gap-2 mb-3">
        <Skeleton className="h-[68px] rounded-2xl bg-black/[0.03]" />
        <Skeleton className="h-[68px] rounded-2xl bg-black/[0.03]" />
        <Skeleton className="h-[68px] rounded-2xl bg-black/[0.03]" />
      </div>
      <div className="space-y-3">
        <Skeleton className="h-[300px] rounded-3xl bg-black/[0.03]" />
        <Skeleton className="h-[230px] rounded-3xl bg-black/[0.03]" />
        <Skeleton className="h-[230px] rounded-3xl bg-black/[0.03]" />
        <Skeleton className="h-14 rounded-3xl bg-black/[0.03]" />
      </div>
    </div>
  );
}

/* ═══════════════════════ الشاشة ═══════════════════════ */

export function InsightsScreen() {
  const setSysOpen = useUIStore((s) => s.setSysOpen);
  const openQuickAdd = useUIStore((s) => s.openQuickAdd);
  const privacyMode = useUIStore((s) => s.privacyMode);

  /* مستخلص HTML — تقرير شهري مستقل يُنزَّل بضغطة */
  const [reportBusy, setReportBusy] = useState(false);
  const makeReport = async () => {
    if (reportBusy) return;
    setReportBusy(true);
    try {
      const name = await downloadHTMLReport();
      toast.success("نزّلنا مستخلص الشهر ✓", { description: `${name} — افتحه بأي متصفح أو شاركه` });
    } catch {
      toast.error("تعذّر توليد التقرير");
    } finally {
      setReportBusy(false);
    }
  };

  const data = useLive(async (): Promise<InsightsData> => {
    const [
      settings,
      txs,
      habits,
      habitLogs,
      moods,
      notes,
      recurrings,
      goals,
      accounts,
      categories,
      assets,
      debts,
    ] = await Promise.all([
      getSettings(),
      db.transactions.toArray(),
      db.habits.toArray(),
      db.habitLogs.toArray(),
      db.moods.toArray(),
      db.notes.toArray(),
      db.recurrings.toArray(),
      db.goals.toArray(),
      db.accounts.toArray(),
      db.categories.toArray(),
      db.assets.toArray(),
      db.debts.toArray(),
    ]);
    return { settings, txs, habits, habitLogs, moods, notes, recurrings, goals, accounts, categories, assets, debts };
  }, []);

  const ins = useMemo(() => (data ? computeInsights(data) : null), [data]);

  if (!data || !ins) return <InsightsSkeleton />;

  /* بلا أي بيانات — دعوة لطيفة للبداية */
  if (!ins.hasAnyData) {
    return (
      <div className="h-full overflow-y-auto sys-scroll px-4 pt-3 pb-28">
        <header className="mb-4">
          <div className="flex items-center justify-between">
            <h1 className="text-[22px] font-bold leading-tight">الرؤى</h1>
            <Chip className="text-cyan border border-cyan/25">
              <Sparkles className="w-3 h-3" />
              Sys AI
            </Chip>
          </div>
          <p className="mt-0.5 text-[12px] text-muted-foreground">ما تغيّر، ولماذا، وما الذي يُجرَّب</p>
        </header>
        <GlassCard className="p-4">
          <EmptyState
            icon={<Sparkles className="w-6 h-6" />}
            title="الرؤى تنتظر أول بيانات"
            hint="سجّل أول معاملة لتظهر التحليلات — ثم أضف عادة ومزاج يوم واحد وسترتفع درجتك أمامك"
            actionLabel="سجّل أول معاملة"
            onAction={() => openQuickAdd("expense")}
          />
        </GlassCard>
      </div>
    );
  }

  const { score, story, correlations, predictions, anomalies, spendVsMood, moodSeries } = ins;
  const flowData = [
    { label: "اليوم", value: predictions.balance },
    { label: "+30 يوم", value: predictions.days30 },
    { label: "+60 يوم", value: predictions.days60 },
    { label: "+90 يوم", value: predictions.days90 },
  ];
  const moodHasData = moodSeries.some((m) => m.score != null);

  return (
    <div className="h-full overflow-y-auto sys-scroll px-4 pt-3 pb-28">
      {/* ═══ الرأس ═══ */}
      <header className="mb-3">
        <div className="flex items-center justify-between gap-2">
          <h1 className="text-[22px] font-bold leading-tight">الرؤى</h1>
          <div className="flex items-center gap-2 shrink-0">
            <button
              type="button"
              onClick={makeReport}
              disabled={reportBusy}
              aria-label="تنزيل مستخلص HTML للتقرير الشهري"
              className="h-11 min-h-11 rounded-xl bg-primary/15 border border-primary/30 text-primary px-3.5 inline-flex items-center gap-1.5 text-[12px] font-bold transition-colors hover:bg-primary/25 active:scale-[0.97] disabled:opacity-60"
            >
              {reportBusy ? (
                <Loader2 className="w-4 h-4 animate-spin" />
              ) : (
                <FileText className="w-4 h-4" />
              )}
              مستخلص HTML
            </button>
            <Chip className="text-cyan border border-cyan/25">
              <Sparkles className="w-3 h-3" />
              Sys AI
            </Chip>
          </div>
        </div>
        <p className="mt-0.5 text-[12px] text-muted-foreground">ما تغيّر، ولماذا، وما الذي يُجرَّب</p>
      </header>

      {/* ═══ صف الإحصاءات ═══ */}
      <motion.div {...widgetEnter(0.03)} className="grid grid-cols-3 gap-2 mb-3">
        <GlassCard className="p-3 text-center">
          <p className="text-[9.5px] text-muted-foreground">صافي الثروة</p>
          <PrivateAmount className="block mt-1 text-[13.5px] font-bold text-gold text-glow-gold truncate">
            {formatMoney(ins.nwTotal)}
          </PrivateAmount>
        </GlassCard>
        <GlassCard className="p-3 text-center">
          <p className="text-[9.5px] text-muted-foreground">مصروف الشهر</p>
          <PrivateAmount
            className={cn(
              "block mt-1 text-[13.5px] font-bold truncate",
              ins.monthDelta > 0 ? "text-coral" : "text-cyan"
            )}
          >
            {formatMoney(ins.monthSpent)}
          </PrivateAmount>
          {ins.monthDelta !== 0 && (
            <p className="mt-0.5 text-[9px] text-muted-foreground">
              {ins.monthDelta > 0 ? "+" : "−"}
              {formatNumber(Math.abs(ins.monthDelta))}% عن الشهر السابق
            </p>
          )}
        </GlassCard>
        <GlassCard className="p-3 text-center">
          <p className="text-[9.5px] text-muted-foreground">دخل الشهر</p>
          <PrivateAmount className="block mt-1 text-[13.5px] font-bold text-mint truncate">
            {formatMoney(ins.monthIncome)}
          </PrivateAmount>
        </GlassCard>
      </motion.div>

      {/* ═══ درجة Systemy ═══ */}
      <motion.div {...widgetEnter(0.08)}>
        <GlassCard className="p-4 mb-3">
          <div className="flex items-center gap-4">
            <div className="relative w-[128px] h-[128px] shrink-0">
              <svg viewBox="0 0 140 140" className="w-full h-full -rotate-90" aria-hidden="true">
                <defs>
                  <linearGradient id="sysyRingV2" x1="0%" y1="0%" x2="100%" y2="100%">
                    <stop offset="0%" stopColor="#F5B95C" />
                    <stop offset="100%" stopColor="#5CE1E6" />
                  </linearGradient>
                </defs>
                <circle cx="70" cy="70" r={RING_R} fill="none" stroke="rgba(255,255,255,0.08)" strokeWidth="10" />
                <motion.circle
                  cx="70"
                  cy="70"
                  r={RING_R}
                  fill="none"
                  stroke="url(#sysyRingV2)"
                  strokeWidth="10"
                  strokeLinecap="round"
                  strokeDasharray={RING_C}
                  initial={{ strokeDashoffset: RING_C }}
                  animate={{ strokeDashoffset: RING_C * (1 - Math.min(score.value, 100) / 100) }}
                  transition={{ duration: 1.15, ease: [0.22, 1, 0.36, 1] }}
                />
              </svg>
              <div className="absolute inset-0 flex flex-col items-center justify-center">
                <CountUp value={score.value} className="text-[30px] num-display text-glow-gold" />
                <span className="text-[9.5px] text-muted-foreground">من 100</span>
              </div>
            </div>
            <div className="flex-1 min-w-0">
              <div className="text-[10.5px] font-semibold text-primary/90">درجة Systemy</div>
              <div className="mt-1 text-[18px] font-bold">{score.grade}</div>
              <p className="mt-1.5 text-[11px] leading-relaxed text-muted-foreground">
                مالك وعاداتك ودفترك — صورتك العامة الآن
              </p>
            </div>
          </div>

          {/* أشرطة العوامل */}
          <div className="mt-4 space-y-3">
            {score.factors.map((f, i) => (
              <div key={f.key}>
                <div className="flex items-center justify-between mb-1">
                  <span className="text-[11px] font-medium">{f.label}</span>
                  <span className="tabular text-[11px] text-muted-foreground">
                    {formatNumber(Math.round(f.value))}%
                  </span>
                </div>
                <div className="h-1.5 rounded-full bg-black/[0.04] overflow-hidden">
                  <motion.div
                    className="h-full rounded-full"
                    style={{ background: FACTOR_COLORS[i % FACTOR_COLORS.length] }}
                    initial={{ width: 0 }}
                    animate={{ width: `${Math.max(2, Math.min(100, f.value))}%` }}
                    transition={{ duration: 0.9, delay: 0.2 + i * 0.12, ease: [0.22, 1, 0.36, 1] }}
                  />
                </div>
                <p className="mt-1 text-[10px] text-muted-foreground">{f.hint}</p>
              </div>
            ))}
          </div>

          <div className="mt-4 flex items-start gap-2 rounded-2xl border border-primary/20 bg-primary/[0.06] px-3.5 py-2.5">
            <Sparkles className="mt-0.5 w-3.5 h-3.5 shrink-0 text-primary" />
            <p className="text-[11.5px] leading-relaxed">
              <span className="font-semibold text-primary">خطوة واحدة لرفعها: </span>
              {score.step}
            </p>
          </div>
        </GlassCard>
      </motion.div>

      {/* ═══ قصة الأسبوع ═══ */}
      <motion.div {...widgetEnter(0.14)}>
        <GlassCard className="p-4 mb-3">
          <div className="mb-3 flex items-center justify-between">
            <span className="text-[10.5px] font-semibold text-muted-foreground">قصة الأسبوع</span>
            <Chip>آخر 7 أيام</Chip>
          </div>
          <h2 className="text-[17px] font-bold leading-snug text-primary text-glow-gold">{story.headline}</h2>
          <div className="mt-4 space-y-3">
            {story.sections.map((s) => {
              const Icon = s.icon;
              return (
                <div key={s.title} className="flex items-start gap-2.5">
                  <div
                    className="w-8 h-8 shrink-0 rounded-xl flex items-center justify-center"
                    style={{ background: `${TONE_HEX[s.tone]}1F`, color: TONE_HEX[s.tone] }}
                  >
                    <Icon className="w-4 h-4" aria-hidden="true" />
                  </div>
                  <div className="min-w-0">
                    <div className="text-[11.5px] font-semibold leading-4" style={{ color: TONE_HEX[s.tone] }}>
                      {s.title}
                    </div>
                    <p className="mt-0.5 text-[11.5px] leading-relaxed text-foreground/85">{s.body}</p>
                  </div>
                </div>
              );
            })}
          </div>
          <div className="my-3.5 h-px bg-black/[0.04]" />
          <div className="rounded-2xl border border-dashed border-primary/40 bg-primary/[0.05] px-3.5 py-3">
            <div className="mb-1 text-[10.5px] font-semibold text-primary">جرّب هذا الأسبوع</div>
            <p className="text-[12px] leading-relaxed">{story.suggestion}</p>
          </div>
        </GlassCard>
      </motion.div>

      {/* ═══ التنبؤ بالتدفق النقدي ═══ */}
      {ins.showPredictions ? (
        <motion.div {...widgetEnter(0.2)}>
          <GlassCard className="p-4 mb-3">
            <div className="mb-1 flex items-center justify-between">
              <span className="text-[10.5px] font-semibold text-muted-foreground">التنبؤ بالتدفق النقدي</span>
              <Chip>90 يوماً</Chip>
            </div>
            <p className="mb-2 text-[11px] text-muted-foreground">
              خط سير رصيدك لو استمر إيقاعك الحالي — إشارة لا وعداً
            </p>
            <FlowChart points={flowData} privacy={privacyMode} />
            <div className="mt-2 flex items-center justify-between">
              <span className="text-[11px] text-muted-foreground">رصيد متوقع بعد 90 يوماً</span>
              <PrivateAmount
                className={cn(
                  "text-[13px] font-bold",
                  predictions.days90 < 0 ? "text-coral" : "text-cyan"
                )}
              >
                {formatMoney(predictions.days90)}
              </PrivateAmount>
            </div>
            {predictions.critical && (
              <div className="mt-3 flex items-start gap-2 rounded-2xl border border-coral/25 bg-coral/10 px-3.5 py-3">
                <Info className="mt-0.5 w-4 h-4 shrink-0 text-coral" />
                <p className="text-[11.5px] leading-relaxed text-coral/90">{predictions.critical}</p>
              </div>
            )}
          </GlassCard>
        </motion.div>
      ) : (
        <GlassCard className="p-4 mb-3">
          <EmptyState
            compact
            icon={<Banknote className="w-6 h-6" />}
            title="التنبؤ يبدأ بأول معاملة"
            hint="سجّل معاملة أو أنشئ حساباً وسيبدأ خط رصيدك بالرسم هنا"
            actionLabel="سجّل معاملة"
            onAction={() => openQuickAdd("expense")}
          />
        </GlassCard>
      )}

      {/* ═══ الارتباطات ═══ */}
      <motion.div {...widgetEnter(0.26)}>
        <SectionHeader title="ارتباطات لطيفة" icon={<Activity className="w-3.5 h-3.5 text-cyan" />} />
        {correlations.length > 0 ? (
          <div className="mb-3 space-y-2.5">
            {correlations.map((c, i) => {
              const Icon = c.icon;
              return (
                <GlassCard key={i} className="flex items-start gap-2.5 p-3.5">
                  <div className="w-8 h-8 shrink-0 rounded-xl bg-cyan/10 flex items-center justify-center text-cyan">
                    <Icon className="w-4 h-4" aria-hidden="true" />
                  </div>
                  <div className="min-w-0 flex-1">
                    <p className="text-[11.5px] leading-relaxed">{c.text}</p>
                    <Chip className="mt-2 text-muted-foreground">ثقة {c.confidence}</Chip>
                  </div>
                </GlassCard>
              );
            })}
          </div>
        ) : (
          <GlassCard className="mb-3 p-4">
            <p className="py-3 text-center text-[11.5px] text-muted-foreground leading-relaxed">
              تحتاج الرؤى مزيداً من الأيام المسجّلة — سجّل مزاجك وعاداتك أياماً وستظهر لك ارتباطات لطيفة هنا
            </p>
          </GlassCard>
        )}
      </motion.div>

      {/* ═══ كشف الشذوذ ═══ */}
      <motion.div {...widgetEnter(0.32)}>
        <SectionHeader title="كشف الشذوذ" icon={<TrendingUp className="w-3.5 h-3.5 text-lav" />} />
        <GlassCard className="mb-3 p-4">
          <div className="space-y-3">
            {anomalies.length > 0 ? (
              anomalies.map((a, i) => {
                const Icon = a.icon;
                return (
                  <div key={i} className="flex items-center gap-2.5">
                    <div className="w-8 h-8 shrink-0 rounded-xl bg-lav/10 flex items-center justify-center text-lav">
                      <Icon className="w-4 h-4" aria-hidden="true" />
                    </div>
                    <p className="flex-1 text-[11.5px] leading-relaxed">{a.text}</p>
                  </div>
                );
              })
            ) : (
              <div className="flex items-center gap-2.5">
                <div className="w-8 h-8 shrink-0 rounded-xl bg-mint/10 flex items-center justify-center text-mint">
                  <CheckCircle2 className="w-4 h-4" aria-hidden="true" />
                </div>
                <p className="flex-1 text-[11.5px] leading-relaxed">
                  لا شذوذ هذا الأسبوع — إيقاعك متزن والمظاريف ضمن حدودها
                </p>
              </div>
            )}
          </div>
        </GlassCard>
      </motion.div>

      {/* ═══ مزاج آخر 14 يوماً ═══ */}
      <motion.div {...widgetEnter(0.38)}>
        <SectionHeader title="مزاج آخر 14 يوماً" icon={<Smile className="w-3.5 h-3.5 text-mint" />} />
        <GlassCard className="mb-3 p-4">
          {moodHasData ? (
            <MoodChart series={moodSeries} />
          ) : (
            <p className="py-6 text-center text-[11.5px] text-muted-foreground">
              سجّل مزاجك من الدفتر — نقرة واحدة يومياً وسترسم خطك هنا
            </p>
          )}
        </GlassCard>
      </motion.div>

      {/* ═══ المزاج مقابل الإنفاق ═══ */}
      <motion.div {...widgetEnter(0.44)}>
        <SectionHeader title="المزاج مقابل الإنفاق" icon={<Smile className="w-3.5 h-3.5 text-mint" />} />
        <GlassCard className="mb-3 p-4">
          <p className="mb-2 text-[11px] text-muted-foreground">
            متوسط صرفك اليومي في أيام كل مزاج — آخر 30 يوماً
          </p>
          {spendVsMood.length > 0 ? (
            <>
              <MoodSpendBars data={spendVsMood} />
              <p className="mt-3 text-[11.5px] font-medium leading-relaxed text-primary">{ins.moodSummary}</p>
            </>
          ) : (
            <p className="py-6 text-center text-[11.5px] text-muted-foreground">
              سجّل مزاجك أياماً قليلة وستظهر هنا الصورة — بلا أحكام
            </p>
          )}
        </GlassCard>
      </motion.div>

      {/* ═══ اسأل Sys ═══ */}
      <motion.button
        {...widgetEnter(0.5)}
        type="button"
        whileTap={{ scale: 0.97 }}
        onClick={() => setSysOpen(true)}
        className="glass glow-cyan w-full h-12 rounded-2xl flex items-center justify-center gap-2 text-[13px] font-semibold text-cyan transition-transform duration-200 hover:scale-[1.01]"
      >
        <Bot className="w-[18px] h-[18px]" />
        اسأل Sys عن أي شيء
      </motion.button>
    </div>
  );
}
