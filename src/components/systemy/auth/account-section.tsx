"use client";

/**
 * قسم «الحساب السحابي» في شاشة أنا — صادق بحالتين:
 * داخل: بطاقة الحساب + حالة الملف الشخصي + خروج.
 * خارج: دعوة اختيارية للدخول (بلا ضغط) — البيانات المحلية تكفي للتطبيق.
 */
import { LogOut, ShieldCheck, CloudCog, ChevronLeft } from "lucide-react";
import { toast } from "sonner";
import { isSupabaseConfigured } from "@/lib/supabase";
import { useUIStore } from "@/store/ui-store";
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
  // غير مهيأ بيئياً؟ القسم كله يختفي (ميزة اختيارية — لا ندّعي وجودها)
  if (!isSupabaseConfigured) return null;
  return <AccountSectionInner />;
}

function AccountSectionInner() {
  const { ready, session, user, profile, profileStatus, signOut } = useAuthStore();
  const openAuth = useUIStore((s) => s.openAuth);

  const handleSignOut = async () => {
    await signOut();
    toast("سجّلنا خروجك", { description: "بياناتك في التطبيق كما هي على جهازك" });
  };

  if (!user || !session) {
    // ⏳ قبل جهوزية الجلسة: هياكل صامتة (منع وميض «سجّل دخولك» الخاطئ)
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
              اختياري — لملفك الشخصي واستعادة وصولك من أي جهاز
            </p>
          </div>
        </div>
        <div className="flex gap-2">
          <button type="button" onClick={() => openAuth("login")} className={`${btnGhost} flex-1`}>
            تسجيل الدخول
            <ChevronLeft className="w-4 h-4" aria-hidden="true" />
          </button>
          <button type="button" onClick={() => openAuth("signup")} className={`${btnGhost} flex-1`}>
            حساب جديد
          </button>
        </div>
        <p className="text-[10px] leading-relaxed text-muted-foreground/80">
          تطبيقك يعمل كاملاً بلا حساب — بياناتك محلية على جهازك دائماً.
        </p>
      </GlassCard>
    );
  }

  // ─── داخل الحساب ───
  const displayName = profile?.display_name?.trim()
    || (user.user_metadata?.full_name as string | undefined)?.trim()
    || user.email?.split("@")[0]
    || "حسابك";
  const email = user.email ?? "";

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
          جدول <span dir="ltr">profiles</span> لم يُنشأ بعد في قاعدة بياناتك — شغّل هجرة SQL من
          <span dir="ltr"> docs/ui-redesign/supabase-foundation.md</span> ليكتمل الملف الشخصي.
        </p>
      )}
      {profileStatus === "denied" && (
        <p className="text-[10.5px] leading-relaxed rounded-xl bg-[#C88725]/[0.08] border border-[#C88725]/25 text-[#8a5f13] px-3 py-2">
          سياسات RLS تمنع قراءة/كتابة الملف الشخصي — تأكد من تطبيق الهجرة كاملة (الجدول + السياسات).
        </p>
      )}
      {profileStatus === "error" && (
        <p className="text-[10.5px] leading-relaxed rounded-xl bg-[#D95E65]/[0.08] border border-[#D95E65]/25 text-[#8f2f36] px-3 py-2">
          تعذر الوصول للملف الشخصي السحابي — دخولك سليم، والملف يحاول مجدداً لاحقاً.
        </p>
      )}

      <button
        type="button"
        onClick={() => void handleSignOut()}
        className="press h-11 min-h-[44px] w-full rounded-xl bg-[#D95E65]/[0.07] border border-[#D95E65]/25 text-[12.5px] font-semibold text-[#8f2f36] flex items-center justify-center gap-1.5"
      >
        <LogOut className="w-4 h-4" aria-hidden="true" />
        تسجيل الخروج
      </button>

      <p className="text-[10px] leading-relaxed text-muted-foreground/80">
        بيانات التطبيق (المال، العادات، المهام…) تبقى على جهازك فقط — لا مزامنة سحابية بعد،
        وعند توفرها ستكون خياراً صريحاً.
      </p>
    </GlassCard>
  );
}
