"use client";

/**
 * مركز التنبيهات — طبقة علوية تُظهر التنبيهات المشتقة من كل الأنظمة
 * + التذكيرات المجدولة القادمة، بإجراءات: فتح / تم / تجاهل.
 */
import { AnimatePresence, motion } from "framer-motion";
import {
  AlertTriangle, Clock, Wallet, Gauge, TrendingDown, Flame, CalendarDays,
  Target, Check, X, Bell, HandCoins,
} from "lucide-react";
import { useUIStore } from "@/store/ui-store";
import { useLive, db, getSettings } from "@/lib/db";
import { buildAlerts, dismissAlert } from "@/lib/alerts";
import { completeReminder, snoozeReminder } from "@/lib/actions";
import { formatTimeAr, todayISO } from "@/lib/format";
import type { AppAlert, Reminder } from "@/lib/types";
import { cn } from "@/lib/utils";

const ALERT_ICONS: Record<string, typeof AlertTriangle> = {
  alert: AlertTriangle,
  clock: Clock,
  wallet: Wallet,
  gauge: Gauge,
  "trending-down": TrendingDown,
  flame: Flame,
  calendar: CalendarDays,
  target: Target,
  "hand-coins": HandCoins,
};

const SEVERITY_STYLES = {
  danger: { icon: "text-coral", ring: "border-coral/25", bg: "bg-coral/[0.06]" },
  warning: { icon: "text-gold", ring: "border-gold/25", bg: "bg-gold/[0.05]" },
  info: { icon: "text-cyan", ring: "border-cyan/20", bg: "bg-cyan/[0.04]" },
} as const;

export function AlertsCenter() {
  const open = useUIStore((s) => s.alertsOpen);
  const setOpen = useUIStore((s) => s.setAlertsOpen);
  const setView = useUIStore((s) => s.setView);

  const data = useLive(async () => {
    const [settings, txs, categories, recurrings, debts, tasks, habits, habitLogs, goals, blocks, reminders] =
      await Promise.all([
        getSettings(),
        db.transactions.toArray(),
        db.categories.toArray(),
        db.recurrings.toArray(),
        db.debts.toArray(),
        db.tasks.toArray(),
        db.habits.toArray(),
        db.habitLogs.toArray(),
        db.goals.toArray(),
        db.blocks.toArray(),
        db.reminders.where("done").equals(0).toArray(),
      ]);
    const alerts = buildAlerts(settings, txs, categories, recurrings, debts, tasks, habits, habitLogs, goals, blocks);
    const today = todayISO();
    const upcoming = reminders
      .filter((r) => !r.dismissed && (r.snoozedUntil ?? r.dueAt) >= `${today}T00:00`)
      .sort((a, b) => (a.snoozedUntil ?? a.dueAt).localeCompare(b.snoozedUntil ?? b.dueAt))
      .slice(0, 8);
    return { alerts, upcoming };
  }, [open]);

  const alerts = data?.alerts ?? [];
  const upcoming = data?.upcoming ?? [];

  const act = (a: AppAlert) => {
    if (a.targetView) setView(a.targetView);
    if (a.dismissKey) dismissAlert(a.dismissKey);
    setOpen(false);
  };

  return (
    <AnimatePresence>
      {open && (
        <>
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            onClick={() => setOpen(false)}
            className="absolute inset-0 z-40 bg-black/55 backdrop-blur-sm"
          />
          <motion.div
            initial={{ y: "100%" }}
            animate={{ y: 0 }}
            exit={{ y: "100%" }}
            transition={{ type: "spring", stiffness: 380, damping: 38 }}
            className="absolute inset-x-0 bottom-0 z-50 max-h-[82%] glass-deep rounded-t-3xl border-t border-white/10 flex flex-col"
            role="dialog"
            aria-label="مركز التنبيهات"
          >
            <div className="flex items-center justify-between px-5 pt-4 pb-2">
              <div className="flex items-center gap-2">
                <Bell className="w-4 h-4 text-primary" />
                <h2 className="text-[15px] font-bold">التنبيهات والتذكيرات</h2>
              </div>
              <button
                onClick={() => setOpen(false)}
                className="w-9 h-9 rounded-full glass-soft flex items-center justify-center text-muted-foreground"
                aria-label="إغلاق"
              >
                <X className="w-4 h-4" />
              </button>
            </div>

            <div className="overflow-y-auto sys-scroll px-4 pb-6 pt-1 space-y-2.5">
              {alerts.length === 0 && upcoming.length === 0 && (
                <div className="py-10 text-center">
                  <span className="w-14 h-14 mx-auto rounded-3xl glass-soft flex items-center justify-center text-mint mb-3">
                    <Check className="w-6 h-6" />
                  </span>
                  <p className="text-[13px] font-semibold">كل شيء هادئ ✓</p>
                  <p className="text-[11.5px] text-muted-foreground mt-1">لا مهام متأخرة ولا استحقاقات قريبة — يومك منظم</p>
                </div>
              )}

              {alerts.map((a) => {
                const style = SEVERITY_STYLES[a.severity];
                const Icon = ALERT_ICONS[a.icon] ?? Bell;
                return (
                  <motion.div
                    key={a.id}
                    initial={{ opacity: 0, x: 20 }}
                    animate={{ opacity: 1, x: 0 }}
                    className={cn("glass rounded-2xl border p-3.5 flex items-start gap-3", style.ring, style.bg)}
                  >
                    <span className={cn("w-10 h-10 rounded-2xl glass-soft flex items-center justify-center shrink-0", style.icon)}>
                      <Icon className="w-[18px] h-[18px]" />
                    </span>
                    <div className="min-w-0 flex-1">
                      <p className="text-[13px] font-semibold leading-snug">{a.title}</p>
                      {a.detail && <p className="text-[11.5px] text-muted-foreground mt-0.5 leading-relaxed">{a.detail}</p>}
                      <div className="flex items-center gap-2 mt-2">
                        {a.actionLabel && (
                          <button
                            onClick={() => act(a)}
                            className="h-8 px-3 rounded-xl bg-primary/15 border border-primary/30 text-primary text-[11px] font-bold"
                          >
                            {a.actionLabel}
                          </button>
                        )}
                        {a.dismissKey && (
                          <button
                            onClick={() => {
                              dismissAlert(a.dismissKey as string);
                              useUIStore.setState({ tick: Date.now() });
                            }}
                            className="h-8 px-3 rounded-xl glass-soft border border-black/[0.07] text-muted-foreground text-[11px]"
                          >
                            تجاهل اليوم
                          </button>
                        )}
                      </div>
                    </div>
                  </motion.div>
                );
              })}

              {upcoming.length > 0 && (
                <div className="pt-2">
                  <p className="text-[11px] font-semibold text-muted-foreground px-1 mb-2">تذكيرات قادمة</p>
                  {upcoming.map((r: Reminder) => (
                    <div key={r.id} className="glass-soft rounded-2xl border border-black/[0.05] p-3 flex items-center gap-3 mb-2">
                      <Clock className="w-4 h-4 text-cyan shrink-0" />
                      <div className="min-w-0 flex-1">
                        <p className="text-[12.5px] font-medium truncate">{r.title}</p>
                        <p className="text-[10.5px] text-muted-foreground tabular">
                          {r.snoozedUntil
                            ? `مؤجل → ${r.snoozedUntil.slice(5, 10)} ${formatTimeAr(r.snoozedUntil.slice(11, 16))}`
                            : `${r.dueAt.slice(5, 10)} · ${formatTimeAr(r.dueAt.slice(11, 16))}`}
                        </p>
                      </div>
                      <button
                        onClick={() => void completeReminder(r.id)}
                        className="w-8 h-8 rounded-full bg-mint/15 border border-mint/30 text-mint flex items-center justify-center shrink-0"
                        aria-label="تم"
                      >
                        <Check className="w-4 h-4" />
                      </button>
                      <button
                        onClick={() => void snoozeReminder(r.id, 30)}
                        className="h-7 px-2.5 rounded-lg glass-soft text-[10px] text-muted-foreground shrink-0"
                        aria-label="تأجيل 30 دقيقة"
                      >
                        +30د
                      </button>
                    </div>
                  ))}
                </div>
              )}
            </div>
          </motion.div>
        </>
      )}
    </AnimatePresence>
  );
}
