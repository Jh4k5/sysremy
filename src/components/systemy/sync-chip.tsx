"use client";

/**
 * شارة حالة المزامنة 5.2 — لمسة صغيرة في الترويسة تظهر الحقيقة:
 * متزامن · بلا اتصال (يعمل محلياً ويلحق عند العودة) · يزامن الآن ·
 * يحتاج تشغيل هجرة SQL · خطأ. لمسة واحدة = تفصيل صادق بنافذة توست.
 */

import { motion } from "framer-motion";
import { CloudCog, CloudOff, Loader2, RefreshCw, TriangleAlert } from "lucide-react";
import { toast } from "sonner";
import { useSyncStore, type SyncPhase } from "@/lib/sync/sync-store";
import { syncNow } from "@/lib/sync/sync-engine";
import { cn } from "@/lib/utils";

const META: Record<SyncPhase, { label: string; cls: string; title: string }> = {
  idle: { label: "", cls: "text-muted-foreground", title: "المزامنة لم تبدأ" },
  synced: {
    label: "متزامن",
    cls: "text-[#0f5c47] bg-[#198768]/[0.09]",
    title: "كل شيء محلياً = سحابياً",
  },
  syncing: {
    label: "يزامن",
    cls: "text-[#0E7C84] bg-[#16B8B0]/[0.08]",
    title: "دفع وسحب جارٍ الآن",
  },
  offline: {
    label: "محلي",
    cls: "text-muted-foreground bg-black/[0.04]",
    title: "بلا اتصال — تعمل طبيعياً وتلحق عند عودة الإنترنت",
  },
  "setup-needed": {
    label: "مزامنة معطّلة",
    cls: "text-[#8a5f13] bg-[#C88725]/[0.1]",
    title: "جدول المزامنة لم يُنشأ بعد في Supabase",
  },
  error: {
    label: "خطأ مزامنة",
    cls: "text-[#8f2f36] bg-[#D95E65]/[0.08]",
    title: "آخر دورة فشلت — سنحاول مجدداً",
  },
};

function timeAgo(ts: number | null): string {
  if (!ts) return "لم تتم بعد";
  const s = Math.max(1, Math.round((Date.now() - ts) / 1000));
  if (s < 60) return `قبل ${s} ثانية`;
  const m = Math.round(s / 60);
  if (m < 60) return `قبل ${m} دقيقة`;
  const h = Math.round(m / 60);
  if (h < 24) return `قبل ${h} ساعة`;
  return `قبل ${Math.round(h / 24)} يوم`;
}

export function SyncChip() {
  const phase = useSyncStore((s) => s.phase);
  const pending = useSyncStore((s) => s.pending);
  const lastSyncAt = useSyncStore((s) => s.lastSyncAt);
  const lastError = useSyncStore((s) => s.lastError);

  const meta = META[phase];
  if (!meta.label) return null;

  const describe = () => {
    const lines = [
      phase === "setup-needed"
        ? "المزامنة السحابية تنتظر خطوة تهيئة واحدة في لوحة Supabase — زر «انسخ أوامر التهيئة» موجود في بطاقة الحساب بشاشة «أنا». التطبيق يعمل كاملاً محلياً في هذه الأثناء."
        : phase === "offline"
          ? "أنت غير متصل — كل شيء يعمل على جهازك، وكل تغيير محفوظ وسيُرفع تلقائياً فور عودة الاتصال."
          : phase === "error"
            ? `آخر خطأ: ${lastError ?? "غير معروف"}`
            : phase === "syncing"
              ? "نرفع تغييراتك وننزل الباقي الآن…"
              : `آخر مزامنة ${timeAgo(lastSyncAt)} — بياناتك مطابقة بين جهازك والسحابة.`,
    ];
    if (pending > 0) lines.push(`${pending} تغييراً محلياً بانتظار الرفع`);
    toast(lines.join(" · "), {
      action: { label: "زامن الآن", onClick: () => syncNow() },
    });
  };

  const Icon =
    phase === "syncing" ? Loader2
    : phase === "offline" ? CloudOff
    : phase === "setup-needed" ? TriangleAlert
    : phase === "error" ? TriangleAlert
    : CloudCog;

  return (
    <motion.button
      whileTap={{ scale: 0.94 }}
      onClick={describe}
      aria-label={`حالة المزامنة: ${meta.label} — ${meta.title}`}
      aria-live="polite"
      className={cn(
        "press h-8 px-2.5 rounded-full flex items-center gap-1.5 text-[10.5px] font-bold shrink-0",
        meta.cls
      )}
    >
      <Icon
        className={cn("w-[14px] h-[14px]", phase === "syncing" && "animate-spin")}
        strokeWidth={2.2}
        aria-hidden="true"
      />
      <span className="hidden min-[380px]:inline">{meta.label}</span>
      {pending > 0 && phase !== "syncing" && (
        <span className="min-w-[15px] h-[15px] px-1 rounded-full bg-black/[0.08] text-[9px] font-black flex items-center justify-center tabular">
          {pending > 99 ? "٩٩+" : pending}
        </span>
      )}
      {phase === "synced" && pending === 0 && (
        <RefreshCw className="w-[11px] h-[11px] opacity-50" aria-hidden="true" />
      )}
    </motion.button>
  );
}
