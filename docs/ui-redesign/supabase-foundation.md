# أساس Supabase — خطة التفعيل والمحجوب

## الوضع الحالي (صادق بلا ادعاء)

التطبيق **محلي أولاً**: بيانات Dexie/IndexedDB على الجهاز، وإعداد أولي محلي
بلا حساب سحابي — وهذا ما تعرضه الواجهة فعلاً (لا تسجيل سحابي وهمي).

تم تأسيس البنية الجاهزة للتفعيل:
- `.env.example` بالمتغيرات المطلوبة (URL عام + مفتاح ناشر فارغ).
- قاعدة: `NEXT_PUBLIC_SUPABASE_URL` + `NEXT_PUBLIC_SUPABASE_ANON_KEY`.

## المحجوب بانتظار مالك المشروع

1. **المفتاح الناشر (publishable/anon key)** لم يُرفق في الجلسة — مطلوب من:
   Supabase Dashboard → Settings → API Keys.
2. **تفعيل مزود Google OAuth** في: Authentication → Providers → Google
   (يحتاج OAuth Client ID/Secret من Google Cloud Console مع Redirect URL
   `${SUPABASE_URL}/auth/v1/callback`).
3. **Site URL وRedirect URLs** في: Authentication → URL Configuration
   (يجب أن يطابقا نطاق المعاينة الفعلي).
4. تشغيل هجرة `profiles` مع سياسات RLS (الملف أدناه) عبر SQL Editor.

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
عمل المصادقة لا يعني أن البيانات متزامنة — والواجهة لن تدّعي ذلك.
