-- VK Eelarve — migratsioon 0006
-- Tootegrupid (Isolatsioon, PE-X torustik, Komposiittoru jne)
-- Igale grupile saab määrata paigaldusaja ja kate-koefitsiendi override'i,
-- mis kandub automaatselt grupi liikmetele (sõltumatult per-toote override'ist).

create table if not exists tootegrupid (
  id uuid primary key default gen_random_uuid(),
  nimi text not null,
  kirjeldus text,
  paigaldusaeg_h_ühik numeric(5,2),                -- grupi vaikimisi
  kate_koefitsient_override numeric(4,2),          -- NULL → kasuta pakkumise oma
  "märkused" text,
  loodud timestamptz not null default now(),
  uuendatud timestamptz not null default now()
);

create unique index if not exists idx_tootegrupid_nimi
  on tootegrupid(lower(nimi));

drop trigger if exists tootegrupid_set_uuendatud on tootegrupid;
create trigger tootegrupid_set_uuendatud
  before update on tootegrupid
  for each row execute function set_uuendatud_now();

-- hinnakirja_read.tootegrupp_id — toode kuulub null/1 grupisse
alter table hinnakirja_read
  add column if not exists tootegrupp_id uuid references tootegrupid(id) on delete set null;

create index if not exists idx_hinnakirja_read_tootegrupp
  on hinnakirja_read(tootegrupp_id);

-- positsioonid.kate_snapshot — pakkumise hetkel kasutatud kate
-- (kas grupi override või pakkumise vaikimisi); säilib pakkumisel
alter table positsioonid
  add column if not exists kate_snapshot numeric(4,2);
