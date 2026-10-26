"use client";

/**
 * Systemy v4 (تكامل Life-os) — قوالب العادات الجاهزة
 * ٢١ قالباً عربياً في ٤ فئات (صحة ٨ / إنتاجية ٥ / تعلم ٤ / انضباط ٤)،
 * منقولة من Life-os `data/mock.ts:257-287` ومكيّفة لشكل عادة Systemy
 * (هدف/وحدة/إيقاع/مؤقت/تذكير).
 * إصلاح خلل Life-os المعروف: اختيار القالب هنا يُعبّئ النموذج فعلياً
 * (يستدعيه habit-form-dialog عبر onPick → prefill).
 *
 * ملاحظة تصميم: أدوات الشريط V5 (ribbon-soft/grad-ribbon) غير حاضرة في
 * globals.css بهذه البيئة، فتُعرَّف هنا كثوابت محلية بنفس قيم --grad-ribbon
 * الأصلية — بلا أي لمسة لملفات خارج الحد المسموح.
 */

import { createElement } from "react";
import { motion } from "framer-motion";
import {
  Drawer,
  DrawerContent,
  DrawerDescription,
  DrawerHeader,
  DrawerTitle,
} from "@/components/ui/drawer";
import { iconByName } from "@/components/systemy/ui-bits";
import { formatTimeAr } from "@/lib/format";
import { cn } from "@/lib/utils";

/* ═══════════════ ثوابت لغة «الشريط» V5 (محلية — نفس قيم الأصل) ═══════════════ */

/** تدرج الشريط الكامل — تقدم/حدود/إبراز */
export const RIBBON_GRAD = "linear-gradient(90deg, #00cdfe, #3e9bf6 32%, #febb18 66%, #fd4c10)";

/** خلفية شريط خافتة للأسطح (ما يعادل .ribbon-soft) */
export const RIBBON_SOFT =
  "linear-gradient(90deg, rgba(0,205,254,0.14), rgba(62,155,246,0.14) 32%, rgba(254,187,24,0.16) 66%, rgba(253,76,16,0.14))";

/** ضغط V5 — 0.96 بالضبط، انتقالات محدّدة الخصائص (ممنوع transition:all) */
export const RIBBON_PRESS =
  "transition-[transform,color,background-color,border-color] duration-150 ease-out active:scale-[0.96]";

/* ═══════════════ فئات القوالب ═══════════════ */

export type HabitTemplateKind = "health" | "productivity" | "learning" | "discipline";

export const TEMPLATE_KIND_META: Record<HabitTemplateKind, { label: string }> = {
  health: { label: "الصحة" },
  productivity: { label: "الإنتاجية" },
  learning: { label: "التعلم" },
  discipline: { label: "الانضباط" },
};

const TEMPLATE_KINDS: HabitTemplateKind[] = ["health", "productivity", "learning", "discipline"];

/* ═══════════════ شكل القالب ═══════════════ */

export interface HabitTemplate {
  /** الاسم العربي المعروض — ويُستخدم لتعبئة اسم العادة */
  name: string;
  /** اسم أيقونة lucide (من خريطة ui-bits) */
  icon: string;
  /** لون من لوحة Systemy (COLOR_CHOICES) */
  color: string;
  kind: HabitTemplateKind;
  /** عدد المرات المستهدفة يومياً — 1 إن كانت مرة تكفي */
  target?: number;
  /** وحدة القياس: كوب · صفحة … فارغ = مرة */
  unit?: string;
  cadence: "daily" | "weekly";
  /** مؤقت جلسة اختياري بالدقائق */
  timerMinutes?: number;
  /** وقت تذكير يومي اختياري HH:mm */
  remindAt?: string;
}

/* ═══════════════ الفهرس — ٢١ قالباً منقولاً من Life-os ومكيّفاً ═══════════════ */

export const HABIT_TEMPLATES: HabitTemplate[] = [
  // ── الصحة (٨) ──
  { name: "اشرب ٨ أكواب ماء", icon: "droplets", color: "#5CE1E6", kind: "health", target: 8, unit: "كوب", cadence: "daily" },
  { name: "مشي ٣٠ دقيقة", icon: "footprints", color: "#6EE7A8", kind: "health", target: 1, cadence: "daily", timerMinutes: 30, remindAt: "07:00" },
  { name: "رياضة ٤٥ دقيقة", icon: "dumbbell", color: "#F5D565", kind: "health", target: 1, cadence: "daily", timerMinutes: 45, remindAt: "07:00" },
  { name: "نم قبل ١١ مساءً", icon: "moon", color: "#8EC5FF", kind: "health", target: 1, cadence: "daily", remindAt: "21:00" },
  { name: "تأمل ١٠ دقائق", icon: "leaf", color: "#C4B5FD", kind: "health", target: 1, cadence: "daily", timerMinutes: 10, remindAt: "07:00" },
  { name: "فيتامينات الصباح", icon: "heart-pulse", color: "#6EE7A8", kind: "health", target: 1, cadence: "daily", remindAt: "07:00" },
  { name: "إفطار صحي", icon: "salad", color: "#FFB4A2", kind: "health", target: 1, cadence: "daily", remindAt: "07:00" },
  { name: "شدّ عضلاتك ١٠ دقائق", icon: "activity", color: "#FFD9A0", kind: "health", target: 1, cadence: "daily", timerMinutes: 10 },
  // ── الإنتاجية (٥) ──
  { name: "خطّط يومك كل صباح", icon: "check-square", color: "#5CE1E6", kind: "productivity", target: 1, cadence: "daily", remindAt: "07:00" },
  { name: "راجع أسبوعك", icon: "calendar-days", color: "#C4B5FD", kind: "productivity", target: 1, cadence: "weekly", remindAt: "21:00" },
  { name: "بلا هاتف أول ساعة", icon: "smartphone", color: "#FFB4A2", kind: "productivity", target: 1, cadence: "daily", timerMinutes: 60, remindAt: "07:00" },
  { name: "صفّر صندوق الوارد", icon: "send", color: "#F5D565", kind: "productivity", target: 1, cadence: "daily", remindAt: "12:00" },
  { name: "تعلّم شيئاً جديداً ٢٠ دقيقة", icon: "brain", color: "#F8B4D9", kind: "productivity", target: 1, cadence: "daily", timerMinutes: 20 },
  // ── التعلم (٤) ──
  { name: "اقرأ ١٠ دقائق", icon: "book-open", color: "#F5D565", kind: "learning", target: 1, cadence: "daily", timerMinutes: 10, remindAt: "21:00" },
  { name: "تعلّم لغة ١٥ دقيقة", icon: "languages", color: "#6EE7A8", kind: "learning", target: 1, cadence: "daily", timerMinutes: 15 },
  { name: "بودكاست تعليمي", icon: "music", color: "#F8B4D9", kind: "learning", target: 1, cadence: "daily", timerMinutes: 30 },
  { name: "اكتب يومياتك", icon: "pen-line", color: "#5CE1E6", kind: "learning", target: 1, cadence: "daily", timerMinutes: 10, remindAt: "21:00" },
  // ── الانضباط (٤) ──
  { name: "صيام متقطع", icon: "timer", color: "#C08457", kind: "discipline", target: 1, cadence: "daily" },
  { name: "دش بارد", icon: "zap", color: "#5CE1E6", kind: "discipline", target: 1, cadence: "daily", remindAt: "07:00" },
  { name: "يوم بلا سكر", icon: "flame", color: "#F5D565", kind: "discipline", target: 1, cadence: "daily" },
  { name: "امشِ بدل السيارة", icon: "footprints", color: "#6EE7A8", kind: "discipline", target: 1, cadence: "weekly" },
];

/** سطر وصف القالب: الهدف · المؤقت · الإيقاع · التذكير */
export function templateMeta(t: HabitTemplate): string {
  const parts: string[] = [];
  if (t.target && t.target > 1) parts.push(`${t.target} ${t.unit ?? "مرة"}`);
  if (t.timerMinutes) parts.push(`جلسة ${t.timerMinutes} دقيقة`);
  parts.push(t.cadence === "weekly" ? "أسبوعية" : "يومية");
  if (t.remindAt) parts.push(`تذكير ${formatTimeAr(t.remindAt)}`);
  return parts.join(" · ");
}

/* ═══════════════ لوحة اختيار القوالب ═══════════════ */

/**
 * لوحة سفلية (نفس نمط Drawer المتبع في habit-form-dialog) تعرض القوالب
 * الـ٢١ مجمّعة في ٤ فئات: شريحة فئة ribbon-soft + صفوف أيقونة/اسم/وصف
 * بضغط .press — والاختيار يستدعي onPick(قالب) ويغلق اللوحة.
 */
export function HabitTemplatesSheet({
  open,
  onOpenChange,
  onPick,
}: {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onPick: (template: HabitTemplate) => void;
}) {
  const pick = (t: HabitTemplate) => {
    onOpenChange(false);
    onPick(t);
  };

  let rowIdx = 0; // عدّاد عام لتقييد المجموع الزمني للـ stagger تحت 300ms

  return (
    <Drawer open={open} onOpenChange={onOpenChange}>
      <DrawerContent
        dir="rtl"
        className="mx-auto max-w-md rounded-t-3xl border-black/[0.08] bg-white/95 backdrop-blur-xl shadow-[0_-12px_40px_-16px_rgba(23,33,43,0.3)]"
      >
        {/* خيط الشريط أعلى اللوحة — عنصر div حقيقي (نمط V5 للوحات) */}
        <div className="mx-10 h-0.5 rounded-full" style={{ background: RIBBON_GRAD }} aria-hidden="true" />

        <DrawerHeader className="pb-1">
          <DrawerTitle className="text-right text-[15px] font-bold">قوالب جاهزة</DrawerTitle>
          <DrawerDescription className="text-right text-[11px]">
            ٢١ فكرة عادة مجرّبة — اختر واحداً فيُعبّأ النموذج فوراً، ثم عدّله كما تشاء
          </DrawerDescription>
        </DrawerHeader>

        <div className="sys-scroll max-h-[68vh] space-y-5 overflow-y-auto px-4 pb-5 pt-1">
          {TEMPLATE_KINDS.map((kind) => {
            const group = HABIT_TEMPLATES.filter((t) => t.kind === kind);
            return (
              <section key={kind} aria-label={`قوالب ${TEMPLATE_KIND_META[kind].label}`}>
                <div className="mb-2 flex items-center gap-2 px-1">
                  <span
                    className="inline-flex h-6 items-center rounded-full px-2.5 text-[10.5px] font-bold text-foreground/90"
                    style={{ background: RIBBON_SOFT }}
                  >
                    {TEMPLATE_KIND_META[kind].label}
                  </span>
                  <span className="text-[10px] text-muted-foreground">
                    {group.length} {group.length === 1 ? "قالب" : "قوالب"}
                  </span>
                </div>

                <div className="space-y-1.5">
                  {group.map((t) => {
                    const delay = Math.min(rowIdx++ * 0.02, 0.28);
                    return (
                      <motion.button
                        key={t.name}
                        type="button"
                        initial={{ opacity: 0, y: 8 }}
                        animate={{ opacity: 1, y: 0 }}
                        transition={{ duration: 0.3, delay, ease: [0.22, 1, 0.36, 1] }}
                        onClick={() => pick(t)}
                        aria-label={`اختيار قالب ${t.name}`}
                        className={cn(
                          "glass-soft flex w-full items-center gap-3 rounded-2xl border border-black/[0.05] px-3 py-2.5 text-start",
                          "min-h-11 hover:border-primary/25",
                          RIBBON_PRESS
                        )}
                      >
                        <span
                          className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl"
                          style={{
                            background: `${t.color}1f`,
                            border: `1px solid ${t.color}3d`,
                            color: t.color,
                          }}
                        >
                          {createElement(iconByName(t.icon), { className: "h-5 w-5", "aria-hidden": true })}
                        </span>
                        <span className="min-w-0 flex-1">
                          <span className="block truncate text-[13px] font-bold leading-4">{t.name}</span>
                          <span className="mt-0.5 block truncate text-[10px] text-muted-foreground">
                            {templateMeta(t)}
                          </span>
                        </span>
                      </motion.button>
                    );
                  })}
                </div>
              </section>
            );
          })}
        </div>
      </DrawerContent>
    </Drawer>
  );
}
