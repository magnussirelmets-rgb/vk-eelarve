-- VK Eelarve — migratsioon 0007
-- Lisada tüüp veerg tootegrupid'esse: kas toode (materjal/seade) või teenus
-- (paigaldus, hooldus, konsultatsioon jne). Võimaldab kataloogi laiendada
-- soojuspumpadele ja teenustepõhistele pakkumistele.

alter table tootegrupid
  add column if not exists "tüüp" text not null default 'toode';

-- CHECK constraint (idempotent: drop+add)
do $$ begin
  if not exists (
    select 1 from pg_constraint where conname = 'tootegrupid_tüüp_check'
  ) then
    alter table tootegrupid
      add constraint tootegrupid_tüüp_check check ("tüüp" in ('toode', 'teenus'));
  end if;
end $$;

create index if not exists idx_tootegrupid_tüüp on tootegrupid("tüüp");
