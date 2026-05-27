-- VK Eelarve — migratsioon 0008
-- Lisa `alamsektsioon` veerg positsioonid'esse, et saaks pakkumisi
-- hierarhiliselt jaotada (nt 711 Veevarustus → Püstikud / Kelder / Komplekttöö).

alter table positsioonid
  add column if not exists alamsektsioon text;

create index if not exists idx_positsioonid_alamsektsioon
  on positsioonid(pakkumine_id, sektsioon, alamsektsioon);
