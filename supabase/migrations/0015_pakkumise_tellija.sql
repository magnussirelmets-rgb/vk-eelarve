-- Nimeta peatöövõtja → tellija. Lisa tellija_telefon väli.
-- Andmed säilivad (column rename ei muuda väärtusi).

alter table pakkumised rename column "peatöövõtja_nimi" to "tellija_nimi";
alter table pakkumised rename column "peatöövõtja_email" to "tellija_email";

alter table pakkumised
  add column if not exists tellija_telefon text;

notify pgrst, 'reload schema';
