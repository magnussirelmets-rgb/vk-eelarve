-- Pakkumise malli-spetsiifilised lisaandmed: küttesüsteemi tüüp, tarbijate arvud,
-- PV süsteemi parameetrid jne — kõik malli-spetsiifilised väljad ühes JSONB-veerus.
-- Iga malli skeem defineeritakse lib/pakkumise-mallid.ts failis.

alter table pakkumised
  add column if not exists mall_andmed jsonb not null default '{}'::jsonb;

comment on column pakkumised.mall_andmed is
  'Malli-spetsiifilised väljad (kütte_tüüp, paneelide_arv, kraanikausse jne). Skeem: lib/pakkumise-mallid.ts';

notify pgrst, 'reload schema';
