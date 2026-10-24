"use client";

/**
 * Systemy v2 — شاشة المال (الموسّعة)
 * هيرو مصغر (صافي الثروة) + شريط تبويبات لاصق + القسم النشط.
 * كل القراءات عبر useLive (Dexie) وكل التعديلات عبر actions — الترابط تلقائي.
 */

import { createElement, useEffect, useMemo, useRef, useState, type CSSProperties, type ReactNode } from "react";
import { motion } from "framer-motion";
import {
  ArrowRight,
  Eye,
  EyeOff,
  Gauge,
  Gem,
  LayoutGrid,
  Receipt,
  Repeat,
  Tags,
  Target,
  Wallet,
  type LucideIcon,
} from "lucide-react";
import { db, DEFAULT_SETTINGS, useLive } from "@/lib/db";
import { useUIStore } from "@/store/ui-store";
import { formatMoney } from "@/lib/format";
import { netWorth } from "@/lib/money";
import { PrivateAmount, widgetEnter } from "@/components/systemy/glass";
import { Drawer, DrawerContent, DrawerDescription, DrawerHeader, DrawerTitle } from "@/components/ui/drawer";
import { iconByName } from "@/components/systemy/ui-bits";
import { cn } from "@/lib/utils";
import type {
  Account,
  Asset,
  Category,
  Debt,
  Goal,
  Recurring,
  Settings,
  Transaction,
} from "@/lib/types";
import { BudgetSection } from "./budget-section";
import { OverviewSection } from "./overview-section";
import { TxSection } from "./tx-section";
import { AccountsSection } from "./accounts-section";
import { CategoriesSection } from "./categories-section";
import { RecurringSection } from "./recurring-section";
import { GoalsSection } from "./goals-section";
import { AssetsDebtsSection } from "./assets-debts-section";

/* ═══════════════════════ التبويبات والبيانات المشتركة ═══════════════════════ */

export type MoneyTabId =
  | "overview"
  | "budget"
  | "transactions"
  | "accounts"
  | "categories"
  | "recurring"
  | "goals"
  | "assets";

const TABS: Array<{ id: MoneyTabId; label: string; icon: LucideIcon }> = [
  { id: "overview", label: "نظرة عامة", icon: LayoutGrid },
  { id: "budget", label: "الميزانية", icon: Gauge },
  { id: "transactions", label: "المعاملات", icon: Receipt },
  { id: "accounts", label: "الحسابات", icon: Wallet },
  { id: "categories", label: "الفئات", icon: Tags },
  { id: "recurring", label: "المتكررة", icon: Repeat },
  { id: "goals", label: "الأهداف", icon: Target },
  { id: "assets", label: "الأصول والديون", icon: Gem },
];

/** حزمة بيانات المال الكاملة — تُقرأ مرة واحدة وتتدفق لكل الأقسام */
export interface MoneyData {
  settings: Settings;
  accounts: Account[];
  categories: Category[];
  txs: Transaction[];
  recurrings: Recurring[];
  goals: Goal[];
  assets: Asset[];
  debts: Debt[];
}

/* ═══════════════════════ عناصر متوافقة مع بقية الشاشات ═══════════════════════ */

/** أيقونة بالاسم (lucide) — مع بديل شكلي */
export function SysIcon({ name, className, style }: { name: string; className?: string; style?: CSSProperties }) {
  return createElement(iconByName(name), { className, style, "aria-hidden": true });
}

/** لون hex + شفافية سداسية (مثل #F5B95C22) */
export function tint(color: string, alpha = "22"): string {
  return /^#[0-9a-fA-F]{6}$/.test(color) ? `${color}${alpha}` : color;
}

/** دائرة ملونة تحتضن أيقونة الفئة/الحساب/النظام */
export function IconBubble({
  icon,
  color,
  className,
  iconClassName,
}: {
  icon: string;
  color: string;
  className?: string;
  iconClassName?: string;
}) {
  return (
    <div
      className={cn("flex items-center justify-center shrink-0 rounded-2xl", className)}
      style={{ background: tint(color), color }}
    >
      <SysIcon name={icon} className={iconClassName} />
    </div>
  );
}

/** هيكل ورقة سفلية موحد لكل نماذج إدارة المال */
export function SheetShell({
  title,
  desc,
  onClose,
  children,
}: {
  title: string;
  desc?: string;
  onClose: () => void;
  children: ReactNode;
}) {
  return (
    <Drawer open onOpenChange={(o) => { if (!o) onClose(); }}>
      <DrawerContent
        className={cn(
          "max-w-[430px] mx-auto",
          "data-[vaul-drawer-direction=bottom]:max-h-[92vh]",
          "data-[vaul-drawer-direction=bottom]:rounded-t-3xl",
          "border-white/10"
        )}
      >
        <DrawerHeader className="pb-0">
          <DrawerTitle className="text-[15px] font-bold">{title}</DrawerTitle>
          {desc && <DrawerDescription className="text-[11px] line-clamp-1">{desc}</DrawerDescription>}
        </DrawerHeader>
        <div className="flex-1 overflow-y-auto sys-scroll px-4 pb-6 pt-2">{children}</div>
      </DrawerContent>
    </Drawer>
  );
}

/* ═══════════════════════ هيكل التحميل ═══════════════════════ */

function MoneySkeleton() {
  return (
    <div className="h-full overflow-y-auto sys-scroll px-4 pt-3 pb-28" aria-busy="true" aria-label="جارٍ تحميل شاشة المال">
      <div className="h-14 rounded-2xl glass animate-pulse" />
      <div className="h-11 mt-3 rounded-full glass animate-pulse" />
      <div className="h-44 mt-4 rounded-3xl glass animate-pulse" />
      <div className="h-32 mt-3 rounded-3xl glass animate-pulse" />
      <div className="h-28 mt-3 rounded-3xl glass animate-pulse" />
    </div>
  );
}

/* ═══════════════════════ الشاشة الرئيسية ═══════════════════════ */

export function MoneyScreen({ onBack }: { onBack?: () => void }) {
  const moneyTabHint = useUIStore((s) => s.moneyTab);
  const consumeMoneyTab = useUIStore((s) => s.consumeMoneyTab);
  const privacyMode = useUIStore((s) => s.privacyMode);
  const togglePrivacy = useUIStore((s) => s.togglePrivacy);
  const [tabState, setTabState] = useState<MoneyTabId>("overview");
  const scrollRef = useRef<HTMLDivElement>(null);

  /** التبويب الفعلي: تلميح المتجر (تنبيه/شاشة أخرى) يتقدم على الاختيار المحلي حتى يُستهلك */
  const tab: MoneyTabId =
    moneyTabHint && TABS.some((t) => t.id === moneyTabHint) ? (moneyTabHint as MoneyTabId) : tabState;

  /** اختيار تبويب — يستهلك التلميح المعلق إن وُجد */
  const selectTab = (t: MoneyTabId) => {
    if (moneyTabHint) consumeMoneyTab();
    setTabState(t);
  };

  /** قراءة كل بيانات المال — تفاعلية بالكامل عبر liveQuery */
  const data = useLive(async (): Promise<MoneyData> => {
    const [settings, accounts, categories, txs, recurrings, goals, assets, debts] = await Promise.all([
      db.settings.get("app"),
      db.accounts.toArray(),
      db.categories.toArray(),
      db.transactions.toArray(),
      db.recurrings.toArray(),
      db.goals.toArray(),
      db.assets.toArray(),
      db.debts.toArray(),
    ]);
    return {
      settings: settings ?? DEFAULT_SETTINGS,
      accounts: accounts.sort((a, b) => a.order - b.order),
      categories: categories.sort((a, b) => a.order - b.order),
      txs,
      recurrings,
      goals,
      assets,
      debts,
    };
  }, []);

  const nw = useMemo(
    () => (data ? netWorth(data.accounts, data.txs, data.assets, data.debts) : null),
    [data],
  );

  /** إرجاع التمرير لأعلى عند تبديل القسم */
  useEffect(() => {
    scrollRef.current?.scrollTo({ top: 0 });
  }, [tab]);

  if (!data || !nw) return <MoneySkeleton />;

  const cur = data.settings.currency || "ر.س";

  return (
    <div ref={scrollRef} className="h-full overflow-y-auto sys-scroll px-4 pt-3 pb-28">
      {/* ═══ هيرو مصغر: العنوان + صافي الثروة + الخصوصية ═══ */}
      <header className="flex items-center justify-between gap-2 px-1 mb-3">
        <div className="flex items-center gap-2 min-w-0">
          {onBack && (
            <button
              onClick={onBack}
              aria-label="رجوع"
              className="w-11 h-11 rounded-2xl glass flex items-center justify-center text-muted-foreground hover:text-foreground transition-colors shrink-0"
            >
              <ArrowRight className="w-5 h-5" />
            </button>
          )}
          <div className="min-w-0">
            <h1 className="text-[20px] font-bold leading-6">المال</h1>
            <p className="text-[11px] text-muted-foreground mt-0.5 flex items-center gap-1.5 min-w-0">
              <span className="shrink-0">صافي الثروة</span>
              <PrivateAmount className="text-primary font-semibold truncate">
                {formatMoney(nw.total, cur)}
              </PrivateAmount>
            </p>
          </div>
        </div>
        <button
          onClick={togglePrivacy}
          aria-label={privacyMode ? "إظهار المبالغ" : "إخفاء المبالغ (وضع الخصوصية)"}
          aria-pressed={privacyMode}
          className="w-11 h-11 rounded-2xl glass flex items-center justify-center text-muted-foreground hover:text-foreground transition-colors shrink-0"
        >
          {privacyMode ? <EyeOff className="w-[18px] h-[18px]" /> : <Eye className="w-[18px] h-[18px]" />}
        </button>
      </header>

      {/* ═══ شريط التبويبات اللاصق ═══ */}
      <nav
        aria-label="أقسام المال"
        className="sticky top-0 z-30 -mx-4 px-4 py-2.5 mb-3 bg-[#0B0F1A]/85 backdrop-blur-xl border-b border-white/[0.05]"
      >
        <div className="flex gap-2 overflow-x-auto no-scrollbar" role="tablist">
          {TABS.map((t) => {
            const active = tab === t.id;
            const Icon = t.icon;
            return (
              <button
                key={t.id}
                role="tab"
                aria-selected={active}
                onClick={() => selectTab(t.id)}
                className={cn(
                  "h-11 px-4 rounded-full flex items-center gap-1.5 text-[12px] font-semibold shrink-0 transition-all border",
                  active
                    ? "bg-primary/20 border-primary/50 text-primary"
                    : "glass-soft border-white/[0.06] text-foreground/70 hover:text-foreground"
                )}
              >
                <Icon className="w-4 h-4" aria-hidden="true" />
                {t.label}
              </button>
            );
          })}
        </div>
      </nav>

      {/* ═══ القسم النشط ═══ */}
      <motion.div key={tab} {...widgetEnter()}>
        {tab === "overview" && <OverviewSection data={data} onGoToTab={selectTab} />}
        {tab === "budget" && <BudgetSection data={data} onGoToTab={selectTab} />}
        {tab === "transactions" && <TxSection data={data} />}
        {tab === "accounts" && <AccountsSection data={data} />}
        {tab === "categories" && <CategoriesSection data={data} />}
        {tab === "recurring" && <RecurringSection data={data} />}
        {tab === "goals" && <GoalsSection data={data} />}
        {tab === "assets" && <AssetsDebtsSection data={data} />}
      </motion.div>
    </div>
  );
}
