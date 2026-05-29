-- 0019: Unique constraint (hinnakiri_id, tarnija_kood) hinnakirja_read tabelile.
--
-- Eesmärk: vältida edaspidi sama tarnija_kood'iga duplikaate ühe hinnakirja sees.
-- Üle erinevate hinnakirjade on sama kood lubatud (nt sama Slovarmi kood
-- AIT-Nord 2025-1 ja 2026v2 hinnakirjades on tegelikult eraldi hinnaversioonid).
--
-- Reegel: NULL ja tühi tarnija_kood välistatakse indeksist (kataloog võib
-- sisaldada käsitsi sisestatud teenuseid ilma koodita).

-- 1) Puhasta duplikaadid kui mõni leitakse (säilitab hiljem-uuendatud rea)
with rikastatud as (
  select id,
    row_number() over (
      partition by hinnakiri_id, tarnija_kood
      order by uuendatud desc, length(coalesce(tarnija_nimetus, '')) desc, id
    ) as rn
  from hinnakirja_read
  where tarnija_kood is not null and tarnija_kood <> ''
)
delete from hinnakirja_read
where id in (select id from rikastatud where rn > 1);

-- 2) Partial unique index
create unique index if not exists hinnakirja_read_kood_per_hinnakiri
  on hinnakirja_read (hinnakiri_id, tarnija_kood)
  where tarnija_kood is not null and tarnija_kood <> '';

comment on index hinnakirja_read_kood_per_hinnakiri is
  'Üks tarnija_kood per hinnakiri. NULL ja tühi kood välistatud (manual entries).';

notify pgrst, 'reload schema';
