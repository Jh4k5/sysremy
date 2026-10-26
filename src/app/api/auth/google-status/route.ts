/**
 * فحص صادق لحالة مزود Google — من الخادم لأن متصفح العميل
 * لا يقدر يقرأ رد GoTrue (CORS على إعادة التوجيه).
 * 302 → جاهز · 400 missing secret → مفعّل شكلياً بلا مفاتيح · غيره → مجهول.
 */
export async function GET() {
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const key = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;

  if (!url || !key) {
    return Response.json(
      { status: "unconfigured", ready: false, detail: "متغيرات Supabase غير مضبوطة" },
      { status: 200 }
    );
  }

  try {
    const res = await fetch(`${url}/auth/v1/authorize?provider=google`, {
      headers: { apikey: key },
      redirect: "manual",
      // توجيه يدوي: نقرأ الـ 302 كما هو بدل متابعة رحلة Google
      cache: "no-store",
    });

    if (res.status >= 300 && res.status < 400) {
      const location = res.headers.get("location") ?? "";
      const toGoogle = location.includes("google");
      return Response.json({
        status: toGoogle ? "ready" : "misconfigured-redirect",
        ready: toGoogle,
        detail: toGoogle ? "Google مهيّأ ويعيد التوجيه لجوجل" : "يعيد التوجيه لغير Google",
      });
    }

    const body = (await res.json().catch(() => ({}))) as { msg?: string; error_code?: string };
    const missingSecret = (body.msg ?? "").includes("OAuth secret");
    return Response.json({
      status: missingSecret ? "missing-secret" : `http-${res.status}`,
      ready: false,
      detail: missingSecret
        ? "مزود Google مفعّل في اللوحة لكن بلا OAuth Client Secret — يحتاج مفاتيح Google Cloud"
        : body.msg ?? `رد غير متوقع (${res.status})`,
    });
  } catch {
    return Response.json(
      { status: "network-error", ready: false, detail: "تعذر الوصول لخدمة المصادقة" },
      { status: 200 }
    );
  }
}
