"use client";

/**
 * Systemy v5 — معالج الإعداد الأولي (3 خطوات) بهوية «الشريط»
 * 1) الترحيب: الاسم + رمز الشخصية  2) المال: العملة والدخل والنقد الحالي
 * 3) الإعدادات السريعة: بداية الأسبوع والشهر المالي + الملخص ثم ابدأ نظامي.
 * عند الإتمام: completeOnboarding يبذّر الفئات والأنظمة وينشئ حساب النقد إن وُجد.
 * V5: تقدّم الشريط = مؤشر متدرج، دخول 400ms/خروج 150ms (عدم تناظر)، ضغط 0.96.
 */

import { useState } from "react";
import Image from "next/image";
import { AnimatePresence, motion } from "framer-motion";
import { ArrowLeft, Banknote, ChevronDown, ChevronRight, Sparkles } from "lucide-react";
import { toast } from "sonner";
import { completeOnboarding } from "@/lib/actions";
import { formatMoney } from "@/lib/format";
import { useUIStore } from "@/store/ui-store";
import { GlassCard } from "@/components/systemy/glass";
import { ChipRow, Field, inputCls, NumberPad, displayAmount } from "@/components/systemy/ui-bits";
import {
  AVATAR_EMOJIS,
  CURRENCY_CHIPS,
  WEEK_START_OPTIONS,
} from "@/components/systemy/settings/settings-screen";
import { cn } from "@/lib/utils";
import type { WeekStart } from "@/lib/types";

const STEP_TITLES = ["الترحيب", "المال", "الإعدادات السريعة"] as const;

interface FormState {
  displayName: string;
  avatarEmoji: string;
  currency: string;
  income: string;
  cash: string;
  weekStart: WeekStart;
  monthStartDay: number;
}

const money = (v: string): number => Math.round((Number(v) || 0) * 100) / 100;

export function Onboarding() {
  const [step, setStep] = useState(0);
  const [dir, setDir] = useState(1);
  const [busy, setBusy] = useState(false);
  const [padOpen, setPadOpen] = useState<"income" | "cash" | null>(null);
  const [form, setForm] = useState<FormState>({
    displayName: "",
    avatarEmoji: "🌙",
    currency: "ر.س",
    income: "",
    cash: "",
    weekStart: "sat",
    monthStartDay: 1,
  });

  const set = <K extends keyof FormState>(k: K, v: FormState[K]) =>
    setForm((f) => ({ ...f, [k]: v }));

  const go = (next: number) => {
    setDir(next > step ? 1 : -1);
    setStep(next);
    setPadOpen(null);
  };

  const finish = async () => {
    setBusy(true);
    try {
      await completeOnboarding({
        displayName: form.displayName.trim(),
        avatarEmoji: form.avatarEmoji,
        currency: form.currency.trim() || "ر.س",
        weekStart: form.weekStart,
        monthStartDay: form.monthStartDay,
        monthlyIncome: money(form.income),
        cashBalance: form.cash.trim() === "" ? null : money(form.cash),
      });
      useUIStore.getState().setView("today");
    } catch (e) {
      console.error(e);
      toast.error("حدث خطأ أثناء الإعداد — حاول مجدداً");
      setBusy(false);
    }
  };

  return (
    <div className="relative h-full app-mesh flex flex-col overflow-hidden" dir="rtl">
      <div className="blob blob-a w-64 h-64 bg-[#F5B95C]/[0.13] -top-24 -left-16" aria-hidden="true" />
      <div className="blob blob-b w-56 h-56 bg-[#5CE1E6]/[0.10] -bottom-24 -right-14" aria-hidden="true" />

      {/* مؤشر الخطوات */}
      <div className="relative px-6 pt-7 pb-3 flex flex-col items-center gap-2 shrink-0">
        <div className="flex items-center gap-1.5" role="progressbar" aria-label={`الخطوة ${step + 1} من 3 — ${STEP_TITLES[step]}`}>
          {STEP_TITLES.map((_, i) => (
            <span
              key={i}
              aria-hidden="true"
              className={cn(
                "h-2 rounded-full transition-[width,background-color] duration-[250ms]",
                i === step ? "w-8 ribbon" : i < step ? "w-2 bg-white/45" : "w-2 bg-white/15"
              )}
            />
          ))}
        </div>
        <p className="text-[11px] text-muted-foreground">
          {STEP_TITLES[step]} · {step + 1} من 3
        </p>
      </div>

      {/* محتوى الخطوة */}
      <div className="relative flex-1 overflow-y-auto sys-scroll px-5 pb-4">
        <AnimatePresence mode="wait">
          <motion.div
            key={step}
            initial={{ opacity: 0, x: dir === 1 ? -24 : 24 }}
            animate={{ opacity: 1, x: 0 }}
            exit={{ opacity: 0, x: dir === 1 ? 14 : -14, transition: { duration: 0.15, ease: [0.22, 1, 0.36, 1] } }}
            transition={{ duration: 0.4, ease: [0.22, 1, 0.36, 1] }}
          >
            {step === 0 && <StepWelcome form={form} set={set} />}
            {step === 1 && (
              <StepMoney form={form} set={set} padOpen={padOpen} setPadOpen={setPadOpen} />
            )}
            {step === 2 && <StepQuick form={form} set={set} />}
          </motion.div>
        </AnimatePresence>
      </div>

      {/* أزرار التنقل */}
      <div className="relative px-5 pb-7 pt-2 flex gap-2.5 shrink-0">
        {step > 0 && (
          <button
            type="button"
            onClick={() => go(step - 1)}
            disabled={busy}
            aria-label="الخطوة السابقة"
            className="press h-14 px-6 rounded-2xl glass border border-white/10 text-[13.5px] font-semibold flex items-center gap-1 disabled:opacity-50"
          >
            <ChevronRight className="w-[18px] h-[18px]" aria-hidden="true" />
            السابق
          </button>
        )}
        {step < 2 ? (
          <button
            type="button"
            onClick={() => go(step + 1)}
            disabled={step === 0 && !form.displayName.trim()}
            className="press flex-1 h-14 rounded-2xl bg-gradient-to-b from-[#F7C66F] to-[#F2AC44] text-primary-foreground text-[15px] font-bold flex items-center justify-center gap-2 glow-gold disabled:opacity-40"
          >
            التالي
            <ArrowLeft className="w-[18px] h-[18px]" aria-hidden="true" />
          </button>
        ) : (
          <button
            type="button"
            onClick={() => void finish()}
            disabled={busy}
            className="press flex-1 h-14 rounded-2xl bg-gradient-to-b from-[#F7C66F] to-[#F2AC44] text-primary-foreground text-[15px] font-bold flex items-center justify-center gap-2 glow-gold disabled:opacity-60"
          >
            <Sparkles className="w-5 h-5" aria-hidden="true" />
            {busy ? "جارٍ تجهيز نظامك…" : "ابدأ نظامي"}
          </button>
        )}
      </div>
    </div>
  );
}

// ═══════════════════════ الخطوة 1 — الترحيب ═══════════════════════

function StepWelcome({
  form,
  set,
}: {
  form: FormState;
  set: <K extends keyof FormState>(k: K, v: FormState[K]) => void;
}) {
  return (
    <div className="space-y-5 pt-1">
      <div className="flex flex-col items-center text-center gap-3 pt-3">
        {/* شعار الشريط الرسمي — روبوت Sys وشريطه المتدرج */}
        <Image
          src="/brand/systemy-logo.png"
          alt="شعار Systemy — روبوت Sys بعينين سعيدتين يحمل لوحة بيانات، يلتف حوله شريط متدرج من السماوي إلى الأزرق فالذهبي فالبرتقالي"
          width={96}
          height={96}
          className="rounded-[1.7rem] border border-white/[0.08] shadow-[0_2px_6px_rgba(0,0,0,0.35),0_18px_44px_-14px_rgba(0,0,0,0.55)] shrink-0"
          priority
        />
        <div>
          <p className="text-[10.5px] tracking-widest text-primary/80 font-bold mb-1.5">SYSTEMY 5.0</p>
          <h1 className="text-[26px] font-black leading-tight">نظام تشغيلك الشخصي</h1>
          <p className="text-[12.5px] text-muted-foreground leading-relaxed mt-2 max-w-[300px] mx-auto">
            حساباتك، عاداتك، أهدافك ويومك — كلها في مكان واحد، وكلها مترابطة
          </p>
        </div>
      </div>

      <GlassCard className="p-4 space-y-4">
        <Field label="اسمك (يظهر في التحية)">
          <input
            className={inputCls}
            value={form.displayName}
            onChange={(e) => set("displayName", e.target.value)}
            placeholder="مثال: خالد"
            maxLength={30}
            autoComplete="off"
            aria-label="الاسم المعروض"
          />
        </Field>
        <div className="space-y-2">
          <p className="text-[11.5px] font-medium text-muted-foreground">اختر رمزك</p>
          <div className="grid grid-cols-8 gap-1.5" role="radiogroup" aria-label="اختيار رمز الشخصية">
            {AVATAR_EMOJIS.map((emoji) => {
              const active = form.avatarEmoji === emoji;
              return (
                <motion.button
                  key={emoji}
                  type="button"
                  role="radio"
                  aria-checked={active}
                  aria-label={`رمز ${emoji}`}
                  whileTap={{ scale: 0.96 }}
                  animate={{ scale: active ? 1.05 : 1 }}
                  transition={{ type: "spring", duration: 0.3, bounce: 0 }}
                  onClick={() => set("avatarEmoji", emoji)}
                  className={cn(
                    "aspect-square min-h-11 rounded-xl flex items-center justify-center text-[20px] transition-colors",
                    active
                      ? "ribbon-soft border border-[#00CDFE]/60"
                      : "glass-soft border border-white/[0.06] hover:bg-white/[0.06]"
                  )}
                >
                  <span aria-hidden="true">{emoji}</span>
                </motion.button>
              );
            })}
          </div>
        </div>
      </GlassCard>

      <p className="text-center text-[10.5px] text-muted-foreground/70">
        كل شيء يبقى على جهازك — لا حساب ولا خادم ولا تتبع
      </p>
    </div>
  );
}

// ═══════════════════════ الخطوة 2 — المال ═══════════════════════

function StepMoney({
  form,
  set,
  padOpen,
  setPadOpen,
}: {
  form: FormState;
  set: <K extends keyof FormState>(k: K, v: FormState[K]) => void;
  padOpen: "income" | "cash" | null;
  setPadOpen: (v: "income" | "cash" | null) => void;
}) {
  return (
    <div className="space-y-4 pt-1">
      <header className="flex items-center gap-3 px-1">
        <span className="w-11 h-11 rounded-2xl glass flex items-center justify-center text-primary shrink-0">
          <Banknote className="w-5.5 h-5.5" aria-hidden="true" />
        </span>
        <div>
          <h2 className="text-[16px] font-bold leading-tight">أساس مالك</h2>
          <p className="text-[11px] text-muted-foreground mt-0.5">يُستخدم لاحتساب الرصيد الآمن اليومي</p>
        </div>
      </header>

      <GlassCard className="p-4 space-y-4">
        <ChipRow
          label="عملتك"
          options={CURRENCY_CHIPS}
          value={form.currency}
          onSelect={(k) => set("currency", k)}
        />
        <Field label="أو رمز عملة مخصص">
          <input
            className={inputCls}
            dir="ltr"
            value={form.currency}
            onChange={(e) => set("currency", e.target.value)}
            placeholder="مثال: ر.ع أو £"
            maxLength={6}
            aria-label="رمز عملة مخصص"
          />
        </Field>
      </GlassCard>

      <MoneyQuestion
        id="income"
        title="الدخل الشهري التقديري"
        hint="اختياري — يحسّن دقة الرصيد الآمن والرؤى"
        value={form.income}
        onChange={(v) => set("income", v)}
        open={padOpen === "income"}
        onToggle={() => setPadOpen(padOpen === "income" ? null : "income")}
        currency={form.currency}
      />
      <MoneyQuestion
        id="cash"
        title="كم معك نقداً الآن؟"
        hint="اختياري — يُنشأ منه أول حساب نقدي باسم «نقد»"
        value={form.cash}
        onChange={(v) => set("cash", v)}
        open={padOpen === "cash"}
        onToggle={() => setPadOpen(padOpen === "cash" ? null : "cash")}
        currency={form.currency}
        skippable
        onSkip={() => {
          set("cash", "");
          setPadOpen(null);
        }}
      />
    </div>
  );
}

/** بطاقة سؤال مالي — تنفتح على لوحة أرقام */
function MoneyQuestion({
  id,
  title,
  hint,
  value,
  onChange,
  open,
  onToggle,
  currency,
  skippable = false,
  onSkip,
}: {
  id: string;
  title: string;
  hint: string;
  value: string;
  onChange: (v: string) => void;
  open: boolean;
  onToggle: () => void;
  currency: string;
  skippable?: boolean;
  onSkip?: () => void;
}) {
  return (
    <GlassCard className="overflow-hidden">
      <button
        type="button"
        onClick={onToggle}
        aria-expanded={open}
        aria-controls={`pad-${id}`}
        className="w-full min-h-16 flex items-center gap-3 p-4"
      >
        <span className="w-10 h-10 rounded-xl bg-primary/12 text-primary flex items-center justify-center shrink-0">
          <Banknote className="w-5 h-5" aria-hidden="true" />
        </span>
        <span className="flex-1 min-w-0 text-right">
          <span className="block text-[13px] font-bold">{title}</span>
          <span className="block text-[10.5px] text-muted-foreground mt-0.5">{hint}</span>
        </span>
        <span className="num-display text-[14px] text-primary shrink-0">
          {value ? formatMoney(Number(value) || 0, currency) : "—"}
        </span>
        <ChevronDown
          className={cn("w-4 h-4 text-muted-foreground transition-transform duration-300 shrink-0", open && "rotate-180")}
          aria-hidden="true"
        />
      </button>
      <AnimatePresence initial={false}>
        {open && (
          <motion.div
            id={`pad-${id}`}
            initial={{ height: 0, opacity: 0 }}
            animate={{ height: "auto", opacity: 1 }}
            exit={{ height: 0, opacity: 0, transition: { duration: 0.35, ease: [0.22, 1, 0.36, 1] } }}
            transition={{ duration: 0.4, ease: [0.22, 1, 0.36, 1] }}
            className="overflow-hidden"
          >
            <div className="px-4 pb-4 space-y-3">
              <p className="num-display text-[28px] text-center pt-1" dir="ltr" aria-label="المبلغ المدخل">
                {displayAmount(value || "0", "latn")}
                <span className="text-[13px] text-muted-foreground font-normal"> {currency}</span>
              </p>
              <NumberPad value={value} onChange={onChange} label={`لوحة ${title}`} />
              <div className="flex gap-2">
                <button
                  type="button"
                  onClick={onToggle}
                  aria-label={`تم — ${title}`}
                  className="flex-1 h-11 min-h-11 rounded-xl bg-primary/15 border border-primary/30 text-primary text-[12.5px] font-bold transition-colors hover:bg-primary/25"
                >
                  تم
                </button>
                {skippable && onSkip && (
                  <button
                    type="button"
                    onClick={onSkip}
                    className="flex-1 h-11 min-h-11 rounded-xl glass-soft border border-white/[0.08] text-muted-foreground text-[12.5px] font-medium transition-colors hover:bg-white/[0.06]"
                  >
                    تخطي
                  </button>
                )}
              </div>
            </div>
          </motion.div>
        )}
      </AnimatePresence>
    </GlassCard>
  );
}

// ═══════════════════════ الخطوة 3 — الإعدادات السريعة ═══════════════════════

function StepQuick({
  form,
  set,
}: {
  form: FormState;
  set: <K extends keyof FormState>(k: K, v: FormState[K]) => void;
}) {
  const [dayText, setDayText] = useState(String(form.monthStartDay));
  const weekLabel = WEEK_START_OPTIONS.find((w) => w.k === form.weekStart)?.v ?? "";
  const incomeNum = money(form.income);
  const cashNum = money(form.cash);

  const setDay = (n: number) => {
    const clamped = Math.min(28, Math.max(1, Math.round(n) || 1));
    set("monthStartDay", clamped);
    setDayText(String(clamped));
  };

  return (
    <div className="space-y-4 pt-1">
      <GlassCard className="p-4 space-y-4">
        <ChipRow
          label="بداية الأسبوع"
          options={WEEK_START_OPTIONS}
          value={form.weekStart}
          onSelect={(k) => set("weekStart", k as WeekStart)}
        />
        <div className="space-y-2">
          <p className="text-[11.5px] font-medium text-muted-foreground">بداية الشهر المالي</p>
          <div className="flex gap-2 items-center flex-wrap">
            {[1, 15, 25].map((d) => {
              const active = form.monthStartDay === d;
              return (
                <button
                  key={d}
                  type="button"
                  onClick={() => setDay(d)}
                  aria-pressed={active}
                  className={cn(
                    "h-11 min-h-11 px-4 rounded-xl border text-[13px] font-bold tabular-nums transition-colors",
                    active
                      ? "bg-primary/20 border-primary/50 text-primary"
                      : "glass-soft border-white/[0.08] text-foreground/80 hover:bg-white/[0.06]"
                  )}
                >
                  يوم {d}
                </button>
              );
            })}
            <input
              type="number"
              min={1}
              max={28}
              value={dayText}
              onChange={(e) => {
                setDayText(e.target.value);
                if (e.target.value !== "") setDay(Number(e.target.value));
              }}
              onBlur={() => setDayText(String(form.monthStartDay))}
              className="w-24 h-11 min-h-11 rounded-xl glass-soft border border-white/[0.08] px-3 text-center text-[13px] tabular-nums focus:border-primary/40 focus:outline-none transition-colors"
              aria-label="يوم بداية الشهر المالي من 1 إلى 28"
            />
          </div>
          <p className="text-[10.5px] text-muted-foreground/70">
            تُحسب الدورات المالية والمظاريف من هذا اليوم (1-28)
          </p>
        </div>
      </GlassCard>

      <GlassCard className="p-4">
        <p className="text-[14px] font-bold text-primary mb-3">جاهز! 🌙</p>
        <div className="space-y-2">
          <SummaryRow label="الاسم" value={`${form.avatarEmoji} ${form.displayName.trim()}`} />
          <SummaryRow label="العملة" value={form.currency.trim() || "ر.س"} />
          <SummaryRow
            label="الدخل الشهري"
            value={form.income ? formatMoney(incomeNum, form.currency) : "غير محدد — يمكن إضافته لاحقاً"}
          />
          <SummaryRow
            label="النقد الحالي"
            value={form.cash ? formatMoney(cashNum, form.currency) : "بدون حساب نقدي"}
          />
          <SummaryRow label="بداية الأسبوع" value={weekLabel} />
          <SummaryRow label="بداية الشهر المالي" value={`يوم ${form.monthStartDay}`} />
        </div>
      </GlassCard>

      <p className="text-center text-[11px] text-muted-foreground/70 leading-relaxed px-4">
        سنجهّز لك 14 فئة و8 أنظمة جاهزة للتخصيص — بلا أي بيانات تجريبية، بداية نظيفة تماماً
      </p>
    </div>
  );
}

function SummaryRow({ label, value }: { label: string; value: string }) {
  return (
    <div className="flex items-center justify-between gap-3">
      <span className="text-[11.5px] text-muted-foreground shrink-0">{label}</span>
      <span className="text-[12px] font-semibold text-foreground/90 text-left truncate">{value}</span>
    </div>
  );
}
