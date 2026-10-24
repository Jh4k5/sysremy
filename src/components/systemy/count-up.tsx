"use client";

import { useEffect, useRef } from "react";
import { animate } from "framer-motion";
import { formatNumber } from "@/lib/format";
import { cn } from "@/lib/utils";

interface CountUpProps {
  value: number;
  decimals?: number;
  duration?: number;
  className?: string;
  prefix?: string;
  suffix?: string;
}

/** رقم يعدّ تصاعدياً — مكافأة فورية بصرية لكل تحديث */
export function CountUp({
  value,
  decimals = 0,
  duration = 0.9,
  className,
  prefix = "",
  suffix = "",
}: CountUpProps) {
  const ref = useRef<HTMLSpanElement>(null);
  const prev = useRef(0);
  const initial = useRef(true);

  useEffect(() => {
    const from = initial.current ? Math.max(0, value * 0.35) : prev.current;
    initial.current = false;
    prev.current = value;

    const controls = animate(from, value, {
      duration,
      ease: [0.22, 1, 0.36, 1],
      onUpdate: (v) => {
        if (ref.current) {
          ref.current.textContent = `${prefix}${formatNumber(v, decimals)}${suffix}`;
        }
      },
    });
    return () => controls.stop();
  }, [value, decimals, duration, prefix, suffix]);

  return (
    <span ref={ref} className={cn("tabular", className)}>
      {prefix}
      {formatNumber(value, decimals)}
      {suffix}
    </span>
  );
}
