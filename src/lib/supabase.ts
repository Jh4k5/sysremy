/**
 * عميل Supabase — المصادقة + المزامنة السحابية فوق التخزين المحلي.
 * المفتاح هنا publishable (عام بتصميم RLS) — لا سِر فيه.
 * البيانات تعمل محلياً أولاً (Dexie لكل مستخدم) وتُزامَن عبر lib/sync.
 */
import { createClient, type SupabaseClient } from "@supabase/supabase-js";

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
const supabaseAnonKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;

/** عنوان المشروع — لكشف الاتصال (نبضة health) — فارغ إن لم يُضبط */
export const SUPABASE_URL = supabaseUrl ?? "";

/** المفتاح الناشر (عام) — لترويسات النبضة فقط، ليس سراً */
export const supabasePublishableKey = supabaseAnonKey ?? "";

/** هل الضبط البيئي متوفر؟ (يخفي مزايا الحساب السحابي إن غاب) */
export const isSupabaseConfigured = Boolean(supabaseUrl && supabaseAnonKey);

/** العميل الوحيد للتطبيق — null إذا لم يُضبط */
export const supabase: SupabaseClient | null = isSupabaseConfigured
  ? createClient(supabaseUrl as string, supabaseAnonKey as string, {
      auth: {
        // جلسة دائمة على هذا الجهاز + تجديد تلقائي للتوكن
        persistSession: true,
        autoRefreshToken: true,
        // التقاط رابط استعادة كلمة المرور / عودة OAuth من الـ URL (PASSWORD_RECOVERY و ?code)
        detectSessionInUrl: true,
        // PKCE: كود مؤقت + مُحقِن محلي — لا توكن في الرابط إطلاقاً
        // (يدعم عودة Google داخل التطبيق عبر systemy://auth/callback — lib/oauth-bridge)
        flowType: "pkce",
        storageKey: "systemy-auth",
      },
    })
  : null;

/** ترجمة أخطاء GoTrue إلى عربية بلهجة التطبيق — صادقة بلا تخمين */
export function authErrorToArabic(err: unknown): string {
  const e = err as { code?: string; status?: number; message?: string } | null;
  const code = e?.code ?? "";
  const msg = e?.message ?? "";
  if (code === "invalid_credentials" || msg.includes("Invalid login credentials"))
    return "البريد أو كلمة المرور غير صحيحة";
  if (code === "email_not_confirmed" || msg.includes("Email not confirmed"))
    return "بريدك ما تأكّد بعد — افتح الرابط اللي أرسلناه لبريدك، ثم جرّب الدخول مرة ثانية";
  if (code === "over_email_send_rate_limit" || code === "over_request_rate_limit" || msg.includes("rate limit"))
    return "كثُرت المحاولات على بريدك — استنى دقايق وجرّب ثاني (حدود خدمة البريد المؤقتة)";
  if (code === "weak_password" || msg.includes("Password should be at least"))
    return "كلمة المرور ضعيفة — لازم 6 أحرف على الأقل";
  if (code === "user_already_exists" || code === "user_not_found" || msg.includes("already registered"))
    return "هذا البريد مسجّل من قبل — سجّل دخولك، أو استعد كلمة المرور لو نسيتها";
  if (code === "email_address_invalid" || msg.includes("invalid email") || msg.includes("unable to validate email"))
    return "صيغة البريد الإلكتروني غير صحيحة";
  if (code === "validation_failed" && msg.includes("OAuth secret"))
    return "تسجيل Google غير مهيّأ بعد في لوحة Supabase — ينقص OAuth Secret من Google Cloud";
  if (msg.includes("Failed to fetch") || msg.includes("fetch failed") || msg.includes("NetworkError"))
    return "ما قدرنا نوصل لخدمة الدخول — تأكد من اتصالك بالإنترنت";
  // غير معروف؟ اعرض الرسالة الأصلية بصدق (تشخيص أفضل من كذبة عامة)
  return msg || "صار خطأ غير متوقع — جرّب مرة ثانية";
}
