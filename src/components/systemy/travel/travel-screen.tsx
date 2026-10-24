"use client";

/**
 * Systemy v3 — شاشة السفر والتجارب (التنفيذ الكامل)
 * بطل: الرحلات القادمة عدداً + إجمالي ميزانياتها + مصاريفها المرتبطة (PrivateAmount)
 * + بطاقات رحلات بشريط تقدم الميزانية وحوار تفاصيل واسع (تجهيز/برنامج/مصاريف/مهام).
 * القراءة useLive واحدة — كل الكتابة عبر actions.
 */

import { useMemo, useState } from "react";
import { AnimatePresence, motion } from "framer-motion";
import { CalendarDays, History, MapPin, Plane, Plus } from "lucide-react";
import { Skeleton } from "@/components/ui/skeleton";
import { Chip, GlassCard, PrivateAmount, SectionHeader, widgetEnter } from "@/components/systemy/glass";
import { EmptyState } from "@/components/systemy/ui-bits";
import { db, getSettings, useLive } from "@/lib/db";
import type { ListItem, Settings, Task, TimeBlock, Transaction, Trip } from "@/lib/types";
import { diffDays, formatDate, formatMoney, formatNumber, todayISO } from "@/lib/format";
import { useUIStore } from "@/store/ui-store";
import { cn } from "@/lib/utils";
import { TripDetailsDialog, TripStatusChip } from "./trip-details-dialog";
import { TripFormDialog } from "./trip-form-dialog";

/* ═══ حزمة البيات — قراءة تفاعلية واحدة ═══ */
interface TravelData {
  trips: Trip[];
  listItems: ListItem[];
  blocks: TimeBlock[];
  transactions: Transaction[];
  tasks: Task[];
  settings: Settings;
}

/* ═══ بطاقة رحلة ═══ */
function TripCard({
  trip,
  spent,
  currency,
  delay,
  onOpen,
}: {
  trip: Trip;
  spent: number;
  currency: string;
  delay: number;
  onOpen: () => void;
}) {
  const budget = trip.budget;
  const pct = budget > 0 ? Math.min(100, Math.round((spent / budget) * 100)) : spent > 0 ? 100 : 0;
  const over = budget > 0 && spent > budget;
  const days = diffDays(trip.startDate, trip.endDate) + 1;
  const datesLabel =
    trip.startDate === trip.endDate
      ? formatDate(trip.startDate)
      : `${formatDate(trip.startDate)} — ${formatDate(trip.endDate)}`;

  return (
    <motion.div
      layout
      initial={{ opacity: 0, y: 10 }}
      animate={{ opacity: 1, y: 0 }}
      exit={{ opacity: 0, scale: 0.96 }}
      transition={{ duration: 0.24, delay, ease: [0.22, 1, 0.36, 1] }}
      onClick={onOpen}
      onKeyDown={(e) => {
        if (e.key === "Enter" || e.key === " ") {
          e.preventDefault();
          onOpen();
        }
      }}
      role="button"
      tabIndex={0}
      aria-label={`فتح رحلة: ${trip.name} إلى ${trip.destination}`}
      className="glass cursor-pointer rounded-2xl p-3.5 outline-none transition-all duration-200 hover:bg-white/[0.07] hover:scale-[1.01] active:scale-[0.99] focus-visible:ring-2 focus-visible:ring-primary/40"
    >
      <div className="flex items-start justify-between gap-2">
        <div className="flex min-w-0 items-start gap-3">
          <span
            className="flex h-10 w-10 shrink-0 items-center justify-center rounded-2xl bg-primary/10 text-primary"
            aria-hidden="true"
          >
            <Plane className="h-5 w-5" />
          </span>
          <div className="min-w-0">
            <h3 className="truncate text-[13.5px] font-semibold leading-snug">{trip.name}</h3>
            <div className="mt-1.5 flex flex-wrap items-center gap-1.5">
              <Chip className="text-primary">
                <MapPin className="w-3 h-3" aria-hidden="true" />
                {trip.destination}
              </Chip>
              <Chip className="text-muted-foreground">{datesLabel}</Chip>
              <Chip className="text-muted-foreground tabular">
                {formatNumber(days)} {days === 1 ? "يوم" : "أيام"}
              </Chip>
            </div>
          </div>
        </div>
        <TripStatusChip status={trip.status} />
      </div>

      {(budget > 0 || spent > 0) && (
        <div className="mt-3">
          <div className="mb-1.5 flex items-center justify-between">
            <span className="text-[10.5px] text-muted-foreground">
              {budget > 0 ? "الميزانية" : "المصاريف المرتبطة"}
            </span>
            <PrivateAmount className="text-[11px] font-semibold">
              {budget > 0 ? (
                <>
                  <span className={cn(over ? "text-coral" : "text-foreground")}>{formatMoney(spent, currency)}</span>
                  <span className="font-normal text-muted-foreground"> من {formatMoney(budget, currency)}</span>
                </>
              ) : (
                <span className="text-foreground">{formatMoney(spent, currency)}</span>
              )}
            </PrivateAmount>
          </div>
          <div
            className="h-1.5 overflow-hidden rounded-full bg-white/[0.06]"
            role="progressbar"
            aria-valuenow={pct}
            aria-valuemin={0}
            aria-valuemax={100}
            aria-label={`استهلاك ميزانية ${trip.name}: ${pct}%`}
          >
            <motion.div
              className={cn("h-full rounded-full", over ? "bg-coral" : pct >= 75 ? "bg-gold" : "bg-mint")}
              initial={false}
              animate={{ width: `${Math.max(pct, 2)}%` }}
              transition={{ type: "spring", stiffness: 120, damping: 20 }}
            />
          </div>
          {over && (
            <p className="mt-1 text-[10.5px] font-bold text-coral">
              تجاوزت الميزانية بـ {formatMoney(spent - budget, currency)}
            </p>
          )}
        </div>
      )}
    </motion.div>
  );
}

/* ═══ هيكل التحميل ═══ */
function TravelSkeleton() {
  return (
    <div className="h-full overflow-y-auto sys-scroll px-4 pt-3 pb-28">
      <div className="mb-4 space-y-2">
        <Skeleton className="h-7 w-40 rounded-lg bg-white/[0.06]" />
        <Skeleton className="h-3.5 w-56 rounded-md bg-white/[0.06]" />
      </div>
      <Skeleton className="mb-3 h-[120px] rounded-3xl bg-white/[0.05]" />
      <div className="space-y-3">
        <Skeleton className="h-[128px] rounded-2xl bg-white/[0.06]" />
        <Skeleton className="h-[128px] rounded-2xl bg-white/[0.06]" />
      </div>
    </div>
  );
}

/* ═══ الشاشة ═══ */
export function TravelScreen() {
  const goToCalendar = useUIStore((s) => s.goToCalendar);

  const [addOpen, setAddOpen] = useState(false);
  const [formOpen, setFormOpen] = useState(false);
  const [formTrip, setFormTrip] = useState<Trip | null>(null);
  const [detailsTripId, setDetailsTripId] = useState<string | null>(null);

  /* ─── القراءة التفاعلية الوحيدة ─── */
  const data = useLive(async (): Promise<TravelData> => {
    const [trips, listItems, blocks, transactions, tasks, settings] = await Promise.all([
      db.trips.toArray(),
      db.listItems.toArray(),
      db.blocks.toArray(),
      db.transactions.toArray(),
      db.tasks.toArray(),
      getSettings(),
    ]);
    return { trips, listItems, blocks, transactions, tasks, settings };
  }, []);

  const today = todayISO();
  const currency = data?.settings.currency ?? "ر.س";

  /* ─── المشتقات ─── */
  /** مصاريف كل رحلة (expense فقط) — الأحدث أولاً */
  const expensesByTrip = useMemo(() => {
    const m = new Map<string, Transaction[]>();
    for (const t of data?.transactions ?? []) {
      if (t.type !== "expense" || !t.tripId) continue;
      const arr = m.get(t.tripId);
      if (arr) arr.push(t);
      else m.set(t.tripId, [t]);
    }
    for (const arr of m.values()) {
      arr.sort((a, b) => b.date.localeCompare(a.date) || b.createdAt.localeCompare(a.createdAt));
    }
    return m;
  }, [data]);

  const spentOf = (tripId: string) =>
    (expensesByTrip.get(tripId) ?? []).reduce((a, t) => a + t.amount, 0);

  const tripsArr = useMemo(() => data?.trips ?? [], [data]);

  /** القادمة: ليست منتهية وتنتهي اليوم أو بعده (تشمل الجارية ضمن فترتها) */
  const upcoming = useMemo(
    () =>
      tripsArr
        .filter((t) => t.status !== "done" && t.endDate >= today)
        .sort((a, b) => a.startDate.localeCompare(b.startDate)),
    [tripsArr, today]
  );

  /** السابقة: منتهية أو فاتت فترتها */
  const past = useMemo(
    () =>
      tripsArr
        .filter((t) => t.status === "done" || t.endDate < today)
        .sort((a, b) => b.endDate.localeCompare(a.endDate)),
    [tripsArr, today]
  );

  const upcomingBudget = upcoming.reduce((a, t) => a + t.budget, 0);
  const upcomingSpent = upcoming.reduce((a, t) => a + spentOf(t.id), 0);
  const nearest = upcoming[0] ?? null;

  const detailsTrip = detailsTripId ? tripsArr.find((t) => t.id === detailsTripId) ?? null : null;

  if (!data) return <TravelSkeleton />;

  return (
    <div className="h-full overflow-y-auto sys-scroll px-4 pt-3 pb-28">
      {/* ═══ الرأس ═══ */}
      <header className="mb-4">
        <div className="flex items-center justify-between gap-2">
          <div>
            <h1 className="text-[22px] font-bold leading-tight">السفر والتجارب</h1>
            <p className="mt-0.5 text-[12px] text-muted-foreground">رحلات بميزانية وبرنامج وقائمة تجهيز</p>
          </div>
          <div className="flex shrink-0 items-center gap-2">
            <button
              type="button"
              onClick={() => goToCalendar()}
              aria-label="فتح التقويم"
              title="التقويم"
              className="glass flex h-11 w-11 items-center justify-center rounded-2xl text-muted-foreground transition-all duration-200 hover:bg-white/[0.09] hover:text-foreground active:scale-95"
            >
              <CalendarDays className="h-5 w-5" />
            </button>
            <motion.button
              type="button"
              whileTap={{ scale: 0.9 }}
              onClick={() => setAddOpen(true)}
              className="flex h-11 w-11 items-center justify-center rounded-2xl border border-primary/40 bg-primary/15 text-primary transition-colors hover:bg-primary/25"
              aria-label="إضافة رحلة"
            >
              <Plus className="h-5 w-5" strokeWidth={2.4} aria-hidden="true" />
            </motion.button>
          </div>
        </div>
      </header>

      {/* ═══ بداية نظيفة ═══ */}
      {tripsArr.length === 0 && (
        <motion.div {...widgetEnter(0.05)}>
          <GlassCard className="p-2">
            <EmptyState
              icon={<Plane className="h-6 w-6" />}
              title="خطّط رحلتك الأولى — ميزانية وقائمة تجهيز"
              hint="قائمة تجهيز، برنامج أحداث، ومصاريف تُقاس مقابل الميزانية — كلها تترابط مع التقويم والمال"
              actionLabel="خطّط رحلة"
              onAction={() => setAddOpen(true)}
            />
          </GlassCard>
        </motion.div>
      )}

      {/* ═══ البطل: الرحلات القادمة ═══ */}
      {tripsArr.length > 0 && (
        <motion.div {...widgetEnter(0.05)} className="mb-3">
          <GlassCard className="p-4">
            <div className="flex items-center justify-between">
              <span className="text-[12px] text-muted-foreground">الرحلات القادمة</span>
              {nearest ? (
                <Chip className="text-mint">أقربها {formatDate(nearest.startDate)}</Chip>
              ) : (
                <Chip className="text-muted-foreground">لا شيء قادم بعد</Chip>
              )}
            </div>
            <div className="mt-1.5 flex items-end gap-2">
              <span className="text-[34px] font-bold leading-none tabular">{formatNumber(upcoming.length)}</span>
              <span className="pb-1 text-[11px] text-muted-foreground">رحلة</span>
            </div>
            <div className="mt-3 grid grid-cols-2 gap-2">
              <div className="rounded-2xl glass-soft p-3">
                <p className="text-[10.5px] text-muted-foreground">إجمالي الميزانيات</p>
                <PrivateAmount className="mt-0.5 block text-[15px] font-bold">
                  {formatMoney(upcomingBudget, currency)}
                </PrivateAmount>
              </div>
              <div className="rounded-2xl glass-soft p-3">
                <p className="text-[10.5px] text-muted-foreground">مصاريف مرتبطة</p>
                <PrivateAmount
                  className={cn(
                    "mt-0.5 block text-[15px] font-bold",
                    upcomingBudget > 0 && upcomingSpent > upcomingBudget ? "text-coral" : "text-foreground"
                  )}
                >
                  {formatMoney(upcomingSpent, currency)}
                </PrivateAmount>
              </div>
            </div>
          </GlassCard>
        </motion.div>
      )}

      {/* ═══ الرحلات القادمة ═══ */}
      {upcoming.length > 0 && (
        <section className="mb-4">
          <SectionHeader
            title="القادمة"
            icon={<Plane className="h-3.5 w-3.5 text-primary" aria-hidden="true" />}
            action="التقويم"
            onAction={() => goToCalendar()}
          />
          <div className="space-y-3">
            <AnimatePresence initial={false}>
              {upcoming.map((trip, idx) => (
                <TripCard
                  key={trip.id}
                  trip={trip}
                  spent={spentOf(trip.id)}
                  currency={currency}
                  delay={Math.min(idx * 0.04, 0.3)}
                  onOpen={() => setDetailsTripId(trip.id)}
                />
              ))}
            </AnimatePresence>
          </div>
        </section>
      )}

      {/* ═══ رحلات سابقة ═══ */}
      {past.length > 0 && (
        <section className="mb-4">
          <SectionHeader
            title="سابقة"
            icon={<History className="h-3.5 w-3.5 text-muted-foreground" aria-hidden="true" />}
          />
          <div className="space-y-3">
            <AnimatePresence initial={false}>
              {past.map((trip, idx) => (
                <TripCard
                  key={trip.id}
                  trip={trip}
                  spent={spentOf(trip.id)}
                  currency={currency}
                  delay={Math.min(idx * 0.04, 0.3)}
                  onOpen={() => setDetailsTripId(trip.id)}
                />
              ))}
            </AnimatePresence>
          </div>
        </section>
      )}

      {/* ═══ دعوة تخطيط عند غياب القادمة ═══ */}
      {tripsArr.length > 0 && upcoming.length === 0 && (
        <motion.div {...widgetEnter(0.12)} className="mb-4">
          <GlassCard className="p-2">
            <EmptyState
              compact
              icon={<Plane className="h-5 w-5" />}
              title="لا رحلات قادمة بعد"
              hint="خطّط رحلتك التالية — ميزانية وقائمة تجهيز وبرنامج"
              actionLabel="خطّط رحلة"
              onAction={() => setAddOpen(true)}
            />
          </GlassCard>
        </motion.div>
      )}

      {/* ═══ حوار التفاصيل ═══ */}
      <TripDetailsDialog
        open={detailsTrip != null}
        onOpenChange={(o) => {
          if (!o) setDetailsTripId(null);
        }}
        trip={detailsTrip}
        items={
          detailsTrip
            ? (data.listItems ?? []).filter((i) => i.scope === "trip" && i.ownerId === detailsTrip.id)
            : []
        }
        blocks={detailsTrip ? data.blocks.filter((b) => b.tripId === detailsTrip.id) : []}
        expenses={detailsTrip ? expensesByTrip.get(detailsTrip.id) ?? [] : []}
        tasks={detailsTrip ? data.tasks.filter((t) => t.tripId === detailsTrip.id) : []}
        currency={currency}
        onEdit={(t) => {
          setFormTrip(t);
          setFormOpen(true);
        }}
      />

      {/* ═══ حوار الإضافة / تعديل البيانات ═══ */}
      <TripFormDialog
        open={addOpen || formOpen}
        onOpenChange={(o) => {
          if (!o) {
            setAddOpen(false);
            setFormOpen(false);
            setFormTrip(null);
          }
        }}
        trip={formTrip}
      />
    </div>
  );
}
