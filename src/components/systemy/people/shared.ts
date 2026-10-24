/**
 * Systemy v3 — أدوات مشتركة لشاشة الأشخاص (خاصة بهذا المجلد)
 * مطابقة نصية للديون والمعاملات، لون ثابت للصورة الرمزية، وأقرب عيد ميلاد.
 */

import { COLOR_CHOICES } from "@/components/systemy/ui-bits";
import { diffDays, fromISODate, toISODate } from "@/lib/format";
import type { Debt, Person, Transaction } from "@/lib/types";

/** عتبة «بحاجة للتواصل» — 30 يوماً */
export const STALE_DAYS = 30;

/** لون ثابت للشخص مشتق من اسمه — نفس الاسم دائماً نفس اللون */
export function avatarColor(name: string): string {
  let h = 0;
  for (let i = 0; i < name.length; i++) h = (h * 31 + name.charCodeAt(i)) >>> 0;
  return COLOR_CHOICES[h % COLOR_CHOICES.length];
}

/** الحرف الأول من الاسم (آمن للعربية متعددة البايتات) */
export function initialOf(name: string): string {
  const t = name.trim();
  return (Array.from(t)[0] ?? "؟") as string;
}

/** أيام منذ آخر تواصل — null إن لم يُسجل أي تواصل قط */
export function daysSinceContact(p: Person, today: string): number | null {
  return p.lastContact ? diffDays(p.lastContact, today) : null;
}

/** شخص بحاجة للتواصل: لم يُسجل تواصل قط أو مضى أكثر من 30 يوماً */
export function isStale(p: Person, today: string): boolean {
  const d = daysSinceContact(p, today);
  return d === null || d > STALE_DAYS;
}

/** ديون الشخص — مطابقة نصية بالاسم في كلا الاتجاهين (حقل person حر في الديون) */
export function debtsOf(debts: Debt[], p: Person): Debt[] {
  const name = p.name.trim();
  if (!name) return [];
  return debts.filter((d) => {
    const who = (d.person ?? "").trim();
    return !!who && (who.includes(name) || name.includes(who));
  });
}

/** معاملات الشخص — بربط personId أو باسم نصي في حقل person (كلا الاتجاهين) */
export function transactionsOf(txs: Transaction[], p: Person): Transaction[] {
  const name = p.name.trim();
  return txs.filter((t) => {
    if (t.personId === p.id) return true;
    const who = (t.person ?? "").trim();
    return !!name && !!who && (who.includes(name) || name.includes(who));
  });
}

/** أقرب عيد ميلاد قادم وعدد أيامه — null إن لم يُسجل أو تاريخ غير صالح */
export function nextBirthday(
  birthday: string,
  today: string,
): { date: string; days: number } | null {
  const b = fromISODate(birthday);
  const t = fromISODate(today);
  if (Number.isNaN(b.getTime()) || Number.isNaN(t.getTime())) return null;
  let target = new Date(t.getFullYear(), b.getMonth(), b.getDate(), 12);
  if (target < t) target = new Date(t.getFullYear() + 1, b.getMonth(), b.getDate(), 12);
  return { date: toISODate(target), days: Math.round((target.getTime() - t.getTime()) / 86400000) };
}
