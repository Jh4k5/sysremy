"use client";

import Image from "next/image";
import { motion } from "framer-motion";
import { Bell, Eye, EyeOff, Sparkles } from "lucide-react";
import { useUIStore } from "@/store/ui-store";
import { useLive } from "@/lib/db";
import { getSettings } from "@/lib/db";
import { buildAlerts } from "@/lib/alerts";
import { cn } from "@/lib/utils";

/** ترويسة الشاشات: شعار + جرس التنبيهات (بشارة) + Sys + الخصوصية */
export function Header() {
  const privacyMode = useUIStore((s) => s.privacyMode);
  const togglePrivacy = useUIStore((s) => s.togglePrivacy);
  const setAlertsOpen = useUIStore((s) => s.setAlertsOpen);
  const setSysOpen = useUIStore((s) => s.setSysOpen);

  // شارة التنبيهات — تتحدث تلقائياً مع كل تغيير في القاعدة
  const bundle = useLive(async () => {
    const [settings, txs, categories, recurrings, debts, tasks, habits, habitLogs, goals, blocks] = await Promise.all([
      getSettings(),
      (await import("@/lib/db")).db.transactions.toArray(),
      (await import("@/lib/db")).db.categories.toArray(),
      (await import("@/lib/db")).db.recurrings.toArray(),
      (await import("@/lib/db")).db.debts.toArray(),
      (await import("@/lib/db")).db.tasks.toArray(),
      (await import("@/lib/db")).db.habits.toArray(),
      (await import("@/lib/db")).db.habitLogs.toArray(),
      (await import("@/lib/db")).db.goals.toArray(),
      (await import("@/lib/db")).db.blocks.toArray(),
    ]);
    const alerts = buildAlerts(settings, txs, categories, recurrings, debts, tasks, habits, habitLogs, goals, blocks);
    return { count: alerts.length };
  }, []);

  const count = bundle?.count ?? 0;

  return (
    <div className="flex items-center justify-between px-1 mb-3">
      {/* شعار Systemy V5 — روبوت Sys بالشريط الملون */}
      <Image
        src="/brand/logo-128.png"
        alt="شعار Systemy — روبوت Sys يلتف حوله شريط ألوان متدرج"
        width={40}
        height={40}
        className="rounded-[13px] shadow-[0_2px_10px_rgba(0,0,0,0.45)] shrink-0 select-none pointer-events-none"
        priority
      />

      <div className="flex items-center gap-2">
        {/* Sys — المساعد */}
        <motion.button
          whileTap={{ scale: 0.9 }}
          onClick={() => setSysOpen(true)}
          className="w-10 h-10 rounded-full glass flex items-center justify-center text-cyan"
          aria-label="محادثة Sys — مساعدك الذكي"
        >
          <Sparkles className="w-[18px] h-[18px]" />
        </motion.button>

        {/* التنبيهات */}
        <motion.button
          whileTap={{ scale: 0.9 }}
          onClick={() => setAlertsOpen(true)}
          className="relative w-10 h-10 rounded-full glass flex items-center justify-center text-muted-foreground hover:text-foreground transition-colors"
          aria-label={`مركز التنبيهات${count > 0 ? ` — ${count} تنبيهات` : ""}`}
        >
          <Bell className="w-[18px] h-[18px]" />
          {count > 0 && (
            <span
              className={cn(
                "absolute -top-0.5 -end-0.5 min-w-[18px] h-[18px] px-1 rounded-full text-[10px] font-bold tabular flex items-center justify-center",
                count >= 3 ? "bg-destructive text-white" : "bg-primary text-[#1c1204]"
              )}
            >
              {count}
            </span>
          )}
        </motion.button>

        {/* الخصوصية */}
        <button
          onClick={togglePrivacy}
          className="w-10 h-10 rounded-full glass flex items-center justify-center text-muted-foreground hover:text-foreground transition-colors"
          aria-label={privacyMode ? "إظهار المبالغ" : "إخفاء المبالغ (وضع الخصوصية)"}
          aria-pressed={privacyMode}
        >
          {privacyMode ? <EyeOff className="w-[18px] h-[18px]" /> : <Eye className="w-[18px] h-[18px]" />}
        </button>
      </div>
    </div>
  );
}
