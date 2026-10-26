"use client";

/**
 * Systemy 5.1 — معالج البداية الجديد
 * 1) الترحيب: هوية + قيمة المنتج + الاسم (مثال: محمد) + رمز الشخصية
 * 2) مجالات البداية: اختيار مرن يرتّب مكتبة الأنظمة (لا يحذف شيئاً)
 * 3) لمسات أخيرة «اختيارية بالكامل»: العملة والدخل/النقد وبدايات الأسبوع/الشهر
 *    — قابلة للتخطي بخطوة واحدة، لا يُجبر المستخدم على أي رقم مالي.
 * عند الإتمام: completeOnboarding يبذّر الفئات والأنظمة ويُنشئ حساب النقد،
 * ثم تُرتَّب الأنظمة بحسب المجالات المختارة (المختار أولاً).
 * إعداد محلي صادق: الأساس كله على الجهاز بلا خادم — والحساب السحابي
 * (إن فُتح من الترحيب) اختياري صريح للملف الشخصي واستعادة الوصول فقط.
 */

import { useState } from "react";
import { AnimatePresence, motion } from "framer-motion";
import {
  ArrowLeft, Banknote, CalendarDays, CheckSquare, ChevronRight, Flame,
  GraduationCap, HeartPulse, NotebookPen, Sparkles, Target, Wallet,
} from "lucide-react";
import { toast } from "sonner";
import { completeOnboarding } from "@/lib/actions";
import { db } from "@/lib/db";
import { GlassCard } from "@/components/systemy/glass";
import { ChipRow, Field, inputCls, NumberPad, displayAmount } from "@/components/systemy/ui-bits";
import { LogoHero } from "@/components/systemy/logo";
import {
  AVATAR_EMOJIS,
  CURRENCY_CHIPS,
  WEEK_START_OPTIONS,
} from "@/components/systemy/settings/settings-screen";
import { cn } from "@/lib/utils";
import type { WeekStart } from "@/lib/types";

const STEP_TITLES = ["الترحيب", "مجالات البداية", "لمسات أخيرة · اختيارية"] as const;

interface FormState {
  displayName: string;
  avatarEmoji: string;
  currency: string;
  income: string;
  cash: string;
  weekStart: WeekStart;
  monthStartDay: number;
  /** مفاتيح الأنظمة المختارة كمجالات بداية */
  domains: string[];
}

const money = (v: string): number => Math.round((Number(v) || 0) * 100) / 100;

/** مجالات البداية — مفاتيح أنظمة حقيقية من DEFAULT_SYSTEMS */
const DOMAIN_OPTIONS: Array<{ key: string; label: string; desc: string; icon: typeof Wallet }> = [
  { key: "money", label: "المال", desc: "مصاريف وميزانية ورصيد آمن", icon: Wallet },
  { key: "tasks", label: "المهام", desc: "يومك ومهامك ومؤقت التركيز", icon: CheckSquare },
  { key: "habits", label: "العادات", desc: "روتينك وسلاسل التقدم", icon: Flame },
  { key: "calendar", label: "التقويم", desc: "مواعيدك وأحداثك", icon: CalendarDays },
  { key: "health", label: "الصحة", desc: "ماء ونوم وقياسات", icon: HeartPulse },
  { key: "journal", label: "اليوميات", desc: "دفترك ومزاجك وذكرياتك", icon: NotebookPen },
  { key: "learning", label: "التعلم", desc: "مقررات وبطاقات مراجعة", icon: GraduationCap },
  { key: "goals", label: "الأهداف", desc: "معالم وادخار مترابط", icon: Target },
];

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
    domains: ["money", "tasks", "habits"],
  });

  const set = <K extends keyof FormState>(k: K, v: FormState[K]) =>
    setForm((f) => ({ ...f, [k]: v }));

  const toggleDomain = (key: string) =>
    setForm((f) => ({
      ...f,
      domains: f.domains.includes(key) ? f.domains.filter((d) => d !== key) : [...f.domains, key],
    }));

  const go = (next: number) => {
    setDir(next > step ? 1 : -1);
    setStep(next);
    setPadOpen(null);
  };

  const finish = async () => {
    if (busy) return; // منع الازدوج
    setBusy(true);
    try {
      await completeOnboarding({
        displayName: form.displayName.trim() || "صديق Systemy",
        avatarEmoji: form.avatarEmoji,
        currency: form.currency.trim() || "ر.س",
        weekStart: form.weekStart,
        monthStartDay: form.monthStartDay,
        monthlyIncome: money(form.income),
        cashBalance: form.cash.trim() === "" ? null : money(form.cash),
      });
      // ترتيب المكتبة: المجالات المختارة أولاً — بلا حذف ولا تعطيل لأي نظام
      try {
        const systems = await db.systems.toArray();
        if (systems.length > 0 && form.domains.length > 0) {
          const picked = form.domains
            .map((k) => systems.find((s) => s.key === k))
            .filter((s): s is (typeof systems)[number] => Boolean(s));
          const rest = systems.filter((s) => !form.domains.includes(s.key));
          const ordered = [...picked, ...rest].map((s, i) => ({ ...s, order: i + 1 }));
          await db.systems.bulkPut(ordered);
        }
      } catch {
        /* ترتيب المكتبة تحسين لا يوقف البداية */
      }
      const { useUIStore } = await import("@/store/ui-store");
      useUIStore.getState().setView("today");
    } catch (e) {
      console.error(e);
      toast.error("حدث خطأ أثناء الإعداد — حاول مجدداً");
      setBusy(false);
    }
  };

  return (
    <div className="relative h-full app-mesh flex flex-col overflow-hidden" dir="rtl">
      <div className="blob blob-a w-64 h-64 bg-[#F2B347]/[0.16] -top-24 -left-16" aria-hidden="true" />
      <div className="blob blob-b w-56 h-56 bg-[#16B8B0]/[0.10] -bottom-24 -right-14" aria-hidden="true" />

      {/* مؤشر الخطوات */}
      <div className="relative px-6 pt-7 pb-3 flex flex-col items-center gap-2 shrink-0">
        <div className="flex items-center gap-1.5" role="progressbar" aria-label={`الخطوة ${step + 1} من 3 — ${STEP_TITLES[step]}`}>
          {STEP_TITLES.map((_, i) => (
            <span
              key={i}
              aria-hidden="true"
              className={cn(
                "h-2 rounded-full transition-[width,background-color] duration-[250ms]",
                i === step ? "w-8 ribbon" : i < step ? "w-2 bg-gold/60" : "w-2 bg-black/10"
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
            {step === 1 && <StepDomains form={form} toggleDomain={toggleDomain} />}
            {step === 2 && (
              <StepFinale form={form} set={set} padOpen={padOpen} setPadOpen={setPadOpen} />
            )}
          </motion.div>
        </AnimatePresence>
      </div>

      {/* أزرار التنقل — رجوع / متابعة أو تخطي / ابدأ */}
      <div className="relative px-5 pb-7 pt-2 flex gap-2.5 shrink-0 items-stretch">
        {step > 0 && (
          <button
            type="button"
            onClick={() => go(step - 1)}
            disabled={busy}
            aria-label="الخطوة السابقة"
            className="press h-14 px-6 rounded-2xl glass text-[13.5px] font-semibold flex items-center gap-1 disabled:opacity-50"
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
            className="press flex-1 h-14 rounded-2xl text-[15px] font-bold flex items-center justify-center gap-2 glow-gold disabled:opacity-40"
            style={{ background: "linear-gradient(180deg, #F2B347, #D99026)", color: "#2a1a03" }}
          >
            {step === 1 ? "التالي" : "متابعة"}
            <ArrowLeft className="w-[18px] h-[18px]" aria-hidden="true" />
          </button>
        ) : (
          <>
            <button
              type="button"
              onClick={() => void finish()}
              disabled={busy}
              className="press h-14 px-5 rounded-2xl glass text-[13px] font-semibold text-muted-foreground flex items-center disabled:opacity-50"
            >
              تخطّي
            </button>
            <button
              type="button"
              onClick={() => void finish()}
              disabled={busy}
              className="press flex-1 h-14 rounded-2xl text-[15px] font-bold flex items-center justify-center gap-2 glow-gold disabled:opacity-60"
              style={{ background: "linear-gradient(180deg, #F2B347, #D99026)", color: "#2a1a03" }}
            >
              <Sparkles className="w-5 h-5" aria-hidden="true" />
              {busy ? "جارٍ تجهيز نظامك…" : "ابدأ نظامي"}
            </button>
          </>
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
        {/* شعار الهوية — أصل مستورد لا ينكسر */}
        <LogoHero className="rounded-[1.7rem] shadow-[0_2px_6px_rgba(23,33,43,0.12),0_18px_44px_-14px_rgba(23,33,43,0.35)]" />
        <div>
          <p className="text-[10.5px] tracking-widest text-gold font-bold mb-1.5">SYSTEMY 5.1</p>
          <h1 className="text-[26px] font-black leading-tight">نظام تشغيلك الشخصي</h1>
          <p className="text-[12.5px] text-muted-foreground leading-relaxed mt-2 max-w-[300px] mx-auto">
            مالك وعاداتك وأهدافك ويومك — كلها في مكان واحد، وكلها مترابطة
          </p>
        </div>
        {/* قيمة المنتج في سطر واحد صادق */}
        <div className="flex items-center gap-2 ribbon-soft rounded-full px-3.5 py-1.5">
          <Sparkles className="w-3.5 h-3.5 text-cyan" aria-hidden="true" />
          <span className="text-[10.5px] font-semibold text-foreground/80">
            سجّل أي شيء في ثانيتين — والباقي اختياري
          </span>
        </div>
      </div>

      <GlassCard className="p-4 space-y-4">
        <Field label="ماذا نناديك؟">
          <input
            className={inputCls}
            value={form.displayName}
            onChange={(e) => set("displayName", e.target.value)}
            placeholder="مثال: محمد"
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
                      ? "ribbon-soft border border-gold/50 shadow-[0_0_0_2px_rgba(217,144,38,0.25)]"
                      : "glass-soft border border-black/[0.05] hover:bg-black/[0.03]"
                  )}
                >
                  <span aria-hidden="true">{emoji}</span>
                </motion.button>
              );
            })}
          </div>
        </div>
      </GlassCard>

      {/* 5.2: الدخول إلزامي عبر البوابة قبل الإعداد — لا حاجة لرابط تسجيل هنا */}

      <p className="text-center text-[10.5px] text-muted-foreground/80">
        إعدادك محفوظ على جهازك ويُزامَن بحسابك السحابي — بلا تتبع ولا مشاركة
      </p>
    </div>
  );
}

// ═══════════════════════ الخطوة 2 — مجالات البداية ═══════════════════════

function StepDomains({
  form,
  toggleDomain,
}: {
  form: FormState;
  toggleDomain: (key: string) => void;
}) {
  return (
    <div className="space-y-4 pt-1">
      <header className="px-1">
        <h2 className="text-[18px] font-bold leading-tight">من أين تحب أن تبدأ؟</h2>
        <p className="text-[11.5px] text-muted-foreground mt-1 leading-relaxed">
          نرتّب مكتبتك لتظهر المجالات المختارة أولاً — وكل الأنظمة الـ16 متاحة دائماً
          من مركز الأنظمة، وتقدر تغيّر ترتيبها متى شئت
        </p>
      </header>

      <div className="grid grid-cols-2 gap-2.5">
        {DOMAIN_OPTIONS.map((d) => {
          const active = form.domains.includes(d.key);
          const Icon = d.icon;
          return (
            <motion.button
              key={d.key}
              type="button"
              whileTap={{ scale: 0.97 }}
              onClick={() => toggleDomain(d.key)}
              aria-pressed={active}
              className={cn(
                "text-start rounded-2xl p-3.5 min-h-[92px] flex flex-col justify-between transition-colors border",
                active
                  ? "bg-white border-gold/50 shadow-[0_0_0_2px_rgba(217,144,38,0.18),0_8px_20px_-12px_rgba(217,144,38,0.35)]"
                  : "glass-soft border-black/[0.05] hover:bg-black/[0.02]"
              )}
            >
              <span
                className={cn(
                  "w-9 h-9 rounded-xl flex items-center justify-center shrink-0 transition-colors",
                  active ? "bg-primary/15 text-gold" : "bg-black/[0.04] text-muted-foreground"
                )}
              >
                <Icon className="w-[18px] h-[18px]" strokeWidth={2.1} aria-hidden="true" />
              </span>
              <span>
                <span className="block text-[13px] font-bold">{d.label}</span>
                <span className="block text-[10px] text-muted-foreground leading-snug mt-0.5">{d.desc}</span>
              </span>
              <span
                className={cn(
                  "w-5 h-5 rounded-full border-2 flex items-center justify-center transition-colors self-end",
                  active ? "border-primary bg-primary" : "border-black/15 bg-white"
                )}
                aria-hidden="true"
              >
                {active && (
                  <svg viewBox="0 0 10 8" className="w-2.5 h-2.5" fill="none">
                    <path d="M1 4l2.5 2.5L9 1" stroke="#2a1a03" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" />
                  </svg>
                )}
              </span>
            </motion.button>
          );
        })}
      </div>

      <p className="text-center text-[10.5px] text-muted-foreground/80">
        {form.domains.length === 0 ? "لم تختر شيئاً — سنبدأ بالترتيب الافتراضي" : `اخترت ${form.domains.length} مجالات — ستتصدر مكتبتك`}
      </p>
    </div>
  );
}

// ═══════════════════════ الخطوة 3 — اللمسات الأخيرة (اختيارية) ═══════════════════════

function StepFinale({
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
  const [dayText, setDayText] = useState(String(form.monthStartDay));

  const setDay = (n: number) => {
    const clamped = Math.min(28, Math.max(1, Math.round(n) || 1));
    set("monthStartDay", clamped);
    setDayText(String(clamped));
  };

  return (
    <div className="space-y-4 pt-1">
      <header className="flex items-center gap-3 px-1">
        <span className="w-11 h-11 rounded-2xl glass flex items-center justify-center text-gold shrink-0">
          <Banknote className="w-5 h-5" aria-hidden="true" />
        </span>
        <div>
          <h2 className="text-[16px] font-bold leading-tight">لمسات أخيرة — كلها اختيارية</h2>
          <p className="text-[11px] text-muted-foreground mt-0.5">
            يمكنك تخطي هذه الخطوة كاملة وتعديل كل شيء لاحقاً من «أنا ← الإعدادات»
          </p>
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
                      ? "bg-primary/15 border-primary/50 text-gold"
                      : "glass-soft border-black/[0.06] text-foreground/80 hover:bg-black/[0.03]"
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
              onBlur={() => setDay(Number(dayText))}
              aria-label="يوم بداية الشهر المالي المخصص"
              className="h-11 w-20 rounded-xl glass-soft border border-black/[0.08] px-3 text-center text-[13px] font-bold tabular-nums focus:border-primary/50 focus:outline-none"
              placeholder="يوم"
            />
          </div>
        </div>
      </GlassCard>

      <p className="text-center text-[10.5px] text-muted-foreground/80 leading-relaxed">
        بياناتك تبقى على جهازك دائماً — تصديرها وحذفها بيديك من مركز الثقة
      </p>
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
        <span className="w-10 h-10 rounded-xl bg-primary/10 text-gold flex items-center justify-center shrink-0">
          <Banknote className="w-5 h-5" aria-hidden="true" />
        </span>
        <span className="text-start flex-1 min-w-0">
          <span className="block text-[13px] font-bold">{title}</span>
          <span className="block text-[10.5px] text-muted-foreground mt-0.5">{hint}</span>
        </span>
        {value && (
          <span className="shrink-0 text-[15px] font-bold text-gold tabular">
            {displayAmount(value, "latn")}
            <span className="text-[10px] text-muted-foreground font-medium"> {currency}</span>
          </span>
        )}
        <ChevronRight
          className={cn("w-4 h-4 text-muted-foreground shrink-0 transition-transform", open && "rotate-90")}
          aria-hidden="true"
        />
      </button>
      <AnimatePresence initial={false}>
        {open && (
          <motion.div
            id={`pad-${id}`}
            initial={{ height: 0, opacity: 0 }}
            animate={{ height: "auto", opacity: 1 }}
            exit={{ height: 0, opacity: 0 }}
            transition={{ duration: 0.25, ease: [0.22, 1, 0.36, 1] }}
            className="overflow-hidden"
          >
            <div className="px-3 pb-3 border-t border-black/[0.05] pt-3">
              <NumberPad
                value={value}
                onChange={onChange}
              />
            </div>
          </motion.div>
        )}
      </AnimatePresence>
    </GlassCard>
  );
}
