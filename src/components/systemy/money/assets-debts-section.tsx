"use client";

/**
 * Systemy v2 — قسم «الأصول والديون»
 * الأصول (اسم/نوع/قيمة + إجمالي) والديون (عليك/لك) مع تسخين
 * «سدد/استلم» بمعاملة مرتبطة بحساب اختياري + تواريخ استحقاق + CRUD كامل.
 */

import { useMemo, useState } from "react";
import { Gem, HandCoins, Landmark, Pencil, Plus, Trash2, Users } from "lucide-react";
import { toast } from "sonner";
import {
  addAsset,
  addDebt,
  deleteAsset,
  deleteDebt,
  receiveDebt,
  settleDebt,
  updateAsset,
  updateDebt,
} from "@/lib/actions";
import { formatMoney, formatNumber, relativeDay } from "@/lib/format";
import { Chip, GlassCard, PrivateAmount } from "@/components/systemy/glass";
import {
  ChipRow,
  ConfirmBar,
  EmptyState,
  Field,
  FormShell,
  IconGrid,
  NumberPad,
  displayAmount,
  inputCls,
  textareaCls,
} from "@/components/systemy/ui-bits";
import { IconBubble, SheetShell, type MoneyData } from "./money-screen";
import type { Asset, Debt } from "@/lib/types";
import { cn } from "@/lib/utils";

/* ═══════════════════════ ثوابت ═══════════════════════ */

const ASSET_TYPE_OPTIONS: Array<{ k: string; v: string }> = [
  { k: "سيارة", v: "سيارة" },
  { k: "ذهب", v: "ذهب" },
  { k: "عقار", v: "عقار" },
  { k: "استثمار", v: "استثمار" },
  { k: "أخرى", v: "أخرى" },
];

const DIRECTION_OPTIONS: Array<{ k: string; v: string }> = [
  { k: "payable", v: "عليّ (أدين به)" },
  { k: "receivable", v: "لي (يدين لي)" },
];

/* ═══════════════════════ القسم ═══════════════════════ */

export function AssetsDebtsSection({ data }: { data: MoneyData }) {
  const { settings, accounts, assets, debts } = data;
  const cur = settings.currency || "ر.س";

  const [assetEditing, setAssetEditing] = useState<Asset | "new" | null>(null);
  const [debtEditing, setDebtEditing] = useState<Debt | "new" | null>(null);
  const [settling, setSettling] = useState<Debt | null>(null);

  const activeAccounts = useMemo(() => accounts.filter((a) => !a.archived), [accounts]);
  const payables = debts.filter((d) => d.direction === "payable");
  const receivables = debts.filter((d) => d.direction === "receivable");
  const owed = payables.reduce((s, d) => s + Math.max(0, d.amount - d.paid), 0);
  const dueToMe = receivables.reduce((s, d) => s + Math.max(0, d.amount - d.paid), 0);
  const assetsTotal = assets.reduce((s, a) => s + a.value, 0);

  const renderDebt = (d: Debt) => {
    const remaining = Math.max(0, d.amount - d.paid);
    const pct = d.amount > 0 ? Math.min(100, Math.round((d.paid / d.amount) * 100)) : 0;
    const done = remaining === 0;
    return (
      <div key={d.id} className="px-4 py-3 border-t border-white/[0.04] first:border-t-0">
        <div className="flex items-center gap-3 min-h-11">
          <span
            className={cn(
              "w-10 h-10 rounded-2xl flex items-center justify-center text-[14px] font-bold shrink-0",
              d.direction === "payable" ? "bg-[#FF8E7A]/12 text-coral" : "bg-[#5CE1E6]/12 text-cyan"
            )}
            aria-hidden="true"
          >
            {(d.person || d.name || "؟").trim().charAt(0)}
          </span>
          <div className="flex-1 min-w-0">
            <div className="flex items-center gap-2">
              <span className="text-[13px] font-semibold truncate">{d.person || d.name}</span>
              {d.dueDate && !done && (
                <Chip className={cn("shrink-0", isOverdue(d) ? "text-coral" : "text-muted-foreground")}>
                  {relativeDay(d.dueDate)}
                </Chip>
              )}
              {done && <Chip className="text-mint shrink-0">مسدد ✓</Chip>}
            </div>
            <span className="text-[10.5px] text-muted-foreground block truncate mt-0.5">
              {d.name} · {d.direction === "payable" ? "عليك" : "لك"}
            </span>
          </div>
          <div className="flex flex-col items-end shrink-0">
            <PrivateAmount className={cn("text-[13.5px] font-bold tabular", d.direction === "payable" && "text-coral")}>
              {formatMoney(remaining, cur)}
            </PrivateAmount>
            {!done && (
              <button
                onClick={() => setSettling(d)}
                className={cn(
                  "mt-1 h-9 px-3 rounded-lg border text-[10.5px] font-bold transition-colors",
                  d.direction === "payable"
                    ? "bg-primary/15 border-primary/30 text-primary hover:bg-primary/25"
                    : "bg-mint/10 border-mint/30 text-mint hover:bg-mint/20"
                )}
              >
                {d.direction === "payable" ? "سدد" : "استلم"}
              </button>
            )}
          </div>
        </div>
        {/* شريط التقدم */}
        <div className="mt-2 flex items-center gap-2">
          <div className="flex-1 h-1.5 rounded-full bg-white/[0.05] overflow-hidden">
            <div
              className="h-full rounded-full"
              style={{ width: `${pct}%`, background: d.direction === "payable" ? "#FF8E7A" : "#5CE1E6" }}
            />
          </div>
          <button
            onClick={() => setDebtEditing(d)}
            aria-label={`تعديل دين ${d.person}`}
            className="w-9 h-9 rounded-xl glass-soft flex items-center justify-center text-muted-foreground hover:text-foreground transition-colors shrink-0"
          >
            <Pencil className="w-3.5 h-3.5" aria-hidden="true" />
          </button>
        </div>
      </div>
    );
  };

  return (
    <div className="space-y-4">
      {/* ═══ ملخص: ما لك وما عليك ═══ */}
      <GlassCard className="p-4">
        <div className="grid grid-cols-3 gap-2 text-center">
          <div>
            <p className="text-[10.5px] text-muted-foreground flex items-center justify-center gap-1">
              <Landmark className="w-3 h-3" aria-hidden="true" />
              أصولك
            </p>
            <PrivateAmount className="block text-[15px] font-bold tabular text-mint mt-1">{formatMoney(assetsTotal, cur)}</PrivateAmount>
          </div>
          <div>
            <p className="text-[10.5px] text-muted-foreground flex items-center justify-center gap-1">
              <HandCoins className="w-3 h-3" aria-hidden="true" />
              ما لك
            </p>
            <PrivateAmount className="block text-[15px] font-bold tabular text-cyan mt-1">{formatMoney(dueToMe, cur)}</PrivateAmount>
          </div>
          <div>
            <p className="text-[10.5px] text-muted-foreground flex items-center justify-center gap-1">
              <Users className="w-3 h-3" aria-hidden="true" />
              ما عليك
            </p>
            <PrivateAmount className="block text-[15px] font-bold tabular text-coral mt-1">{formatMoney(owed, cur)}</PrivateAmount>
          </div>
        </div>
      </GlassCard>

      {/* ═══ الأصول ═══ */}
      <section aria-label="الأصول">
        <div className="flex items-center justify-between px-1 mb-2.5">
          <div className="flex items-center gap-2 text-[13px] font-semibold text-foreground/90">
            <Gem className="w-4 h-4 text-primary" aria-hidden="true" />
            <span>الأصول</span>
            <Chip className="text-muted-foreground tabular">{formatNumber(assets.length)}</Chip>
          </div>
          <button
            onClick={() => setAssetEditing("new")}
            aria-label="إضافة أصل"
            className="h-11 px-4 rounded-2xl bg-primary/15 border border-primary/30 text-primary text-[12px] font-bold flex items-center gap-1.5 hover:bg-primary/25 transition-colors"
          >
            <Plus className="w-4 h-4" aria-hidden="true" />
            أصل
          </button>
        </div>

        {assets.length === 0 ? (
          <GlassCard className="p-2">
            <EmptyState
              icon={<Gem className="w-6 h-6" />}
              title="لا أصول مسجلة"
              hint="سيارة، ذهب، عقار، استثمار — تُحسب في صافي ثروتك"
              actionLabel="أضف أصلاً"
              onAction={() => setAssetEditing("new")}
              compact
            />
          </GlassCard>
        ) : (
          <GlassCard className="overflow-hidden">
            {assets.map((a) => (
              <div
                key={a.id}
                role="button"
                tabIndex={0}
                aria-label={`تعديل الأصل: ${a.name}`}
                onClick={() => setAssetEditing(a)}
                onKeyDown={(e) => {
                  if (e.key === "Enter" || e.key === " ") {
                    e.preventDefault();
                    setAssetEditing(a);
                  }
                }}
                className="flex items-center gap-3 px-4 py-3 min-h-[60px] cursor-pointer hover:bg-white/[0.03] transition-colors border-t border-white/[0.04] first:border-t-0"
              >
                <IconBubble icon={a.icon} color="#6EE7A8" className="w-10 h-10" iconClassName="w-[18px] h-[18px]" />
                <div className="flex-1 min-w-0">
                  <span className="text-[13px] font-semibold truncate block">{a.name}</span>
                  <span className="text-[10.5px] text-muted-foreground block mt-0.5 truncate">
                    {a.type}
                    {a.unit ? ` · ${a.unit}` : ""}
                  </span>
                </div>
                <PrivateAmount className="text-[14px] font-bold tabular text-mint shrink-0">
                  {formatMoney(a.value, cur)}
                </PrivateAmount>
              </div>
            ))}
            <div className="px-4 py-2.5 border-t border-white/[0.06] flex items-center justify-between bg-white/[0.02]">
              <span className="text-[11px] text-muted-foreground">إجمالي الأصول</span>
              <PrivateAmount className="text-[13.5px] font-bold tabular text-mint">
                {formatMoney(assetsTotal, cur)}
              </PrivateAmount>
            </div>
          </GlassCard>
        )}
      </section>

      {/* ═══ الديون ═══ */}
      <section aria-label="الديون">
        <div className="flex items-center justify-between px-1 mb-2.5">
          <div className="flex items-center gap-2 text-[13px] font-semibold text-foreground/90">
            <HandCoins className="w-4 h-4 text-primary" aria-hidden="true" />
            <span>الديون</span>
            <Chip className="text-muted-foreground tabular">{formatNumber(debts.length)}</Chip>
          </div>
          <button
            onClick={() => setDebtEditing("new")}
            aria-label="إضافة دين"
            className="h-11 px-4 rounded-2xl bg-primary/15 border border-primary/30 text-primary text-[12px] font-bold flex items-center gap-1.5 hover:bg-primary/25 transition-colors"
          >
            <Plus className="w-4 h-4" aria-hidden="true" />
            دين
          </button>
        </div>

        {debts.length === 0 ? (
          <GlassCard className="p-2">
            <EmptyState
              icon={<HandCoins className="w-6 h-6" />}
              title="لا ديون مسجلة"
              hint="ما عليك وما لك — مع تواريخ استحقاق تظهر في التنبيهات والمستحق القريب"
              actionLabel="أضف ديناً"
              onAction={() => setDebtEditing("new")}
              compact
            />
          </GlassCard>
        ) : (
          <div className="space-y-3">
            {payables.length > 0 && (
              <GlassCard className="overflow-hidden">
                <div className="px-4 py-2.5 border-b border-white/[0.05] flex items-center justify-between">
                  <span className="text-[12px] font-bold text-foreground/90">عليك — ديون بذمتك</span>
                  <PrivateAmount className="text-[12px] font-bold tabular text-coral">{formatMoney(owed, cur)}</PrivateAmount>
                </div>
                {payables.map(renderDebt)}
              </GlassCard>
            )}
            {receivables.length > 0 && (
              <GlassCard className="overflow-hidden">
                <div className="px-4 py-2.5 border-b border-white/[0.05] flex items-center justify-between">
                  <span className="text-[12px] font-bold text-foreground/90">لك — مستحق لك عند الناس</span>
                  <PrivateAmount className="text-[12px] font-bold tabular text-cyan">{formatMoney(dueToMe, cur)}</PrivateAmount>
                </div>
                {receivables.map(renderDebt)}
              </GlassCard>
            )}
          </div>
        )}
      </section>

      {/* ═══ الأوراق ═══ */}
      {assetEditing && <AssetSheet editing={assetEditing} data={data} onClose={() => setAssetEditing(null)} />}
      {debtEditing && <DebtSheet editing={debtEditing} data={data} onClose={() => setDebtEditing(null)} />}
      {settling && (
        <SettleSheet
          debt={settling}
          accounts={activeAccounts}
          cur={cur}
          digits={settings.digits ?? "latn"}
          onClose={() => setSettling(null)}
        />
      )}
    </div>
  );
}

/* ═══════════════════════ أدوات ═══════════════════════ */

function isOverdue(d: Debt): boolean {
  if (!d.dueDate) return false;
  const today = new Date().toISOString().slice(0, 10);
  return d.dueDate < today && d.paid < d.amount;
}

/* ═══════════════════════ ورقة سدد/استلم ═══════════════════════ */

function SettleSheet({
  debt,
  accounts,
  cur,
  digits,
  onClose,
}: {
  debt: Debt;
  accounts: MoneyData["accounts"];
  cur: string;
  digits: "latn" | "arab";
  onClose: () => void;
}) {
  const remaining = Math.max(0, debt.amount - debt.paid);
  const payable = debt.direction === "payable";
  const [amount, setAmount] = useState(String(remaining));
  const [accountId, setAccountId] = useState("none");
  const [busy, setBusy] = useState(false);

  const move = async () => {
    const value = Number(amount);
    if (!(value > 0)) {
      toast.error("أدخل مبلغاً صحيحاً أكبر من صفر");
      return;
    }
    if (value > remaining) {
      toast.error(`المتبقي ${formatMoney(remaining, cur)} فقط`);
      return;
    }
    setBusy(true);
    const acc = accountId === "none" ? undefined : accountId;
    if (payable) await settleDebt(debt.id, value, acc);
    else await receiveDebt(debt.id, value, acc);
    setBusy(false);
    onClose();
  };

  return (
    <SheetShell
      title={payable ? `تسديد لـ ${debt.person || debt.name}` : `استلام من ${debt.person || debt.name}`}
      desc={`المتبقي ${formatMoney(remaining, cur)} من ${formatMoney(debt.amount, cur)}`}
      onClose={onClose}
    >
      <FormShell onSave={() => void move()} busy={busy} saveLabel={payable ? "سجّل التسديد" : "سجّل الاستلام"}>
        <div className="glass-soft rounded-2xl p-4 flex flex-col items-center gap-1">
          <div className="num-display text-[36px] text-primary tabular" aria-live="polite">
            {displayAmount(amount, digits) || "0"}
          </div>
          <span className="text-[12px] text-muted-foreground">{cur}</span>
        </div>
        <NumberPad value={amount} onChange={setAmount} digits={digits} className="mt-3" label="لوحة مبلغ التسديد" />

        <Field
          label="الحساب (اختياري)"
          hint={payable ? "إن اخترته تُسجَّل معاملة مصروف مرتبطة بالشخص" : "إن اخترته تُسجَّل معاملة دخل في الحساب"}
        >
          <div className="flex gap-2 overflow-x-auto no-scrollbar pb-1" role="radiogroup" aria-label="اختيار الحساب">
            <button
              type="button"
              role="radio"
              aria-checked={accountId === "none"}
              onClick={() => setAccountId("none")}
              className={cn(
                "h-11 px-3.5 rounded-xl border text-[12px] font-medium shrink-0 transition-all",
                accountId === "none"
                  ? "bg-primary/20 border-primary/50 text-primary"
                  : "glass-soft border-white/[0.08] text-foreground/75 hover:text-foreground"
              )}
            >
              بدون معاملة
            </button>
            {accounts.map((a) => (
              <button
                key={a.id}
                type="button"
                role="radio"
                aria-checked={accountId === a.id}
                onClick={() => setAccountId(a.id)}
                className={cn(
                  "h-11 px-3.5 rounded-xl border text-[12px] font-medium flex items-center gap-1.5 shrink-0 transition-all",
                  accountId === a.id
                    ? "bg-primary/20 border-primary/50 text-primary"
                    : "glass-soft border-white/[0.08] text-foreground/75 hover:text-foreground"
                )}
              >
                <span className="w-2 h-2 rounded-full" style={{ background: a.color }} aria-hidden="true" />
                {a.name}
              </button>
            ))}
          </div>
        </Field>
      </FormShell>
    </SheetShell>
  );
}

/* ═══════════════════════ ورقة إضافة/تعديل أصل ═══════════════════════ */

function AssetSheet({ editing, data, onClose }: { editing: Asset | "new"; data: MoneyData; onClose: () => void }) {
  const isNew = editing === "new";
  const asset = isNew ? null : editing;
  const { settings } = data;
  const cur = settings.currency || "ر.س";
  const digits = settings.digits ?? "latn";

  const [name, setName] = useState(asset?.name ?? "");
  const [type, setType] = useState(asset?.type ?? "سيارة");
  const [value, setValue] = useState(asset ? String(asset.value) : "");
  const [unit, setUnit] = useState(asset?.unit ?? "");
  const [icon, setIcon] = useState(asset?.icon ?? "package");
  const [note, setNote] = useState(asset?.note ?? "");
  const [busy, setBusy] = useState(false);
  const [confirming, setConfirming] = useState(false);

  const save = async () => {
    if (!name.trim()) {
      toast.error("سمّ الأصل أولاً");
      return;
    }
    const v = Number(value);
    if (!(v > 0)) {
      toast.error("أدخل قيمة صحيحة");
      return;
    }
    setBusy(true);
    const payload = {
      name: name.trim(),
      type: type.trim() || "أخرى",
      value: v,
      unit: unit.trim() || undefined,
      icon,
      note: note.trim() || undefined,
    };
    if (asset) await updateAsset(asset.id, payload);
    else await addAsset(payload);
    setBusy(false);
    onClose();
  };

  const del = async () => {
    if (!asset) return;
    setBusy(true);
    await deleteAsset(asset.id);
    setBusy(false);
    onClose();
  };

  return (
    <SheetShell
      title={isNew ? "أصل جديد" : `تعديل ${asset?.name ?? ""}`}
      desc="قيمته الحالية تُضم إلى صافي ثروتك"
      onClose={onClose}
    >
      <FormShell
        onSave={() => void save()}
        busy={busy}
        saveLabel={isNew ? "إضافة الأصل" : "حفظ التعديلات"}
        extra={
          !isNew &&
          (confirming ? (
            <ConfirmBar
              message={`حذف «${asset?.name}» من الأصول؟ سيُعاد حساب صافي الثروة فوراً.`}
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
              حذف الأصل
            </button>
          ))
        }
      >
        <Field label="اسم الأصل">
          <input
            value={name}
            onChange={(e) => setName(e.target.value)}
            placeholder="كامري 2019، ذهب العيد…"
            className={inputCls}
          />
        </Field>

        <ChipRow label="النوع" options={ASSET_TYPE_OPTIONS} value={type} onSelect={setType} />

        <Field label="القيمة الحالية">
          <div className="glass-soft rounded-2xl p-4 flex flex-col items-center gap-1">
            <div className="num-display text-[32px] text-primary tabular" aria-live="polite">
              {displayAmount(value, digits) || "0"}
            </div>
            <span className="text-[12px] text-muted-foreground">{cur}</span>
          </div>
          <NumberPad value={value} onChange={setValue} digits={digits} className="mt-3" label="لوحة قيمة الأصل" />
        </Field>

        <Field label="الوحدة (اختياري)">
          <input
            value={unit}
            onChange={(e) => setUnit(e.target.value)}
            placeholder="غرام، سهم…"
            className={inputCls}
          />
        </Field>

        <Field label="الأيقونة">
          <IconGrid
            value={icon}
            onChange={setIcon}
            choices={["package", "car-front", "home", "landmark", "briefcase", "trending-up", "wallet", "star", "trophy", "gauge"]}
          />
        </Field>

        <Field label="ملاحظة (اختياري)">
          <textarea
            value={note}
            onChange={(e) => setNote(e.target.value)}
            placeholder="أي تفاصيل…"
            className={textareaCls}
          />
        </Field>
      </FormShell>
    </SheetShell>
  );
}

/* ═══════════════════════ ورقة إضافة/تعديل دين ═══════════════════════ */

function DebtSheet({ editing, data, onClose }: { editing: Debt | "new"; data: MoneyData; onClose: () => void }) {
  const isNew = editing === "new";
  const debt = isNew ? null : editing;
  const { settings } = data;
  const cur = settings.currency || "ر.س";
  const digits = settings.digits ?? "latn";

  const [direction, setDirection] = useState<"payable" | "receivable">(debt?.direction ?? "payable");
  const [person, setPerson] = useState(debt?.person ?? "");
  const [name, setName] = useState(debt?.name ?? "");
  const [amount, setAmount] = useState(debt ? String(debt.amount) : "");
  const [paid, setPaid] = useState(debt ? String(debt.paid) : "0");
  const [dueDate, setDueDate] = useState(debt?.dueDate ?? "");
  const [note, setNote] = useState(debt?.note ?? "");
  const [busy, setBusy] = useState(false);
  const [confirming, setConfirming] = useState(false);

  const save = async () => {
    if (!person.trim()) {
      toast.error("مع من هذا الدين؟");
      return;
    }
    const v = Number(amount);
    if (!(v > 0)) {
      toast.error("أدخل مبلغ الدين");
      return;
    }
    setBusy(true);
    const payload = {
      name: name.trim() || `دين ${person.trim()}`,
      person: person.trim(),
      amount: v,
      paid: Number(paid) || 0,
      direction,
      dueDate: dueDate || undefined,
      note: note.trim() || undefined,
    };
    if (debt) await updateDebt(debt.id, payload);
    else await addDebt(payload);
    setBusy(false);
    onClose();
  };

  const del = async () => {
    if (!debt) return;
    setBusy(true);
    await deleteDebt(debt.id);
    setBusy(false);
    onClose();
  };

  return (
    <SheetShell
      title={isNew ? "دين جديد" : `تعديل دين ${debt?.person ?? ""}`}
      desc={direction === "payable" ? "عليك — يظهر في المستحق والتنبيهات" : "لك — يُضاف إلى صافي ثروتك"}
      onClose={onClose}
    >
      <FormShell
        onSave={() => void save()}
        busy={busy}
        saveLabel={isNew ? "إضافة الدين" : "حفظ التعديلات"}
        extra={
          !isNew &&
          (confirming ? (
            <ConfirmBar
              message={`حذف دين ${debt?.person} نهائياً مع تذكيراته؟`}
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
              حذف الدين
            </button>
          ))
        }
      >
        <ChipRow
          label="الاتجاه"
          options={DIRECTION_OPTIONS}
          value={direction}
          onSelect={(k) => setDirection(k as "payable" | "receivable")}
        />

        <div className="grid grid-cols-2 gap-3">
          <Field label="الشخص">
            <input
              value={person}
              onChange={(e) => setPerson(e.target.value)}
              placeholder="خالد، المؤجر…"
              className={inputCls}
            />
          </Field>
          <Field label="الوصف (اختياري)">
            <input
              value={name}
              onChange={(e) => setName(e.target.value)}
              placeholder="قرض…"
              className={inputCls}
            />
          </Field>
        </div>

        <Field label="المبلغ الكلي">
          <div className="glass-soft rounded-2xl p-4 flex flex-col items-center gap-1">
            <div className="num-display text-[32px] text-primary tabular" aria-live="polite">
              {displayAmount(amount, digits) || "0"}
            </div>
            <span className="text-[12px] text-muted-foreground">{cur}</span>
          </div>
          <NumberPad value={amount} onChange={setAmount} digits={digits} className="mt-3" label="لوحة مبلغ الدين" />
        </Field>

        <div className="grid grid-cols-2 gap-3">
          <Field label="المسدد حتى الآن">
            <input
              value={paid}
              onChange={(e) => setPaid(e.target.value.replace(/[^\d.]/g, ""))}
              inputMode="decimal"
              className={cn(inputCls, "text-center num-display")}
              aria-label="المبلغ المسدد"
            />
          </Field>
          <Field label="تاريخ الاستحقاق">
            <input
              type="date"
              value={dueDate}
              onChange={(e) => setDueDate(e.target.value)}
              className={cn(inputCls, "[color-scheme:dark]")}
              aria-label="تاريخ استحقاق الدين"
            />
          </Field>
        </div>

        <Field label="ملاحظة (اختياري)">
          <textarea
            value={note}
            onChange={(e) => setNote(e.target.value)}
            placeholder="أي تفاصيل…"
            className={textareaCls}
          />
        </Field>
      </FormShell>
    </SheetShell>
  );
}
