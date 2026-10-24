"use client";

/**
 * Systemy v3 — نموذج المستند (إضافة / تعديل)
 * كل الحقول قابلة للتعديل: العنوان/النوع/الجهة/الرقم/الإصدار/الانتهاء/الوسوم/الملاحظات
 * + مفتاح مفضلة. تحديث تاريخ الانتهاء يعيد جدولة التذكير تلقائياً،
 * والحذف يوضح أن تذكير الانتهاء يُحذف مع المستند.
 */

import { useEffect, useState } from "react";
import { toast } from "sonner";
import { ShieldCheck } from "lucide-react";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Switch } from "@/components/ui/switch";
import { addDocument, deleteDocument, updateDocument } from "@/lib/actions";
import { DOC_TYPE_LABELS, type DocType, type DocumentRecord } from "@/lib/types";
import {
  ChipRow,
  ConfirmBar,
  Field,
  FormShell,
  inputCls,
  textareaCls,
} from "@/components/systemy/ui-bits";

const DOC_TYPE_OPTIONS = (Object.keys(DOC_TYPE_LABELS) as DocType[]).map((k) => ({
  k,
  v: DOC_TYPE_LABELS[k],
}));

export interface DocumentFormDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  /** مستند موجود للتعديل — null لإضافة جديد */
  doc: DocumentRecord | null;
}

export function DocumentFormDialog({ open, onOpenChange, doc }: DocumentFormDialogProps) {
  const [title, setTitle] = useState("");
  const [type, setType] = useState<DocType>("other");
  const [issuer, setIssuer] = useState("");
  const [number, setNumber] = useState("");
  const [issueDate, setIssueDate] = useState("");
  const [expiryDate, setExpiryDate] = useState("");
  const [tags, setTags] = useState("");
  const [notes, setNotes] = useState("");
  const [favorite, setFavorite] = useState(false);
  const [busy, setBusy] = useState(false);
  const [confirmDelete, setConfirmDelete] = useState(false);

  // تعبئة النموذج عند كل فتح
  useEffect(() => {
    if (!open) return;
    setTitle(doc?.title ?? "");
    setType(doc?.type ?? "other");
    setIssuer(doc?.issuer ?? "");
    setNumber(doc?.number ?? "");
    setIssueDate(doc?.issueDate ?? "");
    setExpiryDate(doc?.expiryDate ?? "");
    setTags(doc?.tags ?? "");
    setNotes(doc?.notes ?? "");
    setFavorite(doc?.favorite ?? false);
    setConfirmDelete(false);
  }, [open, doc]);

  const save = async () => {
    const cleanTitle = title.trim();
    if (!cleanTitle) {
      toast.error("اكتب عنوان المستند");
      return;
    }
    setBusy(true);
    try {
      const payload = {
        title: cleanTitle,
        type,
        issuer: issuer.trim() || undefined,
        number: number.trim() || undefined,
        issueDate: issueDate || undefined,
        expiryDate: expiryDate || undefined,
        tags: tags.trim(),
        notes: notes.trim() || undefined,
        favorite,
      };
      if (doc) {
        await updateDocument(doc.id, payload);
      } else {
        await addDocument(payload);
      }
      onOpenChange(false);
    } finally {
      setBusy(false);
    }
  };

  const doDelete = async () => {
    if (!doc) return;
    setBusy(true);
    try {
      await deleteDocument(doc.id);
      setConfirmDelete(false);
      onOpenChange(false);
    } finally {
      setBusy(false);
    }
  };

  return (
    <Dialog
      open={open}
      onOpenChange={(o) => {
        onOpenChange(o);
        if (!o) setConfirmDelete(false);
      }}
    >
      <DialogContent
        aria-describedby={undefined}
        className="glass-deep rounded-3xl border-white/10 p-5 max-w-md w-[calc(100vw-2rem)] max-h-[85vh] overflow-y-auto sys-scroll"
      >
        <DialogHeader className="text-start">
          <DialogTitle className="text-[15px] font-bold text-start">
            {doc ? "تفاصيل المستند" : "مستند جديد"}
          </DialogTitle>
        </DialogHeader>

        <div className="space-y-3.5 pt-1">
          {/* العنوان */}
          <Field label="عنوان المستند">
            <input
              value={title}
              onChange={(e) => setTitle(e.target.value)}
              placeholder="مثال: جواز السفر السعودي"
              maxLength={60}
              className={inputCls}
              aria-label="عنوان المستند"
            />
          </Field>

          {/* النوع */}
          <ChipRow
            label="نوع المستند"
            options={DOC_TYPE_OPTIONS}
            value={type}
            onSelect={(k) => setType(k as DocType)}
            small
          />

          {/* جهة الإصدار + الرقم */}
          <Field label="جهة الإصدار">
            <input
              value={issuer}
              onChange={(e) => setIssuer(e.target.value)}
              placeholder="مثال: الأحوال المدنية"
              maxLength={40}
              className={inputCls}
              aria-label="جهة الإصدار"
            />
          </Field>
          <Field label="الرقم (اختياري)">
            <input
              value={number}
              onChange={(e) => setNumber(e.target.value)}
              placeholder="رقم المستند"
              maxLength={32}
              dir="ltr"
              className={inputCls}
              aria-label="رقم المستند"
            />
          </Field>

          {/* التواريخ */}
          <div className="grid grid-cols-2 gap-2.5">
            <Field label="تاريخ الإصدار">
              <input
                type="date"
                value={issueDate}
                onChange={(e) => setIssueDate(e.target.value)}
                dir="ltr"
                className={inputCls}
                aria-label="تاريخ الإصدار"
              />
            </Field>
            <Field
              label="تاريخ الانتهاء"
              hint={doc ? "تغييره يعيد جدولة التذكير تلقائياً" : "سيُنشأ تذكير قبل الانتهاء تلقائياً"}
            >
              <input
                type="date"
                value={expiryDate}
                onChange={(e) => setExpiryDate(e.target.value)}
                dir="ltr"
                className={inputCls}
                aria-label="تاريخ الانتهاء"
              />
            </Field>
          </div>

          {/* الوسوم */}
          <Field label="الوسوم (اختياري)">
            <input
              value={tags}
              onChange={(e) => setTags(e.target.value)}
              placeholder="سفر، عائلي، عمل…"
              maxLength={60}
              className={inputCls}
              aria-label="وسوم المستند"
            />
          </Field>

          {/* الملاحظات */}
          <Field label="ملاحظات (اختياري)">
            <textarea
              value={notes}
              onChange={(e) => setNotes(e.target.value)}
              placeholder="أي تفاصيل تهمّك — أين تحفظه، لمن يرجع…"
              maxLength={400}
              className={textareaCls}
              aria-label="ملاحظات المستند"
            />
          </Field>

          {/* المفضلة */}
          <div className="flex h-14 items-center justify-between gap-3 rounded-xl glass-soft px-4">
            <div className="min-w-0">
              <p className="text-[13px] font-medium">مستند مفضل</p>
              <p className="text-[10px] leading-tight text-muted-foreground">يظهر أولاً في فلتر المفضلة</p>
            </div>
            <Switch checked={favorite} onCheckedChange={setFavorite} aria-label="تمييز المستند كمفضل" />
          </div>

          {/* حذف + حفظ */}
          <FormShell onSave={() => void save()} busy={busy} saveLabel={doc ? "حفظ التعديل" : "إضافة المستند"}>
            {doc && !confirmDelete && (
              <button
                type="button"
                onClick={() => setConfirmDelete(true)}
                disabled={busy}
                className="h-12 w-full rounded-2xl border border-coral/40 text-[12.5px] font-bold text-coral transition-colors hover:bg-coral/10 disabled:opacity-50"
              >
                حذف المستند
              </button>
            )}
            {doc && confirmDelete && (
              <ConfirmBar
                message={`حذف «${doc.title}» نهائياً؟ تذكير تاريخ انتهائه يُحذف معه، ولا يمكن التراجع.`}
                confirmLabel="حذف نهائي"
                onConfirm={() => void doDelete()}
                onCancel={() => setConfirmDelete(false)}
              />
            )}
          </FormShell>

          <p className="flex items-center justify-center gap-1.5 pt-0.5 text-center text-[10px] text-muted-foreground/70">
            <ShieldCheck className="h-3.5 w-3.5 shrink-0" aria-hidden="true" />
            {doc ? "المستند وتذكيره محفوظان على جهازك فقط" : "سيُحفظ المستند على جهازك فقط"}
          </p>
        </div>
      </DialogContent>
    </Dialog>
  );
}
