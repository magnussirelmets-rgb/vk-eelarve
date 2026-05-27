# VK Eelarve — Claude Code projekti pakett

**Projekti nimi:** vk-eelarve
**Kasutaja:** Magnus Sirelmets (ainus kasutaja)
**Eesmärk:** Web-app peatöövõtja pakkumiste tegemiseks: hindade andmebaas, mahutabelite parsimine, pakkumiste genereerimine.

---

## Sisukord

1. [PROJEKTI ÜLEVAADE](#1-projekti-ülevaade) — see osa lähed läbi enne midagi tegemist
2. [TEHNILINE STACK](#2-tehniline-stack)
3. [ANDMEMUDEL](#3-andmemudel)
4. [LEHTED JA FUNKTSIOONID](#4-lehtede-funktsioonid)
5. [4-PÄEVANE TÖÖPLAAN](#5-tööplaan)
6. [ALGUSPROMP CLAUDE CODE'ILE](#6-algusprompt)

---

## 1. Projekti ülevaade

Magnus on Viru Küte CEO ja primary technician. Teeb peatöövõtjatele KVVK (küte-ventilatsioon-veevarustus-kanalisatsioon) pakkumisi kortermajade rekkide jaoks (4-8 korrust). Praegu kasutab käsitsi Excel-eelarvet, mis võtab pakkumise kohta 1-2 päeva.

Eesmärk: pakkumise tegemise aeg 1-2 päevalt → 30-60 minutile, läbi:
- Tsentraalne **artiklikataloog** (~250 artiklit, VK sisesed koodid)
- **PDF mahutabelite AI parser** (Claude API loeb mahud automaatselt)
- **Automaatne kalkulatsioon** (ostuhind × kate + töötunnid × tunnitasu)
- **PDF eksport** (peatöövõtja vorming + sisene 4-osa koondvaade)

**Sisendid mis on juba olemas (kasuta neid):**
- `vk_kataloog_v1.xlsx` — 246 artikliga kataloog (vesi 63, küte 62, sõlm 45, ventilatsioon 31, kanal 19, sanseade 17, muu 8, tulekustuti 1)
- `22028_PP_KV_VK-8-01_v02_Mahutabel.pdf` — näide peatöövõtja mahutabelist (Tamsalu Ääsi 2 KVVK)
- `eelarvetabel.xlsx` — vana käsitsi Excel-eelarve näidisena (selle me asendame)

---

## 2. Tehniline stack

**Sama mis Valter Bilt:**
- Next.js 14 App Router + TypeScript
- Tailwind CSS + shadcn/ui komponendid
- Supabase (PostgreSQL + Storage)
- Vercel deployment
- Anthropic API (Claude Sonnet 4.6 või uuem) PDF parsimiseks

**Erinevused Valter Biltist:**
- Autentimist EI ole (single user, Magnus localhostis ja Vercelis)
- Lihtsam — pole multi-tenant, pole rolle, pole share-funktsioone
- Vercel deployment private (IP whitelist või lihtsalt obscure URL — pakkumiste hinnad on tundlik info)

**Vajalikud paketid:**
```bash
pnpm add @supabase/supabase-js @anthropic-ai/sdk
pnpm add react-hook-form zod @hookform/resolvers
pnpm add @tanstack/react-table  # tabelite jaoks
pnpm add lucide-react
pnpm add jspdf jspdf-autotable   # PDF eksport
pnpm add xlsx                    # Excel kataloogi import
pnpm add -D @types/node
```

---

## 3. Andmemudel

### Supabase tabelid

**`artiklid`** — kataloog
```sql
create table artiklid (
  id uuid primary key default gen_random_uuid(),
  kood text unique not null,           -- VK-VESI-001
  osa text not null,                   -- vesi, kanal, küte, sõlm, sanseade, ventilatsioon, jahutus, tulekustuti, muu
  alamosa text,                        -- armatuur, torustik, isolatsioon, seade, küttekeha jne
  sek_kood text,                       -- 711, 712, 721, 722, 723, 724
  nimetus text not null,
  tähis text,                          -- DN20, 1400-500-22, 110 jne
  ühik text,                           -- tk, jm, m, m², m³, kompl, kg
  alt_nimed text,                      -- "Kuulventiil;Kuulkraan;DN25 kuulventiil" — semikooloniga
  aktiivne boolean default true,
  loodud timestamptz default now(),
  uuendatud timestamptz default now()
);

create index idx_artiklid_osa on artiklid(osa) where aktiivne = true;
create index idx_artiklid_otsing on artiklid using gin(to_tsvector('simple', nimetus || ' ' || coalesce(tähis,'') || ' ' || coalesce(alt_nimed,'')));
```

**`hinnad`** — ajalooline hinnamuutuste log (iga muudatus uue reaga, ei overwrite)
```sql
create table hinnad (
  id uuid primary key default gen_random_uuid(),
  artikkel_id uuid references artiklid(id) on delete cascade,
  ostuhind_neto numeric(10,2),
  töö_h_ühik numeric(5,2),
  kehtib_alates date not null default current_date,
  märkused text,
  loodud timestamptz default now()
);

create index idx_hinnad_artikkel on hinnad(artikkel_id, kehtib_alates desc);
```

**Vaade:** `artiklid_kehtivad_hinnaga` — JOIN annab praeguse kehtiva hinna:
```sql
create view artiklid_kehtivad_hinnaga as
select 
  a.*,
  h.ostuhind_neto,
  h.töö_h_ühik,
  h.kehtib_alates as hind_kehtib_alates
from artiklid a
left join lateral (
  select * from hinnad 
  where artikkel_id = a.id and kehtib_alates <= current_date 
  order by kehtib_alates desc limit 1
) h on true;
```

**`hinnakirjad`** — üles laetud tarnijate hinnakirjad (PDF/Excel/CSV)
```sql
create table hinnakirjad (
  id uuid primary key default gen_random_uuid(),
  tarnija text not null,                -- Onninen, Karl Storm, Stokker jne
  faili_url text,                       -- Supabase Storage URL
  faili_tüüp text,                      -- pdf, xlsx, csv
  laetud_kuupäev date default current_date,
  staatus text default 'mustand',       -- mustand, läbitöödeldud, kinnitatud
  artiklite_arv int default 0,
  märkused text,
  loodud timestamptz default now()
);
```

**`hinnakirja_read`** — hinnakirjast parsitud read enne kinnitamist
```sql
create table hinnakirja_read (
  id uuid primary key default gen_random_uuid(),
  hinnakiri_id uuid references hinnakirjad(id) on delete cascade,
  tarnija_kood text,                    -- tarnija oma artikli kood (nt 1500006, 1030ST040)
  tarnija_nimetus text,
  tarnija_brand text,                   -- Slovarm, Danfoss, Imas, Dražice jne
  
  jaehind_neto numeric(10,2),           -- enne allahindlust (Küttemaailm puhul "Jaehind" veerg)
  ah_protsent numeric(5,2),             -- allahindluse % (Küttemaailm puhul "AH%" veerg)
  ostuhind_neto numeric(10,2),          -- tegelik ostuhind (Küttemaailm: "Hind" veerg, Toru-Jüri: "Hind" veerg)
  
  ühik text,
  kogus numeric(10,3),                  -- selle pakkumise kogus (kontekstiks)
  pakkumise_summa numeric(10,2),        -- rea kokku summa (sanity check)
  
  vk_artikkel_id uuid references artiklid(id),  -- pärast matchimist
  match_confidence numeric(3,2),        -- 0.0-1.0
  staatus text default 'matchimata',    -- matchimata, kinnitatud, ignoreeritud
  loodud timestamptz default now()
);
```

**`tarnija_artiklid`** — püsiv seos VK artikli ja tarnija artikli vahel (Päev 2 lõpus)
```sql
create table tarnija_artiklid (
  id uuid primary key default gen_random_uuid(),
  vk_artikkel_id uuid references artiklid(id) on delete cascade,
  tarnija text not null,                -- Küttemaailm, Toru-Jüri, Onninen jne
  tarnija_kood text,                    -- 1500006, 1030ST040
  tarnija_nimetus text,
  tarnija_brand text,                   -- Slovarm, Danfoss
  viimane_ostuhind numeric(10,2),
  viimane_jaehind numeric(10,2),
  viimane_ah_protsent numeric(5,2),
  viimati_uuendatud timestamptz default now(),
  märkused text,
  unique(vk_artikkel_id, tarnija, tarnija_kood)
);

create index idx_tarnija_artiklid_vk on tarnija_artiklid(vk_artikkel_id);
```

**Miks `tarnija_artiklid` eraldi:** üks VK artikkel võib olla **mitme tarnija toode**. Näiteks `VK-VESI-001 Kuulventiil DN15`:
- Küttemaailm: `1030ST015` (Slovarm) ostuhind 2,43€
- Toru-Jüri: `1500003` (Slovarm) ostuhind 2,60€

See võimaldab:
1. Võrrelda tarnijate hindu
2. Importida uue hinnakirja korral automaatselt VK artikliga ühendatud read
3. Genereerida tellimuse erinevatele tarnijatele (kui üks pakub osa odavamalt)

**`pakkumised`** — peatöövõtja pakkumiste päised
```sql
create table pakkumised (
  id uuid primary key default gen_random_uuid(),
  vkp_nr text unique not null,          -- VKP-2026-0001
  peatöövõtja_nimi text,
  peatöövõtja_email text,
  objekt text,
  projekti_nr text,
  pakkumise_kuupäev date default current_date,
  kehtiv_kuni date,
  staatus text default 'mustand',       -- mustand, saadetud, võidetud, kaotatud
  
  -- Kasutatud konstandid (lukus pakkumise ajaks)
  tunnitasu numeric(5,2) default 25,
  kate_koefitsient numeric(4,2) default 1.30,
  km_määr numeric(3,2) default 0.20,
  
  -- Mahutabel
  mahutabel_pdf_url text,               -- Supabase Storage
  
  loodud timestamptz default now(),
  uuendatud timestamptz default now()
);
```

**`positsioonid`** — pakkumise üksikud read
```sql
create table positsioonid (
  id uuid primary key default gen_random_uuid(),
  pakkumine_id uuid references pakkumised(id) on delete cascade,
  rea_nr int,                           -- järjekord
  artikkel_id uuid references artiklid(id),
  
  -- Snapshot (lukus pakkumise ajaks)
  artikli_kood text,
  osa text,
  sek_kood text,
  nimetus text,
  tähis text,
  ühik text,
  
  kogus numeric(10,3) default 0,
  
  -- Snapshot hindadest pakkumise tegemise hetkel
  ostuhind_snapshot numeric(10,2),
  müügihind_snapshot numeric(10,2),
  töö_h_snapshot numeric(5,2),
  
  -- PDF-parser data
  pdf_rida_tekst text,                  -- algne tekst PDF-ist
  pdf_match_confidence numeric(3,2),    -- 0-1, AI matchi kindlus
  manuaalselt_muudetud boolean default false,
  
  märkused text
);

create index idx_positsioonid_pakkumine on positsioonid(pakkumine_id);
```

---

## 4. Lehtede funktsioonid

```
/                          Avaleht: viimased pakkumised + kiirstatistika
/kataloog                  Kõik artiklid, filter osa järgi, otsing, lisa/muuda
/kataloog/[id]             Üksiku artikli vaade + hinnaajalugu
/hinnakirjad               Üles laaditud hinnakirjade nimekiri
/hinnakirjad/uus           Upload + AI parse
/hinnakirjad/[id]          Hinnakirja read, matching VK kataloogiga
/pakkumised                Kõik pakkumised, filter staatuse järgi
/pakkumised/uus            Uus pakkumine - 3 sammu wizard
/pakkumised/[id]           Pakkumise detail + positsioonid + koond + eksport
/seaded                    Tunnitasu, kate-koefitsient, KM, andmed Magnusele
```

### `/pakkumised/uus` — 3-sammuline wizard
1. **Päise andmed**: peatöövõtja, objekt, projekti nr
2. **Mahutabel**: lae PDF üles → AI parse → näita parsitud read → kinnita
3. **Hinnastamine**: vaata positsioone, muuda koguseid/hindu vajadusel → salvesta

### `/pakkumised/[id]` — pakkumise detail
- Tab 1: **Positsioonid** — tabel kõigi ridadega
- Tab 2: **Koondvaade** — 4 (või rohkem) osa summad + marginaalid
- Tab 3: **Eksport** — 2 nuppu:
  - "Lae alla mahutabel peatöövõtjale" (PDF, sama vorming mis tuli, lisatud ühikuhinnad)
  - "Lae alla 4-osa koond" (PDF, ainult Magnusele — näitab marginaali)

---

## 5. Tööplaan

### Päev 1 — Setup + Kataloog (3-4h)
- [ ] Vercel + Supabase projekt
- [ ] Next.js skeleton (sama stiil kui Valter Bilt)
- [ ] Supabase tabelid (artiklid, hinnad, view)
- [ ] **Migratsioon: `vk_kataloog_v1.xlsx` → Supabase `artiklid`**
- [ ] `/kataloog` leht — list + filter + otsing
- [ ] `/kataloog/[id]` — artikli detail + hinnaajalugu + uue hinna lisamine
- [ ] Lisa artikli vorm

### Päev 2 — Hinnakirjad (4-6h)
- [ ] Supabase Storage bucket "hinnakirjad"
- [ ] Tabelid `hinnakirjad`, `hinnakirja_read`, `tarnija_artiklid`
- [ ] `/hinnakirjad/uus` — drag&drop upload
- [ ] **API route: Anthropic Claude parsib PDF/Excel/CSV → struktureeritud read**

**Testandmed Päev 2 jaoks (Magnus annab):**

| Fail | Tarnija | Vorming | Eripära |
|---|---|---|---|
| `noom 014625-26TL0.pdf` | Küttemaailm OÜ | PDF tabel | Jaehind + AH% + ostuhind 3 veerus |
| `Pakkumus_26001565.pdf` | Toru-Jüri OÜ | PDF tabel | Tarnija sisesed koodid (1500006), brand nimetuses (Slovarm, Imas) |

**Küttemaailm vorming:**
```
Nr | Kirjeldus | Kogus | Jaehind | AH% | Hind | Summa
1. RA-DV 15 Dünaamiline ventiil sirge DN 15 / 25-135 l/h | 28tk | 46,36 | 55 | 20,80 | 582,40
```
Salvestada: `tarnija_kood=null`, `tarnija_nimetus="RA-DV 15 Dünaamiline..."`, `jaehind_neto=46.36`, `ah_protsent=55`, `ostuhind_neto=20.80`

**Toru-Jüri vorming:**
```
Kood | Nimetus | Kogus | Ühik | Hind | Summa | KM%
1500006 | Kuulkraan 11/4" S-S KE-231-DN32 Slovarm | 2 | tk | 9.74 | 19.48 | 24
```
Salvestada: `tarnija_kood="1500006"`, `tarnija_nimetus="Kuulkraan 11/4" S-S KE-231-DN32"`, `tarnija_brand="Slovarm"`, `ostuhind_neto=9.74`, `jaehind_neto=null`, `ah_protsent=null`

**Parsimise prompt Claude API-le (näide):**
```
Sa parsid Eesti ehitustarnija hinnakirja PDF-i. Lisatud on PDF ja allpool tarnija nimi.

Tagasta JSON massiiv kujul:
[
  {
    "tarnija_kood": "1500006" | null,
    "tarnija_nimetus": "täielik kirjeldus",
    "tarnija_brand": "Slovarm" | "Danfoss" | null,
    "ühik": "tk" | "m" | "jm" | "kompl" | "kg",
    "kogus": number,
    "jaehind_neto": number | null,
    "ah_protsent": number | null,
    "ostuhind_neto": number,
    "pakkumise_summa": number,
    "sektsioon": "Vesivarustus" | "TORUSTIK" | ... | null
  }
]

Reeglid:
- ostuhind_neto on KRIITILINE väli, see on tegelik hind mida kliendil tuleb maksta
- Kui PDF näitab "Jaehind" ja "AH%" eraldi (Küttemaailm), siis arvuta:
  ostuhind_neto = jaehind_neto * (1 - ah_protsent/100)
- Kui PDF näitab ainult ühte hinda (Toru-Jüri), siis see on ostuhind_neto
- Brand on tihti nimetuse lõpus: "Kuulkraan ... Slovarm" -> brand="Slovarm"
- Sektsioone pealkirju (Vesivarustus, TORUSTIK, ISOLATSIOON) ära lisa eraldi ridadena, lisa need järgnevatele toodetele
- Kommentaarid, KM kokkuvõtted, lehe pealkirjad jäta vahele
```

- [ ] `/hinnakirjad/[id]` — matchimise UI:
  - Iga hinnakirja rea kõrval näita kataloogi pakutud match (Claude AI fuzzy match)
  - Magnus saab muuta matchi või lisada uue VK artikli kohapealt
  - "Kinnita" nupp:
    1. Loob `hinnad` rea uue ostuhinnaga (kehtib_alates = täna)
    2. Loob/uuendab `tarnija_artiklid` rea, et järgmise sama tarnija hinnakirja korral automaatselt teaks matchi
  - Kuva ka jaehind + AH% kui need on olemas — see näitab, milline allahindluse tase sa parasjagu saad

### Päev 3 — Mahutabelite parsimine (4-6h)
- [ ] Tabelid `pakkumised`, `positsioonid`
- [ ] `/pakkumised/uus` 3-sammuline wizard
- [ ] **API route: Anthropic Claude parsib mahutabeli PDF-i**
  - Loeb sektsioonid (711, 712, 721, 722, 723, 724)
  - Iga rea kohta: nimetus, tähis, kogus, ühik
  - Tagastab JSON massiivi
- [ ] Match positsioonide ja kataloogi vahel (sama algoritm kui hinnakirjadel)
- [ ] Positsioonide kinnitamise UI

### Päev 4 — Eksport + viimistlus (3-4h)
- [ ] Pakkumise detail vaade (positsioonid + koond)
- [ ] PDF eksport: peatöövõtja mahutabeli vorming (jsPDF + autoTable)
- [ ] PDF eksport: sisemise 4-osa koondvaade marginaali näitamisega
- [ ] Avaleht statistikaga
- [ ] Vercel deployment

---

## 6. Algusprompt Claude Code'ile

**Kopeeri see prompt Claude Code'i terminali.** Eeldab, et oled juba terminalis kausta `~/Documents/` sees.

```
Tere! Me hakkame ehitama Viru Küte sisemist pakkumiste süsteemi nimega "vk-eelarve". Sina oled Claude Code, mina olen Magnus Sirelmets, Viru Küte CEO.

KONTEKST:
- Olen ehitanud juba Valter Bilt'i süsteemi sama stack'iga (Next.js 14 + Supabase + Vercel). Vaata seda inspiratsiooniks aga see projekt on sõltumatu.
- See uus projekt on internal tool ainult mulle, ilma autentimiseta.
- Eesmärk: peatöövõtja pakkumiste tegemine 1-2 päevalt → 30-60 minutile.

PÄEV 1 EESMÄRGID (täna teeme nii palju kui jõuame):
1. Loo uus Next.js 14 projekt ~/Documents/vk-eelarve kausta
2. Setup Tailwind + shadcn/ui (sama värvid mis Viru Küte bränd: navy #1a1b4b, blue #0046ff, red #e8194e)
3. Setup Supabase — küsin sinult juhiseid kuidas uue projekti luua
4. Loo SQL migratsioon: artiklid, hinnad tabelid + artiklid_kehtivad_hinnaga vaade
5. Loo migrate script: loeb /Users/magnus/Downloads/vk_kataloog_v1.xlsx ja täidab artiklid + hinnad tabelid
6. Loo /kataloog leht: artiklite list filter osa järgi + otsing
7. Loo /kataloog/[id] leht: artikli detail + hinnaajalugu + uue hinna lisamise vorm

OLULISED FAILID MIS MUL LOKAALSELT OLEMAS (ma näitan sulle kus need on):
- vk_kataloog_v1.xlsx (246 artiklit)
- 22028_PP_KV_VK-8-01_v02_Mahutabel.pdf (näidis mahutabel)
- vk_kataloog_apps_script.gs (varasem Apps Script versioon, info ainult)

KOOD STIIL:
- TypeScript everywhere
- Server Components vaikimisi, 'use client' ainult vajadusel
- shadcn/ui komponendid kus võimalik
- Eestikeelsed kasutajaliidese tekstid, ingliskeelsed muutujad/funktsioonid
- Veerud Supabase'is on eesti keeles (osa, nimetus, tähis jne) - täpsuse pärast

ENNE KUI ALUSTAD:
1. Küsi minult, kas Supabase projekt on juba olemas või loon uue
2. Küsi minult, kus täpselt vk_kataloog_v1.xlsx fail asub (ma vastan failipath'iga)
3. Esita lühike (5-7 sammu) plaan päev 1 tööks ja oota minu kinnitust enne kui koodi kirjutama hakkad

Hakkame pihta. Esmalt küsi mind küsimusi ülal mainitud.
```

---

## 7. Lisamärkused

### Kalliduse ja maksumuse jälgimine
- Vercel hobby plan: tasuta
- Supabase free tier: tasuta kuni 500MB andmebaasi, 1GB Storage
- Anthropic API: ~€0,05-0,15 pakkumise kohta (PDF parse + matching)
- **Kogu kuukulu pakkumisi (10/kuus): ~€1-2**

### Migratsioonistraegia
Sa võid alustada selle projektiga **paralleelselt** käivad pakkumised Excelis. Esimene reaalne pakkumine uue süsteemiga kui Päev 4 valmis ja system on Vercelis testituud.

### Hilisemad faasid (Päev 5+)
- Foto upload (PDF mahutabeli pdf+foto kombinatsioon)
- Pakkumiste võrdlus (kui peatöövõtja saadab muudatuste mahutabeli)
- CRM integratsioon (võidetud pakkumised → vk_crm Google Sheets)
- Multi-user (kui Kaspar liitub kontoritöös)
