"use client";

import { motion } from "framer-motion";
import { CalendarDays, Wallet, Plus, LayoutGrid } from "lucide-react";
import { useUIStore } from "@/store/ui-store";
import { cn } from "@/lib/utils";
import type { ViewId } from "@/lib/types";

const NAV: { id: ViewId; label: string; icon: typeof CalendarDays }[] = [
  { id: "today", label: "اليوم", icon: CalendarDays },
  { id: "money", label: "المال", icon: Wallet },
];

const NAV_RIGHT: { id: ViewId; label: string; icon: typeof CalendarDays }[] = [
  { id: "calendar", label: "التقويم", icon: CalendarDays },
  { id: "more", label: "المزيد", icon: LayoutGrid },
];

/** الشريط السفلي: اليوم · المال · ⊕ الإضافة السريعة · التقويم · المزيد */
export function BottomNav() {
  const view = useUIStore((s) => s.view);
  const setView = useUIStore((s) => s.setView);
  const openQuickAdd = useUIStore((s) => s.openQuickAdd);

  return (
    <nav className="absolute bottom-0 inset-x-0 z-30 pb-[env(safe-area-inset-bottom)]" aria-label="التنقل الرئيسي">
      <div className="glass-deep border-t border-white/10 px-2 pt-2 pb-2.5">
        <div className="flex items-end justify-around">
          {NAV.map((item) => (
            <NavItem key={item.id} item={item} active={view === item.id} onClick={() => setView(item.id)} />
          ))}

          {/* زر الإضافة السريعة المركزي — الحقيقي (V5: تاج الشريط) */}
          <div className="relative -mt-7">
            <motion.button
              whileTap={{ scale: 0.96 }}
              onClick={() => openQuickAdd()}
              className="w-16 h-16 rounded-full bg-gradient-to-br from-[#f5b95c] to-[#e89a3e] glow-gold fab-pulse flex items-center justify-center text-[#1c1204] shadow-lg ring-1 ring-white/20"
              aria-label="إضافة سريعة — سجّل أي شيء"
            >
              <Plus className="w-8 h-8" strokeWidth={2.6} />
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
        active ? "text-primary" : "text-muted-foreground hover:text-foreground/80"
      )}
      aria-label={item.label}
      aria-current={active ? "page" : undefined}
    >
      <Icon className="w-[22px] h-[22px]" strokeWidth={active ? 2.4 : 2} />
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
