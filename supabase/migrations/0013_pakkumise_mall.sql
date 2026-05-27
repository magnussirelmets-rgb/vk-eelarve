-- Pakkumise mall: erinevad lähtepunktid uue pakkumise loomisel.
-- Igal mallil omad soovituslikud eriosad + skaalategurid (vt lib/pakkumise-mallid.ts).

alter table pakkumised
  add column if not exists mall text not null default 'kortermaja_rekonstr';

comment on column pakkumised.mall is
  'Pakkumise mall: kortermaja_rekonstr | eramaja_kvvk | vesi_kanal | pv_susteem | ehitustood';

create index if not exists pakkumised_mall_idx on pakkumised(mall);

notify pgrst, 'reload schema';
