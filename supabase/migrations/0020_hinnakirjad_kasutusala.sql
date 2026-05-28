-- 0020: hinnakirjad — eristame kataloog-uuenduse ja projekti-pakkumise.
--
-- "kasutusala" = mis eesmärgil hinnakiri imporditi:
--   - 'kataloog_uuendus' — tootja püsi-hinnakiri (Alpha Innotec 2026v2 jne) → mõjutab kataloogi
--   - 'projekti_pakkumine' — materjalitarnija projektipõhine pakkumine (Küttemaailm projektile X)
--                            → seotud konkreetse pakkumisega, EI mõjuta üldist kataloogi
--
-- Aktiivne = ainult uusim sama-tarnija "kataloog_uuendus" hinnakiri on aktiivne;
-- vanemad versioonid jäävad ajalukku säilima (snapshot pakkumistes ei muutu).

alter table hinnakirjad
  add column if not exists kasutusala text not null default 'kataloog_uuendus'
    check (kasutusala in ('kataloog_uuendus', 'projekti_pakkumine')),
  add column if not exists pakkumine_id uuid references pakkumised(id) on delete cascade,
  add column if not exists kinnitatud_ajal timestamptz,
  add column if not exists kinnitanud text,
  add column if not exists aktiivne boolean not null default true;

-- Constraint: kui projekti_pakkumine, peab olema pakkumine_id;
-- kui kataloog_uuendus, ei tohi pakkumine_id'd olla
alter table hinnakirjad
  drop constraint if exists hinnakirjad_pakkumine_kohustuslik;
alter table hinnakirjad
  add constraint hinnakirjad_pakkumine_kohustuslik
    check (
      (kasutusala = 'kataloog_uuendus' and pakkumine_id is null)
      or (kasutusala = 'projekti_pakkumine' and pakkumine_id is not null)
    );

-- Tagantjärele: kõikidele olemasolevatele rakendub default 'kataloog_uuendus'.
-- Aktiivne tähistus per tarnija — uusim hinnakirja_id on aktiivne.
with rikastatud as (
  select id,
    row_number() over (
      partition by tarnija
      order by laetud_kuupäev desc, loodud desc
    ) as rn
  from hinnakirjad
  where kasutusala = 'kataloog_uuendus'
)
update hinnakirjad
   set aktiivne = (r.rn = 1)
  from rikastatud r
 where hinnakirjad.id = r.id;

create index if not exists hinnakirjad_kasutusala_idx on hinnakirjad(kasutusala);
create index if not exists hinnakirjad_pakkumine_id_idx on hinnakirjad(pakkumine_id);
create index if not exists hinnakirjad_tarnija_aktiivne_idx
  on hinnakirjad(tarnija) where aktiivne = true and kasutusala = 'kataloog_uuendus';

comment on column hinnakirjad.kasutusala is
  'kataloog_uuendus = tootja hinnakiri, mõjutab püsi-kataloogi. projekti_pakkumine = materjalitarnija projektipõhine pakkumine.';
comment on column hinnakirjad.aktiivne is
  'Ainult uusim sama-tarnija kataloog_uuendus on aktiivne. Vanemad versioonid jäävad ajalukku alles.';

notify pgrst, 'reload schema';
