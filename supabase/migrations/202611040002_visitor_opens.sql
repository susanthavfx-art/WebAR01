-- An open is recorded after login, not at QR scan time; it is not a purchase.
create table public.webar_visitor_opens (
  id bigint generated always as identity primary key,
  user_id uuid not null references auth.users(id) on delete cascade,
  publication_id uuid not null,
  opened_at timestamptz not null default now()
);
alter table public.webar_visitor_opens enable row level security;
revoke all on public.webar_visitor_opens from anon, authenticated;
grant insert (user_id, publication_id) on public.webar_visitor_opens to authenticated;
create policy "Visitor can record own open" on public.webar_visitor_opens for insert to authenticated with check ((select auth.uid()) = user_id);
