"use client";

/**
 * Systemy v3 — التزام منزلي جديد (فاتورة متكررة)
 * اسم + مبلغ + دورية + الاستحقاق القادم + تذكير + حساب اختياري.
 * يُسجَّل بوسم home ليظهر هنا وفي شاشة المال — والسداد ينشئ معاملة ويقدّم الاستحقاق.
 */

import { useState } from "react";
import { toast } from "sonner";
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { addRecurring } from "@/lib/actions";
import { todayISO } from "@/lib/format";
import type { Account, CommitmentFrequency, DigitStyle } from "@/lib/types";
import {
  ChipRow,
  Field,
  FormShell,
  NumberPad,
  displayAmount,
  inputCls,
} from "@/components/systemy/ui-bits";
import { FREQ_LABELS } from "./shared";
import { cn } from "@/lib/utils";

export interface HomeBillFormDialogProps {
  accounts: Account[];
  currency: string;
  digits: DigitStyle;
  onClose: () => void;
}

const FREQ_OPTIONS = (Object.keys(FREQ_LABELS) as CommitmentFrequency[]).map((k) => ({
  k,
  v: FREQ_LABELS[k],
}));

const REMINDER_OPTIONS: Array<{ k: string; v: string }> = [
  { k: "0", v: "يوم الاستحقاق" },
  { k: "1", v: "قبل يوم" },
  { k: "2", v: "قبل يومين" },
  { k: "3", v: "قبل 3 أيام" },
];

export function HomeBillFormDialog({ accounts, currency, digits, onClose }: HomeBillFormDialogProps) {
  const [name, setName] = useState("");
  const [amount, setAmount] = useState("");
  const [frequency, setFrequency] = useState<CommitmentFrequency>("monthly");
  const [nextDate, setNextDate] = useState(todayISO());
  const [reminderDays, setReminderDays] = useState("2");
  const [accountId, setAccountId] = useState("none");
  const [busy, setBusy] = useState(false);

  const activeAccounts = accounts.filter((a) => !a.archived);

  const save = async () => {
    if (!name.trim()) {
      toast.error("سمِّ الفاتورة أولاً");
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
    await addRecurring({
      name: name.trim(),
      amount: value,
      type: "expense",
      frequency,
      nextDate,
      icon: "home",
      active: true,
      home: true,
      reminderDays: Number(reminderDays),
      essential: true,
      accountId: accountId === "none" ? undefined : accountId,
      note: "التزام منزلي",
    });
    setBusy(false);
    onClose();
  };

  return (
    <Dialog open onOpenChange={(o) => { if (!o) onClose(); }}>
      <DialogContent
        dir="rtl"
        className="mx-auto max-w-sm rounded-3xl border-black/[0.08] bg-white/95 p-5 backdrop-blur-xl shadow-[0_24px_60px_-20px_rgba(23,33,43,0.35)] max-h-[85dvh] overflow-y-auto sys-scroll"
      >
        <DialogHeader className="space-y-1 text-right">
          <DialogTitle className="text-lg leading-snug">فاتورة منزلية</DialogTitle>
          <DialogDescription className="text-[11.5px] leading-relaxed">
            إيجار، كهرباء، إنترنت، صيانة… تذكير قبل الاستحقاق وسداد بضغطة ينشئ مصروفاً ويربطه تلقائياً
          </DialogDescription>
        </DialogHeader>

        <FormShell onSave={() => void save()} busy={busy} saveLabel="إضافة الفاتورة">
          <Field label="الاسم">
            <input
              value={name}
              onChange={(e) => setName(e.target.value)}
              placeholder="إيجار، فاتورة كهرباء…"
              className={inputCls}
              aria-label="اسم الفاتورة المنزلية"
            />
          </Field>

          <Field label="المبلغ">
            <div className="glass-soft rounded-2xl p-4 flex flex-col items-center gap-1">
              <div className="num-display text-[32px] text-primary tabular" aria-live="polite">
                {displayAmount(amount, digits) || "0"}
              </div>
              <span className="text-[12px] text-muted-foreground">{currency}</span>
            </div>
            <NumberPad value={amount} onChange={setAmount} digits={digits} className="mt-3" label="لوحة مبلغ الفاتورة" />
          </Field>

          <ChipRow
            label="الدورية"
            options={FREQ_OPTIONS}
            value={frequency}
            onSelect={(k) => setFrequency(k as CommitmentFrequency)}
            small
          />

          <Field label="الاستحقاق القادم">
            <input
              type="date"
              value={nextDate}
              onChange={(e) => setNextDate(e.target.value)}
              className={cn(inputCls, "[color-scheme:dark]")}
              aria-label="تاريخ الاستحقاق القادم"
            />
          </Field>

          <ChipRow
            label="تذكير قبل الاستحقاق"
            options={REMINDER_OPTIONS}
            value={reminderDays}
            onSelect={setReminderDays}
            small
          />

          {activeAccounts.length > 0 && (
            <Field label="الحساب (اختياري)" hint="إن حددته يُسجَّل السداد منه مباشرة بضغطة واحدة">
              <Select value={accountId} onValueChange={setAccountId}>
                <SelectTrigger className="h-12 rounded-xl w-full" aria-label="حساب الفاتورة">
                  <SelectValue placeholder="اسألني كل مرة" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="none">اسألني كل مرة</SelectItem>
                  {activeAccounts.map((a) => (
                    <SelectItem key={a.id} value={a.id}>
                      <span className="flex items-center gap-2">
                        <span className="w-2 h-2 rounded-full" style={{ background: a.color }} aria-hidden="true" />
                        {a.name}
                      </span>
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </Field>
          )}
        </FormShell>
      </DialogContent>
    </Dialog>
  );
}
