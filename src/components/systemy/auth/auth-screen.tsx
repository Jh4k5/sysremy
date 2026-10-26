"use client";

/**
 * شاشة المصادقة السحابية (Supabase) — دخول / حساب جديد / استعادة / كلمة مرور جديدة.
 * لغة تصميم 5.1 «النهار»: أسطح بيضاء، ذهبي عنبري للفعل الأساسي، أخطاء صادقة بالعربية.
 * بصدق: بيانات التطبيق محلية على الجهاز — هذا الحساب للملف الشخصي واستعادة الوصول.
 */
import { useEffect, useMemo, useState } from "react";
import { AnimatePresence, motion } from "framer-motion";
import {
  AlertTriangle, ArrowLeft, CheckCircle2, Eye, EyeOff, Loader2, LockKeyhole, Mail,
  ShieldCheck, Sparkles, UserRound, X,
} from "lucide-react";
import { toast } from "sonner";
import {
  isSupabaseConfigured, supabase, authErrorToArabic,
  SUPABASE_URL, supabasePublishableKey,
} from "@/lib/supabase";
import { isStandalone } from "@/lib/standalone";
import { useUIStore } from "@/store/ui-store";
import type { AuthMode } from "./auth-store";
import { GlassCard } from "@/components/systemy/glass";
import { inputCls } from "@/components/systemy/ui-bits";
import { Logo } from "@/components/systemy/logo";
import { cn } from "@/lib/utils";

/** زر الفعل الأساسي — تدرج النهار العنبري نفسه المستخدم في الإعداد الأولي */
const ctaCls =
  "press w-full h-14 rounded-2xl text-[15px] font-bold flex items-center justify-center gap-2 glow-gold disabled:opacity-50";
const ctaStyle = { background: "linear-gradient(180deg, #F2B347, #D99026)", color: "#2a1a03" } as const;

/** زر ثانوي زجاجي */
const ghostCls =
  "press w-full h-13 min-h-[52px] rounded-2xl glass border border-black/[0.08] text-[14px] font-semibold flex items-center justify-center gap-2 text-foreground disabled:opacity-50";

/** شعار Google الرسمي (حرف G رباعي الألوان) — مقياس صغير داخل زر الدخول */
function GoogleG({ className }: { className?: string }) {
  return (
    <svg viewBox="0 0 24 24" className={className} aria-hidden="true">
      <path fill="#4285F4" d="M23.49 12.27c0-.79-.07-1.54-.19-2.27H12v4.51h6.47a5.57 5.57 0 0 1-2.4 3.58v3h3.86c2.26-2.09 3.56-5.17 3.56-8.82z" />
      <path fill="#34A853" d="M12 24c3.24 0 5.95-1.08 7.93-2.91l-3.86-3c-1.08.72-2.45 1.16-4.07 1.16-3.13 0-5.78-2.11-6.73-4.96H1.29v3.09A11.99 11.99 0 0 0 12 24z" />
      <path fill="#FBBC05" d="M5.27 14.29A7.2 7.2 0 0 1 4.89 12c0-.8.14-1.57.38-2.29V6.62H1.29a12 12 0 0 0 0 10.76l3.98-3.09z" />
      <path fill="#EA4335" d="M12 4.75c1.77 0 3.35.61 4.6 1.8l3.42-3.42C17.95 1.19 15.24 0 12 0 7.31 0 3.26 2.69 1.29 6.62l3.98 3.09C6.22 6.86 8.87 4.75 12 4.75z" />
    </svg>
  );
}

type Screen = AuthMode | "sent-confirm" | "sent-reset";

const TITLES: Record<Screen, string> = {
  login: "الدخول إلى حسابك",
  signup: "حساب جديد",
  forgot: "استعادة كلمة المرور",
  reset: "كلمة مرور جديدة",
  "sent-confirm": "أكّد بريدك",
  "sent-reset": "افتح بريدك",
};

/** ═══════════════ الشاشة العلوية (تُعرض من SystemyApp لاستعادة كلمة المرور) ═══════════════ */
export function AuthScreen() {
  const authOpen = useUIStore((s) => s.authOpen);
  const startMode = useUIStore((s) => s.authStart);
  const closeAuth = useUIStore((s) => s.closeAuth);

  // بريد «تذكّره» يبقى بين الفتحات — يعيد تعبئة حقل الدخول
  const [rememberedEmail, setRememberedEmail] = useState("");

  if (!authOpen || !isSupabaseConfigured) return null;

  return (
    <AnimatePresence>
      <AuthPanel
        key="auth-panel"
        startMode={startMode ?? "login"}
        rememberedEmail={rememberedEmail}
        onRemember={setRememberedEmail}
        onClose={closeAuth}
      />
    </AnimatePresence>
  );
}

/** ═══════════════ بوابة الدخول الإلزامية — التطبيق لا يُفتح قبل حساب ═══════════════ */
export function AuthGateScreen() {
  const [rememberedEmail, setRememberedEmail] = useState("");
  return (
    <div className="relative h-full flex flex-col bg-[#F8F7F2]">
      {/* هوية التطبيق — أول ما يراه الزائر قبل حسابه */}
      <div className="shrink-0 flex items-center gap-3.5 px-5 pt-6 pb-3 max-w-[400px] w-full mx-auto">
        <Logo className="w-12 h-12 rounded-2xl shrink-0" />
        <div className="min-w-0">
          <p className="text-[19px] font-extrabold text-foreground leading-tight">Systemy</p>
          <p className="text-[11.5px] text-muted-foreground mt-0.5">ابنِ حياتك كنظام — سجّل دخولك للمتابعة</p>
        </div>
      </div>
      <AuthPanel
        startMode="login"
        rememberedEmail={rememberedEmail}
        onRemember={setRememberedEmail}
        onClose={() => undefined}
        gate
      />
    </div>
  );
}

/** اللوحة نفسها — تركيب جديد عند كل فتح (حالة نظيفة بلا setState داخل تأثير) */
function AuthPanel({
  startMode, rememberedEmail, onRemember, onClose, gate = false,
}: {
  startMode: AuthMode;
  rememberedEmail: string;
  onRemember: (v: string) => void;
  onClose: () => void;
  /** وضع البوابة: لا إغلاق ولا Esc — التطبيق خلفها محجوب حتى الدخول */
  gate?: boolean;
}) {
  const [screen, setScreen] = useState<Screen>(startMode);

  // غلق Esc — لوحة مفاتيح حقيقية (البوابة لا تُغلق)
  useEffect(() => {
    if (gate) return;
    const h = (e: KeyboardEvent) => e.key === "Escape" && onClose();
    window.addEventListener("keydown", h);
    return () => window.removeEventListener("keydown", h);
  }, [gate, onClose]);

  return (
    <motion.div
      initial={{ opacity: 0, y: 14 }}
      animate={{ opacity: 1, y: 0 }}
      exit={{ opacity: 0, y: 10 }}
      transition={{ duration: 0.28, ease: [0.22, 1, 0.36, 1] }}
      className={cn("absolute inset-0 z-[70] bg-[#F8F7F2] flex flex-col", gate && "static")}
      role="dialog"
      aria-modal="true"
      aria-label={TITLES[screen]}
    >
      {/* شريط علوي — عنوان وزر إغلاق 44px (البوابة بلا إغلاق) */}
      <div className="shrink-0 flex items-center justify-between gap-3 px-4 pt-3 pb-2 max-w-[400px] w-full mx-auto">
        <div className="flex items-center gap-2 min-w-0">
          <span className="w-9 h-9 rounded-xl bg-primary/12 text-primary flex items-center justify-center shrink-0" aria-hidden="true">
            <LockKeyhole className="w-[18px] h-[18px]" />
          </span>
          <h2 className="text-[17px] font-bold text-foreground truncate">{TITLES[screen]}</h2>
        </div>
        {!gate && (
          <button
            type="button"
            onClick={onClose}
            aria-label="إغلاق شاشة الحساب"
            className="press w-11 h-11 rounded-xl glass flex items-center justify-center text-muted-foreground hover:text-foreground"
          >
            <X className="w-5 h-5" aria-hidden="true" />
          </button>
        )}
      </div>

      {/* المحتوى */}
      <div className="flex-1 overflow-y-auto sys-scroll px-5 pt-2 pb-8">
        <div className="max-w-[400px] mx-auto">
          <AnimatePresence mode="wait">
            <motion.div
              key={screen}
              initial={{ opacity: 0, x: 18 }}
              animate={{ opacity: 1, x: 0 }}
              exit={{ opacity: 0, x: -14, transition: { duration: 0.14 } }}
              transition={{ duration: 0.3, ease: [0.22, 1, 0.36, 1] }}
            >
              {screen === "login" && (
                <LoginScreen
                  rememberedEmail={rememberedEmail}
                  onRemember={onRemember}
                  go={setScreen}
                />
              )}
              {screen === "signup" && <SignupScreen go={setScreen} />}
              {screen === "forgot" && <ForgotScreen go={setScreen} />}
              {screen === "reset" && <ResetScreen />}
              {screen === "sent-confirm" && (
                <SentScreen
                  icon={<Mail className="w-7 h-7" aria-hidden="true" />}
                  title="أرسلنا رابط التأكيد ✉️"
                  body={<>افتح الرابط من بريدك، وبعدها سجّل دخولك من هنا.<br />لو ما وصلك شيء خلال دقايق — شغّل فحص مجلد الرسائل المزعجة.</>}
                  cta="رجوع للدخول"
                  onCta={() => setScreen("login")}
                />
              )}
              {screen === "sent-reset" && (
                <SentScreen
                  icon={<ShieldCheck className="w-7 h-7" aria-hidden="true" />}
                  title="لو كان بريدك مسجّلاً — وصله رابط الاستعادة"
                  body={<>افتح الرابط من بريدك وبتنفتح لك شاشة كلمة مرور جديدة هنا.<br />للأمان ما نُخبرك إن كان البريد مسجّلاً أو لا — نفس الرد لكل الحالات.</>}
                  cta="رجوع للدخول"
                  onCta={() => setScreen("login")}
                />
              )}
            </motion.div>
          </AnimatePresence>

          {/* الصدق الدائم — سطر واحد أسفل الشاشة */}
          <p className="text-center text-[10.5px] leading-relaxed text-muted-foreground/80 mt-5 px-2">
            بياناتك محفوظة على جهازك وتُزامَن بحسابك السحابي — التطبيق يعمل بلا اتصال،
            ويلحق كل شيء عند عودة الإنترنت. ملفك مستقل عن أي مستخدم آخر.
          </p>
        </div>
      </div>
    </motion.div>
  );
}

/** ═══════════════ الحقول المشتركة ═══════════════ */

function FieldLabel({ children, htmlFor }: { children: React.ReactNode; htmlFor: string }) {
  return (
    <label htmlFor={htmlFor} className="block text-[12.5px] font-semibold text-foreground/85 mb-1.5">
      {children}
    </label>
  );
}

/** حقل بريد — LTR داخل صفحة RTL */
function EmailField({
  id, value, onChange, autoComplete = "email", disabled,
}: {
  id: string;
  value: string;
  onChange: (v: string) => void;
  autoComplete?: string;
  disabled?: boolean;
}) {
  return (
    <input
      id={id}
      type="email"
      inputMode="email"
      dir="ltr"
      className={cn(inputCls, "text-left disabled:opacity-60")}
      style={{ textAlign: "left" }}
      value={value}
      onChange={(e) => onChange(e.target.value)}
      placeholder="you@example.com"
      autoComplete={autoComplete}
      spellCheck={false}
      autoCapitalize="none"
      disabled={disabled}
      aria-label="البريد الإلكتروني"
      required
    />
  );
}

/** حقل كلمة مرور — LTR + زر إظهار/إخفاء */
function PasswordField({
  id, value, onChange, placeholder = "••••••••", autoComplete = "current-password",
}: {
  id: string;
  value: string;
  onChange: (v: string) => void;
  placeholder?: string;
  autoComplete?: string;
}) {
  const [show, setShow] = useState(false);
  return (
    <div className="relative">
      <input
        id={id}
        type={show ? "text" : "password"}
        dir="ltr"
        className={cn(inputCls, "text-left pr-4 pl-12")}
        style={{ textAlign: "left" }}
        value={value}
        onChange={(e) => onChange(e.target.value)}
        placeholder={placeholder}
        autoComplete={autoComplete}
        minLength={6}
        aria-label="كلمة المرور"
        required
      />
      <button
        type="button"
        onClick={() => setShow((s) => !s)}
        aria-label={show ? "إخفاء كلمة المرور" : "إظهار كلمة المرور"}
        className="absolute left-2 top-1/2 -translate-y-1/2 w-9 h-9 rounded-lg flex items-center justify-center text-muted-foreground hover:text-foreground"
      >
        {show ? <EyeOff className="w-[18px] h-[18px]" aria-hidden="true" /> : <Eye className="w-[18px] h-[18px]" aria-hidden="true" />}
      </button>
    </div>
  );
}

/** صندوق رسالة (خطأ/تحذير) — ألوان النهار الدلالية */
function Notice({
  kind, children,
}: {
  kind: "error" | "info" | "success";
  children: React.ReactNode;
}) {
  const styles = {
    error: "bg-[#D95E65]/[0.08] border-[#D95E65]/25 text-[#8f2f36]",
    info: "bg-[#16B8B0]/[0.08] border-[#16B8B0]/30 text-[#0E7C84]",
    success: "bg-[#198768]/[0.09] border-[#198768]/30 text-[#0f5c47]",
  }[kind];
  const Icon = kind === "error" ? AlertTriangle : kind === "info" ? ShieldCheck : CheckCircle2;
  return (
    <div
      role={kind === "error" ? "alert" : "status"}
      className={cn("rounded-xl border px-3.5 py-2.5 flex items-start gap-2.5 text-[12px] leading-relaxed font-medium", styles)}
    >
      <Icon className="w-4 h-4 mt-0.5 shrink-0" aria-hidden="true" />
      <span className="min-w-0 break-words">{children}</span>
    </div>
  );
}

/** فاصل «أو» */
function Divider() {
  return (
    <div className="flex items-center gap-3 py-1" aria-hidden="true">
      <span className="flex-1 h-px bg-black/[0.07]" />
      <span className="text-[10.5px] font-medium text-muted-foreground">أو</span>
      <span className="flex-1 h-px bg-black/[0.07]" />
    </div>
  );
}

/** ═══════════════ 1) الدخول ═══════════════ */

function LoginScreen({
  rememberedEmail, onRemember, go,
}: {
  rememberedEmail: string;
  onRemember: (v: string) => void;
  go: (s: Screen) => void;
}) {
  const [email, setEmail] = useState(rememberedEmail);
  const [password, setPassword] = useState("");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  // فحص Google — خادمي أولاً؛ وإن غاب الخادم (تصدير ثابت/APK) ففحص
  // مباشر من Supabase (نفس endpoint العام الذي يقرأه supabase-js)
  const [google, setGoogle] = useState<{ ready: boolean; detail: string } | null>(null);
  useEffect(() => {
    let alive = true;
    fetch("/api/auth/google-status")
      .then((r) => r.json())
      .then((d: { ready?: boolean; detail?: string }) => {
        if (alive) setGoogle({ ready: Boolean(d.ready), detail: d.detail ?? "" });
      })
      .catch(() => {
        // لا خادم — نسخة الـ APK: اسأل Supabase مباشرة عن حالة مزوّد Google
        if (!SUPABASE_URL || !supabasePublishableKey) {
          if (alive) setGoogle({ ready: false, detail: "" });
          return;
        }
        fetch(`${SUPABASE_URL}/auth/v1/settings`, {
          headers: { apikey: supabasePublishableKey },
        })
          .then((r) => r.json())
          .then((d: { external?: { google?: boolean } }) => {
            if (alive) setGoogle({ ready: Boolean(d?.external?.google), detail: "" });
          })
          .catch(() => alive && setGoogle({ ready: false, detail: "" }));
      });
    return () => { alive = false; };
  }, []);

  const submit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!supabase || busy) return;
    setBusy(true);
    setError(null);
    try {
      const { error: err } = await supabase.auth.signInWithPassword({
        email: email.trim(),
        password,
      });
      if (err) {
        setError(authErrorToArabic(err));
        return;
      }
      onRemember(email.trim());
      useUIStore.getState().closeAuth();
      toast("أهلاً بعودتك 👋", { description: "سجّلنا دخولك بحسابك السحابي" });
    } catch (err) {
      setError(authErrorToArabic(err));
    } finally {
      setBusy(false);
    }
  };

  const googleSignIn = async () => {
    if (!supabase) return;
    // الفحص الخادمي قال غير جاهز؟ نبقى داخل التطبيق — لا مغادرة إلى صفحة خطأ خام
    if (google && !google.ready) {
      toast.error("تسجيل Google غير مهيّأ بعد", {
        description: google.detail || "يحتاج إعداداً من لوحة Supabase",
      });
      return;
    }
    // داخل التطبيق المثبّت (APK — بلا خادم): رحلة OAuth تفتح المتصفح الخارجي
    // وجلستها لا تعود إلى التطبيق — إرشاد صادق بدل مغادرة تتركه في طريق مسدود
    if (isStandalone()) {
      toast("داخل التطبيق المثبّت سجّل بالبريد وكلمة المرور", {
        description: "دخول Google متاح من نسخة الويب — جلسة المتصفح الخارجي لا تعود إلى التطبيق",
      });
      return;
    }
    const { data, error: err } = await supabase.auth.signInWithOAuth({
      provider: "google",
      options: { redirectTo: window.location.origin, skipBrowserRedirect: true },
    });
    if (err || !data.url) {
      toast.error("تعذر بدء تسجيل Google", { description: authErrorToArabic(err) });
      return;
    }
    // داخل إطار (لوحة المعاينة)؟ جوجل يرفض العرض داخل الإطارات — تبويب جديد
    const framed: boolean = window.self !== window.top;
    if (framed) {
      const win = window.open(data.url, "_blank", "noopener,noreferrer");
      if (!win) {
        toast.error("افتح التطبيق في تبويب مستقل", {
          description:
            "دخول Google لا يكتمل داخل إطار المعاينة — اضغط «افتح في تبويب جديد» فوق لوحة المعاينة ثم أكمل الدخول من هناك",
          duration: 10000,
        });
      }
      return;
    }
    window.location.href = data.url;
  };

  return (
    <GlassCard className="p-5 space-y-4">
      <form onSubmit={submit} className="space-y-4" noValidate>
        <div>
          <FieldLabel htmlFor="auth-email">البريد الإلكتروني</FieldLabel>
          <EmailField id="auth-email" value={email} onChange={setEmail} disabled={busy} />
        </div>
        <div>
          <div className="flex items-center justify-between mb-1.5">
            <FieldLabel htmlFor="auth-pass">كلمة المرور</FieldLabel>
            <button
              type="button"
              onClick={() => go("forgot")}
              className="text-[11.5px] font-semibold text-[#B45309] hover:underline underline-offset-4"
            >
              نسيتها؟
            </button>
          </div>
          <PasswordField id="auth-pass" value={password} onChange={setPassword} />
        </div>

        {error && <Notice kind="error">{error}</Notice>}

        <button type="submit" disabled={busy || !email.trim() || !password} className={ctaCls} style={ctaStyle}>
          {busy ? <Loader2 className="w-5 h-5 animate-spin" aria-hidden="true" /> : null}
          {busy ? "جارٍ الدخول…" : "سجّل دخولي"}
          {!busy && <ArrowLeft className="w-[18px] h-[18px]" aria-hidden="true" />}
        </button>
      </form>

      <Divider />

      {/* Google — مع الحالة الصادقة من الفحص الخادمي */}
      <button type="button" onClick={() => void googleSignIn()} disabled={!google} className={ghostCls}>
        <GoogleG className="w-5 h-5 shrink-0" />
        أكمل بحساب Google
      </button>
      {google && !google.ready && (
        <Notice kind="info">
          تسجيل Google <b>غير مهيّأ بعد</b> — {google.detail || "يحتاج إعداداً من لوحة Supabase"}.
          الدخول بالبريد وكلمة المرور يعمل الآن.
        </Notice>
      )}
      {google && google.ready && isStandalone() && (
        <Notice kind="info">
          داخل التطبيق المثبّت سجّل بـ<b>البريد وكلمة المرور</b> — دخول Google متاح من نسخة الويب
          (جلسة المتصفح الخارجي لا تعود إلى التطبيق).
        </Notice>
      )}

      <div className="text-center pt-1">
        <button
          type="button"
          onClick={() => go("signup")}
          className="text-[12.5px] font-semibold text-muted-foreground hover:text-foreground transition-colors"
        >
          ما عندك حساب؟ <span className="text-[#B45309] font-bold">أنشئ واحداً في دقيقة</span>
        </button>
      </div>
    </GlassCard>
  );
}

/** ═══════════════ 2) حساب جديد ═══════════════ */

function SignupScreen({ go }: { go: (s: Screen) => void }) {
  const [name, setName] = useState("");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const pwHint = useMemo(() => (password.length > 0 && password.length < 6 ? "6 أحرف على الأقل" : null), [password]);

  const submit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!supabase || busy) return;
    if (password.length < 6) {
      setError("كلمة المرور ضعيفة — لازم 6 أحرف على الأقل");
      return;
    }
    setBusy(true);
    setError(null);
    try {
      const { data, error: err } = await supabase.auth.signUp({
        email: email.trim(),
        password,
        options: { data: { full_name: name.trim() || undefined } },
      });
      if (err) {
        setError(authErrorToArabic(err));
        return;
      }
      // مشروعك يطلب تأكيد البريد (mailer_autoconfirm=false) — لا جلسة قبل فتح الرابط
      if (data.session) {
        // SIGNED_IN من مستمع الحالة يتكفل بالجلسة والملف الشخصي
        useUIStore.getState().closeAuth();
        toast("أهلاً بحسابك الجديد 🎉", { description: "سجّلنا دخولك مباشرة" });
      } else {
        go("sent-confirm");
      }
    } catch (err) {
      setError(authErrorToArabic(err));
    } finally {
      setBusy(false);
    }
  };

  return (
    <GlassCard className="p-5 space-y-4">
      <form onSubmit={submit} className="space-y-4" noValidate>
        <div>
          <div className="flex items-center justify-between mb-1.5">
            <FieldLabel htmlFor="auth-name">شنو نناديك؟ (اختياري)</FieldLabel>
            <span className="text-[10.5px] text-muted-foreground">لملفك الشخصي</span>
          </div>
          <input
            id="auth-name"
            type="text"
            className={inputCls}
            value={name}
            onChange={(e) => setName(e.target.value)}
            placeholder="مثال: محمد"
            maxLength={40}
            autoComplete="name"
            aria-label="الاسم المعروض (اختياري)"
          />
        </div>
        <div>
          <FieldLabel htmlFor="auth-su-email">البريد الإلكتروني</FieldLabel>
          <EmailField id="auth-su-email" value={email} onChange={setEmail} disabled={busy} />
        </div>
        <div>
          <FieldLabel htmlFor="auth-su-pass">كلمة المرور</FieldLabel>
          <PasswordField id="auth-su-pass" value={password} onChange={setPassword} autoComplete="new-password" />
          {pwHint && <p className="text-[10.5px] text-[#C88725] mt-1.5 font-medium">{pwHint}</p>}
        </div>

        {error && <Notice kind="error">{error}</Notice>}

        <button type="submit" disabled={busy || !email.trim() || !password} className={ctaCls} style={ctaStyle}>
          {busy ? <Loader2 className="w-5 h-5 animate-spin" aria-hidden="true" /> : <Sparkles className="w-[18px] h-[18px]" aria-hidden="true" />}
          {busy ? "جارٍ إنشاء حسابك…" : "أنشئ حسابي"}
        </button>
      </form>

      <div className="text-center pt-1">
        <button
          type="button"
          onClick={() => go("login")}
          className="text-[12.5px] font-semibold text-muted-foreground hover:text-foreground transition-colors"
        >
          عندك حساب؟ <span className="text-[#B45309] font-bold">سجّل دخولك</span>
        </button>
      </div>
    </GlassCard>
  );
}

/** ═══════════════ 3) استعادة كلمة المرور ═══════════════ */

function ForgotScreen({ go }: { go: (s: Screen) => void }) {
  const [email, setEmail] = useState("");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const submit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!supabase || busy) return;
    setBusy(true);
    setError(null);
    try {
      const { error: err } = await supabase.auth.resetPasswordForEmail(email.trim(), {
        redirectTo: window.location.origin,
      });
      if (err) {
        setError(authErrorToArabic(err));
        return;
      }
      go("sent-reset");
    } catch (err) {
      setError(authErrorToArabic(err));
    } finally {
      setBusy(false);
    }
  };

  return (
    <GlassCard className="p-5 space-y-4">
      <p className="text-[12.5px] leading-relaxed text-muted-foreground">
        اكتب بريدك ونبعث له رابط تعيين كلمة مرور جديدة — الرابط يفتدى مرة وحدة وصالح لفترة قصيرة.
      </p>
      <form onSubmit={submit} className="space-y-4" noValidate>
        <div>
          <FieldLabel htmlFor="auth-fg-email">البريد الإلكتروني</FieldLabel>
          <EmailField id="auth-fg-email" value={email} onChange={setEmail} disabled={busy} />
        </div>

        {error && <Notice kind="error">{error}</Notice>}

        <button type="submit" disabled={busy || !email.trim()} className={ctaCls} style={ctaStyle}>
          {busy ? <Loader2 className="w-5 h-5 animate-spin" aria-hidden="true" /> : <Mail className="w-[18px] h-[18px]" aria-hidden="true" />}
          {busy ? "جارٍ الإرسال…" : "ابعث رابط الاستعادة"}
        </button>
      </form>

      <div className="text-center">
        <button
          type="button"
          onClick={() => go("login")}
          className="text-[12.5px] font-semibold text-muted-foreground hover:text-foreground transition-colors"
        >
          رجوع للدخول
        </button>
      </div>
    </GlassCard>
  );
}

/** ═══════════════ 4) كلمة مرور جديدة (بعد رابط الاستعادة) ═══════════════ */

function ResetScreen() {
  const [password, setPassword] = useState("");
  const [confirm, setConfirm] = useState("");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [done, setDone] = useState(false);

  const submit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!supabase || busy) return;
    if (password.length < 6) {
      setError("كلمة المرور ضعيفة — لازم 6 أحرف على الأقل");
      return;
    }
    if (password !== confirm) {
      setError("الكلمتان مو متطابقتين — تأكد من الكتابة");
      return;
    }
    setBusy(true);
    setError(null);
    try {
      const { error: err } = await supabase.auth.updateUser({ password });
      if (err) {
        setError(authErrorToArabic(err));
        return;
      }
      setDone(true);
      toast("كلمة المرور انحدثت ✓", { description: "استخدمها في دخولك القادم" });
    } catch (err) {
      setError(authErrorToArabic(err));
    } finally {
      setBusy(false);
    }
  };

  if (done) {
    return (
      <GlassCard className="p-5 space-y-4">
        <div className="flex flex-col items-center text-center gap-3 py-3">
          <span className="w-14 h-14 rounded-2xl bg-[#198768]/10 text-[#198768] flex items-center justify-center">
            <CheckCircle2 className="w-7 h-7" aria-hidden="true" />
          </span>
          <div>
            <p className="text-[16px] font-bold">كلمة مرورك الجديدة محفوظة ✓</p>
            <p className="text-[12px] text-muted-foreground mt-1.5 leading-relaxed">
              أنت داخل حسابك الآن — الباقي في التطبيق كما هو.
            </p>
          </div>
        </div>
        <button type="button" onClick={() => useUIStore.getState().closeAuth()} className={ctaCls} style={ctaStyle}>
          رجوع لتطبيقي
        </button>
      </GlassCard>
    );
  }

  return (
    <GlassCard className="p-5 space-y-4">
      <Notice kind="info">
        فتحت الرابط من بريدك — عيّن كلمة مرورك الجديدة هنا، وجلستك مفتوحة تلقائياً.
      </Notice>
      <form onSubmit={submit} className="space-y-4" noValidate>
        <div>
          <FieldLabel htmlFor="auth-rs-pass">كلمة المرور الجديدة</FieldLabel>
          <PasswordField id="auth-rs-pass" value={password} onChange={setPassword} autoComplete="new-password" />
        </div>
        <div>
          <FieldLabel htmlFor="auth-rs-confirm">أعدها للتأكيد</FieldLabel>
          <PasswordField id="auth-rs-confirm" value={confirm} onChange={setConfirm} autoComplete="new-password" />
        </div>

        {error && <Notice kind="error">{error}</Notice>}

        <button type="submit" disabled={busy || !password || !confirm} className={ctaCls} style={ctaStyle}>
          {busy ? <Loader2 className="w-5 h-5 animate-spin" aria-hidden="true" /> : <ShieldCheck className="w-[18px] h-[18px]" aria-hidden="true" />}
          {busy ? "جارٍ الحفظ…" : "احفظ كلمة المرور الجديدة"}
        </button>
      </form>
    </GlassCard>
  );
}

/** ═══════════════ 5) رسائل «أرسلنا لك» ═══════════════ */

function SentScreen({
  icon, title, body, cta, onCta,
}: {
  icon: React.ReactNode;
  title: string;
  body: React.ReactNode;
  cta: string;
  onCta: () => void;
}) {
  return (
    <GlassCard className="p-5 space-y-4">
      <div className="flex flex-col items-center text-center gap-3 py-4">
        <span className="w-16 h-16 rounded-[1.3rem] bg-primary/12 text-primary flex items-center justify-center">
          {icon}
        </span>
        <p className="text-[16px] font-bold leading-snug">{title}</p>
        <p className="text-[12.5px] text-muted-foreground leading-relaxed max-w-[300px]">{body}</p>
      </div>
      <button type="button" onClick={onCta} className={ctaCls} style={ctaStyle}>
        {cta}
        <ArrowLeft className="w-[18px] h-[18px]" aria-hidden="true" />
      </button>
    </GlassCard>
  );
}

/** أيقونة الحساب للاستخدام الخارجي (بطاقة الإعدادات) */
export function AccountIcon({ className }: { className?: string }) {
  return <UserRound className={className} aria-hidden="true" />;
}
