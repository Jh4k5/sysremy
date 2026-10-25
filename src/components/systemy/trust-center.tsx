"use client";

/**
 * Systemy v4 (تكامل Life-os) — مركز الثقة والخصوصية
 * منقولة مضمونها من Life-os `app/trust-center.tsx` + locales/ar.json (trust.*)
 * إلى لغة Systemy: الخصوصية ميزة من الدرجة الأولى معروضة بصراحة —
 * أربع ضمانات + سطر «لماذا اقترح المساعد هذا؟». شاشة ساكنة بالكامل.
 * الدخول: صف «الثقة والخصوصية» في شاشة المزيد — والرجوع إليها من السهم.
 */

import { motion } from "framer-motion";
import {
  ChevronRight,
  FileDown,
  HardDrive,
  Lock,
  ShieldCheck,
  Sparkles,
  Trash2,
} from "lucide-react";
import { useUIStore } from "@/store/ui-store";
import { GlassCard, widgetEnter } from "@/components/systemy/glass";
import { RIBBON_GRAD, RIBBON_PRESS } from "@/components/systemy/habits/habit-templates";
import { cn } from "@/lib/utils";

/* ═══════════════ المضمون — أربع ضمانات (مكيّفة لحقيقة Systemy) ═══════════════ */

const GUARANTEES: Array<{ icon: typeof HardDrive; title: string; body: string }> = [
  {
    icon: HardDrive,
    title: "بياناتك على جهازك فقط",
    body: "كل شيء يُخزَّن في قاعدة محلية (Dexie/IndexedDB) داخل متصفحك — لا خادم، لا حساب، ولا مزامنة سحابية إطلاقاً.",
  },
  {
    icon: FileDown,
    title: "التصدير ملكك",
    body: "نسخة JSON كاملة من كل بياناتك متى شئت — من الإعدادات ← بياناتك ← تصدير — تنتقل معك إلى أي جهاز بلا واسطة.",
  },
  {
    icon: Lock,
    title: "القفل بيدك",
    body: "أقفل تطبيقك برمز PIN يُخزَّن بتشفير SHA-256 على جهازك — ولا يُفتح إلا بيدك.",
  },
  {
    icon: Trash2,
    title: "حذف نهائي حقيقي",
    body: "المسح فوري وكامل بلا أثر — لا سلة مهملات، ولا نسخ خلفية على أي خادم. ما تحذفه يمحق فعلاً.",
  },
];

/* ═══════════════ الشاشة ═══════════════ */

export function TrustCenter() {
  const setView = useUIStore((s) => s.setView);

  return (
    <div className="h-full overflow-y-auto sys-scroll px-4 pt-3 pb-28">
      {/* ═══ الرأس مع زر الرجوع للمزيد ═══ */}
      <motion.header {...widgetEnter(0)} className="mb-4 flex items-center gap-2 px-1">
        <motion.button
          type="button"
          whileTap={{ scale: 0.92 }}
          onClick={() => setView("more")}
          className={cn(
            "glass-soft flex h-11 w-11 shrink-0 items-center justify-center rounded-2xl border border-black/[0.07] text-muted-foreground transition-colors hover:text-foreground",
            RIBBON_PRESS
          )}
          aria-label="الرجوع إلى شاشة المزيد"
        >
          {/* في RTL سهم الرجوع يشير لليمين */}
          <ChevronRight className="h-5 w-5" aria-hidden="true" />
        </motion.button>
        <div className="min-w-0">
          <h1 className="text-[22px] font-bold leading-tight">مركز الثقة والخصوصية</h1>
          <p className="mt-0.5 text-[11px] text-muted-foreground">شفافية كاملة عمّا يحدث لبياناتك</p>
        </div>
      </motion.header>

      {/* ═══ بطاقة البطل — خيط الشريط وحدها (تعفّف V5) ═══ */}
      <motion.div {...widgetEnter(0.05)} className="mb-3">
        <GlassCard className="relative overflow-hidden p-5">
          <div
            className="absolute inset-x-[14%] top-0 h-0.5 rounded-full"
            style={{ background: RIBBON_GRAD, opacity: 0.9 }}
            aria-hidden="true"
          />
          <div className="flex items-start gap-3.5">
            <span className="flex h-12 w-12 shrink-0 items-center justify-center rounded-2xl bg-mint/10 text-mint">
              <ShieldCheck className="h-6 w-6" aria-hidden="true" />
            </span>
            <div className="min-w-0">
              <p className="text-[16px] font-bold leading-6">بياناتك ملكك</p>
              <p className="mt-1 text-[12px] leading-5 text-muted-foreground">
                وهذه شفافية كاملة عمّا يحدث لها — Systemy يعمل كاملاً على جهازك، دون اتصال،
                ودون أن يعرف أحد شيئاً عن حياتك.
              </p>
            </div>
          </div>
        </GlassCard>
      </motion.div>

      {/* ═══ الضمانات الأربع ═══ */}
      <div className="space-y-2.5">
        {GUARANTEES.map((g, i) => {
          const Icon = g.icon;
          return (
            <motion.div key={g.title} {...widgetEnter(0.1 + i * 0.05)}>
              <GlassCard className="p-4">
                <div className="flex items-start gap-3.5">
                  <span className="glass-soft flex h-10 w-10 shrink-0 items-center justify-center rounded-xl text-primary">
                    <Icon className="h-[18px] w-[18px]" aria-hidden="true" />
                  </span>
                  <div className="min-w-0 flex-1">
                    <p className="text-[13.5px] font-bold leading-5">{g.title}</p>
                    <p className="mt-1 text-[11.5px] leading-5 text-muted-foreground">{g.body}</p>
                  </div>
                </div>
              </GlassCard>
            </motion.div>
          );
        })}
      </div>

      {/* ═══ لماذا اقترح المساعد هذا؟ ═══ */}
      <motion.div {...widgetEnter(0.32)} className="mt-5">
        <p className="mb-2 flex items-center gap-1.5 px-1 text-[13px] font-semibold text-foreground/90">
          <Sparkles className="h-4 w-4 text-cyan" aria-hidden="true" />
          لماذا اقترح المساعد هذا؟
        </p>
        <GlassCard className="p-4">
          <div className="flex items-start gap-3.5">
            <span className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl bg-cyan/10 text-cyan">
              <Sparkles className="h-[18px] w-[18px]" aria-hidden="true" />
            </span>
            <p className="min-w-0 flex-1 text-[11.5px] leading-5 text-muted-foreground">
              اقتراحات «سِس» تأتي من قواعد محلية تعمل على جهازك فوق بياناتك فقط —
              سلاسل عاداتك، مصروفك، ومزاجك. لا شيء يُرسَل إلى السحابة ولا يخرج من
              تطبيقك، وكل اقتراح يأتي مع سببه الواضح حتى تسأل «لماذا؟» وتحصل على إجابة.
            </p>
          </div>
        </GlassCard>
      </motion.div>

      {/* ═══ خاتمة هادئة ═══ */}
      <motion.p {...widgetEnter(0.38)} className="mt-6 text-center text-[10px] leading-5 text-muted-foreground/60">
        Systemy — نظام تشغيلك الشخصي
        <span className="mx-1" aria-hidden="true">·</span>
        يعمل كاملاً دون اتصال
        <span className="mx-1" aria-hidden="true">·</span>
        بياناتك على جهازك دائماً
      </motion.p>
    </div>
  );
}
