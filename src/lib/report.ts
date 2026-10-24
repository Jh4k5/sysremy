/**
 * Systemy v2.1 — مولّد مستخلص التقارير بصيغة HTML
 * تقرير شهري شامل مستقل تماماً (CSS+SVG مضمّنة): يُحمّل كملف واحد
 * ويغطي كل الأنظمة — المال والميزانية والعادات والمزاج والدفتر والتقويم.
 */
"use client";

import { db, getSettings } from "./db";
import type {
  Account,
  Asset,
  Category,
  Course,
  Debt,
  DocumentRecord,
  Goal,
  Habit,
  HabitLog,
  HomeItem,
  Note,
  Mood as MoodRow,
  Person,
  Project,
  Recurring,
  Task,
  TimeBlock,
  Transaction,
  Trip,
} from "./types";
import { habitStreak, DOC_TYPE_LABELS, HEALTH_META, type HealthKind, type HealthLog, type ListItem } from "./types";
import { toast } from "sonner";
import {
  addDaysISO,
  diffDays,
  financeMonthLabel,
  formatDate,
  formatFullDate,
  formatMoney,
  formatNumber,
  fromISODate,
  todayISO,
} from "./format";
import {
  accountBalances,
  budgetPacing,
  categorySeries,
  envelopes,
  monthWindow,
  netWorth,
  safeToSpend,
  type BudgetPacing,
} from "./money";

/* ═══════════════════════ أدوات ═══════════════════════ */

/** تهريب نص HTML */
function esc(s: string): string {
  return s
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&#39;");
}

const STATUS_META: Record<BudgetPacing["status"], { label: string; color: string }> = {
  unset: { label: "غير محددة", color: "#8A93A6" },
  great: { label: "أمام الوتيرة 👏", color: "#6EE7A8" },
  good: { label: "على المسار", color: "#5CE1E6" },
  careful: { label: "خلف الوتيرة", color: "#F5B95C" },
  over: { label: "تجاوزت الميزانية", color: "#FF8E7A" },
};

function money(n: number, cur: string): string {
  return esc(formatMoney(n, cur));
}

/* ═══════════════════════ البناء ═══════════════════════ */

export async function buildReportHTML(): Promise<string> {
  const today = todayISO();
  const [settings, accounts, categories, txs, recurrings, goals, assets, debts, habits, habitLogs, moods, tasks, notes, blocks, healthLogs, courses, flashcards, projects, people, documents, trips, listItems, homeItems] =
    await Promise.all([
      getSettings(),
      db.accounts.toArray(),
      db.categories.toArray(),
      db.transactions.toArray(),
      db.recurrings.toArray(),
      db.goals.toArray(),
      db.assets.toArray(),
      db.debts.toArray(),
      db.habits.toArray(),
      db.habitLogs.toArray(),
      db.moods.toArray(),
      db.tasks.toArray(),
      db.notes.toArray(),
      db.blocks.toArray(),
      db.healthLogs.toArray(),
      db.courses.toArray(),
      db.flashcards.toArray(),
      db.projects.toArray(),
      db.people.toArray(),
      db.documents.toArray(),
      db.trips.toArray(),
      db.listItems.toArray(),
      db.homeItems.toArray(),
    ]);
  return renderReport({
    today,
    settings: { displayName: settings.displayName, currency: settings.currency || "ر.س", monthStartDay: settings.monthStartDay, weekStart: settings.weekStart, monthlyBudget: settings.monthlyBudget },
    accounts, categories, txs, recurrings, goals, assets, debts, habits, habitLogs, moods, tasks, notes, blocks,
    healthLogs, courses, flashcards, projects, people, documents, trips, listItems, homeItems,
  });
}

interface ReportInput {
  today: string;
  settings: { displayName: string; currency: string; monthStartDay: number; weekStart: "sat" | "sun" | "mon"; monthlyBudget?: number };
  accounts: Account[];
  categories: Category[];
  txs: Transaction[];
  recurrings: Recurring[];
  goals: Goal[];
  assets: Asset[];
  debts: Debt[];
  habits: Habit[];
  habitLogs: HabitLog[];
  moods: MoodRow[];
  tasks: Task[];
  notes: Note[];
  blocks: TimeBlock[];
  // v3
  healthLogs?: HealthLog[];
  courses?: Course[];
  flashcards?: import("./types").Flashcard[];
  projects?: Project[];
  people?: Person[];
  documents?: DocumentRecord[];
  trips?: Trip[];
  listItems?: ListItem[];
  homeItems?: HomeItem[];
}

function renderReport(d: ReportInput): string {
  const cur = d.settings.currency;
  const w = monthWindow({ monthStartDay: d.settings.monthStartDay || 1 }, d.today);
  const monthTxs = d.txs.filter((t) => {
    const dd = t.date.slice(0, 10);
    return dd >= w.start && dd <= w.end;
  });
  const spent = monthTxs.filter((t) => t.type === "expense").reduce((s, t) => s + t.amount, 0);
  const income = monthTxs.filter((t) => t.type === "income").reduce((s, t) => s + t.amount, 0);
  const pacing = budgetPacing(
    { monthStartDay: d.settings.monthStartDay, weekStart: d.settings.weekStart, monthlyBudget: d.settings.monthlyBudget },
    d.categories,
    d.txs,
    d.today
  );
  const nw = netWorth(d.accounts, d.txs, d.assets, d.debts);
  const safe = safeToSpend({ monthStartDay: d.settings.monthStartDay, monthlyIncome: income }, d.txs, d.recurrings, d.goals, d.today);
  const balances = accountBalances(d.accounts, d.txs);
  const envs = envelopes(d.categories, d.txs, w);
  const cats = categorySeries(d.categories, d.txs, w, 8);
  const stMeta = STATUS_META[pacing.status];
  const savingsRate = income > 0 ? Math.round(((income - spent) / income) * 100) : 0;

  /* مخطط الصرف اليومي — SVG أعمدة لكل أيام الشهر المالي */
  const days: { iso: string; value: number }[] = [];
  for (let i = 0; i < w.daysTotal; i++) {
    const iso = addDaysISO(w.start, i);
    days.push({
      iso,
      value: Math.round(monthTxs.filter((t) => t.type === "expense" && t.date.slice(0, 10) === iso).reduce((s, t) => s + t.amount, 0)),
    });
  }
  const chart = dailyChartSVG(days, pacing.monthlyBudget / w.daysTotal, cur, d.today);

  /* العادات: إنجاز الشهر */
  const daysElapsed = Math.min(w.daysTotal, Math.max(1, diffDays(w.start, d.today) + 1));
  const habitRows = d.habits
    .filter((h) => !h.archived)
    .map((h) => {
      const logs = d.habitLogs.filter((l) => l.habitId === h.id && l.date >= w.start && l.date <= w.end);
      const doneDays = logs.filter((l) => l.count >= h.target).length;
      const expected = h.cadence === "weekly" ? Math.max(1, Math.round((h.daysPerWeek ?? 3) * (daysElapsed / 7))) : daysElapsed;
      const pct = Math.min(100, Math.round((doneDays / Math.max(1, expected)) * 100));
      const streak = habitStreak(
        d.habitLogs.filter((l) => l.habitId === h.id).map((l) => ({ date: l.date, count: l.count })),
        d.today,
        h.target
      );
      const goal = h.goalId ? d.goals.find((g) => g.id === h.goalId) : undefined;
      return { h, doneDays, expected, pct, streak, goal };
    });

  /* المزاج */
  const monthMoods = d.moods.filter((m) => m.date >= w.start && m.date <= w.end);
  const moodDist = [1, 2, 3, 4, 5].map((score) => monthMoods.filter((m) => m.score === score).length);
  const moodAvg = monthMoods.length > 0 ? monthMoods.reduce((s, m) => s + m.score, 0) / monthMoods.length : 0;
  const MOOD_FACES = ["😖", "🙁", "😐", "🙂", "😄"];

  /* الدفتر والمهام والتقويم */
  const monthNotes = d.notes.filter((n) => n.date >= w.start && n.date <= w.end);
  const journals = monthNotes.filter((n) => n.type === "journal");
  const monthTasks = d.tasks.filter((t) => t.date >= w.start && t.date <= w.end);
  const doneTasks = monthTasks.filter((t) => t.done);
  const monthBlocks = d.blocks.filter((b) => b.date >= w.start && b.date <= w.end);
  const upcomingBlocks = d.blocks
    .filter((b) => b.date > d.today)
    .sort((a, b) => a.date.localeCompare(b.date))
    .slice(0, 5);
  const upcomingDue = d.recurrings
    .filter((r) => r.active && r.type === "expense")
    .sort((a, b) => a.nextDate.localeCompare(b.nextDate))
    .slice(0, 5);
  const topNotes = [...d.notes]
    .sort((a, b) => (b.pinned ? 1 : 0) - (a.pinned ? 1 : 0) || b.updatedAt.localeCompare(a.updatedAt))
    .slice(0, 3);

  const topCatMax = cats[0]?.value ?? 1;

  /* آخر معاملات الشهر — آخر 15 */
  const catById = new Map(d.categories.map((c) => [c.id, c]));
  const accById = new Map(d.accounts.map((a) => [a.id, a]));
  const recentTxs = [...monthTxs].sort((a, b) => b.date.localeCompare(a.date)).slice(0, 15);

  return `<!DOCTYPE html>
<html lang="ar" dir="rtl">
<head>
<meta charset="UTF-8">
<meta name="viewport" content="width=device-width, initial-scale=1">
<title>مستخلص Systemy — ${esc(financeMonthLabel(d.today, d.settings.monthStartDay || 1))}</title>
<style>
  :root { color-scheme: dark; }
  * { margin:0; padding:0; box-sizing:border-box; }
  body {
    font-family: "IBM Plex Sans Arabic", "Segoe UI", Tahoma, system-ui, sans-serif;
    background:#0B0F1A; color:#E8ECF4; line-height:1.8; padding:24px 14px 60px;
    -webkit-print-color-adjust: exact; print-color-adjust: exact;
  }
  .wrap { max-width: 760px; margin:0 auto; }
  .panel { background:rgba(255,255,255,0.032); border:1px solid rgba(255,255,255,0.08); border-radius:18px; padding:18px 20px; margin-bottom:14px; }
  .hero { text-align:center; padding:34px 20px 26px; background:linear-gradient(135deg, rgba(245,185,92,0.10), rgba(92,225,230,0.07)); border:1px solid rgba(245,185,92,0.22); border-radius:22px; margin-bottom:16px; }
  .hero .logo { font-size:34px; }
  .hero h1 { font-size:23px; margin-top:6px; }
  .hero .sub { color:#9AA5B8; font-size:12.5px; margin-top:4px; }
  .hero .who { color:#F5B95C; font-weight:700; }
  h2 { font-size:15px; margin-bottom:12px; display:flex; align-items:center; gap:8px; }
  h2 .dot { width:8px; height:8px; border-radius:99px; display:inline-block; }
  .kgrid { display:grid; grid-template-columns:repeat(2,1fr); gap:10px; }
  @media(min-width:560px){ .kgrid { grid-template-columns:repeat(4,1fr); } }
  .kpi { background:rgba(255,255,255,0.04); border:1px solid rgba(255,255,255,0.07); border-radius:14px; padding:12px 10px; text-align:center; }
  .kpi .v { font-size:17px; font-weight:800; direction:ltr; }
  .kpi .l { font-size:10.5px; color:#9AA5B8; margin-top:3px; }
  .gold { color:#F5B95C; } .cyan { color:#5CE1E6; } .mint { color:#6EE7A8; } .coral { color:#FF8E7A; } .lav { color:#C4B5FD; }
  .bar { height:9px; border-radius:99px; background:rgba(255,255,255,0.07); overflow:hidden; }
  .bar > i { display:block; height:100%; border-radius:99px; }
  .row { display:flex; align-items:center; gap:10px; padding:9px 0; border-top:1px solid rgba(255,255,255,0.05); }
  .row:first-of-type { border-top:0; }
  .row .name { flex:1; min-width:0; font-size:12.5px; }
  .row .val { font-size:12.5px; font-weight:700; direction:ltr; white-space:nowrap; }
  .pill { font-size:10px; font-weight:700; border-radius:99px; padding:2px 9px; white-space:nowrap; }
  table { width:100%; border-collapse:collapse; font-size:12.5px; }
  th { text-align:right; color:#9AA5B8; font-size:10.5px; font-weight:600; padding:7px 4px; border-bottom:1px solid rgba(255,255,255,0.08); }
  td { padding:8px 4px; border-bottom:1px solid rgba(255,255,255,0.045); }
  td.num { direction:ltr; text-align:right; font-weight:700; white-space:nowrap; }
  .pace { display:grid; grid-template-columns:repeat(3,1fr); gap:10px; margin-top:12px; }
  .pace .p { text-align:center; background:rgba(255,255,255,0.04); border-radius:14px; padding:12px 6px; border:1px solid rgba(255,255,255,0.06); }
  .pace .p .v { font-size:16px; font-weight:800; direction:ltr; }
  .pace .p .l { font-size:10px; color:#9AA5B8; }
  .hint { font-size:10.5px; color:#9AA5B8; margin-top:8px; }
  .foot { text-align:center; color:#7D8798; font-size:10.5px; margin-top:22px; line-height:2; }
  svg { display:block; width:100%; height:auto; }
  .moodrow { display:flex; align-items:center; gap:8px; padding:5px 0; }
  .moodrow .face { font-size:17px; width:26px; text-align:center; }
</style>
</head>
<body>
<div class="wrap">

  <div class="hero">
    <div class="logo">🌙</div>
    <h1>مستخلص <span class="gold">Systemy</span> — ${esc(financeMonthLabel(d.today, d.settings.monthStartDay || 1))}</h1>
    <p class="sub">${d.settings.displayName ? `<span class="who">${esc(d.settings.displayName)}</span> · ` : ""}${esc(formatFullDate(d.today))} · عملة العرض: ${esc(cur)}</p>
    <p class="sub">الشهر المالي: ${esc(formatDate(w.start))} ← ${esc(formatDate(w.end))} (${formatNumber(w.daysTotal)} يوماً)</p>
  </div>

  <!-- الملخص التنفيذي -->
  <div class="panel">
    <h2><span class="dot" style="background:#F5B95C"></span>الملخص التنفيذي</h2>
    <div class="kgrid">
      <div class="kpi"><div class="v gold">${money(nw.total, cur)}</div><div class="l">صافي الثروة</div></div>
      <div class="kpi"><div class="v mint">${money(income, cur)}</div><div class="l">الدخل هذا الشهر</div></div>
      <div class="kpi"><div class="v coral">${money(spent, cur)}</div><div class="l">المصروف</div></div>
      <div class="kpi"><div class="v cyan">${income > 0 ? formatNumber(savingsRate) + "%" : "—"}${income > 0 ? "" : ""}</div><div class="l">معدل الادخار</div></div>
    </div>
    <p class="hint">الرصيد الآمن اليومي المشتق: <b class="cyan">${money(safe.amount, cur)}</b> · ${formatNumber(monthTxs.length)} معاملة مسجلة هذا الشهر</p>
  </div>

  <!-- الميزانية -->
  <div class="panel">
    <h2><span class="dot" style="background:#5CE1E6"></span>ميزانية الصرف الشهرية</h2>
    <div style="display:flex;align-items:center;justify-content:space-between;margin-bottom:7px">
      <span style="font-size:12px;color:#9AA5B8">${pacing.derived ? "مشتقة من مجموع مظاريف الفئات" : "الميزانية المحددة"}</span>
      <span class="pill" style="background:${stMeta.color}22;color:${stMeta.color}">${stMeta.label}</span>
    </div>
    <div class="row" style="border:0;padding:2px 0 8px">
      <span class="name"><b>${money(pacing.monthlyBudget, cur)}</b> الميزانية · صُرف <b>${money(pacing.spent, cur)}</b></span>
      <span class="val ${pacing.monthRemaining < 0 ? "coral" : "mint"}">${money(pacing.monthRemaining, cur)} متبقي</span>
    </div>
    <div class="bar"><i style="width:${Math.min(100, pacing.percent)}%;background:${pacing.monthRemaining < 0 ? "#FF8E7A" : pacing.status === "careful" ? "#F5B95C" : "#6EE7A8"}"></i></div>
    <div class="pace">
      <div class="p"><div class="v ${pacing.todayRemaining < 0 ? "coral" : "gold"}">${money(pacing.todayRemaining, cur)}</div><div class="l">متبقي اليوم</div></div>
      <div class="p"><div class="v ${pacing.weekRemaining < 0 ? "coral" : "cyan"}">${money(pacing.weekRemaining, cur)}</div><div class="l">متبقي الأسبوع</div></div>
      <div class="p"><div class="v ${pacing.monthRemaining < 0 ? "coral" : "mint"}">${money(pacing.monthRemaining, cur)}</div><div class="l">متبقي الشهر</div></div>
    </div>
    <p class="hint">
      الوتيرة المستهدفة حتى اليوم: ${money(pacing.expectedByNow, cur)} · ${pacing.delta > 0 ? `صرفت أكثر بـ <b class="coral">${money(pacing.delta, cur)}</b>` : pacing.delta < 0 ? `أنت أمام الوتيرة بـ <b class="mint">${money(-pacing.delta, cur)}</b>` : "على الوتيرة تماماً"}
      ${pacing.projectedOver > 0 ? ` · بتوقعك الحالي ستتجاوز <b class="coral">${money(pacing.projectedOver, cur)}</b> نهاية الشهر` : " · بمعدلك الحالي ستكمل الشهر داخل الميزانية ✓"}
    </p>
  </div>

  <!-- إيقاع الصرف اليومي -->
  <div class="panel">
    <h2><span class="dot" style="background:#F5B95C"></span>إيقاع الصرف اليومي — كل أيام الشهر</h2>
    ${chart}
    <p class="hint">الخط المنقّط = الحصة اليومية المتساوية (${money(Math.round(pacing.monthlyBudget / w.daysTotal), cur)}) · أعمدة اليوم وما قبله = صرف فعلي، وما بعده أيام قادمة</p>
  </div>

  <!-- آخر المعاملات -->
  ${recentTxs.length > 0 ? `
  <div class="panel">
    <h2><span class="dot" style="background:#F5B95C"></span>آخر معاملات الشهر (${formatNumber(monthTxs.length)})</h2>
    <table>
      <tr><th>التاريخ</th><th>الوصف</th><th>الفئة</th><th>المبلغ</th></tr>
      ${recentTxs
        .map((t) => {
          const cat = t.categoryId ? catById.get(t.categoryId) : undefined;
          const acc = accById.get(t.accountId);
          const isIn = t.type === "income";
          return `<tr><td style="white-space:nowrap;color:#9AA5B8;font-size:11px">${esc(formatDate(t.date.slice(0, 10)))}${t.date.length > 10 ? ` · ${esc(t.date.slice(11, 16))}` : ""}</td><td>${esc(t.description)}${t.merchant ? ` <span style="color:#9AA5B8;font-size:10px">· ${esc(t.merchant)}</span>` : ""}${acc ? ` <span style="color:#7D8798;font-size:10px">(${esc(acc.name)})</span>` : ""}</td><td style="font-size:11px">${cat ? `<span class="pill" style="background:${esc(cat.color)}22;color:${esc(cat.color)}">${esc(cat.name)}</span>` : `<span class="pill" style="background:rgba(255,255,255,0.06);color:#9AA5B8">غير مصنّف</span>`}</td><td class="num ${isIn ? "mint" : "coral"}">${isIn ? "+" : "−"}${money(t.amount, cur)}</td></tr>`;
        })
        .join("")}
    </table>
    ${monthTxs.length > 15 ? `<p class="hint">أحدث 15 من ${formatNumber(monthTxs.length)} معاملة هذا الشهر — التفاصيل الكاملة داخل التطبيق</p>` : ""}
  </div>` : ""}

  <!-- الفئات -->
  <div class="panel">
    <h2><span class="dot" style="background:#C4B5FD"></span>أعلى فئات الصرف</h2>
    ${cats.length === 0 ? `<p class="hint">لا مصروفات مصنّفة هذا الشهر</p>` : cats
      .map(
        (c) => `
    <div style="padding:7px 0">
      <div style="display:flex;justify-content:space-between;font-size:12.5px;margin-bottom:4px">
        <span>${esc(c.name)}</span><b style="direction:ltr">${money(c.value, cur)}</b>
      </div>
      <div class="bar"><i style="width:${Math.max(5, (c.value / topCatMax) * 100)}%;background:${esc(c.color)}"></i></div>
    </div>`
      )
      .join("")}
  </div>

  <!-- المظاريف -->
  ${envs.length > 0 ? `
  <div class="panel">
    <h2><span class="dot" style="background:#6EE7A8"></span>مظاريف الميزانية (${formatNumber(envs.length)})</h2>
    <table>
      <tr><th>الفئة</th><th>الميزانية</th><th>المصروف</th><th>المتبقي</th><th>الحالة</th></tr>
      ${envs
        .map((e) => {
          const m =
            e.status === "over"
              ? { t: "تجاوز", c: "#FF8E7A" }
              : e.status === "careful"
                ? { t: `${formatNumber(e.percent)}%`, c: "#F5B95C" }
                : { t: `${formatNumber(e.percent)}%`, c: "#6EE7A8" };
          return `<tr><td>${esc(e.category.name)}</td><td class="num">${money(e.budget, cur)}</td><td class="num">${money(e.spent, cur)}</td><td class="num ${e.remaining < 0 ? "coral" : ""}">${money(e.remaining, cur)}</td><td><span class="pill" style="background:${m.c}22;color:${m.c}">${m.t}</span></td></tr>`;
        })
        .join("")}
    </table>
  </div>` : ""}

  <!-- الحسابات والأهداف والأصول -->
  <div class="panel">
    <h2><span class="dot" style="background:#F5B95C"></span>الحسابات</h2>
    ${d.accounts.length === 0 ? `<p class="hint">لا حسابات</p>` : `<table>
      <tr><th>الحساب</th><th>النوع</th><th>الرصيد الحالي</th></tr>
      ${d.accounts
        .map((a) => {
          const TYPES: Record<string, string> = { cash: "نقد", bank: "بنك", wallet: "محفظة", credit: "بطاقة", savings: "ادخار" };
          const bal = balances.get(a.id) ?? 0;
          return `<tr><td>${esc(a.name)}</td><td>${TYPES[a.type] ?? a.type}</td><td class="num ${bal < 0 ? "coral" : ""}">${money(bal, cur)}</td></tr>`;
        })
        .join("")}
    </table>`}
  </div>

  ${d.goals.filter((g) => !g.archived).length > 0 ? `
  <div class="panel">
    <h2><span class="dot" style="background:#FFB4A2"></span>أهداف الادخار</h2>
    ${d.goals
      .filter((g) => !g.archived)
      .map((g) => {
        const pct = Math.min(100, Math.round((g.savedAmount / Math.max(1, g.targetAmount)) * 100));
        return `<div style="padding:7px 0">
      <div style="display:flex;justify-content:space-between;font-size:12.5px;margin-bottom:4px">
        <span>${esc(g.emoji)} ${esc(g.name)}${g.targetDate ? ` <span style="color:#9AA5B8;font-size:10px">حتى ${esc(formatDate(g.targetDate))}</span>` : ""}</span>
        <b style="direction:ltr">${money(g.savedAmount, cur)} / ${money(g.targetAmount, cur)} · ${formatNumber(pct)}%</b>
      </div>
      <div class="bar"><i style="width:${Math.max(3, pct)}%;background:${esc(g.color)}"></i></div>
    </div>`;
      })
      .join("")}
  </div>` : ""}

  ${(d.assets.length > 0 || d.debts.length > 0) ? `
  <div class="panel">
    <h2><span class="dot" style="background:#8EC5FF"></span>الأصول والديون</h2>
    <div class="kgrid" style="grid-template-columns:repeat(3,1fr);margin-bottom:10px">
      <div class="kpi"><div class="v cyan">${money(nw.assetsTotal, cur)}</div><div class="l">أصول</div></div>
      <div class="kpi"><div class="v coral">${money(nw.liabilities, cur)}</div><div class="l">عليك (ديون)</div></div>
      <div class="kpi"><div class="v mint">${money(nw.receivable, cur)}</div><div class="l">لك (مستحق)</div></div>
    </div>
    ${d.assets.map((a) => `<div class="row"><span class="name">${esc(a.name)}</span><span class="val cyan">${money(a.value, cur)}</span></div>`).join("")}
    ${d.debts.map((dd) => `<div class="row"><span class="name">${esc(dd.name)} — ${esc(dd.person)}${dd.dueDate ? ` <span style="color:#9AA5B8;font-size:10px">(${esc(formatDate(dd.dueDate))})</span>` : ""}</span><span class="val ${dd.direction === "payable" ? "coral" : "mint"}">${money(dd.amount - dd.paid, cur)}</span></div>`).join("")}
  </div>` : ""}

  <!-- العادات -->
  ${habitRows.length > 0 ? `
  <div class="panel">
    <h2><span class="dot" style="background:#5CE1E6"></span>العادات — ${formatNumber(daysElapsed)} يوماً من الشهر</h2>
    <table>
      <tr><th>العادة</th><th>إنجاز/المستهدف</th><th>النسبة</th><th>السلسلة</th></tr>
      ${habitRows
        .map((r) => {
          const c = r.pct >= 80 ? "#6EE7A8" : r.pct >= 50 ? "#F5B95C" : "#FF8E7A";
          return `<tr><td>${esc(r.h.name)}${r.goal ? ` <span style="color:#9AA5B8;font-size:10px">→ ${esc(r.goal.emoji)} ${esc(r.goal.name)}</span>` : ""}</td><td class="num">${formatNumber(r.doneDays)}/${formatNumber(r.expected)}</td><td><span class="pill" style="background:${c}22;color:${c}">${formatNumber(r.pct)}%</span></td><td class="num gold">${formatNumber(r.streak)} 🔥</td></tr>`;
        })
        .join("")}
    </table>
    <p class="hint">كل عادة مربوطة بنظامها — والإنجاز الكامل يضيف ادخارها للهدف المرتبط تلقائياً</p>
  </div>` : ""}

  <!-- المزاج والدفتر -->
  <div class="panel">
    <h2><span class="dot" style="background:#C4B5FD"></span>المزاج والدفتر</h2>
    ${moodDist.map((count, i) => {
      const max = Math.max(1, ...moodDist);
      return `<div class="moodrow">
        <span class="face">${MOOD_FACES[i]}</span>
        <div class="bar" style="flex:1"><i style="width:${(count / max) * 100}%;background:${["#FF8E7A", "#F5B95C", "#8EC5FF", "#5CE1E6", "#6EE7A8"][i]}"></i></div>
        <span style="font-size:11px;direction:ltr;min-width:26px;text-align:left">${formatNumber(count)}</span>
      </div>`;
    }).join("")}
    <p class="hint">متوسط المزاج: <b>${monthMoods.length > 0 ? formatNumber(Math.round(moodAvg * 10) / 10) + "/5" : "—"}</b> · ${formatNumber(journals.length)} يومية و${formatNumber(monthNotes.length - journals.length)} ملاحظة هذا الشهر</p>
    ${topNotes.length > 0 ? `<div style="margin-top:8px">${topNotes
      .map((n) => `<div class="row"><span class="name">${n.pinned ? "📌 " : ""}${esc(n.title || n.content.slice(0, 40))}</span><span class="val" style="color:#9AA5B8;font-weight:400">${esc(formatDate(n.date))}</span></div>`)
      .join("")}</div>` : ""}
  </div>

  <!-- المهام والتقويم -->
  <div class="panel">
    <h2><span class="dot" style="background:#6EE7A8"></span>المهام والتقويم</h2>
    <div class="kgrid" style="grid-template-columns:repeat(3,1fr)">
      <div class="kpi"><div class="v mint">${formatNumber(doneTasks.length)}/${formatNumber(monthTasks.length)}</div><div class="l">مهام منجزة</div></div>
      <div class="kpi"><div class="v cyan">${formatNumber(monthBlocks.length)}</div><div class="l">أحداث مجدولة</div></div>
      <div class="kpi"><div class="v gold">${formatNumber(monthTxs.length)}</div><div class="l">معاملات الشهر</div></div>
    </div>
    ${upcomingBlocks.length > 0 ? `<p style="margin:10px 0 2px;font-size:11.5px;color:#9AA5B8">أحداث قادمة:</p>${upcomingBlocks.map((b) => `<div class="row"><span class="name">${esc(b.title)}</span><span class="val" style="color:#9AA5B8;font-weight:400">${esc(formatDate(b.date))} · ${esc(b.startTime)}</span></div>`).join("")}` : ""}
    ${upcomingDue.length > 0 ? `<p style="margin:10px 0 2px;font-size:11.5px;color:#9AA5B8">التزامات مستحقة قادماً:</p>${upcomingDue.map((r) => `<div class="row"><span class="name">${esc(r.name)}</span><span class="val coral">${money(r.amount, cur)}</span></div>`).join("")}` : ""}
  </div>

  ${renderV3Systems(d, cur)}

  <p class="foot">
    وُلّد محلياً على جهازك بواسطة <b class="gold">Systemy</b> — نظام تشغيل حياتك الشخصي<br>
    ${esc(formatFullDate(d.today))} · كل الأرقام مشتقة لحظياً من قاعدتك المحلية · افتح الملف بأي متصفح أو شاركه
  </p>
</div>
</body>
</html>`;
}

/** قسم أنظمة v3 — يظهر كل لوحة فقط عند وجود بيانات (صدق كامل مع الفراغ) */
function renderV3Systems(d: ReportInput, cur: string): string {
  const parts: string[] = [];

  // ─── الصحة ───
  const hl = d.healthLogs ?? [];
  if (hl.length > 0) {
    const monthHl = hl.filter((l) => l.date >= w0(d) && l.date <= d.today);
    const kinds = [...new Set(monthHl.map((l) => l.kind))] as HealthKind[];
    if (kinds.length > 0) {
      parts.push(`<div class="panel">
    <h2><span class="dot" style="background:#6EE7A8"></span>الصحة والجسم</h2>
    <div class="kgrid" style="grid-template-columns:repeat(${Math.min(4, kinds.length)} ,1fr)">
      ${kinds
        .map((k) => {
          const vals = monthHl.filter((l) => l.kind === k).map((l) => l.value);
          const avg = vals.length ? Math.round((vals.reduce((s, v) => s + v, 0) / vals.length) * 10) / 10 : 0;
          const meta = HEALTH_META[k];
          return `<div class="kpi"><div class="v mint">${formatNumber(avg)}</div><div class="l">${meta.label} (متوسط ${meta.unit})</div></div>`;
        })
        .join("")}
    </div>
    <p class="hint">${formatNumber(monthHl.length)} قياساً هذا الشهر — المزاج أعلاه والقياسات لا تُشخّص شيئاً، فقط تزامن</p>
  </div>`);
    }
  }

  // ─── التعلم ───
  const courses = (d.courses ?? []).filter((c) => !c.archived);
  const cards = d.flashcards ?? [];
  if (courses.length > 0 || cards.length > 0) {
    const dueCards = cards.filter((f) => f.nextReview <= d.today).length;
    const gradeRow = (c: Course): string => {
      let items: Array<{ name: string; weight: number; score: number; max: number }> = [];
      try {
        items = JSON.parse(c.gradeItems || "[]");
      } catch {
        items = [];
      }
      let acc = 0;
      let covered = 0;
      for (const it of items) {
        if (it.max > 0 && it.score >= 0) {
          acc += (it.score / it.max) * it.weight;
          covered += it.weight;
        }
      }
      const current = Math.round(acc * 10) / 10;
      const cc = current >= 80 ? "#6EE7A8" : current >= 60 ? "#F5B95C" : "#FF8E7A";
      return `<tr><td>${esc(c.name)}${c.code ? ` <span style="color:#9AA5B8;font-size:10px">${esc(c.code)}</span>` : ""}</td><td class="num">${formatNumber(cards.filter((f) => f.courseId === c.id).length)}</td><td><span class="pill" style="background:${cc}22;color:${cc}">${covered > 0 ? formatNumber(current) + "%" : "لا بنود"}</span></td><td class="num">${formatNumber(covered)}%</td></tr>`;
    };
    parts.push(`<div class="panel">
    <h2><span class="dot" style="background:#F5D565"></span>التعلم والدراسة</h2>
    ${courses.length > 0 ? `<table>
      <tr><th>المقرر</th><th>بطاقات</th><th>الدرجة المرجّحة</th><th>تغطية الأوزان</th></tr>
      ${courses.map(gradeRow).join("")}
    </table>` : ""}
    <p class="hint">${formatNumber(cards.length)} بطاقة مراجعة · <b class="gold">${formatNumber(dueCards)}</b> مستحقة اليوم (لايتنر)</p>
  </div>`);
  }

  // ─── المشاريع ───
  const projects = d.projects ?? [];
  if (projects.length > 0) {
    const pTx = d.txs.filter((t) => t.projectId);
    parts.push(`<div class="panel">
    <h2><span class="dot" style="background:#8EC5FF"></span>المشاريع والعمل</h2>
    ${projects
      .map((p) => {
        const pTasks = d.tasks.filter((t) => t.projectId === p.id);
        const done = pTasks.filter((t) => t.done).length;
        const pct = pTasks.length ? Math.round((done / pTasks.length) * 100) : 0;
        const income = pTx.filter((t) => t.projectId === p.id && t.type === "income").reduce((s, t) => s + t.amount, 0);
        const expense = pTx.filter((t) => t.projectId === p.id && t.type === "expense").reduce((s, t) => s + t.amount, 0);
        return `<div style="padding:7px 0">
      <div style="display:flex;justify-content:space-between;font-size:12.5px;margin-bottom:4px">
        <span>${esc(p.name)} <span style="color:#9AA5B8;font-size:10px">${formatNumber(done)}/${formatNumber(pTasks.length)} مهمة · ${p.status === "active" ? "نشط" : p.status === "paused" ? "متوقف" : "منجز"}</span></span>
        <b style="direction:ltr" class="cyan">${money(income - expense, cur)}</b>
      </div>
      <div class="bar"><i style="width:${Math.max(3, pct)}%;background:${esc(p.color)}"></i></div>
    </div>`;
      })
      .join("")}
    <p class="hint">صافي كل مشروع = الدخل المرتبط − المصاريف المرتبطة (من معاملات المال نفسها — لا عد مزدوج)</p>
  </div>`);
  }

  // ─── الأشخاص ───
  const people = d.people ?? [];
  if (people.length > 0) {
    const stale = people.filter((p) => !p.lastContact || diffDays(p.lastContact, d.today) > 30);
    parts.push(`<div class="panel">
    <h2><span class="dot" style="background:#F8B4D9"></span>الأشخاص والعلاقات</h2>
    <div class="kgrid" style="grid-template-columns:repeat(3,1fr)">
      <div class="kpi"><div class="v cyan">${formatNumber(people.length)}</div><div class="l">أشخاص</div></div>
      <div class="kpi"><div class="v gold">${formatNumber(people.filter((p) => p.favorite).length)}</div><div class="l">مفضلة</div></div>
      <div class="kpi"><div class="v coral">${formatNumber(stale.length)}</div><div class="l">لم تواصلهم منذ 30+ يوماً</div></div>
    </div>
    ${stale.length > 0 ? `<p class="hint">${stale.slice(0, 5).map((p) => esc(p.name)).join(" · ")}${stale.length > 5 ? " وغيرهم" : ""}</p>` : ""}
  </div>`);
  }

  // ─── المنزل ───
  const grocery = (d.listItems ?? []).filter((i) => i.scope === "grocery" && !i.done);
  const homeBills = (d.recurrings ?? []).filter((r) => r.home && r.active);
  const homeItems = d.homeItems ?? [];
  const needService = homeItems.filter((h) => h.nextService && h.nextService <= d.today);
  if (grocery.length > 0 || homeBills.length > 0 || homeItems.length > 0) {
    parts.push(`<div class="panel">
    <h2><span class="dot" style="background:#F5B95C"></span>المنزل والأسرة</h2>
    <div class="kgrid" style="grid-template-columns:repeat(3,1fr)">
      <div class="kpi"><div class="v gold">${formatNumber(grocery.length)}</div><div class="l">بنود بقالة معلقة</div></div>
      <div class="kpi"><div class="v cyan">${formatNumber(homeBills.length)}</div><div class="l">التزامات منزلية</div></div>
      <div class="kpi"><div class="v coral">${formatNumber(needService.length)}</div><div class="l">صيانة مستحقة</div></div>
    </div>
    ${needService.length > 0 ? `<p class="hint">تحتاج صيانة: ${needService.slice(0, 5).map((h) => esc(h.name)).join(" · ")}</p>` : ""}
  </div>`);
  }

  // ─── المستندات ───
  const docs = d.documents ?? [];
  if (docs.length > 0) {
    const soon45 = new Date(Date.now() + 45 * 86400_000).toISOString().slice(0, 10);
    const expiring = docs.filter((x) => x.expiryDate && x.expiryDate <= soon45);
    const expired = docs.filter((x) => x.expiryDate && x.expiryDate < d.today);
    parts.push(`<div class="panel">
    <h2><span class="dot" style="background:#5CE1E6"></span>المستندات والخزانة</h2>
    <div class="kgrid" style="grid-template-columns:repeat(3,1fr)">
      <div class="kpi"><div class="v cyan">${formatNumber(docs.length)}</div><div class="l">مستند</div></div>
      <div class="kpi"><div class="v gold">${formatNumber(expiring.length)}</div><div class="l">تنتهي خلال 45 يوماً</div></div>
      <div class="kpi"><div class="v coral">${formatNumber(expired.length)}</div><div class="l">منتهية</div></div>
    </div>
    ${expiring.length > 0 ? `<div style="margin-top:8px">${expiring.slice(0, 6).map((x) => `<div class="row"><span class="name">${esc(DOC_TYPE_LABELS[x.type] ?? x.type)} — ${esc(x.title)}</span><span class="val ${x.expiryDate! < d.today ? "coral" : "gold"}" style="font-weight:600">${esc(formatDate(x.expiryDate!))}</span></div>`).join("")}</div>` : ""}
  </div>`);
  }

  // ─── السفر ───
  const trips = d.trips ?? [];
  if (trips.length > 0) {
    parts.push(`<div class="panel">
    <h2><span class="dot" style="background:#C08457"></span>السفر والتجارب</h2>
    ${trips
      .map((t) => {
        const spent = d.txs.filter((x) => x.tripId === t.id && x.type === "expense").reduce((s, x) => s + x.amount, 0);
        const pct = t.budget > 0 ? Math.min(100, Math.round((spent / t.budget) * 100)) : 0;
        const st = t.status === "planned" ? "مخططة" : t.status === "active" ? "جارية" : "منتهية";
        return `<div style="padding:7px 0">
      <div style="display:flex;justify-content:space-between;font-size:12.5px;margin-bottom:4px">
        <span>${esc(t.name)} <span style="color:#9AA5B8;font-size:10px">${esc(t.destination)} · ${st}</span></span>
        <b style="direction:ltr">${money(spent, cur)} / ${money(t.budget, cur)}</b>
      </div>
      <div class="bar"><i style="width:${Math.max(3, pct)}%;background:${pct >= 100 ? "#FF8E7A" : "#C08457"}"></i></div>
    </div>`;
      })
      .join("")}
    <p class="hint">مصاريف كل رحلة = معاملات المال المرتبطة برحلتها (tripId) — مصدر واحد بلا عد مزدوج</p>
  </div>`);
  }

  return parts.join("\n  ");
}

/** بداية نافذة الشهر المالي للتقرير v3 */
function w0(d: ReportInput): string {
  return monthWindow({ monthStartDay: d.settings.monthStartDay || 1 }, d.today).start;
}

/* ═══════════════════════ مخطط SVG ═══════════════════════ */

function dailyChartSVG(days: { iso: string; value: number }[], dailyLine: number, _cur: string, today: string): string {
  const W = 700;
  const H = 170;
  const pad = 26;
  const innerW = W - pad * 2;
  const innerH = H - 34;
  const bw = Math.max(3, innerW / days.length - 3);
  const maxV = Math.max(dailyLine * 1.4, ...days.map((d) => d.value), 1);
  const y = (v: number) => H - 22 - (v / maxV) * innerH;
  const lineY = y(Math.max(0, dailyLine));
  const dayNum = (iso: string) => String(fromISODate(iso).getDate());

  const bars = days
    .map((d, i) => {
      // RTL: اليوم الأول يميناً
      const x = W - pad - (i + 1) * (innerW / days.length) + (innerW / days.length - bw) / 2;
      const isFuture = d.iso > today;
      const isToday = d.iso === today;
      const h = Math.max(d.value > 0 ? 3 : 1, (d.value / maxV) * innerH);
      const fill = d.value === 0 ? "rgba(255,255,255,0.06)" : isToday ? "#F5B95C" : "rgba(92,225,230,0.75)";
      const label = days.length <= 16 || i % 3 === 0 ? `<text x="${x + bw / 2}" y="${H - 6}" font-size="8" fill="${isToday ? "#F5B95C" : "#7D8798"}" text-anchor="middle">${dayNum(d.iso)}</text>` : "";
      const tip = d.value > 0 ? `<title>${d.iso} · ${d.value}</title>` : "";
      return `${tip}<rect x="${x.toFixed(1)}" y="${(H - 22 - h).toFixed(1)}" width="${bw.toFixed(1)}" height="${h.toFixed(1)}" rx="2.5" fill="${fill}" ${isFuture ? "opacity=0.25" : ""}/>${label}`;
    })
    .join("");

  return `<svg viewBox="0 0 ${W} ${H}" role="img" aria-label="مخطط الصرف اليومي">
    <line x1="${pad}" y1="${lineY.toFixed(1)}" x2="${W - pad}" y2="${lineY.toFixed(1)}" stroke="#F5B95C" stroke-width="1" stroke-dasharray="4 5" opacity="0.65"/>
    <text x="${W - pad}" y="${(lineY - 5).toFixed(1)}" font-size="9" fill="#F5B95C" text-anchor="end">حصة اليوم المتساوية</text>
    ${bars}
  </svg>`;
}

/* ═══════════════════════ التحميل والمشاركة ═══════════════════════ */

/** توليد التقرير وتنزيله كملف HTML واحد */
export async function downloadHTMLReport(): Promise<string> {
  const html = await buildReportHTML();
  const blob = new Blob([html], { type: "text/html;charset=utf-8" });
  const url = URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.href = url;
  a.download = `Systemy-${todayISO()}.html`;
  document.body.appendChild(a);
  a.click();
  a.remove();
  setTimeout(() => URL.revokeObjectURL(url), 5000);
  return `Systemy-${todayISO()}.html`;
}

/** فتح التقرير في تبويب جديد (للمعاينة قبل الحفظ) */
export async function openReportInNewTab(): Promise<void> {
  const html = await buildReportHTML();
  const blob = new Blob([html], { type: "text/html;charset=utf-8" });
  const url = URL.createObjectURL(blob);
  window.open(url, "_blank");
  setTimeout(() => URL.revokeObjectURL(url), 60000);
}

/* ═══════════════════════ تصدير المعاملات CSV (§6.1) ═══════════════════════ */

function csvCell(v: unknown): string {
  const s = v == null ? "" : String(v);
  return /[",\n\r]/.test(s) ? `"${s.replace(/"/g, '""')}"` : s;
}

/** تنزيل كل المعاملات CSV — أسماء أعمدة عربية، ترتيب زمني تنازلي، BOM لتفادي تشويه Excel للعربية */
export async function downloadTransactionsCSV(): Promise<number> {
  const [txs, accounts, categories] = await Promise.all([
    db.transactions.toArray(),
    db.accounts.toArray(),
    db.categories.toArray(),
  ]);
  if (txs.length === 0) {
    toast.info("لا معاملات للتصدير بعد");
    return 0;
  }
  const accName = new Map(accounts.map((a) => [a.id, a.name]));
  const catName = new Map(categories.map((c) => [c.id, c.name]));
  const typeLabel: Record<Transaction["type"], string> = {
    expense: "مصروف",
    income: "دخل",
    transfer: "تحويل",
  };
  const header = ["التاريخ", "الوقت", "النوع", "المبلغ", "الوصف", "الفئة", "الحساب", "الجهة", "الشخص", "الوسوم", "المصدر"];
  const rows = [...txs]
    .sort((a, b) => b.date.localeCompare(a.date))
    .map((t) => [
      t.date.slice(0, 10),
      t.date.slice(11, 16),
      typeLabel[t.type] ?? t.type,
      String(t.amount),
      t.description,
      t.categoryId ? catName.get(t.categoryId) ?? "" : "",
      accName.get(t.accountId) ?? "",
      t.merchant ?? "",
      t.person ?? "",
      t.tags,
      t.source,
    ]);
  const csv = [header, ...rows].map((r) => r.map(csvCell).join(",")).join("\r\n");
  const blob = new Blob(["\uFEFF" + csv], { type: "text/csv;charset=utf-8" });
  const url = URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.href = url;
  a.download = `Systemy-transactions-${todayISO()}.csv`;
  document.body.appendChild(a);
  a.click();
  a.remove();
  setTimeout(() => URL.revokeObjectURL(url), 5000);
  toast.success("صُدّرت المعاملات CSV ✓", { description: `${formatNumber(txs.length)} معاملة — تفتح مباشرة في Excel` });
  return rows.length;
}
