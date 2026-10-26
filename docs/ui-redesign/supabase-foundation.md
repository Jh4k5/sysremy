# أساس Supabase — خطة التفعيل والمحجوب

## الوضع الحالي (مُتحقَّق فعلياً ضد المشروع الحي — 2026-10-26)

التطبيق **محلي أولاً**: بيانات Dexie/IndexedDB على الجهاز. طبقة المصادقة السحابية
**مبنية ومفعّلة في الواجهة** الآن (شاشة دخول/تسجيل/استعادة + بطاقة حساب في «أنا»)
وتعمل ضد المشروع الحقيقي بمفتاح publishable — والتحقق المنفذ:

- ✅ **العميل**: `@supabase/supabase-js@2.118` + `NEXT_PUBLIC_SUPABASE_ANON_KEY` بمفتاح
  publishable (sb_publishable_…) — يعمل لكل المسارات المختبرة (لا حاجة لمفتاح anon
  القديم؛ إن أردته أعد إرساله وسأبدّله).
- ✅ **إنشاء حساب** (signup): حساب اختبار حقيقي أُنشئ (`7c207722-…`) وبريد تأكيد
  أُرسل فعلاً (`confirmation_sent_at` مسجّل) — من الواجهة ومن API.
- ✅ **تأكيد البريد مطلوب** (`mailer_autoconfirm:false`): الدخول قبل التأكيد يُرفض
  بـ `email_not_confirmed` — مُتحقق من الواجهة بالعربية.
- ✅ **رسائل خطأ الدخول**: بيانات خاطئة → `invalid_credentials` (مُتحقق).
- ✅ **طلب استعادة كلمة المرور**: نقطة النهاية تعمل؛ بريد غير مسجّل يرجع 200 بلا
  تعداد مستخدمين (مُتحقق). حدود الإرسال المدمجة ضيقة (استهلكناها في الاختبار).
- ✅ **فحص Google من الخادم**: مسار `/api/auth/google-status` يكشف الحالة الحقيقية
  ويظهرها في الواجهة.

## المحجوب بانتظار مالك المشروع (بالأولوية)

1. **Google OAuth ناقص فعلياً**: المزود «مفعّل» في اللوحة لكن authorize يرد
   `Unsupported provider: missing OAuth secret` — المطلوب: Google Cloud Console →
   OAuth Client (ID/Secret) → لصقها في Supabase Dashboard → Authentication →
   Providers → Google، مع Redirect URL
   `${SUPABASE_URL}/auth/v1/callback`.
2. **جدول `profiles` غير موجود** (PGRST205): شغّل الهجرة أدناه عبر SQL Editor.
   الواجهة تعمل بدونه (بطاقة الحساب تعرض تنبيهاً صادقاً حتى تشغّله).
3. **Site URL وRedirect URLs**: في Authentication → URL Configuration — يجب أن
   يطابقا نطاق المعاينة الفعلي ليعمل رابط الاستعادة حتى النهاية.
4. **حدود البريد المدمجة**: 2 رسائل/ساعة تقريباً — للإنتاج اضبط SMTP مخصصاً
   (Authentication → SMTP).

## ما لم يُختبر بعد (مسؤولية صاحب البريد)

- فتح رابط التأكيد من بريد حقيقي ثم الدخول الكامل بجلسة (يحتاج صندوق بريد تملكه —
  حساب الاختبار `systemy.e2e.2026@gmail.com` بانتظار تأكيده من Dashboard →
  Users → Confirm، أو سجّل بريدك الحقيقي من الواجهة).
- حلقة Google الكاملة (تحتاج حساب Google في متصفح حقيقي — «افتح في تبويب جديد»).
- تعيين كلمة مرور جديدة من رابط البريد (النموذج جاهز يفتح تلقائياً عند
  PASSWORD_RECOVERY).

## هجرة profiles الجاهزة (RLS)

```sql
-- profiles: مرتبط بمستخدمي المصادقة
create table if not exists public.profiles (
  id uuid primary key references auth.users(id) on delete cascade,
  display_name text,
  avatar_url text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

alter table public.profiles enable row level security;

-- كل مستخدم يقرأ/يكتب ملفه فقط — الهوية عبر auth.uid()
create policy "profiles: read own" on public.profiles
  for select using (auth.uid() = id);
create policy "profiles: insert own" on public.profiles
  for insert with check (auth.uid() = id);
create policy "profiles: update own" on public.profiles
  for update using (auth.uid() = id);

-- تهيئة الملف عند أول تسجيل (من بيانات المصادقة — مدخلات غير موثوقة)
create or replace function public.handle_new_profile()
returns trigger language plpgsql security definer set search_path = public as $$
begin
  insert into public.profiles (id, display_name)
  values (new.id, coalesce(new.raw_user_meta_data->>'full_name', ''))
  on conflict (id) do nothing;
  return new;
end $$;

drop trigger if exists on_auth_user_created on auth.users;
create trigger on_auth_user_created
  after insert on auth.users
  for each row execute function public.handle_new_profile();
```

## قاعدة الترحيل المستقبلي

لا ترحيل بيانات محلية ولا مزامنة سحابية قبل خطة صريحة ونسخة احتياطية.
عمل المصادقة لا يعني أن البيانات متزامنة — والواجهة لا تدّعي ذلك (نص صريح
في شاشة الحساب وبطاقة الإعدادات).
