"use client";

/**
 * ترويسة 5.1 المدمجة — الشعار الصحيح (أصل مستورد لا ينكسر) + اسم المستخدم
 * والتاريخ الهجري + بحث/إشعارات/Sys + الخصوصية. صف واحد مضغوط يعمل من 320px.
 */
import { motion } from "framer-motion";
import { Bell, Eye, EyeOff, Search, Sparkles } from "lucide-react";
import { useUIStore } from "@/store/ui-store";
import { useLive, getSettings } from "@/lib/db";
import { buildAlerts } from "@/lib/alerts";
import { dayName, formatDate, hijriDate } from "@/lib/format";
import { cn } from "@/lib/utils";
import { Logo } from "./logo";
import { SyncChip } from "./sync-chip";
import "./header-extras.css";

export function Header() {
  const privacyMode = useUIStore((s) => s.privacyMode);
  const togglePrivacy = useUIStore((s) => s.togglePrivacy);
  const setAlertsOpen = useUIStore((s) => s.setAlertsOpen);
  const setSysOpen = useUIStore((s) => s.setSysOpen);
  const setCommandOpen = useUIStore((s) => s.setCommandOpen);

  // شارة التنبيهات + الاسم — تتحدث تلقائياً مع كل تغيير في القاعدة
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
    return { count: alerts.length, name: settings?.displayName ?? "" };
  }, []);

  const count = bundle?.count ?? 0;
  const name = bundle?.name || "صديقنا";
  const hijri = hijriDate();
  const dateLine = hijri
    ? `${dayName(new Date())} · ${formatDate(new Date())} · ${hijri}`
    : `${dayName(new Date())} · ${formatDate(new Date())}`;

  return (
    <div className="flex items-center gap-2.5 px-1 mb-3">
      {/* الشعار — أصل مستورد: لا مسار مطلق، لا صورة مكسورة */}
      <Logo size="md" priority className="shadow-[0_1px_2px_rgba(23,33,43,0.1),0_6px_16px_-8px_rgba(23,33,43,0.28)]" />

      {/* الاسم والتاريخ */}
      <div className="min-w-0 flex-1">
        <h1 className="text-[16px] font-bold leading-tight truncate">{name}</h1>
        <p className="text-[10.5px] text-muted-foreground mt-0.5 truncate">{dateLine}</p>
      </div>

      {/* الإجراءات — لمسات 44px عبر امتداد النقر */}
      <div className="flex items-center gap-1 shrink-0">
        {/* 5.2 — شارة المزامنة (متزامن/محلي/يزامن…) */}
        <SyncChip />

        {/* البحث — شريط الأوامر */}
        <motion.button
          whileTap={{ scale: 0.92 }}
          onClick={() => setCommandOpen(true)}
          className="hdr-action text-muted-foreground hover:text-foreground"
          aria-label="بحث سريع في كل شيء"
        >
          <Search className="w-[19px] h-[19px]" strokeWidth={2.1} />
        </motion.button>

        {/* Sys — المساعد */}
        <motion.button
          whileTap={{ scale: 0.92 }}
          onClick={() => setSysOpen(true)}
          className="hdr-action hdr-action-sys"
          aria-label="محادثة Sys — مساعدك الذكي"
        >
          <Sparkles className="w-[19px] h-[19px]" strokeWidth={2.1} />
        </motion.button>

        {/* التنبيهات */}
        <motion.button
          whileTap={{ scale: 0.92 }}
          onClick={() => setAlertsOpen(true)}
          className="hdr-action relative text-muted-foreground hover:text-foreground"
          aria-label={`مركز التنبيهات${count > 0 ? ` — ${count} تنبيهات` : ""}`}
        >
          <Bell className="w-[19px] h-[19px]" strokeWidth={2.1} />
          {count > 0 && (
            <span
              className={cn(
                "absolute -top-0.5 -end-0.5 min-w-[17px] h-[17px] px-1 rounded-full text-[9.5px] font-bold tabular flex items-center justify-center border border-white",
                count >= 3 ? "bg-destructive text-white" : "bg-primary text-[#2a1a03]"
              )}
            >
              {count}
            </span>
          )}
        </motion.button>

        {/* الخصوصية */}
        <motion.button
          whileTap={{ scale: 0.92 }}
          onClick={togglePrivacy}
          className="hdr-action text-muted-foreground hover:text-foreground"
          aria-label={privacyMode ? "إظهار المبالغ" : "إخفاء المبالغ (وضع الخصوصية)"}
          aria-pressed={privacyMode}
        >
          {privacyMode ? <EyeOff className="w-[19px] h-[19px]" strokeWidth={2.1} /> : <Eye className="w-[19px] h-[19px]" strokeWidth={2.1} />}
        </motion.button>
      </div>
    </div>
  );
}
