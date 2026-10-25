"use client";

/**
 * Systemy v3 — نموذج إضافة/تعديل هدف (درج سفلي)
 * الاسم + رمز (8 خيارات) + اللون + المبلغ المستهدف (لوحة أرقام)
 * + المساهمة الشهرية + الموعد المستهدف — وحذف بتأكيد للموجود.
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
import { addGoal, deleteGoal, updateGoal } from "@/lib/actions";
import { formatMoney } from "@/lib/format";
import type { DigitStyle, Goal } from "@/lib/types";
import {
  ColorSwatches,
  ConfirmBar,
  Field,
  FormShell,
  NumberPad,
  displayAmount,
  inputCls,
} from "@/components/systemy/ui-bits";
import { cn } from "@/lib/utils";

/* ═══════════════════════ ثوابت ═══════════════════════ */

/** 8 رموز حسب المواصفة */
const GOAL_EMOJI = ["🏠", "🚗", "✈️", "💻", "📚", "🎓", "💍", "🕌"] as const;

/** ألوان دافئة/نعناعية — بلا درجات زرقاء */
const GOAL_COLORS = [
  "#F5B95C", "#C08457", "#5CE1E6", "#6EE7A8",
  "#FFB4A2", "#FF8E7A", "#F8B4D9", "#F5D565",
  "#FFD9A0", "#94A3B8",
] as const;

export interface GoalFormDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  /** هدف موجود للتعديل — null لإضافة جديد */
  goal: Goal | null;
  nextOrder: number;
  digits: DigitStyle;
  currency: string;
}

export function GoalFormDialog({
  open,
  onOpenChange,
  goal,
  nextOrder,
  digits,
  currency,
}: GoalFormDialogProps) {
  const [name, setName] = useState("");
  const [emoji, setEmoji] = useState<string>("🌙");
  const [color, setColor] = useState<string>("#F5B95C");
  const [target, setTarget] = useState("");
  const [monthly, setMonthly] = useState("");
  const [targetDate, setTargetDate] = useState("");
  const [busy, setBusy] = useState(false);
  const [confirmDelete, setConfirmDelete] = useState(false);

  // تعبئة النموذج عند كل فتح
  useEffect(() => {
    if (!open) return;
    setName(goal?.name ?? "");
    setEmoji(goal?.emoji ?? "🌙");
    setColor(goal?.color ?? "#F5B95C");
    setTarget(goal ? String(goal.targetAmount) : "");
    setMonthly(goal && goal.monthly > 0 ? String(goal.monthly) : "");
    setTargetDate(goal?.targetDate ?? "");
    setConfirmDelete(false);
  }, [open, goal]);

  const save = async () => {
    const cleanName = name.trim();
    if (!cleanName) {
      toast.error("سمّ هدفك أولاً");
      return;
    }
    const targetValue = Number(target);
    if (!(targetValue > 0)) {
      toast.error("أدخل المبلغ المستهدف");
      return;
    }
    setBusy(true);
    try {
      const payload = {
        name: cleanName,
        emoji,
        color,
        targetAmount: Math.round(targetValue * 100) / 100,
        monthly: Math.round((Number(monthly) || 0) * 100) / 100,
        targetDate: targetDate || undefined,
      };
      if (goal) {
        // التعديل لا يمس savedAmount — المساهمات تُدار من التفاصيل
        await updateGoal(goal.id, payload);
      } else {
        await addGoal({
          ...payload,
          savedAmount: 0,
          archived: false,
          order: nextOrder,
        });
      }
      onOpenChange(false);
    } finally {
      setBusy(false);
    }
  };

  const doDelete = async () => {
    if (!goal) return;
    setBusy(true);
    try {
      await deleteGoal(goal.id);
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
        className="mx-auto max-w-md rounded-t-3xl border-black/[0.08] bg-white/95 backdrop-blur-xl shadow-[0_-12px_40px_-16px_rgba(23,33,43,0.3)]"
      >
        <DrawerHeader className="pb-1">
          <DrawerTitle className="text-right text-[15px] font-bold">
            {goal ? `تعديل «${goal.name}»` : "هدف جديد"}
          </DrawerTitle>
          <DrawerDescription className="text-right text-[11px]">
            وعاء ادخار مسمّى — مادي أو معنوي، بموعد ومساهمة شهرية
          </DrawerDescription>
        </DrawerHeader>

        <div className="sys-scroll max-h-[74vh] space-y-4 overflow-y-auto px-4 pb-6 pt-2">
          <Field label="اسم الهدف">
            <input
              value={name}
              onChange={(e) => setName(e.target.value)}
              placeholder="حجة · لابتوب · سداد دين…"
              maxLength={40}
              className={inputCls}
              aria-label="اسم الهدف"
            />
          </Field>

          <Field label="الرمز">
            <div className="grid grid-cols-4 gap-2" role="radiogroup" aria-label="اختيار رمز الهدف">
              {GOAL_EMOJI.map((e) => {
                const active = emoji === e;
                return (
                  <button
                    key={e}
                    type="button"
                    role="radio"
                    aria-checked={active}
                    aria-label={`الرمز ${e}`}
                    onClick={() => setEmoji(e)}
                    className={cn(
                      "h-11 min-h-11 rounded-xl flex items-center justify-center text-[20px] transition-all",
                      active
                        ? "bg-primary/25 border border-primary/50 scale-105"
                        : "glass-soft border border-black/[0.05] hover:bg-black/[0.04]",
                    )}
                  >
                    {e}
                  </button>
                );
              })}
            </div>
          </Field>

          <Field label="المبلغ المستهدف">
            <div className="glass-soft rounded-2xl p-4 flex flex-col items-center gap-1">
              <div className="num-display text-[32px] text-primary tabular" aria-live="polite">
                {displayAmount(target, digits) || "0"}
              </div>
              <span className="text-[12px] text-muted-foreground">{currency}</span>
            </div>
            <NumberPad
              value={target}
              onChange={setTarget}
              digits={digits}
              className="mt-3"
              label="لوحة المبلغ المستهدف"
            />
          </Field>

          <div className="grid grid-cols-2 gap-3">
            <Field label="المساهمة الشهرية" hint="اختيارية — للوتيرة والمحاكاة">
              <input
                value={monthly}
                onChange={(e) => setMonthly(e.target.value.replace(/[^\d.]/g, ""))}
                inputMode="decimal"
                placeholder="0"
                className={cn(inputCls, "text-center num-display tabular")}
                aria-label="المساهمة الشهرية"
              />
            </Field>
            <Field label="الموعد المستهدف" hint="اختياري — «يكتمل يوم…»">
              <input
                type="date"
                value={targetDate}
                onChange={(e) => setTargetDate(e.target.value)}
                className={cn(inputCls, "[color-scheme:dark] tabular")}
                aria-label="التاريخ المستهدف"
              />
            </Field>
          </div>

          <Field label="اللون">
            <ColorSwatches value={color} onChange={setColor} choices={GOAL_COLORS} />
          </Field>

          {goal && goal.monthly > 0 && (
            <p className="rounded-xl glass-soft px-3 py-2.5 text-[10.5px] leading-relaxed text-muted-foreground">
              المساهمة الشهرية الحالية {formatMoney(goal.monthly, currency)} — محفوظاته{" "}
              {formatMoney(goal.savedAmount, currency)} تُدار من شاشة التفاصيل.
            </p>
          )}

          <FormShell onSave={() => void save()} busy={busy} saveLabel={goal ? "حفظ التعديلات" : "إضافة الهدف"}>
            {goal && !confirmDelete && (
              <button
                type="button"
                onClick={() => setConfirmDelete(true)}
                disabled={busy}
                className="h-12 w-full rounded-2xl glass-soft border border-[#FF8E7A]/25 text-[12.5px] font-bold text-[#FF8E7A] transition-colors hover:bg-[#FF8E7A]/10 disabled:opacity-50"
              >
                حذف الهدف
              </button>
            )}
            {goal && confirmDelete && (
              <ConfirmBar
                message={`حذف «${goal.name}» نهائياً؟ المحفوظ فيه ${formatMoney(goal.savedAmount, currency)} يُحذف معه — لا يمكن التراجع.`}
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
