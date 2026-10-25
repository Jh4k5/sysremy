"use client";

/**
 * Systemy v3 — حوار الملاحظة (عرض/تعديل/إنشاء) — شاشة الملاحظات والمعرفة
 * عنوان + محتوى + وسوم + مثبتة/سرية → updateNote أو addNote بنوع "note"
 * + حذف بتأكيد + «حوّلها مهمة» (addTask بتاريخ اليوم) + «دوّن يومية».
 */
import { useEffect, useState } from "react";
import { AnimatePresence, motion } from "framer-motion";
import { toast } from "sonner";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Button } from "@/components/ui/button";
import { CheckSquare, Eye, EyeOff, NotebookPen, Pin, PinOff, Trash2 } from "lucide-react";
import { ConfirmBar, Field, inputCls } from "@/components/systemy/ui-bits";
import { addNote, addTask, deleteNote, updateNote } from "@/lib/actions";
import { todayISO } from "@/lib/format";
import type { Note } from "@/lib/types";
import { cn } from "@/lib/utils";
import { useUIStore } from "@/store/ui-store";
import { visibleTags } from "./notes-utils";

const bigTextareaCls =
  "w-full min-h-48 rounded-xl glass-soft border border-black/[0.07] p-3.5 text-[13.5px] leading-relaxed text-foreground placeholder:text-muted-foreground/50 focus:border-primary/40 focus:outline-none transition-colors resize-none";

interface EditorState {
  title: string;
  content: string;
  tags: string;
  pinned: boolean;
  secret: boolean;
}

function editorFromNote(n: Note): EditorState {
  return {
    title: n.title,
    content: n.content,
    tags: visibleTags(n).join("، "),
    pinned: n.pinned,
    secret: n.secret,
  };
}

export function NoteDialog({
  open,
  onOpenChange,
  note,
}: {
  open: boolean;
  onOpenChange: (o: boolean) => void;
  /** الملاحظة قيد العرض/التعديل — null تعني إنشاء ملاحظة جديدة */
  note: Note | null;
}) {
  const setView = useUIStore((s) => s.setView);

  const [editor, setEditor] = useState<EditorState | null>(null);
  const [busy, setBusy] = useState(false);
  const [confirmDelete, setConfirmDelete] = useState(false);

  /* مزامنة المحرر عند الفتح — بالمعرف حتى لا تضيع التعديلات غير المحفوظة عند تحديث الجدول */
  const noteId = note?.id ?? null;
  useEffect(() => {
    if (open) {
      setEditor(
        note
          ? editorFromNote(note)
          : { title: "", content: "", tags: "", pinned: false, secret: false }
      );
      setConfirmDelete(false);
    }
  }, [open, noteId]);

  function patch(p: Partial<EditorState>) {
    setEditor((e) => (e ? { ...e, ...p } : e));
  }

  async function save() {
    if (!editor || busy) return;
    if (!editor.title.trim() && !editor.content.trim()) return;
    setBusy(true);
    try {
      if (note) {
        await updateNote(note.id, {
          title: editor.title.trim() || "بلا عنوان",
          content: editor.content.trim(),
          tags: editor.tags.trim(),
          pinned: editor.pinned,
          secret: editor.secret,
        });
      } else {
        await addNote({
          title: editor.title.trim() || "بلا عنوان",
          content: editor.content.trim(),
          type: "note",
          tags: editor.tags.trim(),
          pinned: editor.pinned,
          secret: editor.secret,
          date: todayISO(),
        });
      }
      onOpenChange(false);
    } finally {
      setBusy(false);
    }
  }

  async function togglePinned() {
    if (!editor) return;
    const next = !editor.pinned;
    patch({ pinned: next });
    if (note) await updateNote(note.id, { pinned: next });
  }

  async function toggleSecret() {
    if (!editor) return;
    const next = !editor.secret;
    patch({ secret: next });
    if (note) await updateNote(note.id, { secret: next });
  }

  /** حوّل الملاحظة المحفوظة إلى مهمة بتاريخ اليوم */
  async function convertToTask() {
    if (!note || busy) return;
    setBusy(true);
    try {
      const title = note.title.trim() || note.content.trim().slice(0, 40) || "مهمة من ملاحظة";
      await addTask({
        title,
        date: todayISO(),
        priority: "normal",
        done: false,
      });
      toast.success("أُنشئت مهمة من الملاحظة", { description: title });
    } finally {
      setBusy(false);
    }
  }

  async function handleDelete() {
    if (!note || busy) return;
    setBusy(true);
    try {
      await deleteNote(note.id);
      onOpenChange(false);
    } finally {
      setBusy(false);
    }
  }

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
            {note ? "تعديل الملاحظة" : "ملاحظة جديدة"}
          </DialogTitle>
        </DialogHeader>

        {editor && (
          <div className="space-y-3.5 pt-1">
            <Field label="العنوان">
              <Input
                value={editor.title}
                onChange={(e) => patch({ title: e.target.value })}
                placeholder="عنوان الملاحظة…"
                aria-label="عنوان الملاحظة"
                className={inputCls}
              />
            </Field>

            <Field label="المحتوى">
              <Textarea
                value={editor.content}
                onChange={(e) => patch({ content: e.target.value })}
                placeholder="معرفتك المرجعية — اكتب ما تريد العودة إليه…"
                aria-label="محتوى الملاحظة"
                className={bigTextareaCls}
              />
            </Field>

            <Field label="الوسوم" hint="مفصولة بفاصلة — تُستخدم للفلترة لاحقاً">
              <Input
                value={editor.tags}
                onChange={(e) => patch({ tags: e.target.value })}
                placeholder="مثال: برمجة، مراجع"
                aria-label="وسوم الملاحظة"
                className={inputCls}
              />
            </Field>

            {/* مفاتيح مثبتة / سرية */}
            <div className="grid grid-cols-2 gap-2">
              <button
                type="button"
                onClick={() => void togglePinned()}
                aria-pressed={editor.pinned}
                aria-label={editor.pinned ? "إلغاء التثبيت" : "تثبيت الملاحظة"}
                className={cn(
                  "min-h-11 h-11 rounded-xl text-[12px] font-semibold flex items-center justify-center gap-1.5 transition-colors",
                  editor.pinned
                    ? "bg-primary/15 border border-primary/40 text-primary"
                    : "glass-soft border border-black/[0.05] text-muted-foreground hover:text-foreground"
                )}
              >
                {editor.pinned ? <PinOff className="w-4 h-4" /> : <Pin className="w-4 h-4" />}
                {editor.pinned ? "مثبتة" : "تثبيت"}
              </button>
              <button
                type="button"
                onClick={() => void toggleSecret()}
                aria-pressed={editor.secret}
                aria-label={editor.secret ? "إلغاء السرية" : "جعل الملاحظة سرية"}
                className={cn(
                  "min-h-11 h-11 rounded-xl text-[12px] font-semibold flex items-center justify-center gap-1.5 transition-colors",
                  editor.secret
                    ? "bg-lav/15 border border-lav/40 text-lav"
                    : "glass-soft border border-black/[0.05] text-muted-foreground hover:text-foreground"
                )}
              >
                {editor.secret ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
                {editor.secret ? "سرية" : "عادية"}
              </button>
            </div>

            {editor.secret && (
              <p className="text-[10.5px] text-lav/90 leading-relaxed">
                تظهر مموّهة في القائمة حتى تنقرها لكشفها.
              </p>
            )}

            {/* حفظ + حذف */}
            <div className="flex items-center gap-2 pt-1">
              <Button
                onClick={() => void save()}
                disabled={busy || (!editor.title.trim() && !editor.content.trim())}
                className="flex-1 h-11 rounded-xl bg-primary text-primary-foreground font-semibold text-[13px] hover:bg-primary/90"
              >
                {busy ? "جارٍ الحفظ…" : "حفظ"}
              </Button>
              {note && (
                <Button
                  variant="outline"
                  onClick={() => setConfirmDelete(true)}
                  aria-label="حذف الملاحظة"
                  title="حذف"
                  disabled={confirmDelete}
                  className="w-11 h-11 p-0 rounded-xl border-coral/30 text-coral hover:bg-coral/10 hover:text-coral"
                >
                  <Trash2 className="w-4 h-4" />
                </Button>
              )}
            </div>

            {/* إجراءات مترابطة */}
            {note && (
              <div className="grid grid-cols-2 gap-2">
                <button
                  type="button"
                  onClick={() => void convertToTask()}
                  disabled={busy}
                  aria-label="تحويل الملاحظة إلى مهمة بتاريخ اليوم"
                  className="min-h-11 rounded-xl glass-soft border border-black/[0.05] px-3 text-[11.5px] font-medium text-foreground/85 flex items-center justify-center gap-1.5 hover:bg-black/[0.04] disabled:opacity-50 transition-colors"
                >
                  <CheckSquare className="w-4 h-4 text-gold" aria-hidden="true" />
                  حوّلها مهمة
                </button>
                <button
                  type="button"
                  onClick={() => {
                    onOpenChange(false);
                    setView("journal");
                  }}
                  aria-label="الانتقال إلى اليوميات"
                  className="min-h-11 rounded-xl glass-soft border border-black/[0.05] px-3 text-[11.5px] font-medium text-foreground/85 flex items-center justify-center gap-1.5 hover:bg-black/[0.04] transition-colors"
                >
                  <NotebookPen className="w-4 h-4 text-lav" aria-hidden="true" />
                  دوّن يومية
                </button>
              </div>
            )}

            <AnimatePresence>
              {confirmDelete && note && (
                <motion.div
                  initial={{ opacity: 0, y: 8 }}
                  animate={{ opacity: 1, y: 0 }}
                  exit={{ opacity: 0 }}
                  transition={{ duration: 0.2 }}
                >
                  <ConfirmBar
                    message={`حذف «${note.title || "بلا عنوان"}» نهائياً؟ لا رجعة بعد الحذف.`}
                    confirmLabel="حذف"
                    onConfirm={() => void handleDelete()}
                    onCancel={() => setConfirmDelete(false)}
                  />
                </motion.div>
              )}
            </AnimatePresence>
          </div>
        )}
      </DialogContent>
    </Dialog>
  );
}
