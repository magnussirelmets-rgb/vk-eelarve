"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { z } from "zod";
import { getServerSupabase } from "@/lib/supabase/server";
import { OSA_VALUES } from "@/lib/types";

export async function kustutaTooted(
  ids: string[],
): Promise<{ ok: true; kustutatud: number } | { ok: false; error: string }> {
  if (!ids || ids.length === 0) return { ok: false, error: "Pole midagi kustutada" };
  const sb = getServerSupabase();
  // positsioonid.toode_id ja komplekti_read.toode_id on ON DELETE SET NULL — säilivad snapshot'iga
  const { error, count } = await sb
    .from("hinnakirja_read")
    .delete({ count: "exact" })
    .in("id", ids);
  if (error) return { ok: false, error: error.message };
  revalidatePath("/kataloog");
  return { ok: true, kustutatud: count ?? ids.length };
}

export async function kustutaTarnijaArtikkel(
  id: string,
  vk_artikkel_id: string,
): Promise<{ ok: true } | { ok: false; error: string }> {
  if (!id) return { ok: false, error: "ID puudub" };
  const sb = getServerSupabase();
  const { error } = await sb.from("tarnija_artiklid").delete().eq("id", id);
  if (error) return { ok: false, error: error.message };
  revalidatePath(`/kataloog/${vk_artikkel_id}`);
  revalidatePath("/kataloog");
  return { ok: true };
}

export async function kustutaArtikleid(
  ids: string[],
): Promise<{ ok: true; deleted: number } | { ok: false; error: string }> {
  if (!ids || ids.length === 0) return { ok: false, error: "Pole midagi kustutada" };
  const sb = getServerSupabase();
  const { error, count } = await sb
    .from("artiklid")
    .delete({ count: "exact" })
    .in("id", ids);
  if (error) return { ok: false, error: error.message };
  revalidatePath("/kataloog");
  return { ok: true, deleted: count ?? ids.length };
}

// ----------------------------------------------------------------------------
// Toote meta (paigaldusaeg + märkused + alt_nimed) — elab hinnakirja_read'is
// ----------------------------------------------------------------------------

export async function muudaToodeNimetus(
  tooteId: string,
  nimetus: string,
): Promise<{ ok: true } | { ok: false; error: string }> {
  if (!tooteId) return { ok: false, error: "Toote ID puudub" };
  const trimmed = nimetus.trim();
  if (!trimmed) return { ok: false, error: "Nimetus ei tohi olla tühi" };
  const sb = getServerSupabase();
  const { error } = await sb
    .from("hinnakirja_read")
    .update({ tarnija_nimetus: trimmed })
    .eq("id", tooteId);
  if (error) return { ok: false, error: error.message };
  revalidatePath(`/kataloog/${tooteId}`);
  revalidatePath("/kataloog");
  return { ok: true };
}

export type KataloogiImportTulemus = {
  uuendatud: number;
  loodud: number;
  vigade_arv: number;
  vea_näited: string[];
  kontrollitud: number;
};

// Eelvaate rida — tagastatakse parsiImpordiFail-ist kliendile.
export type ImpordiRida = {
  _tempId: string;
  rea_nr: number;
  // Kasutaja-määratud andmed
  tarnija_nimetus: string;
  tarnija: string | null;
  id_olemas: string | null; // kui CSV sisaldas id veergu ja id viitab olemasolevale reale
  tarnija_kood: string | null;
  tarnija_brand: string | null;
  tähis: string | null;
  ühik: string | null;
  ostuhind_neto: number | null;
  paigaldusaeg_h_ühik: number | null;
  kirjeldus: string | null;
  magnus_alt_nimed: string | null;
  magnus_märkused: string | null;
  // Olemasoleva-kontroll
  duplikaat: boolean;       // sama (tarnija + tarnija_kood) juba kataloogis
  duplikaadi_id: string | null;
};

function parseCsvLines(text: string): unknown[][] {
  const sep = text.split("\n")[0]?.includes(";") ? ";" : ",";
  const rows: unknown[][] = [];
  let cur: string[] = [];
  let field = "";
  let inQuote = false;
  for (let i = 0; i < text.length; i++) {
    const c = text[i];
    if (inQuote) {
      if (c === '"' && text[i + 1] === '"') {
        field += '"';
        i++;
      } else if (c === '"') {
        inQuote = false;
      } else {
        field += c;
      }
    } else {
      if (c === '"') inQuote = true;
      else if (c === sep) {
        cur.push(field);
        field = "";
      } else if (c === "\n" || c === "\r") {
        if (c === "\r" && text[i + 1] === "\n") i++;
        cur.push(field);
        rows.push(cur);
        cur = [];
        field = "";
      } else field += c;
    }
  }
  if (field.length > 0 || cur.length > 0) {
    cur.push(field);
    rows.push(cur);
  }
  return rows;
}

function parseNullableNum(v: unknown): number | null {
  if (v === null || v === undefined) return null;
  const s = String(v).trim().replace(",", ".");
  if (!s) return null;
  const n = Number(s);
  return Number.isFinite(n) ? n : null;
}

async function getVoiLoo_Hinnakiri(
  sb: ReturnType<typeof getServerSupabase>,
  tarnija: string,
): Promise<string | null> {
  const t = tarnija.trim() || "VK Manuaalsed";
  const { data: olemasolev } = await sb
    .from("hinnakirjad")
    .select("id")
    .eq("tarnija", t)
    .eq("faili_tüüp", "manual")
    .maybeSingle();
  if (olemasolev) return (olemasolev as { id: string }).id;

  // Kui sama nimega on tavaline hinnakiri (mitte manual), kasuta seda
  const { data: tavaline } = await sb
    .from("hinnakirjad")
    .select("id")
    .eq("tarnija", t)
    .order("loodud", { ascending: false })
    .limit(1)
    .maybeSingle();
  if (tavaline) return (tavaline as { id: string }).id;

  // Loo uus manual hinnakiri
  const { data: created } = await sb
    .from("hinnakirjad")
    .insert({
      tarnija: t,
      faili_path: null,
      faili_nimi: null,
      faili_tüüp: "manual",
      staatus: "kinnitatud",
      "märkused": "Käsitsi sisestatud / Excel-impordi käigus loodud.",
    })
    .select("id")
    .single();
  return ((created as { id: string } | null)?.id) ?? null;
}

// ----------------------------------------------------------------------------
// FAAS 2 — Valikuline import (kahepoolne voog)
//
// 1) parsiImpordiFail(formData) → parsetud read kliendile (preview, EI salvesta)
// 2) impordiValitudRead(read)    → ainult valitud read insert/update'tud
// ----------------------------------------------------------------------------

async function parsiFailRidadeks(
  file: File,
): Promise<{ ok: true; rows2d: unknown[][] } | { ok: false; error: string }> {
  const name = file.name.toLowerCase();
  const isCsv = name.endsWith(".csv");
  const isXlsx = name.endsWith(".xlsx") || name.endsWith(".xls");
  if (!isCsv && !isXlsx) return { ok: false, error: "Toetatud failitüübid: .csv, .xlsx, .xls" };

  let rows2d: unknown[][] = [];
  if (isCsv) {
    let text = Buffer.from(await file.arrayBuffer()).toString("utf-8");
    if (text.charCodeAt(0) === 0xfeff) text = text.slice(1);
    rows2d = parseCsvLines(text);
  } else {
    const XLSX = await import("xlsx");
    const wb = XLSX.read(Buffer.from(await file.arrayBuffer()), { type: "buffer" });
    const sheetName = wb.SheetNames[0];
    if (!sheetName) return { ok: false, error: "Excelis pole ühtegi lehte" };
    rows2d = XLSX.utils.sheet_to_json(wb.Sheets[sheetName], {
      header: 1,
      defval: null,
    }) as unknown[][];
  }
  if (rows2d.length < 2) {
    return { ok: false, error: "Failis peab olema vähemalt päise rida + üks andmerida" };
  }
  return { ok: true, rows2d };
}

function tuvastaVeerud(rows2d: unknown[][]): {
  ok: true;
  idx: Record<string, number>;
  headerRaw: string[];
} | { ok: false; error: string } {
  function normHead(s: string): string {
    return s.toLowerCase().replace(/[_\-\s]+/g, " ").trim();
  }
  const headerRaw = rows2d[0].map((c) => String(c ?? "").trim());
  const normalisedHeader = headerRaw.map(normHead);
  function findColV2(names: string[]): number {
    const norm = names.map(normHead);
    for (let i = 0; i < normalisedHeader.length; i++) {
      if (norm.includes(normalisedHeader[i])) return i;
      for (const n of norm) {
        if (n.length >= 4 && normalisedHeader[i].includes(n)) return i;
      }
    }
    return -1;
  }
  const idx = {
    id: findColV2(["id", "rea id"]),
    tarnija: findColV2(["tarnija"]),
    kood: findColV2([
      "tarnija kood", "kood", "code", "art kood", "artikli kood",
      "artikkel", "sku", "tootekood",
    ]),
    nimetus: findColV2([
      "tarnija nimetus", "nimetus", "toote nimetus", "tootenimetus",
      "toode", "mudel", "model", "name", "product",
    ]),
    brand: findColV2(["tarnija brand", "brand", "tootja", "mark", "kaubamärk"]),
    tähis: findColV2(["tähis", "tahis", "marking"]),
    ühik: findColV2(["ühik", "uhik", "unit"]),
    ostuhind: findColV2([
      "ostuhind", "ostuhind neto", "ostuhind eur", "hind",
      "price", "cost", "cost price",
    ]),
    aeg: findColV2(["paigaldusaeg h", "paigaldusaeg", "aeg h", "tunnid"]),
    kirjeldus: findColV2([
      "kirjeldus", "tootekirjeldus", "toote kirjeldus", "spec",
      "specification", "spetsifikatsioon", "description",
    ]),
    altNimed: findColV2(["alt nimed", "sünonüümid", "synonyms"]),
    märkused: findColV2([
      "sisemised märkused", "märkused", "markused", "magnus märkused", "notes",
    ]),
  };
  if (idx.nimetus < 0) {
    return {
      ok: false,
      error: `Veerg 'tarnija_nimetus' (sünonüümid: nimetus, toode, mudel) puudub. Failis on: ${headerRaw
        .filter((h) => h)
        .map((h) => `"${h}"`)
        .join(", ")}`,
    };
  }
  return { ok: true, idx, headerRaw };
}

export async function parsiImpordiFail(
  formData: FormData,
): Promise<
  | { ok: true; read: ImpordiRida[]; duplikaate: number; pärit_nimi: string }
  | { ok: false; error: string }
> {
  const file = formData.get("fail");
  if (!(file instanceof File) || file.size === 0) return { ok: false, error: "Fail puudub" };
  if (file.size > 10 * 1024 * 1024) return { ok: false, error: "Fail liiga suur (max 10 MB)" };

  const parsed = await parsiFailRidadeks(file);
  if (!parsed.ok) return parsed;

  const cols = tuvastaVeerud(parsed.rows2d);
  if (!cols.ok) return cols;
  const { idx } = cols;
  const rows2d = parsed.rows2d;

  // Kogu (tarnija, kood) paarid duplikaadi-kontrolliks
  const koodiPaarid: Array<{ tarnija: string; kood: string; ri: number }> = [];

  const read: ImpordiRida[] = [];
  for (let ri = 1; ri < rows2d.length; ri++) {
    const row = rows2d[ri];
    if (!row || row.length === 0) continue;
    const nimetus = String(row[idx.nimetus] ?? "").trim();
    if (!nimetus) continue;

    const tarnija = idx.tarnija >= 0 ? String(row[idx.tarnija] ?? "").trim() || null : null;
    const kood = idx.kood >= 0 ? String(row[idx.kood] ?? "").trim() || null : null;
    const id = idx.id >= 0 ? String(row[idx.id] ?? "").trim() || null : null;

    if (tarnija && kood) {
      koodiPaarid.push({ tarnija, kood, ri: read.length });
    }

    read.push({
      _tempId: `rida-${ri}`,
      rea_nr: ri,
      tarnija_nimetus: nimetus,
      tarnija,
      id_olemas: id,
      tarnija_kood: kood,
      tarnija_brand: idx.brand >= 0 ? String(row[idx.brand] ?? "").trim() || null : null,
      tähis: idx.tähis >= 0 ? String(row[idx.tähis] ?? "").trim() || null : null,
      ühik: idx.ühik >= 0 ? String(row[idx.ühik] ?? "").trim() || null : null,
      ostuhind_neto: idx.ostuhind >= 0 ? parseNullableNum(row[idx.ostuhind]) : null,
      paigaldusaeg_h_ühik: idx.aeg >= 0 ? parseNullableNum(row[idx.aeg]) : null,
      kirjeldus: idx.kirjeldus >= 0 ? String(row[idx.kirjeldus] ?? "").trim() || null : null,
      magnus_alt_nimed: idx.altNimed >= 0 ? String(row[idx.altNimed] ?? "").trim() || null : null,
      magnus_märkused: idx.märkused >= 0 ? String(row[idx.märkused] ?? "").trim() || null : null,
      duplikaat: false,
      duplikaadi_id: null,
    });
  }

  // Kontrolli olemasolevate koodide vastu (batch-query per tarnija)
  const sb = getServerSupabase();
  const unikaalseidTarnijaid = Array.from(new Set(koodiPaarid.map((p) => p.tarnija)));
  let duplikaate = 0;
  for (const tarnija of unikaalseidTarnijaid) {
    const koodid = koodiPaarid.filter((p) => p.tarnija === tarnija).map((p) => p.kood);
    if (koodid.length === 0) continue;

    // Lae sama tarnija olemasolevad read
    const { data: hkRows } = await sb
      .from("hinnakirjad")
      .select("id")
      .eq("tarnija", tarnija);
    const hkIds = (hkRows ?? []).map((h: { id: string }) => h.id);
    if (hkIds.length === 0) continue;

    const { data: olemasolevad } = await sb
      .from("hinnakirja_read")
      .select("id, tarnija_kood")
      .in("hinnakiri_id", hkIds)
      .in("tarnija_kood", koodid);

    const olemasolevateKaart = new Map<string, string>();
    for (const r of (olemasolevad ?? []) as Array<{ id: string; tarnija_kood: string }>) {
      if (r.tarnija_kood) olemasolevateKaart.set(r.tarnija_kood.toLowerCase(), r.id);
    }

    for (const paar of koodiPaarid) {
      if (paar.tarnija !== tarnija) continue;
      const olemasolevaId = olemasolevateKaart.get(paar.kood.toLowerCase());
      if (olemasolevaId) {
        read[paar.ri].duplikaat = true;
        read[paar.ri].duplikaadi_id = olemasolevaId;
        duplikaate++;
      }
    }
  }

  return { ok: true, read, duplikaate, pärit_nimi: file.name };
}

export async function impordiValitudRead(
  read: ImpordiRida[],
): Promise<KataloogiImportTulemus | { error: string }> {
  if (!read || read.length === 0) {
    return { error: "Pole valitud ühtegi rida" };
  }
  const sb = getServerSupabase();
  const hkCache = new Map<string, string>();

  let uuendatud = 0;
  let loodud = 0;
  let vigade_arv = 0;
  const vea_näited: string[] = [];

  for (const r of read) {
    const upd: Record<string, unknown> = {
      tarnija_nimetus: r.tarnija_nimetus,
    };
    if (r.tarnija_kood !== null) upd.tarnija_kood = r.tarnija_kood;
    if (r.tarnija_brand !== null) upd.tarnija_brand = r.tarnija_brand;
    if (r.tähis !== null) upd["tähis"] = r.tähis;
    if (r.ühik !== null) upd["ühik"] = r.ühik;
    if (r.ostuhind_neto !== null) upd.ostuhind_neto = r.ostuhind_neto;
    if (r.paigaldusaeg_h_ühik !== null) upd.paigaldusaeg_h_ühik = r.paigaldusaeg_h_ühik;
    if (r.kirjeldus !== null) upd.kirjeldus = r.kirjeldus;
    if (r.magnus_alt_nimed !== null) upd.magnus_alt_nimed = r.magnus_alt_nimed;
    if (r.magnus_märkused !== null) upd.magnus_märkused = r.magnus_märkused;

    try {
      // Eelistus: id_olemas (CSV id veerg) > duplikaadi_id (sama kood) > insert
      if (r.id_olemas) {
        const { error, count } = await sb
          .from("hinnakirja_read")
          .update(upd, { count: "exact" })
          .eq("id", r.id_olemas);
        if (error) {
          vigade_arv++;
          if (vea_näited.length < 10) vea_näited.push(`Rida ${r.rea_nr}: ${error.message}`);
        } else if ((count ?? 0) > 0) {
          uuendatud++;
        } else {
          vigade_arv++;
          if (vea_näited.length < 10)
            vea_näited.push(`Rida ${r.rea_nr}: id "${r.id_olemas.slice(0, 8)}…" ei leitud`);
        }
        continue;
      }

      if (r.duplikaat && r.duplikaadi_id) {
        const { error } = await sb
          .from("hinnakirja_read")
          .update(upd)
          .eq("id", r.duplikaadi_id);
        if (error) {
          vigade_arv++;
          if (vea_näited.length < 10) vea_näited.push(`Rida ${r.rea_nr}: ${error.message}`);
        } else {
          uuendatud++;
        }
        continue;
      }

      // INSERT — uus rida, leia/lisa hinnakiri
      const tarnijaKey = r.tarnija || "VK Manuaalsed";
      let hkId = hkCache.get(tarnijaKey);
      if (!hkId) {
        const got = await getVoiLoo_Hinnakiri(sb, tarnijaKey);
        if (!got) {
          vigade_arv++;
          if (vea_näited.length < 10)
            vea_näited.push(`Rida ${r.rea_nr}: ei suutnud luua hinnakirja "${tarnijaKey}"`);
          continue;
        }
        hkId = got;
        hkCache.set(tarnijaKey, hkId);
      }

      const { error } = await sb.from("hinnakirja_read").insert({
        hinnakiri_id: hkId,
        ...upd,
        staatus: "matchimata",
      });
      if (error) {
        vigade_arv++;
        if (vea_näited.length < 10) vea_näited.push(`Rida ${r.rea_nr}: ${error.message}`);
      } else {
        loodud++;
      }
    } catch (e) {
      vigade_arv++;
      if (vea_näited.length < 10)
        vea_näited.push(`Rida ${r.rea_nr}: ${e instanceof Error ? e.message : String(e)}`);
    }
  }

  revalidatePath("/kataloog");
  revalidatePath("/hinnakirjad");

  return { uuendatud, loodud, vigade_arv, vea_näited, kontrollitud: read.length };
}

export async function kataloogiImport(
  formData: FormData,
): Promise<KataloogiImportTulemus | { error: string }> {
  const file = formData.get("fail");
  if (!(file instanceof File) || file.size === 0) return { error: "Fail puudub" };
  if (file.size > 10 * 1024 * 1024) return { error: "Fail liiga suur (max 10 MB)" };
  const name = file.name.toLowerCase();
  const isCsv = name.endsWith(".csv");
  const isXlsx = name.endsWith(".xlsx") || name.endsWith(".xls");
  if (!isCsv && !isXlsx) return { error: "Toetatud failitüübid: .csv, .xlsx, .xls" };

  let rows2d: unknown[][] = [];
  if (isCsv) {
    let text = Buffer.from(await file.arrayBuffer()).toString("utf-8");
    if (text.charCodeAt(0) === 0xfeff) text = text.slice(1);
    rows2d = parseCsvLines(text);
  } else {
    const XLSX = await import("xlsx");
    const wb = XLSX.read(Buffer.from(await file.arrayBuffer()), { type: "buffer" });
    const sheetName = wb.SheetNames[0];
    if (!sheetName) return { error: "Excelis pole ühtegi lehte" };
    rows2d = XLSX.utils.sheet_to_json(wb.Sheets[sheetName], { header: 1, defval: null }) as unknown[][];
  }
  if (rows2d.length < 2) return { error: "Failis peab olema vähemalt päise rida + üks andmerida" };

  const header = rows2d[0].map((c) => String(c ?? "").trim().toLowerCase());
  const idx = (names: string[]) => {
    for (let i = 0; i < header.length; i++) if (names.includes(header[i])) return i;
    return -1;
  };
  // Normaliseerib päise: _, -, tühikud → üks tühik; lowercase
  function normHead(s: string): string {
    return s.toLowerCase().replace(/[_\-\s]+/g, " ").trim();
  }
  const normalisedHeader = header.map((h) => normHead(String(h ?? "")));
  const headerRaw = rows2d[0].map((c) => String(c ?? "").trim());
  function findColV2(names: string[]): number {
    const norm = names.map(normHead);
    for (let i = 0; i < normalisedHeader.length; i++) {
      if (norm.includes(normalisedHeader[i])) return i;
      for (const n of norm) {
        if (n.length >= 4 && normalisedHeader[i].includes(n)) return i;
      }
    }
    return -1;
  }
  const idxId = findColV2(["id", "rea id"]);
  const idxTarnija = findColV2(["tarnija"]);
  const idxKood = findColV2([
    "tarnija kood",
    "kood",
    "code",
    "art kood",
    "artikli kood",
    "artikkel",
    "sku",
    "tootekood",
  ]);
  const idxNimetus = findColV2([
    "tarnija nimetus",
    "nimetus",
    "toote nimetus",
    "tootenimetus",
    "toode",
    "mudel",
    "model",
    "name",
    "product",
  ]);
  const idxBrand = findColV2(["tarnija brand", "brand", "tootja", "mark", "kaubamärk"]);
  const idxTähis = findColV2(["tähis", "tahis", "marking"]);
  const idxÜhik = findColV2(["ühik", "uhik", "unit"]);
  const idxOstuhind = findColV2([
    "ostuhind",
    "ostuhind neto",
    "ostuhind eur",
    "hind",
    "price",
    "cost",
    "cost price",
  ]);
  const idxAeg = findColV2(["paigaldusaeg h", "paigaldusaeg", "aeg h", "tunnid"]);
  const idxKirjeldus = findColV2([
    "kirjeldus",
    "tootekirjeldus",
    "toote kirjeldus",
    "spec",
    "specification",
    "spetsifikatsioon",
    "description",
  ]);
  const idxAltNimed = findColV2(["alt nimed", "sünonüümid", "synonyms"]);
  const idxMärkused = findColV2([
    "sisemised märkused",
    "märkused",
    "markused",
    "magnus märkused",
    "notes",
  ]);

  if (idxNimetus < 0) {
    return {
      error: `Veerg 'tarnija_nimetus' (sünonüümid: nimetus, toode, mudel, name) puudub. Failis on veerud: ${headerRaw
        .filter((h) => h)
        .map((h) => `"${h}"`)
        .join(", ")}`,
    };
  }

  const sb = getServerSupabase();
  let uuendatud = 0;
  let loodud = 0;
  let vigade_arv = 0;
  const vea_näited: string[] = [];
  let kontrollitud = 0;

  // Cache: tarnija → hinnakirja_id
  const hkCache = new Map<string, string>();

  for (let ri = 1; ri < rows2d.length; ri++) {
    const row = rows2d[ri];
    if (!row || row.length === 0) continue;
    const nimetus = String(row[idxNimetus] ?? "").trim();
    if (!nimetus) continue; // tühi rida
    kontrollitud++;

    const id = idxId >= 0 ? String(row[idxId] ?? "").trim() : "";
    const tarnija = idxTarnija >= 0 ? String(row[idxTarnija] ?? "").trim() : "";

    const baseFields: Record<string, unknown> = {
      tarnija_nimetus: nimetus,
      tarnija_kood: idxKood >= 0 ? String(row[idxKood] ?? "").trim() || null : undefined,
      tarnija_brand: idxBrand >= 0 ? String(row[idxBrand] ?? "").trim() || null : undefined,
      "tähis": idxTähis >= 0 ? String(row[idxTähis] ?? "").trim() || null : undefined,
      "ühik": idxÜhik >= 0 ? String(row[idxÜhik] ?? "").trim() || null : undefined,
      ostuhind_neto: idxOstuhind >= 0 ? parseNullableNum(row[idxOstuhind]) : undefined,
      paigaldusaeg_h_ühik: idxAeg >= 0 ? parseNullableNum(row[idxAeg]) : undefined,
      kirjeldus: idxKirjeldus >= 0 ? String(row[idxKirjeldus] ?? "").trim() || null : undefined,
      magnus_alt_nimed: idxAltNimed >= 0 ? String(row[idxAltNimed] ?? "").trim() || null : undefined,
      magnus_märkused: idxMärkused >= 0 ? String(row[idxMärkused] ?? "").trim() || null : undefined,
    };
    // Eemalda undefined väljad — ainult tegelikud Excelis olemas olnud veerud lähevad UPDATE-i
    const upd: Record<string, unknown> = {};
    for (const [k, v] of Object.entries(baseFields)) if (v !== undefined) upd[k] = v;

    try {
      if (id) {
        const { error, count } = await sb
          .from("hinnakirja_read")
          .update(upd, { count: "exact" })
          .eq("id", id);
        if (error) {
          vigade_arv++;
          if (vea_näited.length < 10) vea_näited.push(`Rida ${ri + 1}: ${error.message}`);
        } else if ((count ?? 0) > 0) {
          uuendatud++;
        } else {
          // ID ei leitud DB-st — vea raporti jaoks
          vigade_arv++;
          if (vea_näited.length < 10) vea_näited.push(`Rida ${ri + 1}: id "${id.slice(0, 8)}…" ei leitud`);
        }
      } else {
        // Insert või update — vajab hinnakirja_id
        const tarnijaKey = tarnija || "VK Manuaalsed";
        let hkId = hkCache.get(tarnijaKey);
        if (!hkId) {
          const got = await getVoiLoo_Hinnakiri(sb, tarnijaKey);
          if (!got) {
            vigade_arv++;
            if (vea_näited.length < 10)
              vea_näited.push(`Rida ${ri + 1}: ei suutnud luua hinnakirja tarnijale "${tarnijaKey}"`);
            continue;
          }
          hkId = got;
          hkCache.set(tarnijaKey, hkId);
        }

        // Faas 1: kui sama (hinnakirja_id, tarnija_kood) juba eksisteerib,
        // UPDATE olemasolev rida (mitte viska duplicate-key viga).
        const tarnijaKood =
          upd.tarnija_kood !== undefined && upd.tarnija_kood !== null
            ? String(upd.tarnija_kood)
            : null;
        let olemasolevaId: string | null = null;
        if (tarnijaKood) {
          const { data: olemasolev } = await sb
            .from("hinnakirja_read")
            .select("id")
            .eq("hinnakiri_id", hkId)
            .eq("tarnija_kood", tarnijaKood)
            .maybeSingle();
          olemasolevaId = (olemasolev as { id: string } | null)?.id ?? null;
        }

        if (olemasolevaId) {
          // UPDATE — sama kood juba olemas, uuendame väärtused
          const { error } = await sb
            .from("hinnakirja_read")
            .update(upd)
            .eq("id", olemasolevaId);
          if (error) {
            vigade_arv++;
            if (vea_näited.length < 10) vea_näited.push(`Rida ${ri + 1}: ${error.message}`);
          } else {
            uuendatud++;
          }
          continue;
        }

        // INSERT — uus rida
        const { error } = await sb.from("hinnakirja_read").insert({
          hinnakiri_id: hkId,
          tarnija_nimetus: nimetus,
          ...(upd.tarnija_kood !== undefined ? { tarnija_kood: upd.tarnija_kood } : {}),
          ...(upd.tarnija_brand !== undefined ? { tarnija_brand: upd.tarnija_brand } : {}),
          ...(upd["tähis"] !== undefined ? { "tähis": upd["tähis"] } : {}),
          ...(upd["ühik"] !== undefined ? { "ühik": upd["ühik"] } : {}),
          ...(upd.ostuhind_neto !== undefined ? { ostuhind_neto: upd.ostuhind_neto } : {}),
          ...(upd.paigaldusaeg_h_ühik !== undefined ? { paigaldusaeg_h_ühik: upd.paigaldusaeg_h_ühik } : {}),
          ...(upd.kirjeldus !== undefined ? { kirjeldus: upd.kirjeldus } : {}),
          ...(upd.magnus_alt_nimed !== undefined ? { magnus_alt_nimed: upd.magnus_alt_nimed } : {}),
          ...(upd.magnus_märkused !== undefined ? { magnus_märkused: upd.magnus_märkused } : {}),
          staatus: "matchimata",
        });
        if (error) {
          vigade_arv++;
          if (vea_näited.length < 10) vea_näited.push(`Rida ${ri + 1}: ${error.message}`);
        } else {
          loodud++;
        }
      }
    } catch (e) {
      vigade_arv++;
      if (vea_näited.length < 10) vea_näited.push(`Rida ${ri + 1}: ${e instanceof Error ? e.message : String(e)}`);
    }
  }

  revalidatePath("/kataloog");
  revalidatePath("/hinnakirjad");

  return { uuendatud, loodud, vigade_arv, vea_näited, kontrollitud };
}

export async function muudaTooteMeta(input: {
  tooteId: string;
  paigaldusaeg_h_ühik: number | null;
  magnus_märkused: string | null;
  magnus_alt_nimed: string | null;
  kirjeldus?: string | null;
}): Promise<{ ok: true } | { ok: false; error: string }> {
  if (!input.tooteId) return { ok: false, error: "Toote ID puudub" };
  const sb = getServerSupabase();
  const upd: Record<string, unknown> = {
    paigaldusaeg_h_ühik: input.paigaldusaeg_h_ühik,
    magnus_märkused: input.magnus_märkused,
    magnus_alt_nimed: input.magnus_alt_nimed,
  };
  if (input.kirjeldus !== undefined) upd.kirjeldus = input.kirjeldus;
  const { error } = await sb.from("hinnakirja_read").update(upd).eq("id", input.tooteId);
  if (error) return { ok: false, error: error.message };
  revalidatePath(`/kataloog/${input.tooteId}`);
  revalidatePath("/kataloog");
  return { ok: true };
}

// Üks rida — kiire inline-edit kataloogis (ainult paigaldusaeg)
export async function muudaPaigaldusaeg(
  tooteId: string,
  paigaldusaeg_h_ühik: number | null,
): Promise<{ ok: true } | { ok: false; error: string }> {
  if (!tooteId) return { ok: false, error: "Toote ID puudub" };
  const sb = getServerSupabase();
  const { error } = await sb
    .from("hinnakirja_read")
    .update({ paigaldusaeg_h_ühik })
    .eq("id", tooteId);
  if (error) return { ok: false, error: error.message };
  revalidatePath("/kataloog");
  return { ok: true };
}

// Bulk — sama paigaldusaeg mitmele reale (üks väärtus)
export async function muudaMassiPaigaldusaeg(
  ids: string[],
  paigaldusaeg_h_ühik: number | null,
): Promise<{ ok: true; uuendatud: number } | { ok: false; error: string }> {
  if (!ids || ids.length === 0) return { ok: false, error: "Pole midagi valitud" };
  const sb = getServerSupabase();
  const { error, count } = await sb
    .from("hinnakirja_read")
    .update({ paigaldusaeg_h_ühik }, { count: "exact" })
    .in("id", ids);
  if (error) return { ok: false, error: error.message };
  revalidatePath("/kataloog");
  return { ok: true, uuendatud: count ?? ids.length };
}

// Bulk — per-id väärtused (kasutaja sisestas mitmes reas erinevaid paigaldusaegu)
export async function salvestaPaigaldusajadMass(
  changes: Array<{ id: string; paigaldusaeg_h_ühik: number | null }>,
): Promise<{ ok: true; uuendatud: number } | { ok: false; error: string }> {
  if (!changes || changes.length === 0) return { ok: false, error: "Pole midagi salvestada" };
  const sb = getServerSupabase();
  let uuendatud = 0;
  for (const c of changes) {
    const { error } = await sb
      .from("hinnakirja_read")
      .update({ paigaldusaeg_h_ühik: c.paigaldusaeg_h_ühik })
      .eq("id", c.id);
    if (error) {
      return { ok: false, error: `Rida ${c.id.slice(0, 8)}…: ${error.message} (salvestatud ${uuendatud}/${changes.length})` };
    }
    uuendatud++;
  }
  revalidatePath("/kataloog");
  return { ok: true, uuendatud };
}

// Bulk — märgi mitu rida ignoreerituks (kaovad kataloogi vaatest)
export async function ignoreeriMassi(
  ids: string[],
): Promise<{ ok: true; uuendatud: number } | { ok: false; error: string }> {
  if (!ids || ids.length === 0) return { ok: false, error: "Pole midagi valitud" };
  const sb = getServerSupabase();
  const { error, count } = await sb
    .from("hinnakirja_read")
    .update({ staatus: "ignoreeritud" }, { count: "exact" })
    .in("id", ids);
  if (error) return { ok: false, error: error.message };
  revalidatePath("/kataloog");
  return { ok: true, uuendatud: count ?? ids.length };
}

const numeric = z
  .union([z.string(), z.number()])
  .nullable()
  .optional()
  .transform((v) => {
    if (v === null || v === undefined || v === "") return null;
    const n = typeof v === "string" ? Number(v.replace(",", ".")) : v;
    return Number.isFinite(n) ? n : null;
  });

const ArtikkelSchema = z.object({
  kood: z.string().min(2, "Kood on kohustuslik").max(50),
  osa: z.enum(OSA_VALUES as [string, ...string[]]),
  alamosa: z.string().nullable().optional().transform((v) => (v?.trim() ? v.trim() : null)),
  sek_kood: z.string().nullable().optional().transform((v) => (v?.trim() ? v.trim() : null)),
  nimetus: z.string().min(1, "Nimetus on kohustuslik").max(255),
  tähis: z.string().nullable().optional().transform((v) => (v?.trim() ? v.trim() : null)),
  ühik: z.string().nullable().optional().transform((v) => (v?.trim() ? v.trim() : null)),
  alt_nimed: z.string().nullable().optional().transform((v) => (v?.trim() ? v.trim() : null)),
  ostuhind_neto: numeric,
  töö_h_ühik: numeric,
});

const HindSchema = z.object({
  artikkel_id: z.string().uuid(),
  ostuhind_neto: numeric,
  töö_h_ühik: numeric,
  kehtib_alates: z.string().min(1, "Kehtivuse alguskuupäev on kohustuslik"),
  märkused: z.string().nullable().optional().transform((v) => (v?.trim() ? v.trim() : null)),
});

export type ActionResult =
  | { ok: true }
  | { ok: false; error: string };

function formToObject(formData: FormData): Record<string, FormDataEntryValue | null> {
  const obj: Record<string, FormDataEntryValue | null> = {};
  for (const [k, v] of formData.entries()) obj[k] = v;
  return obj;
}

export async function createArtikkel(formData: FormData): Promise<ActionResult> {
  const parsed = ArtikkelSchema.safeParse(formToObject(formData));
  if (!parsed.success) {
    return { ok: false, error: parsed.error.issues[0]?.message ?? "Vigased andmed" };
  }
  const { ostuhind_neto, töö_h_ühik, ...artikkel } = parsed.data;
  const sb = getServerSupabase();

  const { data: created, error } = await sb
    .from("artiklid")
    .insert({ ...artikkel, aktiivne: true })
    .select("id")
    .single();
  if (error) return { ok: false, error: error.message };

  if (ostuhind_neto !== null || töö_h_ühik !== null) {
    const { error: hErr } = await sb.from("hinnad").insert({
      artikkel_id: created.id,
      ostuhind_neto,
      töö_h_ühik,
      märkused: "Lisamise vormiga loodud algne hind",
    });
    if (hErr) return { ok: false, error: hErr.message };
  }

  revalidatePath("/kataloog");
  redirect(`/kataloog/${created.id}`);
}

export async function lisaHind(formData: FormData): Promise<ActionResult> {
  const obj = formToObject(formData);
  console.log("[lisaHind] FormData entries:", obj);
  const parsed = HindSchema.safeParse(obj);
  if (!parsed.success) {
    console.log("[lisaHind] zod error:", parsed.error.issues);
    return { ok: false, error: parsed.error.issues[0]?.message ?? "Vigased andmed" };
  }
  const { artikkel_id, ostuhind_neto, töö_h_ühik, kehtib_alates, märkused } = parsed.data;
  console.log("[lisaHind] parsed:", { artikkel_id, ostuhind_neto, töö_h_ühik, kehtib_alates });
  if (ostuhind_neto === null && töö_h_ühik === null) {
    return { ok: false, error: "Lisa kas ostuhind või töötund (üks neist peab olema)" };
  }
  const sb = getServerSupabase();
  const { error } = await sb.from("hinnad").insert({
    artikkel_id,
    ostuhind_neto,
    töö_h_ühik,
    kehtib_alates,
    märkused,
  });
  if (error) {
    console.log("[lisaHind] insert error:", error);
    return { ok: false, error: error.message };
  }

  revalidatePath(`/kataloog/${artikkel_id}`);
  revalidatePath("/kataloog");
  return { ok: true };
}
