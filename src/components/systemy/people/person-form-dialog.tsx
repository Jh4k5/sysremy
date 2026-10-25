"use client";

/**
 * Systemy v3 — نموذج إضافة/تعديل شخص
 * الاسم + العلاقة (عائلة/صديق/عمل/عميل/جار/آخر) + وسوم + عيد ميلاد + ملاحظات + مفضلة.
 */

import { useState } from "react";
import { toast } from "sonner";
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Switch } from "@/components/ui/switch";
import { addPerson, updatePerson } from "@/lib/actions";
import { PERSON_RELATIONS, type Person } from "@/lib/types";
import { ChipRow, Field, FormShell, inputCls, textareaCls } from "@/components/systemy/ui-bits";
import { cn } from "@/lib/utils";

export interface PersonFormDialogProps {
  /** شخص موجود للتعديل — null لإضافة جديد (يُركّب عند الفتح فيبدأ بحالة نظيفة) */
  person: Person | null;
  onClose: () => void;
}

const RELATION_OPTIONS = PERSON_RELATIONS.map((r) => ({ k: r, v: r }));

export function PersonFormDialog({ person, onClose }: PersonFormDialogProps) {
  const [name, setName] = useState(person?.name ?? "");
  const [relation, setRelation] = useState<string>(person?.relation ?? "عائلة");
  const [tags, setTags] = useState(person?.tags ?? "");
  const [birthday, setBirthday] = useState(person?.birthday ?? "");
  const [notes, setNotes] = useState(person?.notes ?? "");
  const [favorite, setFavorite] = useState(person?.favorite ?? false);
  const [busy, setBusy] = useState(false);

  const save = async () => {
    if (!name.trim()) {
      toast.error("سمِّ الشخص أولاً");
      return;
    }
    setBusy(true);
    const payload = {
      name: name.trim(),
      relation,
      tags: tags.trim(),
      birthday: birthday || undefined,
      notes: notes.trim() || undefined,
      favorite,
    };
    if (person) await updatePerson(person.id, payload);
    else await addPerson(payload);
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
          <DialogTitle className="text-lg leading-snug">
            {person ? `تعديل ${person.name}` : "شخص جديد"}
          </DialogTitle>
          <DialogDescription className="text-[11.5px] leading-relaxed">
            {person
              ? "حدّث بياناته — تُحفظ فوراً وتنعكس في كل الشاشات"
              : "عائلة أو صديق أو عميل — ملفه يجمع التواصل والديون والمعاملات"}
          </DialogDescription>
        </DialogHeader>

        <FormShell onSave={() => void save()} busy={busy} saveLabel={person ? "حفظ التعديلات" : "إضافة الشخص"}>
          <Field label="الاسم">
            <input
              value={name}
              onChange={(e) => setName(e.target.value)}
              placeholder="مثال: محمد العتيبي"
              className={inputCls}
              aria-label="اسم الشخص"
            />
          </Field>

          <ChipRow
            label="العلاقة"
            options={RELATION_OPTIONS}
            value={relation}
            onSelect={setRelation}
            small
          />

          <Field label="عيد الميلاد (اختياري)">
            <input
              type="date"
              value={birthday}
              onChange={(e) => setBirthday(e.target.value)}
              className={cn(inputCls, "[color-scheme:dark]")}
              aria-label="تاريخ عيد الميلاد"
            />
          </Field>

          <Field label="الوسوم (اختياري)" hint="افصل بينها بفاصلة — مثل: عمل, فريق السلة">
            <input
              value={tags}
              onChange={(e) => setTags(e.target.value)}
              placeholder="عمل, جامعة, جيران"
              className={inputCls}
              aria-label="وسوم الشخص"
            />
          </Field>

          <Field label="ملاحظات (اختياري)">
            <textarea
              value={notes}
              onChange={(e) => setNotes(e.target.value)}
              placeholder="تفاصيل تهمك عنه — اهتمامات، مناسبات، اتفاقات…"
              className={textareaCls}
              aria-label="ملاحظات الشخص"
            />
          </Field>

          <div className="flex items-center justify-between rounded-2xl glass-soft px-4 h-14">
            <div className="min-w-0">
              <p className="text-[13px] font-semibold">مفضلة</p>
              <p className="text-[10.5px] text-muted-foreground">يظهر في مقدمة القائمة بنجمة</p>
            </div>
            <Switch
              checked={favorite}
              onCheckedChange={setFavorite}
              aria-label="تمييز الشخص كمفضلة"
            />
          </div>
        </FormShell>
      </DialogContent>
    </Dialog>
  );
}
