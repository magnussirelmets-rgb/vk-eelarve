-- VK Eelarve — migratsioon 0011
-- Komplektid: korduvkasutatavad toote-/teenuse-rea kogumikud (paigalduskomplektid,
-- soojuspumba komplektid, käterätikuivati paigalduskomplektid jne).
-- Iga komplekt sisaldab N hinnakirja_read viidet + kogus + snapshot väljad.

create table if not exists komplektid (
  id uuid primary key default gen_random_uuid(),
  nimi text not null,
  kirjeldus text,
  "ühik" text not null default 'kompl',
  "märkused" text,
  loodud timestamptz not null default now(),
  uuendatud timestamptz not null default now()
);

create unique index if not exists idx_komplektid_nimi on komplektid(lower(nimi));

drop trigger if exists komplektid_set_uuendatud on komplektid;
create trigger komplektid_set_uuendatud
  before update on komplektid
  for each row execute function set_uuendatud_now();

-- Komplekti read — viide hinnakirja_read'ile + snapshot (säilib kui hinnakiri kustub)
create table if not exists komplekti_read (
  id uuid primary key default gen_random_uuid(),
  komplekt_id uuid not null references komplektid(id) on delete cascade,
  toode_id uuid references hinnakirja_read(id) on delete set null,
  -- Snapshot (loomise hetkel)
  nimetus text not null,
  tarnija text,
  tarnija_kood text,
  tarnija_brand text,
  "tähis" text,
  "ühik" text,
  ostuhind_snapshot numeric(10,2),
  "paigaldusaeg_h_ühik_snapshot" numeric(5,2),
  -- Käitumine komplektis
  kogus numeric(10,3) not null default 1,
  järjekord int not null default 1,
  loodud timestamptz not null default now()
);

create index if not exists idx_komplekti_read_komplekt
  on komplekti_read(komplekt_id, järjekord);
