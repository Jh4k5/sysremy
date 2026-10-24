"use client";

/**
 * Systemy v3 — حقول نموذج المهمة المشتركة + مساعدو الروابط
 * تُستخدم في نموذج «مهمة جديدة» وفي وضع التعديل داخل حوار التفاصيل.
 * كل الروابط (مشروع/مقرر/شخص/هدف/رحلة) اختيارية وتظهر فقط إن وُجدت بياناتها.
 */

import { useState, type ReactNode } from "react";
import { Briefcase, ChevronDown, Link2 } from "lucide-react";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import type { Course, Goal, Person, Project, Task, TaskPriority, Trip } from "@/lib/types";
import { todayISO } from "@/lib/format";
import { ChipRow, Field, inputCls, textareaCls } from "@/components/systemy/ui-bits";
import { cn } from "@/lib/utils";

// ═══════════════════════ القيم والمساعدات ═══════════════════════

export interface TaskLinkOptions {
  projects: Project[];
  courses: Course[];
  people: Person[];
  goals: Goal[];
  trips: Trip[];
}

export interface TaskFormValue {
  title: string;
  description: string;
  /** YYYY-MM-DD */
  date: string;
  /** HH:mm أو "" */
  time: string;
  priority: TaskPriority;
  /** نص الإدخال — يُحوَّل عند الحفظ */
  estimatedMinutes: string;
  /** "" = بدون رابط */
  projectId: string;
  courseId: string;
  personId: string;
  goalId: string;
  tripId: string;
}

export const PRIORITY_OPTIONS = [
  { k: "low", v: "هادئة" },
  { k: "normal", v: "عادية" },
  { k: "high", v: "عاجلة" },
] as const;

export function emptyTaskForm(date = todayISO()): TaskFormValue {
  return {
    title: "",
    description: "",
    date,
    time: "",
    priority: "normal",
    estimatedMinutes: "",
    projectId: "",
    courseId: "",
    personId: "",
    goalId: "",
    tripId: "",
  };
}

export function taskToForm(t: Task): TaskFormValue {
  return {
    title: t.title,
    description: t.description ?? "",
    date: t.date,
    time: t.time ?? "",
    priority: t.priority,
    estimatedMinutes: t.estimatedMinutes != null ? String(t.estimatedMinutes) : "",
    projectId: t.projectId ?? "",
    courseId: t.courseId ?? "",
    personId: t.personId ?? "",
    goalId: t.goalId ?? "",
    tripId: t.tripId ?? "",
  };
}

/** تحويل قيمة النموذج إلى حمولة addTask/updateTask — يرسل undefined لمحو الروابط المحذوفة */
export function formToTaskInput(v: TaskFormValue) {
  const est = v.estimatedMinutes.trim();
  return {
    title: v.title.trim(),
    description: v.description.trim() || undefined,
    date: v.date || todayISO(),
    time: /^\d{2}:\d{2}$/.test(v.time) ? v.time : undefined,
    priority: v.priority,
    estimatedMinutes: est ? Math.max(1, Math.round(Number(est))) : undefined,
    projectId: v.projectId || undefined,
    courseId: v.courseId || undefined,
    personId: v.personId || undefined,
    goalId: v.goalId || undefined,
    tripId: v.tripId || undefined,
  };
}

// ═══════════════════════ رقائق الروابط ═══════════════════════

export interface TaskLinkChip {
  label: string;
  icon: string;
  color: string;
}

/** رقائق روابط المهمة — لكل رابط موجود رقاقة باسم الكيان ولونه */
export function taskLinkChips(task: Task, links: TaskLinkOptions): TaskLinkChip[] {
  const out: TaskLinkChip[] = [];
  if (task.projectId) {
    const p = links.projects.find((x) => x.id === task.projectId);
    if (p) out.push({ label: p.name, icon: p.icon || "briefcase", color: p.color });
  }
  if (task.courseId) {
    const c = links.courses.find((x) => x.id === task.courseId);
    if (c) out.push({ label: c.name, icon: c.icon || "graduation-cap", color: c.color });
  }
  if (task.personId) {
    const per = links.people.find((x) => x.id === task.personId);
    if (per) out.push({ label: per.name, icon: "users", color: "#F8B4D9" });
  }
  if (task.goalId) {
    const g = links.goals.find((x) => x.id === task.goalId);
    if (g) out.push({ label: g.name, icon: "target", color: g.color });
  }
  if (task.tripId) {
    const tr = links.trips.find((x) => x.id === task.tripId);
    if (tr) out.push({ label: tr.name, icon: "plane", color: "#C08457" });
  }
  return out;
}

// ═══════════════════════ الحقول المشتركة ═══════════════════════

const selectTriggerCls =
  "h-12 rounded-xl glass-soft border border-white/[0.08] px-4 text-[13.5px] text-foreground focus:ring-0";
const selectContentCls = "rounded-xl border-white/10 bg-[#10152a] max-h-64";

export function TaskFields({
  value,
  onPatch,
  links,
}: {
  value: TaskFormValue;
  onPatch: (patch: Partial<TaskFormValue>) => void;
  links: TaskLinkOptions;
}) {
  const [linksOpen, setLinksOpen] = useState(
    !!(value.projectId || value.courseId || value.personId || value.goalId || value.tripId)
  );

  const activeGoals = links.goals.filter((g) => !g.archived);
  const hasAnyLink =
    links.projects.length > 0 ||
    links.courses.length > 0 ||
    links.people.length > 0 ||
    activeGoals.length > 0 ||
    links.trips.length > 0;
  const linkedCount =
    (value.projectId ? 1 : 0) +
    (value.courseId ? 1 : 0) +
    (value.personId ? 1 : 0) +
    (value.goalId ? 1 : 0) +
    (value.tripId ? 1 : 0);

  return (
    <div className="space-y-4">
      <Field label="عنوان المهمة">
        <input
          value={value.title}
          onChange={(e) => onPatch({ title: e.target.value })}
          placeholder="مثال: تسليم تقرير الأسبوع"
          maxLength={80}
          className={inputCls}
          dir="auto"
          aria-label="عنوان المهمة"
        />
      </Field>

      <Field label="تفاصيل (اختيارية)">
        <textarea
          value={value.description}
          onChange={(e) => onPatch({ description: e.target.value })}
          placeholder="أي سياق يساعدك لاحقاً…"
          maxLength={500}
          className={textareaCls}
          dir="auto"
          aria-label="تفاصيل المهمة"
        />
      </Field>

      <div className="grid grid-cols-2 gap-3">
        <Field label="التاريخ">
          <input
            type="date"
            value={value.date}
            onChange={(e) => onPatch({ date: e.target.value || todayISO() })}
            className={cn(inputCls, "tabular")}
            dir="ltr"
            aria-label="تاريخ المهمة"
          />
        </Field>
        <Field label="الوقت (اختياري)">
          <input
            type="time"
            value={value.time}
            onChange={(e) => onPatch({ time: e.target.value })}
            className={cn(inputCls, "tabular")}
            dir="ltr"
            aria-label="وقت المهمة"
          />
        </Field>
      </div>

      <ChipRow
        label="الأهمية"
        options={PRIORITY_OPTIONS.map((p) => ({ k: p.k, v: p.v }))}
        value={value.priority}
        onSelect={(k) => onPatch({ priority: k as TaskPriority })}
        small
      />

      <Field label="المدة التقديرية بالدقائق (اختيارية)" hint="تُستخدم لجدولتها على التقويم">
        <input
          type="number"
          inputMode="numeric"
          min={1}
          max={1440}
          value={value.estimatedMinutes}
          onChange={(e) => onPatch({ estimatedMinutes: e.target.value })}
          placeholder="45"
          className={cn(inputCls, "tabular")}
          dir="ltr"
          aria-label="المدة التقديرية بالدقائق"
        />
      </Field>

      {hasAnyLink && (
        <div className="space-y-2.5">
          <button
            type="button"
            onClick={() => setLinksOpen((o) => !o)}
            aria-expanded={linksOpen}
            aria-controls="task-link-selects"
            className="flex h-11 w-full items-center justify-between gap-2 rounded-xl glass-soft border border-white/[0.08] px-4 text-[12.5px] font-medium text-foreground/85 transition-colors hover:bg-white/[0.06]"
          >
            <span className="flex items-center gap-2">
              <Link2 className="h-4 w-4 shrink-0 text-primary/80" aria-hidden="true" />
              ربط بأنظمة أخرى (اختياري)
              {linkedCount > 0 && (
                <span className="tabular rounded-full bg-primary/20 px-2 py-0.5 text-[10px] font-bold text-primary">
                  {linkedCount}
                </span>
              )}
            </span>
            <ChevronDown
              className={cn("h-4 w-4 shrink-0 text-muted-foreground transition-transform duration-200", linksOpen && "rotate-180")}
              aria-hidden="true"
            />
          </button>

          {linksOpen && (
            <div id="task-link-selects" className="space-y-3 rounded-2xl glass-soft border border-white/[0.06] p-3.5">
              <LinkSelect
                label="المشروع"
                icon={<Briefcase className="h-3.5 w-3.5" aria-hidden="true" />}
                placeholder="بدون مشروع"
                items={links.projects.map((p) => ({ id: p.id, label: p.name }))}
                value={value.projectId}
                onChange={(v) => onPatch({ projectId: v })}
              />
              {links.courses.length > 0 && (
                <LinkSelect
                  label="المقرر"
                  icon={<span aria-hidden="true">🎓</span>}
                  placeholder="بدون مقرر"
                  items={links.courses.map((c) => ({ id: c.id, label: c.name }))}
                  value={value.courseId}
                  onChange={(v) => onPatch({ courseId: v })}
                />
              )}
              {links.people.length > 0 && (
                <LinkSelect
                  label="الشخص"
                  icon={<span aria-hidden="true">👤</span>}
                  placeholder="بدون شخص"
                  items={links.people.map((p) => ({ id: p.id, label: p.name }))}
                  value={value.personId}
                  onChange={(v) => onPatch({ personId: v })}
                />
              )}
              {activeGoals.length > 0 && (
                <LinkSelect
                  label="هدف الادخار"
                  icon={<span aria-hidden="true">🎯</span>}
                  placeholder="بدون هدف"
                  items={activeGoals.map((g) => ({ id: g.id, label: `${g.emoji} ${g.name}` }))}
                  value={value.goalId}
                  onChange={(v) => onPatch({ goalId: v })}
                />
              )}
              {links.trips.length > 0 && (
                <LinkSelect
                  label="الرحلة"
                  icon={<span aria-hidden="true">✈️</span>}
                  placeholder="بدون رحلة"
                  items={links.trips.map((t) => ({ id: t.id, label: t.name }))}
                  value={value.tripId}
                  onChange={(v) => onPatch({ tripId: v })}
                />
              )}
            </div>
          )}
        </div>
      )}
    </div>
  );
}

function LinkSelect({
  label,
  icon,
  placeholder,
  items,
  value,
  onChange,
}: {
  label: string;
  icon?: ReactNode;
  placeholder: string;
  items: Array<{ id: string; label: string }>;
  value: string;
  onChange: (v: string) => void;
}) {
  if (items.length === 0) return null;
  return (
    <div className="space-y-1.5">
      <p className="flex items-center gap-1.5 text-[11px] font-medium text-muted-foreground">
        {icon}
        {label}
      </p>
      <Select value={value || "none"} onValueChange={(v) => onChange(v === "none" ? "" : v)} dir="rtl">
        <SelectTrigger className={selectTriggerCls} aria-label={`اختيار ${label}`}>
          <SelectValue placeholder={placeholder} />
        </SelectTrigger>
        <SelectContent className={selectContentCls}>
          <SelectItem value="none" className="text-[13px]">
            {placeholder}
          </SelectItem>
          {items.map((it) => (
            <SelectItem key={it.id} value={it.id} className="text-[13px]">
              <span className="max-w-[220px] truncate">{it.label}</span>
            </SelectItem>
          ))}
        </SelectContent>
      </Select>
    </div>
  );
}
