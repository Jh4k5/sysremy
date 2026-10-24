"use client";

import { type ReactNode } from "react";
import { motion } from "framer-motion";
import { cn } from "@/lib/utils";
import { useUIStore } from "@/store/ui-store";
import { maskMoney } from "@/lib/format";

/** بطاقة زجاجية أساسية */
export function GlassCard({
  children,
  className,
  onClick,
  interactive = false,
}: {
  children: ReactNode;
  className?: string;
  onClick?: () => void;
  interactive?: boolean;
}) {
  return (
    <div
      onClick={onClick}
      className={cn(
        "glass rounded-3xl relative overflow-hidden",
        interactive && "cursor-pointer transition-transform duration-150 ease-out hover:scale-[1.015] active:scale-[0.96]",
        className
      )}
    >
      {children}
    </div>
  );
}

/** عنوان قسم مع رابط اختياري */
export function SectionHeader({
  title,
  icon,
  action,
  onAction,
}: {
  title: string;
  icon?: ReactNode;
  action?: string;
  onAction?: () => void;
}) {
  return (
    <div className="flex items-center justify-between px-1 mb-2.5">
      <div className="flex items-center gap-2 text-[13px] font-semibold text-foreground/90">
        {icon}
        <span>{title}</span>
      </div>
      {action && (
        <button
          onClick={onAction}
          className="text-[11px] text-primary/90 hover:text-primary transition-colors font-medium"
        >
          {action}
        </button>
      )}
    </div>
  );
}

/** شريحة صغيرة */
export function Chip({ children, className }: { children: ReactNode; className?: string }) {
  return (
    <span
      className={cn(
        "inline-flex items-center gap-1 rounded-full px-2.5 py-0.5 text-[10.5px] font-medium glass-soft",
        className
      )}
    >
      {children}
    </span>
  );
}

/** مبلغ محترم لوضع الخصوصية (يظهر ••••) */
export function PrivateAmount({
  children,
  className,
}: {
  children: ReactNode;
  className?: string;
}) {
  const privacy = useUIStore((s) => s.privacyMode);
  if (privacy) {
    return <span className={cn("tabular tracking-widest", className)}>{maskMoney()}</span>;
  }
  return <span className={cn("tabular", className)}>{children}</span>;
}

/** حركة ظهور دخول الويدجت — V5: على مقياس رموز الحركة (y 12px + blur 2px) */
export function widgetEnter(delay = 0) {
  return {
    initial: { opacity: 0, y: 12, filter: "blur(2px)" },
    animate: { opacity: 1, y: 0, filter: "blur(0px)" },
    transition: { duration: 0.4, delay, ease: [0.22, 1, 0.36, 1] as const },
  };
}

export function MotionDiv(props: React.ComponentProps<typeof motion.div>) {
  return <motion.div {...props} />;
}
