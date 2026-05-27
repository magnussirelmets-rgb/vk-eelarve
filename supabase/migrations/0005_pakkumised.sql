-- VK Eelarve — migratsioon 0005
-- Tabelid: pakkumised, positsioonid
-- Storage: bucket "mahutabelid" (privaatne)
--
-- Jooksuta Supabase SQL Editor's. Ohutu uuesti jooksutada (IF NOT EXISTS).

-- ============================================================================
-- pakkumised — pakkumise päised
-- ============================================================================

create table if not exists pakkumised (
  id uuid primary key default gen_random_uuid(),
  vkp_nr text unique not null,
  peatöövõtja_nimi text,
  peatöövõtja_email text,
  objekt text,
  projekti_nr text,
  pakkumise_kuupäev date not null default current_date,
  kehtiv_kuni date,
  staatus text not null default 'mustand',

  -- Snapshotted konstandid (pakkumise loomise hetkel)
  tunnitasu numeric(5,2) not null default 25,
  kate_koefitsient numeric(4,2) not null default 1.30,
  km_määr numeric(3,2) not null default 0.20,

  -- Kortermaja skaalategurid (vt project-kortermaja-workflow mälu)
  püstikute_arv int,
  korterite_arv int,
  radiaatorite_arv int,
  keldrimagistraalide_jm numeric(8,2),
  väljavõtete_arv int,

  -- Mahutabel
  mahutabel_pdf_path text,            -- Storage object path
  mahutabel_pdf_nimi text,
  mahutabel_parsitud_ajal timestamptz,

  "märkused" text,
  loodud timestamptz not null default now(),
  uuendatud timestamptz not null default now(),
  constraint pakkumised_staatus_check check (staatus in (
    'mustand','parsitud','saadetud','võidetud','kaotatud'
  ))
);

create index if not exists idx_pakkumised_loodud
  on pakkumised(loodud desc);

drop trigger if exists pakkumised_set_uuendatud on pakkumised;
create trigger pakkumised_set_uuendatud
  before update on pakkumised
  for each row execute function set_uuendatud_now();

-- ============================================================================
-- positsioonid — pakkumise üksikud read (mahutabelist parsitud)
-- ============================================================================

create table if not exists positsioonid (
  id uuid primary key default gen_random_uuid(),
  pakkumine_id uuid not null references pakkumised(id) on delete cascade,
  rea_nr int,
  sektsioon text,                              -- nt "711" või "711 Veevarustus"
  nimetus text not null,
  "tähis" text,
  kogus numeric(10,3),
  "ühik" text,

  -- Hilisemas etapis: link tarnija tootele (hinnakirja_read.id)
  toode_id uuid references hinnakirja_read(id) on delete set null,
  toote_match_confidence numeric(3,2),
  toote_match_põhjendus text,

  -- Snapshots (kui toode valitud — säilib ka kui hinnakirja_read'i rida hiljem kustutakse)
  toode_snapshot_tarnija text,
  toode_snapshot_kood text,
  toode_snapshot_nimetus text,
  toode_snapshot_brand text,
  ostuhind_snapshot numeric(10,2),
  paigaldusaeg_snapshot numeric(5,2),

  pdf_rida_tekst text,
  manuaalselt_muudetud boolean not null default false,
  "märkused" text,
  loodud timestamptz not null default now(),
  uuendatud timestamptz not null default now()
);

create index if not exists idx_positsioonid_pakkumine
  on positsioonid(pakkumine_id, rea_nr);

drop trigger if exists positsioonid_set_uuendatud on positsioonid;
create trigger positsioonid_set_uuendatud
  before update on positsioonid
  for each row execute function set_uuendatud_now();

-- ============================================================================
-- Storage bucket "mahutabelid" (privaatne)
-- ============================================================================

insert into storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
values (
  'mahutabelid',
  'mahutabelid',
  false,
  20 * 1024 * 1024,
  array['application/pdf']
)
on conflict (id) do nothing;
