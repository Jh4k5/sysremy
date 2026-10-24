"use client";

/**
 * Systemy v3 — شاشة الملاحظات والمعرفة (التنفيذ الكامل)
 * بحث نصي (عنوان+محتوى) + فلترة (الكل/المثبتة/المفضلة/حسب وسم)
 * + ترتيب المثبتة ثم الأحدث + حوار عرض/تعديل/إنشاء كامل.
 * تُعرض ملاحظات type==="note" فقط — اليوميات نظام منفصل (الدفتر).
 */
import { useMemo, useState } from "react";
import { AnimatePresence, motion } from "framer-motion";
import { BookMarked, Lock, Pin, Plus, Search, Star, X } from "lucide-react";
import { Input } from "@/components/ui/input";
import { Skeleton } from "@/components/ui/skeleton";
import { Chip, GlassCard, widgetEnter } from "@/components/systemy/glass";
import { EmptyState } from "@/components/systemy/ui-bits";
import { db, useLive } from "@/lib/db";
import { updateNote } from "@/lib/actions";
import { formatNumber, timeAgo } from "@/lib/format";
import type { Note } from "@/lib/types";
import { cn } from "@/lib/utils";
import { NoteDialog } from "./note-dialog";
import { FAV_TAG, isFavorite, visibleTags, withFavorite } from "./notes-utils";

/* ═══ هيكل التحميل ═══ */
function NotesSkeleton() {
  return (
    <div
      className="h-full overflow-y-auto sys-scroll px-4 pt-3 pb-28"
      aria-busy="true"
      aria-label="جارٍ تحميل الملاحظات"
    >
      <div className="h-14 mb-4 space-y-2">
        <Skeleton className="h-7 w-40 rounded-lg bg-white/[0.06]" />
        <Skeleton className="h-3.5 w-56 rounded-md bg-white/[0.06]" />
      </div>
      <Skeleton className="h-11 rounded-2xl bg-white/[0.05] mb-3" />
      <Skeleton className="h-11 rounded-full bg-white/[0.05] mb-3" />
      <div className="space-y-2.5">
        <Skeleton className="h-[96px] rounded-2xl bg-white/[0.06]" />
        <Skeleton className="h-[96px] rounded-2xl bg-white/[0.06]" />
        <Skeleton className="h-[96px] rounded-2xl bg-white/[0.06]" />
      </div>
    </div>
  );
}

/* ═══ بطاقة ملاحظة معرفة ═══ */
function KnowledgeCard({
  note,
  revealed,
  delay,
  onOpen,
  onReveal,
  onTogglePin,
  onToggleFav,
}: {
  note: Note;
  revealed: boolean;
  delay: number;
  onOpen: () => void;
  onReveal: () => void;
  onTogglePin: () => void;
  onToggleFav: () => void;
}) {
  const hidden = note.secret && !revealed;
  const fav = isFavorite(note);
  const tags = visibleTags(note).slice(0, 3);

  return (
    <motion.div
      layout
      initial={{ opacity: 0, y: 10 }}
      animate={{ opacity: 1, y: 0 }}
      exit={{ opacity: 0, scale: 0.96 }}
      transition={{ duration: 0.24, delay, ease: [0.22, 1, 0.36, 1] }}
      onClick={hidden ? onReveal : onOpen}
      onKeyDown={(e) => {
        if (e.key === "Enter" || e.key === " ") {
          e.preventDefault();
          if (hidden) onReveal();
          else onOpen();
        }
      }}
      role="button"
      tabIndex={0}
      aria-label={hidden ? `كشف الملاحظة السرية: ${note.title}` : `فتح الملاحظة: ${note.title}`}
      className="glass rounded-2xl p-3.5 cursor-pointer outline-none transition-all duration-200 hover:bg-white/[0.07] hover:scale-[1.01] active:scale-[0.99] focus-visible:ring-2 focus-visible:ring-primary/40"
    >
      <div className="flex items-start gap-1">
        {note.pinned && (
          <Pin className="w-3.5 h-3.5 mt-1.5 shrink-0 text-primary fill-primary/25" aria-label="مثبتة" />
        )}
        <h3
          className={cn(
            "flex-1 min-w-0 text-[13px] font-semibold leading-snug",
            hidden && "select-none"
          )}
        >
          {note.title}
        </h3>
        {note.secret && (
          <Chip className="shrink-0 text-lav">
            <Lock className="w-3 h-3" aria-hidden="true" />
            سرية
          </Chip>
        )}
        {/* تثبيت سريع */}
        <button
          type="button"
          onClick={(e) => {
            e.stopPropagation();
            onTogglePin();
          }}
          aria-label={note.pinned ? `إلغاء تثبيت: ${note.title}` : `تثبيت: ${note.title}`}
          aria-pressed={note.pinned}
          className="w-11 h-11 -me-2 -mt-2 shrink-0 rounded-xl flex items-center justify-center transition-colors hover:bg-white/[0.06]"
        >
          {note.pinned ? (
            <Pin className="w-4 h-4 text-primary fill-primary/25" aria-hidden="true" />
          ) : (
            <Pin className="w-4 h-4 text-muted-foreground/60" aria-hidden="true" />
          )}
        </button>
        {/* تفضيل سريع */}
        <button
          type="button"
          onClick={(e) => {
            e.stopPropagation();
            onToggleFav();
          }}
          aria-label={fav ? `إزالة ${note.title} من المفضلة` : `إضافة ${note.title} إلى المفضلة`}
          aria-pressed={fav}
          className="w-11 h-11 -me-3 -mt-2 shrink-0 rounded-xl flex items-center justify-center transition-colors hover:bg-white/[0.06]"
        >
          <Star
            className={cn("w-4 h-4", fav ? "text-gold fill-gold/40" : "text-muted-foreground/60")}
            aria-hidden="true"
          />
        </button>
      </div>

      <p
        className={cn(
          "mt-1.5 text-[11.5px] leading-relaxed text-muted-foreground line-clamp-2",
          hidden && "blur-[5px] select-none"
        )}
      >
        {note.content}
      </p>

      <div className="mt-2.5 flex flex-wrap items-center gap-1.5">
        <span className="text-[10px] text-muted-foreground/80">{timeAgo(note.updatedAt)}</span>
        {tags.map((t) => (
          <Chip key={t} className="text-muted-foreground">
            {t}
          </Chip>
        ))}
        {fav && (
          <Chip className="text-gold shrink-0">
            <Star className="w-3 h-3 fill-gold/40" aria-hidden="true" />
            {FAV_TAG}
          </Chip>
        )}
        {hidden && (
          <span className="ms-auto text-[10px] text-lav/90">انقر للكشف</span>
        )}
      </div>
    </motion.div>
  );
}

/* ═══ الشاشة ═══ */
export function NotesScreen() {
  const [q, setQ] = useState("");
  const [filter, setFilter] = useState<string>("all");
  const [revealed, setRevealed] = useState<ReadonlySet<string>>(new Set());
  const [editingId, setEditingId] = useState<string | null>(null);
  const [newOpen, setNewOpen] = useState(false);

  /* ─── القراءة التفاعلية الوحيدة ─── */
  const data = useLive(() => db.notes.toArray(), []);

  /* ملاحظات المعرفة فقط — اليوميات نظام منفصل */
  const knowledge = useMemo(
    () => (data ?? []).filter((n) => n.type === "note"),
    [data]
  );

  /* الوسوم الفريدة (بدون وسم المفضلة الداخلي) */
  const uniqueTags = useMemo(() => {
    const s = new Set<string>();
    for (const n of knowledge) for (const t of visibleTags(n)) s.add(t);
    return Array.from(s).sort((a, b) => a.localeCompare(b, "ar")).slice(0, 10);
  }, [knowledge]);

  /* البحث (عنوان + محتوى) */
  const searched = useMemo(() => {
    const query = q.trim().toLowerCase();
    if (!query) return knowledge;
    return knowledge.filter(
      (n) =>
        n.title.toLowerCase().includes(query) ||
        n.content.toLowerCase().includes(query)
    );
  }, [knowledge, q]);

  /* الترتيب: المثبتة أولاً ثم الأحدث تحديثاً */
  const sorted = useMemo(() => {
    return [...searched].sort(
      (a, b) =>
        Number(b.pinned) - Number(a.pinned) || b.updatedAt.localeCompare(a.updatedAt)
    );
  }, [searched]);

  /* الفلترة بالشرائح */
  const filtered = useMemo(() => {
    if (filter === "all") return sorted;
    if (filter === "pinned") return sorted.filter((n) => n.pinned);
    if (filter === "fav") return sorted.filter((n) => isFavorite(n));
    if (filter.startsWith("tag:")) {
      const tag = filter.slice(4);
      return sorted.filter((n) => visibleTags(n).includes(tag));
    }
    return sorted;
  }, [sorted, filter]);

  const counts = useMemo(
    () => ({
      all: searched.length,
      pinned: searched.filter((n) => n.pinned).length,
      fav: searched.filter((n) => isFavorite(n)).length,
    }),
    [searched]
  );

  const editingNote = useMemo(
    () => knowledge.find((n) => n.id === editingId) ?? null,
    [knowledge, editingId]
  );

  async function togglePin(note: Note) {
    await updateNote(note.id, { pinned: !note.pinned });
  }

  async function toggleFav(note: Note) {
    await updateNote(note.id, { tags: withFavorite(note.tags, !isFavorite(note)) });
  }

  if (!data) return <NotesSkeleton />;

  const chips: Array<{ key: string; label: string; count: number }> = [
    { key: "all", label: "الكل", count: counts.all },
    { key: "pinned", label: "المثبتة", count: counts.pinned },
    { key: "fav", label: "المفضلة", count: counts.fav },
    ...uniqueTags.map((t) => ({
      key: `tag:${t}`,
      label: t,
      count: searched.filter((n) => visibleTags(n).includes(t)).length,
    })),
  ];

  return (
    <div className="h-full overflow-y-auto sys-scroll px-4 pt-3 pb-28">
      {/* ═══ الرأس ═══ */}
      <header className="mb-4">
        <div className="flex items-center justify-between gap-2">
          <div>
            <h1 className="text-[22px] font-bold leading-tight">الملاحظات والمعرفة</h1>
            <p className="mt-0.5 text-[12px] text-muted-foreground">
              معرفتك المرجعية — وسوم ومفضلة وتثبيت
            </p>
          </div>
          <button
            type="button"
            onClick={() => setNewOpen(true)}
            aria-label="ملاحظة جديدة"
            className="h-11 px-4 rounded-2xl bg-primary/15 border border-primary/35 text-primary flex items-center gap-1.5 text-[13px] font-bold transition-all duration-200 hover:bg-primary/25 hover:scale-[1.02] active:scale-95 glow-gold"
          >
            <Plus className="w-4 h-4" />
            ملاحظة جديدة
          </button>
        </div>

        {/* البحث */}
        <div className="relative mt-3">
          <Search
            className="absolute start-3.5 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground pointer-events-none"
            aria-hidden="true"
          />
          <Input
            value={q}
            onChange={(e) => setQ(e.target.value)}
            placeholder="ابحث في العنوان أو المحتوى…"
            aria-label="البحث في الملاحظات"
            className="glass-soft h-11 rounded-2xl ps-10 pe-10 text-[12.5px] border-white/10 bg-transparent placeholder:text-muted-foreground/70 focus-visible:ring-primary/25"
          />
          {q && (
            <button
              type="button"
              onClick={() => setQ("")}
              aria-label="مسح البحث"
              className="absolute end-3 top-1/2 -translate-y-1/2 w-8 h-8 rounded-full glass-soft flex items-center justify-center text-muted-foreground hover:text-foreground"
            >
              <X className="w-3.5 h-3.5" />
            </button>
          )}
        </div>
      </header>

      {/* ═══ شرائط الفلترة ═══ */}
      <motion.div {...widgetEnter(0.05)} className="mb-3.5">
        <div className="flex items-center gap-2 overflow-x-auto no-scrollbar" role="group" aria-label="فلترة الملاحظات">
          {chips.map((c) => {
            const active = filter === c.key;
            return (
              <button
                key={c.key}
                type="button"
                onClick={() => setFilter(c.key)}
                aria-pressed={active}
                className={cn(
                  "h-11 shrink-0 rounded-full px-4 text-[11.5px] font-semibold transition-all duration-200",
                  active
                    ? "bg-primary/15 text-primary border border-primary/35 shadow-[0_0_16px_-6px_rgba(245,185,92,0.4)]"
                    : "glass-soft text-muted-foreground hover:text-foreground border border-transparent"
                )}
              >
                {c.label}
                <span className="ms-1.5 tabular opacity-75">{formatNumber(c.count)}</span>
              </button>
            );
          })}
        </div>
      </motion.div>

      {/* ═══ قائمة الملاحظات ═══ */}
      <section>
        <div className="flex items-center justify-between px-1 mb-2.5">
          <div className="flex items-center gap-2 text-[13px] font-semibold text-foreground/90">
            <BookMarked className="w-3.5 h-3.5 text-primary" aria-hidden="true" />
            <span>{q.trim() ? "نتائج البحث" : "الملاحظات"}</span>
          </div>
          <span className="text-[11px] text-muted-foreground tabular">
            {formatNumber(filtered.length)}
          </span>
        </div>

        {knowledge.length === 0 ? (
          <GlassCard className="p-4">
            <EmptyState
              icon={<BookMarked className="w-6 h-6" />}
              title="معرفتك المرجعية تبدأ هنا"
              hint="احفظ الأفكار والمراجع والخلاصات — وسومها لتجدها بسرعة، وثبّت المهم منها."
              actionLabel="أنشئ ملاحظة"
              onAction={() => setNewOpen(true)}
            />
          </GlassCard>
        ) : filtered.length === 0 ? (
          <EmptyState
            compact
            icon={<Search className="w-6 h-6" />}
            title="لا نتائج مطابقة"
            hint="جرّب كلمة أخرى — أو غيّر الفلتر"
            actionLabel="مسح البحث والفلتر"
            onAction={() => {
              setQ("");
              setFilter("all");
            }}
          />
        ) : (
          <div className="space-y-2.5">
            <AnimatePresence initial={false}>
              {filtered.map((n, i) => (
                <KnowledgeCard
                  key={n.id}
                  note={n}
                  delay={Math.min(i * 0.04, 0.24)}
                  revealed={revealed.has(n.id)}
                  onReveal={() =>
                    setRevealed((prev) => {
                      const next = new Set(prev);
                      next.add(n.id);
                      return next;
                    })
                  }
                  onOpen={() => setEditingId(n.id)}
                  onTogglePin={() => void togglePin(n)}
                  onToggleFav={() => void toggleFav(n)}
                />
              ))}
            </AnimatePresence>
          </div>
        )}
      </section>

      {/* ═══ الحوارات ═══ */}
      <NoteDialog
        open={editingNote != null}
        onOpenChange={(o) => {
          if (!o) setEditingId(null);
        }}
        note={editingNote}
      />
      <NoteDialog open={newOpen} onOpenChange={setNewOpen} note={null} />
    </div>
  );
}
