"use client";

/**
 * شريط الأوامر v2 — Ctrl+K: بحث حي في قاعدة جهازك (معاملات، ملاحظات، عادات،
 * أهداف، أحداث) + أوامر تنقل + التقاط ذكي: اكتب جملة عربية → يُحللها محرك
 * القواعد ويقترح الإضافة الصحيحة بنقرة واحدة.
 */
import { useEffect, useMemo, useRef, useState } from "react";
import * as DialogPrimitive from "@radix-ui/react-dialog";
import { Command as CommandPrimitive } from "cmdk";
import {
  Command, CommandList, CommandGroup, CommandItem,
} from "@/components/ui/command";
import {
  CornerDownLeft, Zap, EyeOff, Bot, CalendarDays, Shapes, NotebookPen,
  Sparkles, Wallet, Search, Plus, TrendingUp, Flame, Target, Bell,
  Settings as SettingsIcon, LayoutGrid, type LucideIcon,
} from "lucide-react";
import { db, getSettings, useLive } from "@/lib/db";
import { useUIStore } from "@/store/ui-store";
import { parseCapture } from "@/lib/capture-rules";
import type { QuickAddTab } from "@/lib/types";
import { formatMoney, formatNumber, relativeDay, todayISO } from "@/lib/format";
import { iconByName } from "../ui-bits";
import { cn } from "@/lib/utils";

interface Hit {
  id: string;
  kind: "command" | "transaction" | "note" | "habit" | "goal" | "block";
  title: string;
  subtitle?: string;
  icon: string;
  action: () => void;
}

const CAPTURE_KIND_TAB: Record<string, QuickAddTab> = {
  expense: "expense",
  income: "income",
  task: "task",
  mood: "note",
  note: "note",
};

export function CommandBar({ open }: { open: boolean }) {
  const { setCommandOpen, openQuickAdd, setView, togglePrivacy, setSysOpen, setAlertsOpen } = useUIStore();
  const [q, setQ] = useState("");

  const base = useLive(async () => {
    const [settings, txs, notes, habits, goals, blocks, categories] = await Promise.all([
      getSettings(),
      db.transactions.toArray(),
      db.notes.toArray(),
      db.habits.toArray(),
      db.goals.toArray(),
      db.blocks.toArray(),
      db.categories.toArray(),
    ]);
    return { settings, txs, notes, habits, goals, blocks, categories };
  }, [open]);

  const query = q.trim();

  /* التقاط ذكي: جملة تُحلل → إجراء */
  const capture = useMemo(() => {
    if (!base || query.length < 4) return null;
    const parsed = parseCapture(query, base.categories);
    if (parsed.confidence === "low" && !parsed.amount) return null;
    const tab = CAPTURE_KIND_TAB[parsed.kind] ?? "expense";
    const labels: Record<string, string> = {
      expense: "مصروف",
      income: "دخل",
      task: "مهمة",
      mood: "مزاج/يومية",
      note: "ملاحظة",
    };
    const desc = [
      parsed.amount ? `${formatMoney(parsed.amount, base.settings.currency)}` : null,
      parsed.categoryName,
      relativeDay(parsed.date),
    ]
      .filter(Boolean)
      .join(" · ");
    return { parsed, tab, label: labels[parsed.kind] ?? "إدخال", desc };
  }, [base, query]);

  /* نتائج البحث الحية */
  const hits = useMemo<Hit[]>(() => {
    if (!base) return [];
    const out: Hit[] = [];
    const qq = query.toLowerCase();

    // أوامر — تظهر دائماً
    if (!qq) {
      out.push(
        { id: "c-add", kind: "command", title: "إضافة سريعة — سجّل أي شيء", icon: "zap", action: () => openQuickAdd() },
        { id: "c-sys", kind: "command", title: "اسأل Sys — مساعدك الذكي", icon: "bot", action: () => setSysOpen(true) },
        { id: "c-cal", kind: "command", title: "افتح التقويم", icon: "calendar-days", action: () => setView("calendar") },
        { id: "c-money", kind: "command", title: "افتح المال", icon: "wallet", action: () => setView("money") },
        { id: "c-habits", kind: "command", title: "افتح العادات", icon: "flame", action: () => setView("habits") },
        { id: "c-journal", kind: "command", title: "افتح الدفتر", icon: "notebook-pen", action: () => setView("journal") },
        { id: "c-insights", kind: "command", title: "افتح الرؤى", icon: "sparkles", action: () => setView("insights") },
        { id: "c-alerts", kind: "command", title: "مركز التنبيهات", icon: "bell", action: () => setAlertsOpen(true) },
        { id: "c-settings", kind: "command", title: "الإعدادات", icon: "settings", action: () => setView("settings") },
        { id: "c-more", kind: "command", title: "المزيد", icon: "grid", action: () => setView("more") },
        { id: "c-privacy", kind: "command", title: "تبديل الخصوصية (إخفاء المبالغ)", icon: "eye-off", action: togglePrivacy }
      );
      return out;
    }

    // معاملات
    for (const t of base.txs) {
      if (
        t.description.toLowerCase().includes(qq) ||
        (t.merchant ?? "").toLowerCase().includes(qq) ||
        t.tags.toLowerCase().includes(qq)
      ) {
        const cat = t.categoryId ? base.categories.find((c) => c.id === t.categoryId) : null;
        out.push({
          id: t.id,
          kind: "transaction",
          title: `${t.description} · ${formatMoney(t.amount, base.settings.currency)}`,
          subtitle: `${t.type === "income" ? "دخل" : t.type === "transfer" ? "تحويل" : "مصروف"}${cat ? ` · ${cat.name}` : ""} · ${relativeDay(t.date.slice(0, 10))}`,
          icon: cat?.icon ?? "wallet",
          action: () => openQuickAdd(t.type === "income" ? "income" : "expense", { editTxId: t.id }),
        });
      }
    }
    // ملاحظات
    for (const n of base.notes) {
      if (n.title.toLowerCase().includes(qq) || n.content.toLowerCase().includes(qq) || n.tags.toLowerCase().includes(qq)) {
        out.push({
          id: n.id,
          kind: "note",
          title: n.title,
          subtitle: `${n.type === "journal" ? "يومية" : "ملاحظة"} · ${relativeDay(n.date)}`,
          icon: "notebook-pen",
          action: () => setView("journal"),
        });
      }
    }
    // عادات
    for (const h of base.habits.filter((x) => !x.archived)) {
      if (h.name.toLowerCase().includes(qq)) {
        out.push({ id: h.id, kind: "habit", title: h.name, subtitle: "عادة", icon: h.icon, action: () => setView("habits") });
      }
    }
    // أهداف
    for (const g of base.goals.filter((x) => !x.archived)) {
      if (g.name.toLowerCase().includes(qq)) {
        out.push({
          id: g.id,
          kind: "goal",
          title: `${g.emoji} ${g.name}`,
          subtitle: `${formatNumber(Math.round((g.savedAmount / Math.max(1, g.targetAmount)) * 100))}% · ${formatMoney(g.savedAmount, base.settings.currency)}`,
          icon: "target",
          action: () => setView("money"),
        });
      }
    }
    // أحداث
    for (const b of base.blocks) {
      if (b.title.toLowerCase().includes(qq)) {
        out.push({ id: b.id, kind: "block", title: b.title, subtitle: `حدث · ${relativeDay(b.date)}`, icon: "calendar-days", action: () => setView("calendar") });
      }
    }

    return out.slice(0, 20);
  }, [base, query, openQuickAdd, setView, togglePrivacy, setSysOpen, setAlertsOpen]);

  const handleOpenChange = (o: boolean) => {
    setCommandOpen(o);
    if (!o && q !== "") setQ("");
  };

  const hostRef = useRef<HTMLDivElement>(null);
  const [container, setContainer] = useState<HTMLElement | null>(null);
  useEffect(() => {
    setContainer(hostRef.current);
  }, []);

  const run = (fn: () => void) => {
    setCommandOpen(false);
    setTimeout(fn, 60);
  };

  const kindMeta: Record<Hit["kind"], { icon: string; bg: string; label: string }> = {
    command: { icon: "text-primary", bg: "bg-primary/12 border-primary/25", label: "أوامر" },
    transaction: { icon: "text-gold", bg: "bg-gold/10 border-gold/25", label: "معاملات" },
    note: { icon: "text-lav", bg: "bg-lav/10 border-lav/25", label: "ملاحظات" },
    habit: { icon: "text-mint", bg: "bg-mint/10 border-mint/25", label: "عادات" },
    goal: { icon: "text-primary", bg: "bg-primary/12 border-primary/25", label: "أهداف" },
    block: { icon: "text-cyan", bg: "bg-cyan/10 border-cyan/25", label: "أحداث" },
  };

  return (
    <div ref={hostRef}>
      {container && (
        <DialogPrimitive.Root open={open} onOpenChange={handleOpenChange}>
          <DialogPrimitive.Portal container={container}>
            <DialogPrimitive.Overlay className="absolute inset-0 z-40 bg-black/60 backdrop-blur-sm" />
            <DialogPrimitive.Content
              className="absolute z-50 top-6 inset-x-3 rounded-2xl glass-deep border border-white/10 overflow-hidden shadow-2xl"
              aria-label="شريط الأوامر"
            >
              <CommandPrimitive label="شريط الأوامر" className="flex flex-col" shouldFilter={false}>
                <div className="flex items-center gap-2.5 px-4 border-b border-black/[0.06]">
                  <Search className="w-4 h-4 text-muted-foreground shrink-0" />
                  <CommandPrimitive.Input
                    value={q}
                    onValueChange={setQ}
                    autoFocus
                    placeholder="ابحث… أو اكتب جملة مثل: قهوة 18 من ستاربكس"
                    className="flex-1 h-13 py-4 bg-transparent text-[13.5px] outline-none placeholder:text-muted-foreground/60"
                    dir="auto"
                  />
                  <kbd className="glass-soft rounded-md px-1.5 py-0.5 text-[9.5px] text-muted-foreground tabular shrink-0">ESC</kbd>
                </div>

                <CommandList className="max-h-[46vh] overflow-y-auto sys-scroll px-2 py-2">
                  {/* التقاط ذكي */}
                  {capture && (
                    <CommandGroup heading="التقاط ذكي — سجّلها بنقرة">
                      <CommandItem
                        onSelect={() => run(() => openQuickAdd(capture.tab))}
                        className="gap-3 py-3"
                      >
                        <span className="w-9 h-9 rounded-xl bg-primary/15 border border-primary/40 flex items-center justify-center shrink-0">
                          <Plus className="w-4 h-4 text-primary" />
                        </span>
                        <div className="min-w-0 flex-1">
                          <p className="text-[13px] font-semibold">
                            {capture.label}: «{capture.parsed.description}»
                          </p>
                          <p className="text-[10.5px] text-muted-foreground">{capture.desc || "اضغط لتعبئة النموذج تلقائياً"}</p>
                        </div>
                        <CornerDownLeft className="w-3.5 h-3.5 text-muted-foreground shrink-0" />
                      </CommandItem>
                    </CommandGroup>
                  )}

                  {hits.length === 0 && query && (
                    <p className="text-center text-[12px] text-muted-foreground py-8">
                      لا نتائج لـ«{query}» — جرّب كلمة أقصر أو سجّلها من + مباشرة
                    </p>
                  )}

                  {/* النتائج مجمعة */}
                  {(["command", "transaction", "note", "habit", "goal", "block"] as const)
                    .map((kind) => ({ kind, items: hits.filter((h) => h.kind === kind) }))
                    .filter((g) => g.items.length > 0)
                    .slice(0, 3)
                    .map((g) => (
                      <CommandGroup key={g.kind} heading={kindMeta[g.kind].label}>
                        {g.items.map((hit) => {
                          const meta = kindMeta[hit.kind];
                          return (
                            <CommandItem key={hit.id} onSelect={() => run(hit.action)} className="gap-3 py-2.5">
                              <span className={cn("w-9 h-9 rounded-xl border flex items-center justify-center shrink-0", meta.bg)}>
                                {(() => {
                                  const I = ICON_OVERRIDES[hit.icon] ?? iconByName(hit.icon);
                                  return <I className={cn("w-[17px] h-[17px]", meta.icon)} />;
                                })()}
                              </span>
                              <div className="min-w-0 flex-1">
                                <p className="text-[12.5px] font-medium truncate">{hit.title}</p>
                                {hit.subtitle && <p className="text-[10.5px] text-muted-foreground truncate">{hit.subtitle}</p>}
                              </div>
                            </CommandItem>
                          );
                        })}
                      </CommandGroup>
                    ))}
                </CommandList>
              </CommandPrimitive>
            </DialogPrimitive.Content>
          </DialogPrimitive.Portal>
        </DialogPrimitive.Root>
      )}
    </div>
  );
}

const ICON_OVERRIDES: Record<string, LucideIcon> = {
  bot: Bot,
  grid: LayoutGrid,
  settings: SettingsIcon,
  bell: Bell,
  "trending-up": TrendingUp,
};
