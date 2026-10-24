"use client";

/**
 * Systemy v2 — قسم «الحسابات»
 * أرصدة مشتقة لحظياً (accountBalance) + إجمالي + CRUD كامل
 * (اسم/نوع/أيقونة/لون/رصيد افتتاحي) مع أرشفة تلقائية عند وجود معاملات.
 */

import { useMemo, useState } from "react";
import { Plus, Wallet } from "lucide-react";
import { toast } from "sonner";
import { addAccount, deleteAccount, updateAccount } from "@/lib/actions";
import { accountBalances } from "@/lib/money";
import { formatMoney, formatNumber } from "@/lib/format";
import { useUIStore } from "@/store/ui-store";
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
import type { Account, AccountType } from "@/lib/types";
import { cn } from "@/lib/utils";

/* ═══════════════════════ خرائط وثوابت ═══════════════════════ */

const ACC_TYPE_LABELS: Record<AccountType, string> = {
  cash: "نقد",
  bank: "بنك",
  wallet: "محفظة",
  credit: "بطاقة",
  savings: "ادخار",
};

const ACC_TYPE_OPTIONS = (Object.keys(ACC_TYPE_LABELS) as AccountType[]).map((k) => ({
  k,
  v: ACC_TYPE_LABELS[k],
}));

const ACC_TYPE_ICON: Record<AccountType, string> = {
  cash: "banknote",
  bank: "landmark",
  wallet: "wallet",
  credit: "credit-card",
  savings: "piggy-bank",
};

/* ═══════════════════════ القسم ═══════════════════════ */

export function AccountsSection({ data }: { data: MoneyData }) {
  const openQuickAdd = useUIStore((s) => s.openQuickAdd);
  const { settings, accounts, txs } = data;
  const cur = settings.currency || "ر.س";
  const [editing, setEditing] = useState<Account | "new" | null>(null);

  const balances = useMemo(() => accountBalances(accounts, txs), [accounts, txs]);
  const total = useMemo(
    () => accounts.filter((a) => !a.archived).reduce((s, a) => s + (balances.get(a.id) ?? 0), 0),
    [accounts, balances],
  );

  const live = accounts.filter((a) => !a.archived);
  const archived = accounts.filter((a) => a.archived);

  return (
    <div>
      {/* ═══ رأس القسم ═══ */}
      <div className="flex items-center justify-between px-1 mb-2.5">
        <div className="flex items-center gap-2 text-[13px] font-semibold text-foreground/90">
          <Wallet className="w-4 h-4 text-primary" aria-hidden="true" />
          <span>الحسابات</span>
          <Chip className="text-muted-foreground tabular">{formatNumber(live.length)}</Chip>
        </div>
        <button
          onClick={() => setEditing("new")}
          aria-label="إضافة حساب جديد"
          className="h-11 px-4 rounded-2xl bg-primary/15 border border-primary/30 text-primary text-[12px] font-bold flex items-center gap-1.5 hover:bg-primary/25 transition-colors"
        >
          <Plus className="w-4 h-4" aria-hidden="true" />
          حساب
        </button>
      </div>

      {accounts.length === 0 ? (
        <GlassCard className="p-2">
          <EmptyState
            icon={<Wallet className="w-6 h-6" />}
            title="لا حسابات بعد"
            hint="نقد، بنك، محفظة، بطاقة أو ادخار — الرصيد الحالي يُشتق من معاملاتك تلقائياً"
            actionLabel="أضف حسابك الأول"
            onAction={() => openQuickAdd("account")}
          />
        </GlassCard>
      ) : (
        <div className="space-y-3">
          {/* ═══ الإجمالي ═══ */}
          <GlassCard className="p-4 flex items-center justify-between">
            <div>
              <p className="text-[11.5px] text-muted-foreground">إجمالي الحسابات النشطة</p>
              <p className="text-[10.5px] text-muted-foreground/70 mt-0.5">الرصيد مشتق من المعاملات — يتحدث فوراً</p>
            </div>
            <PrivateAmount
              className={cn("num-display text-[24px] tabular", total < 0 && "text-coral")}
            >
              {formatMoney(total, cur)}
            </PrivateAmount>
          </GlassCard>

          {/* ═══ الحسابات النشطة ═══ */}
          <div className="space-y-2">
            {live.map((a) => (
              <GlassCard key={a.id} interactive onClick={() => setEditing(a)} className="p-4">
                <div className="flex items-center gap-3">
                  <IconBubble icon={a.icon} color={a.color} className="w-11 h-11" iconClassName="w-5 h-5" />
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-2">
                      <span className="text-[14px] font-semibold truncate">{a.name}</span>
                      <Chip className="text-muted-foreground shrink-0">{ACC_TYPE_LABELS[a.type]}</Chip>
                    </div>
                    <span className="text-[10.5px] text-muted-foreground block mt-0.5 tabular">
                      افتتاحي {formatMoney(a.startingBalance, cur)}
                    </span>
                  </div>
                  <PrivateAmount
                    className={cn("text-[17px] font-bold tabular shrink-0", (balances.get(a.id) ?? 0) < 0 && "text-coral")}
                  >
                    {formatMoney(balances.get(a.id) ?? 0, cur)}
                  </PrivateAmount>
                </div>
              </GlassCard>
            ))}
          </div>

          {/* ═══ المؤرشفة ═══ */}
          {archived.length > 0 && (
            <div>
              <p className="text-[11px] text-muted-foreground px-1 mb-2">مؤرشفة — في السجل فقط</p>
              <div className="space-y-2 opacity-60">
                {archived.map((a) => (
                  <GlassCard key={a.id} interactive onClick={() => setEditing(a)} className="p-3.5">
                    <div className="flex items-center gap-3">
                      <IconBubble icon={a.icon} color={a.color} className="w-9 h-9" iconClassName="w-4 h-4" />
                      <div className="flex-1 min-w-0">
                        <span className="text-[13px] font-semibold truncate">{a.name}</span>
                        <span className="text-[10px] text-muted-foreground block">
                          {ACC_TYPE_LABELS[a.type]} · مؤرشف
                        </span>
                      </div>
                      <PrivateAmount className="text-[13.5px] font-bold tabular shrink-0">
                        {formatMoney(balances.get(a.id) ?? 0, cur)}
                      </PrivateAmount>
                    </div>
                  </GlassCard>
                ))}
              </div>
            </div>
          )}
        </div>
      )}

      {/* ═══ ورقة CRUD ═══ */}
      {editing && (
        <AccountSheet
          editing={editing}
          data={data}
          balances={balances}
          onClose={() => setEditing(null)}
        />
      )}
    </div>
  );
}

/* ═══════════════════════ ورقة إضافة/تعديل حساب ═══════════════════════ */

function AccountSheet({
  editing,
  data,
  balances,
  onClose,
}: {
  editing: Account | "new";
  data: MoneyData;
  balances: Map<string, number>;
  onClose: () => void;
}) {
  const isNew = editing === "new";
  const acc = isNew ? null : editing;
  const { settings, accounts, txs } = data;
  const cur = settings.currency || "ر.س";
  const digits = settings.digits ?? "latn";

  const [name, setName] = useState(acc?.name ?? "");
  const [type, setType] = useState<AccountType>(acc?.type ?? "cash");
  const [icon, setIcon] = useState(acc?.icon ?? ACC_TYPE_ICON[acc?.type ?? "cash"]);
  const [color, setColor] = useState(acc?.color ?? "#F5B95C");
  const [starting, setStarting] = useState(acc ? String(acc.startingBalance) : "0");
  const [busy, setBusy] = useState(false);
  const [confirming, setConfirming] = useState(false);

  const txCount = acc
    ? txs.filter((t) => t.accountId === acc.id || t.toAccountId === acc.id).length
    : 0;

  const save = async () => {
    if (!name.trim()) {
      toast.error("سمّ الحساب أولاً");
      return;
    }
    const startingBalance = Number(starting) || 0;
    setBusy(true);
    if (acc) {
      await updateAccount(acc.id, { name: name.trim(), type, icon, color, startingBalance });
    } else {
      const order = Math.max(0, ...accounts.map((a) => a.order)) + 1;
      await addAccount({
        name: name.trim(),
        type,
        icon,
        color,
        startingBalance,
        archived: false,
        order,
      });
    }
    setBusy(false);
    onClose();
  };

  const del = async () => {
    if (!acc) return;
    setBusy(true);
    await deleteAccount(acc.id);
    setBusy(false);
    onClose();
  };

  return (
    <SheetShell
      title={isNew ? "حساب جديد" : `تعديل ${acc?.name ?? ""}`}
      desc={acc ? `الرصيد الحالي ${formatMoney(balances.get(acc.id) ?? 0, cur)}` : "الرصيد يُشتق من معاملاته تلقائياً"}
      onClose={onClose}
    >
      <FormShell
        onSave={() => void save()}
        busy={busy}
        saveLabel={isNew ? "إضافة الحساب" : "حفظ التعديلات"}
        extra={
          !isNew &&
          (confirming ? (
            <ConfirmBar
              message={
                txCount > 0
                  ? `لهذا الحساب ${formatNumber(txCount)} معاملة مرتبطة — سيُرشَف الحساب وتبقى معاملاته في السجل.`
                  : "سيُحذف الحساب نهائياً. هذا الإجراء لا يمكن التراجع عنه."
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
              حذف الحساب
            </button>
          ))
        }
      >
        <Field label="اسم الحساب">
          <input
            value={name}
            onChange={(e) => setName(e.target.value)}
            placeholder="نقد، الراجحي، STC Pay…"
            className={inputCls}
          />
        </Field>

        <ChipRow
          label="النوع"
          options={ACC_TYPE_OPTIONS}
          value={type}
          onSelect={(k) => {
            setType(k as AccountType);
            if (isNew) setIcon(ACC_TYPE_ICON[k as AccountType]);
          }}
        />

        <Field label="الرصيد الافتتاحي" hint="ما كان فيه عند بداية استخدامه — الباقي يُحسب من المعاملات">
          <div className="glass-soft rounded-2xl p-4 flex flex-col items-center gap-1">
            <div className="num-display text-[32px] text-primary tabular" aria-live="polite">
              {displayAmount(starting, digits)}
            </div>
            <span className="text-[12px] text-muted-foreground">{cur}</span>
          </div>
          <NumberPad value={starting} onChange={setStarting} digits={digits} className="mt-3" label="لوحة الرصيد الافتتاحي" />
        </Field>

        <Field label="الأيقونة">
          <IconGrid
            value={icon}
            onChange={setIcon}
            choices={["wallet", "banknote", "landmark", "credit-card", "piggy-bank", "smartphone", "briefcase", "store", "home", "target", "star", "receipt"]}
          />
        </Field>

        <Field label="اللون">
          <ColorSwatches value={color} onChange={setColor} />
        </Field>
      </FormShell>
    </SheetShell>
  );
}
