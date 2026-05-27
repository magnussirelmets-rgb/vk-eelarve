-- VK Eelarve — migratsioon 0002
-- Eesmärk: vaate `artiklid_kehtivad_hinnaga` parandus.
--
-- Probleem: praegu kasutab vaade ÜHTE LATERAL JOIN'i, mis võtab viimase `hinnad` rea
-- ostuhind + töötund koos. Kui Magnus muudab ainult töötunni (lisab rea kus
-- ostuhind=NULL), kaob vana ostuhind vaate alt välja.
--
-- Lahendus: kaks sõltumatut lateral join'i. Iga väli (ostuhind_neto, töö_h_ühik) saab
-- oma viimase mitte-NULL väärtuse hinnaajaloost. Tühjaks jäetud väli `hinnad` reas
-- ei kustuta enam kehtiva väärtuse vaadet.
--
-- `hind_kehtib_alates` = max kahest viimasest muudatuse kuupäevast (GREATEST ignoreerib NULL'i).
--
-- Ohutu uuesti jooksutada.

create or replace view artiklid_kehtivad_hinnaga as
select
  a.*,
  oh.ostuhind_neto,
  th."töö_h_ühik",
  greatest(oh.kehtib_alates, th.kehtib_alates) as hind_kehtib_alates
from artiklid a
left join lateral (
  select ostuhind_neto, kehtib_alates
  from hinnad
  where artikkel_id = a.id
    and ostuhind_neto is not null
    and kehtib_alates <= current_date
  order by kehtib_alates desc
  limit 1
) oh on true
left join lateral (
  select "töö_h_ühik", kehtib_alates
  from hinnad
  where artikkel_id = a.id
    and "töö_h_ühik" is not null
    and kehtib_alates <= current_date
  order by kehtib_alates desc
  limit 1
) th on true;
