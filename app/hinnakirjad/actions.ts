"use server";

import { randomUUID } from "node:crypto";
import { revalidatePath } from "next/cache";
import { getServerSupabase } from "@/lib/supabase/server";
import { OSA_VALUES, type Artikkel, type Osa } from "@/lib/types";

const KOOD_PREFIX: Record<Osa, string> = {
  vesi: "VK-VESI-",
  kanal: "VK-KAN-",
  küte: "VK-KUT-",
  sõlm: "VK-SOLM-",
  sanseade: "VK-SAN-",
  ventilatsioon: "VK-VENT-",
  jahutus: "VK-JAH-",
  tulekustuti: "VK-TUL-",
  muu: "VK-MUU-",
};

export async function pakkuJärgmineKood(osa: Osa): Promise<string> {
  if (!(OSA_VALUES as readonly string[]).includes(osa)) return "";
  const prefix = KOOD_PREFIX[osa];
  const sb = getServerSupabase();
  const { data } = await sb
    .from("artiklid")
    .select("kood")
    .like("kood", `${prefix}%`)
    .order("kood", { ascending: false })
    .limit(1);
  if (!data || data.length === 0) return `${prefix}001`;
  const last = (data[0] as { kood: string }).kood;
  const m = last.match(/(\d+)\s*$/);
  if (!m) return `${prefix}001`;
  const num = parseInt(m[1], 10) + 1;
  return `${prefix}${String(num).padStart(3, "0")}`;
}

function escapeIlike(v: string) {
  return v.replace(/[%_,]/g, "\\$&");
}

// Supabase Storage võtmed peavad olema ASCII (URL-safe). Transliteer eesti tähed.
const ASCII_MAP: Record<string, string> = {
  ä: "a", ö: "o", ü: "u", õ: "o",
  Ä: "A", Ö: "O", Ü: "U", Õ: "O",
  š: "s", ž: "z", Š: "S", Ž: "Z",
};
function asciiSlug(s: string): string {
  return s
    .split("")
    .map((c) => ASCII_MAP[c] ?? c)
    .join("")
    .replace(/[^A-Za-z0-9\-_]+/g, "_")
    .replace(/_+/g, "_")
    .replace(/^_|_$/g, "")
    || "Tarnija";
}

export async function otsiArtikleid(q: string): Promise<Array<Pick<Artikkel, "id" | "kood" | "nimetus" | "tähis" | "osa">>> {
  const term = q.trim();
  if (term.length < 2) return [];
  const e = escapeIlike(term);
  const sb = getServerSupabase();

  // 1. Otsi ka tarnija_artiklid-ist (Slovarmi/Toru-Jüri/Küttemaailmi nimedega leidmiseks)
  const { data: viaSupplier } = await sb
    .from("tarnija_artiklid")
    .select("vk_artikkel_id")
    .or(`tarnija_kood.ilike.%${e}%,tarnija_nimetus.ilike.%${e}%,tarnija_brand.ilike.%${e}%`)
    .limit(100);
  const supplierIds = Array.from(
    new Set(((viaSupplier ?? []) as Array<{ vk_artikkel_id: string | null }>)
      .map((r) => r.vk_artikkel_id)
      .filter((x): x is string => !!x)),
  );

  // 2. Põhi-otsing artiklid'ist + UNION supplier-id'idega
  let orClause = `kood.ilike.%${e}%,nimetus.ilike.%${e}%,tähis.ilike.%${e}%,alt_nimed.ilike.%${e}%`;
  if (supplierIds.length > 0) {
    orClause += `,id.in.(${supplierIds.join(",")})`;
  }

  const { data, error } = await sb
    .from("artiklid")
    .select("*")
    .eq("aktiivne", true)
    .or(orClause)
    .order("kood", { ascending: true })
    .limit(10);
  if (error) return [];
  return ((data ?? []) as unknown as Artikkel[]).map((a) => ({
    id: a.id,
    kood: a.kood,
    nimetus: a.nimetus,
    tähis: a.tähis,
    osa: a.osa,
  }));
}

export type UploadResult =
  | { ok: true; id: string }
  | { ok: false; error: string };

const ALLOWED_EXT: Record<string, "pdf" | "xlsx" | "csv"> = {
  pdf: "pdf",
  xlsx: "xlsx",
  xls: "xlsx",
  csv: "csv",
};

const MAX_SIZE = 20 * 1024 * 1024; // 20MB

export async function uploadHinnakiri(formData: FormData): Promise<UploadResult> {
  const tarnijaRaw = String(formData.get("tarnija") ?? "").trim();
  const tarnijaMuu = String(formData.get("tarnija_muu") ?? "").trim();
  const file = formData.get("fail");

  if (!tarnijaRaw) return { ok: false, error: "Vali tarnija" };
  let tarnija = tarnijaRaw;
  if (tarnijaRaw === "Muu") {
    if (!tarnijaMuu) return { ok: false, error: "Sisesta tarnija nimi (Muu)" };
    tarnija = tarnijaMuu;
  }

  if (!(file instanceof File)) return { ok: false, error: "Fail puudub" };
  if (file.size === 0) return { ok: false, error: "Fail on tühi" };
  if (file.size > MAX_SIZE) return { ok: false, error: `Fail liiga suur (max ${MAX_SIZE / 1024 / 1024} MB)` };

  const extension = (file.name.split(".").pop() ?? "").toLowerCase();
  const tüüp = ALLOWED_EXT[extension];
  if (!tüüp) return { ok: false, error: `Lubatud failitüübid: ${Object.keys(ALLOWED_EXT).join(", ")}` };

  const sb = getServerSupabase();
  const today = new Date().toISOString().slice(0, 10);
  const safeTarnija = asciiSlug(tarnija);
  const storagePath = `${safeTarnija}/${today}-${randomUUID()}.${extension}`;

  const bytes = Buffer.from(await file.arrayBuffer());
  const { error: upErr } = await sb.storage
    .from("hinnakirjad")
    .upload(storagePath, bytes, {
      contentType: file.type || undefined,
      upsert: false,
    });
  if (upErr) return { ok: false, error: `Storage upload: ${upErr.message}` };

  const { data: row, error: insErr } = await sb
    .from("hinnakirjad")
    .insert({
      tarnija,
      faili_path: storagePath,
      faili_nimi: file.name,
      faili_tüüp: tüüp,
      staatus: "mustand",
    })
    .select("id")
    .single();
  if (insErr) {
    // best-effort cleanup
    await sb.storage.from("hinnakirjad").remove([storagePath]).catch(() => undefined);
    return { ok: false, error: `Sisestus: ${insErr.message}` };
  }

  revalidatePath("/hinnakirjad");
  return { ok: true, id: row.id };
}

export type KirjelduseUuendus = {
  ok: true;
  uuendatud: number;
  matchimataKoodid: string[];
  kontrollitudRidu: number;
};

export async function uuendaKirjeldusedExcelist(
  hinnakirjaId: string,
  formData: FormData,
): Promise<KirjelduseUuendus | { ok: false; error: string }> {
  if (!hinnakirjaId) return { ok: false, error: "Hinnakirja ID puudub" };
  const file = formData.get("fail");
  if (!(file instanceof File) || file.size === 0) return { ok: false, error: "Fail puudub" };
  if (file.size > 10 * 1024 * 1024) return { ok: false, error: "Fail liiga suur (max 10 MB)" };

  const name = file.name.toLowerCase();
  const isCsv = name.endsWith(".csv");
  const isXlsx = name.endsWith(".xlsx") || name.endsWith(".xls");
  if (!isCsv && !isXlsx) {
    return { ok: false, error: "Toetatud failitüübid: .csv, .xlsx, .xls" };
  }

  // Loe failist read 2D-array'iks
  let rows2d: unknown[][] = [];
  if (isCsv) {
    let text = Buffer.from(await file.arrayBuffer()).toString("utf-8");
    // Eemalda BOM
    if (text.charCodeAt(0) === 0xfeff) text = text.slice(1);
    rows2d = parseCsv(text);
  } else {
    const XLSX = await import("xlsx");
    const wb = XLSX.read(Buffer.from(await file.arrayBuffer()), { type: "buffer" });
    const sheetName = wb.SheetNames[0];
    if (!sheetName) return { ok: false, error: "Excelis pole ühtegi lehte" };
    const sheet = wb.Sheets[sheetName];
    rows2d = XLSX.utils.sheet_to_json(sheet, { header: 1, defval: null }) as unknown[][];
  }
  if (rows2d.length < 2) return { ok: false, error: "Failis peab olema vähemalt päise rida + üks andmerida" };

  // Tuvasta veerud — case-insensitive + normaliseerime _, -, tühikud, et "Toote nimetus"
  // ja "tarnija_nimetus" ja "toote-nimetus" oleksid samad
  function normHead(s: string): string {
    return s
      .toLowerCase()
      .replace(/[_\-\s]+/g, " ")
      .trim();
  }
  const headerRaw = rows2d[0].map((c) => String(c ?? "").trim());
  const header = headerRaw.map(normHead);
  const findCol = (names: string[]): number => {
    const norm = names.map((n) => normHead(n));
    for (let i = 0; i < header.length; i++) {
      if (norm.includes(header[i])) return i;
      // Lisaks: "contains" — kui päises on midagi nagu "Toote nimetus EE", siis "toote nimetus" leiab
      for (const n of norm) {
        if (n.length >= 4 && header[i].includes(n)) return i;
      }
    }
    return -1;
  };
  const idxId = findCol(["id", "rea id"]);
  const idxKood = findCol([
    "tarnija kood",
    "kood",
    "code",
    "art kood",
    "artikli kood",
    "artikkel",
    "sku",
    "tootekood",
    "toote kood",
  ]);
  const idxNimetus = findCol([
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
  const idxKirjeldus = findCol([
    "kirjeldus",
    "tootekirjeldus",
    "toote kirjeldus",
    "spec",
    "specification",
    "spetsifikatsioon",
    "description",
  ]);

  if (idxKirjeldus < 0) {
    return {
      ok: false,
      error: `Kirjeldust sisaldavat veergu ei leitud. Failis on veerud: ${headerRaw
        .filter((h) => h)
        .map((h) => `"${h}"`)
        .join(", ")}. Lisa veerg pealkirjaga "kirjeldus" või "tootekirjeldus".`,
    };
  }
  if (idxId < 0 && idxKood < 0 && idxNimetus < 0) {
    return {
      ok: false,
      error: `Rea identifitseerimiseks pole sobivat veergu. Failis on veerud: ${headerRaw
        .filter((h) => h)
        .map((h) => `"${h}"`)
        .join(", ")}. Lisa üks neist: "id", "tarnija_kood" või "tarnija_nimetus" (sobib ka "nimetus", "toote nimetus", "toode").`,
    };
  }

  const sb = getServerSupabase();

  // Lae kõik selle hinnakirja read kohaliku match'imise jaoks
  const { data: kõikRead } = await sb
    .from("hinnakirja_read")
    .select("*")
    .eq("hinnakiri_id", hinnakirjaId);
  const readArr = ((kõikRead ?? []) as unknown) as Array<{
    id: string;
    tarnija_kood: string | null;
    tarnija_nimetus: string;
  }>;
  const byKood = new Map<string, string>(); // tarnija_kood (lc) -> id
  const byNimetus = new Map<string, string[]>(); // tarnija_nimetus (lc trimmed) -> id-d
  for (const r of readArr) {
    if (r.tarnija_kood) byKood.set(r.tarnija_kood.toLowerCase(), r.id);
    const ni = (r.tarnija_nimetus ?? "").trim().toLowerCase();
    if (ni) {
      const arr = byNimetus.get(ni) ?? [];
      arr.push(r.id);
      byNimetus.set(ni, arr);
    }
  }
  const validIds = new Set(readArr.map((r) => r.id));

  let uuendatud = 0;
  const matchimataKoodid: string[] = [];
  let kontrollitud = 0;

  for (let ri = 1; ri < rows2d.length; ri++) {
    const row = rows2d[ri];
    if (!row || row.length === 0) continue;
    const kirjeldus = String(row[idxKirjeldus] ?? "").trim();
    if (!kirjeldus) continue;
    kontrollitud++;

    let reaIds: string[] = [];
    if (idxId >= 0) {
      const idVal = String(row[idxId] ?? "").trim();
      if (idVal && validIds.has(idVal)) reaIds = [idVal];
    }
    if (reaIds.length === 0 && idxKood >= 0) {
      const kood = String(row[idxKood] ?? "").trim().toLowerCase();
      if (kood) {
        const koodId = byKood.get(kood);
        if (koodId) reaIds = [koodId];
        else matchimataKoodid.push(kood);
      }
    }
    if (reaIds.length === 0 && idxNimetus >= 0) {
      const nimetus = String(row[idxNimetus] ?? "").trim().toLowerCase();
      if (nimetus) {
        const ids = byNimetus.get(nimetus);
        if (ids && ids.length > 0) reaIds = ids;
        else matchimataKoodid.push(nimetus.slice(0, 40));
      }
    }
    if (reaIds.length === 0) continue;

    const { error } = await sb
      .from("hinnakirja_read")
      .update({ kirjeldus })
      .in("id", reaIds);
    if (!error) uuendatud += reaIds.length;
  }

  revalidatePath(`/hinnakirjad/${hinnakirjaId}`);
  revalidatePath("/kataloog");

  return {
    ok: true,
    uuendatud,
    matchimataKoodid: Array.from(new Set(matchimataKoodid)).slice(0, 20),
    kontrollitudRidu: kontrollitud,
  };
}

function parseCsv(text: string): unknown[][] {
  // Lihtne CSV parser — tunneb ; ja , separator'eid, "..." quoted välju
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
      if (c === '"') {
        inQuote = true;
      } else if (c === sep) {
        cur.push(field);
        field = "";
      } else if (c === "\n" || c === "\r") {
        if (c === "\r" && text[i + 1] === "\n") i++;
        cur.push(field);
        rows.push(cur);
        cur = [];
        field = "";
      } else {
        field += c;
      }
    }
  }
  if (field.length > 0 || cur.length > 0) {
    cur.push(field);
    rows.push(cur);
  }
  return rows;
}

export async function kustutaHinnakiri(
  id: string,
): Promise<{ ok: true } | { ok: false; error: string }> {
  if (!id) return { ok: false, error: "Hinnakirja ID puudub" };
  const sb = getServerSupabase();

  // Lae Storage-faili tee best-effort kustutamiseks
  const { data: hk } = await sb
    .from("hinnakirjad")
    .select("faili_path")
    .eq("id", id)
    .maybeSingle();
  const path = (hk as { faili_path: string | null } | null)?.faili_path;
  if (path) {
    await sb.storage.from("hinnakirjad").remove([path]).catch(() => undefined);
  }

  // Cascade: hinnakirja_read kustutub automaatselt (FK ON DELETE CASCADE migration 0003-st)
  // Positsioonid säilivad — positsioonid.toode_id → NULL (ON DELETE SET NULL)
  const { error } = await sb.from("hinnakirjad").delete().eq("id", id);
  if (error) return { ok: false, error: error.message };

  revalidatePath("/hinnakirjad");
  revalidatePath("/kataloog");
  return { ok: true };
}

export async function muudaTarnijat(
  vana: string,
  uus: string,
): Promise<{ ok: true; uuendatud: number } | { ok: false; error: string }> {
  const trimmed = uus.trim();
  if (!vana) return { ok: false, error: "Vana tarnija nimi puudub" };
  if (!trimmed) return { ok: false, error: "Uus nimi ei tohi olla tühi" };
  if (trimmed === vana) return { ok: true, uuendatud: 0 };

  const sb = getServerSupabase();
  const { error, count } = await sb
    .from("hinnakirjad")
    .update({ tarnija: trimmed }, { count: "exact" })
    .eq("tarnija", vana);
  if (error) return { ok: false, error: error.message };

  revalidatePath("/hinnakirjad");
  revalidatePath("/hinnakirjad/tarnijad");
  revalidatePath("/kataloog");
  return { ok: true, uuendatud: count ?? 0 };
}

export async function kustutaTarnija(
  nimi: string,
): Promise<{ ok: true; kustutatud: number } | { ok: false; error: string }> {
  if (!nimi) return { ok: false, error: "Tarnija nimi puudub" };
  const sb = getServerSupabase();

  const { data: hkRows } = await sb
    .from("hinnakirjad")
    .select("id, faili_path")
    .eq("tarnija", nimi);
  const list = (hkRows ?? []) as Array<{ id: string; faili_path: string | null }>;
  if (list.length === 0) return { ok: true, kustutatud: 0 };

  const filePaths = list.map((r) => r.faili_path).filter((p): p is string => !!p);
  if (filePaths.length > 0) {
    await sb.storage.from("hinnakirjad").remove(filePaths).catch(() => undefined);
  }

  const ids = list.map((r) => r.id);
  const { error } = await sb.from("hinnakirjad").delete().in("id", ids);
  if (error) return { ok: false, error: error.message };

  revalidatePath("/hinnakirjad");
  revalidatePath("/hinnakirjad/tarnijad");
  revalidatePath("/kataloog");
  return { ok: true, kustutatud: list.length };
}

export async function muudaHinnakiri(
  id: string,
  data: { tarnija?: string },
): Promise<{ ok: true } | { ok: false; error: string }> {
  if (!id) return { ok: false, error: "Hinnakirja ID puudub" };
  const upd: Record<string, string> = {};
  if (data.tarnija !== undefined) {
    const t = data.tarnija.trim();
    if (!t) return { ok: false, error: "Tarnija nimi ei tohi olla tühi" };
    upd.tarnija = t;
  }
  if (Object.keys(upd).length === 0) return { ok: true };
  const sb = getServerSupabase();
  const { error } = await sb.from("hinnakirjad").update(upd).eq("id", id);
  if (error) return { ok: false, error: error.message };
  revalidatePath(`/hinnakirjad/${id}`);
  revalidatePath("/hinnakirjad");
  return { ok: true };
}

export async function muudaMatch(
  reaId: string,
  artikkelId: string | null,
): Promise<{ ok: true } | { ok: false; error: string }> {
  if (!reaId) return { ok: false, error: "Rea ID puudub" };
  const sb = getServerSupabase();
  // Märgi vk_artikkel + confidence "käsitsi valitud" (1.0) aga jäta staatus
  // 'matchimata' — kasutaja peab ikka klõpsama Kinnita, et DB-sse salvestada.
  const { error } = await sb
    .from("hinnakirja_read")
    .update({
      vk_artikkel_id: artikkelId,
      match_confidence: artikkelId ? 1.0 : null,
      match_põhjendus: artikkelId ? "Käsitsi valitud" : null,
      staatus: "matchimata",
    })
    .eq("id", reaId);
  if (error) return { ok: false, error: error.message };
  return { ok: true };
}

export async function ignoreRida(
  reaId: string,
): Promise<{ ok: true } | { ok: false; error: string }> {
  const sb = getServerSupabase();
  const { error } = await sb
    .from("hinnakirja_read")
    .update({ staatus: "ignoreeritud" })
    .eq("id", reaId);
  if (error) return { ok: false, error: error.message };
  return { ok: true };
}

export async function tagastaRida(
  reaId: string,
): Promise<{ ok: true } | { ok: false; error: string }> {
  const sb = getServerSupabase();
  const { error } = await sb
    .from("hinnakirja_read")
    .update({ staatus: "matchimata" })
    .eq("id", reaId);
  if (error) return { ok: false, error: error.message };
  return { ok: true };
}

// ----------------------------------------------------------------------------
// Commit helper — jagatud per-rea, bulk-confidence ja "kõik ülejäänud" vahel
// ----------------------------------------------------------------------------

type CommittableRow = {
  id: string;
  vk_artikkel_id: string | null;
  tarnija_kood: string | null;
  tarnija_nimetus: string;
  tarnija_brand: string | null;
  ostuhind_neto: number | null;
  jaehind_neto: number | null;
  ah_protsent: number | null;
};

async function commitRows(
  sb: ReturnType<typeof getServerSupabase>,
  hinnakiri: { id: string; tarnija: string; faili_nimi: string | null },
  rows: CommittableRow[],
): Promise<{ count: number; error?: string }> {
  if (rows.length === 0) return { count: 0 };

  const failiNimi = hinnakiri.faili_nimi ?? "hinnakiri";
  const today = new Date().toISOString().slice(0, 10);

  // 1. Hinnad — üks uus rida iga matchitud rea kohta
  const hinnaRows = rows
    .filter((r) => r.vk_artikkel_id && r.ostuhind_neto !== null)
    .map((r) => ({
      artikkel_id: r.vk_artikkel_id!,
      ostuhind_neto: r.ostuhind_neto,
      kehtib_alates: today,
      märkused: `${hinnakiri.tarnija} hinnakirjast (${failiNimi})`,
    }));
  if (hinnaRows.length > 0) {
    const { error: hErr } = await sb.from("hinnad").insert(hinnaRows);
    if (hErr) return { count: 0, error: `Hinnad insert: ${hErr.message}` };
  }

  // 2. tarnija_artiklid — upsert (vk_artikkel + tarnija + tarnija_kood) seos
  const taRows = rows
    .filter((r) => r.vk_artikkel_id)
    .map((r) => ({
      vk_artikkel_id: r.vk_artikkel_id!,
      tarnija: hinnakiri.tarnija,
      tarnija_kood: r.tarnija_kood,
      tarnija_nimetus: r.tarnija_nimetus,
      tarnija_brand: r.tarnija_brand,
      viimane_ostuhind: r.ostuhind_neto,
      viimane_jaehind: r.jaehind_neto,
      viimane_ah_protsent: r.ah_protsent,
      viimati_uuendatud: new Date().toISOString(),
    }));
  if (taRows.length > 0) {
    const { error: taErr } = await sb
      .from("tarnija_artiklid")
      .upsert(taRows, { onConflict: "vk_artikkel_id,tarnija,tarnija_kood" });
    if (taErr) {
      // NULL tarnija_kood ei ole unique-able — proovi rida-haaval kui bulk ebaõnnestus
      for (const row of taRows) {
        await sb
          .from("tarnija_artiklid")
          .upsert(row, { onConflict: "vk_artikkel_id,tarnija,tarnija_kood" });
      }
    }
  }

  // 3. Märgi read 'kinnitatud'
  await sb
    .from("hinnakirja_read")
    .update({ staatus: "kinnitatud" })
    .in(
      "id",
      rows.map((r) => r.id),
    );

  return { count: rows.length };
}

async function updateHinnakiriIfDone(
  sb: ReturnType<typeof getServerSupabase>,
  hinnakirjaId: string,
) {
  // Kui ühtegi 'matchimata' rida pole, märgi kogu hinnakiri 'kinnitatud'
  const { count } = await sb
    .from("hinnakirja_read")
    .select("id", { count: "exact", head: true })
    .eq("hinnakiri_id", hinnakirjaId)
    .eq("staatus", "matchimata");
  if (count !== null && count === 0) {
    const { count: kinnitatudCount } = await sb
      .from("hinnakirja_read")
      .select("id", { count: "exact", head: true })
      .eq("hinnakiri_id", hinnakirjaId)
      .eq("staatus", "kinnitatud");
    await sb
      .from("hinnakirjad")
      .update({ staatus: "kinnitatud", artiklite_arv: kinnitatudCount ?? 0 })
      .eq("id", hinnakirjaId);
  }
}

// ----------------------------------------------------------------------------
// Avalikud action'id
// ----------------------------------------------------------------------------

// ----------------------------------------------------------------------------
// Loo uus VK artikkel hinnakirja rea põhjal (bottom-up catalog growth)
// ----------------------------------------------------------------------------

export type UusArtikkelInput = {
  reaId: string;
  kood: string;
  osa: string;
  alamosa: string | null;
  sek_kood: string | null;
  nimetus: string;
  tähis: string | null;
  ühik: string | null;
  alt_nimed: string | null;
  töö_h_ühik: number | null; // paigaldusaeg lisamine vabatahtlik
};

export async function looUusVkArtikkel(
  input: UusArtikkelInput,
): Promise<{ ok: true; vk_artikkel_id: string } | { ok: false; error: string }> {
  if (!input.kood?.trim()) return { ok: false, error: "VK kood on kohustuslik" };
  if (!input.nimetus?.trim()) return { ok: false, error: "Nimetus on kohustuslik" };
  if (!(OSA_VALUES as readonly string[]).includes(input.osa)) return { ok: false, error: "Vigane osa" };

  const sb = getServerSupabase();

  // 1. Loe hinnakirja rida (et saaks tarnija + hinnad andmed)
  const { data: rida, error: rErr } = await sb
    .from("hinnakirja_read")
    .select("*")
    .eq("id", input.reaId)
    .maybeSingle();
  if (rErr) return { ok: false, error: rErr.message };
  if (!rida) return { ok: false, error: "Hinnakirja rida ei leitud" };

  const r = rida as unknown as {
    id: string;
    hinnakiri_id: string;
    tarnija_kood: string | null;
    tarnija_nimetus: string;
    tarnija_brand: string | null;
    jaehind_neto: number | null;
    ah_protsent: number | null;
    ostuhind_neto: number | null;
  };

  const { data: hk, error: hkErr } = await sb
    .from("hinnakirjad")
    .select("*")
    .eq("id", r.hinnakiri_id)
    .single();
  if (hkErr || !hk) return { ok: false, error: hkErr?.message ?? "Hinnakirja ei leitud" };
  const hinnakiri = hk as { id: string; tarnija: string; faili_nimi: string | null };

  // 2. Loo VK artikkel
  const { data: created, error: insArtErr } = await sb
    .from("artiklid")
    .insert({
      kood: input.kood.trim(),
      osa: input.osa,
      alamosa: input.alamosa,
      sek_kood: input.sek_kood,
      nimetus: input.nimetus.trim(),
      tähis: input.tähis,
      ühik: input.ühik,
      alt_nimed: input.alt_nimed,
      aktiivne: true,
    })
    .select("id")
    .single();
  if (insArtErr || !created) {
    return { ok: false, error: `Artikli loomine ebaõnnestus: ${insArtErr?.message ?? "tundmatu viga"}` };
  }
  const vkArtikkelId = created.id;

  // 3. Loo hinnad rida (ostuhind tarnijalt + paigaldusaeg kui antud)
  if (r.ostuhind_neto !== null || input.töö_h_ühik !== null) {
    const today = new Date().toISOString().slice(0, 10);
    const failiNimi = hinnakiri.faili_nimi ?? "hinnakiri";
    const { error: hInsErr } = await sb.from("hinnad").insert({
      artikkel_id: vkArtikkelId,
      ostuhind_neto: r.ostuhind_neto,
      töö_h_ühik: input.töö_h_ühik,
      kehtib_alates: today,
      märkused: `Loodud ${hinnakiri.tarnija} hinnakirjast (${failiNimi})`,
    });
    if (hInsErr) {
      // Roll back artikkel? Lihtsam — anna teada, kasutaja saab hinda käsitsi lisada
      return { ok: false, error: `Artikkel loodud aga hinna lisamine ebaõnnestus: ${hInsErr.message}` };
    }
  }

  // 4. Loo tarnija_artikkel seos
  if (r.tarnija_kood || r.tarnija_nimetus) {
    const { error: taErr } = await sb.from("tarnija_artiklid").upsert(
      {
        vk_artikkel_id: vkArtikkelId,
        tarnija: hinnakiri.tarnija,
        tarnija_kood: r.tarnija_kood,
        tarnija_nimetus: r.tarnija_nimetus,
        tarnija_brand: r.tarnija_brand,
        viimane_ostuhind: r.ostuhind_neto,
        viimane_jaehind: r.jaehind_neto,
        viimane_ah_protsent: r.ah_protsent,
        viimati_uuendatud: new Date().toISOString(),
      },
      { onConflict: "vk_artikkel_id,tarnija,tarnija_kood" },
    );
    if (taErr) console.warn("tarnija_artikkel upsert error:", taErr.message);
  }

  // 5. Märgi hinnakirja rida kinnitatuks
  await sb
    .from("hinnakirja_read")
    .update({
      vk_artikkel_id: vkArtikkelId,
      match_confidence: 1.0,
      match_põhjendus: "Uus VK artikkel loodud sellest reast",
      staatus: "kinnitatud",
    })
    .eq("id", r.id);

  await updateHinnakiriIfDone(sb, hinnakiri.id);

  revalidatePath(`/hinnakirjad/${hinnakiri.id}`);
  revalidatePath("/hinnakirjad");
  revalidatePath("/kataloog");
  return { ok: true, vk_artikkel_id: vkArtikkelId };
}

export async function kinnitaUksRida(
  reaId: string,
): Promise<{ ok: true; commit_count: number } | { ok: false; error: string }> {
  const sb = getServerSupabase();
  const { data: rida, error: rErr } = await sb
    .from("hinnakirja_read")
    .select("*")
    .eq("id", reaId)
    .maybeSingle();
  if (rErr) return { ok: false, error: rErr.message };
  if (!rida) return { ok: false, error: "Rida ei leitud" };

  const r = rida as unknown as CommittableRow & { hinnakiri_id: string; staatus: string };
  if (r.staatus === "kinnitatud") return { ok: false, error: "Rida juba kinnitatud" };
  if (!r.vk_artikkel_id) return { ok: false, error: "VK artikkel pole valitud" };
  if (r.ostuhind_neto === null) return { ok: false, error: "Ostuhind puudub — ei saa hinnad-rida lisada" };

  const { data: hk, error: hkErr } = await sb
    .from("hinnakirjad")
    .select("*")
    .eq("id", r.hinnakiri_id)
    .single();
  if (hkErr || !hk) return { ok: false, error: hkErr?.message ?? "Hinnakirja ei leitud" };
  const hinnakiri = hk as { id: string; tarnija: string; faili_nimi: string | null };

  const res = await commitRows(sb, hinnakiri, [r]);
  if (res.error) return { ok: false, error: res.error };

  await updateHinnakiriIfDone(sb, hinnakiri.id);
  revalidatePath(`/hinnakirjad/${hinnakiri.id}`);
  revalidatePath("/hinnakirjad");
  revalidatePath("/kataloog");
  return { ok: true, commit_count: res.count };
}

export async function kinnitaKõikYlevalKui(
  hinnakiriId: string,
  künnis: number,
): Promise<{ ok: true; commit_count: number } | { ok: false; error: string }> {
  const sb = getServerSupabase();

  const { data: hk, error: hkErr } = await sb
    .from("hinnakirjad")
    .select("*")
    .eq("id", hinnakiriId)
    .single();
  if (hkErr || !hk) return { ok: false, error: hkErr?.message ?? "Hinnakiri ei leitud" };
  const hinnakiri = hk as { id: string; tarnija: string; faili_nimi: string | null };

  const { data: ridaData, error: rErr } = await sb
    .from("hinnakirja_read")
    .select("*")
    .eq("hinnakiri_id", hinnakiriId)
    .eq("staatus", "matchimata")
    .gte("match_confidence", künnis)
    .not("vk_artikkel_id", "is", null)
    .not("ostuhind_neto", "is", null);
  if (rErr) return { ok: false, error: rErr.message };
  const rows = (ridaData ?? []) as unknown as CommittableRow[];

  const res = await commitRows(sb, hinnakiri, rows);
  if (res.error) return { ok: false, error: res.error };

  await updateHinnakiriIfDone(sb, hinnakiriId);
  revalidatePath(`/hinnakirjad/${hinnakiriId}`);
  revalidatePath("/hinnakirjad");
  revalidatePath("/kataloog");
  return { ok: true, commit_count: res.count };
}

export async function salvestaLõplikult(
  hinnakiriId: string,
): Promise<{ ok: true; commit_count: number } | { ok: false; error: string }> {
  const sb = getServerSupabase();

  const { data: hk, error: hkErr } = await sb
    .from("hinnakirjad")
    .select("*")
    .eq("id", hinnakiriId)
    .single();
  if (hkErr || !hk) return { ok: false, error: hkErr?.message ?? "Hinnakiri ei leitud" };
  const hinnakiri = hk as { id: string; tarnija: string; faili_nimi: string | null };

  // Kõik ülejäänud matchimata read, millel on vk_artikkel + ostuhind
  const { data: ridaData, error: rErr } = await sb
    .from("hinnakirja_read")
    .select("*")
    .eq("hinnakiri_id", hinnakiriId)
    .eq("staatus", "matchimata")
    .not("vk_artikkel_id", "is", null)
    .not("ostuhind_neto", "is", null);
  if (rErr) return { ok: false, error: rErr.message };
  const rows = (ridaData ?? []) as unknown as CommittableRow[];

  if (rows.length === 0) {
    return { ok: false, error: "Pole ühtegi rida, mis vajaks salvestamist (kõik on juba kinnitatud või matchimata ilma vk_artikkel'ita)." };
  }

  const res = await commitRows(sb, hinnakiri, rows);
  if (res.error) return { ok: false, error: res.error };

  await updateHinnakiriIfDone(sb, hinnakiriId);
  revalidatePath(`/hinnakirjad/${hinnakiriId}`);
  revalidatePath("/hinnakirjad");
  revalidatePath("/kataloog");
  return { ok: true, commit_count: res.count };
}
