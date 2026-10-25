begin;

alter table public.profiles
  add column if not exists gampong text;

alter table public.profiles
  drop constraint if exists profiles_role_check;

alter table public.profiles
  drop constraint if exists profiles_gampong_role_check;

alter table public.profiles
  add constraint profiles_role_check
  check (role in ('kecamatan_admin', 'operator'));

alter table public.profiles
  add constraint profiles_gampong_role_check
  check (
    (role = 'kecamatan_admin' and gampong is null)
    or (
      role = 'operator'
      and gampong in (
        'Bandar Bireuen',
        'Bireuen Meunasah Blang',
        'Bireuen Meunasah Capa',
        'Bireuen Meunasah Dayah',
        'Bireuen Meunasah Reuleut',
        'Bireuen Meunasah Teungku Digadong',
        'Blang Reuling',
        'Blang Tingkeum',
        'Buket Teukueh',
        'Cot Gapu',
        'Cot Jrat',
        'Cot Peutek',
        'Gampong Baro',
        'Geudong Alue',
        'Geudong-Geudong',
        'Geulanggang Baro',
        'Geulanggang Gampong',
        'Geulanggang Kulam',
        'Geulanggang Teungoh',
        'Lhok Awe Teungoh',
        'Pulo Ara Geudong Teungoh',
        'Pulo Kiton',
        'Uteun Reutoh'
      )
    )
  );

create table if not exists public.submissions (
  id uuid primary key default gen_random_uuid(),
  request_code text not null unique default (
    'SJ-' || to_char(now(), 'YYYY') || '-' ||
    upper(substr(replace(gen_random_uuid()::text, '-', ''), 1, 8))
  ),
  submitted_by uuid not null references auth.users (id) on delete restrict,
  gampong text not null,
  jenis_surat text not null
    check (jenis_surat in ('SKTM', 'SKU', 'Surat Rekomendasi Kecamatan')),
  nama_pemohon text not null
    check (char_length(btrim(nama_pemohon)) between 1 and 120),
  keterangan text
    check (keterangan is null or char_length(keterangan) <= 1000),
  drive_url text not null
    check (drive_url ~ '^https://(drive\.google\.com|docs\.google\.com)/'),
  status text not null default 'Verifikasi'
    check (status in ('Verifikasi', 'Srikandi', 'Selesai TTE', 'Ditolak', 'Batal')),
  created_at timestamptz not null default now()
);

alter table public.submissions
  drop constraint if exists submissions_jenis_surat_check;

alter table public.submissions
  add constraint submissions_jenis_surat_check
  check (
    jenis_surat in (
      'SKTM',
      'SKU',
      'Surat Rekomendasi Kecamatan',
      'Surat keterangan domisili atau tempat tinggal',
      'Surat keterangan penghasilan orang tua (untuk beasiswa dan sekolah)',
      'Surat keterangan kelahiran dan kematian (pengantar ke Dukcapil)',
      'Surat pengantar pindah atau datang',
      'Surat pengantar SKCK, pengantar nikah (ke KUA), dan pengantar pengurusan KTP, KK, atau BPJS/KIS',
      'Surat keterangan ahli waris atau beda nama (sebagai pengantar)',
      'Surat pengantar izin keramaian atau kegiatan masyarakat'
    )
  );

create index if not exists submissions_created_at_idx
  on public.submissions (created_at desc);

create index if not exists submissions_gampong_idx
  on public.submissions (gampong);

alter table public.profiles enable row level security;
alter table public.submissions enable row level security;

grant select on public.profiles to authenticated;
revoke all on public.submissions from anon, authenticated;
grant select on public.submissions to authenticated;
grant update (status) on public.submissions to authenticated;

drop policy if exists "Pengguna membaca profil sendiri" on public.profiles;
create policy "Pengguna membaca profil sendiri"
  on public.profiles
  for select
  to authenticated
  using ((select auth.uid()) = id);

drop policy if exists "Admin membaca semua pengajuan" on public.submissions;
create policy "Admin membaca semua pengajuan"
  on public.submissions
  for select
  to authenticated
  using (
    exists (
      select 1
      from public.profiles
      where profiles.id = (select auth.uid())
        and profiles.role = 'kecamatan_admin'
    )
  );

drop policy if exists "Operator membaca pengajuan sendiri" on public.submissions;
create policy "Operator membaca pengajuan sendiri"
  on public.submissions
  for select
  to authenticated
  using (submitted_by = (select auth.uid()));

drop policy if exists "Admin mengubah status pengajuan" on public.submissions;
create policy "Admin mengubah status pengajuan"
  on public.submissions
  for update
  to authenticated
  using (
    exists (
      select 1
      from public.profiles
      where profiles.id = (select auth.uid())
        and profiles.role = 'kecamatan_admin'
    )
  )
  with check (
    exists (
      select 1
      from public.profiles
      where profiles.id = (select auth.uid())
        and profiles.role = 'kecamatan_admin'
    )
  );

create or replace function public.submit_document(
  p_jenis_surat text,
  p_nama_pemohon text,
  p_keterangan text,
  p_drive_url text
)
returns jsonb
language plpgsql
security definer
set search_path = public, pg_temp
as $$
declare
  current_profile public.profiles%rowtype;
  inserted_submission public.submissions%rowtype;
begin
  if auth.uid() is null then
    raise exception 'Login diperlukan.';
  end if;

  select *
  into current_profile
  from public.profiles
  where id = (select auth.uid());

  if not found or current_profile.role <> 'operator' or current_profile.gampong is null then
    raise exception 'Akun ini tidak terdaftar sebagai operator gampong.';
  end if;

  if p_jenis_surat is null or p_jenis_surat not in (
    'SKTM',
    'SKU',
    'Surat Rekomendasi Kecamatan',
    'Surat keterangan domisili atau tempat tinggal',
    'Surat keterangan penghasilan orang tua (untuk beasiswa dan sekolah)',
    'Surat keterangan kelahiran dan kematian (pengantar ke Dukcapil)',
    'Surat pengantar pindah atau datang',
    'Surat pengantar SKCK, pengantar nikah (ke KUA), dan pengantar pengurusan KTP, KK, atau BPJS/KIS',
    'Surat keterangan ahli waris atau beda nama (sebagai pengantar)',
    'Surat pengantar izin keramaian atau kegiatan masyarakat'
  ) then
    raise exception 'Jenis surat tidak valid.';
  end if;

  if p_nama_pemohon is null
    or char_length(btrim(p_nama_pemohon)) not between 1 and 120 then
    raise exception 'Nama pemohon wajib diisi dan maksimal 120 karakter.';
  end if;

  if p_keterangan is not null and char_length(p_keterangan) > 1000 then
    raise exception 'Keterangan maksimal 1.000 karakter.';
  end if;

  if p_drive_url is null
    or p_drive_url !~ '^https://(drive\.google\.com|docs\.google\.com)/' then
    raise exception 'Tautan Google Drive tidak valid.';
  end if;

  insert into public.submissions (
    submitted_by,
    gampong,
    jenis_surat,
    nama_pemohon,
    keterangan,
    drive_url
  )
  values (
    (select auth.uid()),
    current_profile.gampong,
    p_jenis_surat,
    btrim(p_nama_pemohon),
    nullif(btrim(p_keterangan), ''),
    p_drive_url
  )
  returning * into inserted_submission;

  return jsonb_build_object(
    'id', inserted_submission.id,
    'request_code', inserted_submission.request_code,
    'created_at', inserted_submission.created_at
  );
end;
$$;

revoke all on function public.submit_document(text, text, text, text) from public, anon;
grant execute on function public.submit_document(text, text, text, text) to authenticated;

notify pgrst, 'reload schema';

commit;
