# Claude Code juhend — VK Eelarve projekt

> See fail laetakse automaatselt iga uue Claude Code sessiooni alguses.
> Sisu: koodi konventsioonid + projekt-spetsiifilised reeglid + viited.

## Projekt lühidalt

- **Eesmärk:** Viru Küte (Magnus Sirelmets) pakkumiste haldus — KVVK rekonstrueerimine, eramaja KJV, PV süsteemid
- **Tehnoloogia:** Next.js 14 App Router + Supabase + Anthropic Claude sonnet-4-6 + TypeScript + Tailwind + shadcn/ui
- **Kasutaja:** üks (Magnus) — lokaalne dev, prod Vercel'is (kui deployitud)
- **Detailne ülevaade:** [`docs/SUSTEEMI-KOKKUVOTE.md`](docs/SUSTEEMI-KOKKUVOTE.md)

## Keele- ja stiili-konventsioonid

### Eesti keel domineerib
- **UI tekst** Eesti keeles diakriitikutega (ä/ö/ü/õ)
- **Supabase veergude nimed** Eesti keeles: `tarnija_nimetus`, `paigaldusaeg_h_ühik`, `kate_koefitsient`, `tellija_nimi`, `kasutusala`
- **Server actions** Eesti keeles: `looPakkumine`, `kustutaTooted`, `muudaTooteMeta`, `lisaKomplektPakkumisse`
- **Komponendid + tüübid** TypeScript identifierid jäävad inglise/segarütmis: `LisaKomplektDialog`, `NimetusInput`, `KiirLisaRida`
- **MITTE "tõlgi-paranda"** olemasolevaid Eesti välju (nt `tähis`, `osa`, `ühik`) — need on sihilik

### Eesti diakriitikud Supabase REST API-s
**Tähtis:** supabase-js select-parser ei tunne osaliselt `ä/ö/ü/õ` veerunimesid (nt `laetud_kuupäev`). Töötab:
```ts
const { data } = await sb.from("tabel").select("*");  // tervik OK
const rows = ((data ?? []) as unknown) as Array<MinuTüüp>;
```
Mittetöötab:
```ts
const { data } = await sb.from("tabel").select("id, laetud_kuupäev");  // ❌ parser error
```

### Supabase Storage võtmed peavad olema ASCII
Diakriitikud (ä/ö/ü/õ) storage-failide nimedes/teedel annavad "Invalid key". Kasuta `asciiSlug()`:
```ts
const path = `${asciiSlug(objekt)}/${date}-${randomUUID()}.pdf`;
```
DB-veergudes diakriitikud OK (vt eelmine punkt).

### Next.js force-dynamic
Server-komponendid, mis loevad Supabase'ist ja mille all aktiivselt muudetakse staatust → vaja:
```ts
export const dynamic = "force-dynamic";
export const revalidate = 0;
```
Muidu kataloogi/pakkumise/hinnakirja detail-lehed cache'ivad ja ei näita värsket olekut pärast `revalidatePath()`-i.

## Kataloogi-/komponent-konventsioonid

### Inline-edit pattern
Iga tabeli-rida-tasandi väli kasutab sama mustrit: controlled input + blur-save + visuaalne state.

```ts
const [value, setValue] = useState(algne);
const [state, setState] = useState<"idle" | "ok" | "err">("idle");
const dirty = value !== algne;
const borderClass =
  state === "ok" ? "border-vk-blue" :
  state === "err" || dirty ? "border-amber-400 bg-amber-50" :
  "border-transparent";
```
Vt näiteid: `NimetusInput`, `KogusInput`, `OstuhindInput`, `PaigaldusaegInput`, `KateInput`, `TähisInput`, `KirjeldusInput` failis `app/pakkumised/[id]/positsioonide-tabel.tsx`.

### Snapshot-väljad pakkumistes
`positsioonid` tabelisse on duplikaaditud `toode_snapshot_*` + `ostuhind_snapshot` + `paigaldusaeg_snapshot` + `kate_snapshot` + `kirjeldus`. **Need säilivad ka kui parent toode kustutub** (FK `ON DELETE SET NULL`). Pakkumiste arvutused ei muutu kunagi taga-hindade muutmisel.

Sama loogika `komplekti_read` snapshot-väljadega.

### Bulk-actions toolbar
Sticky paneel `data-selected` rida-selektsiooni puhul. Vt `app/kataloog/tooted-tabel.tsx` ja `app/pakkumised/[id]/positsioonide-tabel.tsx`.

### Confirmation-flow destruktiivse tegevuse jaoks
```tsx
{confirming ? (
  <>
    <span>⚠️ Kustutab X + cascade Y</span>
    <Button variant="destructive" onClick={doDelete}>Kinnita</Button>
    <Button variant="ghost" onClick={() => setConfirming(false)}>Tühista</Button>
  </>
) : (
  <Button variant="ghost" onClick={() => setConfirming(true)}>
    <Trash2 /> Kustuta
  </Button>
)}
```

## Andmebaasi reeglid

### Iga muudatus = uus migratsioon
`supabase/migrations/NNNN_kirjeldus.sql`, NNNN = järgmine number (kontrolli `ls supabase/migrations/`).
Iga migration peab olema **idempotent**: `if not exists`, `drop ... if exists`, `add column if not exists`.

### Schema cache reload
Iga migration lõpetab `notify pgrst, 'reload schema';` — muidu REST API ei "näe" uut veergu kohe.

### Smoke test pärast migratsiooni
```bash
node scripts/smoke-test-migration.cjs <tabel> <veerg> "test väärtus"
```
Kontrollib insert + select + delete tsükli. Lisa scriptile uus tabeli erikäsitlus kui vaja.

### FK CASCADE strateegia
- `positsioonid → pakkumised` = `CASCADE` (pakkumise kustutamine kustutab read)
- `positsioonid.toode_id → hinnakirja_read` = `SET NULL` (snapshot säilib)
- `komplekti_read → komplektid` = `CASCADE`
- `komplekti_read.toode_id → hinnakirja_read` = `SET NULL`
- `hinnakirja_read → hinnakirjad` = `CASCADE`

## Anthropic Claude integratsioon

### Mudel
**ALATI** `claude-sonnet-4-6` parsimiseks. Konfigureeritud `lib/anthropic.ts` `PARSING_MODEL` konstandis. Magnuse valitud — ära muuda ilma küsimata.

### Stream + finalMessage
Pikkade requestide puhul (parsing 100+ rida) kasuta streaming et timeout'i vältida:
```ts
const stream = client.messages.stream({ ... });
const response = await stream.finalMessage();
```

### Prompt-cache süsteemprompti peal
```ts
system: [{ type: "text", text: SYSTEM_PROMPT, cache_control: { type: "ephemeral" } }],
```
Hinnakirja parser kasutab seda — 10× odavam korduvkasutuste puhul.

### Tool_use struktureeritud output
`tool_choice: { type: "tool", name: "tagasta_read" }` sunnib Claude'i kasutama tööriista → JSON schema valideerimine automaatne.

### max_tokens
Hinnakirja parser: **32000** (suurendatud 16k → 32k kuna Alpha Innotec 89+ rea XLSX andis truncate'i).

## Faili-asukohad

| Mida muuta | Fail |
|------------|------|
| AI parse-prompt (hinnakirjad) | `app/api/hinnakirjad/[id]/parse/route.ts` (SYSTEM_PROMPT) |
| AI parse-prompt (mahutabel) | `app/api/pakkumised/[id]/parse/route.ts` |
| Pakkumise mallid (eramaja jne) | `lib/pakkumise-mallid.ts` |
| Brand (logo, värvid, kontakt) | `lib/brand.ts` + `tailwind.config.ts` |
| Dimensioon-ekvivalendid (DN↔inch) | `lib/dimension-map.ts` |
| Kataloogi tabel | `app/kataloog/tooted-tabel.tsx` |
| Pakkumise positsioonide tabel | `app/pakkumised/[id]/positsioonide-tabel.tsx` |
| Trükivorm + linnukestega toggled | `app/pakkumised/[id]/trukk/page.tsx` + `eriosa-tabel.tsx` |
| Kiirlisa rida (autocomplete) | `app/pakkumised/[id]/kiir-lisa-rida.tsx` |
| Server actions per moodul | `app/<moodul>/actions.ts` |

## Git + GitHub

- **Repo:** [magnussirelmets-rgb/vk-eelarve](https://github.com/magnussirelmets-rgb/vk-eelarve) (private)
- **Default branch:** `main`
- **Feature-branchid:** `feature/<lühi-kirjeldus>`
- **PR commits:** Co-Authored-By Claude Opus 4.7
- **`.gitignore`** välistab: `SETUP.txt` (API võtmed), `*.pdf`, `eelarvetabel.xlsx`, `.env*`, `node_modules`, `.next`, `.claude/`

## Magnuse kontekstid

### Pakkumiste mallid (vt `lib/pakkumise-mallid.ts`)
- `kortermaja_rekonstr` — vaikimisi, KVVK rekonstrueerimine, püstikud/korterid/radiaatorid
- `eramaja_kvvk` — küte+jahutus+ventilatsioon, hoone tüüp + energiaklass + soojusallikas (katel/õhk-vesi/maaküte) + konditsioneer
- `vesi_kanal` — vee+kanal+sademevesi; tarbijate arvud
- `pv_susteem` — paneelide arv, inverter, akupank
- `ehitustood` — vaba struktuuriga

### Pakkumise rea elutsükkel
1. **Mahutabelist** (kortermaja): AI parsib PDF → positsioonid → Magnus lingib tooted (auto + manuaal)
2. **Käsitsi** (eramaja jms): KiirLisaRida autocomplete → vali toode kataloogist → snapshot
3. **Komplektist:** valmis "Puurkaevude rajamine" komplekt → "Lisa komplekt eriosana" → kõik read korraga

### Auditeerimise filosoofia
Pakkumistesse lisatud read **säilivad muutumatuna** kui kataloog/tootja-hinnakiri/komplekti hinnad hiljem muutuvad. Snapshot-väljad kohustuslikud. Magnus saab kunagi tagasi vaadata: "mis hinnad ma kliendile 2024 pakkumises täpselt panin?"

## Edasiarenduste plaan

Vt prompt: **"Tee korda andmete elutsükkel"** (Magnuse koostatud 2026-05-27, Faas 0-4).

- **Faas 0** ✅ (migratsioonid 0019/0020/0021 + smoke-tests + git+GitHub)
- **Faas 1** — Tootegrupid template_kirjeldus UI + renderKirjeldus()
- **Faas 2** — Hinnakirja diff-vaade enne kinnitust
- **Faas 3** — Projekti-pakkumised (kasutusala='projekti_pakkumine')
- **Faas 4** — Mass-import/export tooterühma + tootja kaupa

Iga faasi lõpus: typecheck → smoke-test → SUSTEEMI-KOKKUVOTE.md uuendus → commit → PR.

## Tähtsad keelud

- ❌ **Ära muuda Anthropic mudelit** ilma Magnuse selgesõnalise kinnituseta
- ❌ **Ära kustuta legacy actions** (`looUusVkArtikkel`, `muudaMatch`, `kinnitaUksRida` jne)
- ❌ **Ära loo paralleelseid tabeleid** "kataloog" / "kirjeldused" / "tarnija_tooted" — kõik on juba olemas
- ❌ **Ära kasuta `prisma`** — projekt on plain `@supabase/supabase-js`
- ❌ **Ära paigalda `npm`/`yarn`** — projektis on `pnpm`
- ❌ **Ära kustuta migration faile** ka kui mitte-jooksutatud (võib hiljem vaja)
- ❌ **Ära commit'i** `SETUP.txt`, `.env.local`, `*.pdf`, `eelarvetabel.xlsx`

## Tähtsad reeglid

- ✅ Iga DB muudatus → uus migration + smoke-test + Magnuse kinnitus enne Supabase'is jooksutamist
- ✅ Iga commit Co-Authored-By Claude Opus 4.7
- ✅ Iga feature → eraldi branch + PR (mitte direct main)
- ✅ TypeScript peab `pnpm typecheck` läbima enne committi
- ✅ Snapshot-väljad pakkumistes ja komplektides ALATI säilitada
- ✅ Eesti keel UI ja DB veergudes; English vaid TypeScript identifierites
- ✅ Inline-edit pattern (idle/dirty/ok/err) tabelisseväljade jaoks
