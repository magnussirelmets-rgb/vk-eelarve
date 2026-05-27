-- VK Eelarve — Päev 1 migratsioon
-- Tabelid: artiklid, hinnad
-- Vaade: artiklid_kehtivad_hinnaga
--
-- Jooksuta see Supabase SQL Editor's projekti tunmfpapwhkhungyfdnm peal.
-- Ohutu uuesti jooksutada: kõik DROP IF EXISTS ja CREATE TABLE IF NOT EXISTS.

-- ============================================================================
-- artiklid
-- ============================================================================

create table if not exists artiklid (
  id uuid primary key default gen_random_uuid(),
  kood text unique not null,
  osa text not null,
  alamosa text,
  sek_kood text,
  nimetus text not null,
  "tähis" text,
  "ühik" text,
  alt_nimed text,
  aktiivne boolean not null default true,
  loodud timestamptz not null default now(),
  uuendatud timestamptz not null default now(),
  constraint artiklid_osa_check check (osa in (
    'vesi','kanal','küte','sõlm','sanseade','ventilatsioon','jahutus','tulekustuti','muu'
  ))
);

create index if not exists idx_artiklid_osa
  on artiklid(osa) where aktiivne = true;

create index if not exists idx_artiklid_otsing
  on artiklid using gin (
    to_tsvector('simple',
      nimetus
      || ' ' || coalesce("tähis", '')
      || ' ' || coalesce(alt_nimed, '')
      || ' ' || kood
    )
  );

-- Hoia uuendatud-veerg värskena
create or replace function set_uuendatud_now()
returns trigger language plpgsql as $$
begin
  new.uuendatud := now();
  return new;
end $$;

drop trigger if exists artiklid_set_uuendatud on artiklid;
create trigger artiklid_set_uuendatud
  before update on artiklid
  for each row execute function set_uuendatud_now();

-- ============================================================================
-- hinnad — ajalooline log, iga muudatus uue reaga
-- ============================================================================

create table if not exists hinnad (
  id uuid primary key default gen_random_uuid(),
  artikkel_id uuid not null references artiklid(id) on delete cascade,
  ostuhind_neto numeric(10,2),
  "töö_h_ühik" numeric(5,2),
  kehtib_alates date not null default current_date,
  "märkused" text,
  loodud timestamptz not null default now(),
  constraint hinnad_vähemalt_üks_väärtus check (
    ostuhind_neto is not null or "töö_h_ühik" is not null
  )
);

create index if not exists idx_hinnad_artikkel
  on hinnad(artikkel_id, kehtib_alates desc);

-- ============================================================================
-- artiklid_kehtivad_hinnaga — JOIN annab praeguse kehtiva hinna
-- ============================================================================

create or replace view artiklid_kehtivad_hinnaga as
select
  a.*,
  h.ostuhind_neto,
  h."töö_h_ühik",
  h.kehtib_alates as hind_kehtib_alates
from artiklid a
left join lateral (
  select *
  from hinnad
  where artikkel_id = a.id
    and kehtib_alates <= current_date
  order by kehtib_alates desc
  limit 1
) h on true;
