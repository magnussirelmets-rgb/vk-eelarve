-- Tootekirjeldus: pikem teksti-väli mis kuvatakse pakkumise rea juures
-- (kliendile nähtav, mitte Magnuse-sisene). Eraldatud magnus_märkused'est.

alter table hinnakirja_read
  add column if not exists kirjeldus text;

comment on column hinnakirja_read.kirjeldus is
  'Pikem tootekirjeldus (kliendile nähtav). Bulk-uuendatav CSV/Excel uploadiga /hinnakirjad/[id] lehel.';

notify pgrst, 'reload schema';
