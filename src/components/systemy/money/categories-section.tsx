"use client";

/**
 * Systemy v2 — قسم «الفئات» (المظاريف)
 * مجموعتان: مصروف (بشريط تقدم المظروف) ودخل + تعديل الميزانية فوراً
 * من بوب-أفر صغير + CRUD كامل (اسم/نوع/أيقونة/لون/ميزانية/كلمات مفتاحية
 * للتصنيف الذكي) + أرشفة.
 */

import { useMemo, useState } from "react";
import { Pencil, Plus, Tags, Trash2 } from "lucide-react";
import { toast } from "sonner";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { Switch } from "@/components/ui/switch";
import { addCategory, deleteCategory, updateCategory } from "@/lib/actions";
import { formatMoney, formatNumber } from "@/lib/format";
import { monthWindow, type Envelope } from "@/lib/money";
import { Chip, GlassCard, PrivateAmount } from "@/components/systemy/glass";
import {
  ChipRow,
  ColorSwatches,
  ConfirmBar,
  EmptyState,
  Field,
  FormShell,
  IconGrid,
  NumberPad,
  displayAmount,
  inputCls,
} from "@/components/systemy/ui-bits";
import { IconBubble, SheetShell, type MoneyData } from "./money-screen";
import type { Category } from "@/lib/types";
import { cn } from "@/lib/utils";

/* ═══════════════════════ خرائط وثوابت ═══════════════════════ */

const ENV_COLOR: Record<Envelope["status"], string> = {
  great: "#6EE7A8",
  good: "#F5B95C",
  careful: "#FFB4A2",
  over: "#FF8E7A",
};

const KIND_OPTIONS: Array<{ k: string; v: string }> = [
  { k: "expense", v: "مصروف" },
  { k: "income", v: "دخل" },
];

/* ═══════════════════════ القسم ═══════════════════════ */

export function CategoriesSection({ data }: { data: MoneyData }) {
  const { settings, categories, txs } = data;
  const cur = settings.currency || "ر.س";
  const [editing, setEditing] = useState<Category | "new" | null>(null);
  const [budgetOpenId, setBudgetOpenId] = useState<string | null>(null);
  const [budgetDraft, setBudgetDraft] = useState("");

  const w = useMemo(() => monthWindow(settings), [settings]);

  /** صرف الشهر الحالي لكل فئة + حالة المظروف */
  const spentByCat = useMemo(() => {
    const m = new Map<string, number>();
    for (const t of txs) {
      if (t.type !== "expense" || !t.categoryId) continue;
      const d = t.date.slice(0, 10);
      if (d < w.start || d > w.end) continue;
      m.set(t.categoryId, Math.round(((m.get(t.categoryId) ?? 0) + t.amount) * 100) / 100);
    }
    return m;
  }, [txs, w]);

  const envStatusOf = (c: Category): { percent: number; status: Envelope["status"] } => {
    const spent = spentByCat.get(c.id) ?? 0;
    const budget = c.budget ?? 0;
    if (budget <= 0) return { percent: 0, status: "great" };
    const percent = Math.round((spent / budget) * 100);
    let status: Envelope["status"] = "great";
    if (percent > 100) status = "over";
    else if (percent >= 85) status = "careful";
    else if (percent >= 60) status = "good";
    return { percent, status };
  };

  const expenseCats = categories.filter((c) => c.kind === "expense");
  const incomeCats = categories.filter((c) => c.kind === "income");

  /** حفظ ميزانية فئة من البوب-أفر */
  const saveBudget = (c: Category) => {
    const value = Number(budgetDraft) || 0;
    void updateCategory(c.id, { budget: value });
    setBudgetOpenId(null);
  };

  const renderRow = (c: Category) => {
    const spent = spentByCat.get(c.id) ?? 0;
    const hasBudget = (c.budget ?? 0) > 0 && c.kind === "expense";
    const { percent, status } = envStatusOf(c);
    return (
      <div
        key={c.id}
        role="button"
        tabIndex={0}
        aria-label={`تعديل الفئة: ${c.name}`}
        onClick={() => setEditing(c)}
        onKeyDown={(e) => {
          if (e.key === "Enter" || e.key === " ") {
            e.preventDefault();
            setEditing(c);
          }
        }}
        className="px-4 py-2.5 cursor-pointer hover:bg-white/[0.03] transition-colors border-t border-white/[0.04] first:border-t-0"
      >
        <div className="flex items-center gap-3 min-h-11">
          <IconBubble icon={c.icon} color={c.color} className="w-10 h-10" iconClassName="w-[18px] h-[18px]" />
          <div className="flex-1 min-w-0">
            <div className="flex items-center gap-2">
              <span className={cn("text-[13px] font-semibold truncate", c.archived && "line-through opacity-60")}>
                {c.name}
              </span>
              {c.archived && <Chip className="text-muted-foreground shrink-0">مؤرشفة</Chip>}
            </div>
            <span className="text-[10.5px] text-muted-foreground block mt-0.5 tabular">
              صرف الشهر {formatMoney(spent, cur)}
            </span>
          </div>

          {c.kind === "expense" && (
            <div className="shrink-0" onClick={(e) => e.stopPropagation()}>
              <Popover
                open={budgetOpenId === c.id}
                onOpenChange={(o) => {
                  setBudgetOpenId(o ? c.id : null);
                  if (o) setBudgetDraft(c.budget ? String(c.budget) : "");
                }}
              >
                <PopoverTrigger asChild>
                  <button
                    aria-label={`تعديل ميزانية ${c.name}`}
                    className="min-h-11 px-2.5 rounded-xl flex items-center gap-1.5 text-[11px] text-muted-foreground hover:text-primary transition-colors"
                  >
                    <span className="tabular">{hasBudget ? formatMoney(c.budget ?? 0, cur) : "بلا ميزانية"}</span>
                    <Pencil className="w-3 h-3" aria-hidden="true" />
                  </button>
                </PopoverTrigger>
                <PopoverContent className="w-56 glass-deep rounded-2xl p-3 space-y-2.5" align="center" dir="rtl">
                  <p className="text-[11px] text-muted-foreground">مظروف «{c.name}» الشهري</p>
                  <input
                    value={budgetDraft}
                    onChange={(e) => setBudgetDraft(e.target.value.replace(/[^\d.]/g, ""))}
                    inputMode="decimal"
                    placeholder="0"
                    aria-label="الميزانية الشهرية"
                    className={cn(inputCls, "h-11 text-center num-display")}
                    autoFocus
                  />
                  <div className="flex gap-2">
                    <button
                      onClick={() => {
                        void updateCategory(c.id, { budget: 0 });
                        setBudgetOpenId(null);
                      }}
                      className="flex-1 h-10 rounded-xl glass-soft border border-white/[0.08] text-[11px] font-medium hover:bg-white/[0.06] transition-colors"
                    >
                      إزالة
                    </button>
                    <button
                      onClick={() => saveBudget(c)}
                      className="flex-1 h-10 rounded-xl bg-primary text-primary-foreground text-[11px] font-bold active:scale-95 transition-transform"
                    >
                      حفظ
                    </button>
                  </div>
                </PopoverContent>
              </Popover>
            </div>
          )}
        </div>

        {hasBudget && (
          <div className="mt-1.5">
            <div className="h-1.5 rounded-full bg-white/[0.05] overflow-hidden">
              <div
                className="h-full rounded-full"
                style={{ width: `${Math.min(100, percent)}%`, background: ENV_COLOR[status] }}
              />
            </div>
            <p className="text-[9.5px] text-muted-foreground mt-1 tabular">
              {formatNumber(percent)}% من المظروف
              {percent > 100 ? " — تجاوزت" : percent >= 85 ? " — اقترب من الحد" : ""}
            </p>
          </div>
        )}
      </div>
    );
  };

  return (
    <div>
      {/* ═══ رأس القسم ═══ */}
      <div className="flex items-center justify-between px-1 mb-2.5">
        <div className="flex items-center gap-2 text-[13px] font-semibold text-foreground/90">
          <Tags className="w-4 h-4 text-primary" aria-hidden="true" />
          <span>الفئات والمظاريف</span>
          <Chip className="text-muted-foreground tabular">{formatNumber(categories.filter((c) => !c.archived).length)}</Chip>
        </div>
        <button
          onClick={() => setEditing("new")}
          aria-label="إضافة فئة جديدة"
          className="h-11 px-4 rounded-2xl bg-primary/15 border border-primary/30 text-primary text-[12px] font-bold flex items-center gap-1.5 hover:bg-primary/25 transition-colors"
        >
          <Plus className="w-4 h-4" aria-hidden="true" />
          فئة
        </button>
      </div>

      {categories.length === 0 ? (
        <GlassCard className="p-2">
          <EmptyState
            icon={<Tags className="w-6 h-6" />}
            title="لا فئات بعد"
            hint="الفئات بألوانها وكلماتها المفتاحية هي ما يجعل التصنيف الذكي يعمل"
            actionLabel="أضف فئة"
            onAction={() => setEditing("new")}
          />
        </GlassCard>
      ) : (
        <div className="space-y-3">
          {expenseCats.length > 0 && (
            <GlassCard className="overflow-hidden">
              <div className="px-4 py-2.5 border-b border-white/[0.05] flex items-center justify-between">
                <span className="text-[12px] font-bold text-foreground/90">مصروف — أظرف الميزانية</span>
                <span className="text-[10px] text-muted-foreground">اضغط الميزانية لتعديلها</span>
              </div>
              {expenseCats.map(renderRow)}
            </GlassCard>
          )}

          {incomeCats.length > 0 && (
            <GlassCard className="overflow-hidden">
              <div className="px-4 py-2.5 border-b border-white/[0.05]">
                <span className="text-[12px] font-bold text-foreground/90">دخل</span>
              </div>
              {incomeCats.map(renderRow)}
            </GlassCard>
          )}
        </div>
      )}

      {/* ═══ ورقة CRUD ═══ */}
      {editing && <CategorySheet editing={editing} data={data} onClose={() => setEditing(null)} />}
    </div>
  );
}

/* ═══════════════════════ ورقة إضافة/تعديل فئة ═══════════════════════ */

function CategorySheet({ editing, data, onClose }: { editing: Category | "new"; data: MoneyData; onClose: () => void }) {
  const isNew = editing === "new";
  const cat = isNew ? null : editing;
  const { settings, categories, txs } = data;
  const cur = settings.currency || "ر.س";
  const digits = settings.digits ?? "latn";

  const [name, setName] = useState(cat?.name ?? "");
  const [kind, setKind] = useState<"expense" | "income">(cat?.kind ?? "expense");
  const [icon, setIcon] = useState(cat?.icon ?? "star");
  const [color, setColor] = useState(cat?.color ?? "#5CE1E6");
  const [budget, setBudget] = useState(cat?.budget ? String(cat.budget) : "0");
  const [keywords, setKeywords] = useState(cat?.keywords ?? "");
  const [archived, setArchived] = useState(cat?.archived ?? false);
  const [busy, setBusy] = useState(false);
  const [confirming, setConfirming] = useState(false);

  const txCount = cat ? txs.filter((t) => t.categoryId === cat.id).length : 0;

  const save = async () => {
    if (!name.trim()) {
      toast.error("سمّ الفئة أولاً");
      return;
    }
    const budgetValue = kind === "expense" ? Number(budget) || 0 : undefined;
    setBusy(true);
    if (cat) {
      await updateCategory(cat.id, {
        name: name.trim(),
        kind,
        icon,
        color,
        budget: budgetValue,
        keywords: keywords.trim(),
        archived,
      });
    } else {
      const order = Math.max(0, ...categories.map((c) => c.order)) + 1;
      await addCategory({
        name: name.trim(),
        kind,
        icon,
        color,
        budget: budgetValue,
        keywords: keywords.trim(),
        archived: false,
        order,
      });
    }
    setBusy(false);
    onClose();
  };

  const del = async () => {
    if (!cat) return;
    setBusy(true);
    await deleteCategory(cat.id);
    setBusy(false);
    onClose();
  };

  return (
    <SheetShell
      title={isNew ? "فئة جديدة" : `تعديل ${cat?.name ?? ""}`}
      desc={cat ? `${formatNumber(txCount)} معاملة بهذه الفئة` : "لون وأيقونة وكلمات مفتاحية — هكذا تُبنى تجربتك"}
      onClose={onClose}
    >
      <FormShell
        onSave={() => void save()}
        busy={busy}
        saveLabel={isNew ? "إضافة الفئة" : "حفظ التعديلات"}
        extra={
          !isNew &&
          (confirming ? (
            <ConfirmBar
              message={
                txCount > 0
                  ? `${formatNumber(txCount)} معاملة تستخدم هذه الفئة — سيُرشَف بدل الحذف وتحتفظ المعاملات بتصنيفها.`
                  : "سيُحذف الفئة نهائياً."
              }
              confirmLabel={txCount > 0 ? "أرشفة" : "حذف نهائي"}
              onConfirm={() => void del()}
              onCancel={() => setConfirming(false)}
            />
          ) : (
            <button
              onClick={() => setConfirming(true)}
              className="w-full h-12 rounded-2xl glass-soft border border-[#FF8E7A]/25 text-[#FF8E7A] text-[13px] font-bold flex items-center justify-center gap-2 hover:bg-[#FF8E7A]/10 transition-colors"
            >
              <Trash2 className="w-4 h-4" aria-hidden="true" />
              حذف الفئة
            </button>
          ))
        }
      >
        <Field label="اسم الفئة">
          <input
            value={name}
            onChange={(e) => setName(e.target.value)}
            placeholder="بقالة وطعام…"
            className={inputCls}
          />
        </Field>

        <ChipRow label="النوع" options={KIND_OPTIONS} value={kind} onSelect={(k) => setKind(k as "expense" | "income")} />

        {kind === "expense" && (
          <Field label="مظروف الميزانية الشهري" hint="0 = بلا ميزانية — لن يظهر في الأظرف">
            <div className="glass-soft rounded-2xl p-4 flex flex-col items-center gap-1">
              <div className="num-display text-[30px] text-primary tabular" aria-live="polite">
                {displayAmount(budget, digits)}
              </div>
              <span className="text-[11.5px] text-muted-foreground">{cur} / شهرياً</span>
            </div>
            <NumberPad value={budget} onChange={setBudget} digits={digits} className="mt-3" label="لوحة الميزانية" />
          </Field>
        )}

        <Field label="الأيقونة">
          <IconGrid value={icon} onChange={setIcon} />
        </Field>

        <Field label="اللون">
          <ColorSwatches value={color} onChange={setColor} />
        </Field>

        <Field
          label="كلمات مفتاحية للتصنيف الذكي"
          hint="كلمات مفصولة بفواصل — أي وصف يحتويها يُصنَّف هنا تلقائياً"
        >
          <input
            value={keywords}
            onChange={(e) => setKeywords(e.target.value)}
            placeholder="تميمي,سلة,هورا…"
            className={inputCls}
          />
        </Field>

        {!isNew && (
          <div className="flex items-center justify-between rounded-2xl glass-soft px-4 py-3">
            <div>
              <p className="text-[12.5px] font-medium">مؤرشفة</p>
              <p className="text-[10.5px] text-muted-foreground mt-0.5">تختفي من قوائم الإضافة وتبقى في السجل</p>
            </div>
            <Switch checked={archived} onCheckedChange={setArchived} aria-label="أرشفة الفئة" />
          </div>
        )}
      </FormShell>
    </SheetShell>
  );
}
