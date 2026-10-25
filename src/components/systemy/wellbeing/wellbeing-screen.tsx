"use client";

/**
 * Systemy v4 (تكامل Life-os) — شاشة العافية والدوبامين
 * منقولة مفاهيمها من Life-os `app/(tabs)/more/dopamine/index.tsx` إلى
 * لغة تصميم Systemy: أنشطة يحددها المستخدم (تغذّيك/تستنزفك) بتسجيل يومي
 * بنقرة، رصيد الأسبوع الصافي بمخطط أعمدة متفرّع (نعناعي أعلى / مرجاني أسفل)،
 * وقواعد يضعها لنفسك مع تذكير مجدول عبر محرك التذكيرات القائم
 * (الطبقة E0: actions.ts — addWellbeingActivity/toggleWellbeingToday/…).
 */

import { useEffect, useMemo, useState, type CSSProperties } from "react";
import { createElement } from "react";
import { motion } from "framer-motion";
import {
  Bell,
  Check,
  Hourglass,
  Leaf,
  Pencil,
  Plus,
  ShieldCheck,
} from "lucide-react";
import {
  Drawer,
  DrawerContent,
  DrawerDescription,
  DrawerHeader,
  DrawerTitle,
} from "@/components/ui/drawer";
import { Switch } from "@/components/ui/switch";
import {
  addWellbeingActivity,
  deleteWellbeingActivity,
  deleteWellbeingRule,
  toggleWellbeingToday,
  updateWellbeingActivity,
  addWellbeingRule,
  updateWellbeingRule,
} from "@/lib/actions";
import { db, useLive } from "@/lib/db";
import type { WellbeingActivity, WellbeingRule } from "@/lib/types";
import { addDaysISO, formatTimeAr, fromISODate, todayISO } from "@/lib/format";
import {
  ChipRow,
  ConfirmBar,
  EmptyState,
  Field,
  FormShell,
  IconGrid,
  iconByName,
  inputCls,
} from "@/components/systemy/ui-bits";
import { GlassCard, SectionHeader, widgetEnter } from "@/components/systemy/glass";
import { RIBBON_GRAD, RIBBON_PRESS } from "@/components/systemy/habits/habit-templates";
import { cn } from "@/lib/utils";

/* ═══════════════ ثوابت ═══════════════ */

const MINT = "#6EE7A8";
const CORAL = "#FF8E7A";

/** حروف أيام الأسبوع — الأحد..السبت (نفس اصطلاح شاشة العادات) */
const DAY_LETTERS = ["ح", "ن", "ث", "ر", "خ", "ج", "س"];

/** أيقونات مقترحة لأنشطة العافية — من خريطة ui-bits */
const WB_ICON_CHOICES = [
  "footprints", "book-open", "dumbbell", "droplets", "music", "smartphone",
  "gamepad-2", "coffee", "brain", "leaf", "salad", "moon", "sun", "timer",
  "pen-line", "languages", "heart-pulse", "zap", "flame", "star",
] as const;

/** مقترحات البداية — ثلاثة أنشطة تُزرع بزر واحد (بلا سجلات) */
const STARTERS: Array<{ name: string; kind: WellbeingActivity["kind"]; icon: string }> = [
  { name: "مشي ٢٠ دقيقة", kind: "healthy", icon: "footprints" },
  { name: "قراءة قبل النوم", kind: "healthy", icon: "book-open" },
  { name: "تمرير بلا هدف", kind: "draining", icon: "smartphone" },
];

const RULE_TIME_PRESETS: Array<{ time: string; label: string }> = [
  { time: "07:00", label: "7 صباحاً" },
  { time: "21:00", label: "9 مساءً" },
  { time: "22:00", label: "10 مساءً" },
  { time: "23:00", label: "11 ليلاً" },
];

/* ═══════════════ أدوات صغيرة ═══════════════ */

/** أيقونة بالاسم — مبنية داخل إغلاق خريطة (نمط آمن لقواعد الخطافات) */
function WbGlyph({ name, className, style }: { name: string; className?: string; style?: CSSProperties }) {
  return (
    <>
      {[name.toLowerCase()].map((n) => {
        const I = iconByName(n);
        return <I key={n} className={className} style={style} aria-hidden="true" />;
      })}
    </>
  );
}

/* ═══════════════ الشاشة ═══════════════ */

export function WellbeingScreen() {
  const today = todayISO();

  /* قراءة تفاعلية واحدة للأنشطة والسجلات والقواعد */
  const data = useLive(async () => {
    const [activities, logs, rules] = await Promise.all([
      db.wellbeingActivities.toArray(),
      db.wellbeingLogs.toArray(),
      db.wellbeingRules.toArray(),
    ]);
    return { activities, logs, rules };
  }, []);

  /* حوارات الأنشطة والقواعد */
  const [actOpen, setActOpen] = useState(false);
  const [actEditing, setActEditing] = useState<WellbeingActivity | null>(null);
  const [actKind, setActKind] = useState<WellbeingActivity["kind"]>("healthy");

  const [ruleOpen, setRuleOpen] = useState(false);
  const [ruleEditing, setRuleEditing] = useState<WellbeingRule | null>(null);

  const [seeding, setSeeding] = useState(false);

  /* ─── مشتقات ─── */
  const activities = data?.activities ?? [];
  const logs = data?.logs ?? [];
  const rules = data?.rules ?? [];

  const kindById = useMemo(() => new Map(activities.map((a) => [a.id, a.kind])), [activities]);
  const loggedToday = useMemo(() => {
    const s = new Set<string>();
    for (const l of logs) if (l.date === today) s.add(l.activityId);
    return s;
  }, [logs, today]);

  const healthy = activities.filter((a) => a.kind === "healthy");
  const draining = activities.filter((a) => a.kind === "draining");

  /** آخر ٧ أيام: تغذية/استنزاف/الصافي لكل يوم — نفس منطق wellbeingWeek() */
  const week = useMemo(() => {
    const days = Array.from({ length: 7 }, (_, i) => addDaysISO(today, i - 6));
    return days.map((date) => {
      const dayLogs = logs.filter((l) => l.date === date);
      let h = 0;
      let d = 0;
      for (const l of dayLogs) {
        if (kindById.get(l.activityId) === "draining") d += 1;
        else h += 1;
      }
      return { date, healthy: h, draining: d, net: h - d };
    });
  }, [logs, kindById, today]);

  const net = week.reduce((s, d) => s + d.net, 0);
  const totalHealthy = week.reduce((s, d) => s + d.healthy, 0);
  const totalDraining = week.reduce((s, d) => s + d.draining, 0);
  const maxScale = Math.max(1, ...week.map((d) => d.healthy), ...week.map((d) => d.draining));

  /* ─── إجراءات ─── */
  const toggleToday = async (a: WellbeingActivity) => {
    if (typeof navigator !== "undefined" && "vibrate" in navigator) navigator.vibrate?.(8);
    await toggleWellbeingToday(a.id);
  };

  const openAddActivity = (kind: WellbeingActivity["kind"]) => {
    setActEditing(null);
    setActKind(kind);
    setActOpen(true);
  };

  const openEditActivity = (a: WellbeingActivity) => {
    setActEditing(a);
    setActKind(a.kind);
    setActOpen(true);
  };

  const openRule = (r: WellbeingRule | null) => {
    setRuleEditing(r);
    setRuleOpen(true);
  };

  const seedStarters = async () => {
    if (seeding) return;
    setSeeding(true);
    try {
      await Promise.all(STARTERS.map((s) => addWellbeingActivity({ ...s, archived: false })));
    } finally {
      setSeeding(false);
    }
  };

  /* ─── الهيكل ─── */
  if (!data) {
    return (
      <div
        className="h-full overflow-y-auto sys-scroll px-4 pt-3 pb-28"
        aria-busy="true"
        aria-label="جارٍ تحميل العافية"
      >
        <div className="glass-soft mb-3 h-14 animate-pulse rounded-3xl" />
        <div className="glass-soft mb-3 h-36 animate-pulse rounded-3xl" />
        <div className="glass-soft mb-3 h-44 animate-pulse rounded-3xl" />
        <div className="glass-soft h-24 animate-pulse rounded-3xl" />
      </div>
    );
  }

  const weekAria = `رصيد آخر ٧ أيام: ${net >= 0 ? "+" : "−"}${Math.abs(net)} — ${totalHealthy} تغذية و${totalDraining} استنزاف`;

  return (
    <div className="h-full overflow-y-auto sys-scroll px-4 pt-3 pb-28">
      {/* ═══ الترويسة ═══ */}
      <motion.header {...widgetEnter(0)} className="mb-3 flex items-center justify-between gap-2 px-1">
        <div className="min-w-0">
          <h1 className="text-[22px] font-bold leading-tight">العافية والدوبامين</h1>
          <p className="mt-0.5 truncate text-[11px] text-muted-foreground">
            ما يغذّيك مقابل ما يستنزفك — ورصيد أسبوعك الصافي
          </p>
        </div>
        <motion.button
          type="button"
          whileTap={{ scale: 0.9 }}
          onClick={() => openAddActivity("healthy")}
          className="flex h-11 w-11 shrink-0 items-center justify-center rounded-2xl border border-primary/40 bg-primary/15 text-primary transition-colors hover:bg-primary/25"
          aria-label="إضافة نشاط عافية"
        >
          <Plus className="h-5 w-5" strokeWidth={2.4} aria-hidden="true" />
        </motion.button>
      </motion.header>

      {/* ═══ بداية نظيفة — مقترحات فورية ═══ */}
      {activities.length === 0 ? (
        <motion.div {...widgetEnter(0.05)}>
          <GlassCard className="p-2">
            <EmptyState
              icon={<Leaf className="h-6 w-6" />}
              title="لا أنشطة بعد"
              hint="أضِف ما يغذّيك (قراءة، رياضة) وما يستنزفك (سوشيال، سهر) — أو ابدأ بثلاثة مقترحات جاهزة وسجّلها بنقرة كل يوم"
              actionLabel={seeding ? "جارٍ الإضافة…" : "ابدأ بثلاثة مقترحات"}
              onAction={() => void seedStarters()}
            />
          </GlassCard>
        </motion.div>
      ) : (
        <>
          {/* ═══ رصيد الأسبوع — مخطط أعمدة متفرّع ═══ */}
          <motion.div {...widgetEnter(0.05)} className="mb-3">
            <GlassCard className="relative overflow-hidden p-4">
              {/* خيط الشريط — عنصر حقيقي أعلى بطاقة البطل (ribbon-hairline) */}
              <div
                className="absolute inset-x-[14%] top-0 h-0.5 rounded-full"
                style={{ background: RIBBON_GRAD, opacity: 0.9 }}
                aria-hidden="true"
              />

              <div className="flex items-end justify-between gap-3">
                <div className="min-w-0">
                  <p className="text-[12px] text-muted-foreground">رصيد الأسبوع</p>
                  <p
                    className={cn(
                      "num-display tabular mt-0.5 text-[30px] font-bold leading-none",
                      net > 0 ? "text-mint" : net < 0 ? "text-coral" : "text-foreground/80"
                    )}
                    aria-label={weekAria}
                  >
                    {net > 0 ? `+${net}` : net < 0 ? `−${Math.abs(net)}` : "٠"}
                  </p>
                </div>
                <p className="shrink-0 text-end text-[10.5px] leading-4 text-muted-foreground">
                  <span className="font-bold text-mint tabular">{totalHealthy}</span> تغذية
                  <span className="mx-1" aria-hidden="true">·</span>
                  <span className="font-bold text-coral tabular">{totalDraining}</span> استنزاف
                  <span className="block text-muted-foreground/70">آخر ٧ أيام</span>
                </p>
              </div>

              {/* الأعمدة: نعناعي فوق الخط، مرجاني تحته — اليوم مميز */}
              <div className="mt-3" role="img" aria-label={weekAria}>
                <div className="flex items-stretch justify-between gap-1">
                  {week.map((d, i) => {
                    const isToday = d.date === today;
                    const upH = d.healthy > 0 ? Math.max(5, Math.round((d.healthy / maxScale) * 26)) : 0;
                    const downH = d.draining > 0 ? Math.max(5, Math.round((d.draining / maxScale) * 26)) : 0;
                    return (
                      <div
                        key={d.date}
                        className={cn(
                          "flex min-w-0 flex-1 flex-col items-center gap-1 rounded-lg pt-1 pb-0.5",
                          isToday && "bg-primary/[0.07] ring-1 ring-primary/35"
                        )}
                      >
                        <div className="flex h-[26px] w-full max-w-[26px] flex-col justify-end">
                          <motion.div
                            className="w-full rounded-t-[4px]"
                            style={{ background: "linear-gradient(to top, rgba(110,231,168,0.35), #6EE7A8)" }}
                            initial={{ height: 0 }}
                            animate={{ height: upH }}
                            transition={{ duration: 0.5, delay: 0.06 + i * 0.04, ease: [0.22, 1, 0.36, 1] }}
                          />
                        </div>
                        <div className="h-px w-full max-w-[26px] bg-white/[0.12]" aria-hidden="true" />
                        <div className="flex h-[26px] w-full max-w-[26px] flex-col justify-start">
                          <motion.div
                            className="w-full rounded-b-[4px]"
                            style={{ background: "linear-gradient(to bottom, rgba(255,142,122,0.4), #FF8E7A)" }}
                            initial={{ height: 0 }}
                            animate={{ height: downH }}
                            transition={{ duration: 0.5, delay: 0.08 + i * 0.04, ease: [0.22, 1, 0.36, 1] }}
                          />
                        </div>
                        <span
                          className={cn(
                            "text-[9px] leading-none",
                            isToday ? "font-bold text-primary" : "text-muted-foreground/70"
                          )}
                        >
                          {DAY_LETTERS[fromISODate(d.date).getDay()]}
                        </span>
                      </div>
                    );
                  })}
                </div>
              </div>
              <p className="mt-2 text-center text-[10px] text-muted-foreground/70">
                كل نقرة على نشاط تحسب: تغذية فوق الخط واستنزاف تحته
              </p>
            </GlassCard>
          </motion.div>

          {/* ═══ أنشطة تغذّيك ═══ */}
          <SectionHeader
            title="أنشطة تغذّيك"
            icon={<Leaf className="h-4 w-4 text-mint" aria-hidden="true" />}
            action="+ نشاط"
            onAction={() => openAddActivity("healthy")}
          />
          {healthy.length === 0 ? (
            <GlassCard className="mb-3 p-2">
              <EmptyState
                compact
                icon={<Leaf className="h-6 w-6" />}
                title="لا أنشطة تغذّيك بعد"
                hint="مشي، قراءة، جلسة هادئة — أضِف ما يجدد طاقتك"
                actionLabel="أضف نشاطاً يغذّيك"
                onAction={() => openAddActivity("healthy")}
              />
            </GlassCard>
          ) : (
            <motion.div {...widgetEnter(0.1)} className="mb-3">
              <GlassCard>
                {healthy.map((a) => (
                  <ActivityRow
                    key={a.id}
                    activity={a}
                    logged={loggedToday.has(a.id)}
                    onToggle={() => void toggleToday(a)}
                    onEdit={() => openEditActivity(a)}
                  />
                ))}
              </GlassCard>
            </motion.div>
          )}

          {/* ═══ أنشطة تستنزفك ═══ */}
          <SectionHeader
            title="أنشطة تستنزفك"
            icon={<Hourglass className="h-4 w-4 text-coral" aria-hidden="true" />}
            action="+ نشاط"
            onAction={() => openAddActivity("draining")}
          />
          {draining.length === 0 ? (
            <GlassCard className="p-2">
              <EmptyState
                compact
                icon={<Hourglass className="h-6 w-6" />}
                title="لا أنشطة تستنزفك بعد"
                hint="سجّلها بصدق — تمرير بلا هدف، سهر، مقارنات… الوعي أول خطوة"
                actionLabel="أضف نشاطاً يستنزفك"
                onAction={() => openAddActivity("draining")}
              />
            </GlassCard>
          ) : (
            <motion.div {...widgetEnter(0.14)}>
              <GlassCard>
                {draining.map((a) => (
                  <ActivityRow
                    key={a.id}
                    activity={a}
                    logged={loggedToday.has(a.id)}
                    onToggle={() => void toggleToday(a)}
                    onEdit={() => openEditActivity(a)}
                  />
                ))}
              </GlassCard>
            </motion.div>
          )}
        </>
      )}

      {/* ═══ قواعد تضعها لنفسك ═══ */}
      <div className="mt-4">
        <SectionHeader
          title="قواعد تضعها لنفسك"
          icon={<ShieldCheck className="h-4 w-4 text-mint" aria-hidden="true" />}
          action="+ قاعدة"
          onAction={() => openRule(null)}
        />
        {rules.length === 0 ? (
          <GlassCard className="p-2">
            <EmptyState
              compact
              icon={<ShieldCheck className="h-6 w-6" />}
              title="لا قواعد بعد"
              hint="مثل: «لا هاتف بعد العاشرة» أو «مشي بعد كل جلسة طويلة» — وحدّد وقتاً ليذكّرك المحرك المحلي"
              actionLabel="أضف قاعدتك الأولى"
              onAction={() => openRule(null)}
            />
          </GlassCard>
        ) : (
          <motion.div {...widgetEnter(0.18)}>
            <GlassCard>
              {rules.map((r) => (
                <div
                  key={r.id}
                  role="button"
                  tabIndex={0}
                  onClick={() => openRule(r)}
                  onKeyDown={(e) => {
                    if (e.key === "Enter" || e.key === " ") {
                      e.preventDefault();
                      openRule(r);
                    }
                  }}
                  aria-label={`تعديل القاعدة: ${r.text}`}
                  className="flex min-h-11 cursor-pointer items-center gap-3 border-t border-white/[0.05] p-3 first:border-t-0 transition-colors hover:bg-white/[0.03]"
                >
                  <span
                    className={cn(
                      "flex h-9 w-9 shrink-0 items-center justify-center rounded-xl",
                      r.enabled ? "bg-mint/10 text-mint" : "glass-soft text-muted-foreground/60"
                    )}
                  >
                    <ShieldCheck className="h-[18px] w-[18px]" aria-hidden="true" />
                  </span>
                  <div className="min-w-0 flex-1">
                    <p className={cn("truncate text-[13px] font-semibold", !r.enabled && "text-muted-foreground")}>
                      {r.text}
                    </p>
                    <p className="mt-0.5 flex items-center gap-1 text-[10px] text-muted-foreground">
                      {r.remindAt ? (
                        <>
                          <Bell className="h-3 w-3 shrink-0" aria-hidden="true" />
                          <span className="tabular">تذكير {formatTimeAr(r.remindAt)}</span>
                        </>
                      ) : (
                        <span>بلا تذكير</span>
                      )}
                      <span className="mx-0.5" aria-hidden="true">·</span>
                      <span>{r.enabled ? "مفعّلة" : "موقوفة"}</span>
                    </p>
                  </div>
                  <span onClick={(e) => e.stopPropagation()} className="shrink-0">
                    <Switch
                      checked={r.enabled}
                      onCheckedChange={(v) => void updateWellbeingRule(r.id, { enabled: v })}
                      aria-label={`${r.enabled ? "إيقاف" : "تفعيل"} قاعدة ${r.text}`}
                    />
                  </span>
                </div>
              ))}
            </GlassCard>
          </motion.div>
        )}
      </div>

      {/* ═══ الحوارات ═══ */}
      <ActivityDialog
        open={actOpen}
        onOpenChange={setActOpen}
        editing={actEditing}
        defaultKind={actKind}
      />
      <RuleDialog open={ruleOpen} onOpenChange={setRuleOpen} editing={ruleEditing} />
    </div>
  );
}

/* ═══════════════ صف نشاط واحد ═══════════════ */

function ActivityRow({
  activity,
  logged,
  onToggle,
  onEdit,
}: {
  activity: WellbeingActivity;
  logged: boolean;
  onToggle: () => void;
  onEdit: () => void;
}) {
  const isHealthy = activity.kind === "healthy";
  const tint = isHealthy ? MINT : CORAL;
  return (
    <div className="flex items-center gap-2.5 border-t border-white/[0.05] p-3 first:border-t-0">
      <span
        className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl"
        style={{ background: `${tint}1c`, color: tint }}
      >
        <WbGlyph name={activity.icon} className="h-5 w-5" />
      </span>
      <div className="min-w-0 flex-1">
        <p className="truncate text-[13px] font-semibold">{activity.name}</p>
        <p className="mt-0.5 text-[10px]" style={{ color: `${tint}cc` }}>
          {isHealthy ? "يغذّيك" : "يستنزفك"}
        </p>
      </div>
      <button
        type="button"
        onClick={onEdit}
        aria-label={`تعديل ${activity.name}`}
        className={cn(
          "glass-soft flex h-11 w-11 shrink-0 items-center justify-center rounded-xl border border-white/[0.06] text-muted-foreground transition-colors hover:text-foreground",
          RIBBON_PRESS
        )}
      >
        <Pencil className="h-4 w-4" aria-hidden="true" />
      </button>
      <motion.button
        type="button"
        whileTap={{ scale: 0.88 }}
        onClick={onToggle}
        aria-pressed={logged}
        aria-label={`${logged ? "إلغاء تسجيل" : "تسجيل"} ${activity.name} اليوم`}
        className={cn(
          "flex h-11 w-11 shrink-0 items-center justify-center rounded-full border transition-colors",
          logged
            ? "border-mint bg-mint text-[#06281f]"
            : "border-white/[0.12] text-muted-foreground/40 hover:border-mint/40 hover:text-mint/70"
        )}
      >
        <Check className="h-5 w-5" strokeWidth={2.6} aria-hidden="true" />
      </motion.button>
    </div>
  );
}

/* ═══════════════ حوار نشاط (إضافة/تعديل/حذف) ═══════════════ */

function ActivityDialog({
  open,
  onOpenChange,
  editing,
  defaultKind,
}: {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  editing: WellbeingActivity | null;
  defaultKind: WellbeingActivity["kind"];
}) {
  const [name, setName] = useState("");
  const [kind, setKind] = useState<WellbeingActivity["kind"]>("healthy");
  const [icon, setIcon] = useState("footprints");
  const [busy, setBusy] = useState(false);
  const [confirmDelete, setConfirmDelete] = useState(false);

  useEffect(() => {
    if (!open) return;
    setName(editing?.name ?? "");
    setKind(editing?.kind ?? defaultKind);
    setIcon(editing?.icon?.toLowerCase() ?? "footprints");
    setConfirmDelete(false);
  }, [open, editing, defaultKind]);

  const canSave = name.trim().length > 0;
  const tint = kind === "healthy" ? MINT : CORAL;

  const save = async () => {
    if (!canSave || busy) return;
    setBusy(true);
    try {
      const payload = { name: name.trim(), kind, icon: icon.toLowerCase(), archived: false };
      if (editing) await updateWellbeingActivity(editing.id, payload);
      else await addWellbeingActivity(payload);
      onOpenChange(false);
    } finally {
      setBusy(false);
    }
  };

  const doDelete = async () => {
    if (!editing) return;
    setBusy(true);
    try {
      await deleteWellbeingActivity(editing.id);
      setConfirmDelete(false);
      onOpenChange(false);
    } finally {
      setBusy(false);
    }
  };

  return (
    <Drawer open={open} onOpenChange={onOpenChange}>
      <DrawerContent
        dir="rtl"
        className="mx-auto max-w-md rounded-t-3xl border-white/10 bg-[#0B0F1A]/95 backdrop-blur-2xl"
      >
        <div className="mx-10 h-0.5 rounded-full" style={{ background: RIBBON_GRAD }} aria-hidden="true" />
        <DrawerHeader className="pb-1">
          <DrawerTitle className="text-right text-[15px] font-bold">
            {editing ? "تعديل النشاط" : "نشاط عافية جديد"}
          </DrawerTitle>
          <DrawerDescription className="text-right text-[11px]">
            حدده بنفسك — وسجّله بنقرة واحدة كل يوم
          </DrawerDescription>
        </DrawerHeader>

        <div className="sys-scroll max-h-[72vh] space-y-4 overflow-y-auto px-4 pb-4 pt-2">
          <Field label="اسم النشاط">
            <input
              value={name}
              onChange={(e) => setName(e.target.value)}
              placeholder="مثال: مشي ٢٠ دقيقة · تمرير بلا هدف"
              maxLength={40}
              className={inputCls}
              aria-label="اسم النشاط"
            />
          </Field>

          <ChipRow
            label="أثره عليك"
            options={[
              { k: "healthy", v: "يغذّيك" },
              { k: "draining", v: "يستنزفك" },
            ]}
            value={kind}
            onSelect={(k) => setKind(k === "draining" ? "draining" : "healthy")}
            small
          />

          <Field label="الأيقونة">
            <div className="space-y-2">
              <div
                className="flex h-11 items-center gap-2.5 rounded-xl px-3.5"
                style={{ background: `${tint}12`, border: `1px solid ${tint}30` }}
                aria-hidden="true"
              >
                <span className="flex h-8 w-8 items-center justify-center rounded-lg" style={{ background: `${tint}1f`, color: tint }}>
                  {createElement(iconByName(icon), { className: "h-4 w-4" })}
                </span>
                <span className="text-[11.5px] font-medium" style={{ color: tint }}>
                  {kind === "healthy" ? "يظهر في قائمة التغذية" : "يظهر في قائمة الاستنزاف"}
                </span>
              </div>
              <IconGrid value={icon} onChange={(i) => setIcon(i.toLowerCase())} choices={WB_ICON_CHOICES} />
            </div>
          </Field>

          <FormShell onSave={() => void save()} busy={busy} saveLabel={editing ? "حفظ التعديل" : "إضافة النشاط"}>
            {editing && !confirmDelete && (
              <button
                type="button"
                onClick={() => setConfirmDelete(true)}
                disabled={busy}
                className="h-12 w-full rounded-2xl border border-coral/40 text-[12.5px] font-bold text-coral transition-colors hover:bg-coral/10 disabled:opacity-50"
              >
                حذف النشاط
              </button>
            )}
            {editing && confirmDelete && (
              <ConfirmBar
                message={`حذف «${editing.name}» مع سجلاته كلها؟ لا يمكن التراجع.`}
                confirmLabel="حذف نهائي"
                onConfirm={() => void doDelete()}
                onCancel={() => setConfirmDelete(false)}
              />
            )}
          </FormShell>
        </div>
      </DrawerContent>
    </Drawer>
  );
}

/* ═══════════════ حوار قاعدة (إضافة/تعديل/حذف) ═══════════════ */

function RuleDialog({
  open,
  onOpenChange,
  editing,
}: {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  editing: WellbeingRule | null;
}) {
  const [text, setText] = useState("");
  const [time, setTime] = useState("");
  const [enabled, setEnabled] = useState(true);
  const [busy, setBusy] = useState(false);
  const [confirmDelete, setConfirmDelete] = useState(false);

  useEffect(() => {
    if (!open) return;
    setText(editing?.text ?? "");
    setTime(editing?.remindAt ?? "");
    setEnabled(editing?.enabled ?? true);
    setConfirmDelete(false);
  }, [open, editing]);

  const canSave = text.trim().length > 0;

  const save = async () => {
    if (!canSave || busy) return;
    setBusy(true);
    try {
      const remindAt = /^\d{2}:\d{2}$/.test(time) ? time : undefined;
      const payload = { text: text.trim(), remindAt, enabled };
      if (editing) await updateWellbeingRule(editing.id, payload);
      else await addWellbeingRule(payload);
      onOpenChange(false);
    } finally {
      setBusy(false);
    }
  };

  const doDelete = async () => {
    if (!editing) return;
    setBusy(true);
    try {
      await deleteWellbeingRule(editing.id);
      setConfirmDelete(false);
      onOpenChange(false);
    } finally {
      setBusy(false);
    }
  };

  return (
    <Drawer open={open} onOpenChange={onOpenChange}>
      <DrawerContent
        dir="rtl"
        className="mx-auto max-w-md rounded-t-3xl border-white/10 bg-[#0B0F1A]/95 backdrop-blur-2xl"
      >
        <div className="mx-10 h-0.5 rounded-full" style={{ background: RIBBON_GRAD }} aria-hidden="true" />
        <DrawerHeader className="pb-1">
          <DrawerTitle className="text-right text-[15px] font-bold">
            {editing ? "تعديل القاعدة" : "قاعدة جديدة لنفسك"}
          </DrawerTitle>
          <DrawerDescription className="text-right text-[11px]">
            حدّد وقتاً ليذكّرك محرك التذكيرات المحلي — لا مزامنة ولا سحابة
          </DrawerDescription>
        </DrawerHeader>

        <div className="sys-scroll max-h-[72vh] space-y-4 overflow-y-auto px-4 pb-4 pt-2">
          <Field label="نص القاعدة">
            <input
              value={text}
              onChange={(e) => setText(e.target.value)}
              placeholder="مثال: لا هاتف بعد العاشرة مساءً"
              maxLength={80}
              className={inputCls}
              aria-label="نص القاعدة"
            />
          </Field>

          <Field label="وقت التذكير (اختياري)" hint="القاعدة ذات وقت تُجدول عبر محرك تذكيرات التطبيق نفسه">
            <div className="space-y-2">
              <div className="flex flex-wrap gap-2" role="group" aria-label="أوقات التذكير المقترحة">
                {RULE_TIME_PRESETS.map((p) => (
                  <button
                    key={p.time}
                    type="button"
                    onClick={() => setTime(p.time)}
                    aria-pressed={time === p.time}
                    className={cn(
                      "h-10 rounded-xl border px-3.5 text-[12px] font-bold transition-colors",
                      time === p.time
                        ? "border-primary/60 bg-primary/20 text-primary"
                        : "glass-soft border-white/[0.08] text-foreground/80 hover:bg-white/[0.06]"
                    )}
                  >
                    {p.label}
                  </button>
                ))}
              </div>
              <div className="flex items-center gap-2.5">
                <input
                  type="time"
                  value={time}
                  onChange={(e) => setTime(e.target.value)}
                  className={cn(inputCls, "tabular flex-1")}
                  aria-label="وقت التذكير"
                />
                {time && (
                  <button
                    type="button"
                    onClick={() => setTime("")}
                    className="h-12 shrink-0 rounded-xl px-3 text-[11px] font-medium text-muted-foreground transition-colors hover:text-foreground"
                    aria-label="إزالة وقت التذكير"
                  >
                    مسح
                  </button>
                )}
              </div>
            </div>
          </Field>

          <div className="flex h-14 items-center justify-between gap-3 rounded-xl glass-soft px-4">
            <div className="min-w-0">
              <p className="text-[13px] font-medium">القاعدة مفعّلة</p>
              <p className="text-[10px] leading-tight text-muted-foreground">
                إيقافها يلغي تذكيرها المجدول فوراً
              </p>
            </div>
            <Switch checked={enabled} onCheckedChange={setEnabled} aria-label="تفعيل القاعدة" />
          </div>

          <FormShell onSave={() => void save()} busy={busy} saveLabel={editing ? "حفظ التعديل" : "إضافة القاعدة"}>
            {editing && !confirmDelete && (
              <button
                type="button"
                onClick={() => setConfirmDelete(true)}
                disabled={busy}
                className="h-12 w-full rounded-2xl border border-coral/40 text-[12.5px] font-bold text-coral transition-colors hover:bg-coral/10 disabled:opacity-50"
              >
                حذف القاعدة
              </button>
            )}
            {editing && confirmDelete && (
              <ConfirmBar
                message={`حذف قاعدة «${editing.text}» مع تذكيرها المجدول؟`}
                confirmLabel="حذف نهائي"
                onConfirm={() => void doDelete()}
                onCancel={() => setConfirmDelete(false)}
              />
            )}
          </FormShell>
        </div>
      </DrawerContent>
    </Drawer>
  );
}
