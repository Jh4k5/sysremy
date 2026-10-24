/**
 * Systemy v3 — أدوات مشتركة لشاشة المنزل والأسرة (خاصة بهذا المجلد)
 * حالة الاستحقاق للفواتير المنزلية وحالة صيانة الممتلكات وأنواعها.
 */

import { diffDays, formatNumber, relativeDay } from "@/lib/format";
import type { CommitmentFrequency, HomeItem } from "@/lib/types";

export const FREQ_LABELS: Record<CommitmentFrequency, string> = {
  daily: "يومي",
  weekly: "أسبوعي",
  monthly: "شهري",
  yearly: "سنوي",
};

export const HOME_KINDS = ["جهاز", "أثاث", "مركبة", "عقد صيانة"] as const;

/** شريحة حالة الاستحقاق (فواتير المنزل) */
export function dueBadge(nextDate: string, today: string): { text: string; cls: string } {
  const d = diffDays(today, nextDate);
  if (d < 0)
    return {
      text: `متأخر ${formatNumber(Math.abs(d))} ${Math.abs(d) === 1 ? "يوم" : "أيام"}`,
      cls: "bg-coral/15 text-coral",
    };
  if (d === 0) return { text: "يستحق اليوم", cls: "bg-coral/15 text-coral" };
  if (d === 1) return { text: "غداً", cls: "bg-gold/15 text-gold" };
  if (d <= 7) return { text: `بعد ${formatNumber(d)} أيام`, cls: "bg-white/[0.06] text-muted-foreground" };
  return { text: relativeDay(nextDate), cls: "bg-white/[0.06] text-muted-foreground" };
}

/** حالة الصيانة: متأخرة / قريبة (≤30 يوماً) / بعيدة / غير مجدولة */
export type ServiceLevel = "over" | "soon" | "far" | "none";

export function serviceState(item: HomeItem, today: string): { level: ServiceLevel; days: number | null } {
  if (!item.nextService) return { level: "none", days: null };
  const d = diffDays(today, item.nextService);
  if (d < 0) return { level: "over", days: d };
  if (d <= 30) return { level: "soon", days: d };
  return { level: "far", days: d };
}

export function serviceLabel(item: HomeItem, today: string): { text: string; cls: string } {
  const s = serviceState(item, today);
  if (s.level === "none" || !item.nextService)
    return { text: "بلا صيانة مجدولة", cls: "text-muted-foreground" };
  if (s.level === "over")
    return {
      text: `الصيانة متأخرة ${formatNumber(Math.abs(s.days ?? 0))} يوماً`,
      cls: "text-coral font-bold",
    };
  if (s.level === "soon")
    return { text: `الصيانة بعد ${formatNumber(s.days ?? 0)} يوماً`, cls: "text-coral/90 font-semibold" };
  return { text: `الصيانة: ${relativeDay(item.nextService, today)}`, cls: "text-muted-foreground" };
}

/** حالة الضمان: ساري حتى تاريخ / منتهٍ */
export function warrantyLabel(item: HomeItem, today: string): { text: string; expired: boolean } | null {
  if (!item.warrantyUntil) return null;
  const expired = diffDays(today, item.warrantyUntil) < 0;
  return {
    text: expired
      ? `انتهى الضمان ${formatNumber(Math.abs(diffDays(today, item.warrantyUntil)))} يوماً`
      : `الضمان حتى ${relativeDay(item.warrantyUntil, today)}`,
    expired,
  };
}
