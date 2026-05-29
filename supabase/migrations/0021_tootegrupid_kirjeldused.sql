-- 0021: tootegrupid kirjeldused — Faas 1 ettevalmistus.
--
-- Eesmärk: ühe SWC-mudeli kirjeldus 8 mudeli vahel ei pea käsitsi 8× sisestatud
-- olema. tootegrupp = "SWC V-Line", template_kirjeldus = "On-off maaküttepump
-- {kw} kW võimsusega, COP kuni 4.9...", ja iga mudeli (62, 92, 122, 162, 192) kohta
-- hinnakirja_read.kirjeldus renderdatakse template'ist {kw} placeholder'iga.
--
-- pakkumise_kirjeldus — pikem versioon, mida kasutame pakkumise PDF trükivormis.
-- template_kirjeldus — lühem, kataloogi vaates kuvatav.
-- garantii_aastad — selgesõnaliselt, mitte ainult kirjelduses (sorting/filtering jaoks).

alter table tootegrupid
  add column if not exists template_kirjeldus text,
  add column if not exists pakkumise_kirjeldus text,
  add column if not exists garantii_aastad integer
    check (garantii_aastad is null or (garantii_aastad >= 0 and garantii_aastad <= 50));

comment on column tootegrupid.template_kirjeldus is
  'Lühem kataloogi-tasandi kirjeldus toetab placeholderites {kw}, {mudel}, {maht}. Renderdatakse hinnakirja_read.kirjeldus puuduva korral.';
comment on column tootegrupid.pakkumise_kirjeldus is
  'Pikem versioon mida kuvatakse pakkumise PDF trükivormis (rea juures, kui linnuke "Näita ridu" sees).';
comment on column tootegrupid.garantii_aastad is
  'Tootja garantii aastates. Eraldatud kirjeldusest sorteerimise/filtreerimise jaoks (vt Hybrox seeria erand 2 aastat vs 5 aastat).';

notify pgrst, 'reload schema';
