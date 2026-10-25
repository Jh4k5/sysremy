"use client";

/**
 * لوحة الإضافة السريعة — V4-B: «آلة حاسبة» تسجيل الصرف بثانية واحدة.
 * V5-س «الشريط»: توقيت الحركة على مقياس transitions.dev — فتح اللوحة 400ms
 * بإيز smooth-out مع قياس 0.97→1 وبلور 2→0، إغلاق 350ms أهدأ، الستارة 250/150ms،
 * ودخول الأقسام بـ stagger 40ms (mount-only). النوع النشط بسطح ribbon-soft
 * + مؤشر شريط متدرج (layoutId)، والمبلغ الضخم وزر الحفظ ذهبيان دائماً (المال = ذهبي).
 *
 * إعادة تصميم كاملة وفق طلب المستخدم: «أحتاج أحط المبلغ وفي أيش انصرف
 * وبقية الأشياء تلقائية واختيارية وليست إجبارية»:
 *  - شرائح أفقية (لا شبكة 3×2): صف أول للمسات المالية الأربع (مصروف/دخل/ادخار/التزام)
 *    وصف ثانٍ قابل للتمرير لبقية الأنواع تستبدل لوحة الأرقام بالنموذج الموجود.
 *  - حقل وصف واحد «في أيش انصرف؟» + شاشة عرض المبلغ الضخمة + سطر سياق حي
 *    (متبقي اليوم/الأسبوع من محرك الميزانية الدقيقة).
 *  - لوحة أرقام آلة حاسبة (amount-pad.tsx) بأزرار ضخمة قابلة للمس.
 *  - خيارات إضافية كلها اختيارية وقابلة للطي (حساب/فئة ذكية/تاريخ/خارج المعيشة/وسم/شخص).
 *  - وضع الالتقاط الذكي (العصا) ثانوي: «قهوة 18» → تُفكك للحقول ثم يعود للوضع العادي.
 *  - وضع تعديل معاملة قائمة (quickAddEditTxId) محفوظ كما هو عبر TxForm.
 */
import { useEffect, useMemo, useRef, useState } from "react";
import { AnimatePresence, motion } from "framer-motion";
import {
  Utensils, CircleDollarSign, PiggyBank, Repeat, ListTodo, Flame, CalendarPlus,
  StickyNote, Target, Landmark, Tags, Package, HandCoins, X, Delete, Wand2, Check,
  ChevronDown, Loader2, Sparkles, TriangleAlert,
} from "lucide-react";
import { toast } from "sonner";
import { Drawer, DrawerContent, DrawerDescription, DrawerHeader, DrawerTitle } from "@/components/ui/drawer";
import { useUIStore } from "@/store/ui-store";
import { db, DEFAULT_SETTINGS, useLive } from "@/lib/db";
import { addTransaction, addIncome, addToSavings, ensureDefaultAccount } from "@/lib/actions";
import { guessCategory } from "@/lib/money";
import { parseCapture } from "@/lib/capture-rules";
import type { CaptureParsed } from "@/lib/capture-rules";
import { weeklyStatus } from "@/lib/budget-engine";
import { addDaysISO, formatMoney, nowHHMM, todayISO } from "@/lib/format";
import type { Account, Category, QuickAddTab, Settings, Transaction } from "@/lib/types";
import { cn } from "@/lib/utils";
import { displayAmount, iconByName } from "@/components/systemy/ui-bits";
import { AmountPad, pressAmountKey } from "./amount-pad";
import { TxForm } from "./tx-forms";
import { TaskForm, HabitForm, BlockForm, NoteForm } from "./entity-forms";
import { GoalForm, RecurringForm, AccountForm, CategoryForm, AssetForm, DebtForm } from "./money-forms";

/* ═══════════ الأنواع المالية الأربعة — الآلة الحاسبة ═══════════ */

type MoneyKind = "expense" | "income" | "saving" | "commitment";

/**
 * V5-س: المال = ذهبي — المبلغ الضخم ذهبي لكل الأنواع وزر الحفظ ذهبي متوهج دائماً؛
 * الشريط (ribbon-soft + حبة الشريط) هو لغة تمييز النوع النشط لا الألوان المتفرقة.
 */
const MONEY_META: Record<MoneyKind, { label: string; icon: typeof Utensils; saveLabel: string }> = {
  expense: { label: "مصروف", icon: Utensils, saveLabel: "سجّل المصروف" },
  income: { label: "دخل", icon: CircleDollarSign, saveLabel: "سجّل الدخل" },
  saving: { label: "ادخار", icon: PiggyBank, saveLabel: "حوّل للادخار" },
  commitment: { label: "التزام", icon: Repeat, saveLabel: "سجّل الالتزام" },
};

/* ═══════════ رموز الحركة (transitions.dev) ═══════════ */

const EASE_SMOOTH_OUT = [0.22, 1, 0.36, 1] as const;

/** دخول قسم داخل اللوحة — stagger 40ms بين الأقسام، mount-only (بلا exit) */
const sheetSection = (delay: number) => ({
  initial: { opacity: 0, y: 8 },
  animate: { opacity: 1, y: 0 },
  transition: { duration: 0.25, delay, ease: EASE_SMOOTH_OUT },
});

/* ═══════════ الأنواع الأخرى — النماذج المنظمة (تمرير أفقي) ═══════════ */

const ENTITY_TABS: Array<{ key: QuickAddTab; label: string; icon: typeof Utensils }> = [
  { key: "task", label: "مهمة", icon: ListTodo },
  { key: "habit", label: "عادة", icon: Flame },
  { key: "block", label: "حدث", icon: CalendarPlus },
  { key: "note", label: "ملاحظة", icon: StickyNote },
  { key: "goal", label: "هدف", icon: Target },
  { key: "recurring", label: "التزام متكرر", icon: Repeat },
  { key: "account", label: "حساب", icon: Landmark },
  { key: "category", label: "فئة", icon: Tags },
  { key: "asset", label: "أصل", icon: Package },
  { key: "debt", label: "دين", icon: HandCoins },
];

const KIND_LABEL: Record<CaptureParsed["kind"], string> = {
  expense: "مصروف",
  income: "دخل",
  task: "مهمة",
  note: "ملاحظة",
  mood: "مزاج",
};

/** مسودة تمرَّر للنماذج المنظمة — العقد نفسه المستورد في tx-forms و entity-forms */
export interface QuickDraft {
  stamp: number;
  kind: CaptureParsed["kind"];
  amount: number | null;
  description: string;
  categoryId: string | null;
  date: string;
  time: string | null;
  tags: string[];
  person: string | null;
}

export function QuickAddSheet() {
  const open = useUIStore((s) => s.quickAddOpen);
  const close = useUIStore((s) => s.closeQuickAdd);
  const tab = useUIStore((s) => s.quickAddTab);
  const setTab = useUIStore((s) => s.setQuickAddTab);
  const presetDate = useUIStore((s) => s.quickAddDate);
  const editTxId = useUIStore((s) => s.quickAddEditTxId);

  /* ─── الحالة المحلية — كل شيء اختيائي عدا المبلغ والوصف ─── */
  const [mode, setMode] = useState<"money" | "entity">("money");
  const [moneyKind, setMoneyKind] = useState<MoneyKind>("expense");
  const [desc, setDesc] = useState("");
  const [amountStr, setAmountStr] = useState("");
  const [smart, setSmart] = useState(false);
  const [smartText, setSmartText] = useState("");
  const [accountId, setAccountId] = useState("");
  const [categoryId, setCategoryId] = useState("");
  const [categoryPicked, setCategoryPicked] = useState(false);
  const [categoryListOpen, setCategoryListOpen] = useState(false);
  const [date, setDate] = useState<string>(todayISO());
  const [outsideBudget, setOutsideBudget] = useState(false);
  const [tags, setTags] = useState("");
  const [person, setPerson] = useState("");
  const [optionsOpen, setOptionsOpen] = useState(false);
  const [saving, setSaving] = useState(false);
  const [draft, setDraft] = useState<QuickDraft | null>(null);

  const descRef = useRef<HTMLInputElement>(null);
  const padRef = useRef<HTMLDivElement>(null);

  /* ─── البيانات الحية — قراءة واحدة لكل جدول ─── */
  const accounts = useLive<Account[]>(() => db.accounts.toArray(), []);
  const categories = useLive<Category[]>(() => db.categories.toArray(), []);
  const settings = useLive<Settings | undefined>(() => db.settings.get("app"), []);
  const txs = useLive<Transaction[]>(() => db.transactions.toArray(), []);

  const digits = settings?.digits ?? "latn";
  const currency = settings?.currency ?? "ر.س";
  const activeAccounts = useMemo(() => (accounts ?? []).filter((a) => !a.archived), [accounts]);
  const hasBudget = (settings?.monthlyBudget ?? 0) > 0 || (settings?.weeklyBudget ?? 0) > 0;
  const status = useMemo(
    () => (settings && txs ? weeklyStatus(settings, txs, todayISO()) : null),
    [settings, txs],
  );

  /* ─── التهيئة/التصفير عند كل فتح/إغلاق ─── */
  useEffect(() => {
    if (!open) {
      setDesc("");
      setAmountStr("");
      setSmart(false);
      setSmartText("");
      setCategoryId("");
      setCategoryPicked(false);
      setCategoryListOpen(false);
      setOutsideBudget(false);
      setTags("");
      setPerson("");
      setOptionsOpen(false);
      setDraft(null);
      setSaving(false);
      return;
    }
    // الابتداء من نوع اللوحة الذي فُتحت منه (المال → مصروف/دخل، المهام → مهمة…)
    const s = useUIStore.getState();
    const t = s.quickAddTab;
    setMoneyKind(t === "income" ? "income" : "expense");
    setMode(t === "expense" || t === "income" ? "money" : "entity");
    setDate(s.quickAddDate ?? todayISO());
    setDesc("");
    setAmountStr("");
    setSmart(false);
    setSmartText("");
    setAccountId("");
    setCategoryId("");
    setCategoryPicked(false);
    setCategoryListOpen(false);
    setOutsideBudget(false);
    setTags("");
    setPerson("");
    setOptionsOpen(false);
    setDraft(null);
    setSaving(false);
  }, [open]);

  // تركيز حقل الوصف تلقائياً — «في أيش انصرف؟» أول ما تفتح اللوحة
  useEffect(() => {
    if (!open || editTxId) return;
    const id = window.setTimeout(() => descRef.current?.focus({ preventScroll: true }), 340);
    return () => window.clearTimeout(id);
  }, [open, editTxId]);

  // حساب افتراضي: أول حساب نشط (للادخار: أول حساب غير ادخاري)
  useEffect(() => {
    if (mode !== "money") return;
    const pool =
      moneyKind === "saving" ? activeAccounts.filter((a) => a.type !== "savings") : activeAccounts;
    const list = pool.length > 0 ? pool : activeAccounts;
    if (!accountId || !list.some((a) => a.id === accountId)) {
      setAccountId(list.length > 0 ? list[0].id : "");
    }
  }, [accountId, activeAccounts, mode, moneyKind]);

  const amountNum = useMemo(() => {
    const n = parseFloat(amountStr);
    return Number.isFinite(n) && n > 0 ? n : 0;
  }, [amountStr]);

  /* ─── آخر التسجيلات — أوصاف مصروف مختلفة بمبلغها الأخير ─── */
  const recentChips = useMemo(() => {
    if (!txs) return [] as Array<{ desc: string; amount: number }>;
    const seen = new Set<string>();
    const out: Array<{ desc: string; amount: number }> = [];
    const sorted = [...txs].sort(
      (a, b) => b.date.localeCompare(a.date) || b.createdAt.localeCompare(a.createdAt),
    );
    for (const t of sorted) {
      if (t.type !== "expense") continue;
      // دفاعي: معاملة قديمة/مستوردة بلا وصف — لا تُسقط اللوحة
      const d = (t.description ?? "").trim();
      if (!d || seen.has(d)) continue;
      seen.add(d);
      out.push({ desc: d, amount: t.amount });
      if (out.length >= 4) break;
    }
    return out;
  }, [txs]);

  /* ─── الفئة الذكية — تخمين محلي فوري من الوصف ─── */
  const guessedCategory = useMemo(() => {
    if (categoryPicked || !categories || mode !== "money") return null;
    if (moneyKind !== "expense" && moneyKind !== "income") return null;
    if (!desc.trim()) return null;
    return guessCategory(desc, categories, moneyKind);
  }, [categoryPicked, categories, desc, mode, moneyKind]);

  const selectedCategory = useMemo(() => {
    if (categoryPicked && categoryId) return (categories ?? []).find((c) => c.id === categoryId) ?? null;
    return guessedCategory;
  }, [categoryPicked, categoryId, categories, guessedCategory]);

  const kindCategories = useMemo(
    () =>
      (categories ?? []).filter(
        (c) =>
          !c.archived &&
          c.kind === (moneyKind === "income" ? "income" : "expense"),
      ),
    [categories, moneyKind],
  );

  /* ─── أرصدة حسابية — لسطر السياق الحي ─── */
  const balanceOf = (id: string): number | null => {
    const a = (accounts ?? []).find((x) => x.id === id);
    if (!a || !txs) return null;
    let bal = a.startingBalance;
    for (const t of txs) {
      if (t.accountId === id) bal += t.type === "income" ? t.amount : -t.amount;
      if (t.toAccountId === id) bal += t.amount;
    }
    return Math.round(bal * 100) / 100;
  };
  const savingsAccount = useMemo(
    () => activeAccounts.find((a) => a.type === "savings") ?? null,
    [activeAccounts],
  );
  const accountName = accountId
    ? activeAccounts.find((a) => a.id === accountId)?.name ?? null
    : null;

  /* ─── الالتقاط الذكي (ثانوي) — «قهوة 18» تُفكَّك للحقول ─── */
  const parsed = useMemo(() => {
    const t = smartText.trim();
    if (!smart || t.length < 2 || !categories) return null;
    const p = parseCapture(t, categories);
    if (!p.description) return null;
    return p;
  }, [smart, smartText, categories]);

  const applySmart = () => {
    if (!parsed) return;
    if (parsed.kind === "expense" || parsed.kind === "income") {
      setMode("money");
      setMoneyKind(parsed.kind);
      setDesc(parsed.description);
      if (parsed.amount != null) setAmountStr(String(parsed.amount));
      if (parsed.categoryId) {
        setCategoryId(parsed.categoryId);
        setCategoryPicked(true);
      }
      if (parsed.date) setDate(parsed.date);
      if (parsed.person) setPerson(parsed.person);
      if (parsed.tags.length > 0) setTags(parsed.tags.join(", "));
    } else {
      // مهمة/ملاحظة/مزاج → النموذج المنظم ممتلئاً بالمسودة
      setDraft({
        stamp: Date.now(),
        kind: parsed.kind,
        amount: parsed.amount,
        description: parsed.description,
        categoryId: parsed.categoryId,
        date: parsed.date,
        time: parsed.time,
        tags: parsed.tags,
        person: parsed.person,
      });
      setTab(parsed.kind === "task" ? "task" : "note");
      setMode("entity");
    }
    setSmart(false);
    setSmartText("");
  };

  /* ─── الحفظ — إغلاق فوري عند النجاح، البقاء والخطأ عند الفشل ─── */
  const needDesc = moneyKind !== "saving";
  const canSave = mode === "money" && amountNum > 0 && (!needDesc || desc.trim().length > 0);

  const save = async () => {
    if (!canSave || saving) return;
    setSaving(true);
    try {
      if (moneyKind === "expense" || moneyKind === "commitment") {
        // لا حساب؟ يُنشأ «نقد» تلقائياً — لا نهايات مسدودة أبداً
        let account = accountId;
        if (!account) {
          const ensured = await ensureDefaultAccount();
          account = ensured.account.id;
          if (ensured.created) {
            toast.info("أنشأنا حساب «نقد» لك تلقائياً", {
              description: "عدّل رصيده لاحقاً من المال ← الحسابات",
            });
          }
        }
        const res = await addTransaction({
          type: "expense",
          amount: amountNum,
          description: desc.trim(),
          accountId: account,
          categoryId:
            moneyKind === "expense"
              ? selectedCategory?.id || undefined
              : undefined,
          date: `${date}T${nowHHMM()}`,
          outsideBudget: moneyKind === "commitment" ? true : outsideBudget,
          tags: tags.trim() || undefined,
          person: person.trim() || undefined,
          source: "manual",
        });
        if (res) close();
        return; // null → toast الخطأ ظهر من addTransaction واللوحة تبقى مفتوحة
      }
      if (moneyKind === "income") {
        const res = await addIncome({
          amount: amountNum,
          description: desc.trim(),
          accountId: accountId || undefined,
          categoryId: selectedCategory?.id || undefined,
          date: `${date}T${nowHHMM()}`,
          tags: tags.trim() || undefined,
        });
        if (res) close();
        return;
      }
      if (moneyKind === "saving") {
        const res = await addToSavings({
          amount: amountNum,
          description: desc.trim() || "إضافة للادخار",
          fromAccountId: accountId || undefined,
          date: `${date}T${nowHHMM()}`,
        });
        if (res) close();
        return;
      }
    } finally {
      setSaving(false);
    }
  };

  /* ─── سطر السياق الحي — لون مختلف لكل نوع ─── */
  const renderContext = () => {
    if (mode !== "money") return null;
    if (moneyKind === "expense") {
      if (outsideBudget) {
        return <p className="text-cyan font-medium">خارج ميزانية المعيشة — لا يستهلك رصيد أسبوعك</p>;
      }
      if (!status || !hasBudget) return null;
      if (status.weekRemaining < 0) {
        return (
          <p className="text-coral font-semibold tabular flex items-center gap-1" dir="rtl">
            <TriangleAlert className="w-3.5 h-3.5 shrink-0" aria-hidden="true" />
            <span>تجاوزت الأسبوع بـ {formatMoney(-status.weekRemaining, currency)}</span>
          </p>
        );
      }
      const todayRem = Math.round((status.dailyLimit - status.todaySpent) * 100) / 100;
      return (
        <p className="tabular">
          <span className="text-muted-foreground">اليوم: متبقي </span>
          <span className={todayRem < 0 ? "text-coral font-semibold" : "text-cyan font-semibold"}>
            {formatMoney(todayRem, currency)}
          </span>
          <span className="text-muted-foreground"> · الأسبوع: متبقي </span>
          <span className="text-cyan font-semibold">{formatMoney(status.weekRemaining, currency)}</span>
        </p>
      );
    }
    if (moneyKind === "income") {
      const bal = accountId ? balanceOf(accountId) : null;
      if (bal == null) {
        return <p className="text-mint">الدخل يرفع رصيد حسابك مباشرة — لا يدخل ميزانية المعيشة</p>;
      }
      return (
        <p className="text-mint tabular">
          رصيد {accountName ?? "الحساب"} بعد الدخل ≈ {formatMoney(bal + amountNum, currency)}
        </p>
      );
    }
    if (moneyKind === "saving") {
      if (!savingsAccount) {
        return <p className="text-mint">سيُنشأ حساب «ادخار» تلقائياً عند الحفظ ✓</p>;
      }
      const bal = balanceOf(savingsAccount.id) ?? 0;
      return (
        <p className="text-mint tabular">
          رصيد الادخار: {formatMoney(bal, currency)} → ≈ {formatMoney(bal + amountNum, currency)}
        </p>
      );
    }
    // التزام — خارج ميزانية المعيشة دائماً
    if (status) {
      return (
        <p className="text-cyan tabular">
          خارج ميزانية المعيشة · التزامات الشهر: {formatMoney(status.outsideSpent, currency)}
        </p>
      );
    }
    return <p className="text-cyan">خارج ميزانية المعيشة — لا يستهلك رصيد أسبوعك</p>;
  };

  /* ─── ملخص الخيارات المطوية ─── */
  const dateLabel =
    date === todayISO() ? "اليوم" : date === addDaysISO(todayISO(), -1) ? "أمس" : date;
  const optionsSummary = [
    accountName ?? "نقد تلقائي",
    selectedCategory ? selectedCategory.name : null,
    dateLabel,
    outsideBudget || moneyKind === "commitment" ? "خارج المعيشة" : null,
  ]
    .filter(Boolean)
    .join(" · ");

  const meta = MONEY_META[moneyKind];
  const backspace = () => setAmountStr(pressAmountKey(amountStr, "back"));

  return (
    <Drawer open={open} onOpenChange={(o) => (o ? null : close())}>
      <DrawerContent
        id="quick-add-sheet"
        className={cn(
          "mx-auto w-full max-w-md rounded-t-3xl flex flex-col",
          // !important يتغلب على data-[vaul-drawer-direction=bottom]:max-h-[80vh]
          // من المكوّن الأساسي — وإلا قُصّرت اللوحة إلى 80vh وطفح المحتوى أسفلها
          "h-[92dvh] !max-h-[92dvh]",
        )}
      >
        {/* V5-س: توقيت حركة اللوحة على مقياس transitions.dev — فتح 400ms (slow)
            بإيز smooth-out، إغلاق 350ms (medium) أهدأ: تلاشي مبكر خلال الانزلاق
            (مسافة مُدرَكة أصغر، بلا قياس)، والستارة 250/150ms.
            vaul يحرك اللوحة بـ CSS محقون بخصوصية أدنى — نتجاوزه بمعرّف اللوحة */}
        <style
          href="systemy-quick-add-motion"
          precedence="high"
        >{`
#quick-add-sheet[data-vaul-drawer][data-state="open"]{animation-duration:var(--duration-slow);animation-timing-function:var(--ease-smooth-out)}
#quick-add-sheet[data-vaul-drawer][data-state="closed"]{animation-name:qa-sheet-close;animation-duration:var(--duration-medium);animation-timing-function:var(--ease-smooth-out)}
@keyframes qa-sheet-close{70%{opacity:0}to{transform:translate3d(0,100%,0);opacity:0}}
body:has(#quick-add-sheet[data-state="open"]) [data-slot="drawer-overlay"]{animation-duration:var(--duration-fast)}
body:has(#quick-add-sheet[data-state="closed"]) [data-slot="drawer-overlay"]{animation-duration:var(--duration-quick)}
`}</style>
        {/* لمسة العلامة — خيط الشريط المتدرج أعلى اللوحة (2px) */}
        <div
          aria-hidden="true"
          className="ribbon pointer-events-none absolute inset-x-[14%] top-0 h-[2px] rounded-full opacity-90"
        />
        {/* دخول اللوحة: انزلاق vaul من الأسفل + قياس 0.97→1 وبلور 2→0 خلال 400ms (mount-only، الإغلاق بلا دراما) */}
        <motion.div
          initial={{ scale: 0.97, filter: "blur(2px)" }}
          animate={{ scale: 1, filter: "blur(0px)" }}
          transition={{ duration: 0.4, ease: EASE_SMOOTH_OUT }}
          className="flex min-h-0 flex-1 flex-col"
        >
        <motion.div {...sheetSection(0)}>
          <DrawerHeader className="flex-row items-center justify-between gap-2 space-y-0 p-3 pb-0 pt-2">
            <DrawerTitle className="text-[15px] font-bold">
              {editTxId ? "تعديل معاملة" : "إضافة سريعة"}
            </DrawerTitle>
            <button
              type="button"
              onClick={close}
              aria-label="إغلاق لوحة الإضافة"
              className="h-11 w-11 min-h-11 min-w-11 shrink-0 rounded-xl glass-soft border border-black/[0.07] flex items-center justify-center text-muted-foreground hover:text-foreground hover:bg-black/[0.04] transition-[color,background-color,transform,scale] duration-[150ms] ease-out active:scale-[0.96]"
            >
              <X className="h-4.5 w-4.5" aria-hidden="true" />
            </button>
            <DrawerDescription className="sr-only">
              سجّل مصروفك بسرعة: المبلغ وفي أيش انصرف — وبقية الخيارات كلها اختيارية
            </DrawerDescription>
          </DrawerHeader>
        </motion.div>

        {/* ═══ وضع تعديل معاملة قائمة — TxForm كما هو (لا يُكسر) ═══ */}
        {editTxId ? (
          <motion.div {...sheetSection(0.04)} className="flex min-h-0 flex-1 flex-col">
            <p className="shrink-0 px-4 pt-2 text-[11px] text-cyan font-medium text-center">
              تعديل معاملة قائمة
            </p>
            <TxForm
              tab={tab === "income" ? "income" : "expense"}
              presetDate={presetDate}
              editTxId={editTxId}
              draft={draft}
            />
          </motion.div>
        ) : (
          <>
            {/* ═══ شرائح النوع — صف أول: الأنواع المالية، صف ثانٍ أفقي ═══ */}
            <motion.div
              {...sheetSection(0.04)}
              className="shrink-0 px-4 pt-2.5 pb-1 space-y-2"
              role="tablist"
              aria-label="نوع الإضافة"
            >
              <div className="grid grid-cols-4 gap-2">
                {(Object.keys(MONEY_META) as MoneyKind[]).map((k) => {
                  const m = MONEY_META[k];
                  const Icon = m.icon;
                  const active = mode === "money" && moneyKind === k;
                  return (
                    <button
                      key={k}
                      type="button"
                      role="tab"
                      aria-selected={active}
                      onClick={() => {
                        if (mode !== "money" || moneyKind !== k) {
                          setMode("money");
                          setMoneyKind(k);
                          setCategoryId("");
                          setCategoryPicked(false);
                          setCategoryListOpen(false);
                          setOutsideBudget(false);
                        }
                      }}
                      className={cn(
                        "relative h-11 min-h-11 px-1 rounded-2xl border flex flex-col items-center justify-center gap-0.5",
                        "transition-[color,border-color,transform,scale] duration-[150ms] ease-out active:scale-[0.96]",
                        // V5-س: النشط = سطح الشريط الخافت + نص واضح، ومؤشر شريط متدرج أسفله
                        active
                          ? "ribbon-soft border-transparent text-foreground"
                          : "glass-soft border-black/[0.07] text-muted-foreground hover:text-foreground"
                      )}
                    >
                      <Icon className="h-4.5 w-4.5" aria-hidden="true" />
                      <span className="text-[11px] font-bold leading-none">{m.label}</span>
                      {active && (
                        <span className="absolute inset-x-0 bottom-1 flex justify-center" aria-hidden="true">
                          <motion.span
                            layoutId="qa-money-kind-pill"
                            className="ribbon h-[3px] w-6 rounded-full"
                            transition={{ duration: 0.25, ease: EASE_SMOOTH_OUT }}
                          />
                        </span>
                      )}
                    </button>
                  );
                })}
              </div>
              {/* شبكة الكيانات — 5 أعمدة × صفان، لا تمرير ولا اقتطاع */}
              <div className="grid grid-cols-5 gap-1.5">
                {ENTITY_TABS.map((t) => {
                  const Icon = t.icon;
                  const active = mode === "entity" && tab === t.key;
                  return (
                    <button
                      key={t.key}
                      type="button"
                      role="tab"
                      aria-selected={active}
                      onClick={() => {
                        setMode("entity");
                        setTab(t.key);
                      }}
                      className={cn(
                        "min-h-[56px] px-1 rounded-2xl border flex flex-col items-center justify-center gap-1",
                        "transition-[color,border-color,background-color,transform,scale] duration-[150ms] ease-out active:scale-[0.96]",
                        active
                          ? "ribbon-soft border-transparent text-foreground"
                          : "glass-soft border-black/[0.07] text-muted-foreground hover:text-foreground"
                      )}
                    >
                      <Icon className="h-4.5 w-4.5 shrink-0" aria-hidden="true" />
                      <span className="text-[9.5px] font-semibold leading-none text-center leading-tight">{t.label}</span>
                    </button>
                  );
                })}
              </div>
            </motion.div>

            {/* ═══ المحتوى ═══ */}
            {mode === "money" ? (
              <div className="flex min-h-0 flex-1 flex-col">
                <motion.div
                  key="money"
                  {...sheetSection(0.08)}
                  className="flex-1 min-h-0 overflow-y-auto sys-scroll px-4 pt-1.5 pb-1"
                >
                  {/* حقل الوصف — أو وضع الالتقاط الذكي */}
                  {smart ? (
                    <div>
                      <div className="relative">
                        <Wand2
                          className="absolute top-1/2 -translate-y-1/2 w-4 h-4 text-primary pointer-events-none"
                          style={{ insetInlineStart: "0.9rem" }}
                          aria-hidden="true"
                        />
                        <input
                          autoFocus
                          value={smartText}
                          onChange={(e) => setSmartText(e.target.value)}
                          onKeyDown={(e) => {
                            if (e.key === "Enter") {
                              e.preventDefault();
                              if (parsed) applySmart();
                            }
                          }}
                          placeholder="اكتب بلغتك: قهوة 18"
                          aria-label="الالتقاط الذكي — اكتب بلغتك الطبيعية"
                          className="w-full h-12 rounded-2xl glass-soft border border-primary/30 ps-10 pe-4 text-[14px] text-foreground placeholder:text-muted-foreground/50 focus:border-primary/50 focus:outline-none transition-colors"
                          dir="auto"
                          enterKeyHint="done"
                        />
                      </div>
                      {parsed && (
                        <div className="mt-2 glass rounded-2xl p-2.5" aria-live="polite">
                          <div className="flex flex-wrap items-center gap-1.5 text-[11px]">
                            <span className="px-2 py-1 rounded-lg ribbon-soft text-foreground font-bold">
                              {KIND_LABEL[parsed.kind]}
                            </span>
                            {parsed.amount != null && (
                              <span className="px-2 py-1 rounded-lg glass-soft font-bold tabular" dir="ltr">
                                {parsed.amount}
                              </span>
                            )}
                            <span className="px-2 py-1 rounded-lg glass-soft truncate max-w-[45%]">
                              {parsed.description}
                            </span>
                            {parsed.categoryName && (
                              <span className="px-2 py-1 rounded-lg glass-soft text-mint">
                                فئة: {parsed.categoryName} ✓
                              </span>
                            )}
                          </div>
                          <button
                            type="button"
                            onClick={applySmart}
                            className="mt-2 w-full h-11 min-h-11 rounded-xl bg-primary/15 border border-primary/30 text-primary text-[12px] font-bold transition-[background-color,border-color,transform,scale] duration-[150ms] ease-out hover:bg-primary/25 active:scale-[0.96]"
                          >
                            طبّق على الحقول ↵
                          </button>
                        </div>
                      )}
                    </div>
                  ) : (
                    <div className="relative">
                      <input
                        ref={descRef}
                        value={desc}
                        onChange={(e) => setDesc(e.target.value)}
                        onKeyDown={(e) => {
                          if (e.key === "Enter") {
                            e.preventDefault();
                            // انتقال طبيعي: الوصف ← لوحة الأرقام (لوحة مفاتيح فعلية)
                            padRef.current?.focus();
                          }
                        }}
                        placeholder={
                          moneyKind === "income"
                            ? "من أين جاء الدخل؟ مثال: مشروع"
                            : moneyKind === "saving"
                              ? "وصف التحويل (اختياري)"
                              : "في أيش انصرف؟ مثال: قهوة"
                        }
                        aria-label="الوصف — في أيش انصرف؟"
                        className="w-full h-12 rounded-2xl glass-soft border border-black/[0.07] ps-4 pe-12 text-[14px] text-foreground placeholder:text-muted-foreground/50 focus:border-primary/40 focus:outline-none transition-colors"
                        dir="auto"
                        enterKeyHint="next"
                      />
                      <button
                        type="button"
                        onClick={() => setSmart(true)}
                        aria-label="تشغيل الالتقاط الذكي — اكتب جملة واحدة"
                        title="الالتقاط الذكي"
                        className="absolute inset-y-0 end-0 w-12 flex items-center justify-center text-muted-foreground/70 hover:text-primary transition-colors"
                      >
                        <Wand2 className="w-4.5 h-4.5" aria-hidden="true" />
                      </button>
                    </div>
                  )}

                  {/* شاشة العرض — المبلغ ضخم + سطر السياق الحي */}
                  <div
                    className={cn(
                      "mt-2.5 rounded-2xl border p-3 transition-colors",
                      amountStr ? "glass-soft border-primary/30" : "glass border-black/[0.05]"
                    )}
                    role="status"
                    aria-label="شاشة المبلغ"
                  >
                    <div className="flex items-center justify-between gap-2">
                      <p
                        className="num-display tabular leading-none truncate text-[40px] text-primary"
                        dir="ltr"
                      >
                        {displayAmount(amountStr || "0", digits)}
                        <span className="text-[15px] text-muted-foreground ms-1.5 font-normal">
                          {currency}
                        </span>
                      </p>
                      <button
                        type="button"
                        onClick={backspace}
                        aria-label="حذف آخر رقم"
                        disabled={!amountStr}
                        className="h-11 w-11 min-h-11 min-w-11 shrink-0 rounded-xl glass-soft border border-black/[0.07] flex items-center justify-center text-muted-foreground enabled:hover:text-foreground enabled:hover:bg-black/[0.04] disabled:opacity-30 transition-[color,background-color,transform,scale] duration-[150ms] ease-out active:scale-[0.96]"
                      >
                        <Delete className="h-5 w-5" aria-hidden="true" />
                      </button>
                    </div>
                    <div className="mt-2 pt-2 border-t border-black/[0.05] text-[10.5px] leading-relaxed">
                      {renderContext()}
                    </div>
                  </div>

                  {/* آخر ما سجلته — لمسة تعبّئ الوصف والمبلغ */}
                  {moneyKind === "expense" && recentChips.length > 0 && (
                    <div
                      className="mt-2.5 flex gap-2 overflow-x-auto no-scrollbar -mx-1 px-1"
                      role="group"
                      aria-label="آخر ما سجلته — لمسة تعبّئ الوصف والمبلغ"
                    >
                      {recentChips.map((c) => (
                        <button
                          key={c.desc}
                          type="button"
                          onClick={() => {
                            setDesc(c.desc);
                            if (!amountStr) setAmountStr(String(c.amount));
                          }}
                          aria-label={`تعبئة: ${c.desc} بمبلغ ${c.amount}`}
                          className="h-11 min-h-11 shrink-0 px-3.5 rounded-full glass-soft border border-black/[0.07] text-[11.5px] font-medium text-foreground/90 whitespace-nowrap hover:bg-black/[0.04] transition-[color,background-color,transform,scale] duration-[150ms] ease-out active:scale-[0.96]"
                        >
                          {c.desc}
                          <span className="text-muted-foreground/70"> · </span>
                          <span className="text-primary font-bold tabular" dir="ltr">{c.amount}</span>
                        </button>
                      ))}
                    </div>
                  )}

                  {/* لوحة الأرقام — آلة حاسبة */}
                  <div className="mt-3">
                    <AmountPad
                      value={amountStr}
                      onChange={setAmountStr}
                      digits={digits}
                      padRef={padRef}
                      label={
                        moneyKind === "income"
                          ? "لوحة إدخال مبلغ الدخل"
                          : moneyKind === "saving"
                            ? "لوحة إدخال مبلغ الادخار"
                            : "لوحة إدخال المبلغ"
                      }
                    />
                  </div>

                  {/* خيارات إضافية — كلها اختيارية */}
                  <div className="mt-3 mb-1 rounded-2xl glass-soft border border-black/[0.05] overflow-hidden">
                    <button
                      type="button"
                      onClick={() => setOptionsOpen((v) => !v)}
                      aria-expanded={optionsOpen}
                      className="w-full min-h-11 px-3.5 flex items-center justify-between gap-2 text-[11.5px] text-muted-foreground hover:text-foreground/90 transition-colors"
                    >
                      <span className="flex items-center gap-1.5 font-medium">
                        <ChevronDown
                          className={cn(
                            "w-4 h-4 transition-transform duration-[250ms] ease-in-out",
                            optionsOpen && "rotate-180"
                          )}
                          aria-hidden="true"
                        />
                        خيارات إضافية
                        <span className="text-muted-foreground/60 font-normal">(اختيارية)</span>
                      </span>
                      {!optionsOpen && (
                        <span className="text-[10px] text-muted-foreground/70 truncate max-w-[45%]">
                          {optionsSummary}
                        </span>
                      )}
                    </button>
                    <AnimatePresence initial={false}>
                      {optionsOpen && (
                        <motion.div
                          initial={{ height: 0, opacity: 0 }}
                          animate={{ height: "auto", opacity: 1 }}
                          exit={{ height: 0, opacity: 0 }}
                          transition={{ duration: 0.35, ease: EASE_SMOOTH_OUT }}
                          className="overflow-hidden"
                        >
                        <div className="px-3.5 pb-3.5 pt-3 space-y-3.5 border-t border-black/[0.05]">
                          {/* الحساب */}
                          <div className="space-y-1.5">
                            <p className="text-[11px] font-medium text-muted-foreground">
                              {moneyKind === "saving" ? "من حساب" : "الحساب"}
                            </p>
                            <div className="flex flex-wrap gap-2" role="radiogroup" aria-label="الحساب">
                              {activeAccounts.map((a) => {
                                const I = iconByName(a.icon);
                                const active = accountId === a.id;
                                return (
                                  <button
                                    key={a.id}
                                    type="button"
                                    role="radio"
                                    aria-checked={active}
                                    onClick={() => setAccountId(a.id)}
                                    className={cn(
                                      "h-11 min-h-11 px-3.5 rounded-full border text-[11.5px] font-medium flex items-center gap-1.5",
                                      "transition-[color,background-color,border-color,transform,scale] duration-[150ms] ease-out active:scale-[0.96]",
                                      active
                                        ? "bg-primary/15 border-primary/40 text-gold"
                                        : "border-black/[0.07] text-foreground/80 hover:bg-black/[0.04] glass-soft"
                                    )}
                                  >
                                    <I className="w-3.5 h-3.5" style={{ color: a.color }} aria-hidden="true" />
                                    {a.name}
                                  </button>
                                );
                              })}
                              {activeAccounts.length === 0 && (
                                <p className="text-[11px] text-gold">
                                  سيُنشأ حساب «نقد» تلقائياً عند الحفظ ✓
                                </p>
                              )}
                            </div>
                          </div>

                          {/* الفئة — ذكية تلقائياً، اختيار يدوي عند الضغط */}
                          {(moneyKind === "expense" || moneyKind === "income") &&
                            kindCategories.length > 0 && (
                              <div className="space-y-1.5">
                                <p className="text-[11px] font-medium text-muted-foreground">
                                  {categoryPicked
                                    ? "الفئة"
                                    : selectedCategory
                                      ? "الفئة (ذكية ✓)"
                                      : "الفئة — تُخمَّن تلقائياً من الوصف"}
                                </p>
                                {categoryListOpen ? (
                                  <div className="flex flex-wrap gap-2" role="radiogroup" aria-label="اختيار الفئة">
                                    <button
                                      type="button"
                                      role="radio"
                                      aria-checked={!categoryPicked}
                                      onClick={() => {
                                        setCategoryId("");
                                        setCategoryPicked(false);
                                        setCategoryListOpen(false);
                                      }}
                                      className={cn(
                                        "h-11 min-h-11 px-3.5 rounded-full border text-[11.5px] font-medium inline-flex items-center gap-1",
                                        "transition-[color,background-color,border-color,transform,scale] duration-[150ms] ease-out active:scale-[0.96]",
                                        !categoryPicked
                                          ? "bg-primary/15 border-primary/40 text-gold"
                                          : "glass-soft border-black/[0.07] text-muted-foreground"
                                      )}
                                    >
                                      <Sparkles className="w-3.5 h-3.5" aria-hidden="true" />
                                      تلقائية
                                    </button>
                                    {kindCategories.map((c) => {
                                      const I = iconByName(c.icon);
                                      const active = categoryPicked && categoryId === c.id;
                                      return (
                                        <button
                                          key={c.id}
                                          type="button"
                                          role="radio"
                                          aria-checked={active}
                                          onClick={() => {
                                            setCategoryId(c.id);
                                            setCategoryPicked(true);
                                            setCategoryListOpen(false);
                                          }}
                                          className={cn(
                                            "h-11 min-h-11 px-3.5 rounded-full border text-[11.5px] font-medium flex items-center gap-1.5",
                                            "transition-[color,background-color,border-color,transform,scale] duration-[150ms] ease-out active:scale-[0.96]",
                                            active
                                              ? "bg-primary/15 border-primary/40 text-gold"
                                              : "glass-soft border-black/[0.07] text-foreground/80 hover:bg-black/[0.04]"
                                          )}
                                        >
                                          <I className="w-3.5 h-3.5" style={{ color: c.color }} aria-hidden="true" />
                                          {c.name}
                                        </button>
                                      );
                                    })}
                                  </div>
                                ) : (
                                  <button
                                    type="button"
                                    onClick={() => setCategoryListOpen(true)}
                                    className={cn(
                                      "h-11 min-h-11 px-3.5 rounded-full border text-[11.5px] font-medium flex items-center gap-1.5",
                                      "transition-[color,background-color,border-color,transform,scale] duration-[150ms] ease-out active:scale-[0.96]",
                                      selectedCategory
                                        ? "bg-primary/15 border-primary/40 text-gold"
                                        : "glass-soft border-black/[0.07] text-muted-foreground hover:text-foreground"
                                    )}
                                  >
                                    {selectedCategory ? (
                                      <>
                                        {(() => {
                                          const I = iconByName(selectedCategory.icon);
                                          return <I className="w-3.5 h-3.5" style={{ color: selectedCategory.color }} aria-hidden="true" />;
                                        })()}
                                        {selectedCategory.name}
                                        {!categoryPicked && <span aria-hidden="true">✓</span>}
                                      </>
                                    ) : (
                                      "اختر فئة (اختياري)"
                                    )}
                                  </button>
                                )}
                              </div>
                            )}

                          {/* التاريخ */}
                          <div className="space-y-1.5">
                            <p className="text-[11px] font-medium text-muted-foreground">التاريخ</p>
                            <div className="flex flex-wrap items-center gap-2">
                              {[
                                { label: "اليوم", iso: todayISO() },
                                { label: "أمس", iso: addDaysISO(todayISO(), -1) },
                                { label: "قبل يومين", iso: addDaysISO(todayISO(), -2) },
                              ].map((d) => (
                                <button
                                  key={d.label}
                                  type="button"
                                  onClick={() => setDate(d.iso)}
                                  aria-pressed={date === d.iso}
                                  className={cn(
                                    "h-11 min-h-11 px-3.5 rounded-full border text-[11.5px] font-medium",
                                    "transition-[color,background-color,border-color,transform,scale] duration-[150ms] ease-out active:scale-[0.96]",
                                    date === d.iso
                                      ? "bg-primary/15 border-primary/40 text-gold"
                                      : "glass-soft border-black/[0.07] text-foreground/80 hover:bg-black/[0.04]"
                                  )}
                                >
                                  {d.label}
                                </button>
                              ))}
                              <input
                                type="date"
                                value={date}
                                onChange={(e) => setDate(e.target.value || todayISO())}
                                aria-label="اختيار تاريخ حر"
                                className="h-11 min-h-11 px-2.5 rounded-full glass-soft border border-black/[0.07] text-[11px] text-foreground/80 tabular focus:border-primary/40 focus:outline-none transition-colors"
                                dir="ltr"
                              />
                            </div>
                          </div>

                          {/* خارج ميزانية المعيشة */}
                          {(moneyKind === "expense" || moneyKind === "commitment") && (
                            <button
                              type="button"
                              role="checkbox"
                              aria-checked={moneyKind === "commitment" ? true : outsideBudget}
                              disabled={moneyKind === "commitment"}
                              onClick={() => setOutsideBudget((v) => !v)}
                              className="w-full flex items-start gap-2.5 text-start min-h-11 py-1 disabled:cursor-default"
                            >
                              <span
                                className={cn(
                                  "mt-0.5 w-5 h-5 shrink-0 rounded-md border flex items-center justify-center transition-colors",
                                  outsideBudget || moneyKind === "commitment"
                                    ? "bg-primary/80 border-primary text-primary-foreground"
                                    : "glass-soft border-black/[0.1] text-transparent"
                                )}
                                aria-hidden="true"
                              >
                                <Check className="w-3.5 h-3.5" strokeWidth={3} />
                              </span>
                              <span className="text-[11.5px] leading-relaxed text-foreground/85">
                                هذا الصرف خارج ميزانية المعيشة (التزام/استثنائي)
                                {moneyKind === "commitment" && (
                                  <span className="block text-[10px] text-cyan">
                                    مفعّل تلقائياً للالتزامات — لا يستهلك رصيد أسبوعك
                                  </span>
                                )}
                              </span>
                            </button>
                          )}

                          {/* وسم / شخص — اختياري جداً */}
                          {(moneyKind === "expense" ||
                            moneyKind === "commitment" ||
                            moneyKind === "income") && (
                            <div className="grid grid-cols-2 gap-2.5">
                              <input
                                value={tags}
                                onChange={(e) => setTags(e.target.value)}
                                placeholder="وسم (اختياري)"
                                aria-label="وسم"
                                className="h-11 rounded-xl glass-soft border border-black/[0.07] px-3 text-[12px] text-foreground placeholder:text-muted-foreground/50 focus:border-primary/40 focus:outline-none transition-colors"
                                dir="auto"
                              />
                              {moneyKind !== "income" && (
                                <input
                                  value={person}
                                  onChange={(e) => setPerson(e.target.value)}
                                  placeholder="شخص (اختياري)"
                                  aria-label="شخص"
                                  className="h-11 rounded-xl glass-soft border border-black/[0.07] px-3 text-[12px] text-foreground placeholder:text-muted-foreground/50 focus:border-primary/40 focus:outline-none transition-colors"
                                  dir="auto"
                                />
                              )}
                            </div>
                          )}
                        </div>
                        </motion.div>
                      )}
                    </AnimatePresence>
                  </div>
                </motion.div>

                {/* ═══ زر الحفظ — ثابت في التذييل، مرئي دائماً ═══ */}
                <motion.div
                  {...sheetSection(0.12)}
                  className="kb-safe shrink-0 px-4 pt-2 pb-3 border-t border-black/[0.06] bg-white/95 backdrop-blur-md"
                >
                  {moneyKind === "commitment" && (
                    <p className="mb-1.5 text-center text-[10px] text-cyan font-medium">
                      خارج ميزانية المعيشة
                    </p>
                  )}
                  <button
                    type="button"
                    onClick={() => void save()}
                    disabled={!canSave || saving}
                    aria-label={`${meta.saveLabel}${amountNum > 0 ? ` ${amountNum} ${currency}` : ""}`}
                    className={cn(
                      // V5: الذهبي = الإجراء الأساسي — توهج ذهبي + ضغط 0.96 خلال 150ms
                      "w-full h-14 min-h-14 rounded-2xl text-[15px] font-bold flex items-center justify-center gap-2",
                      "bg-primary text-primary-foreground glow-gold",
                      "transition-[transform,scale,opacity] duration-[150ms] ease-out active:scale-[0.96]",
                      !canSave && "opacity-40"
                    )}
                  >
                    <AnimatePresence initial={false} mode="popLayout">
                      {saving ? (
                        <motion.span
                          key="saving"
                          initial={{ opacity: 0, scale: 0.25, filter: "blur(4px)" }}
                          animate={{ opacity: 1, scale: 1, filter: "blur(0px)" }}
                          exit={{ opacity: 0, scale: 0.25, filter: "blur(4px)" }}
                          transition={{ type: "spring", duration: 0.3, bounce: 0 }}
                          className="flex items-center justify-center gap-2"
                        >
                          <Loader2 className="w-5 h-5 animate-spin" aria-hidden="true" />
                          جارٍ التسجيل…
                        </motion.span>
                      ) : (
                        <motion.span
                          key="idle"
                          initial={{ opacity: 0, scale: 0.25, filter: "blur(4px)" }}
                          animate={{ opacity: 1, scale: 1, filter: "blur(0px)" }}
                          exit={{ opacity: 0, scale: 0.25, filter: "blur(4px)" }}
                          transition={{ type: "spring", duration: 0.3, bounce: 0 }}
                          className="flex items-center justify-center gap-2"
                        >
                          <span>{meta.saveLabel}</span>
                          <Check className="w-5 h-5" aria-hidden="true" />
                          {amountNum > 0 && (
                            <span className="tabular" dir="ltr">
                              {displayAmount(amountStr, digits)} {currency}
                            </span>
                          )}
                        </motion.span>
                      )}
                    </AnimatePresence>
                  </button>
                </motion.div>
              </div>
            ) : (
              <motion.div
                key="entity"
                {...sheetSection(0.08)}
                className="overflow-y-auto sys-scroll flex-1 min-h-0 px-4 pt-1 pb-2"
              >
                {tab === "task" && <TaskForm presetDate={presetDate} draft={draft} />}
                {tab === "habit" && <HabitForm />}
                {tab === "block" && <BlockForm presetDate={presetDate} draft={draft} />}
                {tab === "note" && <NoteForm draft={draft} />}
                {tab === "goal" && <GoalForm />}
                {tab === "recurring" && <RecurringForm />}
                {tab === "account" && <AccountForm />}
                {tab === "category" && <CategoryForm />}
                {tab === "asset" && <AssetForm />}
                {tab === "debt" && <DebtForm />}
              </motion.div>
            )}
          </>
        )}
        </motion.div>
      </DrawerContent>
    </Drawer>
  );
}
