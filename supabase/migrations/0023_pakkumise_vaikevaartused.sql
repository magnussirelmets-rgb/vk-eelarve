-- 0023: Pakkumise default väärtused — tunnitasu 25→35, km_määr 20%→24%.
--
-- Pakkumise tunnitasu ja km_määr on per-pakkumine väljad (positsioonide arvutusele),
-- mida saab muuta `PakkumiseSeadedForm` kaudu detail-lehel. Migration mõjutab AINULT
-- uusi pakkumisi — olemasolevad pakkumised säilitavad oma praegused väärtused.

alter table pakkumised
  alter column tunnitasu set default 35,
  alter column km_määr set default 0.24;

comment on column pakkumised.tunnitasu is
  'Töötunni hind (€/h), kasutab positsioonide töökulu arvutuses. Default 35. Per-pakkumine muudetav.';
comment on column pakkumised.km_määr is
  'Käibemaksu määr murrarvuna (0.24 = 24%). Default 0.24. Per-pakkumine muudetav.';

notify pgrst, 'reload schema';
