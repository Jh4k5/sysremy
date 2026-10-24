"use client";

/**
 * Systemy v3 — بطاقة ممتلك (تفاصيل)
 * بيانات الشراء والضمان والصيانة القادمة (بلون تحذيري إن قربت أو فاتت)
 * + «سجّل صيانة اليوم» بموعد قادم قابل للتعديل (افتراضياً بعد سنة)
 * + تعديل وحذف بتأكيد.
 */

import { useEffect, useState, type ReactNode } from "react";
import { CalendarCheck2, Pencil, ShieldCheck, Trash2, Wrench } from "lucide-react";
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { deleteHomeItem, updateHomeItem } from "@/lib/actions";
import { addDaysISO, formatDate, todayISO } from "@/lib/format";
import type { HomeItem } from "@/lib/types";
import { Chip } from "@/components/systemy/glass";
import { ConfirmBar, iconByName, inputCls } from "@/components/systemy/ui-bits";
import { cn } from "@/lib/utils";
import { serviceLabel, warrantyLabel } from "./shared";

export interface HomeItemDetailsDialogProps {
  item: HomeItem;
  onClose: () => void;
  onEdit: (item: HomeItem) => void;
}

const KIND_ICONS: Record<string, string> = {
  جهاز: "zap",
  أثاث: "home",
  مركبة: "car-front",
  "عقد صيانة": "receipt",
};

export function HomeItemDetailsDialog({ item, onClose, onEdit }: HomeItemDetailsDialogProps) {
  const [busy, setBusy] = useState(false);
  const [confirmDelete, setConfirmDelete] = useState(false);
  const [serviceOpen, setServiceOpen] = useState(false);
  const [serviceDate, setServiceDate] = useState("");

  const today = todayISO();
  const service = serviceLabel(item, today);
  const warranty = warrantyLabel(item, today);

  useEffect(() => {
    setConfirmDelete(false);
    setServiceOpen(false);
    setServiceDate("");
  }, [item.id]);

  const startService = () => {
    // افتراضياً: صيانة اليوم → القادمة بعد سنة (أو أدخل تاريخاً مخصصاً)
    setServiceDate(addDaysISO(today, 365));
    setServiceOpen(true);
  };

  const saveService = async () => {
    if (!serviceDate) return;
    setBusy(true);
    try {
      await updateHomeItem(item.id, { nextService: serviceDate });
      setServiceOpen(false);
    } finally {
      setBusy(false);
    }
  };

  const doDelete = async () => {
    setBusy(true);
    try {
      await deleteHomeItem(item.id);
      onClose();
    } finally {
      setBusy(false);
    }
  };

  const KindIcon = iconByName(KIND_ICONS[item.kind] ?? "package");

  return (
    <Dialog open onOpenChange={(o) => !o && onClose()}>
      <DialogContent
        dir="rtl"
        className="mx-auto max-w-sm rounded-3xl border-white/10 bg-[#0B0F1A]/95 p-5 backdrop-blur-2xl max-h-[85dvh] overflow-y-auto sys-scroll"
      >
        <DialogHeader className="space-y-2 text-right">
          <div className="flex items-center gap-3">
            <span className="flex h-12 w-12 shrink-0 items-center justify-center rounded-full bg-primary/15 text-primary" aria-hidden="true">
              <KindIcon className="h-5 w-5" />
            </span>
            <div className="min-w-0 flex-1">
              <DialogTitle className="truncate text-right text-lg leading-snug">{item.name}</DialogTitle>
              <Chip className="mt-0.5 text-primary/90">{item.kind}</Chip>
            </div>
          </div>
          <DialogDescription className="text-right text-[11.5px]">{service.text}</DialogDescription>
        </DialogHeader>

        <div className="space-y-2">
          {item.purchaseDate && (
            <InfoRow
              icon={<CalendarCheck2 className="h-4 w-4" />}
              label="تاريخ الشراء"
              value={formatDate(item.purchaseDate, true)}
            />
          )}
          {warranty && (
            <InfoRow
              icon={<ShieldCheck className="h-4 w-4" />}
              label="الضمان"
              value={
                <span className={cn("tabular", warranty.expired ? "text-coral font-semibold" : "text-mint")}>
                  {warranty.text}
                  {!warranty.expired && item.warrantyUntil && (
                    <span className="text-muted-foreground"> · {formatDate(item.warrantyUntil, true)}</span>
                  )}
                </span>
              }
            />
          )}
          {item.nextService && (
            <InfoRow
              icon={<Wrench className="h-4 w-4" />}
              label="الصيانة القادمة"
              value={
                <span className={cn("tabular", service.cls)}>
                  {formatDate(item.nextService, true)}
                  <span className="text-muted-foreground"> · {service.text}</span>
                </span>
              }
            />
          )}
          {item.note && <InfoRow icon={<span className="text-[10px] font-bold">✎</span>} label="ملاحظة" value={item.note} />}
        </div>

        {/* ═══ الإجراءات ═══ */}
        <div className="mt-1 space-y-2">
          {!serviceOpen ? (
            <button
              type="button"
              onClick={startService}
              disabled={busy}
              className="flex h-12 w-full items-center justify-center gap-2 rounded-2xl bg-primary text-[13px] font-bold text-primary-foreground glow-gold transition-all hover:bg-primary/90 active:scale-[0.98] disabled:opacity-50"
            >
              <Wrench className="h-5 w-5" aria-hidden="true" />
              سجّل صيانة اليوم
            </button>
          ) : (
            <div className="glass-deep rounded-2xl p-4 space-y-3">
              <p className="text-[12px] font-semibold">الصيانة القادمة بعد اليوم</p>
              <input
                type="date"
                value={serviceDate}
                onChange={(e) => setServiceDate(e.target.value)}
                className={cn(inputCls, "[color-scheme:dark] tabular")}
                aria-label="تاريخ الصيانة القادمة"
              />
              <div className="flex gap-2">
                <button
                  type="button"
                  onClick={() => setServiceOpen(false)}
                  disabled={busy}
                  className="flex-1 h-11 rounded-xl glass-soft border border-white/[0.08] text-[12.5px] font-medium transition-colors hover:bg-white/[0.06] disabled:opacity-50"
                >
                  إلغاء
                </button>
                <button
                  type="button"
                  onClick={() => void saveService()}
                  disabled={busy || !serviceDate}
                  className="flex-1 h-11 rounded-xl bg-primary text-[12.5px] font-bold text-primary-foreground transition-transform active:scale-95 disabled:opacity-50"
                >
                  حفظ الموعد
                </button>
              </div>
            </div>
          )}

          {!confirmDelete ? (
            <div className="flex gap-2">
              <button
                type="button"
                onClick={() => onEdit(item)}
                disabled={busy}
                className="flex h-12 flex-1 items-center justify-center gap-1.5 rounded-2xl border border-primary/40 bg-primary/15 text-[12.5px] font-bold text-primary transition-colors hover:bg-primary/25 disabled:opacity-50"
              >
                <Pencil className="h-4 w-4" aria-hidden="true" />
                تعديل
              </button>
              <button
                type="button"
                onClick={() => setConfirmDelete(true)}
                disabled={busy}
                aria-label={`حذف ${item.name}`}
                className="flex h-12 w-12 shrink-0 items-center justify-center rounded-2xl border border-coral/40 text-coral transition-colors hover:bg-coral/10 disabled:opacity-50"
              >
                <Trash2 className="h-4 w-4" aria-hidden="true" />
              </button>
            </div>
          ) : (
            <ConfirmBar
              message={`حذف «${item.name}» من الممتلكات؟ يُحذف تذكير صيانته معه.`}
              confirmLabel="حذف نهائي"
              onConfirm={() => void doDelete()}
              onCancel={() => setConfirmDelete(false)}
            />
          )}
        </div>
      </DialogContent>
    </Dialog>
  );
}

function InfoRow({ icon, label, value }: { icon: ReactNode; label: string; value: ReactNode }) {
  return (
    <div className="flex items-start gap-3 rounded-xl glass-soft px-3 py-2.5">
      <span className="mt-0.5 shrink-0 text-muted-foreground" aria-hidden="true">
        {icon}
      </span>
      <div className="min-w-0 flex-1">
        <p className="text-[10px] text-muted-foreground">{label}</p>
        <p className="mt-0.5 text-[12.5px] font-medium leading-relaxed break-words">{value}</p>
      </div>
    </div>
  );
}
