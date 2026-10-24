/**
 * Systemy v3 — أدوات مشتركة لشاشة التعلم وحواراتها (ملكية مجلد learning)
 * قراءة بنود الدرجات من JSON + مشتقات الدرجة المرجّحة + رسم أيقونة المقرر.
 */
import { createElement } from "react";
import { iconByName } from "@/components/systemy/ui-bits";
import { computeCourseGrade } from "@/lib/actions";
import type { Course, GradeItem } from "@/lib/types";

/** رسم أيقونة مقرر بالاسم — عبر createElement لتفادي إنشاء مكوّن أثناء التصيير */
export function courseGlyph(icon: string, className: string) {
  return createElement(iconByName(icon), { className, "aria-hidden": true });
}

/** قراءة بنود الدرجات من حقل gradeItems (JSON string) بتحليل آمن */
export function parseGradeItems(json: string): GradeItem[] {
  try {
    const arr = JSON.parse(json || "[]");
    return Array.isArray(arr) ? (arr as GradeItem[]) : [];
  } catch {
    return [];
  }
}

/** الدرجة المرجّحة الحالية للمقرر + تغطية الأوزان + البنود نفسها */
export function courseGrade(course: Course): {
  current: number;
  coveredWeight: number;
  items: GradeItem[];
} {
  const items = parseGradeItems(course.gradeItems);
  const { current, coveredWeight } = computeCourseGrade(items);
  return { current, coveredWeight, items };
}

/** لون عرض الدرجة حسب المستوى (بلا أزرق) */
export function gradeTone(pct: number): string {
  if (pct >= 90) return "text-mint";
  if (pct >= 75) return "text-cyan";
  if (pct >= 60) return "text-gold";
  return "text-coral";
}
