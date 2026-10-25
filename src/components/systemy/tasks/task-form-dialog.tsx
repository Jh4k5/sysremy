"use client";

/**
 * Systemy v3 — نموذج «مهمة جديدة» (Dialog)
 * عنوان/وصف/تاريخ/وقت/أولوية/تقدير دقائق + روابط اختيارية
 * بالمشاريع/المقررات/الأشخاص/الأهداف/الرحلات — عبر addTask.
 */

import { useEffect, useState } from "react";
import { toast } from "sonner";
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { addTask } from "@/lib/actions";
import { todayISO } from "@/lib/format";
import { FormShell } from "@/components/systemy/ui-bits";
import {
  TaskFields,
  emptyTaskForm,
  formToTaskInput,
  type TaskFormValue,
  type TaskLinkOptions,
} from "./task-fields";

export interface TaskFormDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  links: TaskLinkOptions;
  /** تاريخ مبدئي اختياري */
  presetDate?: string | null;
}

export function TaskFormDialog({ open, onOpenChange, links, presetDate }: TaskFormDialogProps) {
  const [value, setValue] = useState<TaskFormValue>(emptyTaskForm());
  const [busy, setBusy] = useState(false);

  // تعبئة النموذج عند كل فتح
  useEffect(() => {
    if (!open) return;
    setValue(emptyTaskForm(presetDate ?? todayISO()));
  }, [open, presetDate]);

  const patch = (p: Partial<TaskFormValue>) => setValue((v) => ({ ...v, ...p }));

  const save = async () => {
    if (busy) return;
    if (!value.title.trim()) {
      toast.error("اكتب عنوان المهمة");
      return;
    }
    const est = value.estimatedMinutes.trim();
    if (est && !(Number(est) >= 1 && Number(est) <= 1440)) {
      toast.error("المدة التقديرية بين دقيقة و1440 دقيقة");
      return;
    }
    setBusy(true);
    try {
      await addTask({ ...formToTaskInput(value), done: false });
      onOpenChange(false);
    } finally {
      setBusy(false);
    }
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent
        dir="rtl"
        className="mx-auto max-w-sm rounded-3xl border-black/[0.08] bg-white/95 p-5 backdrop-blur-xl shadow-[0_24px_60px_-20px_rgba(23,33,43,0.35)]"
      >
        <DialogHeader className="space-y-1 text-right">
          <DialogTitle className="text-right text-[15px] font-bold">مهمة جديدة</DialogTitle>
          <DialogDescription className="text-right text-[11px]">
            وقت وأولوية وروابط — تظهر في نظامه فوراً
          </DialogDescription>
        </DialogHeader>

        <div className="sys-scroll max-h-[62vh] space-y-4 overflow-y-auto px-0.5 pb-1 pt-1">
          <TaskFields key={open ? "task-form-open" : "task-form-closed"} value={value} onPatch={patch} links={links} />
          <FormShell onSave={() => void save()} busy={busy} saveLabel="أضف المهمة" />
        </div>
      </DialogContent>
    </Dialog>
  );
}
