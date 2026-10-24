"use client";

/**
 * Systemy v2 — قسم «المعاملات» (إدارة كاملة عالية القوة)
 * بحث + فلاتر (نوع/حساب/فئة/نطاق تاريخ) + ترتيب + تجميع بالأيام +
 * تحرير كامل (نوع/مبلغ بلوحة/تاجر/شخص/حسابات/فئة/تاريخ ووقت/وسوم/ملاحظات)
 * + حذف بتأكيد + ترقيم صفحات.
 */

import { useMemo, useState } from "react";
import {
  ArrowDownLeft,
  ArrowLeftRight,
  FileDown,
  Plus,
  Receipt,
  Search,
  SearchX,
  Trash2,
  X,
} from "lucide-react";
import { toast } from "sonner";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { useUIStore } from "@/store/ui-store";
import { addDaysISO, dayNameShort, diffDays, formatDate, formatMoney, formatNumber, formatTime, todayISO } from "@/lib/format";
import { monthWindow } from "@/lib/money";
import { deleteTransaction, replaceTransaction } from "@/lib/actions";
import { downloadTransactionsCSV } from "@/lib/report";
import { Chip, GlassCard, PrivateAmount } from "@/components/systemy/glass";
import {
  ChipRow,
  ConfirmBar,
  EmptyState,
  Field,
  FormShell,
  NumberPad,
  displayAmount,
  inputCls,
  textareaCls,
} from "@/components/systemy/ui-bits";
import { IconBubble, SheetShell, type MoneyData } from "./money-screen";
import type { Account, Transaction, TxType } from "@/lib/types";
import { cn } from "@/lib/utils";

/* ═══════════════════════ خرائط وثوابت ═══════════════════════ */

type TypeFilter = "all" | TxType;
type RangeFilter = "month" | "30d" | "all";
type SortMode = "recent" | "amount";

const TYPE_CHIPS: Array<{ k: TypeFilter; v: string; dot: string }> = [
  { k: "all", v: "الكل", dot: "#8A93A8" },
  { k: "expense", v: "مصروف", dot: "#FF8E7A" },
  { k: "income", v: "دخل", dot: "#6EE7A8" },
  { k: "transfer", v: "تحويل", dot: "#5CE1E6" },
];

const RANGE_CHIPS: Array<{ k: RangeFilter; v: string }> = [
  { k: "month", v: "هذا الشهر" },
  { k: "30d", v: "آخر 30 يوماً" },
  { k: "all", v: "الكل" },
];

const TYPE_OPTIONS: Array<{ k: string; v: string }> = [
  { k: "expense", v: "مصروف" },
  { k: "income", v: "دخل" },
  { k: "transfer", v: "تحويل" },
];

const PAGE = 25;

/** عنوان مجموعة اليوم: اليوم / أمس / تاريخ */
function dayHeaderLabel(iso: string, today: string): string {
  const n = diffDays(today, iso);
  if (n === 0) return "اليوم";
  if (n === -1) return "أمس";
  return `${dayNameShort(iso)} · ${formatDate(iso)}`;
}

/* ═══════════════════════ القسم ═══════════════════════ */

export function TxSection({ data }: { data: MoneyData }) {
  const openQuickAdd = useUIStore((s) => s.openQuickAdd);
  const { settings, accounts, categories, txs } = data;
  const cur = settings.currency || "ر.س";
  const today = todayISO();

  const [query, setQuery] = useState("");
  const [typeFilter, setTypeFilter] = useState<TypeFilter>("all");
  const [accountFilter, setAccountFilter] = useState("all");
  const [categoryFilter, setCategoryFilter] = useState("all");
  const [range, setRange] = useState<RangeFilter>("month");
  const [sort, setSort] = useState<SortMode>("recent");
  const [limit, setLimit] = useState(PAGE);
  const [editing, setEditing] = useState<Transaction | null>(null);

  const w = useMemo(() => monthWindow(settings), [settings]);
  const activeAccounts = useMemo(() => accounts.filter((a) => !a.archived), [accounts]);
  const liveCategories = useMemo(() => categories.filter((c) => !c.archived), [categories]);
  const catById = useMemo(() => new Map(categories.map((c) => [c.id, c])), [categories]);
  const accById = useMemo(() => new Map(accounts.map((a) => [a.id, a])), [accounts]);
  const from30 = useMemo(() => addDaysISO(today, -30), [today]);

  /** إعادة الترقيم عند تغيير أي فلتر (نمط مواءمة الحالة أثناء الرسم) */
  const filterSig = `${query}|${typeFilter}|${accountFilter}|${categoryFilter}|${range}|${sort}`;
  const [lastSig, setLastSig] = useState(filterSig);
  if (filterSig !== lastSig) {
    setLastSig(filterSig);
    setLimit(PAGE);
  }

  const q = query.trim().toLowerCase();

  const filtered = useMemo(() => {
    const list = txs.filter((t) => {
      if (typeFilter !== "all" && t.type !== typeFilter) return false;
      if (accountFilter !== "all" && t.accountId !== accountFilter && t.toAccountId !== accountFilter) return false;
      if (categoryFilter !== "all" && t.categoryId !== categoryFilter) return false;
      const d = t.date.slice(0, 10);
      if (range === "month" && (d < w.start || d > w.end)) return false;
      if (range === "30d" && d < from30) return false;
      if (q) {
        const hay = `${t.description} ${t.merchant ?? ""} ${t.tags} ${t.person ?? ""}`.toLowerCase();
        if (!hay.includes(q)) return false;
      }
      return true;
    });
    if (sort === "amount") return [...list].sort((a, b) => b.amount - a.amount);
    return [...list].sort((a, b) => b.date.localeCompare(a.date) || (b.createdAt ?? "").localeCompare(a.createdAt ?? ""));
  }, [txs, typeFilter, accountFilter, categoryFilter, range, sort, q, w, from30]);

  /** تجميع بالأيام (للترتيب الزمني) */
  const shown = useMemo(() => filtered.slice(0, limit), [filtered, limit]);
  const groups = useMemo(() => {
    const out: Array<{ date: string; label: string; items: Transaction[]; spent: number }> = [];
    for (const t of shown) {
      const d = t.date.slice(0, 10);
      const last = out[out.length - 1];
      if (last && last.date === d) {
        last.items.push(t);
        if (t.type === "expense") last.spent += t.amount;
      } else {
        out.push({ date: d, label: dayHeaderLabel(d, today), items: [t], spent: t.type === "expense" ? t.amount : 0 });
      }
    }
    return out;
  }, [shown, today]);

  const hasFilters =
    q !== "" || typeFilter !== "all" || accountFilter !== "all" || categoryFilter !== "all" || range !== "all";

  const resetFilters = () => {
    setQuery("");
    setTypeFilter("all");
    setAccountFilter("all");
    setCategoryFilter("all");
    setRange("all");
    setSort("recent");
  };

  return (
    <div>
      {/* ═══ رأس القسم ═══ */}
      <div className="flex items-center justify-between px-1 mb-2.5">
        <div className="flex items-center gap-2 text-[13px] font-semibold text-foreground/90">
          <Receipt className="w-4 h-4 text-primary" aria-hidden="true" />
          <span>المعاملات</span>
          <Chip className="text-muted-foreground tabular">{formatNumber(filtered.length)}</Chip>
        </div>
        <div className="flex items-center gap-2">
          <button
            onClick={() => void downloadTransactionsCSV()}
            aria-label="تصدير المعاملات كملف CSV"
            title="تصدير CSV — يفتح في Excel"
            className="h-11 px-3 rounded-2xl glass-soft border border-white/[0.08] text-muted-foreground hover:text-primary hover:border-primary/30 text-[12px] font-medium flex items-center gap-1.5 hover:bg-primary/10 transition-colors"
          >
            <FileDown className="w-4 h-4" aria-hidden="true" />
            <span className="hidden sm:inline">CSV</span>
          </button>
          <button
            onClick={() => openQuickAdd("expense")}
            aria-label="إضافة معاملة جديدة"
            className="h-11 px-4 rounded-2xl bg-primary/15 border border-primary/30 text-primary text-[12px] font-bold flex items-center gap-1.5 hover:bg-primary/25 transition-colors"
          >
            <Plus className="w-4 h-4" aria-hidden="true" />
            إضافة
          </button>
        </div>
      </div>

      {/* ═══ البحث والفلاتر ═══ */}
      <GlassCard className="p-3.5 mb-3">
        <div className="relative">
          <Search
            className="absolute start-3.5 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground pointer-events-none"
            aria-hidden="true"
          />
          <input
            type="search"
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            placeholder="ابحث في الوصف أو التاجر أو الوسوم أو الشخص…"
            aria-label="بحث في المعاملات"
            className={cn(inputCls, "h-11 ps-10", query && "pe-10")}
          />
          {query && (
            <button
              onClick={() => setQuery("")}
              aria-label="مسح البحث"
              className="absolute end-2 top-1/2 -translate-y-1/2 w-8 h-8 rounded-full flex items-center justify-center text-muted-foreground hover:text-foreground transition-colors"
            >
              <X className="w-4 h-4" aria-hidden="true" />
            </button>
          )}
        </div>

        {/* النوع */}
        <div className="flex gap-2 mt-3 overflow-x-auto no-scrollbar" role="group" aria-label="نوع المعاملة">
          {TYPE_CHIPS.map((c) => (
            <button
              key={c.k}
              onClick={() => setTypeFilter(c.k)}
              aria-pressed={typeFilter === c.k}
              className={cn(
                "h-11 px-3.5 rounded-full border text-[12px] font-semibold flex items-center gap-1.5 shrink-0 transition-all",
                typeFilter === c.k
                  ? "bg-primary/20 border-primary/50 text-primary"
                  : "glass-soft border-white/[0.06] text-foreground/70 hover:text-foreground"
              )}
            >
              <span className="w-2 h-2 rounded-full" style={{ background: c.dot }} aria-hidden="true" />
              {c.v}
            </button>
          ))}
        </div>

        {/* الحساب: رقائق إن قلّت وإلا قائمة */}
        {activeAccounts.length > 0 && (
          <div className="mt-3">
            {activeAccounts.length <= 5 ? (
              <div className="flex gap-2 overflow-x-auto no-scrollbar" role="group" aria-label="فلترة حسب الحساب">
                <FilterChip label="كل الحسابات" active={accountFilter === "all"} onClick={() => setAccountFilter("all")} />
                {activeAccounts.map((a) => (
                  <FilterChip
                    key={a.id}
                    label={a.name}
                    color={a.color}
                    active={accountFilter === a.id}
                    onClick={() => setAccountFilter(accountFilter === a.id ? "all" : a.id)}
                  />
                ))}
              </div>
            ) : (
              <Select value={accountFilter} onValueChange={setAccountFilter}>
                <SelectTrigger className="h-11 rounded-xl glass-soft border-white/[0.08] text-[13px]" aria-label="فلترة حسب الحساب">
                  <SelectValue placeholder="كل الحسابات" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="all">كل الحسابات</SelectItem>
                  {activeAccounts.map((a) => (
                    <SelectItem key={a.id} value={a.id}>{a.name}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
            )}
          </div>
        )}

        {/* الفئة + الترتيب */}
        <div className="flex gap-2 mt-3 items-center">
          <div className="flex-1 min-w-0">
            <Select value={categoryFilter} onValueChange={setCategoryFilter}>
              <SelectTrigger className="h-11 rounded-xl glass-soft border-white/[0.08] text-[13px] w-full" aria-label="فلترة حسب الفئة">
                <SelectValue placeholder="كل الفئات" />
              </SelectTrigger>
              <SelectContent className="max-h-64">
                <SelectItem value="all">كل الفئات</SelectItem>
                {liveCategories.map((c) => (
                  <SelectItem key={c.id} value={c.id}>
                    <span className="flex items-center gap-2">
                      <span className="w-2 h-2 rounded-full" style={{ background: c.color }} aria-hidden="true" />
                      {c.name}
                    </span>
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
        </div>

        {/* النطاق الزمني + الترتيب */}
        <div className="flex gap-2 mt-3 overflow-x-auto no-scrollbar" role="group" aria-label="النطاق الزمني">
          {RANGE_CHIPS.map((c) => (
            <button
              key={c.k}
              onClick={() => setRange(c.k)}
              aria-pressed={range === c.k}
              className={cn(
                "h-11 px-3.5 rounded-full border text-[11.5px] font-semibold shrink-0 transition-all",
                range === c.k
                  ? "bg-cyan/15 border-cyan/40 text-cyan"
                  : "glass-soft border-white/[0.06] text-foreground/70 hover:text-foreground"
              )}
            >
              {c.v}
            </button>
          ))}
        </div>
        <div className="flex gap-2 mt-2" role="group" aria-label="الترتيب">
          <button
            onClick={() => setSort("recent")}
            aria-pressed={sort === "recent"}
            className={cn(
              "h-11 px-3.5 rounded-full border text-[11.5px] font-semibold transition-all",
              sort === "recent"
                ? "bg-primary/20 border-primary/50 text-primary"
                : "glass-soft border-white/[0.06] text-foreground/70 hover:text-foreground"
            )}
          >
            الأحدث
          </button>
          <button
            onClick={() => setSort("amount")}
            aria-pressed={sort === "amount"}
            className={cn(
              "h-11 px-3.5 rounded-full border text-[11.5px] font-semibold transition-all",
              sort === "amount"
                ? "bg-primary/20 border-primary/50 text-primary"
                : "glass-soft border-white/[0.06] text-foreground/70 hover:text-foreground"
            )}
          >
            الأكبر مبلغاً
          </button>
        </div>
      </GlassCard>

      {/* ═══ القائمة ═══ */}
      {txs.length === 0 ? (
        <GlassCard className="p-2">
          <EmptyState
            icon={<Receipt className="w-6 h-6" />}
            title="لا معاملات بعد"
            hint="سجّل أول مصروف — التاريخ والأرصدة والأظرف كلها تتحدث فوراً"
            actionLabel="أضف مصروف"
            onAction={() => openQuickAdd("expense")}
          />
        </GlassCard>
      ) : shown.length === 0 ? (
        <GlassCard className="p-2">
          <EmptyState
            icon={<SearchX className="w-6 h-6" />}
            title="لا نتائج مطابقة"
            hint="جرّب كلمة أخرى أو وسّع النطاق الزمني"
            actionLabel="مسح الفلاتر"
            onAction={resetFilters}
          />
        </GlassCard>
      ) : (
        <div className="space-y-3">
          {sort === "recent"
            ? groups.map((g) => (
                <GlassCard key={g.date} className="overflow-visible">
                  <div className="sticky top-[66px] z-10 px-4 py-2 flex items-center justify-between rounded-t-3xl bg-[#0E1220]/95 backdrop-blur-md border-b border-white/[0.05]">
                    <p className="text-[11.5px] font-bold text-muted-foreground">{g.label}</p>
                    {g.spent > 0 && (
                      <span className="text-[10.5px] text-muted-foreground tabular">صرف {formatMoney(g.spent, cur)}</span>
                    )}
                  </div>
                  <div className="divide-y divide-white/[0.04]">
                    {g.items.map((t) => (
                      <TxRow
                        key={t.id}
                        t={t}
                        cur={cur}
                        cat={t.categoryId ? catById.get(t.categoryId) : undefined}
                        acc={accById.get(t.accountId)}
                        onEdit={() => setEditing(t)}
                      />
                    ))}
                  </div>
                </GlassCard>
              ))
            : (
              <GlassCard className="divide-y divide-white/[0.04] overflow-hidden">
                {shown.map((t) => (
                  <TxRow
                    key={t.id}
                    t={t}
                    cur={cur}
                    cat={t.categoryId ? catById.get(t.categoryId) : undefined}
                    acc={accById.get(t.accountId)}
                    onEdit={() => setEditing(t)}
                  />
                ))}
              </GlassCard>
            )}

          {filtered.length > limit && (
            <button
              onClick={() => setLimit((l) => l + PAGE)}
              className="w-full h-12 rounded-2xl glass text-[12px] font-semibold text-primary flex items-center justify-center gap-2 hover:bg-primary/10 transition-colors"
            >
              عرض المزيد
              <Chip className="text-muted-foreground tabular">{formatNumber(filtered.length - limit)} متبقية</Chip>
            </button>
          )}

          {hasFilters && (
            <button
              onClick={resetFilters}
              className="w-full h-12 rounded-2xl glass-soft border border-white/[0.06] text-[11.5px] font-medium text-muted-foreground hover:text-foreground transition-colors"
            >
              مسح كل الفلاتر ({formatNumber(filtered.length)} نتيجة)
            </button>
          )}
        </div>
      )}

      {/* ═══ ورقة التحرير ═══ */}
      {editing && <TxEditSheet tx={editing} data={data} onClose={() => setEditing(null)} />}
    </div>
  );
}

/* ═══════════════════════ صف المعاملة ═══════════════════════ */

function TxRow({
  t,
  cur,
  cat,
  acc,
  onEdit,
}: {
  t: Transaction;
  cur: string;
  cat?: { name: string; icon: string; color: string };
  acc?: Account;
  onEdit: () => void;
}) {
  const tags = t.tags.split(",").map((s) => s.trim()).filter(Boolean);
  return (
    <button
      onClick={onEdit}
      aria-label={`تعديل المعاملة: ${t.description}`}
      className="w-full flex items-center gap-3 px-4 py-2.5 min-h-[60px] text-right hover:bg-white/[0.03] transition-colors"
    >
      <IconBubble
        icon={cat?.icon ?? "shapes"}
        color={cat?.color ?? "#8EC5FF"}
        className="w-10 h-10"
        iconClassName="w-[18px] h-[18px]"
      />
      <span className="flex-1 min-w-0">
        <span className="block text-[13px] font-medium truncate">{t.description}</span>
        <span className="block text-[10.5px] text-muted-foreground truncate mt-0.5">
          {cat?.name ?? (t.type === "transfer" ? "تحويل" : "غير مصنّفة")}
          {t.merchant ? ` · ${t.merchant}` : ""}
          {t.person ? ` · ${t.person}` : ""}
          {acc ? ` · ${acc.name}` : ""}
        </span>
        {tags.length > 0 && (
          <span className="flex flex-wrap gap-1 mt-1">
            {tags.slice(0, 2).map((tag) => (
              <span key={tag} className="text-[9.5px] rounded-full px-2 py-0.5 bg-white/[0.05] text-muted-foreground">
                #{tag}
              </span>
            ))}
            {tags.length > 2 && (
              <span className="text-[9.5px] rounded-full px-2 py-0.5 bg-white/[0.05] text-muted-foreground">
                +{formatNumber(tags.length - 2)}
              </span>
            )}
          </span>
        )}
      </span>
      <span className="flex flex-col items-end shrink-0 gap-0.5">
        <span
          className={cn(
            "text-[13.5px] font-bold tabular flex items-center gap-1",
            t.type === "income" && "text-mint",
            t.type === "transfer" && "text-cyan"
          )}
        >
          {t.type === "income" && <ArrowDownLeft className="w-3.5 h-3.5" aria-hidden="true" />}
          {t.type === "transfer" && <ArrowLeftRight className="w-3.5 h-3.5" aria-hidden="true" />}
          <PrivateAmount>{formatMoney(t.type === "expense" ? -t.amount : t.amount, cur)}</PrivateAmount>
        </span>
        <span className="text-[10px] text-muted-foreground tabular">{formatTime(t.date)}</span>
      </span>
    </button>
  );
}

/* ═══════════════════════ رقاقة فلترة ═══════════════════════ */

function FilterChip({
  label,
  color,
  active,
  onClick,
}: {
  label: string;
  color?: string;
  active: boolean;
  onClick: () => void;
}) {
  return (
    <button
      onClick={onClick}
      aria-pressed={active}
      className={cn(
        "h-11 px-3.5 rounded-full border text-[11.5px] font-semibold flex items-center gap-1.5 shrink-0 transition-all",
        active
          ? "bg-primary/20 border-primary/50 text-primary"
          : "glass-soft border-white/[0.06] text-foreground/70 hover:text-foreground"
      )}
    >
      {color && <span className="w-2 h-2 rounded-full" style={{ background: color }} aria-hidden="true" />}
      {label}
    </button>
  );
}

/* ═══════════════════════ ورقة التحرير الكاملة ═══════════════════════ */

function TxEditSheet({ tx, data, onClose }: { tx: Transaction; data: MoneyData; onClose: () => void }) {
  const { settings, accounts, categories } = data;
  const cur = settings.currency || "ر.س";
  const digits = settings.digits ?? "latn";

  const [type, setType] = useState<TxType>(tx.type);
  const [amount, setAmount] = useState(String(tx.amount));
  const [description, setDescription] = useState(tx.description);
  const [merchant, setMerchant] = useState(tx.merchant ?? "");
  const [person, setPerson] = useState(tx.person ?? "");
  const [accountId, setAccountId] = useState(tx.accountId);
  const [toAccountId, setToAccountId] = useState(tx.toAccountId ?? "");
  const [categoryId, setCategoryId] = useState(tx.categoryId ?? "none");
  const [datePart, setDatePart] = useState(tx.date.slice(0, 10));
  const [timePart, setTimePart] = useState(tx.date.slice(11, 16) || "12:00");
  const [tags, setTags] = useState(tx.tags);
  const [notes, setNotes] = useState(tx.notes ?? "");
  const [busy, setBusy] = useState(false);
  const [confirming, setConfirming] = useState(false);

  const activeAccounts = accounts.filter((a) => !a.archived);
  const kindCats = categories.filter(
    (c) => !c.archived && c.kind === (type === "income" ? "income" : "expense"),
  );

  const save = async () => {
    const value = Number(amount);
    if (!(value > 0)) {
      toast.error("أدخل مبلغاً صحيحاً أكبر من صفر");
      return;
    }
    if (!description.trim()) {
      toast.error("أضف وصفاً قصيراً");
      return;
    }
    if (!accountId) {
      toast.error("اختر الحساب");
      return;
    }
    if (type === "transfer") {
      if (!toAccountId) {
        toast.error("اختر الحساب المستلم");
        return;
      }
      if (toAccountId === accountId) {
        toast.error("اختر حساباً مستقماً مختلفاً");
        return;
      }
    }
    if (!datePart) {
      toast.error("اختر التاريخ");
      return;
    }
    setBusy(true);
    const ok = await replaceTransaction(tx.id, {
      type,
      amount: value,
      description,
      accountId,
      toAccountId: type === "transfer" ? toAccountId : undefined,
      categoryId: type === "transfer" || categoryId === "none" ? undefined : categoryId,
      date: `${datePart}T${timePart || "12:00"}`,
      merchant,
      person,
      tags,
      notes,
    });
    setBusy(false);
    if (ok) onClose();
  };

  const del = async () => {
    setBusy(true);
    await deleteTransaction(tx.id);
    setBusy(false);
    onClose();
  };

  return (
    <SheetShell
      title="تعديل المعاملة"
      desc={`${tx.description} · ${formatMoney(tx.amount, cur)}`}
      onClose={onClose}
    >
      <FormShell
        onSave={() => void save()}
        busy={busy}
        saveLabel="حفظ التعديلات"
        extra={
          confirming ? (
            <ConfirmBar
              message={`حذف «${tx.description}» نهائياً؟ سيُعاد حساب كل الأرصدة والأظرف والرصيد الآمن فوراً.`}
              confirmLabel="حذف نهائي"
              onConfirm={() => void del()}
              onCancel={() => setConfirming(false)}
            />
          ) : (
            <button
              onClick={() => setConfirming(true)}
              className="w-full h-12 rounded-2xl glass-soft border border-[#FF8E7A]/25 text-[#FF8E7A] text-[13px] font-bold flex items-center justify-center gap-2 hover:bg-[#FF8E7A]/10 transition-colors"
            >
              <Trash2 className="w-4 h-4" aria-hidden="true" />
              حذف المعاملة
            </button>
          )
        }
      >
        <ChipRow
          label="النوع"
          options={TYPE_OPTIONS}
          value={type}
          onSelect={(k) => {
            setType(k as TxType);
            setCategoryId("none");
          }}
        />

        <div className="glass-soft rounded-2xl p-4 flex flex-col items-center gap-1">
          <div className="num-display text-[34px] text-primary tabular" aria-live="polite">
            {displayAmount(amount, digits)}
          </div>
          <span className="text-[12px] text-muted-foreground">{cur}</span>
        </div>
        <NumberPad value={amount} onChange={setAmount} digits={digits} label="لوحة تعديل المبلغ" />

        <Field label="الوصف">
          <input
            value={description}
            onChange={(e) => setDescription(e.target.value)}
            placeholder="مثال: قهوة الصباح"
            className={inputCls}
          />
        </Field>

        <div className="grid grid-cols-2 gap-3">
          <Field label="التاجر (اختياري)">
            <input
              value={merchant}
              onChange={(e) => setMerchant(e.target.value)}
              placeholder="ستاربكس…"
              className={inputCls}
            />
          </Field>
          <Field label="الشخص (اختياري)">
            <input
              value={person}
              onChange={(e) => setPerson(e.target.value)}
              placeholder="خالد…"
              className={inputCls}
            />
          </Field>
        </div>

        <Field label="الحساب">
          <AccountChips
            accounts={activeAccounts}
            value={accountId}
            onSelect={setAccountId}
            ariaLabel="اختيار الحساب"
          />
        </Field>

        {type === "transfer" && (
          <Field label="إلى حساب">
            <AccountChips
              accounts={activeAccounts.filter((a) => a.id !== accountId)}
              value={toAccountId}
              onSelect={setToAccountId}
              ariaLabel="اختيار الحساب المستلم"
            />
          </Field>
        )}

        {type !== "transfer" && (
          <Field label="الفئة">
            <Select value={categoryId} onValueChange={setCategoryId}>
              <SelectTrigger className="h-12 rounded-xl w-full" aria-label="اختيار الفئة">
                <SelectValue placeholder="اختر فئة" />
              </SelectTrigger>
              <SelectContent className="max-h-64">
                <SelectItem value="none">بدون فئة</SelectItem>
                {kindCats.map((c) => (
                  <SelectItem key={c.id} value={c.id}>
                    <span className="flex items-center gap-2">
                      <span className="w-2 h-2 rounded-full" style={{ background: c.color }} aria-hidden="true" />
                      {c.name}
                    </span>
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </Field>
        )}

        <div className="grid grid-cols-2 gap-3">
          <Field label="التاريخ">
            <input
              type="date"
              value={datePart}
              onChange={(e) => setDatePart(e.target.value)}
              className={cn(inputCls, "[color-scheme:dark]")}
              aria-label="تاريخ المعاملة"
            />
          </Field>
          <Field label="الوقت">
            <input
              type="time"
              value={timePart}
              onChange={(e) => setTimePart(e.target.value)}
              className={cn(inputCls, "[color-scheme:dark]")}
              aria-label="وقت المعاملة"
            />
          </Field>
        </div>

        <Field label="الوسوم" hint="مفصولة بفواصل — تجمّع بها معاملات متشابهة في البحث">
          <input
            value={tags}
            onChange={(e) => setTags(e.target.value)}
            placeholder="قهوة,عمل"
            className={inputCls}
          />
        </Field>

        <Field label="ملاحظات (اختياري)">
          <textarea
            value={notes}
            onChange={(e) => setNotes(e.target.value)}
            placeholder="أي تفاصيل إضافية…"
            className={textareaCls}
          />
        </Field>
      </FormShell>
    </SheetShell>
  );
}

/* ═══════════════════════ رقائق اختيار حساب ═══════════════════════ */

function AccountChips({
  accounts,
  value,
  onSelect,
  ariaLabel,
}: {
  accounts: Account[];
  value: string;
  onSelect: (id: string) => void;
  ariaLabel: string;
}) {
  if (accounts.length === 0) {
    return <p className="text-[11px] text-muted-foreground py-2">لا حسابات متاحة — أضف حساباً أولاً</p>;
  }
  return (
    <div className="flex gap-2 overflow-x-auto no-scrollbar pb-1" role="radiogroup" aria-label={ariaLabel}>
      {accounts.map((a) => (
        <button
          key={a.id}
          type="button"
          role="radio"
          aria-checked={value === a.id}
          onClick={() => onSelect(a.id)}
          className={cn(
            "h-11 px-3.5 rounded-xl border text-[12px] font-medium flex items-center gap-1.5 shrink-0 transition-all",
            value === a.id
              ? "bg-primary/20 border-primary/50 text-primary"
              : "glass-soft border-white/[0.08] text-foreground/75 hover:text-foreground"
          )}
        >
          <span className="w-2 h-2 rounded-full" style={{ background: a.color }} aria-hidden="true" />
          {a.name}
        </button>
      ))}
    </div>
  );
}
