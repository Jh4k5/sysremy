"use client";

/**
 * المساعد Sys v2 — يعرف بياناتك المحلية:
 * أونلاين: يرسل سياقاً مبنياً من قاعدة جهازك إلى /api/sys (لا يُخزَّن شيء).
 * أوفلاين (APK): محرك قواعد محلي هادئ يجيب بأرقامك.
 */
import { useCallback, useEffect, useRef, useState } from "react";
import { AnimatePresence, motion } from "framer-motion";
import { Bot, X, Send, WifiOff } from "lucide-react";
import { db, getSettings } from "@/lib/db";
import { useUIStore } from "@/store/ui-store";
import { isStandalone } from "@/lib/standalone";
import { safeToSpend, spentOnQuery, monthSummary, netWorth } from "@/lib/money";
import { formatMoney, formatNumber, todayISO, addDaysISO } from "@/lib/format";
import { habitStreak } from "@/lib/types";
import { Chip } from "../glass";
import { cn } from "@/lib/utils";

interface Msg {
  role: "user" | "assistant";
  content: string;
}

const WELCOME: Msg = {
  role: "assistant",
  content: "أهلاً! أنا Sys — أعرف بياناتك لأنها على جهازك. اسألني عن مصاريفك أو عاداتك أو اطلب خطة توفير.",
};

const SUGGESTIONS = [
  "كم صرفت على القهوة هذا الشهر؟",
  "لخّص أسبوعي",
  "كيف أوفّر 5000 خلال 8 أشهر؟",
  "ما الرصيد الآمن اليوم؟",
];

function TypingDots() {
  return (
    <div className="glass rounded-2xl px-4 py-3 flex items-center gap-1.5 w-fit">
      {[0, 1, 2].map((i) => (
        <motion.span
          key={i}
          className="w-1.5 h-1.5 rounded-full bg-cyan/80"
          animate={{ opacity: [0.25, 1, 0.25], scale: [0.85, 1.15, 0.85] }}
          transition={{ duration: 1.1, repeat: Infinity, delay: i * 0.18, ease: "easeInOut" }}
        />
      ))}
    </div>
  );
}

/** بناء سياق بيانات المستخدم نصياً — من قاعدة جهازه فقط */
async function buildLocalContext(): Promise<string> {
  const [settings, txs, habits, habitLogs, recurrings, goals, accounts, assets, debts] = await Promise.all([
    getSettings(),
    db.transactions.toArray(),
    db.habits.toArray(),
    db.habitLogs.toArray(),
    db.recurrings.toArray(),
    db.goals.toArray(),
    db.accounts.toArray(),
    db.assets.toArray(),
    db.debts.toArray(),
  ]);
  const today = todayISO();
  const cur = settings.currency;
  const lines: string[] = [];

  const ms = monthSummary(settings, txs, today);
  lines.push(`— هذا الشهر المالي: صرف ${formatMoney(ms.spent, cur)} من ${ms.txCount} معاملة، دخل ${formatMoney(ms.income, cur)}${ms.delta !== 0 ? ` (${ms.delta > 0 ? "أعلى" : "أقل"} بـ${Math.abs(ms.delta)}% من الشهر الماضي)` : ""}.`);

  const nw = netWorth(accounts, txs, assets, debts);
  lines.push(`— صافي الثروة: ${formatMoney(nw.total, cur)} (حسابات ${formatMoney(nw.accountsTotal, cur)} + أصول ${formatMoney(nw.assetsTotal, cur)} − ديون ${formatMoney(nw.liabilities, cur)}).`);

  const safe = safeToSpend(settings, txs, recurrings, goals, today);
  lines.push(`— الرصيد الآمن اليومي: ${formatMoney(safe.amount, cur)} لـ${safe.daysLeft} يوم متبقية (دخل متوقع ${formatMoney(safe.expectedIncome, cur)} − التزامات ${formatMoney(safe.commitments, cur)} − أهداف ${formatMoney(safe.goalContributions, cur)} − مصروف ${formatMoney(safe.spent, cur)}).`);

  // أعلى فئات الشهر
  const catById = new Map((await db.categories.toArray()).map((c) => [c.id, c]));
  const monthStart = addDaysISO(today, -30);
  const byCat = new Map<string, number>();
  for (const t of txs) {
    if (t.type !== "expense" || !t.categoryId || t.date.slice(0, 10) < monthStart) continue;
    byCat.set(t.categoryId, (byCat.get(t.categoryId) ?? 0) + t.amount);
  }
  const topCats = [...byCat.entries()].sort((a, b) => b[1] - a[1]).slice(0, 4);
  if (topCats.length > 0) {
    lines.push(`— أعلى فئات 30 يوماً: ${topCats.map(([id, v]) => `${catById.get(id)?.name ?? "أخرى"} ${formatMoney(Math.round(v), cur)}`).join("، ")}.`);
  }

  const activeHabits = habits.filter((h) => !h.archived);
  if (activeHabits.length > 0) {
    const parts = activeHabits.slice(0, 4).map((h) => {
      const streak = habitStreak(habitLogs.filter((l) => l.habitId === h.id).map((l) => ({ date: l.date, count: l.count })), today, h.target);
      return `${h.name} (سلسلة ${streak})`;
    });
    lines.push(`— العادات: ${parts.join("، ")}.`);
  }

  const activeGoals = goals.filter((g) => !g.archived && g.targetAmount > 0);
  if (activeGoals.length > 0) {
    lines.push(`— الأهداف: ${activeGoals.map((g) => `${g.name} ${formatMoney(g.savedAmount, cur)}/${formatMoney(g.targetAmount, cur)} (${Math.round((g.savedAmount / g.targetAmount) * 100)}%)`).join("، ")}.`);
  }

  const upcoming = recurrings.filter((r) => r.active).sort((a, b) => a.nextDate.localeCompare(b.nextDate)).slice(0, 4);
  if (upcoming.length > 0) {
    lines.push(`— التزامات قادمة: ${upcoming.map((r) => `${r.name} ${formatMoney(r.amount, cur)} في ${r.nextDate}`).join("، ")}.`);
  }

  const lastTxs = [...txs].sort((a, b) => b.date.localeCompare(a.date)).slice(0, 5);
  if (lastTxs.length > 0) {
    lines.push(`— آخر معاملات: ${lastTxs.map((t) => `${t.description} ${formatMoney(t.amount, cur)} (${t.type === "income" ? "دخل" : "مصروف"})`).join("؛ ")}.`);
  }

  return lines.join("\n");
}

/** الردود المحلية الهادئة — تعمل بلا شبكة (APK) */
async function localReply(text: string): Promise<string> {
  const [settings, txs, habits, habitLogs, recurrings, goals, accounts, assets, debts] = await Promise.all([
    getSettings(),
    db.transactions.toArray(),
    db.habits.toArray(),
    db.habitLogs.toArray(),
    db.recurrings.toArray(),
    db.goals.toArray(),
    db.accounts.toArray(),
    db.assets.toArray(),
    db.debts.toArray(),
  ]);
  const today = todayISO();
  const cur = settings.currency;
  const t = text.trim();

  // صرف على شيء محدد
  const onMatch = t.match(/(?:صرفت|أنفقت|انفقت)\s*.*?على\s+(.+)/) ?? t.match(/كم\s+.*?على\s+(.+)/);
  if (onMatch) {
    const q = onMatch[1].replace(/[؟?.]/g, "").trim().split(/\s+/).slice(0, 2).join(" ");
    const { total, count } = spentOnQuery(txs, q, today);
    if (count > 0) return `صرفت على «${q}» ${formatMoney(total, cur)} خلال آخر 30 يوماً من ${formatNumber(count)} معاملة.`;
    return `لا معاملات على «${q}» في آخر 30 يوماً — جرّب كلمة أخرى أو سجّل أول واحدة بزر +`;
  }

  // ملخص الأسبوع
  if (/لخص|لخّص|أسبوعي|اسبوعي/.test(t)) {
    const weekStart = addDaysISO(today, -6);
    const prevStart = addDaysISO(today, -13);
    const spent = txs.filter((x) => x.type === "expense" && x.date.slice(0, 10) >= weekStart).reduce((s, x) => s + x.amount, 0);
    const prev = txs.filter((x) => x.type === "expense" && x.date.slice(0, 10) >= prevStart && x.date.slice(0, 10) < weekStart).reduce((s, x) => s + x.amount, 0);
    const income = txs.filter((x) => x.type === "income" && x.date.slice(0, 10) >= weekStart).reduce((s, x) => s + x.amount, 0);
    const logs = habitLogs.filter((l) => l.date >= weekStart).reduce((s, l) => s + l.count, 0);
    const delta = prev > 0 ? Math.round(((spent - prev) / prev) * 100) : 0;
    return `هذا الأسبوع: صرف ${formatMoney(Math.round(spent), cur)}${prev > 0 ? ` (${delta > 0 ? "أعلى" : "أقل"} بـ${Math.abs(delta)}%)` : ""} · دخل ${formatMoney(Math.round(income), cur)} · ${formatNumber(logs)} تسجيل عادة. ${delta > 15 ? "جرّب تثبيت أكبر مظروف هذا الأسبوع." : "إيقاعك جيد — استمر."}`;
  }

  // الدخل
  if (/دخل|راتب|مرتب/.test(t)) {
    const ms = monthSummary(settings, txs, today);
    return `دخل هذا الشهر المالي ${formatMoney(ms.income, cur)}. صافي الثروة ${formatMoney(netWorth(accounts, txs, assets, debts).total, cur)}.`;
  }

  // العادات
  if (/عاد|سلسلة|سلسل/.test(t)) {
    const active = habits.filter((h) => !h.archived);
    if (active.length === 0) return "لا عادات بعد — أنشئ أول عادة من شاشة العادات، وابدأ بواحدة صغيرة (دقيقتان).";
    const parts = active.slice(0, 3).map((h) => {
      const streak = habitStreak(habitLogs.filter((l) => l.habitId === h.id).map((l) => ({ date: l.date, count: l.count })), today, h.target);
      return `${h.name} ${formatNumber(streak)} يوم`;
    });
    return `أقوى سلاسلك: ${parts.join("، ")}. كل إنجاز يبني إيقاعك — والسلسلة متسامحة.`;
  }

  // الادخار/التوفير
  if (/وفر|أوفر|ادخار|توفير|ادخار/.test(t)) {
    const goal = goals.filter((g) => !g.archived)[0];
    if (goal) {
      const pct = Math.round((goal.savedAmount / goal.targetAmount) * 100);
      return `هدفك «${goal.name}» وصل ${pct}% (${formatMoney(goal.savedAmount, cur)} من ${formatMoney(goal.targetAmount, cur)}). مساهمتك الشهرية ${formatMoney(goal.monthly, cur)} تُحتسب في الرصيد الآمن.`;
    }
    return "أنشئ هدفاً من زر + (تبويب هدف) — المساهمة الشهرية تُقتطع تلقائياً من الرصيد الآمن.";
  }

  // الرصيد الآمن (افتراضي)
  const safe = safeToSpend(settings, txs, recurrings, goals, today);
  return `رصيدك الآمن اليوم ${formatMoney(safe.amount, cur)} لـ${formatNumber(safe.daysLeft)} يوم متبقية. (${isStandalone() ? "أعمل الآن محلياً بلا اتصال —" : ""} للأسئلة الأوسع، جرّبني أونلاين.)`;
}

export function SysChat() {
  const sysOpen = useUIStore((s) => s.sysOpen);
  const setSysOpen = useUIStore((s) => s.setSysOpen);

  const [messages, setMessages] = useState<Msg[]>([WELCOME]);
  const [input, setInput] = useState("");
  const [busy, setBusy] = useState(false);

  const listRef = useRef<HTMLDivElement>(null);
  const inputRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    const el = listRef.current;
    if (el) el.scrollTo({ top: el.scrollHeight, behavior: "smooth" });
  }, [messages, busy, sysOpen]);

  useEffect(() => {
    if (sysOpen) {
      const t = setTimeout(() => inputRef.current?.focus(), 350);
      return () => clearTimeout(t);
    }
  }, [sysOpen]);

  useEffect(() => {
    if (!sysOpen) return;
    const handler = (e: KeyboardEvent) => {
      if (e.key === "Escape") setSysOpen(false);
    };
    window.addEventListener("keydown", handler);
    return () => window.removeEventListener("keydown", handler);
  }, [sysOpen, setSysOpen]);

  const send = useCallback(
    async (raw: string) => {
      const content = raw.trim();
      if (!content || busy) return;

      const nextMessages: Msg[] = [...messages, { role: "user", content }];
      setMessages(nextMessages);
      setInput("");
      setBusy(true);

      const offline = isStandalone() || (typeof navigator !== "undefined" && !navigator.onLine);

      try {
        if (offline) {
          // ردود محلية هادئة
          await new Promise((r) => setTimeout(r, 450));
          const reply = await localReply(content);
          setMessages([...nextMessages, { role: "assistant", content: reply }]);
        } else {
          const context = await buildLocalContext();
          const res = await fetch("/api/sys", {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({ messages: nextMessages, context }),
          });
          if (!res.ok) throw new Error();
          const data = (await res.json()) as { reply?: string; error?: string };
          if (!data.reply) throw new Error();
          setMessages([...nextMessages, { role: "assistant", content: data.reply }]);
        }
      } catch {
        // الشبكة فشلت → محرك محلي
        try {
          const reply = await localReply(content);
          setMessages([...nextMessages, { role: "assistant", content: `${reply}\n\n(وضع محلي — بياناتك سليمة)` }]);
        } catch {
          setMessages([...nextMessages, { role: "assistant", content: "تعذر الرد الآن — بياناتك المحلية سليمة، جرّب بعد لحظات" }]);
        }
      } finally {
        setBusy(false);
      }
    },
    [busy, messages]
  );

  return (
    <AnimatePresence>
      {sysOpen && (
        <>
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            onClick={() => setSysOpen(false)}
            className="absolute inset-0 z-40 bg-black/55 backdrop-blur-sm"
          />
          <motion.div
            initial={{ y: "100%" }}
            animate={{ y: 0 }}
            exit={{ y: "100%" }}
            transition={{ type: "spring", stiffness: 380, damping: 38 }}
            className="absolute inset-x-0 bottom-0 top-14 z-50 flex flex-col"
            role="dialog"
            aria-label="محادثة Sys"
          >
            {/* الترويسة */}
            <div className="glass-deep border-b border-white/10 px-4 py-3 flex items-center gap-3 shrink-0">
              <span className="w-10 h-10 rounded-full bg-cyan/15 border border-cyan/30 flex items-center justify-center text-cyan">
                <Bot className="w-5 h-5" />
              </span>
              <div className="flex-1 min-w-0">
                <p className="text-[14px] font-bold">Sys</p>
                <p className="text-[10.5px] text-muted-foreground flex items-center gap-1">
                  {isStandalone() ? (
                    <>
                      <WifiOff className="w-3 h-3" /> محلي — يعمل بأرقامك بلا اتصال
                    </>
                  ) : (
                    "يعرف بياناتك — تُقرأ من جهازك فقط"
                  )}
                </p>
              </div>
              <button
                onClick={() => setSysOpen(false)}
                className="w-9 h-9 rounded-full glass-soft flex items-center justify-center text-muted-foreground"
                aria-label="إغلاق"
              >
                <X className="w-4 h-4" />
              </button>
            </div>

            {/* الرسائل */}
            <div ref={listRef} className="flex-1 overflow-y-auto sys-scroll px-4 py-4 space-y-3">
              {messages.map((m, i) => (
                <motion.div
                  key={i}
                  initial={{ opacity: 0, y: 10 }}
                  animate={{ opacity: 1, y: 0 }}
                  className={cn("flex", m.role === "user" ? "justify-start" : "justify-end")}
                >
                  {m.role === "user" ? (
                    <div className="glass-soft rounded-2xl rounded-tr-sm px-4 py-2.5 max-w-[80%]">
                      <p className="text-[13px] leading-relaxed">{m.content}</p>
                    </div>
                  ) : (
                    <div className="glass rounded-2xl rounded-tl-sm px-4 py-2.5 max-w-[85%] border border-cyan/15">
                      <p className="text-[13px] leading-[1.9] text-foreground/95 whitespace-pre-line">{m.content}</p>
                    </div>
                  )}
                </motion.div>
              ))}
              {busy && (
                <div className="flex justify-end">
                  <TypingDots />
                </div>
              )}
              {messages.length === 1 && !busy && (
                <div className="flex flex-wrap gap-2 justify-end pt-2">
                  {SUGGESTIONS.map((s) => (
                    <Chip key={s} className="cursor-pointer hover:bg-black/[0.05] border-cyan/20" >
                      <button onClick={() => void send(s)} className="text-[11px]">
                        {s}
                      </button>
                    </Chip>
                  ))}
                </div>
              )}
            </div>

            {/* الإدخال */}
            <form
              onSubmit={(e) => {
                e.preventDefault();
                void send(input);
              }}
              className="glass-deep border-t border-white/10 p-3 pb-4 flex items-center gap-2 shrink-0"
            >
              <input
                ref={inputRef}
                value={input}
                onChange={(e) => setInput(e.target.value)}
                placeholder="اسأل عن أي شيء في نظامك…"
                className="flex-1 h-12 rounded-xl glass-soft border border-black/[0.07] px-4 text-[13.5px] focus:border-cyan/40 focus:outline-none"
                dir="auto"
                aria-label="رسالة إلى Sys"
              />
              <button
                type="submit"
                disabled={busy || !input.trim()}
                className="w-12 h-12 rounded-xl bg-cyan/20 border border-cyan/30 text-cyan flex items-center justify-center disabled:opacity-40 transition-opacity shrink-0"
                aria-label="إرسال"
              >
                <Send className="w-5 h-5 -scale-x-100" />
              </button>
            </form>
          </motion.div>
        </>
      )}
    </AnimatePresence>
  );
}
