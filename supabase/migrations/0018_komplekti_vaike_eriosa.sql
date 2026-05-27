-- Komplekti vaike-eriosa: kui komplekt on alati seotud kindla eriosaga
-- (nt "726 Puurkaevude rajamine"), siis salvesta see kohe komplekti küljes.
-- "Lisa komplekt eriosana" dialoog prefillib selle, et uus töötaja ei pea pähe õppima
-- mis eriosasse mingi komplekt kuulub.

alter table komplektid
  add column if not exists vaike_sektsioon text,
  add column if not exists vaike_alamsektsioon text;

comment on column komplektid.vaike_sektsioon is
  'Vaike-eriosa (sektsioon) mis pakutakse "Lisa komplekt eriosana" dialoogis. Nt "726 Puurkaevude rajamine".';

notify pgrst, 'reload schema';
