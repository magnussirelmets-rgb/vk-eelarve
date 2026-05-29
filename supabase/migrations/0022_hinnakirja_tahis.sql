-- 0022: hinnakirja_read."tähis" — toote tähistus (DN20, K110, 1 1/4" jne)
--
-- Bug-fix: kataloog Excel-eksport sisaldab "tähis" veergu (vt /api/kataloog/export),
-- kuid hinnakirja_read tabelis seda kunagi polnud. Import 508 rea peal failis.
--
-- Tähis on kataloogi otsingul oluline (Magnus otsib "DN20" järgi). Snapshot
-- positsioonidele toimub edaspidi seoToode kaudu (arvutaSnapshot uuendus
-- hilisemas commit'is — eraldi feature).

alter table hinnakirja_read
  add column if not exists "tähis" text;

create index if not exists hinnakirja_read_tahis_idx
  on hinnakirja_read("tähis")
  where "tähis" is not null;

comment on column hinnakirja_read."tähis" is
  'Toote tähistus (DN20, K110, 1 1/4" jne). Snapshotitakse positsioonidele seoToode kaudu.';

notify pgrst, 'reload schema';
