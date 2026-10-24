"use client";

/**
 * Systemy v3 — نموذج ممتلك منزلي (إضافة/تعديل)
 * الاسم + النوع (جهاز/أثاث/مركبة/عقد صيانة) + تاريخ الشراء + الضمان حتى
 * + الصيانة القادمة (تذكير تلقائي) + ملاحظة.
 */

import { useState } from "react";
import { toast } from "sonner";
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { addHomeItem, updateHomeItem } from "@/lib/actions";
import type { HomeItem } from "@/lib/types";
import { ChipRow, Field, FormShell, inputCls, textareaCls } from "@/components/systemy/ui-bits";
import { HOME_KINDS } from "./shared";
import { cn } from "@/lib/utils";

export interface HomeItemFormDialogProps {
  /** ممتلك موجود للتعديل — null لإضافة جديد (يُركّب عند الفتح فيبدأ بحالة نظيفة) */
  item: HomeItem | null;
  onClose: () => void;
}

const KIND_OPTIONS = HOME_KINDS.map((k) => ({ k, v: k }));

export function HomeItemFormDialog({ item, onClose }: HomeItemFormDialogProps) {
  const [name, setName] = useState(item?.name ?? "");
  const [kind, setKind] = useState<string>(item?.kind ?? "جهاز");
  const [purchaseDate, setPurchaseDate] = useState(item?.purchaseDate ?? "");
  const [warrantyUntil, setWarrantyUntil] = useState(item?.warrantyUntil ?? "");
  const [nextService, setNextService] = useState(item?.nextService ?? "");
  const [note, setNote] = useState(item?.note ?? "");
  const [busy, setBusy] = useState(false);

  const save = async () => {
    if (!name.trim()) {
      toast.error("سمِّ الممتلك أولاً");
      return;
    }
    setBusy(true);
    const payload = {
      name: name.trim(),
      kind,
      purchaseDate: purchaseDate || undefined,
      warrantyUntil: warrantyUntil || undefined,
      nextService: nextService || undefined,
      note: note.trim() || undefined,
    };
    if (item) await updateHomeItem(item.id, payload);
    else await addHomeItem(payload);
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
            {item ? `تعديل ${item.name}` : "ممتلك منزلي"}
          </DialogTitle>
          <DialogDescription className="text-[11.5px] leading-relaxed">
            {item
              ? "حدّث بياناته — الضمان والصيانة ينعكسان فوراً"
              : "سجّل ضمانه وجدولة صيانته — سنذكّرك قبل موعدها تلقائياً"}
          </DialogDescription>
        </DialogHeader>

        <FormShell onSave={() => void save()} busy={busy} saveLabel={item ? "حفظ التعديلات" : "إضافة الممتلك"}>
          <Field label="الاسم">
            <input
              value={name}
              onChange={(e) => setName(e.target.value)}
              placeholder="ثلاجة، غسالة، سيارة…"
              className={inputCls}
              aria-label="اسم الممتلك"
            />
          </Field>

          <ChipRow label="النوع" options={KIND_OPTIONS} value={kind} onSelect={setKind} small />

          <Field label="تاريخ الشراء (اختياري)">
            <input
              type="date"
              value={purchaseDate}
              onChange={(e) => setPurchaseDate(e.target.value)}
              className={cn(inputCls, "[color-scheme:dark]")}
              aria-label="تاريخ شراء الممتلك"
            />
          </Field>

          <Field label="الضمان حتى (اختياري)">
            <input
              type="date"
              value={warrantyUntil}
              onChange={(e) => setWarrantyUntil(e.target.value)}
              className={cn(inputCls, "[color-scheme:dark]")}
              aria-label="تاريخ انتهاء الضمان"
            />
          </Field>

          <Field
            label="الصيانة القادمة (اختياري)"
            hint="تحديدها ينشئ تذكيراً تلقائياً في مركز التنبيهات قبل موعدها"
          >
            <input
              type="date"
              value={nextService}
              onChange={(e) => setNextService(e.target.value)}
              className={cn(inputCls, "[color-scheme:dark]")}
              aria-label="تاريخ الصيانة القادمة"
            />
          </Field>

          <Field label="ملاحظة (اختياري)">
            <textarea
              value={note}
              onChange={(e) => setNote(e.target.value)}
              placeholder="رقم السريال، مركز الصيانة، تكلفة آخر صيانة…"
              className={textareaCls}
              aria-label="ملاحظة الممتلك"
            />
          </Field>
        </FormShell>
      </DialogContent>
    </Dialog>
  );
}
