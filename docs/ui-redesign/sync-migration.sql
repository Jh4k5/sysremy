-- ═══════════════════════════════════════════════════════════════════
-- SYSTEMY 5.2 — التهيئة النهائية لـ Supabase (النسخة المصححة والآمنة)
-- ───────────────────────────────────────────────────────────────────
-- أين تُنفَّذ:  Supabase Dashboard → SQL Editor → New query
--              → الصق الملف كاملاً → Run   (خطوة واحدة فقط)
-- المشروع:     ymzwfqqijtbmmclfuwcz (Systemy)
--
-- ماذا سينشئ هذا الملف (4 عناصر فقط):
--   1) جدول profiles   → الملف الشخصي لكل مستخدم (الاسم + الصورة)،
--                         مرتبط بحساب الدخول في auth.users.
--   2) جدول records    → مخزن المزامنة السحابي: صف واحد لكل عنصر
--                         بيانات (معاملة، مهمة، عادة، ملاحظة…) مع
--                         «شواهد قبور» (deleted) تضمن انتشار الحذف
--                         بين أجهزتك بلا بقايا شبح.
--   3) دالة sync_push  → استقبال دفعات بياناتك بمنطق «آخر كتابة
--                         تفوز» — بصلاحيات مصححة وجاهزة من أول تشغيل.
--   4) الحماية (RLS)   → سياسات + تريغرات + منح صريحة: كل مستخدم
--                         يرى بياناته هو فقط، بلا استثناء.
--
-- الأمان (اقرأها بثقة):
--   • لا يُحذف أي جدول ولا أي صف بيانات — إطلاقاً.
--     أوامر DROP الوحيدة تعيد بناء «السياسات والدالة والتريغر» نفسها
--     فوراً بعدها — وهي قواعد وصفية لا تحوي أي بيانات.
--   • آمن لإعادة التنفيذ أي عدد من المرات:
--     (if not exists / or replace / on conflict do nothing في كل شيء).
--   • لا يحوي الملف أي مفتاح سري — التطبيق يعمل بالمفتاح الناشر العام.
--   • مطابق حرفياً لمحرك المزامنة الفعلي في الكود الحالي
--     (src/lib/sync/sync-engine.ts):
--       – نداء rpc('sync_push', { items }) بالضبط (الاسم: items)
--       – جدول records بأعمدته الستة (id, kind, data, client_ms,
--         deleted, updated_at) وبسحب مرتّب بوقت الخادم updated_at
--       – منطق «آخر كتابة تفوز» بطابع العميل client_ms (>=)
-- ═══════════════════════════════════════════════════════════════════


-- ─── 1) جدول الملف الشخصي profiles ──────────────────────────────

create table if not exists public.profiles (
  id           uuid primary key references auth.users (id) on delete cascade,
  display_name text,
  avatar_url   text,
  created_at   timestamptz not null default now(),
  updated_at   timestamptz not null default now()
);

alter table public.profiles enable row level security;

drop policy if exists "profiles: read own"   on public.profiles;
drop policy if exists "profiles: insert own" on public.profiles;
drop policy if exists "profiles: update own" on public.profiles;

create policy "profiles: read own"   on public.profiles
  for select using (auth.uid() = id);

create policy "profiles: insert own" on public.profiles
  for insert with check (auth.uid() = id);

create policy "profiles: update own" on public.profiles
  for update using (auth.uid() = id);

-- إنشاء الملف الشخصي تلقائياً عند أول تسجيل (من بيانات المصادقة —
-- مدخلات غير موثوقة، لذا لا نثق بها إلا في حقلين آمنين)
create or replace function public.handle_new_profile()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
begin
  insert into public.profiles (id, display_name)
  values (
    new.id,
    coalesce(
      nullif(new.raw_user_meta_data ->> 'full_name', ''),
      split_part(new.email, '@', 1),
      ''
    )
  )
  on conflict (id) do nothing;
  return new;
end;
$$;

drop trigger if exists on_auth_user_created on auth.users;
create trigger on_auth_user_created
  after insert on auth.users
  for each row execute function public.handle_new_profile();

-- تعبئة الملفات الناقصة لأي حساب أُنشئ قبل تشغيل هذا الملف
-- (إضافة فقط — on conflict do nothing — لا يلمس ما موجود)
insert into public.profiles (id, display_name)
select
  u.id,
  coalesce(
    nullif(u.raw_user_meta_data ->> 'full_name', ''),
    split_part(u.email, '@', 1),
    ''
  )
from auth.users u
on conflict (id) do nothing;


-- ─── 2) جدول المزامنة العام records ─────────────────────────────
-- صف واحد لكل عنصر بيانات (كائن JSON كامل) — نمط local-first القياسي:
-- العميل مصدر الحقيقة الحسابي، والسحابة تحفظ النسخة المُزامنة لكل
-- مستخدم، وdeleted=true «شاهد قبر» يضمن حذفاً متسقاً عبر الأجهزة.

create table if not exists public.records (
  id         text primary key,                    -- معرف العنصر (uuid من العميل)
  user_id    uuid not null references auth.users (id) on delete cascade,
  kind       text not null,                       -- اسم الجدول المحلي (transactions, tasks…)
  data       jsonb not null default '{}'::jsonb,  -- العنصر كاملاً كما هو محلياً
  client_ms  bigint not null default 0,           -- آخر تعديل عميل (إيبوك مللي) — LWW
  deleted    boolean not null default false,      -- شاهد قبر: العنصر محذوف
  updated_at timestamptz not null default now()   -- وقت الخادم — مؤشر السحب
);

create index if not exists records_user_updated_idx
  on public.records (user_id, updated_at desc);

alter table public.records enable row level security;

-- كل عمليات SELECT/INSERT/UPDATE/DELETE تُقيَّد بملكية المستخدم نفسه
drop policy if exists "records: user own rows" on public.records;
create policy "records: user own rows" on public.records
  for all
  using (auth.uid() = user_id)
  with check (auth.uid() = user_id);


-- ─── 3) دالة الدفع sync_push — دفعة واحدة بمنطق «آخر كتابة تفوز» ──
-- التطبيق يستدعيها حرفياً: rpc('sync_push', { items: [...] })
-- كل عنصر بالشكل: { id, kind, data, client_ms, deleted }
-- المنطق:
--   • صف جديد → إدراج.
--   • صف موجود لنفس المستخدم → تحديث فقط إذا كان الطابع القادم أحدث
--     أو مساوياً (>=) — أي كتابة قديمة لا تدوس على أحدث.
--   • صف موجود لمستخدم آخر (تصادم معرفات نظري) → يُتجاهل ولا يُلمس أبداً.
-- security definer + فحص auth.uid() الصريح = تجاوز آمن لـ RLS.

-- نُزيل أولاً أي نسخة قديمة/خاطئة التوقيع لو وُجدت
-- (الدالة بلا حالة — لا تحوي أي بيانات، فإسقاطها آمن تماماً)
drop function if exists public.sync_push (jsonb);
drop function if exists public.sync_push (jsonb[]);

create function public.sync_push(items jsonb)
returns integer
language plpgsql
security definer
set search_path = public
as $$
declare
  r jsonb;
  n integer := 0;
begin
  if auth.uid() is null then
    raise exception 'sync_push requires an authenticated user';
  end if;

  for r in select * from jsonb_array_elements(coalesce(items, '[]'::jsonb))
  loop
    -- عنصر بلا معرف؟ تخطَّه بأمان حتى لا تفشل الدفعة كلها
    if r ->> 'id' is null or btrim(r ->> 'id') = '' then
      continue;
    end if;

    insert into public.records (id, user_id, kind, data, client_ms, deleted)
    values (
      r ->> 'id',
      auth.uid(),
      coalesce(nullif(r ->> 'kind', ''), 'unknown'),
      coalesce(r -> 'data', '{}'::jsonb),
      coalesce((r ->> 'client_ms')::bigint, 0),
      coalesce((r ->> 'deleted')::boolean, false)
    )
    on conflict (id) do update
      set kind       = excluded.kind,
          data       = excluded.data,
          client_ms  = excluded.client_ms,
          deleted    = excluded.deleted,
          updated_at = now()
      where public.records.user_id = auth.uid()
        and excluded.client_ms >= public.records.client_ms;

    n := n + 1;
  end loop;

  return n;
end;
$$;


-- ─── 4) إصلاح الصلاحيات (sync_push والجدولان) ─────────────────────
-- ملكية موحّدة + منح صريحة — لا نعتمد على أي افتراض:

alter table public.profiles owner to postgres;
alter table public.records  owner to postgres;
alter function public.sync_push (jsonb)        owner to postgres;
alter function public.handle_new_profile ()    owner to postgres;

grant usage on schema public to authenticated;

-- الجداول: authenticated يقرأ ويكتب، وanon لا يلمس شيئاً
grant select, insert, update, delete on public.records  to authenticated;
grant select, insert, update         on public.profiles to authenticated;
revoke all on public.records  from anon;
revoke all on public.profiles from anon;

-- الدالة: تنفيذ للمستخدمين المسجلين فقط — هنا إصلاح صلاحيات sync_push
-- (نُلغي منح «الجميع» الافتراضي أولاً ثم نمنح المسجلين وحدهم)
revoke execute on function public.sync_push (jsonb) from public;
grant  execute on function public.sync_push (jsonb) to authenticated;
revoke execute on function public.sync_push (jsonb) from anon;


-- ─── 5) تحديث مخطط PostgREST (ظهور فوري للجداول والدالة) ──────────
-- بدون هذا السطر قد يرد نداء sync_push مؤقتاً بخطأ PGRST202 بعد
-- الإنشاء مباشرة — وهذا أشهر «خطأ صلاحيات» وهمي في Supabase:
notify pgrst, 'reload schema';


-- ─── 6) تقرير التحقق — نتيجته تظهر تحت زر Run مباشرة ─────────────
-- القيم المتوقعة عند النجاح:
--   status ✓ · profiles ≥ 1 · records = 0 · sync_push = 1 · rls_policies = 4
select
  '✓ اكتملت التهيئة بنجاح' as status,
  (select count(*) from public.profiles) as profiles,
  (select count(*) from public.records)  as records,
  (select count(*)
     from pg_proc p
     join pg_namespace s on s.oid = p.pronamespace
    where s.nspname = 'public'
      and p.proname = 'sync_push') as sync_push,
  (select count(*)
     from pg_policies
    where schemaname = 'public'
      and tablename in ('profiles', 'records')) as rls_policies;

-- ═══════════════════════════════════════════════════════════════════
-- بعد نجاح التشغيل: افتح تطبيق Systemy وسجّل دخولك — ستتحول شارة
-- المزامنة من «تحتاج إعداد الجدول» إلى «متزامن» تلقائياً خلال دقيقة.
--
-- ملاحظة: يمكنك أيضاً نسخ هذا الملف نفسه من داخل التطبيق —
-- شاشة «أنا» → بطاقة الحساب السحابي → زر «انسخ أوامر التهيئة».
-- ═══════════════════════════════════════════════════════════════════
