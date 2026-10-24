"use client";

/**
 * Systemy v3 — حوار تفاصيل المهمة
 * عرض الوصف والوقت والأولوية والروابط + إنجاز + جدولة على التقويم (addBlock + goToCalendar)
 * + تعديل مباشر (updateTask) + حذف بتأكيد (deleteTask عبر ConfirmBar).
 */

import { useEffect, useState, type ReactNode } from "react";
import { CalendarPlus, CheckCircle2, Clock3, ListTodo, NotebookPen, Pencil, Trash2, Timer, Undo2 } from "lucide-react";
import { toast } from "sonner";
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { addBlock, deleteTask, toggleTask, updateTask } from "@/lib/actions";
import { dayName, formatDate, formatTimeAr, hhmmToMinutes, minutesToHHMM, nowHHMM, relativeDay } from "@/lib/format";
import type { Task } from "@/lib/types";
import { ConfirmBar, FormShell, iconByName } from "@/components/systemy/ui-bits";
import { useUIStore } from "@/store/ui-store";
import { cn } from "@/lib/utils";
import { TaskFields, formToTaskInput, taskLinkChips, taskToForm, type TaskFormValue, type TaskLinkOptions } from "./task-fields";

const PRIORITY_META: Record<Task["priority"], { label: string; cls: string }> = {
  high: { label: "عاجلة", cls: "border-coral/40 bg-coral/10 text-coral" },
  normal: { label: "عادية", cls: "border-white/10 bg-white/[0.05] text-foreground/70" },
  low: { label: "هادئة", cls: "border-white/10 bg-white/[0.05] text-muted-foreground" },
};

export interface TaskDetailDialogProps {
  /** null = مغلق */
  task: Task | null;
  onOpenChange: (open: boolean) => void;
  links: TaskLinkOptions;
}

export function TaskDetailDialog({ task, onOpenChange, links }: TaskDetailDialogProps) {
  const goToCalendar = useUIStore((s) => s.goToCalendar);
  const [editing, setEditing] = useState(false);
  const [form, setForm] = useState<TaskFormValue | null>(null);
  const [confirmDelete, setConfirmDelete] = useState(false);
  const [busy, setBusy] = useState(false);

  // تصفير الحالات عند تبديل المهمة
  useEffect(() => {
    setEditing(false);
    setConfirmDelete(false);
    setForm(null);
  }, [task?.id]);

  if (!task) return null;

  const patch = (p: Partial<TaskFormValue>) => setForm((v) => (v ? { ...v, ...p } : v));

  const startEdit = () => {
    setForm(taskToForm(task));
    setConfirmDelete(false);
    setEditing(true);
  };

  const saveEdit = async () => {
    if (!form || busy) return;
    if (!form.title.trim()) {
      toast.error("اكتب عنوان المهمة");
      return;
    }
    const est = form.estimatedMinutes.trim();
    if (est && !(Number(est) >= 1 && Number(est) <= 1440)) {
      toast.error("المدة التقديرية بين دقيقة و1440 دقيقة");
      return;
    }
    setBusy(true);
    try {
      await updateTask(task.id, formToTaskInput(form));
      toast.success("حُدّثت المهمة ✓", { description: form.title.trim() });
      setEditing(false);
      setForm(null);
    } finally {
      setBusy(false);
    }
  };

  const doToggle = async () => {
    if (busy) return;
    setBusy(true);
    try {
      await toggleTask(task.id);
    } finally {
      setBusy(false);
    }
  };

  /** جدولة المهمة على التقويم: كتلة بنفس التاريخ/الوقت وtaskId ثم فتح التقويم */
  const schedule = async () => {
    if (busy) return;
    setBusy(true);
    try {
      const start = task.time ?? nowHHMM();
      const duration = Math.max(15, task.estimatedMinutes ?? 60);
      await addBlock({
        title: task.title,
        type: "work",
        date: task.date,
        startTime: start,
        endTime: minutesToHHMM(hhmmToMinutes(start) + duration),
        taskId: task.id,
        icon: "check-square",
      });
      onOpenChange(false);
      goToCalendar(task.date);
    } finally {
      setBusy(false);
    }
  };

  const doDelete = async () => {
    if (busy) return;
    setBusy(true);
    try {
      await deleteTask(task.id);
      setConfirmDelete(false);
      onOpenChange(false);
    } finally {
      setBusy(false);
    }
  };

  const prio = PRIORITY_META[task.priority] ?? PRIORITY_META.normal;
  const linkChips = taskLinkChips(task, links);

  return (
    <Dialog
      open={!!task}
      onOpenChange={(o) => {
        if (!o) {
          setConfirmDelete(false);
        }
        onOpenChange(o);
      }}
    >
      <DialogContent
        dir="rtl"
        className="mx-auto max-w-sm rounded-3xl border-white/10 bg-[#0B0F1A]/95 p-5 backdrop-blur-2xl"
      >
        {editing && form ? (
          <>
            <DialogHeader className="space-y-1 text-right">
              <DialogTitle className="text-right text-[15px] font-bold">تعديل المهمة</DialogTitle>
              <DialogDescription className="text-right text-[11px]">كل الحقول والروابط قابلة للتغيير</DialogDescription>
            </DialogHeader>
            <div className="sys-scroll max-h-[58vh] space-y-4 overflow-y-auto px-0.5 pb-1 pt-1">
              <TaskFields key={`edit-${task.id}`} value={form} onPatch={patch} links={links} />
              <div className="flex gap-2">
                <button
                  type="button"
                  onClick={() => {
                    setEditing(false);
                    setForm(null);
                  }}
                  disabled={busy}
                  className="h-11 flex-1 rounded-2xl glass-soft border border-white/[0.08] text-[12.5px] font-medium text-foreground/80 transition-colors hover:bg-white/[0.06] disabled:opacity-50"
                >
                  رجوع للتفاصيل
                </button>
              </div>
              <FormShell onSave={() => void saveEdit()} busy={busy} saveLabel="حفظ التعديل" />
            </div>
          </>
        ) : (
          <>
            <DialogHeader className="space-y-2 text-right">
              <span
                className={cn(
                  "inline-flex w-fit items-center gap-1.5 rounded-full border px-2.5 py-1 text-[11px] font-semibold",
                  task.done ? "border-mint/40 bg-mint/10 text-mint" : prio.cls
                )}
              >
                {task.done ? "منجزة" : prio.label}
              </span>
              <DialogTitle className={cn("text-right text-lg leading-snug", task.done && "line-through opacity-70")}>
                {task.title}
              </DialogTitle>
              <DialogDescription className="text-right text-[11.5px] tabular">
                {dayName(task.date)} · {formatDate(task.date)} · {relativeDay(task.date)}
              </DialogDescription>
            </DialogHeader>

            <div className="space-y-2.5">
              {task.time && (
                <DetailRow
                  icon={<Clock3 className="h-4 w-4" aria-hidden="true" />}
                  label="الوقت"
                  value={<span className="tabular font-bold">{formatTimeAr(task.time)}</span>}
                />
              )}
              {task.estimatedMinutes != null && (
                <DetailRow
                  icon={<Timer className="h-4 w-4" aria-hidden="true" />}
                  label="المدة التقديرية"
                  value={
                    <span className="tabular font-bold">
                      {task.estimatedMinutes} دقيقة
                    </span>
                  }
                />
              )}
              <DetailRow
                icon={<ListTodo className="h-4 w-4" aria-hidden="true" />}
                label="الأهمية"
                value={prio.label}
              />
              {linkChips.map((c) => {
                const I = iconByName(c.icon.toLowerCase());
                return (
                  <DetailRow
                    key={`${c.label}-${c.icon}`}
                    icon={<I className="h-4 w-4" aria-hidden="true" />}
                    label="مرتبطة بـ"
                    value={
                      <span className="max-w-[170px] truncate font-bold" style={{ color: c.color }}>
                        {c.label}
                      </span>
                    }
                  />
                );
              })}
              {task.description && (
                <div className="space-y-1.5 rounded-2xl glass-soft border border-white/[0.06] p-3.5">
                  <p className="flex items-center gap-1.5 text-[11px] font-medium text-muted-foreground">
                    <NotebookPen className="h-3.5 w-3.5" aria-hidden="true" />
                    التفاصيل
                  </p>
                  <p className="whitespace-pre-wrap text-[12.5px] leading-relaxed text-foreground/90" dir="auto">
                    {task.description}
                  </p>
                </div>
              )}
            </div>

            {/* الإجراءات */}
            <div className="mt-1 space-y-2">
              {!confirmDelete && (
                <>
                  <button
                    type="button"
                    onClick={() => void doToggle()}
                    disabled={busy}
                    className="flex h-12 w-full items-center justify-center gap-2 rounded-2xl bg-mint/15 text-[13px] font-bold text-mint transition-all hover:bg-mint/25 active:scale-[0.98] disabled:opacity-50"
                  >
                    {task.done ? (
                      <>
                        <Undo2 className="h-5 w-5" aria-hidden="true" />
                        إرجاع الإنجاز
                      </>
                    ) : (
                      <>
                        <CheckCircle2 className="h-5 w-5" aria-hidden="true" />
                        إنجاز المهمة
                      </>
                    )}
                  </button>

                  <button
                    type="button"
                    onClick={() => void schedule()}
                    disabled={busy}
                    className="flex h-12 w-full items-center justify-center gap-2 rounded-2xl bg-primary text-[13px] font-bold text-primary-foreground glow-gold transition-all hover:bg-primary/90 active:scale-[0.98] disabled:opacity-50"
                  >
                    <CalendarPlus className="h-5 w-5" aria-hidden="true" />
                    جدّولها على التقويم
                  </button>

                  <div className="flex gap-2">
                    <button
                      type="button"
                      onClick={startEdit}
                      disabled={busy}
                      className="flex h-12 flex-1 items-center justify-center gap-2 rounded-2xl glass-soft border border-white/[0.08] text-[12.5px] font-bold text-foreground/85 transition-colors hover:bg-white/[0.06] disabled:opacity-50"
                    >
                      <Pencil className="h-4 w-4" aria-hidden="true" />
                      تعديل
                    </button>
                    <button
                      type="button"
                      onClick={() => setConfirmDelete(true)}
                      disabled={busy}
                      className="flex h-12 flex-1 items-center justify-center gap-2 rounded-2xl border border-coral/40 text-[12.5px] font-bold text-coral transition-colors hover:bg-coral/10 disabled:opacity-50"
                    >
                      <Trash2 className="h-4 w-4" aria-hidden="true" />
                      حذف
                    </button>
                  </div>
                </>
              )}

              {confirmDelete && (
                <ConfirmBar
                  message={`حذف «${task.title}» نهائياً مع تذكيراتها وجلساتها المجدولة؟ لا يمكن التراجع.`}
                  confirmLabel="حذف نهائي"
                  onConfirm={() => void doDelete()}
                  onCancel={() => setConfirmDelete(false)}
                />
              )}
            </div>
          </>
        )}
      </DialogContent>
    </Dialog>
  );
}

function DetailRow({ icon, label, value }: { icon: ReactNode; label: string; value: ReactNode }) {
  return (
    <div className="flex items-center justify-between gap-3 rounded-2xl glass-soft border border-white/[0.06] px-3.5 py-2.5">
      <span className="flex shrink-0 items-center gap-1.5 text-[11px] font-medium text-muted-foreground">
        {icon}
        {label}
      </span>
      <span className="min-w-0 truncate text-[13px] text-foreground/90">{value}</span>
    </div>
  );
}
