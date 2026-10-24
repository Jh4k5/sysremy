"use client";

/**
 * Systemy v2 — شاشة الإعدادات
 * الملف الشخصي / المظهر / الإشعارات / القفل / المالية / البيانات / حول —
 * أقسام قابلة للطي (framer-motion AnimatePresence). كل القراءات عبر useLive
 * وكل الكتابة عبر updateSettings/actions/helpers فقط — لا fetch ولا Prisma.
 */

import { useEffect, useRef, useState, type ChangeEvent, type ReactNode } from "react";
import Image from "next/image";
import { AnimatePresence, motion } from "framer-motion";
import {
  Activity, AlertTriangle, ArrowLeft, Bell, ChevronDown, Database, Download, Info,
  KeyRound, Lock, Palette, RotateCcw, Save, ShieldCheck, Sparkles, Trash2, Upload,
  User, Wallet, X,
} from "lucide-react";
import { toast } from "sonner";
import { Switch } from "@/components/ui/switch";
import {
  db, getSettings, resetScope, RESET_SCOPES, RESET_SCOPE_LABELS, useLive, type ResetScope,
} from "@/lib/db";
import { updateSettings } from "@/lib/actions";
import {
  deleteAccountForever, exportBackup, hashPin, healthCheck, importBackup, peekBackup,
  type ImportMode,
} from "@/lib/backup";
import {
  notificationPermission, requestNotificationPermission, showAppNotification,
} from "@/lib/notifications";
import { formatDate, formatMoney, formatNumber, setCurrency } from "@/lib/format";
import { budgetPacing } from "@/lib/money";
import { useUIStore } from "@/store/ui-store";
import { Chip, GlassCard, widgetEnter } from "@/components/systemy/glass";
import { ChipRow, ConfirmBar, Field, inputCls, NumberPad, displayAmount } from "@/components/systemy/ui-bits";
import { PinDots, PinPad } from "@/components/systemy/lock/lock-screen";
import { cn } from "@/lib/utils";
import type { AccentKey, Category, DigitStyle, Settings, Transaction, WeekStart } from "@/lib/types";

// ═══════════════════════ ثوابت مشتركة (يستوردها الإعداد الأولي أيضاً) ═══════════════════════

export const AVATAR_EMOJIS = ["🌙", "☀️", "⭐", "🦅", "🐳", "🌵", "🎯", "🧠"] as const;

export const CURRENCY_CHIPS: Array<{ k: string; v: string }> = [
  { k: "ر.س", v: "ر.س" },
  { k: "د.إ", v: "د.إ" },
  { k: "ج.م", v: "ج.م" },
  { k: "د.ك", v: "د.ك" },
  { k: "$", v: "$" },
  { k: "¥", v: "¥" },
  { k: "€", v: "€" },
];

export const WEEK_START_OPTIONS: Array<{ k: WeekStart; v: string }> = [
  { k: "sat", v: "السبت" },
  { k: "sun", v: "الأحد" },
  { k: "mon", v: "الاثنين" },
];

export const ACCENTS: Record<AccentKey, { color: string; label: string }> = {
  gold: { color: "#F5B95C", label: "ذهبي" },
  cyan: { color: "#5CE1E6", label: "سماوي" },
  mint: { color: "#6EE7A8", label: "نعناعي" },
  coral: { color: "#FF8E7A", label: "مرجاني" },
  lav: { color: "#C4B5FD", label: "بنفسجي" },
};

/** تطبيق لون التمييز فوراً على جذر المستند (يُستدعى عند التحميل وعند الاختيار) */
export function applyAccent(color: string): void {
  if (typeof document === "undefined") return;
  document.documentElement.style.setProperty("--primary", color);
  document.documentElement.style.setProperty("--ring", color);
}

const APP_VERSION = "5.0";

/** عناوين عربية للجداول (للمعاينات والتشخيص) */
const TABLE_AR: Record<string, string> = {
  settings: "الإعدادات",
  accounts: "الحسابات",
  categories: "الفئات",
  transactions: "المعاملات",
  habits: "العادات",
  habitLogs: "سجلات العادات",
  moods: "المزاج",
  tasks: "المهام",
  notes: "الملاحظات واليوميات",
  goals: "الأهداف",
  recurrings: "الالتزامات المتكررة",
  assets: "الأصول",
  debts: "الديون",
  blocks: "أحداث التقويم",
  reminders: "التذكيرات",
  systems: "الأنظمة",
  chat: "محادثات Sys",
};

/** جداول كل نطاقات إعادة الضبط (عدا everything) — للأعداد الحية */
const RESET_COUNT_TABLES: readonly string[] = Array.from(
  new Set([
    ...RESET_SCOPES.money, ...RESET_SCOPES.habitsTasks,
    ...RESET_SCOPES.journal, ...RESET_SCOPES.calendar,
  ])
);

function tableCount(name: string): Promise<number> {
  return (db as unknown as Record<string, { count: () => Promise<number> }>)[name].count();
}

const clampDay = (v: string | number): number =>
  Math.min(28, Math.max(1, Math.round(Number(v) || 1)));

// ═══════════════════════ قسم قابل للطي ═══════════════════════

function Section({
  id,
  icon,
  title,
  subtitle,
  defaultOpen = false,
  children,
}: {
  id: string;
  icon: ReactNode;
  title: string;
  subtitle: string;
  defaultOpen?: boolean;
  children: ReactNode;
}) {
  const [open, setOpen] = useState(defaultOpen);
  return (
    <GlassCard>
      <button
        type="button"
        onClick={() => setOpen((o) => !o)}
        aria-expanded={open}
        aria-controls={`sec-${id}`}
        className="w-full min-h-16 flex items-center gap-3 p-4"
      >
        <span className="w-10 h-10 rounded-xl bg-primary/12 text-primary flex items-center justify-center shrink-0">
          {icon}
        </span>
        <span className="flex-1 min-w-0 text-right">
          <span className="block text-[13.5px] font-bold text-foreground">{title}</span>
          <span className="block text-[11px] text-muted-foreground mt-0.5 truncate">{subtitle}</span>
        </span>
        <ChevronDown
          className={cn(
            "w-[18px] h-[18px] text-muted-foreground transition-transform duration-300 shrink-0",
            open && "rotate-180"
          )}
          aria-hidden="true"
        />
      </button>
      <AnimatePresence initial={false}>
        {open && (
          <motion.div
            id={`sec-${id}`}
            initial={{ height: 0, opacity: 0 }}
            animate={{ height: "auto", opacity: 1 }}
            exit={{ height: 0, opacity: 0 }}
            transition={{ duration: 0.32, ease: [0.22, 1, 0.36, 1] }}
            className="overflow-hidden"
          >
            <div className="px-4 pb-4 pt-1 space-y-4">{children}</div>
          </motion.div>
        )}
      </AnimatePresence>
    </GlassCard>
  );
}

// ═══════════════════════ الشاشة الرئيسية ═══════════════════════

export function SettingsScreen() {
  const settings = useLive<Settings>(() => getSettings(), []);
  const [pinDialog, setPinDialog] = useState<PinDialogVariant | null>(null);

  // تطبيق العملة واللون المميز فور توفر الإعدادات وعند كل تغيير
  useEffect(() => {
    if (!settings) return;
    setCurrency(settings.currency);
    applyAccent((ACCENTS[settings.accent] ?? ACCENTS.gold).color);
  }, [settings]);

  if (!settings) {
    return (
      <div
        className="h-full overflow-y-auto sys-scroll px-4 pt-3 pb-28"
        aria-busy="true"
        aria-label="جارٍ تحميل الإعدادات"
      >
        <div className="space-y-3.5">
          <div className="h-[84px] rounded-3xl glass animate-pulse" />
          {[0, 1, 2, 3, 4, 5, 6].map((i) => (
            <div key={i} className="h-[72px] rounded-3xl glass animate-pulse" />
          ))}
        </div>
      </div>
    );
  }

  // إعادة تهيئة نموذج الملف عند تغير القيم المحفوظة فقط (وليس كل تحديث)
  const profileKey = [
    settings.displayName, settings.avatarEmoji, settings.currency,
    settings.monthStartDay, settings.weekStart,
  ].join("|");

  return (
    <div className="relative h-full">
      <div className="h-full overflow-y-auto sys-scroll px-4 pt-3 pb-28">
        <motion.div {...widgetEnter()} className="space-y-3.5">
          {/* بطاقة الملخص */}
          <GlassCard className="p-4 flex items-center gap-3.5">
            <span className="w-14 h-14 rounded-2xl glass-soft flex items-center justify-center text-[30px] shrink-0" aria-hidden="true">
              {settings.avatarEmoji || "🌙"}
            </span>
            <div className="flex-1 min-w-0">
              <p className="text-[15.5px] font-bold truncate">
                {settings.displayName || "صاحب النظام"}
              </p>
              <p className="text-[11px] text-muted-foreground mt-0.5 flex items-center gap-1.5">
                <Image src="/brand/logo-128.png" alt="" width={18} height={18} className="rounded-md shrink-0" aria-hidden="true" />
                Systemy — نظام تشغيلك الشخصي
              </p>
            </div>
            <Chip className="text-primary border border-primary/25 shrink-0">v{APP_VERSION}</Chip>
          </GlassCard>

          <ProfileSection key={profileKey} settings={settings} />
          <AppearanceSection settings={settings} />
          <NotificationsSection settings={settings} />
          <LockSection settings={settings} onDialog={setPinDialog} />
          <FinanceSection key={settings.monthlyIncome} settings={settings} />
          <DataSection />
          <AboutSection />

          <p className="text-center text-[10.5px] text-muted-foreground/70 pt-1">
            Systemy v{APP_VERSION} · يعمل بكامله على جهازك
          </p>
        </motion.div>
      </div>

      {/* نافذة رمز القفل فوق كل شيء */}
      <AnimatePresence>
        {pinDialog !== null && (
          <PinDialog
            key="pin-dialog"
            variant={pinDialog}
            pinHash={settings.pinHash}
            digits={settings.digits}
            onClose={() => setPinDialog(null)}
          />
        )}
      </AnimatePresence>
    </div>
  );
}

// ═══════════════════════ 1) الملف الشخصي ═══════════════════════

function ProfileSection({ settings }: { settings: Settings }) {
  const [name, setName] = useState(settings.displayName);
  const [avatar, setAvatar] = useState(settings.avatarEmoji);
  const [currency, setCurrencyLocal] = useState(settings.currency);
  const [monthDay, setMonthDay] = useState(String(settings.monthStartDay));
  const [weekStart, setWeekStart] = useState<WeekStart>(settings.weekStart);
  const [busy, setBusy] = useState(false);

  const dirty =
    name.trim() !== settings.displayName ||
    avatar !== settings.avatarEmoji ||
    currency.trim() !== settings.currency ||
    clampDay(monthDay) !== settings.monthStartDay ||
    weekStart !== settings.weekStart;

  const save = async () => {
    setBusy(true);
    try {
      const finalCurrency = currency.trim() || "ر.س";
      await updateSettings({
        displayName: name.trim(),
        avatarEmoji: avatar,
        currency: finalCurrency,
        monthStartDay: clampDay(monthDay),
        weekStart,
      });
      setCurrency(finalCurrency);
      toast.success("حُفظ الملف الشخصي ✓", { description: "انعكس على كل الشاشات فوراً" });
    } finally {
      setBusy(false);
    }
  };

  return (
    <Section
      id="profile"
      icon={<User className="w-5 h-5" aria-hidden="true" />}
      title="الملف الشخصي"
      subtitle="الاسم والرمز والعملة وبدايات دوراتك"
      defaultOpen
    >
      <div className="space-y-2">
        <p className="text-[11.5px] font-medium text-muted-foreground">رمز الشخصية</p>
        <div className="grid grid-cols-8 gap-1.5" role="radiogroup" aria-label="اختيار رمز الشخصية">
          {AVATAR_EMOJIS.map((emoji) => {
            const active = avatar === emoji;
            return (
              <motion.button
                key={emoji}
                type="button"
                role="radio"
                aria-checked={active}
                aria-label={`رمز ${emoji}`}
                whileTap={{ scale: 0.85 }}
                onClick={() => setAvatar(emoji)}
                className={cn(
                  "aspect-square min-h-11 rounded-xl flex items-center justify-center text-[20px] transition-all",
                  active
                    ? "bg-primary/25 border border-primary/50 scale-105"
                    : "glass-soft border border-white/[0.06] hover:bg-white/[0.06]"
                )}
              >
                <span aria-hidden="true">{emoji}</span>
              </motion.button>
            );
          })}
        </div>
      </div>

      <Field label="الاسم المعروض">
        <input
          className={inputCls}
          value={name}
          onChange={(e) => setName(e.target.value)}
          placeholder="مثال: خالد"
          maxLength={30}
          autoComplete="off"
          aria-label="الاسم المعروض"
        />
      </Field>

      <ChipRow
        label="العملة"
        options={CURRENCY_CHIPS}
        value={currency}
        onSelect={setCurrencyLocal}
      />
      <Field label="أو رمز عملة مخصص">
        <input
          className={inputCls}
          dir="ltr"
          value={currency}
          onChange={(e) => setCurrencyLocal(e.target.value)}
          placeholder="مثال: ر.ع أو £"
          maxLength={6}
          aria-label="رمز عملة مخصص"
        />
      </Field>

      <div className="space-y-2">
        <p className="text-[11.5px] font-medium text-muted-foreground">بداية الشهر المالي (1-28)</p>
        <div className="flex gap-2 items-center flex-wrap">
          {[1, 5, 15, 25].map((d) => {
            const active = clampDay(monthDay) === d;
            return (
              <button
                key={d}
                type="button"
                onClick={() => setMonthDay(String(d))}
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
            value={monthDay}
            onChange={(e) => setMonthDay(e.target.value)}
            onBlur={() => setMonthDay(String(clampDay(monthDay)))}
            className="w-24 h-11 min-h-11 rounded-xl glass-soft border border-white/[0.08] px-3 text-center text-[13px] tabular-nums focus:border-primary/40 focus:outline-none transition-colors"
            aria-label="يوم بداية الشهر المالي من 1 إلى 28"
          />
        </div>
      </div>

      <ChipRow
        label="بداية الأسبوع"
        options={WEEK_START_OPTIONS}
        value={weekStart}
        onSelect={(k) => setWeekStart(k as WeekStart)}
      />

      <button
        type="button"
        onClick={() => void save()}
        disabled={!dirty || busy}
        className="w-full h-12 min-h-12 rounded-2xl bg-primary text-primary-foreground text-[14px] font-bold flex items-center justify-center gap-2 glow-gold transition-transform active:scale-[0.98] disabled:opacity-40"
      >
        <Save className="w-[18px] h-[18px]" aria-hidden="true" />
        {busy ? "جارٍ الحفظ…" : "حفظ التغييرات"}
      </button>
    </Section>
  );
}

// ═══════════════════════ 2) المظهر ═══════════════════════

function AppearanceSection({ settings }: { settings: Settings }) {
  const chooseDigits = async (k: string) => {
    if (k === settings.digits) return;
    await updateSettings({ digits: k as DigitStyle });
    toast.success(k === "arab" ? "الأرقام الهندية ١٢٣ ✓" : "الأرقام اللاتينية 123 ✓");
  };

  const chooseAccent = async (k: AccentKey) => {
    if (k === settings.accent) return;
    applyAccent(ACCENTS[k].color); // تطبيق حي فوري
    await updateSettings({ accent: k });
    toast.success(`اللون المميز: ${ACCENTS[k].label} ✓`);
  };

  return (
    <Section
      id="appearance"
      icon={<Palette className="w-5 h-5" aria-hidden="true" />}
      title="المظهر"
      subtitle="نمط الأرقام ولون التمييز"
    >
      <ChipRow
        label="نمط الأرقام في كل التطبيق"
        options={[
          { k: "latn", v: "لاتينية 123" },
          { k: "arab", v: "هندية ١٢٣" },
        ]}
        value={settings.digits}
        onSelect={(k) => void chooseDigits(k)}
      />

      <div className="space-y-2.5">
        <p className="text-[11.5px] font-medium text-muted-foreground">لون التمييز — يتغير فوراً</p>
        <div className="flex gap-2" role="radiogroup" aria-label="لون التمييز">
          {(Object.keys(ACCENTS) as AccentKey[]).map((k) => {
            const active = settings.accent === k;
            return (
              <button
                key={k}
                type="button"
                role="radio"
                aria-checked={active}
                aria-label={`اللون ${ACCENTS[k].label}`}
                onClick={() => void chooseAccent(k)}
                className={cn(
                  "flex-1 min-h-11 flex flex-col items-center gap-1.5 py-2.5 rounded-xl border transition-all active:scale-95",
                  active
                    ? "border-white/25 bg-white/[0.07]"
                    : "border-transparent hover:bg-white/[0.04]"
                )}
              >
                <span
                  className={cn(
                    "w-8 h-8 rounded-full border-2 transition-all",
                    active ? "border-white shadow-lg scale-110" : "border-white/15"
                  )}
                  style={{ background: ACCENTS[k].color }}
                  aria-hidden="true"
                />
                <span className="text-[10.5px] font-medium text-foreground/85">{ACCENTS[k].label}</span>
              </button>
            );
          })}
        </div>
      </div>
    </Section>
  );
}

// ═══════════════════════ 3) الإشعارات ═══════════════════════

type PermState = "default" | "granted" | "denied" | "unsupported";

function NotificationsSection({ settings }: { settings: Settings }) {
  // القراءة الأولية آمنة: القسم لا يُركّب إلا بعد تحميل الإعدادات في العميل
  // (useLive يبدأ null فيرندر SSR الهيكل العظمي فقط) — لا خطر انزياح ترطيب.
  const [perm, setPerm] = useState<PermState>(() => notificationPermission());

  const badge =
    perm === "granted"
      ? { text: "ممنوح", cls: "text-mint border-mint/30" }
      : perm === "denied"
        ? { text: "مرفوض", cls: "text-coral border-coral/30" }
        : perm === "unsupported"
          ? { text: "غير مدعوم", cls: "text-muted-foreground border-white/10" }
          : { text: "بانتظار السماح", cls: "text-muted-foreground border-white/10" };

  const toggleBrowser = async (next: boolean) => {
    if (next) {
      const res = await requestNotificationPermission();
      setPerm(res === "unsupported" ? "unsupported" : res);
      if (res === "granted") {
        await updateSettings({ notificationsEnabled: true });
        toast.success("الإشعارات مفعّلة ✓");
        showAppNotification("Systemy", { body: "الإشعارات تعمل ✓" });
      } else {
        await updateSettings({ notificationsEnabled: false });
        toast.error(
          res === "unsupported" ? "هذا المتصفح لا يدعم الإشعارات" : "رُفضت صلاحية الإشعارات",
          { description: "يمكنك السماح بها من إعدادات المتصفح ثم إعادة المحاولة" },
        );
      }
    } else {
      await updateSettings({ notificationsEnabled: false });
      toast("أُوقفت إشعارات المتصفح");
    }
  };

  const toggleInApp = async (next: boolean) => {
    await updateSettings({ inAppAlerts: next });
  };

  const test = () => {
    const shown = showAppNotification("Systemy", { body: "الإشعارات تعمل ✓" });
    if (!shown) toast.error("لم تظهر الإشعارات — تحقق من صلاحية المتصفح");
  };

  return (
    <Section
      id="notifications"
      icon={<Bell className="w-5 h-5" aria-hidden="true" />}
      title="الإشعارات"
      subtitle="تنبيهات المتصفح ومركز التنبيهات"
    >
      <div className="flex items-center justify-between gap-3 rounded-xl glass-soft p-3.5 min-h-11">
        <div className="flex-1 min-w-0">
          <p className="text-[13px] font-semibold">إشعارات المتصفح</p>
          <p className="text-[11px] text-muted-foreground mt-0.5">تذكيرات المهام والالتزامات والمستحقات</p>
        </div>
        <Switch
          checked={settings.notificationsEnabled}
          onCheckedChange={(v) => void toggleBrowser(v)}
          aria-label="تفعيل إشعارات المتصفح"
        />
      </div>

      <div className="flex items-center justify-between gap-2 flex-wrap">
        <span className="text-[11.5px] text-muted-foreground">حالة الصلاحية:</span>
        <span className={cn("text-[11px] font-bold rounded-full border px-2.5 py-1", badge.cls)}>
          {badge.text}
        </span>
        {perm === "granted" && (
          <button
            type="button"
            onClick={test}
            className="h-11 min-h-11 px-4 rounded-xl bg-primary/15 border border-primary/30 text-primary text-[11.5px] font-bold transition-colors hover:bg-primary/25"
          >
            تجربة إشعار
          </button>
        )}
      </div>
      {perm === "denied" && (
        <p className="text-[10.5px] text-muted-foreground/80 leading-relaxed">
          الرفض محفوظ في المتصفح — من إعدادات الموقع/التطبيق أعِد السماح بالإشعارات ثم فعّلها من هنا.
        </p>
      )}

      <div className="flex items-center justify-between gap-3 rounded-xl glass-soft p-3.5 min-h-11">
        <div className="flex-1 min-w-0">
          <p className="text-[13px] font-semibold">تنبيهات داخل التطبيق</p>
          <p className="text-[11px] text-muted-foreground mt-0.5">مركز التنبيهات الذكي أعلى الشاشة</p>
        </div>
        <Switch
          checked={settings.inAppAlerts}
          onCheckedChange={(v) => void toggleInApp(v)}
          aria-label="تفعيل التنبيهات داخل التطبيق"
        />
      </div>
    </Section>
  );
}

// ═══════════════════════ 4) القفل + نافذة الرمز ═══════════════════════

type PinDialogVariant = "set" | "verify" | "disable" | "change";
type PinPhase = "old" | "new" | "confirm";

function LockSection({
  settings,
  onDialog,
}: {
  settings: Settings;
  onDialog: (v: PinDialogVariant | null) => void;
}) {
  const toggle = (next: boolean) => {
    if (next) onDialog(settings.pinHash ? "verify" : "set");
    else if (settings.pinHash) onDialog("disable");
  };

  return (
    <Section
      id="lock"
      icon={<Lock className="w-5 h-5" aria-hidden="true" />}
      title="القفل"
      subtitle="رمز PIN عند فتح التطبيق — مخزّن كتجزئة"
    >
      <div className="flex items-center justify-between gap-3 rounded-xl glass-soft p-3.5 min-h-11">
        <div className="flex-1 min-w-0">
          <p className="text-[13px] font-semibold">قفل التطبيق</p>
          <p className="text-[11px] text-muted-foreground mt-0.5">رمز من 4 أرقام عند الفتح</p>
        </div>
        <Switch
          checked={settings.lockEnabled}
          onCheckedChange={toggle}
          aria-label="تفعيل قفل التطبيق برمز PIN"
        />
      </div>

      <div className="flex items-start gap-2 rounded-xl bg-primary/[0.07] border border-primary/20 px-3 py-2.5 text-primary">
        <AlertTriangle className="mt-0.5 w-3.5 h-3.5 shrink-0" aria-hidden="true" />
        <p className="text-[11px] leading-relaxed">
          فقدان الرمز يمنع الدخول — لا استعادة بريد إلكتروني هنا. صدّر نسخة احتياطية دورياً.
        </p>
      </div>

      {settings.pinHash && (
        <button
          type="button"
          onClick={() => onDialog("change")}
          className="w-full h-12 min-h-12 rounded-xl glass-soft border border-white/[0.08] text-[13px] font-semibold flex items-center justify-center gap-2 transition-colors hover:bg-white/[0.06]"
        >
          <KeyRound className="w-4 h-4" aria-hidden="true" />
          تغيير الرمز
        </button>
      )}

      {settings.lockEnabled && (
        <p className="flex items-center gap-1.5 text-[10.5px] text-muted-foreground">
          <ShieldCheck className="w-3.5 h-3.5 text-mint shrink-0" aria-hidden="true" />
          القفل مفعّل — سيُطلب الرمز عند فتح التطبيق
        </p>
      )}
    </Section>
  );
}

/** نافذة رمز القفل: تعيين (إدخال→تأكيد) / تحقق / تعطيل / تغيير (تحقق→جديد→تأكيد) */
function PinDialog({
  variant,
  pinHash,
  digits,
  onClose,
}: {
  variant: PinDialogVariant;
  pinHash?: string;
  digits: DigitStyle;
  onClose: () => void;
}) {
  const [phase, setPhase] = useState<PinPhase>(variant === "set" ? "new" : "old");
  const [pin, setPin] = useState("");
  const [first, setFirst] = useState("");
  const [error, setError] = useState("");
  const [busy, setBusy] = useState(false);
  const [shakeKey, setShakeKey] = useState(0);

  useEffect(() => {
    setPhase(variant === "set" ? "new" : "old");
    setPin("");
    setFirst("");
    setError("");
    setBusy(false);
  }, [variant]);

  // إغلاق بمفتاح الهروب
  useEffect(() => {
    const handler = (e: KeyboardEvent) => {
      if (e.key === "Escape") onClose();
    };
    window.addEventListener("keydown", handler);
    return () => window.removeEventListener("keydown", handler);
  }, [onClose]);

  const copy = (() => {
    if (phase === "confirm") return { title: "أكّد الرمز الجديد", desc: "أعد إدخال الأرقام الأربعة نفسها" };
    if (phase === "new") {
      return variant === "set"
        ? { title: "تعيين رمز قفل جديد", desc: "اختر 4 أرقام — ستُطلب عند فتح التطبيق" }
        : { title: "الرمز الجديد", desc: "خطوة 2 من 2 — اختر رمزاً من 4 أرقام" };
    }
    if (variant === "disable") return { title: "أدخل رمزك الحالي", desc: "لتأكيد تعطيل القفل المحلي" };
    if (variant === "change") return { title: "الرمز الحالي", desc: "خطوة 1 من 2 — قبل تعيين الرمز الجديد" };
    return { title: "أدخل رمزك الحالي", desc: "لتفعيل القفل المحلي من جديد" };
  })();

  const fail = (msg: string) => {
    setError(msg);
    setPin("");
    setShakeKey((k) => k + 1);
  };

  const onFull = async (value: string) => {
    if (busy) return;
    setBusy(true);
    try {
      if (phase === "old") {
        const h = await hashPin(value);
        if (!pinHash || h !== pinHash) {
          fail("رمز غير صحيح — حاول مجدداً");
          return;
        }
        if (variant === "change") {
          setPhase("new");
          setPin("");
          setError("");
          return;
        }
        if (variant === "disable") {
          await updateSettings({ lockEnabled: false });
          toast.success("عُطّل القفل المحلي ✓");
        } else {
          await updateSettings({ lockEnabled: true });
          toast.success("فُعّل القفل المحلي ✓");
        }
        onClose();
      } else if (phase === "new") {
        setFirst(value);
        setPhase("confirm");
        setPin("");
        setError("");
      } else {
        if (value !== first) {
          setPhase("new");
          setFirst("");
          fail("الرمزان غير متطابقين — اختر من جديد");
          return;
        }
        const hash = await hashPin(value);
        if (variant === "set") {
          await updateSettings({ lockEnabled: true, pinHash: hash });
          toast.success("فُعّل القفل المحلي ✓");
        } else {
          await updateSettings({ pinHash: hash });
          toast.success("غُيّر رمز القفل ✓");
        }
        onClose();
      }
    } finally {
      setBusy(false);
    }
  };

  const press = (digit: string) => {
    if (busy) return;
    if (error) setError("");
    const next = (pin + digit).slice(0, 4);
    setPin(next);
    if (next.length === 4) void onFull(next);
  };

  return (
    <motion.div
      initial={{ opacity: 0 }}
      animate={{ opacity: 1 }}
      exit={{ opacity: 0 }}
      className="absolute inset-0 z-50 flex items-center justify-center p-5"
      role="dialog"
      aria-modal="true"
      aria-label={copy.title}
    >
      <div className="absolute inset-0 bg-[#05070d]/70 backdrop-blur-[6px]" onClick={onClose} aria-hidden="true" />
      <motion.div
        key={shakeKey}
        animate={shakeKey > 0 ? { x: [0, -10, 10, -8, 8, -4, 4, 0] } : undefined}
        transition={{ duration: 0.45 }}
        className="relative w-full max-w-[330px]"
      >
        <div className="glass-deep rounded-3xl p-5 space-y-4">
          <div className="flex flex-col items-center text-center gap-2">
            <span className="w-12 h-12 rounded-2xl bg-primary/15 text-primary flex items-center justify-center">
              <Lock className="w-5.5 h-5.5" aria-hidden="true" />
            </span>
            <div>
              <p className="text-[15px] font-bold">{copy.title}</p>
              <p className="text-[11px] text-muted-foreground mt-0.5">{copy.desc}</p>
            </div>
          </div>

          <PinDots count={4} filled={pin.length} error={!!error} busy={busy} />

          <p className="h-4 text-center text-[11.5px] text-destructive" role={error ? "alert" : undefined}>
            {error}
          </p>

          <PinPad
            onDigit={press}
            onBack={() => setPin((p) => p.slice(0, -1))}
            disabled={busy}
            digits={digits}
          />

          <button
            type="button"
            onClick={onClose}
            disabled={busy}
            className="w-full h-11 min-h-11 rounded-xl glass-soft border border-white/[0.08] text-[12.5px] font-medium transition-colors hover:bg-white/[0.06] disabled:opacity-50"
          >
            إلغاء
          </button>

          <p className="text-center text-[10px] leading-relaxed text-muted-foreground/70">
            يُخزَّن الرمز محلياً كتجزئة SHA-256 مع ملح — لا يغادر جهازك أبداً
          </p>
        </div>
      </motion.div>
    </motion.div>
  );
}

// ═══════════════════════ 5) المالية ═══════════════════════

function FinanceSection({ settings }: { settings: Settings }) {
  const [editing, setEditing] = useState(false);
  const [value, setValue] = useState("");
  const [busy, setBusy] = useState(false);
  // ميزانية الصرف الشهرية — نفس نمط الدخل (حالة محلية + حفظ عند الاعتماد)
  const [budgetEditing, setBudgetEditing] = useState(false);
  const [budgetValue, setBudgetValue] = useState("");
  const [budgetBusy, setBudgetBusy] = useState(false);
  const [adoptBusy, setAdoptBusy] = useState(false);
  const goToMoney = useUIStore((s) => s.goToMoney);

  // قراءات حية للفئات والمعاملات — لاشتقاق وتيرة الميزانية (اليوم/الأسبوع/الشهر)
  const categories = useLive<Category[]>(() => db.categories.toArray(), []);
  const txs = useLive<Transaction[]>(() => db.transactions.toArray(), []);
  const pacing = budgetPacing(settings, categories ?? [], txs ?? []);

  const currentBudget = settings.monthlyBudget ?? 0;
  const showAdopt = pacing.envelopesSum > 0 && pacing.envelopesSum !== currentBudget;

  const startEdit = () => {
    setValue(settings.monthlyIncome ? String(settings.monthlyIncome) : "");
    setEditing(true);
  };

  const save = async () => {
    setBusy(true);
    try {
      await updateSettings({ monthlyIncome: Math.round((Number(value) || 0) * 100) / 100 });
      toast.success("حُدّث الدخل الشهري ✓", { description: "أُعيد حساب الرصيد الآمن" });
      setEditing(false);
    } finally {
      setBusy(false);
    }
  };

  const startBudgetEdit = () => {
    setBudgetValue(currentBudget > 0 ? String(currentBudget) : "");
    setBudgetEditing(true);
  };

  const saveBudget = async () => {
    setBudgetBusy(true);
    try {
      await updateSettings({ monthlyBudget: Math.round((Number(budgetValue) || 0) * 100) / 100 });
      toast.success("حُدّثت ميزانية الصرف ✓", { description: "أُعيد حساب متبقي اليوم والأسبوع والشهر" });
      setBudgetEditing(false);
    } finally {
      setBudgetBusy(false);
    }
  };

  const adoptEnvelopes = async () => {
    if (adoptBusy) return;
    setAdoptBusy(true);
    try {
      await updateSettings({ monthlyBudget: pacing.envelopesSum });
      toast.success("اعتُمدت مظاريفك كميزانية صرف ✓", {
        description: `${formatMoney(pacing.envelopesSum, settings.currency)} شهرياً — أُعيد حساب المتبقي`,
      });
    } finally {
      setAdoptBusy(false);
    }
  };

  return (
    <Section
      id="finance"
      icon={<Wallet className="w-5 h-5" aria-hidden="true" />}
      title="المالية"
      subtitle="الدخل والميزانية والرصيد الآمن"
    >
      <div className="flex items-center justify-between gap-3 rounded-xl glass-soft p-3.5 min-h-11">
        <div className="min-w-0">
          <p className="text-[11.5px] text-muted-foreground">الدخل الشهري التقديري</p>
          <p className="num-display text-lg text-primary mt-0.5">
            {formatMoney(settings.monthlyIncome, settings.currency)}
          </p>
        </div>
        <button
          type="button"
          onClick={() => (editing ? setEditing(false) : startEdit())}
          aria-label={editing ? "إغلاق تعديل الدخل" : "تعديل الدخل الشهري"}
          className="h-11 min-h-11 px-4 rounded-xl bg-primary/15 border border-primary/30 text-primary text-[12px] font-bold transition-colors hover:bg-primary/25 shrink-0"
        >
          {editing ? "إغلاق" : "تعديل"}
        </button>
      </div>

      <p className="flex items-start gap-1.5 text-[10.5px] text-muted-foreground/80 leading-relaxed">
        <Info className="w-3.5 h-3.5 mt-0.5 shrink-0" aria-hidden="true" />
        تُستخدم في حساب الرصيد الآمن اليومي ومؤشر الرؤى ومعدل الادخار
      </p>

      <AnimatePresence initial={false}>
        {editing && (
          <motion.div
            initial={{ height: 0, opacity: 0 }}
            animate={{ height: "auto", opacity: 1 }}
            exit={{ height: 0, opacity: 0 }}
            transition={{ duration: 0.3, ease: [0.22, 1, 0.36, 1] }}
            className="overflow-hidden"
          >
            <div className="space-y-3 pt-1">
              <p className="num-display text-[28px] text-center" dir="ltr" aria-label="المبلغ المدخل">
                {displayAmount(value || "0", settings.digits)}
                <span className="text-[13px] text-muted-foreground font-normal"> {settings.currency}</span>
              </p>
              <NumberPad value={value} onChange={setValue} digits={settings.digits} label="لوحة الدخل الشهري" />
              <button
                type="button"
                onClick={() => void save()}
                disabled={busy}
                className="w-full h-12 min-h-12 rounded-2xl bg-primary text-primary-foreground text-[14px] font-bold flex items-center justify-center gap-2 glow-gold transition-transform active:scale-[0.98] disabled:opacity-50"
              >
                <Save className="w-[18px] h-[18px]" aria-hidden="true" />
                {busy ? "جارٍ الحفظ…" : "حفظ الدخل الشهري"}
              </button>
            </div>
          </motion.div>
        )}
      </AnimatePresence>

      {/* ميزانية الصرف الشهرية — منفصلة عن الدخل */}
      <div className="flex items-center justify-between gap-3 rounded-xl glass-soft p-3.5 min-h-11">
        <div className="min-w-0">
          <p className="text-[11.5px] text-muted-foreground">ميزانية الصرف الشهرية</p>
          <p className="num-display text-lg text-primary mt-0.5">
            {currentBudget > 0
              ? formatMoney(currentBudget, settings.currency)
              : pacing.derived
                ? `${formatMoney(pacing.monthlyBudget, settings.currency)} · مشتقة من المظاريف`
                : "غير محددة بعد"}
          </p>
          {pacing.status !== "unset" && (
            <p className="text-[10.5px] text-muted-foreground/80 mt-0.5 tabular">
              ≈ {formatMoney(pacing.perDay, settings.currency)} يومياً · عبر {formatNumber(pacing.daysLeft)} يوماً متبقياً هذا الشهر
            </p>
          )}
        </div>
        <button
          type="button"
          onClick={() => (budgetEditing ? setBudgetEditing(false) : startBudgetEdit())}
          aria-label={budgetEditing ? "إغلاق تعديل ميزانية الصرف" : "تعديل ميزانية الصرف الشهرية"}
          className="h-11 min-h-11 px-4 rounded-xl bg-primary/15 border border-primary/30 text-primary text-[12px] font-bold transition-colors hover:bg-primary/25 shrink-0"
        >
          {budgetEditing ? "إغلاق" : "تعديل"}
        </button>
      </div>

      <p className="flex items-start gap-1.5 text-[10.5px] text-muted-foreground/80 leading-relaxed">
        <Info className="w-3.5 h-3.5 mt-0.5 shrink-0" aria-hidden="true" />
        منفصلة عن دخلك — منها يظهر متبقي اليوم والأسبوع والشهر في كل الواجهات
      </p>

      {showAdopt && (
        <button
          type="button"
          onClick={() => void adoptEnvelopes()}
          disabled={adoptBusy}
          className="w-full min-h-11 rounded-xl bg-primary/15 border border-primary/30 text-primary text-[12px] font-bold transition-colors hover:bg-primary/25 disabled:opacity-50"
          aria-label={`اعتماد مجموع المظاريف ${formatMoney(pacing.envelopesSum, settings.currency)} كميزانية صرف`}
        >
          {adoptBusy ? "جارٍ الاعتماد…" : `اعتمد مجموع المظاريف (${formatMoney(pacing.envelopesSum, settings.currency)})`}
        </button>
      )}

      <AnimatePresence initial={false}>
        {budgetEditing && (
          <motion.div
            initial={{ height: 0, opacity: 0 }}
            animate={{ height: "auto", opacity: 1 }}
            exit={{ height: 0, opacity: 0 }}
            transition={{ duration: 0.3, ease: [0.22, 1, 0.36, 1] }}
            className="overflow-hidden"
          >
            <div className="space-y-3 pt-1">
              <p className="num-display text-[28px] text-center" dir="ltr" aria-label="المبلغ المدخل">
                {displayAmount(budgetValue || "0", settings.digits)}
                <span className="text-[13px] text-muted-foreground font-normal"> {settings.currency}</span>
              </p>
              <NumberPad value={budgetValue} onChange={setBudgetValue} digits={settings.digits} label="لوحة ميزانية الصرف" />
              <button
                type="button"
                onClick={() => void saveBudget()}
                disabled={budgetBusy}
                className="w-full h-12 min-h-12 rounded-2xl bg-primary text-primary-foreground text-[14px] font-bold flex items-center justify-center gap-2 glow-gold transition-transform active:scale-[0.98] disabled:opacity-50"
              >
                <Save className="w-[18px] h-[18px]" aria-hidden="true" />
                {budgetBusy ? "جارٍ الحفظ…" : "حفظ ميزانية الصرف"}
              </button>
            </div>
          </motion.div>
        )}
      </AnimatePresence>

      <button
        type="button"
        onClick={() => goToMoney()}
        className="w-full min-h-11 flex items-center justify-between gap-2 rounded-xl glass-soft p-3.5 transition-colors hover:bg-white/[0.06]"
        aria-label="فتح شاشة المال"
      >
        <span className="text-[12.5px] font-semibold">فتح شاشة المال</span>
        <ArrowLeft className="w-4 h-4 text-primary" aria-hidden="true" />
      </button>
    </Section>
  );
}

// ═══════════════════════ 6) البيانات (القسم الحرج) ═══════════════════════

interface ImportPreview {
  file: File;
  counts: Record<string, number>;
  exportedAt?: string;
}

function DataSection() {
  const fileRef = useRef<HTMLInputElement>(null);
  const [importPreview, setImportPreview] = useState<ImportPreview | null>(null);
  const [mode, setMode] = useState<ImportMode>("merge");
  const [importAsk, setImportAsk] = useState(false);
  const [importBusy, setImportBusy] = useState(false);
  const [scopeAsk, setScopeAsk] = useState<ResetScope | null>(null);
  const [resetBusy, setResetBusy] = useState(false);
  const [delStep, setDelStep] = useState(false);
  const [delText, setDelText] = useState("");
  const [diagOpen, setDiagOpen] = useState(false);
  const [diag, setDiag] = useState<Array<{ table: string; count: number }> | null>(null);

  const delArmed = delText.trim() === "حذف";

  // أعداد حية لكل جداول نطاقات إعادة الضبط — تتحدث فور أي تغيير
  const scopeCounts = useLive(async () => {
    const entries = await Promise.all(
      RESET_COUNT_TABLES.map(async (t) => [t, await tableCount(t)] as const)
    );
    return Object.fromEntries(entries) as Record<string, number>;
  }, []);

  const onFile = async (e: ChangeEvent<HTMLInputElement>) => {
    const f = e.target.files?.[0];
    e.target.value = "";
    if (!f) return;
    const isJson = f.name.toLowerCase().endsWith(".json") || f.type === "application/json";
    if (!isJson) {
      toast.error("اختر ملف JSON — نسخة احتياطية من Systemy");
      return;
    }
    const peek = await peekBackup(f);
    if (!peek.ok) {
      toast.error("هذا الملف ليس نسخة احتياطية صالحة من Systemy");
      return;
    }
    setImportPreview({ file: f, counts: peek.counts, exportedAt: peek.exportedAt });
    setMode("merge");
    setImportAsk(false);
  };

  const runImport = async () => {
    if (!importPreview) return;
    setImportBusy(true);
    try {
      await importBackup(importPreview.file, mode);
    } finally {
      setImportBusy(false);
      setImportPreview(null);
      setImportAsk(false);
    }
  };

  const runReset = async (scope: ResetScope) => {
    const total = RESET_SCOPES[scope].reduce((s, t) => s + (scopeCounts?.[t] ?? 0), 0);
    if (total === 0) {
      toast("هذا النطاق فارغ أصلاً — لا شيء لإعادة ضبطه");
      setScopeAsk(null);
      return;
    }
    setResetBusy(true);
    try {
      await resetScope(scope);
      toast.success("تمت إعادة الضبط", {
        description: `${RESET_SCOPE_LABELS[scope]} — بقية بياناتك كما هي`,
      });
    } finally {
      setResetBusy(false);
      setScopeAsk(null);
    }
  };

  const runDelete = async () => {
    if (!delArmed) return;
    await deleteAccountForever();
  };

  // تشخيص عند الفتح فقط
  useEffect(() => {
    if (!diagOpen) {
      setDiag(null);
      return;
    }
    let alive = true;
    void healthCheck().then((rows) => {
      if (alive) setDiag(rows);
    });
    return () => {
      alive = false;
    };
  }, [diagOpen]);

  const previewCount = importPreview
    ? Object.values(importPreview.counts).reduce((s, n) => s + n, 0)
    : 0;

  return (
    <Section
      id="data"
      icon={<Database className="w-5 h-5" aria-hidden="true" />}
      title="البيانات"
      subtitle="نسخ احتياطية، استيراد، إعادة ضبط وحذف نهائي"
    >
      {/* تصدير */}
      <button
        type="button"
        onClick={() => void exportBackup()}
        className="w-full min-h-11 flex items-center gap-3 rounded-xl glass-soft p-3.5 transition-colors hover:bg-white/[0.06]"
      >
        <Download className="w-[18px] h-[18px] text-primary shrink-0" aria-hidden="true" />
        <span className="flex-1 min-w-0 text-right">
          <span className="block text-[13px] font-semibold">تصدير نسخة احتياطية</span>
          <span className="block text-[10.5px] text-muted-foreground mt-0.5">
            كل حساباتك ومعاملاتك وعاداتك ويومياتك — ملف JSON على جهازك
          </span>
        </span>
      </button>

      {/* استيراد */}
      <button
        type="button"
        onClick={() => fileRef.current?.click()}
        className="w-full min-h-11 flex items-center gap-3 rounded-xl glass-soft p-3.5 transition-colors hover:bg-white/[0.06]"
        aria-label="استيراد نسخة احتياطية"
      >
        <Upload className="w-[18px] h-[18px] text-primary shrink-0" aria-hidden="true" />
        <span className="flex-1 min-w-0 text-right">
          <span className="block text-[13px] font-semibold">استيراد نسخة احتياطية</span>
          <span className="block text-[10.5px] text-muted-foreground mt-0.5">
            استبدال كامل أو دمج مع بياناتك الحالية
          </span>
        </span>
      </button>
      <input
        ref={fileRef}
        type="file"
        accept=".json,application/json"
        className="hidden"
        onChange={(e) => void onFile(e)}
        aria-hidden="true"
        tabIndex={-1}
      />

      {/* معاينة الاستيراد */}
      <AnimatePresence initial={false}>
        {importPreview && (
          <motion.div
            initial={{ height: 0, opacity: 0 }}
            animate={{ height: "auto", opacity: 1 }}
            exit={{ height: 0, opacity: 0 }}
            transition={{ duration: 0.3, ease: [0.22, 1, 0.36, 1] }}
            className="overflow-hidden"
          >
            <div className="rounded-2xl glass-deep p-4 space-y-3">
              <div className="flex items-start justify-between gap-2">
                <div className="min-w-0">
                  <p className="text-[12.5px] font-bold truncate">{importPreview.file.name}</p>
                  <p className="text-[10.5px] text-muted-foreground mt-0.5">
                    {importPreview.exportedAt ? `صُدّرت ${formatDate(importPreview.exportedAt)}` : "نسخة Systemy"}
                    {" · "}
                    {formatNumber(previewCount)} عنصراً
                  </p>
                </div>
                <button
                  type="button"
                  onClick={() => setImportPreview(null)}
                  aria-label="إغلاق معاينة الاستيراد"
                  className="w-11 h-11 min-h-11 rounded-xl glass-soft flex items-center justify-center shrink-0 transition-colors hover:bg-white/[0.06]"
                >
                  <X className="w-4 h-4" aria-hidden="true" />
                </button>
              </div>

              <div className="flex flex-wrap gap-1.5">
                {Object.entries(importPreview.counts)
                  .filter(([, n]) => n > 0)
                  .map(([t, n]) => (
                    <Chip key={t}>
                      {TABLE_AR[t] ?? t}
                      <span className="num font-bold text-foreground">{formatNumber(n)}</span>
                    </Chip>
                  ))}
              </div>

              <div>
                <ChipRow
                  label="طريقة الاستيراد"
                  options={[
                    { k: "merge", v: "دمج" },
                    { k: "replace", v: "استبدال" },
                  ]}
                  value={mode}
                  onSelect={(k) => setMode(k as ImportMode)}
                />
                <p className="text-[10.5px] text-muted-foreground/80 mt-2 leading-relaxed">
                  {mode === "merge"
                    ? "الدمج: تُضاف العناصر الجديدة فقط — بياناتك الحالية تبقى كما هي."
                    : "الاستبدال: تُمسح بياناتك الحالية نهائياً ويوضع محتوى النسخة مكانها."}
                </p>
              </div>

              {importAsk ? (
                <ConfirmBar
                  message={
                    mode === "replace"
                      ? "الاستبدال يمسح كل بياناتك الحالية نهائياً (حتى الإعدادات) ويضع محتوى النسخة مكانها — لا تراجع. هل صدّرت نسخة من وضعك الحالي؟"
                      : "سيُضاف كل عنصر جديد من النسخة إلى بياناتك الحالية دون تكرار."
                  }
                  confirmLabel={mode === "replace" ? "نعم، استبدل كل شيء" : "دمج الآن"}
                  danger={mode === "replace"}
                  onConfirm={() => void runImport()}
                  onCancel={() => setImportAsk(false)}
                />
              ) : (
                <button
                  type="button"
                  onClick={() => setImportAsk(true)}
                  disabled={importBusy}
                  className="w-full h-12 min-h-12 rounded-2xl bg-primary text-primary-foreground text-[14px] font-bold glow-gold transition-transform active:scale-[0.98] disabled:opacity-50"
                >
                  {importBusy ? "جارٍ الاستيراد…" : "متابعة الاستيراد"}
                </button>
              )}
            </div>
          </motion.div>
        )}
      </AnimatePresence>

      {/* إعادة الضبط الانتقائي */}
      <div className="space-y-2">
        <p className="text-[11.5px] font-medium text-muted-foreground">
          إعادة الضبط الانتقائي — تُمسح البيانات ويبقى الهيكل (الفئات والأنظمة)
        </p>
        {(Object.keys(RESET_SCOPES) as ResetScope[])
          .filter((s) => s !== "everything")
          .map((scope) => {
            const tables = RESET_SCOPES[scope];
            const total = tables.reduce((s, t) => s + (scopeCounts?.[t] ?? 0), 0);
            const open = scopeAsk === scope;
            return (
              <div key={scope} className="rounded-xl glass-soft p-3.5">
                <button
                  type="button"
                  onClick={() => setScopeAsk(open ? null : scope)}
                  aria-expanded={open}
                  aria-controls={`scope-${scope}`}
                  className="w-full min-h-11 flex items-center gap-2.5"
                >
                  <RotateCcw className="w-4 h-4 text-coral shrink-0" aria-hidden="true" />
                  <span className="flex-1 min-w-0 text-right text-[12.5px] font-semibold">
                    {RESET_SCOPE_LABELS[scope]}
                  </span>
                  <Chip className={total > 0 ? "text-coral" : "text-muted-foreground"}>
                    {total > 0 ? `${formatNumber(total)} عنصر` : "فارغ"}
                  </Chip>
                  <ChevronDown
                    className={cn(
                      "w-4 h-4 text-muted-foreground transition-transform duration-300 shrink-0",
                      open && "rotate-180"
                    )}
                    aria-hidden="true"
                  />
                </button>
                <AnimatePresence initial={false}>
                  {open && (
                    <motion.div
                      id={`scope-${scope}`}
                      initial={{ height: 0, opacity: 0 }}
                      animate={{ height: "auto", opacity: 1 }}
                      exit={{ height: 0, opacity: 0 }}
                      transition={{ duration: 0.28, ease: [0.22, 1, 0.36, 1] }}
                      className="overflow-hidden"
                    >
                      <div className="pt-3 space-y-3">
                        <div className="flex flex-wrap gap-1.5">
                          {tables.map((t) => (
                            <Chip key={t}>
                              {TABLE_AR[t] ?? t}
                              <span className="num font-bold text-foreground">
                                {formatNumber(scopeCounts?.[t] ?? 0)}
                              </span>
                            </Chip>
                          ))}
                        </div>
                        <ConfirmBar
                          message={`سيُحذف نهائياً ${formatNumber(total)} عنصراً من «${RESET_SCOPE_LABELS[scope]}» — لا يمكن التراجع. الفئات والأنظمة والإعدادات تبقى.`}
                          confirmLabel={resetBusy ? "جارٍ…" : "إعادة الضبط"}
                          onConfirm={() => void runReset(scope)}
                          onCancel={() => setScopeAsk(null)}
                        />
                      </div>
                    </motion.div>
                  )}
                </AnimatePresence>
              </div>
            );
          })}
      </div>

      {/* منطقة الخطر — حذف الحساب نهائياً */}
      <div className="rounded-2xl border border-destructive/25 bg-destructive/[0.05] p-4 space-y-3">
        <div className="flex items-center gap-2">
          <AlertTriangle className="w-4 h-4 text-destructive" aria-hidden="true" />
          <p className="text-[12.5px] font-bold text-destructive">منطقة الخطر</p>
        </div>
        <p className="text-[11px] leading-relaxed text-muted-foreground">
          حذف الحساب يمسح كل شيء نهائياً من هذا الجهاز — معاملات، عادات، يوميات، أهداف —
          ثم يعيد تشغيل شاشة الترحيب لبداية جديدة.
        </p>
        {!delStep ? (
          <button
            type="button"
            onClick={() => setDelStep(true)}
            className="w-full h-12 min-h-12 rounded-xl bg-destructive/15 border border-destructive/35 text-destructive text-[12.5px] font-bold flex items-center justify-center gap-2 transition-colors hover:bg-destructive/25"
          >
            <Trash2 className="w-4 h-4" aria-hidden="true" />
            حذف الحساب نهائياً…
          </button>
        ) : (
          <motion.div
            initial={{ opacity: 0, y: 6 }}
            animate={{ opacity: 1, y: 0 }}
            className="space-y-2.5"
          >
            <Field label="اكتب «حذف» لتأكيد الحذف النهائي">
              <input
                className={inputCls}
                value={delText}
                onChange={(e) => setDelText(e.target.value)}
                placeholder="حذف"
                autoComplete="off"
                aria-label="اكتب كلمة حذف للتأكيد"
              />
            </Field>
            <div className="flex gap-2">
              <button
                type="button"
                onClick={() => {
                  setDelStep(false);
                  setDelText("");
                }}
                className="flex-1 h-11 min-h-11 rounded-xl glass-soft border border-white/[0.08] text-[12.5px] font-medium transition-colors hover:bg-white/[0.06]"
              >
                رجوع
              </button>
              <button
                type="button"
                onClick={() => void runDelete()}
                disabled={!delArmed}
                className="flex-1 h-11 min-h-11 rounded-xl bg-destructive text-white text-[12.5px] font-bold transition-transform active:scale-95 disabled:opacity-40"
              >
                احذف كل شيء نهائياً
              </button>
            </div>
          </motion.div>
        )}
      </div>

      {/* تشخيص */}
      <div className="rounded-xl glass-soft p-3.5">
        <button
          type="button"
          onClick={() => setDiagOpen((o) => !o)}
          aria-expanded={diagOpen}
          aria-controls="diag-list"
          className="w-full min-h-11 flex items-center gap-2.5"
        >
          <Activity className="w-4 h-4 text-cyan" aria-hidden="true" />
          <span className="flex-1 text-right text-[12.5px] font-semibold">تشخيص البيانات</span>
          <ChevronDown
            className={cn(
              "w-4 h-4 text-muted-foreground transition-transform duration-300",
              diagOpen && "rotate-180"
            )}
            aria-hidden="true"
          />
        </button>
        <AnimatePresence initial={false}>
          {diagOpen && (
            <motion.div
              id="diag-list"
              initial={{ height: 0, opacity: 0 }}
              animate={{ height: "auto", opacity: 1 }}
              exit={{ height: 0, opacity: 0 }}
              transition={{ duration: 0.28, ease: [0.22, 1, 0.36, 1] }}
              className="overflow-hidden"
            >
              {diag === null ? (
                <div className="pt-3 space-y-1.5">
                  {[0, 1, 2, 3, 4].map((i) => (
                    <div key={i} className="h-5 rounded-md bg-white/[0.05] animate-pulse" />
                  ))}
                </div>
              ) : (
                <div className="pt-3 space-y-1 max-h-44 overflow-y-auto sys-scroll">
                  {diag.map((r) => (
                    <div key={r.table} className="flex items-center justify-between text-[11px]">
                      <span className="text-muted-foreground">{TABLE_AR[r.table] ?? r.table}</span>
                      <span className="num font-bold text-foreground/90">{formatNumber(r.count)}</span>
                    </div>
                  ))}
                </div>
              )}
            </motion.div>
          )}
        </AnimatePresence>
      </div>
    </Section>
  );
}

// ═══════════════════════ 7) حول ═══════════════════════

function AboutSection() {
  return (
    <Section
      id="about"
      icon={<Sparkles className="w-5 h-5" aria-hidden="true" />}
      title="حول Systemy"
      subtitle="الإصدار والخصوصية"
    >
      <div className="space-y-3 text-[11.5px] leading-relaxed text-muted-foreground">
        <p className="flex items-center gap-2.5 text-foreground/90">
          <Image
            src="/brand/logo-128.png"
            alt="شعار Systemy — روبوت Sys"
            width={36}
            height={36}
            className="rounded-xl border border-white/10 shrink-0"
          />
          Systemy v{APP_VERSION} — نظام تشغيلك الشخصي
        </p>
        <p>يعمل محلياً على جهازك — لا خادم ولا حساب ولا تتبع ولا تسجيل دخول.</p>
        <p className="flex items-start gap-1.5">
          <ShieldCheck className="w-3.5 h-3.5 mt-0.5 shrink-0 text-mint" aria-hidden="true" />
          بياناتك لا تغادر جهازك أبداً — كل شيء في قاعدة محلية داخل متصفحك.
        </p>
        <p className="text-[10.5px] text-muted-foreground/70">
          صُنع بـ Next.js وTypeScript وTailwind وFramer Motion — وكل الحسابات تجري على جهازك لحظياً.
        </p>
      </div>
    </Section>
  );
}
