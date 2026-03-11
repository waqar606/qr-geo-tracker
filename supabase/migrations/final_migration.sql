create extension if not exists pgcrypto;

-- 1) Create tables if missing
create table if not exists public.qr_codes (
  id uuid primary key default gen_random_uuid(),
  user_id uuid references auth.users(id) on delete set null default auth.uid(),
  name text not null default 'Untitled QR Code',
  type text not null,
  content jsonb not null default '{}'::jsonb,
  style jsonb not null default '{}'::jsonb,
  paused boolean not null default false,
  file_url text,
  file_urls text[],
  created_at timestamptz not null default now()
);

create table if not exists public.qr_scans (
  id uuid not null default gen_random_uuid() primary key,
  qr_code_id uuid not null references public.qr_codes(id) on delete cascade,
  owner_id uuid references auth.users(id) on delete set null,
  scanned_at timestamptz not null default now(),
  operating_system text,
  country text,
  city text,
  region text,
  ip_address text,
  user_agent text
);

-- 2) If tables already existed, ensure columns exist
alter table public.qr_codes add column if not exists user_id uuid references auth.users(id) on delete set null;
alter table public.qr_codes alter column user_id set default auth.uid();

alter table public.qr_scans add column if not exists owner_id uuid references auth.users(id) on delete set null;

-- 3) Indexes
create index if not exists idx_qr_codes_user_id on public.qr_codes(user_id);
create index if not exists idx_qr_scans_owner_id on public.qr_scans(owner_id);
create index if not exists idx_qr_scans_qr_code_id on public.qr_scans(qr_code_id);
create index if not exists idx_qr_scans_scanned_at on public.qr_scans(scanned_at);

-- 4) RLS
alter table public.qr_codes enable row level security;
alter table public.qr_scans enable row level security;

-- Drop old permissive policies if present
drop policy if exists "QR codes are publicly readable" on public.qr_codes;
drop policy if exists "Anyone can create QR codes" on public.qr_codes;
drop policy if exists "Anyone can update QR codes" on public.qr_codes;
drop policy if exists "Anyone can delete QR codes" on public.qr_codes;

drop policy if exists "Anyone can read scans" on public.qr_scans;
drop policy if exists "Anyone can insert scans" on public.qr_scans;

-- New owner-only policies
drop policy if exists "qr_codes_select_own" on public.qr_codes;
drop policy if exists "qr_codes_insert_own" on public.qr_codes;
drop policy if exists "qr_codes_update_own" on public.qr_codes;
drop policy if exists "qr_codes_delete_own" on public.qr_codes;

create policy "qr_codes_select_own"
  on public.qr_codes for select
  using (auth.role() = 'authenticated' and user_id = auth.uid());

create policy "qr_codes_insert_own"
  on public.qr_codes for insert
  with check (auth.role() = 'authenticated' and user_id = auth.uid());

create policy "qr_codes_update_own"
  on public.qr_codes for update
  using (auth.role() = 'authenticated' and user_id = auth.uid())
  with check (auth.role() = 'authenticated' and user_id = auth.uid());

create policy "qr_codes_delete_own"
  on public.qr_codes for delete
  using (auth.role() = 'authenticated' and user_id = auth.uid());

drop policy if exists "qr_scans_select_owner" on public.qr_scans;
create policy "qr_scans_select_owner"
  on public.qr_scans for select
  using (auth.role() = 'authenticated' and owner_id = auth.uid());

-- 5) Storage bucket (no error if it already exists)
insert into storage.buckets (id, name, public)
values ('qr-files', 'qr-files', true)
on conflict (id) do nothing;

-- Storage policies
drop policy if exists "QR files are publicly accessible" on storage.objects;
create policy "QR files are publicly accessible"
  on storage.objects for select
  using (bucket_id = 'qr-files');

drop policy if exists "Anyone can upload QR files" on storage.objects;
drop policy if exists "Authenticated can upload QR files" on storage.objects;
create policy "Authenticated can upload QR files"
  on storage.objects for insert
  with check (bucket_id = 'qr-files' and auth.role() = 'authenticated');