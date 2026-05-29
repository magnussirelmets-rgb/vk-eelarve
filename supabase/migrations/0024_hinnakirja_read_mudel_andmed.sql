-- 0024: hinnakirja_read.mudel_andmed jsonb — placeholder väärtused template_kirjeldus jaoks.
--
-- Eesmärk: kui tootegrupp = "SWC V-Line" ja template_kirjeldus = "On-off maaküttepump {kw} kW...",
-- siis iga mudeli reale salvestatakse mudel_andmed = {"kw": 10.2, "mudel": "SWC 102", "maht": 200}.
-- renderKirjeldus() asendab placeholder'id ja annab lõpliku kliendi-kirjelduse.
--
-- Lubatud väljad placeholder'iks (Faas 1 algus):
--   kw         — number, soojuspumba võimsus kW
--   cop        — number, efektiivsus
--   mudel      — string, mudeli kood (nt "SWC 102")
--   maht       — number, paagi maht liitrites
--   tootja     — string, valikuline (kui erineb tarnija_brand'ist)
--   garantii   — number, valikuline (kui erineb tootegrupp.garantii_aastad'ist)
--
-- JSONB struktuur on flexible — UI piiritleb mis võtmed lubatud, kuid DB ei jõusta skeemi
-- (võimaldab uute placeholder'ite lisamist ilma migratsioonita).

alter table hinnakirja_read
  add column if not exists mudel_andmed jsonb;

comment on column hinnakirja_read.mudel_andmed is
  'Placeholder väärtused tootegrupi template_kirjeldus jaoks. Nt {"kw": 10.2, "mudel": "SWC 102", "maht": 200}. NULL kui pole template-d kasutavat gruppi või kui kõik väärtused on row.kirjeldus'' s.';

-- GIN index, et toetada päringuid nagu "kõik tooted kus kw >= 10"
create index if not exists hinnakirja_read_mudel_andmed_gin
  on hinnakirja_read using gin (mudel_andmed jsonb_path_ops);

notify pgrst, 'reload schema';
