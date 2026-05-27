-- VK Eelarve — migratsioon 0012
-- Mitu mahutabelit ühel pakkumisel (objektil). Iga mahutabel on eraldi PDF, mida
-- saab eraldi parssida; iga parsitud positsioon viitab oma mahutabelile, nii et
-- re-parse mõjutab ainult sama mahutabeli ridu, mitte teisi pakkumise positsioone.

create table if not exists pakkumise_mahutabelid (
  id uuid primary key default gen_random_uuid(),
  pakkumine_id uuid not null references pakkumised(id) on delete cascade,
  faili_path text not null,
  faili_nimi text,
  parsitud_ajal timestamptz,
  "märkused" text,
  loodud timestamptz not null default now()
);

create index if not exists idx_pakkumise_mahutabelid_pakkumine
  on pakkumise_mahutabelid(pakkumine_id);

-- Migreeri olemasolev primaarne mahutabel (pakkumised.mahutabel_pdf_path) uude tabelisse
insert into pakkumise_mahutabelid (pakkumine_id, faili_path, faili_nimi, parsitud_ajal)
select id, mahutabel_pdf_path, mahutabel_pdf_nimi, mahutabel_parsitud_ajal
from pakkumised
where mahutabel_pdf_path is not null
  and not exists (
    select 1 from pakkumise_mahutabelid pm where pm.pakkumine_id = pakkumised.id
  );

-- Positsioonidele lisa mahutabel_id FK (NULLable — ei pea olema, nt käsitsi loodud read)
alter table positsioonid
  add column if not exists mahutabel_id uuid references pakkumise_mahutabelid(id) on delete set null;

create index if not exists idx_positsioonid_mahutabel
  on positsioonid(mahutabel_id);

-- Lingi olemasolevad parsitud positsioonid esmase migreeritud mahutabeliga (kui üks)
update positsioonid p
set mahutabel_id = (
  select id from pakkumise_mahutabelid m
  where m.pakkumine_id = p.pakkumine_id
  order by m.loodud asc
  limit 1
)
where mahutabel_id is null;
