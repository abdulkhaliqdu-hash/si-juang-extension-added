create table if not exists public.profiles (
  id uuid primary key references auth.users (id) on delete cascade,
  role text not null check (role in ('kecamatan_admin'))
);

alter table public.profiles enable row level security;

revoke all on table public.profiles from anon, authenticated;
grant select on table public.profiles to authenticated;

drop policy if exists "Staf hanya dapat membaca profil sendiri" on public.profiles;
create policy "Staf hanya dapat membaca profil sendiri"
  on public.profiles
  for select
  to authenticated
  using ((select auth.uid()) = id);
