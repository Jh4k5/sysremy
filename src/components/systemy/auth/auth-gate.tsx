"use client";

/**
 * بوابة الدخول الإلزامية 5.2 — التطبيق لا يُفتح قبل تسجيل حساب:
 * بريد وكلمة مرور، أو Google عند تهيئته. لكل مستخدم ملفه الخاص
 * (قاعدة Dexie مستقلة) ومزامنة سحابية تعمل أوفلاين وتلحق عند العودة.
 *
 * الترتيب الصارم للتبديل — يمنع أي التهام لقاعدة سابقه:
 *   1) الجلسة تصبح جاهزة (auth-store)
 *   2) تبديل القاعدة النشطة إلى SystemyDB-u-{uid} + تشغيل المحرك
 *   3) فقط حينها يُركَّب التطبيق — كل اشتراكاته تنشأ على قاعدته هو
 */

import { useEffect, useState } from "react";
import { AnimatePresence, motion } from "framer-motion";
import { AlertTriangle } from "lucide-react";
import { isSupabaseConfigured } from "@/lib/supabase";
import { setActiveUser } from "@/lib/db";
import { activateSync, deactivateSync } from "@/lib/sync/sync-engine";
import { resetUIState } from "@/store/ui-store";
import { useAuthStore } from "./auth-store";
import { AuthGateScreen } from "./auth-screen";
import { Logo } from "../logo";

/** شاشة انتقال عامة — شعار ونقاط تنبض */
function Splash({ label }: { label?: string }) {
  return (
    <div className="h-full flex items-center justify-center app-mesh" aria-busy="true">
      <div className="flex flex-col items-center gap-4">
        <Logo priority className="w-14 h-14 rounded-2xl" />
        <div className="flex gap-1.5" aria-hidden="true">
          {[0, 1, 2].map((i) => (
            <motion.span
              key={i}
              className="w-2 h-2 rounded-full bg-primary/70"
              animate={{ opacity: [0.25, 1, 0.25], scale: [0.85, 1.15, 0.85] }}
              transition={{ duration: 1.1, repeat: Infinity, delay: i * 0.18 }}
            />
          ))}
        </div>
        {label && <p className="text-[12px] text-muted-foreground font-medium">{label}</p>}
      </div>
    </div>
  );
}

/** تهيئة المصادقة مرة واحدة لكل تحميل (نمط authInitialized في المخزن) */
let gateInitDone = false;

export function AuthGate({ children }: { children: React.ReactNode }) {
  const ready = useAuthStore((s) => s.ready);
  const session = useAuthStore((s) => s.session);

  useEffect(() => {
    if (gateInitDone) return;
    gateInitDone = true;
    useAuthStore.getState().init();
  }, []);

  const uid = ready && session?.user?.id ? session.user.id : null;

  // القاعدة/المحرك جاهزان لهذا المستخدم؟ (يفصل بين «جلسة وصلت» و«قاعدته فُتحت»)
  const [activeUid, setActiveUid] = useState<string | null>(null);

  useEffect(() => {
    let alive = true;
    (async () => {
      if (uid) {
        if (activeUid === uid) return;
        // ملف المستخدم الخاص: قاعدة مستقلة + محرك المزامنة
        await setActiveUser(uid);
        activateSync(uid);
        try {
          localStorage.removeItem("systemy-welcomed"); // ترحيب خاص لكل مستخدم
        } catch {
          /* تجاهل */
        }
        if (alive) setActiveUid(uid);
      } else {
        // خروج: أوقف المزامنة، أعد القاعدة للضيف، وصفر حالة الواجهة
        deactivateSync();
        await setActiveUser(null);
        resetUIState();
        if (alive) setActiveUid(null);
      }
    })();
    return () => {
      alive = false;
    };
  }, [uid]);

  // ─── بلا تهيئة بيئية: عطل صادق بلا ادعاء ───
  if (ready && !isSupabaseConfigured) {
    return (
      <div className="h-full flex items-center justify-center app-mesh px-6">
        <div className="max-w-[320px] text-center space-y-3">
          <span className="w-14 h-14 rounded-2xl bg-[#C88725]/10 text-[#8a5f13] flex items-center justify-center mx-auto">
            <AlertTriangle className="w-7 h-7" aria-hidden="true" />
          </span>
          <p className="text-[15px] font-bold">التطبيق يتطلب حساباً سحابياً</p>
          <p className="text-[12px] text-muted-foreground leading-relaxed">
            متغيرات Supabase غير مضبوطة في بيئة التشغيل — راجع
            <span dir="ltr" className="font-mono"> .env </span> (‏NEXT_PUBLIC_SUPABASE_URL
            والمفتاح الناشر) ثم أعد تحميل الصفحة.
          </p>
        </div>
      </div>
    );
  }

  // ─── أثناء التحميل أو تبديل المستخدم ───
  if (!ready || (uid !== null && activeUid !== uid)) {
    return <Splash label={!ready ? undefined : "نجهّز ملفك…"} />;
  }

  // ─── لا جلسة: البوابة الإلزامية فقط — لا شيء من التطبيق خلفها ───
  if (!uid) {
    return (
      <AnimatePresence mode="wait">
        <motion.div
          key="gate"
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          transition={{ duration: 0.3 }}
          className="h-full"
        >
          <AuthGateScreen />
        </motion.div>
      </AnimatePresence>
    );
  }

  // ─── داخل الحساب: التطبيق كاملاً على قاعدة مستخدمه ───
  return <div className="h-full flex flex-col">{children}</div>;
}
