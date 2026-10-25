"use client";

/**
 * شريط التنقل 5.1 — بنية واحدة: اليوم · الأنظمة · ⊕ · المال · أنا
 * (التقويم يُفتح من شريط الأسبوع في شاشة اليوم ومن مركز الأنظمة).
 * يحترم المساحة الآمنة أسفل أندرويد، حالة نشطة واحدة، بلا تثبيت عرضي يتجاوز الشاشة.
 */
import { motion } from "framer-motion";
import { Plus, User, Wallet, LayoutGrid, CalendarDays } from "lucide-react";
import { useUIStore } from "@/store/ui-store";
import { cn } from "@/lib/utils";
import type { ViewId } from "@/lib/types";

const NAV: { id: ViewId; label: string; icon: typeof CalendarDays }[] = [
  { id: "today", label: "اليوم", icon: CalendarDays },
  { id: "systems", label: "الأنظمة", icon: LayoutGrid },
];

const NAV_RIGHT: { id: ViewId; label: string; icon: typeof CalendarDays }[] = [
  { id: "money", label: "المال", icon: Wallet },
  { id: "settings", label: "أنا", icon: User },
];

/** الشريط السفلي: اليوم · الأنظمة · ⊕ الإضافة السريعة · المال · أنا */
export function BottomNav() {
  const view = useUIStore((s) => s.view);
  const setView = useUIStore((s) => s.setView);
  const openQuickAdd = useUIStore((s) => s.openQuickAdd);

  return (
    <nav
      className="absolute bottom-0 inset-x-0 z-30 pb-[env(safe-area-inset-bottom)]"
      aria-label="التنقل الرئيسي"
    >
      <div className="glass-deep border-t border-black/[0.05] px-1.5 pt-1.5 pb-2">
        <div className="flex items-end justify-around max-w-md mx-auto">
          {NAV.map((item) => (
            <NavItem key={item.id} item={item} active={view === item.id} onClick={() => setView(item.id)} />
          ))}

          {/* زر الإضافة السريعة المركزي — عنبري مميز بلا طغيان (52px) */}
          <div className="relative -mt-5">
            <motion.button
              whileTap={{ scale: 0.96 }}
              onClick={() => openQuickAdd()}
              className="w-[52px] h-[52px] rounded-full glow-gold fab-pulse flex items-center justify-center text-[#2a1a03] shadow-lg ring-1 ring-black/[0.06]"
              style={{ background: "linear-gradient(145deg, #F2B347, #D99026)" }}
              aria-label="إضافة سريعة — سجّل أي شيء"
            >
              <Plus className="w-[26px] h-[26px]" strokeWidth={2.6} />
            </motion.button>
          </div>

          {NAV_RIGHT.map((item) => (
            <NavItem key={item.id} item={item} active={view === item.id} onClick={() => setView(item.id)} />
          ))}
        </div>
      </div>
    </nav>
  );
}

function NavItem({
  item,
  active,
  onClick,
}: {
  item: { id: ViewId; label: string; icon: typeof CalendarDays };
  active: boolean;
  onClick: () => void;
}) {
  const Icon = item.icon;
  return (
    <button
      onClick={onClick}
      className={cn(
        "flex flex-col items-center gap-0.5 w-16 pt-1.5 pb-0.5 rounded-2xl transition-colors min-h-[44px] justify-center",
        active ? "text-gold" : "text-muted-foreground hover:text-foreground"
      )}
      aria-label={item.label}
      aria-current={active ? "page" : undefined}
    >
      <Icon className="w-[21px] h-[21px]" strokeWidth={active ? 2.4 : 2} />
      <span className={cn("text-[10px] font-medium", active && "font-semibold")}>{item.label}</span>
      {active && (
        <motion.span
          layoutId="nav-dot"
          className="h-[3px] rounded-full ribbon"
          style={{ width: 22 }}
          transition={{ type: "spring", stiffness: 500, damping: 30 }}
        />
      )}
    </button>
  );
}
