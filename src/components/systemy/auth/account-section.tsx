"use client";

/**
 * قسم «الحساب السحابي» في شاشة أنا — 5.2: الدخول إلزامي عبر البوابة،
 * لذا هنا حالة الحساب داخل الجلسة: الملف الشخصي + حالة المزامنة الحقيقية
 * (متزامن/أوفلاين/تحتاج هجرة) + خروج. كل سطر مقابل حقيقة على الأرض.
 */
import { LogOut, ShieldCheck, CloudCog, RefreshCw } from "lucide-react";
import { toast } from "sonner";
import { isSupabaseConfigured } from "@/lib/supabase";
import { useUIStore } from "@/store/ui-store";
import { useSyncStore } from "@/lib/sync/sync-store";
import { syncNow } from "@/lib/sync/sync-engine";
import { useAuthStore } from "./auth-store";
import { GlassCard, widgetEnter } from "@/components/systemy/glass";

const btnGhost =
  "press h-11 min-h-[44px] px-4 rounded-xl glass border border-black/[0.08] text-[12.5px] font-semibold flex items-center justify-center gap-1.5 text-foreground";

/** أول حرف من الاسم — فقرة الأفاتار */
function Initial({ name, email }: { name: string | null; email?: string }) {
  const src = (name ?? email ?? "؟").trim();
  const ch = src.charAt(0).toUpperCase();
  return (
    <span
      className="w-12 h-12 rounded-2xl flex items-center justify-center text-[18px] font-black text-[#2a1a03] shrink-0"
      style={{ background: "linear-gradient(180deg, #F2B347, #D99026)" }}
      aria-hidden="true"
    >
      {ch}
    </span>
  );
}

export function AccountSection() {
  // غير مهيأ بيئياً؟ القسم كله يختفي (البوابة تعرض الخطأ البيئي بنفسها)
  if (!isSupabaseConfigured) return null;
  return <AccountSectionInner />;
}

function AccountSectionInner() {
  const { ready, session, user, profile, profileStatus, signOut } = useAuthStore();
  const { phase, pending, lastSyncAt, lastError } = useSyncStore();
  const openAuth = useUIStore((s) => s.openAuth);

  const handleSignOut = async () => {
    await signOut();
    toast("سجّلنا خروجك", { description: "ملفك محفوظ — ستجده كما هو عند عودتك" });
  };

  const handleSyncNow = () => {
    syncNow();
    toast("بدأت دورة مزامنة", { description: "نرفع المحلي وننزل البعيد الآن" });
  };

  if (!user || !session) {
    // ⏳ قبل جهوزية الجلسة: هياكل صامتة (منع وميض خاطئ)
    if (!ready) {
      return (
        <GlassCard className="p-4 flex items-center gap-3.5 animate-pulse" aria-busy="true" aria-label="جارٍ فحص الحساب">
          <span className="w-12 h-12 rounded-2xl glass-soft shrink-0" />
          <span className="flex-1 space-y-2">
            <span className="block h-3.5 w-2/3 rounded bg-black/[0.06]" />
            <span className="block h-2.5 w-1/2 rounded bg-black/[0.05]" />
          </span>
        </GlassCard>
      );
    }
    return (
      <GlassCard {...widgetEnter()} className="p-4 space-y-3">
        <div className="flex items-center gap-3.5">
          <span className="w-12 h-12 rounded-2xl bg-primary/12 text-primary flex items-center justify-center shrink-0">
            <CloudCog className="w-6 h-6" aria-hidden="true" />
          </span>
          <div className="flex-1 min-w-0">
            <p className="text-[13.5px] font-bold text-foreground">الحساب السحابي</p>
            <p className="text-[11px] text-muted-foreground mt-0.5 leading-relaxed">
              سجّل دخولك للوصول إلى ملفك من أي جهاز
            </p>
          </div>
        </div>
        <div className="flex gap-2">
          <button type="button" onClick={() => openAuth("login")} className={`${btnGhost} flex-1`}>
            تسجيل الدخول
          </button>
          <button type="button" onClick={() => openAuth("signup")} className={`${btnGhost} flex-1`}>
            حساب جديد
          </button>
        </div>
      </GlassCard>
    );
  }

  // ─── داخل الحساب ───
  const displayName = profile?.display_name?.trim()
    || (user.user_metadata?.full_name as string | undefined)?.trim()
    || user.email?.split("@")[0]
    || "حسابك";
  const email = user.email ?? "";

  const syncLine =
    phase === "synced"
      ? { text: `كل شيء متزامن${lastSyncAt ? ` — آخر دورة ${new Date(lastSyncAt).toLocaleTimeString("ar")}` : ""}`, tone: "ok" as const }
      : phase === "syncing"
        ? { text: "دورة مزامنة جارٍة الآن…", tone: "ok" as const }
        : phase === "offline"
          ? { text: `تعمل محلياً بلا اتصال${pending > 0 ? ` — ${pending} تغييراً بانتظار الرفع` : ""}، وتلحق تلقائياً عند عودة الإنترنت`, tone: "info" as const }
          : phase === "setup-needed"
            ? { text: "المزامنة معطّلة: جدول records لم يُنشأ بعد — شغّل هجرة SQL من docs/ui-redesign/sync-migration.sql في لوحة Supabase وتنقلب «متزامن» تلقائياً", tone: "warn" as const }
            : phase === "error"
              ? { text: `تعذرت المزامنة: ${lastError ?? "خطأ غير معروف"} — سنحاول مجدداً`, tone: "warn" as const }
              : { text: "المزامنة لم تبدأ بعد…", tone: "info" as const };

  const syncCls = {
    ok: "bg-[#198768]/[0.09] border-[#198768]/30 text-[#0f5c47]",
    info: "bg-[#16B8B0]/[0.08] border-[#16B8B0]/30 text-[#0E7C84]",
    warn: "bg-[#C88725]/[0.08] border-[#C88725]/25 text-[#8a5f13]",
  }[syncLine.tone];

  return (
    <GlassCard {...widgetEnter()} className="p-4 space-y-3.5">
      <div className="flex items-center gap-3.5">
        <Initial name={displayName} email={email} />
        <div className="flex-1 min-w-0">
          <p className="text-[14.5px] font-bold truncate">{displayName}</p>
          <p dir="ltr" className="text-[11px] text-muted-foreground mt-0.5 truncate text-left">
            {email}
          </p>
        </div>
        <span className="inline-flex items-center gap-1 rounded-full bg-[#198768]/10 text-[#0f5c47] px-2.5 py-1 text-[10px] font-bold shrink-0">
          <ShieldCheck className="w-3 h-3" aria-hidden="true" />
          داخل
        </span>
      </div>

      {/* حالة الملف الشخصي — صادقة بكل الفروع */}
      {profileStatus === "ok" && (
        <p className="text-[10.5px] text-muted-foreground leading-relaxed">
          ملفك الشخصي السحابي محفوظ — اسمك يظهر في أي جهاز تدخل منه.
        </p>
      )}
      {profileStatus === "missing-table" && (
        <p className="text-[10.5px] leading-relaxed rounded-xl bg-[#C88725]/[0.08] border border-[#C88725]/25 text-[#8a5f13] px-3 py-2">
          جدول <span dir="ltr">profiles</span> لم يُنشأ بعد — هجرته ضمن
          <span dir="ltr"> docs/ui-redesign/sync-migration.sql</span>.
        </p>
      )}
      {profileStatus === "denied" && (
        <p className="text-[10.5px] leading-relaxed rounded-xl bg-[#C88725]/[0.08] border border-[#C88725]/25 text-[#8a5f13] px-3 py-2">
          سياسات RLS تمنع قراءة/كتابة الملف الشخصي — تأكد من تطبيق الهجرة كاملة.
        </p>
      )}
      {profileStatus === "error" && (
        <p className="text-[10.5px] leading-relaxed rounded-xl bg-[#D95E65]/[0.08] border border-[#D95E65]/25 text-[#8f2f36] px-3 py-2">
          تعذر الوصول للملف الشخصي السحابي — دخولك سليم، وسنحاول مجدداً.
        </p>
      )}

      {/* 5.2 — حالة المزامنة الحقيقية + زر يدوي */}
      <div className={`rounded-xl border px-3 py-2.5 text-[11px] leading-relaxed font-medium ${syncCls}`} role="status">
        <div className="flex items-center gap-2">
          <CloudCog className="w-4 h-4 shrink-0" aria-hidden="true" />
          <span className="min-w-0 flex-1">{syncLine.text}</span>
          <button
            type="button"
            onClick={handleSyncNow}
            aria-label="زامن الآن"
            className="press w-8 h-8 rounded-lg bg-white/60 flex items-center justify-center shrink-0"
          >
            <RefreshCw className="w-[15px] h-[15px]" aria-hidden="true" />
          </button>
        </div>
      </div>

      <button
        type="button"
        onClick={() => void handleSignOut()}
        className="press h-11 min-h-[44px] w-full rounded-xl bg-[#D95E65]/[0.07] border border-[#D95E65]/25 text-[12.5px] font-semibold text-[#8f2f36] flex items-center justify-center gap-1.5"
      >
        <LogOut className="w-4 h-4" aria-hidden="true" />
        تسجيل الخروج
      </button>

      <p className="text-[10px] leading-relaxed text-muted-foreground/80">
        بياناتك (المال، العادات، المهام…) محفوظة على جهازك أولاً وتُزامَن بحسابك —
        ملفك مستقل لا يراه أي مستخدم آخر، وكل حذف ينتشر بلا بقايا أطياف.
      </p>
    </GlassCard>
  );
}
