"use client";

/**
 * Systemy v3 — شاشة المستندات والخزانة (التنفيذ الكامل)
 * بطل إحصائي (العدد / تنتهي خلال 45 يوماً / منتهية) + فلاتر شرائح وبحث
 * + بطاقات بأيقونات نوع دلالية وشرائح انتهاء ذهبية/مرجالية.
 * الضغط يفتح حوار التفاصيل الكامل القابل للتعديل — كل الكتابة عبر actions.
 */

import { useMemo, useState, type ReactNode } from "react";
import { AnimatePresence, motion } from "framer-motion";
import {
  Award,
  BookUser,
  CarFront,
  Contact,
  FileQuestion,
  FileText,
  HeartPulse,
  Plus,
  Search,
  ShieldCheck,
  Star,
  X,
} from "lucide-react";
import { Input } from "@/components/ui/input";
import { Skeleton } from "@/components/ui/skeleton";
import { Chip, GlassCard, widgetEnter } from "@/components/systemy/glass";
import { EmptyState } from "@/components/systemy/ui-bits";
import { db, useLive } from "@/lib/db";
import { DOC_TYPE_LABELS, type DocType, type DocumentRecord } from "@/lib/types";
import { diffDays, formatDate, formatNumber, todayISO } from "@/lib/format";
import { cn } from "@/lib/utils";
import { DocumentFormDialog } from "./document-form-dialog";

/* ═══ ثوابت ═══ */

/** نافذة «تنتهي قريباً» بالأيام */
const SOON_DAYS = 45;

/** أيقونة ولون دلالي لكل نوع مستند */
const DOC_META: Record<DocType, { icon: typeof BookUser; color: string }> = {
  passport: { icon: BookUser, color: "#5CE1E6" },
  id: { icon: Contact, color: "#F5D565" },
  license: { icon: CarFront, color: "#8EC5FF" },
  contract: { icon: FileText, color: "#C08457" },
  warranty: { icon: ShieldCheck, color: "#6EE7A8" },
  certificate: { icon: Award, color: "#F5B95C" },
  medical: { icon: HeartPulse, color: "#FF8E7A" },
  other: { icon: FileQuestion, color: "#94A3B8" },
};

type FilterKey = "all" | "fav" | "soon";
const FILTERS: Array<{ key: FilterKey; label: string }> = [
  { key: "all", label: "الكل" },
  { key: "fav", label: "المفضلة" },
  { key: "soon", label: "تنتهي قريباً" },
];

/* ═══ شريحة ملوّنة مستقلة عن glass-soft ═══ */
function TintChip({
  tone,
  children,
}: {
  tone: "gold" | "coral" | "neutral";
  children: ReactNode;
}) {
  return (
    <span
      className={cn(
        "inline-flex shrink-0 items-center gap-1 rounded-full border px-2.5 py-0.5 text-[10.5px] font-semibold",
        tone === "gold" && "bg-gold/10 text-gold border-gold/25",
        tone === "coral" && "bg-coral/10 text-coral border-coral/25",
        tone === "neutral" && "bg-black/[0.03] text-muted-foreground border-black/[0.07]"
      )}
    >
      {children}
    </span>
  );
}

/** صف مستند مشتق: أيام الانتهاء محسوبة مرة واحدة */
interface DocRow {
  doc: DocumentRecord;
  days: number | null;
  expired: boolean;
  soon: boolean;
}

/** شريحة تاريخ الانتهاء — أحمر «منتهٍ» / ذهبي «بعد X يوماً» إن قرب */
function ExpiryChip({ row }: { row: DocRow }) {
  const { days, doc } = row;
  if (days == null) return <TintChip tone="neutral">بلا تاريخ انتهاء</TintChip>;
  if (days < 0) {
    return (
      <TintChip tone="coral">
        منتهٍ · متأخر {formatNumber(Math.abs(days))} يوماً
      </TintChip>
    );
  }
  if (days === 0) return <TintChip tone="gold">ينتهي اليوم</TintChip>;
  if (days === 1) return <TintChip tone="gold">بعد يوم واحد</TintChip>;
  if (days <= SOON_DAYS) return <TintChip tone="gold">بعد {formatNumber(days)} يوماً</TintChip>;
  return <TintChip tone="neutral">{formatDate(doc.expiryDate!, true)}</TintChip>;
}

/* ═══ بطاقة مستند ═══ */
function DocumentCard({
  row,
  delay,
  onOpen,
}: {
  row: DocRow;
  delay: number;
  onOpen: () => void;
}) {
  const { doc } = row;
  const meta = DOC_META[doc.type] ?? DOC_META.other;
  const Icon = meta.icon;
  const shortNumber = doc.number && doc.number.length > 10 ? `${doc.number.slice(0, 10)}…` : doc.number;

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
      aria-label={`فتح مستند: ${doc.title}`}
      className="glass rounded-2xl p-3.5 cursor-pointer outline-none transition-all duration-200 hover:bg-black/[0.04] hover:scale-[1.01] active:scale-[0.99] focus-visible:ring-2 focus-visible:ring-primary/40"
    >
      <div className="flex items-start gap-3">
        <span
          className="flex h-10 w-10 shrink-0 items-center justify-center rounded-2xl"
          style={{ backgroundColor: `${meta.color}1A`, color: meta.color }}
          aria-hidden="true"
        >
          <Icon className="h-5 w-5" />
        </span>
        <div className="min-w-0 flex-1">
          <div className="flex items-center gap-1.5">
            <h3 className="min-w-0 flex-1 truncate text-[13.5px] font-semibold leading-snug">{doc.title}</h3>
            {doc.favorite && (
              <Star className="h-3.5 w-3.5 shrink-0 fill-gold/30 text-gold" aria-label="مفضل" />
            )}
          </div>
          <div className="mt-1.5 flex flex-wrap items-center gap-1.5">
            <Chip className="text-muted-foreground">{DOC_TYPE_LABELS[doc.type]}</Chip>
            <ExpiryChip row={row} />
          </div>
          <p className="mt-1.5 truncate text-[10.5px] text-muted-foreground/80">
            {doc.issuer || "بلا جهة إصدار"}
            {shortNumber ? ` · رقم ${shortNumber}` : ""}
          </p>
        </div>
      </div>
    </motion.div>
  );
}

/* ═══ هيكل التحميل ═══ */
function VaultSkeleton() {
  return (
    <div className="h-full overflow-y-auto sys-scroll px-4 pt-3 pb-28">
      <div className="mb-4 space-y-2">
        <Skeleton className="h-7 w-48 rounded-lg bg-black/[0.04]" />
        <Skeleton className="h-3.5 w-56 rounded-md bg-black/[0.04]" />
      </div>
      <Skeleton className="mb-3 h-[96px] rounded-3xl bg-black/[0.03]" />
      <Skeleton className="mb-3 h-11 rounded-full bg-black/[0.03]" />
      <div className="space-y-3">
        <Skeleton className="h-[104px] rounded-2xl bg-black/[0.04]" />
        <Skeleton className="h-[104px] rounded-2xl bg-black/[0.04]" />
        <Skeleton className="h-[104px] rounded-2xl bg-black/[0.04]" />
      </div>
    </div>
  );
}

/* ═══ الشاشة ═══ */
export function VaultScreen() {
  const documents = useLive(() => db.documents.toArray(), []);

  const [filter, setFilter] = useState<FilterKey>("all");
  const [q, setQ] = useState("");
  const [addOpen, setAddOpen] = useState(false);
  const [editDoc, setEditDoc] = useState<DocumentRecord | null>(null);

  const today = todayISO();

  /* ─── المشتقات ─── */
  const rows = useMemo<DocRow[]>(() => {
    const list = (documents ?? []).map((d): DocRow => {
      const days = d.expiryDate ? diffDays(today, d.expiryDate) : null;
      return {
        doc: d,
        days,
        expired: days != null && days < 0,
        soon: days != null && days >= 0 && days <= SOON_DAYS,
      };
    });
    const rank = (r: DocRow) => (r.expired ? 0 : r.soon ? 1 : r.days != null ? 2 : 3);
    return list.sort((a, b) => {
      const ra = rank(a);
      const rb = rank(b);
      if (ra !== rb) return ra - rb;
      if (ra < 3) {
        const da = a.days ?? Number.POSITIVE_INFINITY;
        const dbv = b.days ?? Number.POSITIVE_INFINITY;
        if (da !== dbv) return da - dbv;
      }
      if (a.doc.favorite !== b.doc.favorite) return a.doc.favorite ? -1 : 1;
      return b.doc.createdAt.localeCompare(a.doc.createdAt);
    });
  }, [documents, today]);

  const totalCount = rows.length;
  const soonCount = rows.filter((r) => r.soon).length;
  const expiredCount = rows.filter((r) => r.expired).length;
  const favCount = rows.filter((r) => r.doc.favorite).length;

  const counts: Record<FilterKey, number> = {
    all: totalCount,
    fav: favCount,
    soon: rows.filter((r) => r.soon || r.expired).length,
  };

  const visible = useMemo(() => {
    const needle = q.trim().toLowerCase();
    return rows.filter((r) => {
      if (filter === "fav" && !r.doc.favorite) return false;
      if (filter === "soon" && !(r.soon || r.expired)) return false;
      if (needle) {
        const hay = `${r.doc.title} ${r.doc.issuer ?? ""} ${r.doc.number ?? ""}`.toLowerCase();
        if (!hay.includes(needle)) return false;
      }
      return true;
    });
  }, [rows, filter, q]);

  if (!documents) return <VaultSkeleton />;

  return (
    <div className="h-full overflow-y-auto sys-scroll px-4 pt-3 pb-28">
      {/* ═══ الرأس ═══ */}
      <header className="mb-4">
        <div className="flex items-center justify-between gap-2">
          <div>
            <h1 className="text-[22px] font-bold leading-tight">المستندات والخزانة</h1>
            <p className="mt-0.5 text-[12px] text-muted-foreground">جوازات وعقود وضمانات مع تنبيه انتهاء</p>
          </div>
          <motion.button
            type="button"
            whileTap={{ scale: 0.9 }}
            onClick={() => setAddOpen(true)}
            className="flex h-11 w-11 shrink-0 items-center justify-center rounded-2xl border border-primary/40 bg-primary/15 text-primary transition-colors hover:bg-primary/25"
            aria-label="إضافة مستند"
          >
            <Plus className="h-5 w-5" strokeWidth={2.4} aria-hidden="true" />
          </motion.button>
        </div>

        {totalCount > 0 && (
          <div className="relative mt-3">
            <Search className="pointer-events-none absolute start-3.5 top-1/2 w-4 h-4 -translate-y-1/2 text-muted-foreground" />
            <Input
              value={q}
              onChange={(e) => setQ(e.target.value)}
              placeholder="ابحث في العنوان أو الجهة أو الرقم…"
              aria-label="البحث في المستندات"
              className="glass-soft h-11 rounded-2xl ps-10 pe-10 text-[12.5px] border-white/10 bg-transparent placeholder:text-muted-foreground/70 focus-visible:ring-primary/25"
            />
            {q && (
              <button
                type="button"
                onClick={() => setQ("")}
                aria-label="مسح البحث"
                className="absolute end-3 top-1/2 flex h-8 w-8 -translate-y-1/2 items-center justify-center rounded-full glass-soft text-muted-foreground hover:text-foreground"
              >
                <X className="w-3.5 h-3.5" />
              </button>
            )}
          </div>
        )}
      </header>

      {/* ═══ بداية نظيفة ═══ */}
      {totalCount === 0 && (
        <motion.div {...widgetEnter(0.05)}>
          <GlassCard className="p-2">
            <EmptyState
              icon={<BookUser className="h-6 w-6" />}
              title="أضف أول مستند — جواز أو عقد أو ضمان"
              hint="أضف تاريخ الانتهاء وسننبّهك قبلها تلقائياً في مركز التنبيهات"
              actionLabel="أضف مستنداً"
              onAction={() => setAddOpen(true)}
            />
          </GlassCard>
        </motion.div>
      )}

      {/* ═══ البطل الإحصائي ═══ */}
      {totalCount > 0 && (
        <motion.div {...widgetEnter(0.05)} className="mb-3">
          <GlassCard className="p-4">
            <div className={cn("grid gap-2", expiredCount > 0 ? "grid-cols-3" : "grid-cols-2")}>
              <div className="rounded-2xl glass-soft p-3">
                <p className="text-[22px] font-bold leading-none tabular">{formatNumber(totalCount)}</p>
                <p className="mt-1 text-[10.5px] text-muted-foreground">مستنداً في الخزانة</p>
              </div>
              <div className="rounded-2xl border border-gold/20 bg-gold/[0.06] p-3">
                <p className="text-[22px] font-bold leading-none tabular text-gold">{formatNumber(soonCount)}</p>
                <p className="mt-1 text-[10.5px] text-muted-foreground">تنتهي خلال {formatNumber(SOON_DAYS)} يوماً</p>
              </div>
              {expiredCount > 0 && (
                <div className="rounded-2xl border border-coral/25 bg-coral/[0.07] p-3">
                  <p className="text-[22px] font-bold leading-none tabular text-coral">{formatNumber(expiredCount)}</p>
                  <p className="mt-1 text-[10.5px] text-muted-foreground">منتهية — تحتاج تجديداً</p>
                </div>
              )}
            </div>
          </GlassCard>
        </motion.div>
      )}

      {/* ═══ شرائط الفلترة ═══ */}
      {totalCount > 0 && (
        <motion.div {...widgetEnter(0.12)} className="mb-3.5">
          <div className="flex items-center gap-2 overflow-x-auto no-scrollbar">
            {FILTERS.map((f) => {
              const active = filter === f.key;
              return (
                <button
                  key={f.key}
                  type="button"
                  onClick={() => setFilter(f.key)}
                  aria-pressed={active}
                  className={cn(
                    "h-11 shrink-0 rounded-full px-4 text-[11.5px] font-semibold transition-all duration-200",
                    active
                      ? "bg-primary/15 text-primary border border-primary/35 shadow-[0_0_16px_-6px_rgba(245,185,92,0.4)]"
                      : "glass-soft text-muted-foreground hover:text-foreground border border-transparent"
                  )}
                >
                  {f.label}
                  <span className="ms-1.5 tabular opacity-75">{formatNumber(counts[f.key])}</span>
                </button>
              );
            })}
          </div>
        </motion.div>
      )}

      {/* ═══ قائمة المستندات ═══ */}
      {totalCount > 0 && (
        <section>
          <div className="mb-2.5 flex items-center justify-between px-1">
            <span className="text-[13px] font-semibold text-foreground/90">
              {q.trim() ? "نتائج البحث" : filter === "fav" ? "المستندات المفضلة" : "كل المستندات"}
            </span>
            <span className="tabular text-[10.5px] text-muted-foreground">
              {formatNumber(visible.length)} من {formatNumber(totalCount)}
            </span>
          </div>

          {visible.length === 0 ? (
            <GlassCard className="p-2">
              <EmptyState
                compact
                icon={<Search className="h-5 w-5" />}
                title="لا نتائج مطابقة"
                hint={
                  q.trim()
                    ? "جرّب كلمة أقصر أو امسح البحث"
                    : filter === "fav"
                      ? "لمّا تُميّز أي مستند كمفضل بعد"
                      : "لا مستندات تنتهي قريباً — كلها سارية"
                }
                actionLabel="عرض الكل"
                onAction={() => {
                  setFilter("all");
                  setQ("");
                }}
              />
            </GlassCard>
          ) : (
            <div className="space-y-3">
              <AnimatePresence initial={false}>
                {visible.map((row, idx) => (
                  <DocumentCard
                    key={row.doc.id}
                    row={row}
                    delay={Math.min(idx * 0.04, 0.3)}
                    onOpen={() => setEditDoc(row.doc)}
                  />
                ))}
              </AnimatePresence>
            </div>
          )}
        </section>
      )}

      {/* ═══ سطر صادق ═══ */}
      <p className="mt-6 flex items-center justify-center gap-1.5 text-center text-[10.5px] leading-relaxed text-muted-foreground/70">
        <ShieldCheck className="h-3.5 w-3.5 shrink-0" aria-hidden="true" />
        مستنداتك محفوظة على جهازك فقط — البيانات لا تغادر الهاتف
      </p>

      {/* ═══ حوار الإضافة/التفاصيل ═══ */}
      <DocumentFormDialog
        open={addOpen || editDoc != null}
        onOpenChange={(o) => {
          if (!o) {
            setAddOpen(false);
            setEditDoc(null);
          }
        }}
        doc={editDoc}
      />
    </div>
  );
}
