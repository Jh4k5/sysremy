"use client";

/**
 * Systemy v3 — حوار تسجيل قياس صحي دقيق
 * لوحة أرقام + هدف سريع + ملاحظة اختيارية → logHealth (upsert لليوم).
 * حذف سجل اليوم عبر deleteHealthLog عند الخطأ.
 */

import { useEffect, useState } from "react";
import { HeartPulse, Trash2 } from "lucide-react";
import { toast } from "sonner";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import {
  ConfirmBar,
  Field,
  FormShell,
  NumberPad,
  displayAmount,
  inputCls,
} from "@/components/systemy/ui-bits";
import { deleteHealthLog, logHealth } from "@/lib/actions";
import { HEALTH_META, type DigitStyle, type HealthKind } from "@/lib/types";
import { formatNumber } from "@/lib/format";
import { cn } from "@/lib/utils";

export function MetricDialog({
  kind,
  open,
  onOpenChange,
  todayValue,
  todayNote,
  todayLogId,
  digits = "latn",
}: {
  kind: HealthKind;
  open: boolean;
  onOpenChange: (open: boolean) => void;
  todayValue: number | null;
  todayNote: string | undefined;
  todayLogId: string | null;
  digits?: DigitStyle;
}) {
  const meta = HEALTH_META[kind];
  const [value, setValue] = useState("");
  const [note, setNote] = useState("");
  const [busy, setBusy] = useState(false);
  const [confirmDelete, setConfirmDelete] = useState(false);

  /* إعادة تهيئة الحوار عند الفتح */
  useEffect(() => {
    if (open) {
      setValue(todayValue != null ? String(todayValue) : "");
      setNote(todayNote ?? "");
      setConfirmDelete(false);
    }
  }, [open, kind, todayValue, todayNote]);

  const num = parseFloat(value);

  async function save() {
    if (busy) return;
    if (!(num > 0)) {
      toast.error("أدخل قيمة أكبر من صفر");
      return;
    }
    setBusy(true);
    try {
      await logHealth(kind, Math.round(num * 100) / 100, note.trim() || undefined);
      onOpenChange(false);
    } finally {
      setBusy(false);
    }
  }

  async function removeToday() {
    if (!todayLogId || busy) return;
    setBusy(true);
    try {
      await deleteHealthLog(todayLogId);
      onOpenChange(false);
    } finally {
      setBusy(false);
    }
  }

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent
        aria-describedby={undefined}
        className="glass-deep rounded-3xl border-white/10 p-5 max-w-md w-[calc(100vw-2rem)] max-h-[88vh] overflow-y-auto sys-scroll"
      >
        <DialogHeader className="text-start">
          <DialogTitle className="flex items-center gap-2 text-start">
            <span
              className="w-8 h-8 rounded-xl flex items-center justify-center shrink-0"
              style={{ backgroundColor: `${meta.color}22`, color: meta.color }}
            >
              <HeartPulse className="w-4 h-4" aria-hidden="true" />
            </span>
            تسجيل {meta.label}
          </DialogTitle>
          <p className="mt-0.5 text-[11px] text-muted-foreground">
            {todayValue != null
              ? `مسجّل اليوم ${formatNumber(todayValue, todayValue % 1 ? 1 : 0)} ${meta.unit} — الحفظ يستبدله`
              : `أول قياس لليوم — بالـ${meta.unit}`}
          </p>
        </DialogHeader>

        <div className="space-y-3.5 pt-1">
          {/* القيمة الحية */}
          <div className="flex items-baseline justify-center gap-1.5 py-1" aria-live="polite">
            <span
              className="text-[36px] leading-none font-bold tabular-nums"
              style={{ color: meta.color }}
            >
              {value ? displayAmount(value, digits) : "—"}
            </span>
            <span className="text-[12px] text-muted-foreground">{meta.unit}</span>
          </div>

          <NumberPad
            value={value}
            onChange={setValue}
            digits={digits}
            label={`لوحة إدخال ${meta.label}`}
          />

          {/* هدف سريع */}
          {meta.target > 0 && (
            <div className="flex items-center justify-center gap-2">
              <button
                type="button"
                onClick={() => setValue(String(meta.target))}
                aria-label={`إدخال قيمة الهدف ${formatNumber(meta.target)}`}
                className={cn(
                  "h-11 px-4 rounded-xl text-[12px] font-semibold transition-colors",
                  num === meta.target
                    ? "bg-primary/20 border border-primary/45 text-primary"
                    : "glass-soft border border-black/[0.07] text-foreground/85 hover:bg-black/[0.04]"
                )}
              >
                الهدف — {formatNumber(meta.target)} {meta.unit}
              </button>
            </div>
          )}

          <Field label="ملاحظة (اختيارية)">
            <input
              value={note}
              onChange={(e) => setNote(e.target.value)}
              placeholder="ملاحظة قصيرة… مع من، أين، كيف"
              aria-label={`ملاحظة ${meta.label}`}
              className={inputCls}
            />
          </Field>

          <FormShell
            onSave={() => void save()}
            busy={busy}
            saveLabel={`حفظ ${meta.label}`}
            extra={
              todayLogId ? (
                confirmDelete ? (
                  <ConfirmBar
                    message={`حذف قياس ${meta.label} لليوم نهائياً؟`}
                    confirmLabel="حذف"
                    onConfirm={() => void removeToday()}
                    onCancel={() => setConfirmDelete(false)}
                  />
                ) : (
                  <button
                    type="button"
                    onClick={() => setConfirmDelete(true)}
                    aria-label={`حذف سجل ${meta.label} لليوم`}
                    className="w-full h-11 rounded-xl flex items-center justify-center gap-1.5 text-[12px] font-medium text-coral/90 border border-coral/25 hover:bg-coral/10 transition-colors"
                  >
                    <Trash2 className="w-4 h-4" aria-hidden="true" />
                    حذف سجل اليوم
                  </button>
                )
              ) : undefined
            }
          />
        </div>
      </DialogContent>
    </Dialog>
  );
}
