# VK Eelarve süsteemi kokkuvõte

> Auditeerimiseks ja edasiarenduste promptide ettevalmistamiseks.
> Genereeritud: 2026-05-27.

## 1. Tehnoloogia-pakk

- **Frontend:** Next.js 14 App Router, TypeScript, Tailwind CSS, shadcn/ui komponendid
- **Backend:** Next.js Server Actions + API Routes (Node runtime)
- **Andmebaas:** Supabase (PostgreSQL + Storage), service role server-side
- **AI:** Anthropic Claude (sonnet-4-6) PDF/Excel parsimiseks, tool_use struktureeritud output'iga, prompt-cache
- **Mudel:** PARSING_MODEL = `claude-sonnet-4-6` (lib/anthropic.ts)
- **Pakihaldur:** pnpm

## 2. Andmebaasi skeem (Supabase Postgres)

### `pakkumised` (klientide pakkumised)
- `id uuid PK`
- `vkp_nr text` — automaatne VKP-2026-NNNN
- `objekt text` — pakkumise objekti nimi (kohustuslik)
- `projekti_nr text`
- `tellija_nimi text` *(0015 ümbernimetatud peatöövõtja_nimi-st)*
- `tellija_email text` *(0015)*
- `tellija_telefon text` *(0015)*
- `pakkumise_kuupäev date`, `kehtiv_kuni date`
- `staatus text` — mustand | parsitud | saadetud | võidetud | kaotatud
- `tunnitasu numeric(8,2)` — vaikimisi
- `kate_koefitsient numeric(5,2)` — materjali markup (nt 1.5 = +50%)
- `km_määr numeric(5,4)` — käibemaks (0.22 = 22%)
- Skaalategurid (kortermaja mall kasutab):
  - `püstikute_arv int`, `korterite_arv int`, `radiaatorite_arv int`
  - `keldrimagistraalide_jm numeric`, `väljavõtete_arv int`
- `mahutabel_pdf_path text` — legacy üks-mahutabel (uus tee: `pakkumise_mahutabelid`)
- `mahutabel_pdf_nimi text`, `mahutabel_parsitud_ajal timestamptz`
- `mall text NOT NULL DEFAULT 'kortermaja_rekonstr'` *(0013)*
  - Väärtused: `kortermaja_rekonstr | eramaja_kvvk | vesi_kanal | pv_susteem | ehitustood`
- `mall_andmed jsonb NOT NULL DEFAULT '{}'::jsonb` *(0014)*
  - Malli-spetsiifilised väljad — vt `lib/pakkumise-mallid.ts`
- `märkused text`, `loodud`, `uuendatud timestamptz`

### `positsioonid` (pakkumise read)
- `id uuid PK`, `pakkumine_id uuid REFERENCES pakkumised ON DELETE CASCADE`
- `rea_nr int`, `sektsioon text` (nt "721 Küttesüsteem"), `alamsektsioon text` *(0008)*
- `nimetus text NOT NULL`, `tähis text`, `kogus numeric`, `ühik text`
- `toode_id uuid REFERENCES hinnakirja_read ON DELETE SET NULL` — lingitud kataloogi
- `toote_match_confidence numeric`, `toote_match_põhjendus text`
- Snapshot väljad (säilivad ka kui toode kustutub):
  - `toode_snapshot_tarnija/kood/nimetus/brand text`
  - `ostuhind_snapshot numeric`, `paigaldusaeg_snapshot numeric`
  - `kate_snapshot numeric` *(0006)*
- `pdf_rida_tekst text` — algne mahutabeli rida (parse-time)
- `manuaalselt_muudetud bool`
- `reservi_koefitsent numeric` *(0010)* — kui täidetud, kogus arvutatakse sektsiooni materjali %-na (varu-read)
- `mahutabel_id uuid REFERENCES pakkumise_mahutabelid ON DELETE SET NULL` *(0012)*
- `märkused text` — sisemine
- `kirjeldus text` *(0017)* — kliendile nähtav pikem kirjeldus

### `pakkumise_mahutabelid` *(0012)* (mitu mahutabeli per pakkumine)
- `id`, `pakkumine_id uuid REFERENCES pakkumised ON DELETE CASCADE`
- `faili_path text`, `faili_nimi text`, `parsitud_ajal timestamptz`, `märkused text`

### `hinnakirjad` (tarnija hinnakirjad + manual entries)
- `id uuid PK`, `tarnija text` (tarnija nimi — saab vaba)
- `faili_path text NULL` — Storage tee (NULL kui `faili_tüüp='manual'`)
- `faili_nimi text`, `faili_tüüp text` — `pdf | xlsx | csv | manual`
- `laetud_kuupäev date`, `staatus text` — laetud | parsitud | viga | kinnitatud
- `viga_tekst text`, `artiklite_arv int`, `märkused text`

### `hinnakirja_read` (tooted/teenused — kogu kataloog elab siin)
- `id uuid PK`, `hinnakiri_id uuid REFERENCES hinnakirjad ON DELETE CASCADE`
- `rea_nr int`, `tarnija_kood text`, `tarnija_nimetus text NOT NULL`, `tarnija_brand text`
- `sektsioon text` — algne PDF-sektsioon
- `jaehind_neto numeric`, `ah_protsent numeric`, `ostuhind_neto numeric`
- `ühik text`, `kogus numeric`, `pakkumise_summa numeric`
- `staatus text` — matchimata | matchitud | ignoreeritud
- `paigaldusaeg_h_ühik numeric` *(0004)* — Magnuse tacit
- `magnus_märkused text` *(0004)* — sisemine
- `magnus_alt_nimed text` *(0004)* — sünonüümid (semicolon-eraldatud)
- `tootegrupp_id uuid REFERENCES tootegrupid ON DELETE SET NULL` *(0006)*
- `kirjeldus text` *(0016)* — kliendile nähtav pikk tehniline kirjeldus
- ⚠️ MIGRATION 0016 EI OLE JOOKSUTATUD — kirjeldus veerg puudub praegu DB-s

### `tootegrupid` *(0006)* (teenused — Magnuse semantikas "Teenused")
- `id`, `nimi text UNIQUE`, `kirjeldus text`
- `paigaldusaeg_h_ühik numeric` — grupi-tasandi default kui tootel pole
- `kate_koefitsient_override numeric` — kui täidetud, override pakkumise kate
- `tüüp text` *(0007)* — toode | teenus
- `märkused text`

### `komplektid` *(0011)* (paigalduskomplektid, Eesti Puurkaev jne)
- `id`, `nimi text UNIQUE`, `kirjeldus text`, `ühik text DEFAULT 'kompl'`
- `vaike_sektsioon text` *(0018)*, `vaike_alamsektsioon text` *(0018)*
- `märkused text`

### `komplekti_read` *(0011)*
- `id`, `komplekt_id uuid REFERENCES komplektid ON DELETE CASCADE`
- `toode_id uuid REFERENCES hinnakirja_read ON DELETE SET NULL`
- Snapshot väljad: `nimetus, tarnija, tarnija_kood, tarnija_brand, tähis, ühik, ostuhind_snapshot, paigaldusaeg_h_ühik_snapshot`
- `kogus numeric`, `järjekord int`

### Legacy (kasutusel piiratud)
- `artiklid`, `hinnad` *(0001)* — VK enda artikli-süsteem (Magnus loobus, kasutab hinnakirja_read otse)
- `tarnija_artiklid` *(0003)* — lingikiht VK_artikkel ↔ tarnija_artikkel (kasutamata)

## 3. Migratsioonid

```
0001_kataloog.sql                — artiklid + hinnad (legacy)
0002_kehtivad_eraldi.sql         — hinnaajalugu fix
0003_hinnakirjad.sql             — hinnakirjad + hinnakirja_read + tarnija_artiklid
0004_hinnakirja_read_lisaveerud  — paigaldusaeg + magnus_märkused + magnus_alt_nimed
0005_pakkumised.sql              — pakkumised + positsioonid
0006_tootegrupid.sql             — tootegrupid + kate_snapshot
0007_tootegrupid_tüüp.sql        — tootegrupid.tüüp (toode/teenus)
0008_positsioonid_alamsektsioon  — alamsektsioon kolumn
0009_manual_catalog_entries.sql  — manual hinnakirjad (faili_path NULL OK)
0010_positsioonid_reserv.sql     — reservi_koefitsent (materjali varu read)
0011_komplektid.sql              — komplektid + komplekti_read
0012_pakkumise_mahutabelid.sql   — mitu mahutabeli per pakkumine
0013_pakkumise_mall.sql          — pakkumised.mall enum
0014_pakkumise_mall_andmed.sql   — pakkumised.mall_andmed JSONB
0015_pakkumise_tellija.sql       — peatöövõtja → tellija + telefon
0016_hinnakirja_kirjeldus.sql    — kirjeldus veerg ⚠️ JOOKSMATA
0017_positsiooni_kirjeldus.sql   — positsiooni kirjeldus
0018_komplekti_vaike_eriosa.sql  — komplektidele vaike-eriosa
```

## 4. App-i marsruudid (Next.js App Router)

```
/                               — avaleht
/kataloog                       — toodete/teenuste loend (kõik hinnakirja_read kirjed)
  ?q= ?tarnija=                 — otsing + filter
/kataloog/[id]                  — toote detail + meta (paigaldusaeg, kirjeldus, sünonüümid)
/hinnakirjad                    — hinnakirjade loend + kustutamise nupud
/hinnakirjad/uus                — uus hinnakirja upload (tarnija dropdown + Muu + Varem kasutatud)
/hinnakirjad/[id]               — hinnakirja parsitud read + AI parse nupp
                                  + tarnija nime muutmine + kirjelduste mass-upload
/hinnakirjad/tarnijad           — tarnijate haldus (rename / cascade-delete)
/grupid                         — teenuste-gruppide loend (varem "Teenused")
/grupid/uus                     — uue grupi loomine
/grupid/[id]                    — grupi liikmed + manual toodete/teenuste lisamine
/komplektid                     — komplektide loend
/komplektid/[id]                — komplekti read + vaike-eriosa
/pakkumised                     — pakkumiste loend + per-rea kustuta
/pakkumised/uus                 — uus pakkumine: malli valik + tellija + skaalategurid + mahutabel
/pakkumised/[id]                — pakkumise detail: ActionBar (mahutabelid) + komplekti lisa
                                  + Kiirlisa rida (autocomplete) + positsioonide tabel
/pakkumised/[id]/trukk          — brändistatud trükivorm (logo + tellija + sektsioonid)
/seaded                         — placeholder

API:
/api/hinnakirjad/[id]/parse     — AI parse PDF/XLSX → hinnakirja_read
/api/hinnakirjad/[id]/match     — (legacy)
/api/hinnakirjad/[id]/csv-template — kirjelduste CSV-mall download
/api/kataloog/export            — kogu kataloog CSV-na
/api/pakkumised/[id]/parse      — AI parse mahutabel → positsioonid (?mahutabel=ID toetab täiendavaid)
```

## 5. Server actions (kõik tegevused)

### `app/pakkumised/actions.ts`
- `looPakkumine(formData)` — uus pakkumine + mahutabel upload + mall_andmed JSONB
- `otsiTooteid(q)` — autocomplete kataloog-otsing (DN ↔ inches expansion + skoor)
- `seoToode(positsioonId, toodeId)` — lingib toote, snapshot + propageerib samad nimetus+tähis ridadele samas pakkumises
- `autoLingiAjalooPõhjal(pakkumineId)` — vaatab varasemate pakkumiste mappinge, auto-lingib uusi mahutabeli ridu
- `lisaVaru(input)` — materjali varu rida (sektsiooni % materjalist)
- `lisaPositsioon(input)` — käsitsi rida; kui toode_id antud, snapshot kopeeritakse + kirjeldus
- `muudaPakkumiseSeaded(id, …)` — tunnitasu / kate / KM
- `muudaPositsiooniInfo` — nimetus + tähis + kirjeldus
- `muudaPositsiooniOstuhind / Kogus / Paigaldusaeg / Kate` — per-rea inline-edit
- `muudaMassiKate / Sektsioon`, `muudaAlamsektsioon`
- `kustutaPositsioone(ids[])` — bulk delete
- `lisaTäiendavMahutabel(pakkumineId, formData)` — täiendav mahutabel PDF upload
- `kustutaMahutabel(id)` — kustutab ühe mahutabeli (positsioonid jäävad, mahutabel_id → NULL)
- `laadiMahutabel(pakkumineId, formData)` — legacy single mahutabel asendus
- `loendaKomplektid()` — komplektide loend stats'idega
- `lisaKomplektPakkumisse({pakkumineId, komplektId, sektsioon, alamsektsioon, koguseKordaja})` — komplekti kõik read → positsioonidena ühe eriosa alla
- `kustutaPakkumine(id)` — cascade delete + Storage cleanup

### `app/hinnakirjad/actions.ts`
- `uploadHinnakiri(formData)` — tarnija + fail → Storage + hinnakirjad rida
- `uuendaKirjeldusedExcelist(hinnakirjaId, formData)` — CSV/Excel kirjelduste mass-update (id/kood/nimetus järgi)
- `kustutaHinnakiri(id)` — cascade
- `muudaTarnijat(vana, uus)` — rename across all hinnakirjad
- `kustutaTarnija(nimi)` — kustutab kõik selle tarnija hinnakirjad
- `muudaHinnakiri(id, {tarnija})` — single hinnakirja rename
- `muudaMatch(reaId, artikkelId)` — legacy VK_artikkel match
- `ignoreRida / tagastaRida(reaId)` — staatus muutmine
- `looUusVkArtikkel(input)` — legacy
- `kinnitaUksRida / kinnitaKõikYlevalKui / salvestaLõplikult` — legacy match workflow

### `app/kataloog/actions.ts`
- `kustutaTooted(ids[])` — hard-delete hinnakirja_read (positsioonid.toode_id → NULL)
- `kustutaTarnijaArtikkel`, `kustutaArtikleid` — legacy
- `muudaToodeNimetus(id, nimetus)` — inline-edit
- `kataloogiImport(formData)` — kogu kataloogi CSV/Excel import (insert/update)
- `muudaTooteMeta` — paigaldusaeg + märkused + alt_nimed + kirjeldus
- `muudaPaigaldusaeg / muudaMassiPaigaldusaeg / salvestaPaigaldusajadMass`
- `ignoreeriMassi(ids[])` — staatus = "ignoreeritud" (soft hide)
- `createArtikkel`, `lisaHind` — legacy

### `app/grupid/actions.ts`
- `looGrupp / muudaGrupp / kustutaGrupp`
- `seoToodedGrupiga(ids[], grupId)` — bulk assign
- `listAllGrupid()`
- `lisaManuaalneToode(input)` — käsitsi sisestus VK Manuaalsed hinnakirja alla

### `app/komplektid/actions.ts`
- `looKomplekt(input)` — uus komplekt valitud hinnakirja_read ID-dest
- `muudaKomplekti(id, {nimi, vaike_sektsioon, …})`
- `muudaKomplektiRea(reaId, {kogus, ostuhind, nimetus})`
- `kustutaKomplektiRida(reaId)`
- `kustutaKomplekt(id)`

## 6. Konfiguratsioon ja konstandid

- **Tarnijad enum:** `lib/types.ts` → `TARNIJAD = ["Pneumokem", "Slovarmi", ...]`
  - Server validatsioon eemaldatud → iga mittetühi nimi OK
- **Pakkumise mallid:** `lib/pakkumise-mallid.ts`
  - 5 malli: kortermaja_rekonstr, eramaja_kvvk, vesi_kanal, pv_susteem, ehitustood
  - Igal mallil: `nimi, lühi, kirjeldus, soovituslikudEriosad, näitaSkaalategureid, mallVäljad, toetabMahutabelit`
  - `mallVäljad` toetab radio, checkbox, number, decimal + conditional kuvaKui
- **Bränd:** `lib/brand.ts` — Viru Küte logo (public/vk-logo.png), slogan, kontakt
- **Dimensioon-ekvivalendid:** `lib/dimension-map.ts` — DN8..DN300 ↔ inch (1/4, 3/8, 1/2, 3/4, 1, 1 1/4, …)
- **Tailwind toonid:** `tailwind.config.ts` — `vk-navy #1a1b4b, vk-blue #0046ff, vk-red #e8194e`

## 7. Anthropic API integratsioon

- `lib/anthropic.ts` — `getAnthropic()` + maxRetries: 5
- **Parsing mudel:** `claude-sonnet-4-6`
- **Hinnakirja parse:** `app/api/hinnakirjad/[id]/parse/route.ts`
  - max_tokens: 32000 (suurendatud 16k → 32k)
  - SYSTEM_PROMPT (umbes 50 rida) — flexible column detection (mudel, artikkel, ostuhind_eur jne)
  - PARSE_TOOL — JSON schema tool_use'ile
  - XLSX → CSV iga lehe kaupa enne Claude-le saatmist
- **Mahutabel parse:** `app/api/pakkumised/[id]/parse/route.ts`
  - Sarnane voog mahutabeli PDF jaoks
  - Toetab `?mahutabel=ID` query param (täiendava mahutabeli parsimine)
- **Prompt cache:** `cache_control: { type: "ephemeral" }` süsteemprompti peal

## 8. UI patternid

- **Inline-edit:** input + onBlur save (NimetusInput, TähisInput, KogusInput, OstuhindInput, PaigaldusaegInput, KateInput)
  - Visuaalne state: idle (transparent border) · dirty (amber bg) · ok (vk-blue) · err (red)
- **Autocomplete dropdown:** Kiirlisa rida + Nimetus veerg positsioonide tabelis
  - Debounce 220ms, ↓↑ navigeerimine, Enter valib/saadab
- **Bulk-select toolbar:** sticky, "N rida valitud" + per-tüüp tegevused (kate, sektsioon, kustuta jne)
- **Inline confirmation:** kustuta nupud kuvavad AlertTriangle + "Kinnita" / "Tühista"
- **Linnukestega toggle:** Trükivormis "Peida materjal" + "Näita ridu"
- **Print:** `print:hidden` ja `print:px-6` jms — UI elemente peidetakse trükivormis

## 9. Storage (Supabase)

Buckets:
- `hinnakirjad/` — tarnija hinnakirjade PDF/Excel failid
- `mahutabelid/` — pakkumise mahutabeli PDF-id

NB: Storage võtmed peavad olema ASCII — Estonia diakriitikuid transliteeritakse `asciiSlug()` funktsiooniga enne path'i ehitamist.

## 10. Teadaolevad funktsioonid (mille puhul teha auditit / parandused)

### Töötab korralikult
- Pakkumise loomine + mahutabeli upload + AI parsimine
- Iseõppiv otsing (DN ↔ inches, sünonüümid)
- Komplekti loomine + lisamine pakkumisse eriosana
- Mitu mahutabelit per pakkumine
- Print/letterhead Viru Küte brändiga
- Kataloogi inline-edit + bulk-actions + hard-delete
- Tarnijate haldus (rename + delete)
- Hinnakirja CSV/Excel kirjelduste mass-uuendus
- Kataloogi täielik Excel export/import
- Kiirlisa positsioon autocomplete-otsinguga

### Praegused probleemid / parandust vajab
- **Migration 0016 puudub DB-st** — `hinnakirja_read.kirjeldus` veerg ei eksisteeri Magnuse Supabase'is
  - Lahendus: jooksuta `alter table hinnakirja_read add column if not exists kirjeldus text; notify pgrst, 'reload schema';`
- AI parsimine on aeglane (~3-4 min) ja kallis (~$0.10-0.15/try)
- Suurte XLSX-failide puhul (89+ rida × 17 veerge) tokenite kasutus ~20k input + 20k output
- Mõned legacy actions (looUusVkArtikkel, muudaMatch, kinnitaUksRida) on kasutamata
- `artiklid` ja `tarnija_artiklid` tabelid on legacy, mitte täielikult kustutatud

### Tasks/ideid edaspidi
- Pakkumise PDF-export (praegu vaid HTML print)
- Mahutabeli parse võiks soovitada eriosa-koodi vastavalt sektsiooni nimele
- Multi-tenant tugi (kui keegi peale Magnuse hakkab kasutama)
- Telefon-mobile responsive design

## 11. Quick reference — kust mis asub

| Mida muuta | Fail / kataloog |
|-----------|-----------------|
| AI parse-prompt | `app/api/hinnakirjad/[id]/parse/route.ts` (SYSTEM_PROMPT) |
| Mahutabeli parse | `app/api/pakkumised/[id]/parse/route.ts` |
| Pakkumise mallid (eramaja jne) | `lib/pakkumise-mallid.ts` |
| Brand (logo, värvid, kontakt) | `lib/brand.ts` + `tailwind.config.ts` |
| Mõõdu-ekvivalendid (DN↔inch) | `lib/dimension-map.ts` |
| Kataloogi tabel | `app/kataloog/tooted-tabel.tsx` |
| Pakkumise positsioonide tabel | `app/pakkumised/[id]/positsioonide-tabel.tsx` |
| Trükivorm | `app/pakkumised/[id]/trukk/page.tsx` + `eriosa-tabel.tsx` |
| Kiirlisa rida | `app/pakkumised/[id]/kiir-lisa-rida.tsx` |
| Tellija/objekt päise muutmine | `app/pakkumised/[id]/page.tsx` (mall-specific väljad allpool) |

---

**Andmebaasi praegune seis (kontrollitud 2026-05-27):**

| Tabel.veerg | Olemas? |
|-------------|---------|
| pakkumised.mall | ✅ |
| pakkumised.mall_andmed | ✅ |
| pakkumised.tellija_nimi / email / telefon | ✅ |
| **hinnakirja_read.kirjeldus** | ❌ **PUUDU — migration 0016 vaja jooksutada** |
| positsioonid.kirjeldus | ✅ |
| komplektid.vaike_sektsioon / vaike_alamsektsioon | ✅ |
