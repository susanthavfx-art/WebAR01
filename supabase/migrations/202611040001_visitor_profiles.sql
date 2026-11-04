-- QR visitor profiles. Only the authenticated owner can read or change a row.
-- Never use these fields as proof of purchase or proof of phone ownership.
create table if not exists public.webar_visitor_profiles (
  user_id uuid primary key references auth.users(id) on delete cascade,
  full_name text not null check (char_length(trim(full_name)) between 1 and 100),
  title text not null check (title in ('Mr', 'Mrs', 'Ms', 'Dr', 'Other', 'Prefer not to say')),
  whatsapp text not null check (whatsapp ~ '^\+[1-9][0-9]{7,14}$'),
  age_range text not null check (age_range in ('18-24', '25-34', '35-44', '45-54', '55+')),
  relationship text not null check (relationship in ('Parent or guardian', 'Teacher', 'Buying for myself', 'Other')),
  child_age_range text check (child_age_range is null or child_age_range in ('0-2', '3-5', '6-8', '9-12', '13-17')),
  whatsapp_marketing boolean not null default false,
  marketing_consent_at timestamptz,
  marketing_consent_version text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create or replace function public.webar_profile_consent_stamp() returns trigger
language plpgsql set search_path = '' as $$
begin
  if tg_op = 'INSERT' then
    new.created_at := now();
    if new.whatsapp_marketing then
      new.marketing_consent_at := now(); new.marketing_consent_version := 'v1';
    else
      new.marketing_consent_at := null; new.marketing_consent_version := null;
    end if;
  elsif new.whatsapp_marketing is distinct from old.whatsapp_marketing then
    if new.whatsapp_marketing then
      new.marketing_consent_at := now(); new.marketing_consent_version := 'v1';
    else
      new.marketing_consent_at := null; new.marketing_consent_version := null;
    end if;
  else
    new.created_at := old.created_at;
    new.marketing_consent_at := old.marketing_consent_at;
    new.marketing_consent_version := old.marketing_consent_version;
  end if;
  if tg_op = 'UPDATE' then new.created_at := old.created_at; end if;
  new.updated_at := now();
  return new;
end; $$;

drop trigger if exists webar_profile_consent on public.webar_visitor_profiles;
create trigger webar_profile_consent before insert or update on public.webar_visitor_profiles
for each row execute function public.webar_profile_consent_stamp();

alter table public.webar_visitor_profiles enable row level security;
revoke all on public.webar_visitor_profiles from anon, authenticated;
grant select, insert, update, delete on public.webar_visitor_profiles to authenticated;
create policy "Visitor can read own profile" on public.webar_visitor_profiles for select to authenticated using ((select auth.uid()) = user_id);
create policy "Visitor can create own profile" on public.webar_visitor_profiles for insert to authenticated with check ((select auth.uid()) = user_id);
create policy "Visitor can update own profile" on public.webar_visitor_profiles for update to authenticated using ((select auth.uid()) = user_id) with check ((select auth.uid()) = user_id);
create policy "Visitor can delete own profile" on public.webar_visitor_profiles for delete to authenticated using ((select auth.uid()) = user_id);
