"use client";

import { useEffect, useState, type ReactNode } from "react";
import { Signal, Wifi, BatteryFull } from "lucide-react";
import { cn } from "@/lib/utils";

/** ساعة حية بشريط الحالة */
function StatusBar() {
  const [time, setTime] = useState("");

  useEffect(() => {
    const update = () => {
      const d = new Date();
      const h = d.getHours() % 12 === 0 ? 12 : d.getHours() % 12;
      const m = d.getMinutes().toString().padStart(2, "0");
      setTime(`${h}:${m}`);
    };
    update();
    const t = setInterval(update, 15000);
    return () => clearInterval(t);
  }, []);

  return (
    <div className="h-11 flex items-end justify-between px-7 pb-1 shrink-0 select-none" dir="ltr">
      <span className="text-[13px] font-semibold tabular text-foreground/95">{time}</span>
      {/* جزيرة ديناميكية */}
      <div className="absolute left-1/2 -translate-x-1/2 top-2 w-24 h-[26px] bg-black rounded-full hidden sm:block" />
      <div className="flex items-center gap-1.5 text-foreground/90">
        <Signal className="w-3.5 h-3.5" strokeWidth={2.4} />
        <Wifi className="w-3.5 h-3.5" strokeWidth={2.4} />
        <BatteryFull className="w-4.5 h-4.5" strokeWidth={2} />
      </div>
    </div>
  );
}

/** إطار الهاتف — كامل الشاشة على الجوال (معاينة نقية بلا ذيل)، جهاز حقيقي على سطح المكتب */
export function PhoneFrame({ children }: { children: ReactNode }) {
  return (
    <div className="relative w-full h-dvh sm:w-[400px] sm:h-[min(870px,92vh)] sm:rounded-[46px] sm:border-[10px] sm:border-[#151a29] sm:shadow-[0_40px_120px_-20px_rgba(23,33,43,0.5),0_0_0_1px_rgba(23,33,43,0.08)] overflow-hidden bg-[#F8F7F2]">
      <div className="absolute inset-0 pointer-events-none z-40 sm:rounded-[36px] sm:shadow-[inset_0_0_0_1px_rgba(255,255,255,0.06)]" />
      {children}
    </div>
  );
}

export { StatusBar };
