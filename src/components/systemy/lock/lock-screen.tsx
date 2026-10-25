"use client";

/**
 * Systemy v2 — شاشة القفل المحلي برمز PIN
 * التحقق عبر تجزئة SHA-256 (hashPin) مقابل settings.pinHash — الرمز الصريح
 * لا يُخزَّن ولا يغادر الجهاز أبداً. تدعم رموز 4-6 أرقام: تحقق تلقائي عند
 * كل طول ≥ 4، اهتزاز عند الخطأ، وتلميح الاستعادة بعد محاولتين فاشلتين.
 */

import { useEffect, useRef, useState } from "react";
import { AnimatePresence, motion } from "framer-motion";
import { Delete } from "lucide-react";
import { getSettings, useLive } from "@/lib/db";
import { hashPin } from "@/lib/backup";
import { displayDigit } from "@/components/systemy/ui-bits";
import { cn } from "@/lib/utils";
import type { DigitStyle, Settings } from "@/lib/types";

// ═══════════════════════ لوحة رمز القفل (مشتركة مع إعدادات القفل) ═══════════════════════

const PAD_LAYOUT = ["1", "2", "3", "4", "5", "6", "7", "8", "9", "", "0", "back"] as const;

/** لوحة أرقام للرمز — أرقام فقط 1-9، 0، ومسح (بنفس روح NumberPad) */
export function PinPad({
  onDigit,
  onBack,
  disabled = false,
  digits = "latn",
  label = "لوحة رمز القفل",
}: {
  onDigit: (digit: string) => void;
  onBack: () => void;
  disabled?: boolean;
  digits?: DigitStyle;
  label?: string;
}) {
  return (
    <div
      role="group"
      aria-label={label}
      className="grid grid-cols-3 gap-2.5"
      style={{ touchAction: "manipulation" }}
    >
      {PAD_LAYOUT.map((k, i) => {
        if (k === "") return <span key={i} aria-hidden="true" />;
        const isBack = k === "back";
        return (
          <button
            key={i}
            type="button"
            disabled={disabled}
            onClick={() => {
              if (typeof navigator !== "undefined" && "vibrate" in navigator) navigator.vibrate?.(8);
              if (isBack) onBack();
              else onDigit(k);
            }}
            aria-label={isBack ? "مسح رقم" : `الرقم ${k}`}
            className={cn(
              "h-14 min-h-14 rounded-2xl border text-[22px] font-bold tabular-nums select-none",
              "glass-soft border-black/[0.07] text-foreground transition-all",
              "hover:bg-black/[0.05] active:scale-95 active:border-primary/40",
              "disabled:opacity-40 disabled:active:scale-100",
              isBack && "text-muted-foreground"
            )}
          >
            {isBack ? <Delete className="h-[22px] w-[22px] mx-auto" aria-hidden="true" /> : displayDigit(k, digits)}
          </button>
        );
      })}
    </div>
  );
}

/** نقاط الرمز المقنّعة */
export function PinDots({
  count,
  filled,
  error = false,
  busy = false,
  label = "رمز القفل",
}: {
  count: number;
  filled: number;
  error?: boolean;
  busy?: boolean;
  label?: string;
}) {
  return (
    <div className="flex items-center justify-center gap-3" dir="ltr" role="img" aria-label={`${label} — ${filled} من ${count} أرقام`}>
      {Array.from({ length: Math.max(count, filled) }).map((_, i) => (
        <span
          key={i}
          aria-hidden="true"
          className={cn(
            "w-3 h-3 rounded-full transition-all duration-200",
            i < filled
              ? error
                ? "bg-destructive"
                : "bg-primary scale-110"
              : "bg-white/15",
            busy && i < filled && !error && "animate-pulse"
          )}
        />
      ))}
    </div>
  );
}

// ═══════════════════════ شاشة القفل ═══════════════════════

export function LockScreen({ onUnlocked }: { onUnlocked: () => void }) {
  const settings = useLive<Settings>(() => getSettings(), []);
  const [pin, setPin] = useState("");
  const [error, setError] = useState(false);
  const [checking, setChecking] = useState(false);
  const [fails, setFails] = useState(0);
  const [shakeKey, setShakeKey] = useState(0);
  const verifyToken = useRef(0);
  const clearTimer = useRef<ReturnType<typeof setTimeout> | null>(null);

  // تنظيف المؤقت عند الإزالة
  useEffect(() => {
    return () => {
      if (clearTimer.current) clearTimeout(clearTimer.current);
    };
  }, []);

  // أمان: لو تعرّض القفل بلا رمز مخزّن (استيراد جزئي مثلاً) نفتح مباشرة
  useEffect(() => {
    if (settings && !settings.pinHash) onUnlocked();
  }, [settings, onUnlocked]);

  /** محاولة خاطئة: اهتزاز + نقاط حمراء ثم مسح تلقائي بعد هدأة */
  const fail = () => {
    setFails((f) => f + 1);
    setError(true);
    setShakeKey((k) => k + 1);
    if (clearTimer.current) clearTimeout(clearTimer.current);
    clearTimer.current = setTimeout(() => {
      setPin("");
      setError(false);
    }, 1200);
  };

  const verify = async (value: string) => {
    const token = ++verifyToken.current;
    setChecking(true);
    try {
      const hash = await hashPin(value);
      if (token !== verifyToken.current) return; // نتيجة قديمة
      if (settings && hash === settings.pinHash) {
        if (clearTimer.current) clearTimeout(clearTimer.current);
        onUnlocked();
        return;
      }
      fail();
    } finally {
      if (token === verifyToken.current) setChecking(false);
    }
  };

  const press = (digit: string) => {
    if (checking) return;
    if (error) setError(false);
    if (clearTimer.current) {
      clearTimeout(clearTimer.current);
      clearTimer.current = null;
    }
    const next = pin + digit;
    if (next.length > 6) return;
    setPin(next);
    if (next.length >= 4) void verify(next);
  };

  if (!settings) {
    return (
      <div className="h-full app-mesh flex flex-col items-center justify-center gap-5" aria-busy="true" aria-label="جارٍ فتح القفل">
        <div className="w-20 h-20 rounded-[1.7rem] glass animate-pulse" />
        <div className="h-3 w-24 rounded-full bg-white/10 animate-pulse" />
      </div>
    );
  }

  return (
    <div className="relative h-full app-mesh overflow-hidden flex flex-col" dir="rtl">
      <div className="blob blob-a w-64 h-64 bg-[#F5B95C]/[0.13] -top-24 -right-20" aria-hidden="true" />
      <div className="blob blob-b w-56 h-56 bg-[#5CE1E6]/[0.10] -bottom-20 -left-16" aria-hidden="true" />

      <div className="relative flex-1 flex flex-col items-center justify-center px-8">
        <motion.div
          key={shakeKey}
          animate={shakeKey > 0 ? { x: [0, -12, 12, -9, 9, -5, 5, 0] } : undefined}
          transition={{ duration: 0.5 }}
          className="flex flex-col items-center"
        >
          <div className="w-[76px] h-[76px] rounded-[1.6rem] glass flex items-center justify-center text-[38px] leading-none mb-4 shadow-lg">
            <span aria-hidden="true">{settings.avatarEmoji || "🌙"}</span>
          </div>
          <h1 className="text-[19px] font-black">
            أهلاً بعودتك{settings.displayName ? `، ${settings.displayName}` : ""}
          </h1>
          <p className="text-[12px] text-muted-foreground mt-1 mb-6">أدخل رمز القفل للمتابعة</p>

          <PinDots count={Math.max(4, pin.length)} filled={pin.length} error={error} busy={checking} />
          <p className="h-5 mt-3 text-[11.5px] text-destructive" role={error ? "alert" : undefined}>
            {error ? "رمز غير صحيح — حاول مرة أخرى" : ""}
          </p>
        </motion.div>

        <div className="w-full max-w-[300px] mt-2">
          <PinPad
            onDigit={press}
            onBack={() => setPin((p) => p.slice(0, -1))}
            disabled={checking}
            digits={settings.digits}
          />
        </div>

        <AnimatePresence>
          {fails >= 2 && (
            <motion.div
              initial={{ opacity: 0, y: 8 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0 }}
              className="mt-6 max-w-[300px] text-center"
            >
              <p className="text-[11.5px] font-semibold text-muted-foreground">نسيت الرمز؟</p>
              <p className="text-[10.5px] text-muted-foreground/70 leading-relaxed mt-1">
                أعد تثبيت التطبيق أو امسح بيانات المتصفح — بياناتك محلية وستعود لشاشة الترحيب
              </p>
            </motion.div>
          )}
        </AnimatePresence>
      </div>

      <p className="relative text-center pb-5 text-[10px] text-muted-foreground/50">
        Systemy · مقفل محلياً على جهازك
      </p>
    </div>
  );
}
