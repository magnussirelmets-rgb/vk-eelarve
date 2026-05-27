-- Positsiooni rea-tasandi tootekirjeldus (kliendile nähtav printvormis).
-- Eraldatud märkused'est (mis on Magnuse sisemine kontekst).

alter table positsioonid
  add column if not exists kirjeldus text;

comment on column positsioonid.kirjeldus is
  'Kliendile nähtav tootekirjeldus pakkumise printvormis. Kopeeritakse vaikimisi hinnakirja_read.kirjeldus väärtusest seoToode käivitamisel.';

notify pgrst, 'reload schema';
