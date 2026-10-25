"use client";

/**
 * Systemy v3 — شاشة الأشخاص والعلاقات (المدير الكامل)
 * بطل: عدد الأشخاص + من لم تواصلهم منذ 30+ يوماً + المفضلة.
 * قائمة بطاقات (حرف ملون + علاقة + آخر تواصل + نجمة) — والضغط يفتح ملف الشخص:
 * تواصل وتذكير، ديون بتسديد/استلام، معاملات مشتركة، مهام مرتبطة، عيد ميلاد ووسوم.
 * عرض بيانات مسجلة فقط — لا استنتاج ولا استيراد جهات اتصال.
 */

import { useMemo, useState } from "react";
import { motion } from "framer-motion";
import { ChevronLeft, Star, UserPlus, Users } from "lucide-react";
import { db, getSettings, useLive } from "@/lib/db";
import { updatePerson } from "@/lib/actions";
import { formatNumber, todayISO } from "@/lib/format";
import type { Person } from "@/lib/types";
import { Chip, GlassCard, widgetEnter } from "@/components/systemy/glass";
import { EmptyState } from "@/components/systemy/ui-bits";
import { cn } from "@/lib/utils";
import { PersonFormDialog } from "./person-form-dialog";
import { DebtFormDialog } from "./debt-form-dialog";
import { PersonDetailsDialog } from "./person-details-dialog";
import { avatarColor, daysSinceContact, initialOf, isStale } from "./shared";

export function PeopleScreen() {
  const settings = useLive(() => getSettings(), []);
  const people = useLive(() => db.people.toArray(), []);
  const debts = useLive(() => db.debts.toArray(), []);
  const transactions = useLive(() => db.transactions.orderBy("date").reverse().toArray(), []);
  const tasks = useLive(() => db.tasks.toArray(), []);
  const accounts = useLive(() => db.accounts.toArray(), []);

  const [detailsId, setDetailsId] = useState<string | null>(null);
  const [formPerson, setFormPerson] = useState<Person | null>(null);
  const [formOpen, setFormOpen] = useState(false);
  const [debtPerson, setDebtPerson] = useState<Person | null>(null);

  const today = todayISO();

  const sorted = useMemo(() => {
    if (!people) return [];
    return [...people].sort((a, b) => {
      if (a.favorite !== b.favorite) return a.favorite ? -1 : 1;
      const sa = a.lastContact ?? "0000-00-00";
      const sb = b.lastContact ?? "0000-00-00";
      if (sa !== sb) return sa.localeCompare(sb);
      return a.name.localeCompare(b.name, "ar");
    });
  }, [people]);

  const staleCount = useMemo(
    () => (people ?? []).filter((p) => isStale(p, today)).length,
    [people, today],
  );
  const favCount = useMemo(() => (people ?? []).filter((p) => p.favorite).length, [people]);

  const detailsPerson = detailsId ? (people ?? []).find((p) => p.id === detailsId) ?? null : null;

  const openForm = (p: Person | null) => {
    setFormPerson(p);
    setFormOpen(true);
  };

  const toggleFavorite = (p: Person) => {
    void updatePerson(p.id, { favorite: !p.favorite });
  };

  // ---------- تحميل ----------
  if (!people || !settings) {
    return (
      <div
        className="h-full overflow-y-auto sys-scroll px-4 pt-3 pb-28"
        aria-busy="true"
        aria-label="جارٍ تحميل الأشخاص"
      >
        <div className="glass-soft mb-3 h-14 animate-pulse rounded-3xl" />
        <div className="glass-soft mb-3 h-24 animate-pulse rounded-3xl" />
        <div className="glass-soft mb-3 h-16 animate-pulse rounded-3xl" />
        <div className="glass-soft h-16 animate-pulse rounded-3xl" />
      </div>
    );
  }

  return (
    <div className="h-full overflow-y-auto sys-scroll px-4 pt-3 pb-28">
      {/* ═══ الترويسة ═══ */}
      <motion.header {...widgetEnter(0)} className="mb-3 flex items-center justify-between gap-2 px-1">
        <div className="min-w-0">
          <h1 className="text-[22px] font-bold leading-tight">الأشخاص والعلاقات</h1>
          <p className="mt-0.5 text-[12px] text-muted-foreground">
            ملفات من تواصل معهم، وديونهم ومعاملاتهم — بياناتك المسجلة فقط
          </p>
        </div>
        <motion.button
          type="button"
          whileTap={{ scale: 0.9 }}
          onClick={() => openForm(null)}
          className="flex h-11 w-11 shrink-0 items-center justify-center rounded-2xl border border-primary/40 bg-primary/15 text-primary transition-colors hover:bg-primary/25"
          aria-label="إضافة شخص"
        >
          <UserPlus className="h-5 w-5" strokeWidth={2.2} aria-hidden="true" />
        </motion.button>
      </motion.header>

      {/* ═══ حالة فراغ ═══ */}
      {people.length === 0 ? (
        <motion.div {...widgetEnter(0.05)}>
          <GlassCard className="p-2">
            <EmptyState
              icon={<Users className="w-6 h-6" />}
              title="أضف أول شخص"
              hint="عائلة أو صديق أو عميل — سجّل تواصلك وديونك ومعاملاتك معه في ملف واحد"
              actionLabel="أضف شخصاً"
              onAction={() => openForm(null)}
            />
          </GlassCard>
        </motion.div>
      ) : (
        <>
          {/* ═══ البطل ═══ */}
          <motion.div {...widgetEnter(0.05)} className="mb-3">
            <GlassCard className="p-4">
              <div className="grid grid-cols-3 divide-x divide-x-reverse divide-black/[0.05]">
                <HeroStat label="شخص" value={formatNumber(people.length)} className="text-foreground" />
                <HeroStat label="لم تواصلهم منذ 30+ يوماً" value={formatNumber(staleCount)} className="text-gold" />
                <HeroStat label="مفضلة" value={formatNumber(favCount)} className="text-primary" />
              </div>
            </GlassCard>
          </motion.div>

          {/* ═══ قائمة الأشخاص ═══ */}
          <div className="space-y-2">
            {sorted.map((p, i) => (
              <motion.div key={p.id} {...widgetEnter(0.07 + i * 0.02)}>
                <GlassCard interactive onClick={() => setDetailsId(p.id)} className="p-4">
                  <div className="flex items-center gap-3">
                    <span
                      className="flex h-11 w-11 shrink-0 items-center justify-center rounded-full text-[16px] font-bold"
                      style={{ background: `${avatarColor(p.name)}26`, color: avatarColor(p.name) }}
                      aria-hidden="true"
                    >
                      {initialOf(p.name)}
                    </span>
                    <div className="min-w-0 flex-1">
                      <div className="flex items-center gap-2">
                        <span className="text-[13.5px] font-semibold truncate">{p.name}</span>
                        <Chip className="shrink-0 text-primary/90">{p.relation}</Chip>
                      </div>
                      <ContactLine person={p} today={today} />
                    </div>
                    <button
                      type="button"
                      onClick={(e) => {
                        e.stopPropagation();
                        toggleFavorite(p);
                      }}
                      aria-label={p.favorite ? `إزالة ${p.name} من المفضلة` : `تمييز ${p.name} بالمفضلة`}
                      aria-pressed={p.favorite}
                      className="flex h-11 w-11 shrink-0 items-center justify-center rounded-xl transition-colors hover:bg-black/[0.04]"
                    >
                      <Star
                        className={cn(
                          "h-5 w-5 transition-colors",
                          p.favorite ? "fill-gold text-gold" : "text-muted-foreground/60"
                        )}
                        aria-hidden="true"
                      />
                    </button>
                    <ChevronLeft className="h-4 w-4 shrink-0 text-muted-foreground/50" aria-hidden="true" />
                  </div>
                </GlassCard>
              </motion.div>
            ))}
          </div>
        </>
      )}

      {/* ═══ الحوارات ═══ */}
      {detailsPerson && (
        <PersonDetailsDialog
          person={detailsPerson}
          debts={debts ?? []}
          transactions={transactions ?? []}
          tasks={tasks ?? []}
          accounts={accounts ?? []}
          currency={settings.currency || "ر.س"}
          onClose={() => setDetailsId(null)}
          onEdit={(p) => {
            setDetailsId(null);
            openForm(p);
          }}
          onAddDebt={(p) => {
            setDetailsId(null);
            setDebtPerson(p);
          }}
        />
      )}

      {formOpen && (
        <PersonFormDialog
          person={formPerson}
          onClose={() => setFormOpen(false)}
        />
      )}

      {debtPerson && (
        <DebtFormDialog
          person={debtPerson}
          currency={settings.currency || "ر.س"}
          digits={settings.digits ?? "latn"}
          onClose={() => setDebtPerson(null)}
        />
      )}
    </div>
  );
}

/* ═══════════════════════ بطاقة إحصائية ═══════════════════════ */

function HeroStat({ label, value, className }: { label: string; value: string; className?: string }) {
  return (
    <div className="px-2 text-center">
      <p className={cn("num-display text-[24px] font-bold tabular", className)}>{value}</p>
      <p className="mt-1 text-[10px] leading-tight text-muted-foreground">{label}</p>
    </div>
  );
}

/* ═══════════════════════ سطر آخر تواصل ═══════════════════════ */

function ContactLine({ person, today }: { person: Person; today: string }) {
  const d = daysSinceContact(person, today);
  if (d === null) {
    return <span className="mt-0.5 block text-[11px] text-muted-foreground">آخر تواصل: لم يُسجل</span>;
  }
  if (d === 0) {
    return <span className="mt-0.5 block text-[11px] text-mint">آخر تواصل: اليوم</span>;
  }
  if (d === 1) {
    return <span className="mt-0.5 block text-[11px] text-muted-foreground">آخر تواصل: أمس</span>;
  }
  return (
    <span
      className={cn(
        "mt-0.5 block text-[11px] tabular",
        d > 30 ? "text-gold" : "text-muted-foreground"
      )}
    >
      آخر تواصل: منذ {formatNumber(d)} يوماً
    </span>
  );
}
