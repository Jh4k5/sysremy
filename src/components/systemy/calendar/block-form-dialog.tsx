"use client";

/**
 * Systemy v2 — نموذج إضافة/تعديل حدث تقويمي (TimeBlock)
 * درج سفلي: عنوان + نوع (اللون يتبع النوع) + تاريخ ووقتا البداية والنهاية
 * + ربط اختياري بمهمة مفتوحة أو عادة + ملاحظة.
 */

import { useEffect, useState } from "react";
import { toast } from "sonner";
import {
  Drawer,
  DrawerContent,
  DrawerDescription,
  DrawerHeader,
  DrawerTitle,
} from "@/components/ui/drawer";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { addBlock, updateBlock } from "@/lib/actions";
import { BLOCK_TYPE_COLORS, BLOCK_TYPE_LABELS, hoursLabel } from "@/lib/calendar-utils";
import type { BlockType, Habit, Task, TimeBlock } from "@/lib/types";
import { formatDate, formatTimeAr, hhmmToMinutes, minutesToHHMM } from "@/lib/format";
import { ChipRow, Field, FormShell, inputCls, textareaCls } from "@/components/systemy/ui-bits";
import { cn } from "@/lib/utils";

/** بيانات التهيئة — id موجود = تعديل */
export interface BlockFormInit {
  id?: string;
  date: string;
  startMinute: number;
  durationMinutes: number;
  type?: BlockType;
  title?: string;
  note?: string;
  taskId?: string;
  habitId?: string;
}

const TYPE_OPTIONS = (Object.keys(BLOCK_TYPE_LABELS) as BlockType[]).map((t) => ({
  k: t,
  v: BLOCK_TYPE_LABELS[t],
}));

const DURATION_PRESETS = [30, 45, 60, 90, 120];

const selectTriggerCls =
  "h-12 rounded-xl glass-soft border border-white/[0.08] px-4 text-[13.5px] text-foreground focus:ring-0";

export interface BlockFormDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  init: BlockFormInit | null;
  /** المهام المفتوحة للربط */
  tasks: Task[];
  /** العادات النشطة للربط */
  habits: Habit[];
}

export function BlockFormDialog({ open, onOpenChange, init, tasks, habits }: BlockFormDialogProps) {
  const [title, setTitle] = useState("");
  const [type, setType] = useState<BlockType>("personal");
  const [date, setDate] = useState("");
  const [start, setStart] = useState("09:00");
  const [end, setEnd] = useState("10:00");
  const [taskId, setTaskId] = useState("");
  const [habitId, setHabitId] = useState("");
  const [note, setNote] = useState("");
  const [busy, setBusy] = useState(false);

  // تعبئة النموذج عند الفتح
  useEffect(() => {
    if (!open || !init) return;
    const s = Math.max(0, Math.min(init.startMinute, 23 * 60 + 30));
    const dur = Math.max(15, Math.min(init.durationMinutes || 60, 12 * 60));
    setTitle(init.title ?? "");
    setType(init.type ?? "personal");
    setDate(init.date);
    setStart(minutesToHHMM(s));
    setEnd(minutesToHHMM(s + dur));
    setTaskId(init.taskId ?? "");
    setHabitId(init.habitId ?? "");
    setNote(init.note ?? "");
  }, [open, init]);

  const startMin = hhmmToMinutes(start);
  const endMin = hhmmToMinutes(end);
  const duration = endMin - startMin;
  const linkedTask = tasks.find((t) => t.id === taskId);

  const applyDuration = (minutes: number) => {
    setEnd(minutesToHHMM(Math.min(startMin + minutes, 23 * 60 + 59)));
  };

  const save = async () => {
    if (!date) {
      toast.error("اختر تاريخاً صحيحاً للحدث");
      return;
    }
    if (endMin <= startMin) {
      toast.error("وقت النهاية يجب أن يكون بعد البداية");
      return;
    }
    setBusy(true);
    try {
      const payload: Omit<TimeBlock, "id" | "createdAt" | "updatedAt"> = {
        title: title.trim() || linkedTask?.title || BLOCK_TYPE_LABELS[type],
        type,
        date,
        startTime: start,
        endTime: end,
        note: note.trim() || undefined,
        taskId: taskId || undefined,
        habitId: habitId || undefined,
      };
      if (init?.id) {
        await updateBlock(init.id, payload);
      } else {
        await addBlock(payload);
      }
      onOpenChange(false);
    } finally {
      setBusy(false);
    }
  };

  const typeColor = BLOCK_TYPE_COLORS[type];

  return (
    <Drawer open={open} onOpenChange={onOpenChange}>
      <DrawerContent
        dir="rtl"
        className="mx-auto max-w-md rounded-t-3xl border-white/10 bg-[#0B0F1A]/95 backdrop-blur-2xl"
      >
        <DrawerHeader className="pb-1">
          <DrawerTitle className="text-right text-[15px] font-bold">
            {init?.id ? "تعديل الحدث" : "حدث جديد"}
          </DrawerTitle>
          <DrawerDescription className="text-right text-[11px] tabular">
            {date ? formatDate(date) : "اختر التاريخ"} · {formatTimeAr(start)} — {formatTimeAr(end)}
            {duration > 0 ? ` · ${hoursLabel(duration)}` : ""}
          </DrawerDescription>
        </DrawerHeader>

        <div className="sys-scroll max-h-[68vh] space-y-4 overflow-y-auto px-4 pb-4 pt-2">
          {/* العنوان */}
          <Field label="العنوان">
            <input
              value={title}
              onChange={(e) => setTitle(e.target.value)}
              placeholder={`مثال: ${BLOCK_TYPE_LABELS[type]}`}
              maxLength={60}
              className={inputCls}
              aria-label="عنوان الحدث"
            />
          </Field>

          {/* النوع */}
          <div className="space-y-2">
            <ChipRow
              label="النوع"
              options={TYPE_OPTIONS}
              value={type}
              onSelect={(k) => setType(k as BlockType)}
              small
            />
            <p className="flex items-center gap-1.5 text-[10.5px] text-muted-foreground/80">
              <span className="h-2.5 w-2.5 rounded-full" style={{ background: typeColor }} aria-hidden="true" />
              لون الحدث يتبع نوعه تلقائياً
            </p>
          </div>

          {/* التاريخ والوقت */}
          <div className="grid grid-cols-3 gap-2">
            <Field label="التاريخ">
              <input
                type="date"
                value={date}
                onChange={(e) => setDate(e.target.value)}
                className={cn(inputCls, "tabular px-2")}
                aria-label="تاريخ الحدث"
              />
            </Field>
            <Field label="البداية">
              <input
                type="time"
                value={start}
                onChange={(e) => setStart(e.target.value || "09:00")}
                className={cn(inputCls, "tabular px-2")}
                aria-label="وقت البداية"
              />
            </Field>
            <Field label="النهاية">
              <input
                type="time"
                value={end}
                onChange={(e) => setEnd(e.target.value || "10:00")}
                className={cn(inputCls, "tabular px-2")}
                aria-label="وقت النهاية"
              />
            </Field>
          </div>

          {/* مدد سريعة */}
          <div className="space-y-2">
            <p className="text-[11.5px] font-medium text-muted-foreground">مدة سريعة</p>
            <div className="flex flex-wrap gap-2" role="group" aria-label="مدد سريعة">
              {DURATION_PRESETS.map((p) => (
                <button
                  key={p}
                  type="button"
                  onClick={() => applyDuration(p)}
                  aria-pressed={duration === p}
                  className={cn(
                    "h-9 rounded-xl border px-3.5 text-[11.5px] font-semibold transition-colors",
                    duration === p
                      ? "border-primary/60 bg-primary/20 text-primary"
                      : "glass-soft border-white/[0.08] text-foreground/80 hover:bg-white/[0.06]"
                  )}
                >
                  <span className="tabular">{p}</span> د
                </button>
              ))}
            </div>
            {duration <= 0 && (
              <p className="text-[10.5px] text-coral">النهاية قبل البداية — عدّل الوقت ليُتاح الحفظ</p>
            )}
          </div>

          {/* ربط بمهمة (اختياري) */}
          {tasks.length > 0 && (
            <Field label="مهمة مرتبطة (اختياري)" hint="إنجاز الحدث يذكّرك بالمهمة على التقويم">
              <Select
                value={taskId || "none"}
                onValueChange={(v) => setTaskId(v === "none" ? "" : v)}
                dir="rtl"
              >
                <SelectTrigger className={selectTriggerCls} aria-label="ربط بمهمة">
                  <SelectValue placeholder="بدون" />
                </SelectTrigger>
                <SelectContent className="rounded-xl border-white/10 bg-[#10152a]">
                  <SelectItem value="none">بدون</SelectItem>
                  {tasks.map((t) => (
                    <SelectItem key={t.id} value={t.id} className="text-[13px]">
                      {t.title.length > 30 ? `${t.title.slice(0, 30)}…` : t.title}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </Field>
          )}

          {/* ربط بعادة (اختياري) */}
          {habits.length > 0 && (
            <Field label="عادة مرتبطة (اختياري)" hint="يمكنك تسجيل العادة من تفاصيل الحدث">
              <Select
                value={habitId || "none"}
                onValueChange={(v) => setHabitId(v === "none" ? "" : v)}
                dir="rtl"
              >
                <SelectTrigger className={selectTriggerCls} aria-label="ربط بعادة">
                  <SelectValue placeholder="بدون" />
                </SelectTrigger>
                <SelectContent className="rounded-xl border-white/10 bg-[#10152a]">
                  <SelectItem value="none">بدون</SelectItem>
                  {habits.map((h) => (
                    <SelectItem key={h.id} value={h.id} className="text-[13px]">
                      {h.name}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </Field>
          )}

          {/* الملاحظة + زر الحفظ */}
          <FormShell onSave={() => void save()} busy={busy || duration <= 0} saveLabel={init?.id ? "حفظ التعديل" : "إضافة الحدث"}>
            <Field label="ملاحظة (اختيارية)">
              <textarea
                value={note}
                onChange={(e) => setNote(e.target.value)}
                rows={2}
                maxLength={200}
                placeholder="مكان، تفاصيل، رابط…"
                className={textareaCls}
                aria-label="ملاحظة الحدث"
              />
            </Field>
          </FormShell>
        </div>
      </DrawerContent>
    </Drawer>
  );
}
