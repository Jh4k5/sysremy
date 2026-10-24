/**
 * Systemy v3 — أدوات شاشة الملاحظات والمعرفة (ملكية مجلد notes)
 * الوسوم + «المفضلة» كوسم داخلي محفوظ في حقل tags (النوع Note المشترك لا يملك حقل مفضلة،
 * والوسم «مفضلة» يُخفى من شرائح الوسوم الظاهرة ويُدار عبر أيقونة النجمة فقط).
 */
import type { Note } from "@/lib/types";

/** الوسم الداخلي الذي يمثل حالة المفضلة */
export const FAV_TAG = "مفضلة";

/** قراءة الوسوم من الحقل النصي (فاصلة عربية أو لاتينية) */
export function parseTags(raw: string): string[] {
  return raw
    .split(/[,،]/)
    .map((t) => t.trim())
    .filter(Boolean);
}

/** هل الملاحظة مفضلة؟ */
export function isFavorite(n: Note): boolean {
  return parseTags(n.tags).includes(FAV_TAG);
}

/** الوسوم الظاهرة (بدون وسم المفضلة الداخلي) */
export function visibleTags(n: Note): string[] {
  return parseTags(n.tags).filter((t) => t !== FAV_TAG);
}

/** حقل tags بعد تبديل المفضلة */
export function withFavorite(raw: string, fav: boolean): string {
  const tags = parseTags(raw);
  const next = fav
    ? tags.includes(FAV_TAG)
      ? tags
      : [...tags, FAV_TAG]
    : tags.filter((t) => t !== FAV_TAG);
  return next.join("، ");
}
