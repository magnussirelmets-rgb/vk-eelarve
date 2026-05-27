-- VK Eelarve — migratsioon 0010
-- Reservi-rida positsioonid'esse: rida mille summa arvutatakse sektsiooni materjali %
-- järgi (nt Materjali varu 30%, Kinnitusvahendite varu 20%).
-- NULL = tavaline rida, NOT NULL = reserv (kogus arvutatakse, mitte salvestatakse).

alter table positsioonid
  add column if not exists reservi_koefitsent numeric(5,2);

-- CHECK: koefitsent peab olema positiivne kui väärtus olemas (% saab olla >100, nt 110%)
do $$ begin
  if not exists (
    select 1 from pg_constraint where conname = 'positsioonid_reservi_koefitsent_check'
  ) then
    alter table positsioonid
      add constraint positsioonid_reservi_koefitsent_check
      check (reservi_koefitsent is null or reservi_koefitsent > 0);
  end if;
end $$;
