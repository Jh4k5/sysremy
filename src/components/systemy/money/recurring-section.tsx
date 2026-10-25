"use client";

/**
 * Systemy v2 — قسم «الالتزامات المتكررة»
 * قائمة بحالة الاستحقاق (اليوم/غداً/بعد X/متأخر) + «سدد الآن» بضغطة
 * (مع اختيار حساب إن لم يحدد) + إيقاف مؤقت + CRUD كامل.
 */

import { useMemo, useState } from "react";
import { Pencil, Plus, Repeat, Trash2 } from "lucide-react";
import { toast } from "sonner";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Switch } from "@/components/ui/switch";
import { addRecurring, deleteRecurring, payRecurring, updateRecurring } from "@/lib/actions";
import { diffDays, formatMoney, formatNumber, relativeDay, todayISO } from "@/lib/format";
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
} from "@/components/systemy/ui-bits";
import { IconBubble, SheetShell, type MoneyData } from "./money-screen";
import type { CommitmentFrequency, Recurring, RecurringType } from "@/lib/types";
import { cn } from "@/lib/utils";

/* ═══════════════════════ خرائط وثوابت ═══════════════════════ */

const FREQ_LABELS: Record<CommitmentFrequency, string> = {
  daily: "يومي",
  weekly: "أسبوعي",
  monthly: "شهري",
  yearly: "سنوي",
};

const FREQ_OPTIONS = (Object.keys(FREQ_LABELS) as CommitmentFrequency[]).map((k) => ({
  k,
  v: FREQ_LABELS[k],
}));

const TYPE_OPTIONS: Array<{ k: string; v: string }> = [
  { k: "expense", v: "مصروف" },
  { k: "income", v: "دخل" },
];

const REMINDER_OPTIONS: Array<{ k: string; v: string }> = [
  { k: "0", v: "يوم الاستحقاق" },
  { k: "1", v: "قبل يوم" },
  { k: "2", v: "قبل يومين" },
  { k: "3", v: "قبل 3 أيام" },
];

/** شريحة حالة الاستحقاق */
function dueBadge(nextDate: string, today: string): { text: string; cls: string } {
  const d = diffDays(today, nextDate);
  if (d < 0) return { text: `متأخر ${formatNumber(Math.abs(d))} ${Math.abs(d) === 1 ? "يوم" : "أيام"}`, cls: "bg-[#FF8E7A]/15 text-coral" };
  if (d === 0) return { text: "يستحق اليوم", cls: "bg-[#FF8E7A]/15 text-coral" };
  if (d === 1) return { text: "غداً", cls: "bg-[#F5B95C]/15 text-gold" };
  if (d <= 7) return { text: `بعد ${formatNumber(d)} أيام`, cls: "bg-black/[0.04] text-muted-foreground" };
  return { text: relativeDay(nextDate), cls: "bg-black/[0.04] text-muted-foreground" };
}

/* ═══════════════════════ القسم ═══════════════════════ */

export function RecurringSection({ data }: { data: MoneyData }) {
  const { settings, accounts, categories, recurrings } = data;
  const cur = settings.currency || "ر.س";
  const today = todayISO();
  const [editing, setEditing] = useState<Recurring | "new" | null>(null);
  const [payingId, setPayingId] = useState<string | null>(null);

  const activeAccounts = useMemo(() => accounts.filter((a) => !a.archived), [accounts]);
  const sorted = useMemo(
    () => [...recurrings].sort((a, b) => (a.active === b.active ? a.nextDate.localeCompare(b.nextDate) : a.active ? -1 : 1)),
    [recurrings],
  );

  /** سداد فوري أو فتح اختيار الحساب */
  const handlePay = (r: Recurring) => {
    if (r.accountId) {
      void payRecurring(r.id);
      return;
    }
    setPayingId(payingId === r.id ? null : r.id);
  };

  const monthlyTotal = sorted
    .filter((r) => r.active && r.type === "expense")
    .reduce((s, r) => s + r.amount / (r.frequency === "daily" ? 30 : r.frequency === "weekly" ? 4.33 : r.frequency === "yearly" ? 1 / 12 : 1), 0);

  return (
    <div>
      {/* ═══ رأس القسم ═══ */}
      <div className="flex items-center justify-between px-1 mb-2.5">
        <div className="flex items-center gap-2 text-[13px] font-semibold text-foreground/90">
          <Repeat className="w-4 h-4 text-primary" aria-hidden="true" />
          <span>الالتزامات المتكررة</span>
          <Chip className="text-muted-foreground tabular">{formatNumber(sorted.length)}</Chip>
        </div>
        <button
          onClick={() => setEditing("new")}
          aria-label="إضافة التزام متكرر"
          className="h-11 px-4 rounded-2xl bg-primary/15 border border-primary/30 text-primary text-[12px] font-bold flex items-center gap-1.5 hover:bg-primary/25 transition-colors"
        >
          <Plus className="w-4 h-4" aria-hidden="true" />
          التزام
        </button>
      </div>

      {recurrings.length === 0 ? (
        <GlassCard className="p-2">
          <EmptyState
            icon={<Repeat className="w-6 h-6" />}
            title="لا التزامات متكررة"
            hint="الإيجار، الاشتراكات، الراتب… سجّلها مرة وسيذكّرك Systemy قبل استحقاقها ويُسددها بضغطة"
            actionLabel="أضف التزاماً"
            onAction={() => setEditing("new")}
          />
        </GlassCard>
      ) : (
        <div className="space-y-3">
          {monthlyTotal > 0 && (
            <GlassCard className="p-4 flex items-center justify-between">
              <div>
                <p className="text-[11.5px] text-muted-foreground">إجمالي الالتزامات الشهرية النشطة</p>
                <p className="text-[10.5px] text-muted-foreground/70 mt-0.5">يُقتطع من الرصيد الآمن تلقائياً</p>
              </div>
              <PrivateAmount className="num-display text-[22px] tabular">
                {formatMoney(Math.round(monthlyTotal), cur)}
              </PrivateAmount>
            </GlassCard>
          )}

          <div className="space-y-2">
            {sorted.map((r) => {
              const badge = dueBadge(r.nextDate, today);
              return (
                <GlassCard key={r.id} className={cn("p-4", !r.active && "opacity-55")}>
                  <div className="flex items-center gap-3">
                    <IconBubble
                      icon={r.icon}
                      color={r.type === "income" ? "#6EE7A8" : "#F5B95C"}
                      className="w-11 h-11"
                      iconClassName="w-5 h-5"
                    />
                    <div className="flex-1 min-w-0">
                      <div className="flex items-center gap-2">
                        <span className="text-[13.5px] font-semibold truncate">{r.name}</span>
                        {r.active && <span className={cn("text-[9.5px] font-bold rounded-full px-2 py-0.5 shrink-0", badge.cls)}>{badge.text}</span>}
                      </div>
                      <span className="text-[10.5px] text-muted-foreground block mt-0.5">
                        {FREQ_LABELS[r.frequency]} · {r.type === "income" ? "دخل" : "مصروف"}
                        {r.type === "expense" && r.essential ? " · أساسي" : ""}
                      </span>
                    </div>
                    <div className="flex flex-col items-end gap-1 shrink-0">
                      <PrivateAmount
                        className={cn("text-[14.5px] font-bold tabular", r.type === "income" && "text-mint")}
                      >
                        {formatMoney(r.amount, cur)}
                      </PrivateAmount>
                      <div className="flex items-center gap-1">
                        <button
                          onClick={() => setEditing(r)}
                          aria-label={`تعديل ${r.name}`}
                          className="w-9 h-9 rounded-xl glass-soft flex items-center justify-center text-muted-foreground hover:text-foreground transition-colors"
                        >
                          <Pencil className="w-3.5 h-3.5" aria-hidden="true" />
                        </button>
                        <Switch
                          checked={r.active}
                          onCheckedChange={(v) => void updateRecurring(r.id, { active: v })}
                          aria-label={`${r.active ? "إيقاف" : "تفعيل"} ${r.name}`}
                        />
                      </div>
                    </div>
                  </div>

                  {r.active && (
                    <div className="mt-3 flex items-center gap-2">
                      <button
                        onClick={() => handlePay(r)}
                        className={cn(
                          "flex-1 h-11 rounded-xl border text-[12px] font-bold transition-colors",
                          r.type === "income"
                            ? "bg-mint/10 border-mint/30 text-mint hover:bg-mint/20"
                            : "bg-primary/15 border-primary/30 text-primary hover:bg-primary/25"
                        )}
                      >
                        {r.type === "income" ? "استلم الآن" : "سدد الآن"}
                      </button>
                    </div>
                  )}

                  {payingId === r.id && (
                    <div className="mt-2.5 flex items-center gap-2 overflow-x-auto no-scrollbar" role="group" aria-label="اختر حساب السداد">
                      {activeAccounts.length === 0 ? (
                        <span className="text-[10.5px] text-muted-foreground">أضف حساباً أولاً — أو حدد الحساب من تعديل الالتزام</span>
                      ) : (
                        <>
                          <span className="text-[10.5px] text-muted-foreground shrink-0">من حساب:</span>
                          {activeAccounts.map((a) => (
                            <button
                              key={a.id}
                              onClick={() => {
                                setPayingId(null);
                                void payRecurring(r.id, { accountId: a.id });
                              }}
                              className="h-11 px-3 rounded-xl glass-soft border border-black/[0.07] flex items-center gap-1.5 shrink-0 hover:bg-black/[0.04] transition-colors"
                            >
                              <span className="w-2 h-2 rounded-full" style={{ background: a.color }} aria-hidden="true" />
                              <span className="text-[11.5px] font-medium">{a.name}</span>
                            </button>
                          ))}
                        </>
                      )}
                    </div>
                  )}
                </GlassCard>
              );
            })}
          </div>
        </div>
      )}

      {/* ═══ ورقة CRUD ═══ */}
      {editing && <RecurringSheet editing={editing} data={data} onClose={() => setEditing(null)} />}
    </div>
  );
}

/* ═══════════════════════ ورقة إضافة/تعديل التزام ═══════════════════════ */

function RecurringSheet({ editing, data, onClose }: { editing: Recurring | "new"; data: MoneyData; onClose: () => void }) {
  const isNew = editing === "new";
  const rec = isNew ? null : editing;
  const { settings, accounts, categories } = data;
  const cur = settings.currency || "ر.س";
  const digits = settings.digits ?? "latn";

  const [name, setName] = useState(rec?.name ?? "");
  const [amount, setAmount] = useState(rec ? String(rec.amount) : "");
  const [type, setType] = useState<RecurringType>(rec?.type ?? "expense");
  const [frequency, setFrequency] = useState<CommitmentFrequency>(rec?.frequency ?? "monthly");
  const [nextDate, setNextDate] = useState(rec?.nextDate ?? todayISO());
  const [categoryId, setCategoryId] = useState(rec?.categoryId ?? "none");
  const [accountId, setAccountId] = useState(rec?.accountId ?? "none");
  const [reminderDays, setReminderDays] = useState(String(rec?.reminderDays ?? 2));
  const [icon, setIcon] = useState(rec?.icon ?? "calendar-days");
  const [busy, setBusy] = useState(false);
  const [confirming, setConfirming] = useState(false);

  const liveCategories = categories.filter((c) => !c.archived && c.kind === type);
  const activeAccounts = accounts.filter((a) => !a.archived);

  const save = async () => {
    if (!name.trim()) {
      toast.error("سمّ الالتزام أولاً");
      return;
    }
    const value = Number(amount);
    if (!(value > 0)) {
      toast.error("أدخل مبلغاً صحيحاً أكبر من صفر");
      return;
    }
    if (!nextDate) {
      toast.error("اختر تاريخ الاستحقاق القادم");
      return;
    }
    setBusy(true);
    const payload = {
      name: name.trim(),
      amount: value,
      type,
      frequency,
      nextDate,
      icon,
      categoryId: categoryId === "none" ? undefined : categoryId,
      accountId: accountId === "none" ? undefined : accountId,
      active: rec ? rec.active : true,
      reminderDays: Number(reminderDays),
      essential: rec?.essential ?? false,
    };
    if (rec) await updateRecurring(rec.id, payload);
    else await addRecurring(payload);
    setBusy(false);
    onClose();
  };

  const del = async () => {
    if (!rec) return;
    setBusy(true);
    await deleteRecurring(rec.id);
    setBusy(false);
    onClose();
  };

  return (
    <SheetShell
      title={isNew ? "التزام متكرر جديد" : `تعديل ${rec?.name ?? ""}`}
      desc={rec ? `${FREQ_LABELS[rec.frequency]} · يستحق ${relativeDay(rec.nextDate)}` : "سيُنشئ معاملة مرتبطة عند كل سداد ويقدّم الاستحقاق تلقائياً"}
      onClose={onClose}
    >
      <FormShell
        onSave={() => void save()}
        busy={busy}
        saveLabel={isNew ? "إضافة الالتزام" : "حفظ التعديلات"}
        extra={
          !isNew &&
          (confirming ? (
            <ConfirmBar
              message={`حذف «${rec?.name}» وتذكيراته؟ المعاملات المسجلة سابقاً تبقى كما هي.`}
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
              حذف الالتزام
            </button>
          ))
        }
      >
        <Field label="الاسم">
          <input
            value={name}
            onChange={(e) => setName(e.target.value)}
            placeholder="إيجار الشقة، نتفلكس…"
            className={inputCls}
          />
        </Field>

        <ChipRow
          label="النوع"
          options={TYPE_OPTIONS}
          value={type}
          onSelect={(k) => {
            setType(k as RecurringType);
            setCategoryId("none");
          }}
        />

        <Field label="المبلغ">
          <div className="glass-soft rounded-2xl p-4 flex flex-col items-center gap-1">
            <div className="num-display text-[32px] text-primary tabular" aria-live="polite">
              {displayAmount(amount, digits) || "0"}
            </div>
            <span className="text-[12px] text-muted-foreground">{cur}</span>
          </div>
          <NumberPad value={amount} onChange={setAmount} digits={digits} className="mt-3" label="لوحة مبلغ الالتزام" />
        </Field>

        <ChipRow
          label="التكرار"
          options={FREQ_OPTIONS}
          value={frequency}
          onSelect={(k) => setFrequency(k as CommitmentFrequency)}
        />

        <div className="grid grid-cols-2 gap-3">
          <Field label="الاستحقاق القادم">
            <input
              type="date"
              value={nextDate}
              onChange={(e) => setNextDate(e.target.value)}
              className={cn(inputCls, "[color-scheme:dark]")}
              aria-label="تاريخ الاستحقاق القادم"
            />
          </Field>
          <Field label="تذكير قبل">
            <ChipRow
              label="التذكير"
              options={REMINDER_OPTIONS}
              value={reminderDays}
              onSelect={setReminderDays}
              small
            />
          </Field>
        </div>

        <Field label="الفئة">
          <Select value={categoryId} onValueChange={setCategoryId}>
            <SelectTrigger className="h-12 rounded-xl w-full" aria-label="فئة الالتزام">
              <SelectValue placeholder="اختر فئة" />
            </SelectTrigger>
            <SelectContent className="max-h-64">
              <SelectItem value="none">بدون فئة</SelectItem>
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
        </Field>

        <Field label="الحساب" hint="الحساب الذي يُسجَّل عليه السداد تلقائياً — أو اختره كل مرة">
          <Select value={accountId} onValueChange={setAccountId}>
            <SelectTrigger className="h-12 rounded-xl w-full" aria-label="حساب الالتزام">
              <SelectValue placeholder="اسألني كل مرة" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="none">اسألني كل مرة</SelectItem>
              {activeAccounts.map((a) => (
                <SelectItem key={a.id} value={a.id}>{a.name}</SelectItem>
              ))}
            </SelectContent>
          </Select>
        </Field>

        <Field label="الأيقونة">
          <IconGrid
            value={icon}
            onChange={setIcon}
            choices={["calendar-days", "receipt", "home", "car-front", "smartphone", "credit-card", "zap", "heart-pulse", "graduation-cap", "dumbbell", "coffee", "briefcase"]}
          />
        </Field>
      </FormShell>
    </SheetShell>
  );
}
