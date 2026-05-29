-- 0025: Klient + Objekt hierarhia (Faas A).
--
-- Eesmärk: tellija_nimi/email/telefon ja objekt+projekti_nr olid praeguseni
-- pakkumistel denormaliseeritud stringidena. Magnusel oli vaja:
--   * Vaade "kõik selle objekti pakkumised" (eriti kui korduvad tellimised)
--   * Vaade "kõik selle kliendi objektid"
--   * "Uus pakkumine samale objektile" ilma kopeerimiseta
--   * Klient-juriidiline isik vs eraisik eristamine arvete jaoks
--
-- Struktuur:
--   kliendid (eraisik | juriidiline)
--   ↓ klient_id (ON DELETE CASCADE — kliendi kustutus võtab kaasa tema objektid)
--   objektid
--   ↓ objekt_id (ON DELETE SET NULL pakkumised — säilita ajalugu)
--   pakkumised
--
-- Olemasolevad pakkumised.tellija_nimi/email/telefon + objekt + projekti_nr
-- jäävad veergudena alles (snapshot — säilita ajalugu nagu tellija oli pakkumise
-- loomise hetkel). Andmemigratsioon (eraldi skript 0025-andmemigratsioon.cjs)
-- täidab klient_id + objekt_id välju uutele FK-veergudele.

-- 1) Kliendid
create table if not exists kliendid (
  id uuid primary key default gen_random_uuid(),
  nimi text not null,
  tüüp text not null default 'eraisik'
    check (tüüp in ('eraisik', 'juriidiline')),
  email text,
  telefon text,
  -- Juriidilise kohustuslik kuid CHECK'iga ei sundida (võimaldab kasutajal
  -- järk-järgult täiendada); UI peaks kuvama hoiatust kui juriidiline + tühi
  registrikood text,
  km_kohustuslane boolean default false,
  km_nr text,
  -- Tellija-ülesed märkused (sisemine, ei kanta pakkumistele)
  märkused text,
  loodud timestamptz not null default now(),
  uuendatud timestamptz not null default now()
);

create index if not exists kliendid_nimi_idx on kliendid (lower(nimi));
create index if not exists kliendid_telefon_idx on kliendid (telefon)
  where telefon is not null;
create index if not exists kliendid_email_idx on kliendid (lower(email))
  where email is not null;

comment on table kliendid is
  'Eraisikud + juriidilised isikud. Ühe kliendi alla võib kuuluda mitu objekti, igal objektil mitu pakkumist.';
comment on column kliendid.tüüp is
  'eraisik = isikukood + nimi; juriidiline = registrikood + ärinimi. Eristus on UI/arvete jaoks.';
comment on column kliendid.km_kohustuslane is
  'Kas klient on KM-kohustuslane (Eestis äriregistri info). Mõjutab arve märgistust.';

-- 2) Objektid
create table if not exists objektid (
  id uuid primary key default gen_random_uuid(),
  klient_id uuid not null references kliendid(id) on delete cascade,
  nimi text not null,
  -- Vorming vabavalitav: "Veskijärve tn 16, Haljala" või "Tartu, Lossi 5" jne
  aadress text,
  projekti_nr text,
  hoone_tüüp text
    check (hoone_tüüp is null or hoone_tüüp in
      ('kortermaja','eramaja','rida_paarismaja','ärihoone','tööstushoone','muu')),
  -- Mahud + märkused mida saab kasutada pakkumiste loomisel default'idena
  korterite_arv integer,
  korruste_arv integer,
  pindala_m2 numeric,
  märkused text,
  loodud timestamptz not null default now(),
  uuendatud timestamptz not null default now()
);

create index if not exists objektid_klient_idx on objektid (klient_id);
create index if not exists objektid_nimi_idx on objektid (lower(nimi));
create index if not exists objektid_projekti_nr_idx on objektid (projekti_nr)
  where projekti_nr is not null;

comment on table objektid is
  'Konkreetne objekt (aadress + projekt) kliendi alluvuses. Ühel kliendil võib olla mitu objekti.';
comment on column objektid.korterite_arv is
  'Korterite arv mis kantakse pakkumise loomisel skaalateguri default''iks (kortermaja puhul).';

-- 3) Pakkumised FK-d (säilita tellija_* string-veerud snapshotina)
alter table pakkumised
  add column if not exists klient_id uuid references kliendid(id) on delete set null,
  add column if not exists objekt_id uuid references objektid(id) on delete set null;

create index if not exists pakkumised_klient_id_idx on pakkumised(klient_id)
  where klient_id is not null;
create index if not exists pakkumised_objekt_id_idx on pakkumised(objekt_id)
  where objekt_id is not null;

comment on column pakkumised.klient_id is
  'Viide kliendile (Faas A). NULL = ajalooline pakkumine enne hierarhia kasutuselevõttu või klient kustutatud (tellija_nimi/email/telefon säilivad snapshotina).';
comment on column pakkumised.objekt_id is
  'Viide objektile (Faas A). NULL = ajalooline pakkumine või objekt kustutatud (objekt + projekti_nr säilivad snapshotina).';

-- 4) Trigger uuendatud-väärtuste automaatseks update'iks
create or replace function set_uuendatud_klient()
returns trigger language plpgsql as $$
begin
  new.uuendatud := now();
  return new;
end$$;

drop trigger if exists kliendid_uuendatud on kliendid;
create trigger kliendid_uuendatud before update on kliendid
  for each row execute function set_uuendatud_klient();

drop trigger if exists objektid_uuendatud on objektid;
create trigger objektid_uuendatud before update on objektid
  for each row execute function set_uuendatud_klient();

notify pgrst, 'reload schema';
