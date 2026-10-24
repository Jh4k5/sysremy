"use client";

/**
 * Systemy v3 — نموذج الرحلة (إضافة / تعديل البيانات)
 * الاسم/الوجهة/البداية/النهاية/الميزانية/الحالة → addTrip أو updateTrip.
 * تحقق صارم: النهاية >= البداية وإلا toast خطأ.
 */

import { useEffect, useState } from "react";
import { toast } from "sonner";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { addTrip, updateTrip } from "@/lib/actions";
import type { Trip, TripStatus } from "@/lib/types";
import { todayISO } from "@/lib/format";
import { ChipRow, Field, FormShell, inputCls } from "@/components/systemy/ui-bits";

const STATUS_OPTIONS: Array<{ k: TripStatus; v: string }> = [
  { k: "planned", v: "مخططة" },
  { k: "active", v: "جارية" },
  { k: "done", v: "منتهية" },
];

export interface TripFormDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  /** رحلة موجودة لتعديل بياناتها — null لإضافة جديدة */
  trip: Trip | null;
}

export function TripFormDialog({ open, onOpenChange, trip }: TripFormDialogProps) {
  const [name, setName] = useState("");
  const [destination, setDestination] = useState("");
  const [startDate, setStartDate] = useState("");
  const [endDate, setEndDate] = useState("");
  const [budget, setBudget] = useState("");
  const [status, setStatus] = useState<TripStatus>("planned");
  const [busy, setBusy] = useState(false);

  // تعبئة النموذج عند كل فتح
  useEffect(() => {
    if (!open) return;
    setName(trip?.name ?? "");
    setDestination(trip?.destination ?? "");
    setStartDate(trip?.startDate ?? todayISO());
    setEndDate(trip?.endDate ?? todayISO());
    setBudget(trip && trip.budget > 0 ? String(trip.budget) : "");
    setStatus(trip?.status ?? "planned");
  }, [open, trip]);

  const save = async () => {
    const cleanName = name.trim();
    const cleanDestination = destination.trim();
    if (!cleanName) {
      toast.error("اكتب اسم الرحلة");
      return;
    }
    if (!cleanDestination) {
      toast.error("اكتب وجهة الرحلة");
      return;
    }
    if (!startDate || !endDate) {
      toast.error("اختر تاريخي البداية والنهاية");
      return;
    }
    if (endDate < startDate) {
      toast.error("نهاية الرحلة يجب أن تكون في يوم البداية أو بعده");
      return;
    }
    const budgetNum = Math.max(0, Math.round((Number(budget) || 0) * 100) / 100);

    setBusy(true);
    try {
      const payload = {
        name: cleanName,
        destination: cleanDestination,
        startDate,
        endDate,
        budget: budgetNum,
        status,
        notes: trip?.notes,
      };
      if (trip) {
        await updateTrip(trip.id, payload);
      } else {
        await addTrip(payload);
      }
      onOpenChange(false);
    } finally {
      setBusy(false);
    }
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent
        aria-describedby={undefined}
        className="glass-deep rounded-3xl border-white/10 p-5 max-w-md w-[calc(100vw-2rem)] max-h-[85vh] overflow-y-auto sys-scroll"
      >
        <DialogHeader className="text-start">
          <DialogTitle className="text-[15px] font-bold text-start">
            {trip ? "تعديل بيانات الرحلة" : "رحلة جديدة"}
          </DialogTitle>
        </DialogHeader>

        <div className="space-y-3.5 pt-1">
          {/* الاسم والوجهة */}
          <Field label="اسم الرحلة">
            <input
              value={name}
              onChange={(e) => setName(e.target.value)}
              placeholder="مثال: صيف جدة"
              maxLength={40}
              className={inputCls}
              aria-label="اسم الرحلة"
            />
          </Field>
          <Field label="الوجهة">
            <input
              value={destination}
              onChange={(e) => setDestination(e.target.value)}
              placeholder="مثال: جدة"
              maxLength={40}
              className={inputCls}
              aria-label="وجهة الرحلة"
            />
          </Field>

          {/* التواريخ */}
          <div className="grid grid-cols-2 gap-2.5">
            <Field label="تاريخ البداية">
              <input
                type="date"
                value={startDate}
                onChange={(e) => setStartDate(e.target.value)}
                dir="ltr"
                className={inputCls}
                aria-label="تاريخ بداية الرحلة"
              />
            </Field>
            <Field label="تاريخ النهاية">
              <input
                type="date"
                value={endDate}
                min={startDate || undefined}
                onChange={(e) => setEndDate(e.target.value)}
                dir="ltr"
                className={inputCls}
                aria-label="تاريخ نهاية الرحلة"
              />
            </Field>
          </div>

          {/* الميزانية */}
          <Field label="الميزانية (اختياري)" hint="تُقاس مصاريف الرحلة المرتبطة مقابلها">
            <input
              type="number"
              inputMode="decimal"
              min={0}
              step="any"
              value={budget}
              onChange={(e) => setBudget(e.target.value)}
              placeholder="0"
              dir="ltr"
              className={`${inputCls} tabular`}
              aria-label="ميزانية الرحلة"
            />
          </Field>

          {/* الحالة */}
          <ChipRow
            label="حالة الرحلة"
            options={STATUS_OPTIONS}
            value={status}
            onSelect={(k) => setStatus(k as TripStatus)}
            small
          />

          <FormShell onSave={() => void save()} busy={busy} saveLabel={trip ? "حفظ التعديل" : "إنشاء الرحلة"} />
        </div>
      </DialogContent>
    </Dialog>
  );
}
