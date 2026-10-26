-- ═══════════════════════════════════════════════════════════════════
-- SYSTEMY 5.2 — هجرة المزامنة السحابية الكاملة (تُنفَّذ مرة واحدة)
-- المكان: Supabase Dashboard → SQL Editor → New query → الصق → Run
-- المشروع: ymzwfqqijtbmmclfuwcz
--
-- ما تنشئه هذه الهجرة:
--   1) جدول profiles  — الملف الشخصي لكل مستخدم (مرتبط بـ auth.users)
--   2) جدول records   — مخزن المزامنة العام: صف واحد لكل عنصر بيانات
--                        (معاملات، مهام، عادات، ملاحظات… الكل) مع شواهد قبور
--   3) دالة sync_push — دفع دفعات بمنطق «آخر كتابة تفوز» (LWW) المحصّن
--   4) سياسات RLS     — كل مستخدم يرى بياناته فقط، بلا استثناء
--
-- الأمان: لا شيء هنا يُخزّن أسراراً. اقرأ فقط؛ التطبيق يستخدم المفتاح
-- الناشر (publishable) وليس service-role.
-- إعادة التنفيذ آمنة: if not exists / or replace في كل العناصر.
-- ═══════════════════════════════════════════════════════════════════

-- ─── 1) جدول الملف الشخصي ───────────────────────────────────────

create table if not exists public.profiles (
  id uuid primary key references auth.users (id) on delete cascade,
  display_name text,
  avatar_url text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

alter table public.profiles enable row level security;

drop policy if exists "profiles: read own" on public.profiles;
create policy "profiles: read own" on public.profiles
  for select using (auth.uid() = id);

drop policy if exists "profiles: insert own" on public.profiles;
create policy "profiles: insert own" on public.profiles
  for insert with check (auth.uid() = id);

drop policy if exists "profiles: update own" on public.profiles;
create policy "profiles: update own" on public.profiles
  for update using (auth.uid() = id);

-- إنشاء الملف تلقائياً عند أول تسجيل (من بيانات المصادقة — مدخلات غير موثوقة)
create or replace function public.handle_new_profile()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
begin
  insert into public.profiles (id, display_name)
  values (new.id, coalesce(new.raw_user_meta_data ->> 'full_name', ''))
  on conflict (id) do nothing;
  return new;
end;
$$;

drop trigger if exists on_auth_user_created on auth.users;
create trigger on_auth_user_created
  after insert on auth.users
  for each row execute function public.handle_new_profile();

-- ─── 2) جدول المزامنة العام records ─────────────────────────────
-- صف واحد لكل عنصر بيانات في التطبيق (كائن JSON كامل) — نمط local-first
-- القياسي: العميل هو مصدر الحقيقة الحسابي، والسحابة تحفظ النسخة
-- المزامَنة لكل مستخدم مع شواهد القبور (deleted) لحذف متسق عبر الأجهزة.

create table if not exists public.records (
  id text primary key,                     -- معرّف العنصر (uuid من العميل)
  user_id uuid not null references auth.users (id) on delete cascade,
  kind text not null,                      -- اسم الجدول المحلي (transactions, tasks…)
  data jsonb not null default '{}'::jsonb, -- العنصر كاملاً كما هو محلياً
  client_ms bigint not null default 0,     -- آخر تعديل عميل (إيبوك مللي) — LWW
  deleted boolean not null default false,  -- شاهد قبر: محذوف
  updated_at timestamptz not null default now()  -- وقت الخادم — مؤشر السحب
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

-- ─── 3) دالة الدفع sync_push — دفعة واحدة ذرّية بمنطق LWW ───────
-- تستقبل مصفوفة عناصر: [{id, kind, data, client_ms, deleted}, …]
-- المنطق:
--   * صف جديد → إدراج.
--   * صف موجود لنفس المستخدم → تحديث فقط إذا كان الطابع الزمني القادم
--     أحدث أو مساوياً (>=) — أي كتابة قديمة لا تدوس على أحدث.
--   * صف موجود لمستخدم آخر (تصادم uuid نظري) → يُتجاهل ولا يُلمس أبداً.
-- security definer + فحوص auth.uid() الصريحة: الدالة تتجاوز RLS بأمان.

create or replace function public.sync_push(items jsonb)
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
    insert into public.records (id, user_id, kind, data, client_ms, deleted)
    values (
      r ->> 'id',
      auth.uid(),
      coalesce(r ->> 'kind', 'unknown'),
      coalesce(r -> 'data', '{}'::jsonb),
      coalesce((r ->> 'client_ms')::bigint, 0),
      coalesce((r ->> 'deleted')::boolean, false)
    )
    on conflict (id) do update
      set kind      = excluded.kind,
          data      = excluded.data,
          client_ms = excluded.client_ms,
          deleted   = excluded.deleted,
          updated_at = now()
      where public.records.user_id = auth.uid()
        and excluded.client_ms >= public.records.client_ms;
    n := n + 1;
  end loop;

  return n;
end;
$$;

grant execute on function public.sync_push (jsonb) to authenticated;
revoke execute on function public.sync_push (jsonb) from anon;

-- ─── 4) تنظيف شواهد القبور الأقدم من 90 يوماً (اختياري، يدوي) ────
-- المزامنة لا تحتاجه؛ للتنظيف الدوري شغّل عند الحاجة:
--
--   delete from public.records
--   where deleted and updated_at < now() - interval '90 days';
--
-- ═══════════════════════════════════════════════════════════════════
-- التحقق بعد التنفيذ (نفّذ كل سطر وتوقع الناتج):
--   select count(*) from public.profiles;            -- 0 أو أكثر
--   select count(*) from public.records;             -- 0
--   select proname from pg_proc where proname = 'sync_push';  -- sync_push
--
-- بعد نجاح الهجرة: افتح التطبيق، سجّل دخولك — ستتحول شارة المزامنة
-- من «تحتاج إعداد الجدول» إلى «متزامن» تلقائياً خلال دقائق.
-- ═══════════════════════════════════════════════════════════════════
