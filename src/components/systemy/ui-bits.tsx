/**
 * Systemy v2 — أدوات واجهة مشتركة لكل الشاشات
 * لوحة أرقام، حالات فراغ، صفوف شريح، قوائم اختيار أيقونة/لون (التخصيص العالي).
 */
"use client";

import { type ReactNode } from "react";
import { Delete, Sparkles, Check } from "lucide-react";
import { motion } from "framer-motion";
import type { DigitStyle } from "@/lib/types";
import { cn } from "@/lib/utils";

// ═══════════════════════ لوحة الأرقام ═══════════════════════

const ARAB_DIGITS = ["٠", "١", "٢", "٣", "٤", "٥", "٦", "٧", "٨", "٩"];

export function displayDigit(ch: string, digits: DigitStyle): string {
  if (ch >= "0" && ch <= "9") return digits === "arab" ? ARAB_DIGITS[Number(ch)] : ch;
  if (ch === ".") return digits === "arab" ? "٫" : ".";
  return ch;
}

export function displayAmount(raw: string, digits: DigitStyle): string {
  if (!raw) return digits === "arab" ? "٠" : "0";
  const [int, frac] = raw.split(".");
  const grouped = int.replace(/\B(?=(\d{3})+(?!\d))/g, ",");
  const out = frac !== undefined ? `${grouped}.${frac}` : grouped;
  return Array.from(out)
    .map((ch) => (ch === "," ? (digits === "arab" ? "٬" : ",") : displayDigit(ch, digits)))
    .join("");
}

export function applyPadKey(value: string, key: string): string {
  if (key === "back") return value.slice(0, -1);
  if (key === ".") {
    if (value.includes(".")) return value;
    return value === "" ? "0." : `${value}.`;
  }
  if (key >= "0" && key <= "9") {
    const next = value === "0" ? key : value + key;
    const [int, frac] = next.split(".");
    if (int.length > 8) return value;
    if (frac !== undefined && frac.length > 2) return value;
    return next;
  }
  return value;
}

const PAD_KEYS = ["1", "2", "3", "4", "5", "6", "7", "8", "9", ".", "0", "back"] as const;

export function NumberPad({
  value,
  onChange,
  digits = "latn",
  className,
  label = "لوحة إدخال المبلغ",
}: {
  value: string;
  onChange: (next: string) => void;
  digits?: DigitStyle;
  className?: string;
  label?: string;
}) {
  const press = (key: string) => {
    if (typeof navigator !== "undefined" && "vibrate" in navigator) navigator.vibrate?.(8);
    onChange(applyPadKey(value, key));
  };

  return (
    <div
      role="group"
      aria-label={label}
      dir="ltr"
      className={cn("grid grid-cols-3 gap-2", className)}
      style={{ touchAction: "manipulation" }}
    >
      {PAD_KEYS.map((k) => {
        const isBack = k === "back";
        const aria = isBack ? "مسح رقم" : k === "." ? "فاصلة عشرية" : `الرقم ${k}`;
        return (
          <button
            key={k}
            type="button"
            onClick={() => press(k)}
            aria-label={aria}
            className={cn(
              "h-11 min-h-11 rounded-xl border text-xl font-bold tabular-nums select-none",
              "glass-soft border-white/[0.08] text-foreground transition-all",
              "hover:bg-white/[0.08] active:scale-95 active:border-primary/40",
              isBack && "text-muted-foreground text-lg"
            )}
          >
            {isBack ? <Delete className="h-5 w-5 mx-auto" aria-hidden="true" /> : displayDigit(k, digits)}
          </button>
        );
      })}
    </div>
  );
}

// ═══════════════════════ حالة فراغ أنيقة ═══════════════════════

export function EmptyState({
  icon,
  title,
  hint,
  actionLabel,
  onAction,
  compact = false,
}: {
  icon?: ReactNode;
  title: string;
  hint?: string;
  actionLabel?: string;
  onAction?: () => void;
  compact?: boolean;
}) {
  return (
    <div className={cn("flex flex-col items-center justify-center text-center gap-2.5", compact ? "py-6" : "py-10")}>
      <span className="w-14 h-14 rounded-3xl glass-soft flex items-center justify-center text-primary/80">
        {icon ?? <Sparkles className="w-6 h-6" />}
      </span>
      <p className="text-[13px] font-semibold text-foreground/90">{title}</p>
      {hint && <p className="text-[11.5px] text-muted-foreground leading-relaxed max-w-[240px]">{hint}</p>}
      {actionLabel && onAction && (
        <button
          onClick={onAction}
          className="mt-1.5 h-10 px-5 rounded-2xl bg-primary/15 border border-primary/30 text-primary text-[12px] font-bold hover:bg-primary/25 transition-colors"
        >
          {actionLabel}
        </button>
      )}
    </div>
  );
}

// ═══════════════════════ صف شريح (اختيارات) ═══════════════════════

export function ChipRow({
  label,
  options,
  value,
  onSelect,
  small = false,
}: {
  label: string;
  options: Array<{ k: string; v: string }>;
  value: string;
  onSelect: (k: string) => void;
  small?: boolean;
}) {
  return (
    <div className="space-y-2">
      <p className="text-[11.5px] font-medium text-muted-foreground">{label}</p>
      <div className="flex flex-wrap gap-2" role="radiogroup" aria-label={label}>
        {options.map((o) => {
          const active = value === o.k;
          return (
            <button
              key={o.k}
              type="button"
              role="radio"
              aria-checked={active}
              onClick={() => onSelect(o.k)}
              className={cn(
                "rounded-xl border font-medium transition-colors",
                small ? "h-9 px-3 text-[11.5px]" : "h-11 px-4 text-[13px]",
                active
                  ? "bg-primary/20 border-primary/50 text-primary"
                  : "glass-soft border-white/[0.08] text-foreground/80 hover:bg-white/[0.06]"
              )}
            >
              {o.v}
            </button>
          );
        })}
      </div>
    </div>
  );
}

// ═══════════════════════ هيكل نموذج + زر حفظ لاصق ═══════════════════════

/**
 * زر الحفظ لاصق أسفل منطقة التمرير — يبقى مرئياً دائماً فوق لوحة المفاتيح
 * حتى لو طال النموذج (إصلاح «زر الحفظ لا يظهر» من تدقيق المرحلة صفر).
 */
export function FormShell({
  children,
  onSave,
  busy,
  saveLabel,
  extra,
}: {
  children?: ReactNode;
  onSave: () => void;
  busy: boolean;
  saveLabel: string;
  extra?: ReactNode;
}) {
  return (
    <div className="space-y-4">
      {children}
      {extra}
      <div className="sticky bottom-0 z-10 pt-2 pb-1 -mb-1 bg-gradient-to-t from-[#0B0F1A] via-[#0B0F1Af2] to-transparent">
        <button
          onClick={onSave}
          disabled={busy}
          className="w-full h-14 rounded-2xl bg-primary text-primary-foreground text-[15px] font-bold flex items-center justify-center gap-2 glow-gold transition-transform active:scale-[0.98] disabled:opacity-50"
        >
          <Check className="w-5 h-5" />
          {busy ? "جارٍ الحفظ…" : saveLabel}
        </button>
      </div>
    </div>
  );
}

/** حزمة زر الحفظ الثابت خارج التمرير — للنماذج المالية (TxForm) في تذييل اللوحة */
export function StickySave({
  onSave,
  busy,
  saveLabel,
  secondary,
}: {
  onSave: () => void;
  busy: boolean;
  saveLabel: string;
  secondary?: ReactNode;
}) {
  return (
    <div className="shrink-0 px-4 pt-2 pb-2.5 border-t border-white/[0.07] bg-[#0B0F1A]/95 backdrop-blur-md">
      <button
        onClick={onSave}
        disabled={busy}
        className="w-full h-14 rounded-2xl bg-primary text-primary-foreground text-[15px] font-bold flex items-center justify-center gap-2 glow-gold transition-transform active:scale-[0.98] disabled:opacity-50"
      >
        <Check className="w-5 h-5" />
        {busy ? "جارٍ الحفظ…" : saveLabel}
      </button>
      {secondary}
    </div>
  );
}

/** حقل نصي موحدglass */
export function Field({
  label,
  children,
  hint,
}: {
  label: string;
  children: ReactNode;
  hint?: string;
}) {
  return (
    <div className="space-y-1.5">
      <label className="text-[11.5px] font-medium text-muted-foreground">{label}</label>
      {children}
      {hint && <p className="text-[10.5px] text-muted-foreground/70">{hint}</p>}
    </div>
  );
}

export const inputCls =
  "w-full h-12 rounded-xl glass-soft border border-white/[0.08] px-4 text-[14px] text-foreground placeholder:text-muted-foreground/50 focus:border-primary/40 focus:outline-none transition-colors";

export const textareaCls =
  "w-full min-h-[96px] rounded-xl glass-soft border border-white/[0.08] p-3.5 text-[13.5px] leading-relaxed text-foreground placeholder:text-muted-foreground/50 focus:border-primary/40 focus:outline-none transition-colors resize-none";

// ═══════════════════════ منتقي الأيقونات (تخصيص عالي) ═══════════════════════

export const ICON_CHOICES = [
  "wallet", "banknote", "landmark", "credit-card", "piggy-bank", "smartphone",
  "coffee", "utensils", "shopping-basket", "shopping-bag", "car-front", "receipt",
  "gamepad-2", "heart-pulse", "graduation-cap", "send", "gift", "briefcase",
  "laptop", "store", "flame", "dumbbell", "book-open", "moon", "sun",
  "droplets", "footprints", "brain", "languages", "pen-line", "music",
  "camera", "plane", "home", "users", "target", "calendar-days", "bell",
] as const;

export function IconGrid({
  value,
  onChange,
  choices = ICON_CHOICES,
}: {
  value: string;
  onChange: (icon: string) => void;
  choices?: readonly string[];
}) {
  return (
    <div className="grid grid-cols-8 gap-1.5" role="radiogroup" aria-label="اختيار أيقونة">
      {choices.map((name) => {
        const Icon = iconByName(name);
        const active = value === name;
        return (
          <button
            key={name}
            type="button"
            role="radio"
            aria-checked={active}
            aria-label={name}
            onClick={() => onChange(name)}
            className={cn(
              "aspect-square rounded-xl flex items-center justify-center transition-all",
              active ? "bg-primary/25 border border-primary/50 text-primary scale-105" : "glass-soft border border-white/[0.06] text-foreground/60 hover:text-foreground"
            )}
          >
            <Icon className="w-[18px] h-[18px]" />
          </button>
        );
      })}
    </div>
  );
}

/** خريطة الأيقونات الشائعة — تستوردها الشاشات أيضاً */
import {
  Wallet, Banknote, Landmark, CreditCard, PiggyBank, Smartphone, Coffee, Utensils,
  ShoppingBasket, ShoppingBag, CarFront, Receipt, Gamepad2, HeartPulse, GraduationCap,
  Send, Gift, Briefcase, Laptop, Store, Flame, Dumbbell, BookOpen, Moon, Sun,
  Droplets, Footprints, Brain, Languages, PenLine, Music, Camera, Plane, Home,
  Users, Target, CalendarDays, Bell, Shapes, ArrowUpRight, ArrowDownLeft,
  CheckSquare, Square, HandCoins, Timer, Zap, Star, Trophy, Salad, Package,
  StickyNote, BatteryCharging, TrendingUp, TrendingDown, Gauge, Activity, Leaf,
} from "lucide-react";

const ICON_MAP: Record<string, typeof Wallet> = {
  wallet: Wallet, banknote: Banknote, landmark: Landmark, "credit-card": CreditCard,
  "piggy-bank": PiggyBank, smartphone: Smartphone, coffee: Coffee, utensils: Utensils,
  "shopping-basket": ShoppingBasket, "shopping-bag": ShoppingBag, "car-front": CarFront,
  receipt: Receipt, "gamepad-2": Gamepad2, "heart-pulse": HeartPulse,
  "graduation-cap": GraduationCap, send: Send, gift: Gift, briefcase: Briefcase,
  laptop: Laptop, store: Store, flame: Flame, dumbbell: Dumbbell,
  "book-open": BookOpen, moon: Moon, sun: Sun, droplets: Droplets,
  footprints: Footprints, brain: Brain, languages: Languages, "pen-line": PenLine,
  music: Music, camera: Camera, plane: Plane, home: Home, users: Users,
  target: Target, "calendar-days": CalendarDays, bell: Bell, shapes: Shapes,
  "arrow-up-right": ArrowUpRight, "arrow-down-left": ArrowDownLeft,
  "check-square": CheckSquare, square: Square, "hand-coins": HandCoins, timer: Timer,
  zap: Zap, star: Star, trophy: Trophy, salad: Salad, package: Package,
  "sticky-note": StickyNote, "battery-charging": BatteryCharging,
  "trending-up": TrendingUp, "trending-down": TrendingDown, gauge: Gauge,
  activity: Activity, leaf: Leaf,
};

export function iconByName(name: string): typeof Wallet {
  return ICON_MAP[name] ?? Shapes;
}

// ═══════════════════════ منتقي الألوان (تخصيص عالي) ═══════════════════════

export const COLOR_CHOICES = [
  "#F5B95C", "#C08457", "#5CE1E6", "#8EC5FF", "#6EE7A8", "#FFB4A2",
  "#FF8E7A", "#F8B4D9", "#C4B5FD", "#F5D565", "#FFD9A0", "#94A3B8",
] as const;

export function ColorSwatches({
  value,
  onChange,
  choices = COLOR_CHOICES,
}: {
  value: string;
  onChange: (color: string) => void;
  choices?: readonly string[];
}) {
  return (
    <div className="flex flex-wrap gap-2" role="radiogroup" aria-label="اختيار لون">
      {choices.map((c) => {
        const active = value === c;
        return (
          <motion.button
            key={c}
            type="button"
            role="radio"
            aria-checked={active}
            aria-label={c}
            whileTap={{ scale: 0.85 }}
            onClick={() => onChange(c)}
            className={cn(
              "w-9 h-9 rounded-full border-2 transition-all",
              active ? "border-white scale-110 shadow-lg" : "border-white/20 hover:border-white/40"
            )}
            style={{ background: c }}
          >
            {active && <Check className="w-4 h-4 mx-auto text-black/70" strokeWidth={3} />}
          </motion.button>
        );
      })}
    </div>
  );
}

/** حوار تأكيد خطر (حذف/تصفير) بأسلوب زجاجي */
export function ConfirmBar({
  message,
  confirmLabel,
  onConfirm,
  onCancel,
  danger = true,
}: {
  message: string;
  confirmLabel: string;
  onConfirm: () => void;
  onCancel: () => void;
  danger?: boolean;
}) {
  return (
    <div className="glass-deep rounded-2xl p-4 space-y-3">
      <p className="text-[12.5px] leading-relaxed text-foreground/90">{message}</p>
      <div className="flex gap-2">
        <button
          onClick={onCancel}
          className="flex-1 h-11 rounded-xl glass-soft border border-white/[0.08] text-[12.5px] font-medium hover:bg-white/[0.06] transition-colors"
        >
          إلغاء
        </button>
        <button
          onClick={onConfirm}
          className={cn(
            "flex-1 h-11 rounded-xl text-[12.5px] font-bold text-white transition-transform active:scale-95",
            danger ? "bg-destructive/80 hover:bg-destructive" : "bg-primary hover:bg-primary/90"
          )}
        >
          {confirmLabel}
        </button>
      </div>
    </div>
  );
}
