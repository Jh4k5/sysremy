"use client";

/**
 * Systemy v3 — دين جديد لشخص معين
 * الاسم + الشخص (معبأ مسبقاً) + الاتجاه (عليّ / لي) + المبلغ (لوحة أرقام)
 * + تاريخ استحقاق اختياري + ملاحظة. عند الاستحقاق يُنشأ تذكير تلقائي.
 */

import { useState } from "react";
import { toast } from "sonner";
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { addDebt } from "@/lib/actions";
import { todayISO } from "@/lib/format";
import type { DigitStyle, Person } from "@/lib/types";
import {
  ChipRow,
  Field,
  FormShell,
  NumberPad,
  displayAmount,
  inputCls,
  textareaCls,
} from "@/components/systemy/ui-bits";
import { cn } from "@/lib/utils";

export interface DebtFormDialogProps {
  /** الشخص الذي فُتح من ملفه — يعبأ في حقل الشخص (يُركّب عند الفتح فيبدأ بحالة نظيفة) */
  person: Person | null;
  currency: string;
  digits: DigitStyle;
  onClose: () => void;
}

const DIRECTION_OPTIONS: Array<{ k: string; v: string }> = [
  { k: "payable", v: "عليّ — أسدّده" },
  { k: "receivable", v: "لي — مستحق لي" },
];

export function DebtFormDialog({ person, currency, digits, onClose }: DebtFormDialogProps) {
  const [name, setName] = useState("");
  const [who, setWho] = useState(person?.name ?? "");
  const [direction, setDirection] = useState<"payable" | "receivable">("payable");
  const [amount, setAmount] = useState("");
  const [dueDate, setDueDate] = useState("");
  const [note, setNote] = useState("");
  const [busy, setBusy] = useState(false);

  const save = async () => {
    if (!name.trim()) {
      toast.error("سمِّ الدين أولاً");
      return;
    }
    if (!who.trim()) {
      toast.error("مع من هذا الدين؟");
      return;
    }
    const value = Number(amount);
    if (!(value > 0)) {
      toast.error("أدخل مبلغاً صحيحاً أكبر من صفر");
      return;
    }
    setBusy(true);
    await addDebt({
      name: name.trim(),
      amount: value,
      paid: 0,
      direction,
      person: who.trim(),
      dueDate: dueDate || undefined,
      note: note.trim() || undefined,
    });
    setBusy(false);
    onClose();
  };

  return (
    <Dialog open onOpenChange={(o) => { if (!o) onClose(); }}>
      <DialogContent
        dir="rtl"
        className="mx-auto max-w-sm rounded-3xl border-white/10 bg-[#0B0F1A]/95 p-5 backdrop-blur-2xl max-h-[85dvh] overflow-y-auto sys-scroll"
      >
        <DialogHeader className="space-y-1 text-right">
          <DialogTitle className="text-lg leading-snug">
            دين جديد{person ? ` — ${person.name}` : ""}
          </DialogTitle>
          <DialogDescription className="text-[11.5px] leading-relaxed">
            يُربط بملف الشخص تلقائياً، ويظهر في شاشة المال — مع تذكير عند الاستحقاق إن حددته
          </DialogDescription>
        </DialogHeader>

        <FormShell onSave={() => void save()} busy={busy} saveLabel="إضافة الدين">
          <Field label="وصف الدين">
            <input
              value={name}
              onChange={(e) => setName(e.target.value)}
              placeholder="قرض، أجرة، مساعدة…"
              className={inputCls}
              aria-label="وصف الدين"
            />
          </Field>

          <Field label="الشخص">
            <input
              value={who}
              onChange={(e) => setWho(e.target.value)}
              placeholder="اسم الشخص"
              className={inputCls}
              aria-label="الشخص المرتبط بالدين"
            />
          </Field>

          <ChipRow
            label="الاتجاه"
            options={DIRECTION_OPTIONS}
            value={direction}
            onSelect={(k) => setDirection(k as "payable" | "receivable")}
            small
          />

          <Field label="المبلغ">
            <div className="glass-soft rounded-2xl p-4 flex flex-col items-center gap-1">
              <div className="num-display text-[32px] text-primary tabular" aria-live="polite">
                {displayAmount(amount, digits) || "0"}
              </div>
              <span className="text-[12px] text-muted-foreground">{currency}</span>
            </div>
            <NumberPad value={amount} onChange={setAmount} digits={digits} className="mt-3" label="لوحة مبلغ الدين" />
          </Field>

          <Field label="الاستحقاق (اختياري)">
            <input
              type="date"
              value={dueDate}
              onChange={(e) => setDueDate(e.target.value)}
              min={todayISO()}
              className={cn(inputCls, "[color-scheme:dark]")}
              aria-label="تاريخ استحقاق الدين"
            />
          </Field>

          <Field label="ملاحظة (اختياري)">
            <textarea
              value={note}
              onChange={(e) => setNote(e.target.value)}
              placeholder="تفاصيل الاتفاق، الدفعات المتفق عليها…"
              className={textareaCls}
              aria-label="ملاحظة الدين"
            />
          </Field>
        </FormShell>
      </DialogContent>
    </Dialog>
  );
}
