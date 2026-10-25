"use client";

/**
 * Systemy v3 — شاشة المنزل والأسرة (المدير الكامل)
 * بطل: بنود البقالة المعلقة + الفواتير المنزلية القادمة + ممتلكات تحتاج صيانة قريباً.
 * أربعة أقسام بتبويبات: البقالة (إضافة سريعة ومسح المنجز وتسجيل مصروف الشراء)
 * والفواتير (سداد بضغطة ينشئ معاملة) ومهام المنزل والممتلكات (ضمان وصيانة بتذكير تلقائي).
 * روابط سريعة للتقويم والمال — كل شيء محلي ويتفاعل لحظياً.
 */

import { useMemo, useState } from "react";
import { AnimatePresence, motion } from "framer-motion";
import {
  CalendarDays,
  Check,
  Eraser,
  Home,
  ListChecks,
  Plus,
  Receipt,
  ShoppingBasket,
  Sofa,
  Trash2,
  Wallet,
  Wrench,
} from "lucide-react";
import { db, getSettings, useLive } from "@/lib/db";
import {
  addListItem,
  addTask,
  clearDoneItems,
  deleteListItem,
  payRecurring,
  toggleListItem,
  toggleTask,
} from "@/lib/actions";
import { formatMoney, formatNumber, todayISO } from "@/lib/format";
import { useUIStore } from "@/store/ui-store";
import type { Account, HomeItem, ListItem, Recurring, Task } from "@/lib/types";
import { Chip, GlassCard, PrivateAmount, widgetEnter } from "@/components/systemy/glass";
import { iconByName } from "@/components/systemy/ui-bits";
import { cn } from "@/lib/utils";
import { HomeBillFormDialog } from "./home-bill-form-dialog";
import { HomeItemFormDialog } from "./home-item-form-dialog";
import { HomeItemDetailsDialog } from "./home-item-details-dialog";
import { FREQ_LABELS, dueBadge, serviceState, warrantyLabel } from "./shared";

type SectionKey = "grocery" | "bills" | "tasks" | "items";

export function HomeScreen() {
  const settings = useLive(() => getSettings(), []);
  const groceries = useLive(() => db.listItems.where("scope").equals("grocery").toArray(), []);
  const recurrings = useLive(() => db.recurrings.toArray(), []);
  const tasks = useLive(() => db.tasks.toArray(), []);
  const homeItems = useLive(() => db.homeItems.toArray(), []);
  const accounts = useLive(() => db.accounts.toArray(), []);

  const goToCalendar = useUIStore((s) => s.goToCalendar);
  const goToMoney = useUIStore((s) => s.goToMoney);
  const openQuickAdd = useUIStore((s) => s.openQuickAdd);

  const [tab, setTab] = useState<SectionKey>("grocery");
  const [billFormOpen, setBillFormOpen] = useState(false);
  const [itemFormOpen, setItemFormOpen] = useState(false);
  const [itemEditing, setItemEditing] = useState<HomeItem | null>(null);
  const [detailsItemId, setDetailsItemId] = useState<string | null>(null);

  const today = todayISO();

  const homeBills = useMemo(
    () =>
      (recurrings ?? [])
        .filter((r) => r.home)
        .sort((a, b) =>
          a.active === b.active ? a.nextDate.localeCompare(b.nextDate) : a.active ? -1 : 1,
        ),
    [recurrings],
  );

  const homeTasks = useMemo(
    () =>
      (tasks ?? [])
        .filter((t) => (t.tags ?? "").includes("منزل"))
        .sort((a, b) => (a.done === b.done ? a.date.localeCompare(b.date) : a.done ? 1 : -1)),
    [tasks],
  );

  const sortedItems = useMemo(
    () =>
      [...(homeItems ?? [])].sort((a, b) => {
        const sa = a.nextService ?? "9999-12-31";
        const sb = b.nextService ?? "9999-12-31";
        return sa.localeCompare(sb) || a.name.localeCompare(b.name, "ar");
      }),
    [homeItems],
  );

  const pendingGrocery = useMemo(() => (groceries ?? []).filter((i) => !i.done).length, [groceries]);
  const activeBills = useMemo(() => homeBills.filter((r) => r.active).length, [homeBills]);
  const maintenanceSoon = useMemo(
    () =>
      (homeItems ?? []).filter((h) => {
        const s = serviceState(h, today);
        return s.level === "over" || s.level === "soon";
      }).length,
    [homeItems, today],
  );

  const detailsItem = detailsItemId ? (homeItems ?? []).find((h) => h.id === detailsItemId) ?? null : null;

  // ---------- تحميل ----------
  if (!settings || !groceries || !recurrings || !tasks || !homeItems || !accounts) {
    return (
      <div
        className="h-full overflow-y-auto sys-scroll px-4 pt-3 pb-28"
        aria-busy="true"
        aria-label="جارٍ تحميل المنزل والأسرة"
      >
        <div className="glass-soft mb-3 h-14 animate-pulse rounded-3xl" />
        <div className="glass-soft mb-3 h-24 animate-pulse rounded-3xl" />
        <div className="glass-soft mb-3 h-12 animate-pulse rounded-3xl" />
        <div className="glass-soft h-40 animate-pulse rounded-3xl" />
      </div>
    );
  }

  const tabs: Array<{ key: SectionKey; label: string; icon: typeof Home; count: number }> = [
    { key: "grocery", label: "البقالة", icon: ShoppingBasket, count: pendingGrocery },
    { key: "bills", label: "الفواتير", icon: Receipt, count: activeBills },
    { key: "tasks", label: "مهام المنزل", icon: ListChecks, count: homeTasks.filter((t) => !t.done).length },
    { key: "items", label: "الممتلكات", icon: Sofa, count: homeItems.length },
  ];

  return (
    <div className="h-full overflow-y-auto sys-scroll px-4 pt-3 pb-28">
      {/* ═══ الترويسة ═══ */}
      <motion.header {...widgetEnter(0)} className="mb-3 px-1">
        <h1 className="text-[22px] font-bold leading-tight">المنزل والأسرة</h1>
        <p className="mt-0.5 text-[12px] text-muted-foreground">
          بقالة وفواتير ومهام وممتلكات — منزل واحد منظّم بضغطات قليلة
        </p>
      </motion.header>

      {/* ═══ البطل ═══ */}
      <motion.div {...widgetEnter(0.05)} className="mb-3">
        <GlassCard className="p-4">
          <div className="grid grid-cols-3 divide-x divide-x-reverse divide-black/[0.05]">
            <div className="px-2 text-center">
              <p className="num-display text-[24px] font-bold tabular text-cyan">{formatNumber(pendingGrocery)}</p>
              <p className="mt-1 text-[10px] leading-tight text-muted-foreground">بند بقالة معلق</p>
            </div>
            <div className="px-2 text-center">
              <p className="num-display text-[24px] font-bold tabular text-foreground">{formatNumber(activeBills)}</p>
              <p className="mt-1 text-[10px] leading-tight text-muted-foreground">فاتورة منزلية قادمة</p>
            </div>
            <div className="px-2 text-center">
              <p className="num-display text-[24px] font-bold tabular text-coral">{formatNumber(maintenanceSoon)}</p>
              <p className="mt-1 text-[10px] leading-tight text-muted-foreground">صيانة خلال 30 يوماً</p>
            </div>
          </div>
        </GlassCard>
      </motion.div>

      {/* ═══ روابط سريعة ═══ */}
      <motion.div {...widgetEnter(0.08)} className="mb-3 flex gap-2">
        <button
          type="button"
          onClick={() => goToCalendar()}
          className="flex h-11 flex-1 items-center justify-center gap-2 rounded-2xl glass-soft border border-black/[0.07] text-[12px] font-medium text-foreground/85 transition-colors hover:bg-black/[0.04] active:scale-[0.98]"
        >
          <CalendarDays className="h-4 w-4 text-primary" aria-hidden="true" />
          التقويم
        </button>
        <button
          type="button"
          onClick={() => goToMoney()}
          className="flex h-11 flex-1 items-center justify-center gap-2 rounded-2xl glass-soft border border-black/[0.07] text-[12px] font-medium text-foreground/85 transition-colors hover:bg-black/[0.04] active:scale-[0.98]"
        >
          <Wallet className="h-4 w-4 text-primary" aria-hidden="true" />
          المال
        </button>
      </motion.div>

      {/* ═══ تبويبات الأقسام ═══ */}
      <motion.div
        {...widgetEnter(0.1)}
        className="mb-3 flex gap-2 overflow-x-auto no-scrollbar"
        role="tablist"
        aria-label="أقسام المنزل"
      >
        {tabs.map((t) => {
          const active = tab === t.key;
          const Icon = t.icon;
          return (
            <button
              key={t.key}
              type="button"
              role="tab"
              aria-selected={active}
              aria-label={`${t.label} — ${formatNumber(t.count)}`}
              onClick={() => setTab(t.key)}
              className={cn(
                "flex h-11 shrink-0 items-center gap-1.5 rounded-2xl border px-3.5 text-[12px] font-bold transition-colors",
                active
                  ? "border-primary/50 bg-primary/20 text-primary"
                  : "glass-soft border-black/[0.07] text-foreground/75 hover:bg-black/[0.04]"
              )}
            >
              <Icon className="h-4 w-4" aria-hidden="true" />
              {t.label}
              <span className={cn("tabular text-[10.5px]", active ? "text-primary" : "text-muted-foreground")}>
                {formatNumber(t.count)}
              </span>
            </button>
          );
        })}
      </motion.div>

      {/* ═══ محتوى القسم النشط ═══ */}
      <AnimatePresence mode="wait">
        <motion.div
          key={tab}
          initial={{ opacity: 0, y: 10 }}
          animate={{ opacity: 1, y: 0 }}
          exit={{ opacity: 0, y: -6 }}
          transition={{ duration: 0.22, ease: "easeOut" }}
        >
          {tab === "grocery" && <GrocerySection items={groceries} openQuickAdd={openQuickAdd} />}
          {tab === "bills" && (
            <BillsSection bills={homeBills} accounts={accounts} currency={settings.currency || "ر.س"} onAdd={() => setBillFormOpen(true)} />
          )}
          {tab === "tasks" && <HomeTasksSection tasks={homeTasks} />}
          {tab === "items" && (
            <ItemsSection items={sortedItems} today={today} onOpen={(h) => setDetailsItemId(h.id)} onAdd={() => { setItemEditing(null); setItemFormOpen(true); }} />
          )}
        </motion.div>
      </AnimatePresence>

      {/* ═══ الحوارات ═══ */}
      {billFormOpen && (
        <HomeBillFormDialog
          accounts={accounts}
          currency={settings.currency || "ر.س"}
          digits={settings.digits ?? "latn"}
          onClose={() => setBillFormOpen(false)}
        />
      )}

      {itemFormOpen && (
        <HomeItemFormDialog
          item={itemEditing}
          onClose={() => setItemFormOpen(false)}
        />
      )}

      {detailsItem && (
        <HomeItemDetailsDialog
          item={detailsItem}
          onClose={() => setDetailsItemId(null)}
          onEdit={(h) => {
            setDetailsItemId(null);
            setItemEditing(h);
            setItemFormOpen(true);
          }}
        />
      )}
    </div>
  );
}

/* ═══════════════════════ قسم البقالة ═══════════════════════ */

function GrocerySection({ items, openQuickAdd }: { items: ListItem[]; openQuickAdd: (tab: "expense") => void }) {
  const [text, setText] = useState("");
  const [qty, setQty] = useState("");

  const sorted = [...items].sort((a, b) =>
    a.done === b.done ? b.createdAt.localeCompare(a.createdAt) : a.done ? 1 : -1,
  );
  const doneCount = items.filter((i) => i.done).length;

  const add = async () => {
    const t = text.trim();
    if (!t) return;
    await addListItem("grocery", t, { qty: qty.trim() || undefined });
    setText("");
    setQty("");
  };

  return (
    <div className="space-y-3">
      {/* إضافة سريعة */}
      <div className="flex items-center gap-2">
        <input
          id="grocery-input"
          value={text}
          onChange={(e) => setText(e.target.value)}
          onKeyDown={(e) => {
            if (e.key === "Enter") void add();
          }}
          placeholder="بند البقالة…"
          className="h-11 flex-1 min-w-0 rounded-xl glass-soft border border-black/[0.07] px-4 text-[13.5px] text-foreground placeholder:text-muted-foreground/50 focus:border-primary/40 focus:outline-none transition-colors"
          aria-label="بند بقالة جديد"
        />
        <input
          value={qty}
          onChange={(e) => setQty(e.target.value)}
          onKeyDown={(e) => {
            if (e.key === "Enter") void add();
          }}
          placeholder="كمية"
          inputMode="text"
          className="h-11 w-[74px] shrink-0 rounded-xl glass-soft border border-black/[0.07] px-3 text-center text-[12.5px] text-foreground placeholder:text-muted-foreground/50 focus:border-primary/40 focus:outline-none transition-colors"
          aria-label="كمية البند (اختياري)"
        />
        <button
          type="button"
          onClick={() => void add()}
          disabled={!text.trim()}
          aria-label="إضافة بند البقالة"
          className="h-11 w-11 shrink-0 rounded-xl border border-primary/30 bg-primary/15 text-primary flex items-center justify-center transition-colors hover:bg-primary/25 disabled:opacity-40"
        >
          <Plus className="h-4 w-4" aria-hidden="true" />
        </button>
      </div>

      {items.length === 0 ? (
        <p className="rounded-2xl glass-soft px-4 py-3 text-[11.5px] leading-relaxed text-muted-foreground">
          القائمة فارغة — أضف ما ينقصك فوق بالكمية، وعلّم كل بند عند التقاطه، وعند الشراء سجّل مصروف البقالة بضغطة.
        </p>
      ) : (
        <>
          {/* عدّاد الجاهزية */}
          <div className="flex items-center justify-between px-1">
            <p className="text-[11.5px] text-muted-foreground tabular">
              جاهز <span className="font-bold text-foreground">{formatNumber(doneCount)}</span> من{" "}
              <span className="font-bold">{formatNumber(items.length)}</span>
            </p>
            {doneCount > 0 && (
              <button
                type="button"
                onClick={() => void clearDoneItems("grocery")}
                className="flex h-11 items-center gap-1.5 rounded-xl glass-soft border border-black/[0.07] px-3 text-[11px] font-medium text-muted-foreground transition-colors hover:bg-black/[0.04] hover:text-foreground"
              >
                <Eraser className="h-3.5 w-3.5" aria-hidden="true" />
                مسح المنجز
              </button>
            )}
          </div>

          {/* البنود */}
          <ul className="space-y-1.5">
            {sorted.map((item) => (
              <li key={item.id}>
                <div className="flex items-center gap-2 rounded-2xl glass-soft px-3 py-2.5">
                  <button
                    type="button"
                    onClick={() => void toggleListItem(item.id)}
                    aria-pressed={item.done}
                    aria-label={`${item.done ? "إرجاع" : "شراء"} ${item.text}`}
                    className="flex min-h-[44px] flex-1 items-center gap-3 text-start"
                  >
                    <motion.span
                      animate={{ scale: item.done ? [1, 1.25, 1] : 1 }}
                      transition={{ duration: 0.3 }}
                      className={cn(
                        "flex h-6 w-6 shrink-0 items-center justify-center rounded-full border transition-colors",
                        item.done ? "border-mint bg-mint/20 text-mint" : "border-white/25 text-transparent"
                      )}
                    >
                      <Check className="h-3.5 w-3.5" strokeWidth={3} aria-hidden="true" />
                    </motion.span>
                    <span
                      className={cn(
                        "text-[13px] leading-relaxed",
                        item.done ? "text-muted-foreground line-through" : "text-foreground/90"
                      )}
                    >
                      {item.text}
                    </span>
                    {item.qty && <Chip className="shrink-0 text-muted-foreground tabular">×{item.qty}</Chip>}
                  </button>
                  <button
                    type="button"
                    onClick={() => void deleteListItem(item.id)}
                    aria-label={`حذف بند ${item.text}`}
                    className="flex h-11 w-11 shrink-0 items-center justify-center rounded-xl text-muted-foreground/70 transition-colors hover:bg-coral/10 hover:text-coral"
                  >
                    <Trash2 className="h-4 w-4" aria-hidden="true" />
                  </button>
                </div>
              </li>
            ))}
          </ul>

          {/* تسجيل مصروف البقالة */}
          {doneCount > 0 && (
            <button
              type="button"
              onClick={() => openQuickAdd("expense")}
              className="flex h-12 w-full items-center justify-center gap-2 rounded-2xl bg-primary text-[13px] font-bold text-primary-foreground glow-gold transition-all hover:bg-primary/90 active:scale-[0.98]"
            >
              <ShoppingBasket className="h-5 w-5" aria-hidden="true" />
              تم الشراء — سجّل مصروف البقالة
            </button>
          )}
        </>
      )}
    </div>
  );
}

/* ═══════════════════════ قسم الفواتير المنزلية ═══════════════════════ */

function BillsSection({
  bills,
  accounts,
  currency,
  onAdd,
}: {
  bills: Recurring[];
  accounts: Account[];
  currency: string;
  onAdd: () => void;
}) {
  const [payingId, setPayingId] = useState<string | null>(null);
  const today = todayISO();
  const activeAccounts = accounts.filter((a) => !a.archived);

  const handlePay = (r: Recurring) => {
    if (r.accountId) {
      void payRecurring(r.id);
      return;
    }
    setPayingId(payingId === r.id ? null : r.id);
  };

  if (bills.length === 0) {
    return (
      <div className="space-y-2.5">
        <p className="px-1 text-[11.5px] text-muted-foreground">
          لا فواتير منزلية مسجلة — إيجارك وكهرباءك وإنترنتك كلها تُدار من هنا.
        </p>
        <SectionAddButton icon={Receipt} label="أضف فاتورة منزلية" onClick={onAdd} />
      </div>
    );
  }

  return (
    <div className="space-y-2">
      {bills.map((r) => {
        const badge = dueBadge(r.nextDate, today);
        return (
          <GlassCard key={r.id} className={cn("p-4", !r.active && "opacity-55")}>
            <div className="flex items-center gap-3">
              <span className="flex h-11 w-11 shrink-0 items-center justify-center rounded-full bg-primary/15 text-primary" aria-hidden="true">
                <Home className="h-5 w-5" />
              </span>
              <div className="min-w-0 flex-1">
                <div className="flex items-center gap-2">
                  <span className="text-[13.5px] font-semibold truncate">{r.name}</span>
                  {r.active && (
                    <span className={cn("shrink-0 rounded-full px-2 py-0.5 text-[9.5px] font-bold", badge.cls)}>
                      {badge.text}
                    </span>
                  )}
                </div>
                <span className="mt-0.5 block text-[10.5px] text-muted-foreground">
                  {FREQ_LABELS[r.frequency]} · منزلية
                  {!r.active && " · موقوفة"}
                </span>
              </div>
              <PrivateAmount className="text-[14.5px] font-bold tabular shrink-0 text-foreground/90">
                {formatMoney(r.amount, currency)}
              </PrivateAmount>
            </div>

            {r.active && (
              <div className="mt-3">
                <button
                  type="button"
                  onClick={() => handlePay(r)}
                  className="flex h-11 w-full items-center justify-center rounded-xl border border-primary/30 bg-primary/15 text-[12px] font-bold text-primary transition-colors hover:bg-primary/25"
                >
                  سُدد — سجّل معاملة وقدّم الاستحقاق
                </button>
              </div>
            )}

            {payingId === r.id && (
              <div className="mt-2.5 flex items-center gap-2 overflow-x-auto no-scrollbar" role="group" aria-label="اختر حساب السداد">
                {activeAccounts.length === 0 ? (
                  <span className="text-[10.5px] text-muted-foreground">
                    لا حسابات بعد — أضف حساباً من شاشة المال أو حدده عند تعديل الفاتورة
                  </span>
                ) : (
                  <>
                    <span className="shrink-0 text-[10.5px] text-muted-foreground">من حساب:</span>
                    {activeAccounts.map((a) => {
                      const AccIcon = iconByName((a.icon || "wallet").toLowerCase());
                      return (
                        <button
                          key={a.id}
                          type="button"
                          onClick={() => {
                            setPayingId(null);
                            void payRecurring(r.id, { accountId: a.id });
                          }}
                          className="flex h-11 shrink-0 items-center gap-1.5 rounded-xl border px-3 text-[12px] font-bold transition-transform active:scale-95"
                          style={{ borderColor: `${a.color}55`, background: `${a.color}1a`, color: a.color }}
                        >
                          <AccIcon className="h-4 w-4 shrink-0" aria-hidden="true" />
                          <span className="max-w-[110px] truncate">{a.name}</span>
                        </button>
                      );
                    })}
                  </>
                )}
              </div>
            )}
          </GlassCard>
        );
      })}

      <SectionAddButton icon={Receipt} label="فاتورة منزلية جديدة" onClick={onAdd} />
    </div>
  );
}

/* ═══════════════════════ قسم مهام المنزل ═══════════════════════ */

function HomeTasksSection({ tasks }: { tasks: Task[] }) {
  const [title, setTitle] = useState("");
  const [busy, setBusy] = useState(false);
  const today = todayISO();

  const add = async () => {
    const t = title.trim();
    if (!t || busy) return;
    setBusy(true);
    try {
      await addTask({
        title: t,
        date: today,
        priority: "normal",
        done: false,
        tags: "منزل",
      });
      setTitle("");
    } finally {
      setBusy(false);
    }
  };

  return (
    <div className="space-y-3">
      <div className="flex items-center gap-2">
        <input
          value={title}
          onChange={(e) => setTitle(e.target.value)}
          onKeyDown={(e) => {
            if (e.key === "Enter") void add();
          }}
          placeholder="مهمة منزلية… ترتيب، إصلاح، شراء"
          className="h-11 flex-1 min-w-0 rounded-xl glass-soft border border-black/[0.07] px-4 text-[13.5px] text-foreground placeholder:text-muted-foreground/50 focus:border-primary/40 focus:outline-none transition-colors"
          aria-label="مهمة منزلية جديدة"
        />
        <button
          type="button"
          onClick={() => void add()}
          disabled={busy || !title.trim()}
          aria-label="إضافة مهمة منزلية"
          className="h-11 w-11 shrink-0 rounded-xl border border-primary/30 bg-primary/15 text-primary flex items-center justify-center transition-colors hover:bg-primary/25 disabled:opacity-40"
        >
          <Plus className="h-4 w-4" aria-hidden="true" />
        </button>
      </div>

      {tasks.length === 0 ? (
        <p className="rounded-2xl glass-soft px-4 py-3 text-[11.5px] text-muted-foreground">
          لا مهام منزلية — أضف واحدة فوق وستظهر هنا وفي شاشة المهام مع وسم «منزل».
        </p>
      ) : (
        <ul className="space-y-1.5">
          {tasks.map((task) => (
            <li key={task.id}>
              <HomeTaskRow task={task} />
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}

function HomeTaskRow({ task }: { task: Task }) {
  const [done, setDone] = useState(task.done);
  const [busy, setBusy] = useState(false);
  const toggle = async () => {
    if (busy) return;
    setBusy(true);
    const next = !done;
    setDone(next);
    try {
      await toggleTask(task.id);
    } catch {
      setDone(!next);
    } finally {
      setBusy(false);
    }
  };

  return (
    <button
      type="button"
      onClick={() => void toggle()}
      aria-pressed={done}
      aria-label={`${done ? "إرجاع" : "إنجاز"} مهمة ${task.title}`}
      className="flex w-full items-center gap-3 rounded-2xl glass-soft px-3 py-2.5 text-start transition-colors hover:bg-black/[0.03] min-h-[44px]"
    >
      <span
        className={cn(
          "flex h-6 w-6 shrink-0 items-center justify-center rounded-full border transition-colors",
          done ? "border-cyan bg-cyan/20 text-cyan" : "border-white/25 text-transparent"
        )}
      >
        <Check className="h-3.5 w-3.5" strokeWidth={3} aria-hidden="true" />
      </span>
      <span
        className={cn(
          "text-[13px] leading-relaxed",
          done ? "text-muted-foreground line-through" : "text-foreground/90"
        )}
      >
        {task.title}
      </span>
    </button>
  );
}

/* ═══════════════════════ قسم الممتلكات والصيانة ═══════════════════════ */

const KIND_ICONS: Record<string, string> = {
  جهاز: "zap",
  أثاث: "home",
  مركبة: "car-front",
  "عقد صيانة": "receipt",
};

function ItemsSection({
  items,
  today,
  onOpen,
  onAdd,
}: {
  items: HomeItem[];
  today: string;
  onOpen: (h: HomeItem) => void;
  onAdd: () => void;
}) {
  if (items.length === 0) {
    return (
      <div className="space-y-2.5">
        <p className="px-1 text-[11.5px] text-muted-foreground">
          لا ممتلكات مسجلة — سجّل أجهزتك وأثاثك ومركبتك لتتبع ضمانها وصيانتها.
        </p>
        <SectionAddButton icon={Sofa} label="أضف ممتلكاً" onClick={onAdd} />
      </div>
    );
  }

  return (
    <div className="space-y-2">
      {items.map((h) => {
        const service = serviceState(h, today);
        const warranty = warrantyLabel(h, today);
        const Icon = iconByName(KIND_ICONS[h.kind] ?? "package");
        const urgent = service.level === "over" || service.level === "soon";
        return (
          <GlassCard key={h.id} interactive onClick={() => onOpen(h)} className="p-4">
            <div className="flex items-center gap-3">
              <span
                className={cn(
                  "flex h-11 w-11 shrink-0 items-center justify-center rounded-full",
                  urgent ? "bg-coral/15 text-coral" : "bg-black/[0.04] text-foreground/70"
                )}
                aria-hidden="true"
              >
                <Icon className="h-5 w-5" />
              </span>
              <div className="min-w-0 flex-1">
                <div className="flex items-center gap-2">
                  <span className="text-[13.5px] font-semibold truncate">{h.name}</span>
                  <Chip className="shrink-0 text-muted-foreground">{h.kind}</Chip>
                </div>
                <ServiceLine item={h} today={today} />
              </div>
              {warranty && !warranty.expired && <Chip className="shrink-0 text-mint">ضمان</Chip>}
            </div>
          </GlassCard>
        );
      })}
      <SectionAddButton icon={Sofa} label="ممتلك جديد" onClick={onAdd} />
    </div>
  );
}

function ServiceLine({ item, today }: { item: HomeItem; today: string }) {
  const s = serviceState(item, today);
  if (s.level === "none") {
    return <span className="mt-0.5 block text-[11px] text-muted-foreground">بلا صيانة مجدولة</span>;
  }
  if (s.level === "over") {
    return (
      <span className="mt-0.5 flex items-center gap-1 text-[11px] font-bold text-coral tabular">
        <Wrench className="h-3 w-3" aria-hidden="true" />
        الصيانة متأخرة {formatNumber(Math.abs(s.days ?? 0))} يوماً
      </span>
    );
  }
  if (s.level === "soon") {
    return (
      <span className="mt-0.5 flex items-center gap-1 text-[11px] font-semibold text-coral/90 tabular">
        <Wrench className="h-3 w-3" aria-hidden="true" />
        صيانة بعد {formatNumber(s.days ?? 0)} يوماً
      </span>
    );
  }
  return (
    <span className="mt-0.5 block text-[11px] text-muted-foreground tabular">
      الصيانة: {dueFarLabel(item.nextService ?? "", today)}
    </span>
  );
}

function dueFarLabel(nextDate: string, today: string): string {
  const d = Math.round(
    (new Date(nextDate + "T12:00:00").getTime() - new Date(today + "T12:00:00").getTime()) / 86400000,
  );
  if (d <= 7) return `بعد ${formatNumber(d)} أيام`;
  return `بعد ${formatNumber(Math.round(d / 30))} شهر تقريباً`;
}

/* ═══════════════════════ زر إضافة قسم ═══════════════════════ */

function SectionAddButton({
  icon: Icon,
  label,
  onClick,
}: {
  icon: typeof Home;
  label: string;
  onClick: () => void;
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      className="flex h-12 w-full items-center justify-center gap-2 rounded-2xl border border-dashed border-primary/35 bg-primary/[0.07] text-[12.5px] font-bold text-primary transition-colors hover:bg-primary/15"
    >
      <Icon className="h-4 w-4" aria-hidden="true" />
      {label}
    </button>
  );
}
