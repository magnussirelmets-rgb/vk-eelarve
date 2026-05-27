#!/usr/bin/env tsx
/**
 * Impordib vk_kataloog_v1.xlsx faili sisu Supabase artiklid + hinnad tabelitesse.
 *
 * Käivita:  pnpm import:kataloog
 * Eeldab:  .env.local sisaldab SUPABASE_SERVICE_ROLE_KEY, NEXT_PUBLIC_SUPABASE_URL.
 * Idempotentne: artiklid upsert'itakse `kood` järgi, hinnad lisatakse ainult kui
 * mõni hind on muutunud (võrreldes viimase kehtiva reaga selle artikli kohta).
 */

import { readFileSync } from "node:fs";
import path from "node:path";
import { config as loadEnv } from "dotenv";
import { createClient } from "@supabase/supabase-js";
import * as XLSX from "xlsx";

loadEnv({ path: path.resolve(process.cwd(), ".env.local") });

const SUPABASE_URL = process.env.NEXT_PUBLIC_SUPABASE_URL;
const SERVICE_ROLE = process.env.SUPABASE_SERVICE_ROLE_KEY;
if (!SUPABASE_URL || !SERVICE_ROLE) {
  console.error("Puudub NEXT_PUBLIC_SUPABASE_URL või SUPABASE_SERVICE_ROLE_KEY .env.local failist");
  process.exit(1);
}

const KATALOOG_PATH = path.resolve(process.cwd(), "vk_kataloog_v1.xlsx");

const OSA_VALUES = [
  "vesi","kanal","küte","sõlm","sanseade","ventilatsioon","jahutus","tulekustuti","muu",
] as const;
type Osa = (typeof OSA_VALUES)[number];

type Row = {
  kood: string;
  osa: Osa;
  alamosa: string | null;
  sek_kood: string | null;
  nimetus: string;
  tähis: string | null;
  ühik: string | null;
  ostuhind_neto: number | null;
  töö_h_ühik: number | null;
  alt_nimed: string | null;
};

function readKataloog(): Row[] {
  const buf = readFileSync(KATALOOG_PATH);
  const wb = XLSX.read(buf, { type: "buffer" });
  const ws = wb.Sheets["kataloog"];
  if (!ws) throw new Error('Lehte "kataloog" ei leitud xlsx failist');

  // Päis on real 10 (Excel 1-based), andmed algavad real 11.
  const raw = XLSX.utils.sheet_to_json<Record<string, unknown>>(ws, {
    range: 9, // 0-based: row index 9 = päise rida
    defval: null,
    raw: true,
  });

  const rows: Row[] = [];
  for (const r of raw) {
    const kood = clean(r["artikli_kood"]);
    if (!kood) continue; // jäta tühjad read vahele
    if (kood === "KATALOOG" || kood === "artikli_kood") continue;

    const osa = clean(r["osa_tag"])?.toLowerCase();
    if (!osa || !(OSA_VALUES as readonly string[]).includes(osa)) {
      console.warn(`  Vahele: ${kood} — tundmatu osa "${osa}"`);
      continue;
    }

    const nimetus = clean(r["nimetus"]);
    if (!nimetus) {
      console.warn(`  Vahele: ${kood} — puudub nimetus`);
      continue;
    }

    rows.push({
      kood,
      osa: osa as Osa,
      alamosa: clean(r["alamosa"]),
      sek_kood: cleanCode(r["sek_kood"]),
      nimetus,
      tähis: clean(r["tähis"]),
      ühik: clean(r["ühik"]),
      ostuhind_neto: parseNumOrNull(r["ostuhind_neto_€"]),
      töö_h_ühik: parseNumOrNull(r["töö_h_ühik"]),
      alt_nimed: clean(r["alt_nimed"]),
    });
  }
  return rows;
}

function clean(v: unknown): string | null {
  if (v === null || v === undefined) return null;
  const s = String(v).trim();
  return s.length === 0 ? null : s;
}
function cleanCode(v: unknown): string | null {
  if (v === null || v === undefined) return null;
  // sek_kood võib olla number Excel'is (711, 712, ...) — me tahame stringi
  if (typeof v === "number") return String(v);
  const s = String(v).trim();
  return s.length === 0 ? null : s;
}
function parseNumOrNull(v: unknown): number | null {
  if (v === null || v === undefined || v === "") return null;
  if (typeof v === "number") return Number.isFinite(v) ? v : null;
  // Formula stringid ("=IF(...)") jäta vahele
  const s = String(v).trim();
  if (s.startsWith("=")) return null;
  const n = Number(s.replace(",", "."));
  return Number.isFinite(n) ? n : null;
}

async function main() {
  console.log(`Loen faili: ${KATALOOG_PATH}`);
  const rows = readKataloog();
  console.log(`Loetud ${rows.length} rida xlsx'ist`);

  const byOsa = rows.reduce<Record<string, number>>((acc, r) => {
    acc[r.osa] = (acc[r.osa] ?? 0) + 1;
    return acc;
  }, {});
  console.log("Jaotus osa järgi:", byOsa);

  const sb = createClient(SUPABASE_URL!, SERVICE_ROLE!, {
    auth: { persistSession: false, autoRefreshToken: false },
  });

  // ---- 1. Upsert artiklid (kood unique) ----
  const artikliRows = rows.map((r) => ({
    kood: r.kood,
    osa: r.osa,
    alamosa: r.alamosa,
    sek_kood: r.sek_kood,
    nimetus: r.nimetus,
    tähis: r.tähis,
    ühik: r.ühik,
    alt_nimed: r.alt_nimed,
    aktiivne: true,
  }));

  console.log(`Upsert ${artikliRows.length} artiklit ...`);
  const { data: artiklid, error: upErr } = await sb
    .from("artiklid")
    .upsert(artikliRows, { onConflict: "kood" })
    .select("id, kood");
  if (upErr) {
    console.error("Artiklite upsert ebaõnnestus:", upErr);
    process.exit(1);
  }
  console.log(`✓ Upsert OK — ${artiklid?.length ?? 0} rida`);

  const idByKood = new Map<string, string>();
  for (const a of artiklid ?? []) idByKood.set(a.kood, a.id);

  // ---- 2. Hinnad — lisa rida ainult kui ostuhind VÕI töötund on antud
  //         ja kehtiv hind erineb (võrdle viimase reaga selle artikli kohta) ----

  // Tõmba kõik artiklite kehtivad hinnad korraga
  const { data: kehtivad, error: vErr } = await sb
    .from("artiklid_kehtivad_hinnaga")
    .select("id, ostuhind_neto, töö_h_ühik");
  if (vErr) {
    console.error("Vaate lugemine ebaõnnestus:", vErr);
    process.exit(1);
  }
  const kehtivByArtikkel = new Map<string, { ostuhind: number | null; töö: number | null }>();
  for (const k of kehtivad ?? []) {
    kehtivByArtikkel.set(k.id, {
      ostuhind: k.ostuhind_neto ?? null,
      töö: k["töö_h_ühik"] ?? null,
    });
  }

  const hinnaRows: Array<{
    artikkel_id: string;
    ostuhind_neto: number | null;
    töö_h_ühik: number | null;
    märkused: string;
  }> = [];

  let skipNoValues = 0;
  let skipUnchanged = 0;
  for (const r of rows) {
    if (r.ostuhind_neto === null && r.töö_h_ühik === null) {
      skipNoValues++;
      continue;
    }
    const id = idByKood.get(r.kood);
    if (!id) continue;
    const k = kehtivByArtikkel.get(id);
    if (k && eq(k.ostuhind, r.ostuhind_neto) && eq(k.töö, r.töö_h_ühik)) {
      skipUnchanged++;
      continue;
    }
    hinnaRows.push({
      artikkel_id: id,
      ostuhind_neto: r.ostuhind_neto,
      töö_h_ühik: r.töö_h_ühik,
      märkused: "Algimport vk_kataloog_v1.xlsx-ist",
    });
  }

  console.log(`Hinnad: ${hinnaRows.length} uut rida (vahele: ${skipNoValues} ilma väärtuseta, ${skipUnchanged} samad).`);

  if (hinnaRows.length > 0) {
    const { error: hErr } = await sb.from("hinnad").insert(hinnaRows);
    if (hErr) {
      console.error("Hinnaridade lisamine ebaõnnestus:", hErr);
      process.exit(1);
    }
    console.log("✓ Hinnaread sisestatud");
  }

  // ---- 3. Lõplik kontroll ----
  const { count } = await sb
    .from("artiklid")
    .select("*", { count: "exact", head: true })
    .eq("aktiivne", true);
  console.log(`\nKokku aktiivseid artikleid Supabase's: ${count}`);
  console.log("Valmis ✓");
}

function eq(a: number | null, b: number | null) {
  if (a === null && b === null) return true;
  if (a === null || b === null) return false;
  return Math.abs(a - b) < 0.001;
}

main().catch((err) => {
  console.error("Import ebaõnnestus:", err);
  process.exit(1);
});
