"use client";

/**
 * Systemy v2 — جهاز التطبيق (AppShell)
 * البوابات: الإعداد الأولي → القفل → الشاشات.
 * الطبقات: الإضافة السريعة + التنبيهات + شريط الأوامر + Sys.
 * المجدول: تذكيرات وعادات تطلق إشعارات في وقتها.
 */
import { useEffect, useState } from "react";
import Image from "next/image";
import { AnimatePresence, motion } from "framer-motion";
import { toast } from "sonner";
import { useUIStore } from "@/store/ui-store";
import { db, getSettings, seedSystems, useLive } from "@/lib/db";
import { fireReminder, logHabit, sweepMonthLeftover } from "@/lib/actions";
import { setCurrency, nowHHMM, todayISO } from "@/lib/format";
import { getNotifiedToday, markNotified } from "@/lib/notifications";
import { isStandalone, standaloneServerSnapshot, subscribeNever } from "@/lib/standalone";
import { StatusBar } from "./phone-frame";
import { BottomNav } from "./bottom-nav";
import { Header } from "./header";
import { TodayScreen } from "./today/today-screen";
import { MoneyScreen } from "./money/money-screen";
import { CalendarScreen } from "./calendar/calendar-screen";
import { HabitsScreen } from "./habits/habits-screen";
import { JournalScreen } from "./journal/journal-screen";
import { InsightsScreen } from "./insights/insights-screen";
import { SystemsScreen } from "./systems/systems-screen";
import { SettingsScreen } from "./settings/settings-screen";
import { MoreScreen } from "./more-screen";
import { Onboarding } from "./onboarding/onboarding";
import { LockScreen } from "./lock/lock-screen";
import { QuickAddSheet } from "./quick-add/quick-add-sheet";
import { AlertsCenter } from "./alerts-center";
import { CommandBar } from "./capture/command-bar";
import { SysChat } from "./capture/sys-chat";
// v3 — شاشات الأنظمة الجديدة
import { TasksScreen } from "./tasks/tasks-screen";
import { HealthScreen } from "./health/health-screen";
import { LearningScreen } from "./learning/learning-screen";
import { GoalsScreen } from "./goals/goals-screen";
import { ProjectsScreen } from "./projects/projects-screen";
import { PeopleScreen } from "./people/people-screen";
import { HomeScreen } from "./home/home-screen";
import { NotesScreen } from "./notes/notes-screen";
import { VaultScreen } from "./vault/vault-screen";
import { TravelScreen } from "./travel/travel-screen";

/** جهاز Systemy — كل الشاشات والطبقات */
export function SystemyApp() {
  const { view, commandOpen, setCommandOpen } = useUIStore();

  // نسخة العرض (آمنة للـ hydration)
  const [standalone] = useState(() => isStandalone());

  // اختصار لوحة المفاتيح: Ctrl+K / ⌘K
  useEffect(() => {
    const handler = (e: KeyboardEvent) => {
      if ((e.ctrlKey || e.metaKey) && e.key.toLowerCase() === "k") {
        e.preventDefault();
        setCommandOpen(true);
      }
    };
    window.addEventListener("keydown", handler);
    return () => window.removeEventListener("keydown", handler);
  }, [setCommandOpen]);

  const settings = useLive(() => getSettings(), []);

  // v3: ترحيل أنظمة v2 القائمة — إضافة مفاتيح الأنظمة الجديدة بلا مساس بالتخصيصات
  useEffect(() => {
    void seedSystems().catch(() => undefined);
  }, []);

  // v4: كنس فائض الشهر المالي السابق إلى الادخار — مرة واحدة لكل شهر (إن فعّل المستخدم autoSweep)
  useEffect(() => {
    void sweepMonthLeftover().catch(() => undefined);
  }, []);

  // مزامنة العملة والألوان مع الإعدادات
  useEffect(() => {
    if (settings?.currency) setCurrency(settings.currency);
  }, [settings?.currency]);

  // الإعداد الأولي أو التحميل
  if (!settings) {
    return (
      <div className="h-full flex items-center justify-center app-mesh">
        <div className="flex flex-col items-center gap-4">
          {/* شعار Systemy الرسمي — روبوت Sys */}
          <Image
            src="/brand/logo-128.png"
            alt="شعار Systemy — روبوت Sys"
            width={56}
            height={56}
            className="rounded-2xl border border-white/10"
            priority
          />
          <div className="flex gap-1.5">
            {[0, 1, 2].map((i) => (
              <motion.span
                key={i}
                className="w-2 h-2 rounded-full bg-primary/70"
                animate={{ opacity: [0.25, 1, 0.25], scale: [0.85, 1.15, 0.85] }}
                transition={{ duration: 1.1, repeat: Infinity, delay: i * 0.18 }}
              />
            ))}
          </div>
        </div>
      </div>
    );
  }

  if (!settings.onboardingDone) return <Onboarding />;

  return (
    <div className="relative h-full flex flex-col app-mesh select-none">
      {!standalone && <StatusBar />}

      {/* الترحيب بعد الإعداد */}
      <JustOnboarded name={settings.displayName} />

      <div className="relative flex-1 overflow-hidden">
        {/* ترويسة مشتركة فوق كل الشاشات ما عدا القفل */}
        <LockGate pinHash={settings.pinHash} enabled={settings.lockEnabled}>
          <div className="absolute inset-0 flex flex-col">
            <div className="shrink-0 pt-2 px-4">
              <Header />
            </div>
            <div className="relative flex-1 overflow-hidden">
              <AnimatePresence mode="wait">
                <motion.div
                  key={view}
                  initial={{ opacity: 0, y: 10 }}
                  animate={{ opacity: 1, y: 0 }}
                  exit={{ opacity: 0, y: -8 }}
                  transition={{ duration: 0.28, ease: [0.22, 1, 0.36, 1] }}
                  className="absolute inset-0"
                >
                  {view === "today" && <TodayScreen />}
                  {view === "money" && <MoneyScreen />}
                  {view === "calendar" && <CalendarScreen />}
                  {view === "habits" && <HabitsScreen />}
                  {view === "journal" && <JournalScreen />}
                  {view === "insights" && <InsightsScreen />}
                  {view === "systems" && <SystemsScreen />}
                  {view === "settings" && <SettingsScreen />}
                  {view === "more" && <MoreScreen />}
                  {/* v3 — الأنظمة الجديدة */}
                  {view === "tasks" && <TasksScreen />}
                  {view === "health" && <HealthScreen />}
                  {view === "learning" && <LearningScreen />}
                  {view === "goals" && <GoalsScreen />}
                  {view === "projects" && <ProjectsScreen />}
                  {view === "people" && <PeopleScreen />}
                  {view === "home" && <HomeScreen />}
                  {view === "notes" && <NotesScreen />}
                  {view === "vault" && <VaultScreen />}
                  {view === "travel" && <TravelScreen />}
                </motion.div>
              </AnimatePresence>
            </div>
          </div>

          <BottomNav />
        </LockGate>
      </div>

      {/* المجدول — تذكيرات وعادات */}
      <ReminderScheduler />

      {/* الطبقات العلوية */}
      <QuickAddSheet />
      <AlertsCenter />
      <CommandBar open={commandOpen} />
      <SysChat />
    </div>
  );
}

/** بوابة القفل — تلتف على كل المحتوى */
function LockGate({
  pinHash,
  enabled,
  children,
}: {
  pinHash?: string;
  enabled: boolean;
  children: React.ReactNode;
}) {
  const locked = useUIStore((s) => s.locked);
  const setLocked = useUIStore((s) => s.setLocked);

  // تفعيل القفل عند أول تركيب إذا كان مفعلاً
  useEffect(() => {
    if (enabled && pinHash) setLocked(true);
  }, [enabled, pinHash, setLocked]);

  if (enabled && pinHash && locked) {
    return <LockScreen onUnlocked={() => setLocked(false)} />;
  }
  return <>{children}</>;
}

/** تلميح الترحيب بعد إتمام الإعداد الأولي */
function JustOnboarded({ name }: { name: string }) {
  const [gone, setGone] = useState(false);
  const [shown] = useState(() => {
    if (!name) return false;
    try {
      const key = "systemy-welcomed";
      if (!localStorage.getItem(key)) {
        localStorage.setItem(key, "1");
        return true;
      }
    } catch {
      /* تجاهل */
    }
    return false;
  });
  if (!shown || gone) return null;
  return (
    <motion.div
      initial={{ opacity: 0, y: -12 }}
      animate={{ opacity: [0, 1, 1, 1, 0], y: [-12, 0, 0, 0, -12] }}
      transition={{ duration: 4.5, times: [0, 0.1, 0.5, 0.85, 1], ease: "easeInOut" }}
      onAnimationComplete={() => setGone(true)}
      className="absolute top-16 inset-x-4 z-50 glass rounded-2xl p-3.5 text-center border-primary/25 pointer-events-none"
    >
      <p className="text-[12.5px] font-semibold text-primary">أهلاً بك يا {name} 🌙</p>
      <p className="text-[10.5px] text-muted-foreground mt-0.5">ابدأ بزر + — كل شيء مترابط من هنا</p>
    </motion.div>
  );
}

/**
 * مجدول التذكيرات: كل 30 ثانية يفحص التذكيرات المستحقة
 * وأوقات العادات، فيطلق إشعاراً (داخل التطبيق + متصفح إن سُمح)
 * مع تعليم كمُبلَّغ لمنع التكرار.
 */
function ReminderScheduler() {
  const tick = useUIStore((s) => s.tick);

  useEffect(() => {
    let alive = true;

    const check = async () => {
      if (!alive || typeof window === "undefined") return;
      try {
        const now = new Date();
        const nowISO = `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, "0")}-${String(now.getDate()).padStart(2, "0")}T${nowHHMM()}`;
        const today = todayISO();
        const notified = getNotifiedToday(today);

        // 1) التذكيرات المجدولة المستحقة
        const due = await db.reminders
          .where("done")
          .equals(0)
          .filter((r) => (r.snoozedUntil ?? r.dueAt) <= nowISO && !r.dismissed)
          .toArray();

        for (const r of due.slice(0, 3)) {
          if (notified.has(r.id)) continue;
          toast(`⏰ ${r.title}`, {
            description: "من مركز التنبيهات — افتحه من الجرس",
          });
          await fireReminder(r);
        }

        // 2) أوقات تذكير العادات
        const habits = await db.habits
          .where("remindAt")
          .equals(nowHHMM())
          .filter((h) => !h.archived)
          .toArray();
        for (const h of habits) {
          const key = `habit-${h.id}`;
          if (notified.has(key)) continue;
          const log = await db.habitLogs.where("habitId").equals(h.id).filter((l) => l.date === today).first();
          if (log && log.count >= h.target) continue; // منجزة
          toast(`🔥 حان وقت «${h.name}»`, {
            description: h.timerMinutes ? `جلسة ${h.timerMinutes} دقيقة — افتح العادات وابدأ المؤقت` : "نقرة واحدة تسجل إنجازك",
            action: {
              label: "أنجزتها",
              onClick: () => void logHabit(h.id),
            },
          });
          const { showAppNotification } = await import("@/lib/notifications");
          showAppNotification(`حان وقت «${h.name}»`, { body: "نقرة واحدة تسجل إنجازك", tag: key });
          markNotified(today, key);
        }
      } catch {
        /* صامت */
      }
    };

    void check();
    const interval = setInterval(() => void check(), 30_000);
    return () => {
      alive = false;
      clearInterval(interval);
    };
  }, [tick]);

  return null;
}

export { subscribeNever, standaloneServerSnapshot };
