"use client";

/**
 * لوحة الأرقام — آلة حاسبة (V4-B · V5-س لمسة الشريط).
 *
 * تخطيط آلة حاسبة حقيقي 7 8 9 / 4 5 6 / 1 2 3 / . 0 ⌫ بترتيب LTR بصرياً
 * (dir="ltr" على الشبكة كي لا تنعكس الأعمدة في RTL — درس PR-2).
 * أزرار ضخمة قابلة للمس (h-14 → h-16 على الشاشات الأكبر، ≥44px دائماً).
 * V5: الضغط لمسي — `.press` (scale 0.96 خلال 150ms) + تغيير خلفية فوري
 * (bg-white/10) — تفاعل عالي التكرار = حركة دنيا بلا ارتداد.
 * اهتزاز haptic-like إن توفر، ودعم لوحة مفاتيح فعلية عند التركيز.
 * منطق الإدخال (pressAmountKey) مُصدَّر لإعادة الاستخدام والاختبار.
 */
import { Delete } from "lucide-react";
import { displayDigit } from "@/components/systemy/ui-bits";
import type { DigitStyle } from "@/lib/types";
import { cn } from "@/lib/utils";

/** أسماء الأرقام بالعربية — للقراءة الشاشية */
const KEY_ARIA: Record<string, string> = {
  "0": "صفر",
  "1": "واحد",
  "2": "اثنان",
  "3": "ثلاثة",
  "4": "أربعة",
  "5": "خمسة",
  "6": "ستة",
  "7": "سبعة",
  "8": "ثمانية",
  "9": "تسعة",
  ".": "فاصلة عشرية",
  back: "مسح",
};

/**
 * منطق ضغطة واحدة على لوحة المبلغ — نص خام في/خارج:
 * - ⌫ يحذف آخر محرف
 * - النقطة لا تُضاف إن وُجدت نقطة أو كان المبلغ فارغاً (تُسبق بصفر)
 * - حد أقصى 9 خانات صحيحة وكسران عشريان
 */
export function pressAmountKey(value: string, key: string): string {
  if (key === "back") return value.slice(0, -1);
  if (key === ".") {
    if (value.includes(".")) return value;
    return value === "" ? "0." : `${value}.`;
  }
  if (key >= "0" && key <= "9") {
    const next = value === "0" ? key : value + key;
    const [int, frac] = next.split(".");
    if (int.length > 9) return value;
    if (frac !== undefined && frac.length > 2) return value;
    return next;
  }
  return value;
}

const PAD_KEYS = ["7", "8", "9", "4", "5", "6", "1", "2", "3", ".", "0", "back"] as const;

export function AmountPad({
  value,
  onChange,
  digits = "latn",
  className,
  label = "لوحة إدخال المبلغ",
  padRef,
}: {
  value: string;
  onChange: (next: string) => void;
  digits?: DigitStyle;
  className?: string;
  label?: string;
  /** مرجع لتركيز اللوحة (انتقال لوحة المفاتيح الفعلية من حقل الوصف) */
  padRef?: React.Ref<HTMLDivElement>;
}) {
  const press = (key: string) => {
    if (typeof navigator !== "undefined" && "vibrate" in navigator) navigator.vibrate?.(8);
    onChange(pressAmountKey(value, key));
  };

  // دعم لوحة المفاتيح الفعلية عند تركيز اللوحة — نفس منطق الأزرار
  const onKeyDown = (e: React.KeyboardEvent<HTMLDivElement>) => {
    if (e.repeat) return;
    if ((e.key >= "0" && e.key <= "9") || e.key === ".") {
      e.preventDefault();
      press(e.key);
    } else if (e.key === "Backspace") {
      e.preventDefault();
      press("back");
    }
  };

  return (
    <div
      ref={padRef}
      role="group"
      aria-label={label}
      dir="ltr"
      tabIndex={0}
      onKeyDown={onKeyDown}
      className={cn("grid grid-cols-3 gap-2.5 outline-none focus-visible:ring-1 focus-visible:ring-primary/30 rounded-2xl", className)}
      style={{ touchAction: "manipulation" }}
    >
      {PAD_KEYS.map((k) => {
        const isBack = k === "back";
        const isDot = k === ".";
        return (
          <button
            key={k}
            type="button"
            onClick={() => press(k)}
            aria-label={KEY_ARIA[k] ?? k}
            className={cn(
              "h-14 min-h-14 sm:h-16 sm:min-h-16 rounded-2xl select-none",
              "glass-soft border-white/[0.06] text-foreground",
              "text-2xl font-bold tabular-nums",
              // V5: ضغط لمسي — القياس 0.96 خلال 150ms (`.press`) وخلفية فورية ≤150ms
              "press active:bg-white/10 active:border-white/20",
              isBack && "text-muted-foreground text-xl",
              isDot && "text-xl pb-1"
            )}
          >
            {isBack ? (
              <Delete className="h-6 w-6 mx-auto" aria-hidden="true" />
            ) : (
              displayDigit(k, digits)
            )}
          </button>
        );
      })}
    </div>
  );
}
