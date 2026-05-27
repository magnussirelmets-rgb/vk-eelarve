-- VK Eelarve — migratsioon 0009
-- Võimalda "manual" faili_tüüp hinnakirjadele (Magnuse käsitsi sisestatud teenused/tooted)
-- ja muuda faili_path nullable'iks (kuna käsitsi sisestatutel pole Storage faili).

alter table hinnakirjad alter column faili_path drop not null;

alter table hinnakirjad drop constraint if exists hinnakirjad_tüüp_check;
alter table hinnakirjad
  add constraint hinnakirjad_tüüp_check
  check (faili_tüüp in ('pdf','xlsx','csv','manual'));
