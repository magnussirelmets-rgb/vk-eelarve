-- VK Eelarve — migratsioon 0003
-- Tabelid: hinnakirjad, hinnakirja_read, tarnija_artiklid
-- Storage: bucket "hinnakirjad" (privaatne)
--
-- Jooksuta Supabase SQL Editor's projekti tunmfpapwhkhungyfdnm peal.
-- Ohutu uuesti jooksutada (kõik IF NOT EXISTS / ON CONFLICT DO NOTHING).

-- ============================================================================
-- hinnakirjad — üles laaditud tarnija hinnakirjad
-- ============================================================================

create table if not exists hinnakirjad (
  id uuid primary key default gen_random_uuid(),
  tarnija text not null,
  faili_path text not null,                -- Storage object path (nt "Küttemaailm/2026-05-15-uuid.pdf")
  faili_nimi text,                         -- algne kasutaja-faili nimi
  faili_tüüp text not null,                -- pdf | xlsx | csv
  laetud_kuupäev date not null default current_date,
  staatus text not null default 'mustand', -- mustand | parsitud | matched | kinnitatud | viga
  artiklite_arv int not null default 0,
  viga_tekst text,                         -- kui parse / match ebaõnnestus
  "märkused" text,
  loodud timestamptz not null default now(),
  uuendatud timestamptz not null default now(),
  constraint hinnakirjad_staatus_check check (staatus in (
    'mustand','parsitud','matched','kinnitatud','viga'
  )),
  constraint hinnakirjad_tüüp_check check (faili_tüüp in ('pdf','xlsx','csv'))
);

create index if not exists idx_hinnakirjad_loodud
  on hinnakirjad(loodud desc);

drop trigger if exists hinnakirjad_set_uuendatud on hinnakirjad;
create trigger hinnakirjad_set_uuendatud
  before update on hinnakirjad
  for each row execute function set_uuendatud_now();

-- ============================================================================
-- hinnakirja_read — parsitud read enne lõplikku kinnitamist
-- ============================================================================

create table if not exists hinnakirja_read (
  id uuid primary key default gen_random_uuid(),
  hinnakiri_id uuid not null references hinnakirjad(id) on delete cascade,
  rea_nr int,                              -- järjekord PDF-is
  tarnija_kood text,                       -- nt 1500006, 1030ST040, või NULL
  tarnija_nimetus text not null,
  tarnija_brand text,                      -- Slovarm, Danfoss, Imas jne
  sektsioon text,                          -- "Vesivarustus", "TORUSTIK" jne
  jaehind_neto numeric(10,2),              -- enne allahindlust (Küttemaailm)
  ah_protsent numeric(5,2),                -- allahindluse % (Küttemaailm)
  ostuhind_neto numeric(10,2),             -- tegelik ostuhind (KRIITILINE)
  "ühik" text,
  kogus numeric(10,3),
  pakkumise_summa numeric(10,2),
  vk_artikkel_id uuid references artiklid(id) on delete set null,
  match_confidence numeric(3,2),           -- 0.00 - 1.00 (Claude AI fuzzy match)
  match_põhjendus text,                    -- Claude'i põhjendus matchi kohta
  staatus text not null default 'matchimata', -- matchimata | matchitud | kinnitatud | ignoreeritud | uus_artikkel
  loodud timestamptz not null default now(),
  uuendatud timestamptz not null default now(),
  constraint hinnakirja_read_staatus_check check (staatus in (
    'matchimata','matchitud','kinnitatud','ignoreeritud','uus_artikkel'
  )),
  constraint hinnakirja_read_confidence_range
    check (match_confidence is null or (match_confidence >= 0 and match_confidence <= 1))
);

create index if not exists idx_hinnakirja_read_hinnakiri
  on hinnakirja_read(hinnakiri_id, rea_nr);

create index if not exists idx_hinnakirja_read_vk_artikkel
  on hinnakirja_read(vk_artikkel_id) where vk_artikkel_id is not null;

drop trigger if exists hinnakirja_read_set_uuendatud on hinnakirja_read;
create trigger hinnakirja_read_set_uuendatud
  before update on hinnakirja_read
  for each row execute function set_uuendatud_now();

-- ============================================================================
-- tarnija_artiklid — püsiv seos VK artikli ja tarnija artikli vahel
-- ============================================================================

create table if not exists tarnija_artiklid (
  id uuid primary key default gen_random_uuid(),
  vk_artikkel_id uuid not null references artiklid(id) on delete cascade,
  tarnija text not null,
  tarnija_kood text,
  tarnija_nimetus text,
  tarnija_brand text,
  viimane_ostuhind numeric(10,2),
  viimane_jaehind numeric(10,2),
  viimane_ah_protsent numeric(5,2),
  viimati_uuendatud timestamptz not null default now(),
  "märkused" text,
  -- Üks tarnija_kood samale (tarnija, VK artikkel) paarile peab olema unikaalne.
  -- NULL tarnija_kood võimaldab mitut "nimepõhist" matchi (eri sõnastusega).
  unique (vk_artikkel_id, tarnija, tarnija_kood)
);

create index if not exists idx_tarnija_artiklid_vk
  on tarnija_artiklid(vk_artikkel_id);

create index if not exists idx_tarnija_artiklid_lookup
  on tarnija_artiklid(tarnija, tarnija_kood) where tarnija_kood is not null;

-- ============================================================================
-- Storage bucket "hinnakirjad" (privaatne)
-- ============================================================================

insert into storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
values (
  'hinnakirjad',
  'hinnakirjad',
  false,
  20 * 1024 * 1024, -- 20 MB
  array[
    'application/pdf',
    'application/vnd.ms-excel',
    'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
    'text/csv'
  ]
)
on conflict (id) do nothing;

-- RLS märkus: kasutame ainult service role võtit serveris (bypass RLS).
-- Bucket on private — failid ligipääsetavad ainult signed URL-i kaudu, mille
-- loob server action `getServerSupabase().storage.from(...).createSignedUrl(...)`.
