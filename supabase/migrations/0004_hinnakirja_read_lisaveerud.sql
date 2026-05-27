-- VK Eelarve — migratsioon 0004
-- Lisaveerud `hinnakirja_read` tabelisse, et Magnuse tacit-teadmised
-- (paigaldusaeg + märkused + sünonüümid) saaksid otse tarnija toote küljes elada,
-- ilma vajaduseta läbi VK artikli abstraktsiooni minna.
--
-- Põhjus: 2026-05-16 — kasutaja eelistab tarnijate tootenimedega töötamist.
-- VK artikli (artiklid) kiht jääb andmebaasi alles aga UI'st kaob.

alter table hinnakirja_read
  add column if not exists "paigaldusaeg_h_ühik" numeric(5,2),
  add column if not exists "magnus_märkused" text,
  add column if not exists "magnus_alt_nimed" text;

-- Otsingu kiirendamiseks (mahutabel-matching otsib nimepõhiselt)
create index if not exists idx_hinnakirja_read_nimetus_otsing
  on hinnakirja_read using gin (
    to_tsvector('simple',
      coalesce(tarnija_nimetus, '')
      || ' ' || coalesce(tarnija_kood, '')
      || ' ' || coalesce(tarnija_brand, '')
      || ' ' || coalesce("magnus_alt_nimed", '')
    )
  );
