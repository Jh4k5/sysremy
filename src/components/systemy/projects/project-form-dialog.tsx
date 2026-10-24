"use client";

/**
 * Systemy v3 — نموذج إضافة/تعديل مشروع (درج سفلي)
 * الاسم + وصف + اللون + الأيقونة + الموعد + سعر الساعة (اختياري
 * للقيمة القابلة للفوترة) — وحذف بتأكيد للموجود.
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
import { addProject, deleteProject, updateProject } from "@/lib/actions";
import type { Project } from "@/lib/types";
import {
  ColorSwatches,
  ConfirmBar,
  Field,
  FormShell,
  IconGrid,
  inputCls,
  textareaCls,
} from "@/components/systemy/ui-bits";
import { cn } from "@/lib/utils";

/* ═══════════════════════ ثوابت ═══════════════════════ */

/** أيقونات مناسبة للمشاريع — من خريطة ICON_MAP المشتركة */
const PROJECT_ICONS = [
  "briefcase", "laptop", "store", "camera",
  "plane", "home", "target", "brain",
  "pen-line", "music", "gamepad-2", "graduation-cap",
  "send", "gift", "smartphone", "book-open",
] as const;

const PROJECT_COLORS = [
  "#F5B95C", "#C08457", "#5CE1E6", "#6EE7A8",
  "#FFB4A2", "#FF8E7A", "#F8B4D9", "#F5D565",
  "#FFD9A0", "#94A3B8",
] as const;

export interface ProjectFormDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  /** مشروع موجود للتعديل — null لإضافة جديد */
  project: Project | null;
  currency: string;
}

export function ProjectFormDialog({ open, onOpenChange, project, currency }: ProjectFormDialogProps) {
  const [name, setName] = useState("");
  const [description, setDescription] = useState("");
  const [color, setColor] = useState<string>("#6EE7A8");
  const [icon, setIcon] = useState<string>("briefcase");
  const [deadline, setDeadline] = useState("");
  const [rate, setRate] = useState("");
  const [busy, setBusy] = useState(false);
  const [confirmDelete, setConfirmDelete] = useState(false);

  // تعبئة النموذج عند كل فتح
  useEffect(() => {
    if (!open) return;
    setName(project?.name ?? "");
    setDescription(project?.description ?? "");
    setColor(project?.color ?? "#6EE7A8");
    setIcon(project?.icon?.toLowerCase() ?? "briefcase");
    setDeadline(project?.deadline ?? "");
    setRate(project?.ratePerHour != null && project.ratePerHour > 0 ? String(project.ratePerHour) : "");
    setConfirmDelete(false);
  }, [open, project]);

  const save = async () => {
    const cleanName = name.trim();
    if (!cleanName) {
      toast.error("سمّ مشروعك أولاً");
      return;
    }
    const rateValue = Number(rate);
    if (rate && !(rateValue > 0)) {
      toast.error("سعر الساعة يجب أن يكون رقماً أكبر من صفر — أو اتركه فارغاً");
      return;
    }
    setBusy(true);
    try {
      const payload = {
        name: cleanName,
        description: description.trim(),
        color,
        icon: icon.toLowerCase(),
        deadline: deadline || undefined,
        ratePerHour: rateValue > 0 ? Math.round(rateValue * 100) / 100 : undefined,
      };
      if (project) {
        await updateProject(project.id, payload);
      } else {
        await addProject({ ...payload, status: "active" });
      }
      onOpenChange(false);
    } finally {
      setBusy(false);
    }
  };

  const doDelete = async () => {
    if (!project) return;
    setBusy(true);
    try {
      await deleteProject(project.id);
      setConfirmDelete(false);
      onOpenChange(false);
    } finally {
      setBusy(false);
    }
  };

  return (
    <Drawer open={open} onOpenChange={onOpenChange}>
      <DrawerContent
        dir="rtl"
        className="mx-auto max-w-md rounded-t-3xl border-white/10 bg-[#0B0F1A]/95 backdrop-blur-2xl"
      >
        <DrawerHeader className="pb-1">
          <DrawerTitle className="text-right text-[15px] font-bold">
            {project ? `تعديل «${project.name}»` : "مشروع جديد"}
          </DrawerTitle>
          <DrawerDescription className="text-right text-[11px]">
            عمل حر أو هدف شخصي — بمهام وجلسات وقت ومعاملات مرتبطة
          </DrawerDescription>
        </DrawerHeader>

        <div className="sys-scroll max-h-[74vh] space-y-4 overflow-y-auto px-4 pb-6 pt-2">
          <Field label="اسم المشروع">
            <input
              value={name}
              onChange={(e) => setName(e.target.value)}
              placeholder="متجر إلكتروني · تصميم مستقل · تعلم مطور…"
              maxLength={48}
              className={inputCls}
              aria-label="اسم المشروع"
            />
          </Field>

          <Field label="الوصف (اختياري)">
            <textarea
              value={description}
              onChange={(e) => setDescription(e.target.value)}
              placeholder="ماذا يسلّم هذا المشروع؟ لمن؟"
              maxLength={240}
              className={textareaCls}
              aria-label="وصف المشروع"
            />
          </Field>

          <Field label="الأيقونة">
            <IconGrid value={icon} onChange={(i) => setIcon(i.toLowerCase())} choices={PROJECT_ICONS} />
          </Field>

          <Field label="اللون">
            <ColorSwatches value={color} onChange={setColor} choices={PROJECT_COLORS} />
          </Field>

          <div className="grid grid-cols-2 gap-3">
            <Field label="الموعد (اختياري)">
              <input
                type="date"
                value={deadline}
                onChange={(e) => setDeadline(e.target.value)}
                className={cn(inputCls, "[color-scheme:dark] tabular")}
                aria-label="موعد تسليم المشروع"
              />
            </Field>
            <Field label={`سعر الساعة (${currency})`} hint="للفوترة — اختياري">
              <input
                value={rate}
                onChange={(e) => setRate(e.target.value.replace(/[^\d.]/g, ""))}
                inputMode="decimal"
                placeholder="مثال: 80"
                className={cn(inputCls, "text-center num-display tabular")}
                aria-label="سعر الساعة"
              />
            </Field>
          </div>

          <FormShell onSave={() => void save()} busy={busy} saveLabel={project ? "حفظ التعديلات" : "إضافة المشروع"}>
            {project && !confirmDelete && (
              <button
                type="button"
                onClick={() => setConfirmDelete(true)}
                disabled={busy}
                className="h-12 w-full rounded-2xl glass-soft border border-[#FF8E7A]/25 text-[12.5px] font-bold text-[#FF8E7A] transition-colors hover:bg-[#FF8E7A]/10 disabled:opacity-50"
              >
                حذف المشروع
              </button>
            )}
            {project && confirmDelete && (
              <ConfirmBar
                message={`حذف «${project.name}» نهائياً؟ مهامه وجلساته ومعاملاته تبقى في سجلاتها — بلا ربط به.`}
                confirmLabel="حذف نهائي"
                onConfirm={() => void doDelete()}
                onCancel={() => setConfirmDelete(false)}
              />
            )}
          </FormShell>
        </div>
      </DrawerContent>
    </Drawer>
  );
}
