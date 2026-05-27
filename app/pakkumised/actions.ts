"use server";

import { randomUUID } from "node:crypto";
import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { getServerSupabase } from "@/lib/supabase/server";
import { expandSearchQuery, normalizeDimension, dimensionAliases } from "@/lib/dimension-map";
import {
  PAKKUMISE_MALL_DEFAULT,
  isPakkumiseMallId,
  type PakkumiseMallId,
} from "@/lib/pakkumise-mallid";

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
    || "objekt";
}

async function nextVkpNr(sb: ReturnType<typeof getServerSupabase>): Promise<string> {
  const year = new Date().getFullYear();
  const prefix = `VKP-${year}-`;
  const { data } = await sb
    .from("pakkumised")
    .select("vkp_nr")
    .like("vkp_nr", `${prefix}%`)
    .order("vkp_nr", { ascending: false })
    .limit(1);
  if (!data || data.length === 0) return `${prefix}0001`;
  const last = (data[0] as { vkp_nr: string }).vkp_nr;
  const m = last.match(/(\d+)\s*$/);
  if (!m) return `${prefix}0001`;
  const num = parseInt(m[1], 10) + 1;
  return `${prefix}${String(num).padStart(4, "0")}`;
}

export type CreatePakkumineResult =
  | { ok: true; id: string; vkp_nr: string }
  | { ok: false; error: string };

export async function looPakkumine(formData: FormData): Promise<CreatePakkumineResult> {
  const sb = getServerSupabase();

  const objekt = String(formData.get("objekt") ?? "").trim();
  const projekti_nr = String(formData.get("projekti_nr") ?? "").trim();
  const tellija_nimi = String(formData.get("tellija_nimi") ?? "").trim();
  const tellija_email = String(formData.get("tellija_email") ?? "").trim();
  const tellija_telefon = String(formData.get("tellija_telefon") ?? "").trim();
  const märkused = String(formData.get("märkused") ?? "").trim();

  const numOrNull = (k: string): number | null => {
    const v = String(formData.get(k) ?? "").trim();
    if (v === "") return null;
    const n = Number(v.replace(",", "."));
    return Number.isFinite(n) ? n : null;
  };

  if (!objekt) return { ok: false, error: "Objekti nimi on kohustuslik" };

  const mallRaw = String(formData.get("mall") ?? "").trim();
  const mall: PakkumiseMallId = isPakkumiseMallId(mallRaw) ? mallRaw : PAKKUMISE_MALL_DEFAULT;

  let mallAndmed: Record<string, unknown> = {};
  const mallAndmedRaw = String(formData.get("mall_andmed") ?? "").trim();
  if (mallAndmedRaw) {
    try {
      const parsed = JSON.parse(mallAndmedRaw);
      if (parsed && typeof parsed === "object" && !Array.isArray(parsed)) {
        mallAndmed = parsed as Record<string, unknown>;
      }
    } catch {
      // viga: jäta tühjaks, ära katkesta loomist
    }
  }

  const file = formData.get("mahutabel");
  let storagePath: string | null = null;
  let failiNimi: string | null = null;

  // Mahutabel on valikuline pakkumise loomisel — saab hiljem üles laadida
  if (file instanceof File && file.size > 0) {
    if (file.size > 20 * 1024 * 1024) return { ok: false, error: "Mahutabel liiga suur (max 20 MB)" };
    const ext = (file.name.split(".").pop() ?? "").toLowerCase();
    if (ext !== "pdf") return { ok: false, error: "Mahutabel peab olema PDF" };

    const today = new Date().toISOString().slice(0, 10);
    const safeObjekt = asciiSlug(objekt);
    storagePath = `${safeObjekt}/${today}-${randomUUID()}.pdf`;
    failiNimi = file.name;
    const bytes = Buffer.from(await file.arrayBuffer());
    const { error: upErr } = await sb.storage
      .from("mahutabelid")
      .upload(storagePath, bytes, { contentType: "application/pdf", upsert: false });
    if (upErr) return { ok: false, error: `Storage upload: ${upErr.message}` };
  }

  const vkp_nr = await nextVkpNr(sb);

  const { data: created, error: insErr } = await sb
    .from("pakkumised")
    .insert({
      vkp_nr,
      objekt,
      projekti_nr: projekti_nr || null,
      tellija_nimi: tellija_nimi || null,
      tellija_email: tellija_email || null,
      tellija_telefon: tellija_telefon || null,
      püstikute_arv: numOrNull("püstikute_arv"),
      korterite_arv: numOrNull("korterite_arv"),
      radiaatorite_arv: numOrNull("radiaatorite_arv"),
      keldrimagistraalide_jm: numOrNull("keldrimagistraalide_jm"),
      väljavõtete_arv: numOrNull("väljavõtete_arv"),
      mahutabel_pdf_path: storagePath,
      mahutabel_pdf_nimi: failiNimi,
      mall,
      mall_andmed: mallAndmed,
      märkused: märkused || null,
      staatus: "mustand",
    })
    .select("id, vkp_nr")
    .single();
  if (insErr) {
    if (storagePath) await sb.storage.from("mahutabelid").remove([storagePath]).catch(() => undefined);
    return { ok: false, error: `Sisestus: ${insErr.message}` };
  }

  revalidatePath("/pakkumised");
  return { ok: true, id: created.id, vkp_nr: created.vkp_nr };
}

function escapeIlike(v: string) {
  return v.replace(/[%_,]/g, "\\$&");
}

export type ToodeKandidaat = {
  id: string;
  tarnija: string;
  tarnija_kood: string | null;
  tarnija_nimetus: string;
  tarnija_brand: string | null;
  ostuhind_neto: number | null;
  paigaldusaeg_h_ühik: number | null;
  ühik: string | null;
  kirjeldus: string | null;
};

function escapeRegex(s: string): string {
  return s.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
}

function scoreRow(
  r: Record<string, unknown>,
  tokens: string[],
): number {
  const nimetus = String(r.tarnija_nimetus ?? "").toLowerCase();
  const kood = String(r.tarnija_kood ?? "").toLowerCase();
  const brand = String(r.tarnija_brand ?? "").toLowerCase();
  const aliases = String(r.magnus_alt_nimed ?? "").toLowerCase();

  let score = 0;
  for (const t of tokens) {
    const tAliases = dimensionAliases(t).map((a) => a.toLowerCase());
    let bestForToken = 0;
    for (const a of tAliases) {
      if (a.length < 1) continue;
      // Word-boundary match nimetus'es = kõrgeim
      try {
        const re = new RegExp(`(^|[\\s\\W])${escapeRegex(a)}([\\s\\W]|$)`, "i");
        if (re.test(nimetus)) {
          bestForToken = Math.max(bestForToken, 5);
          continue;
        }
      } catch {}
      if (nimetus.includes(a)) {
        bestForToken = Math.max(bestForToken, 3);
      } else if (kood.includes(a)) {
        bestForToken = Math.max(bestForToken, 3);
      } else if (aliases.includes(a)) {
        bestForToken = Math.max(bestForToken, 2);
      } else if (brand.includes(a)) {
        bestForToken = Math.max(bestForToken, 1);
      }
    }
    score += bestForToken;
  }
  return score;
}

export async function otsiTooteid(q: string): Promise<ToodeKandidaat[]> {
  const term = q.trim();
  if (term.length < 2) return [];

  // Laienda mõõdu-ekvivalentidega (DN32 ↔ 1 1/4 jne) — see annab laia võrgu DB-päringule
  const variants = expandSearchQuery(term);
  const orClauses = variants.flatMap((v) => {
    const e = escapeIlike(v);
    return [
      `tarnija_kood.ilike.%${e}%`,
      `tarnija_nimetus.ilike.%${e}%`,
      `tarnija_brand.ilike.%${e}%`,
      `magnus_alt_nimed.ilike.%${e}%`,
    ];
  });

  const sb = getServerSupabase();
  const { data } = await sb
    .from("hinnakirja_read")
    .select("*, hinnakirjad(tarnija)")
    .neq("staatus", "ignoreeritud")
    .or(orClauses.join(","))
    .limit(200); // Lai esimene komplekt — sorteeritakse JS-is match-kvaliteedi järgi

  if (!data) return [];

  // Skoor + sort: kvaliteet enne hinda
  const tokens = term.toLowerCase().split(/\s+/).filter((t) => t.length > 0);
  const scored = (data as Array<Record<string, unknown>>).map((r) => {
    const score = scoreRow(r, tokens);
    const ostuhind = (r.ostuhind_neto as number | null) ?? Infinity;
    return { r, score, ostuhind };
  });

  scored.sort((a, b) => {
    if (b.score !== a.score) return b.score - a.score;
    return a.ostuhind - b.ostuhind;
  });

  return scored
    .slice(0, 20)
    .filter((x) => x.score > 0) // Filtreeri välja read mis ei mätsi ühegi tokeniga
    .map(({ r }) => ({
      id: r.id as string,
      tarnija: ((r.hinnakirjad as { tarnija?: string } | null)?.tarnija ?? "—") as string,
      tarnija_kood: (r.tarnija_kood ?? null) as string | null,
      tarnija_nimetus: r.tarnija_nimetus as string,
      tarnija_brand: (r.tarnija_brand ?? null) as string | null,
      ostuhind_neto: (r.ostuhind_neto ?? null) as number | null,
      paigaldusaeg_h_ühik: (r.paigaldusaeg_h_ühik ?? null) as number | null,
      ühik: (r["ühik"] ?? null) as string | null,
      kirjeldus: (r.kirjeldus ?? null) as string | null,
    }));
}

export async function seoToode(
  positsioonId: string,
  toodeId: string | null,
): Promise<{ ok: true; propagated?: number } | { ok: false; error: string }> {
  if (!positsioonId) return { ok: false, error: "Positsiooni ID puudub" };
  const sb = getServerSupabase();

  // Loe positsioon (pakkumine_id + nimetus + tähis — viimast vajame iseõppimiseks +
  // praegust kirjeldust, et mitte üle kirjutada kui Magnus on selle juba käsitsi sisestanud)
  const { data: pos } = await sb
    .from("positsioonid")
    .select("*")
    .eq("id", positsioonId)
    .maybeSingle();
  const positsioon = pos as unknown as {
    pakkumine_id: string;
    nimetus: string;
    tähis: string | null;
    kirjeldus: string | null;
  } | null;
  const pakkumineId = positsioon?.pakkumine_id;

  if (toodeId === null) {
    const { error } = await sb
      .from("positsioonid")
      .update({
        toode_id: null,
        toode_snapshot_tarnija: null,
        toode_snapshot_kood: null,
        toode_snapshot_nimetus: null,
        toode_snapshot_brand: null,
        ostuhind_snapshot: null,
        paigaldusaeg_snapshot: null,
        kate_snapshot: null,
        toote_match_confidence: null,
        toote_match_põhjendus: null,
      })
      .eq("id", positsioonId);
    if (error) return { ok: false, error: error.message };
    if (pakkumineId) revalidatePath(`/pakkumised/${pakkumineId}`);
    return { ok: true };
  }

  const snapshot = await arvutaSnapshot(sb, toodeId);
  if (!snapshot.ok) return snapshot;

  // Kopeeri toote kirjeldus positsiooni juurde ainult kui positsioonil pole oma kirjeldust
  // (Magnus võib olla selle käsitsi sisestanud — ei taha üle kirjutada).
  const kirjelduseUpdate =
    !positsioon?.kirjeldus && snapshot.kirjeldus
      ? { kirjeldus: snapshot.kirjeldus }
      : {};

  const { error } = await sb
    .from("positsioonid")
    .update({
      toode_id: toodeId,
      ...snapshot.fields,
      ...kirjelduseUpdate,
      toote_match_confidence: 1.0,
      toote_match_põhjendus: "Käsitsi valitud",
      manuaalselt_muudetud: true,
    })
    .eq("id", positsioonId);
  if (error) return { ok: false, error: error.message };

  // Iseõppimine: lisa mahutabel-positsiooni (nimetus + tähis) toote magnus_alt_nimed'isse
  if (positsioon) {
    await lisaTooteAlias(sb, toodeId, positsioon.nimetus, positsioon.tähis);
  }

  // Iseõppimine 2: propageeri samas pakkumises olevatele unlinked ridadele
  let propagated = 0;
  if (positsioon && pakkumineId) {
    propagated = await propageeriSamasPakkumises(
      sb,
      pakkumineId,
      positsioonId,
      positsioon.nimetus,
      positsioon.tähis,
      toodeId,
    );
  }

  if (pakkumineId) revalidatePath(`/pakkumised/${pakkumineId}`);
  return { ok: true, propagated };
}

async function propageeriSamasPakkumises(
  sb: ReturnType<typeof getServerSupabase>,
  pakkumineId: string,
  juustLinkitudId: string,
  juustLinkitudNimetus: string,
  juustLinkitudTähis: string | null,
  toodeId: string,
): Promise<number> {
  // Ohutus: kui target rea tähis on tühi/määramata, ÄRA propageeri.
  // Vastasel juhul on risk siduda sama toode mitu erineva mõõduga rea külge
  // (nt "Isolatsioon" kõik mõõdud korraga — vt 2026-05-16 bug).
  const normalizedTähis = normalizeDimension(juustLinkitudTähis);
  if (normalizedTähis === "") return 0;

  const targetKey = `${juustLinkitudNimetus.toLowerCase().trim()}|${normalizedTähis.toLowerCase()}`;

  const { data: candidates } = await sb
    .from("positsioonid")
    .select("*")
    .eq("pakkumine_id", pakkumineId)
    .is("toode_id", null);

  const candidateList = (candidates ?? []) as unknown as Array<{
    id: string;
    nimetus: string;
    tähis: string | null;
  }>;
  if (candidateList.length === 0) return 0;

  const snapshot = await arvutaSnapshot(sb, toodeId);
  if (!snapshot.ok) return 0;

  // Leia kõik vastavad ID-d
  const matchingIds: string[] = [];
  for (const c of candidateList) {
    if (c.id === juustLinkitudId) continue;
    const key = `${c.nimetus.toLowerCase().trim()}|${normalizeDimension(c.tähis).toLowerCase()}`;
    if (key === targetKey) matchingIds.push(c.id);
  }
  if (matchingIds.length === 0) return 0;

  // Bulk update korraga
  const { error } = await sb
    .from("positsioonid")
    .update({
      toode_id: toodeId,
      ...snapshot.fields,
      toote_match_confidence: 1.0,
      toote_match_põhjendus: "Auto-linkitud samast pakkumisest (sama nimetus + mõõt)",
      manuaalselt_muudetud: false,
    })
    .in("id", matchingIds);
  if (error) {
    console.warn("propageeriSamasPakkumises bulk update error:", error.message);
    return 0;
  }
  return matchingIds.length;
}

// ----------------------------------------------------------------------------
// Iseõppimise abifunktsioonid
// ----------------------------------------------------------------------------

type SnapshotFields = {
  toode_snapshot_tarnija: string | null;
  toode_snapshot_kood: string | null;
  toode_snapshot_nimetus: string | null;
  toode_snapshot_brand: string | null;
  ostuhind_snapshot: number | null;
  paigaldusaeg_snapshot: number | null;
  kate_snapshot: number | null;
};

// Toote kirjeldus eraldatud snapshot'idest sest see ei tohi üle kirjutada
// positsiooni juba olemasolevat kirjeldust (Magnus võib käsitsi muuta).
type ToodeKirjeldus = string | null;

async function arvutaSnapshot(
  sb: ReturnType<typeof getServerSupabase>,
  toodeId: string,
): Promise<
  { ok: true; fields: SnapshotFields; kirjeldus: ToodeKirjeldus } | { ok: false; error: string }
> {
  const { data: toode, error: tErr } = await sb
    .from("hinnakirja_read")
    .select(
      "*, hinnakirjad(tarnija), tootegrupid(paigaldusaeg_h_ühik, kate_koefitsient_override)",
    )
    .eq("id", toodeId)
    .maybeSingle();
  if (tErr) return { ok: false, error: tErr.message };
  if (!toode) return { ok: false, error: "Tarnija toodet ei leitud" };
  const t = toode as unknown as Record<string, unknown>;
  const tarnija = (t.hinnakirjad as { tarnija?: string } | null)?.tarnija ?? null;
  const grupp = t.tootegrupid as
    | { paigaldusaeg_h_ühik: number | null; kate_koefitsient_override: number | null }
    | null;

  const toodePaigaldusaeg = t.paigaldusaeg_h_ühik as number | null;
  const efektiivnePaigaldusaeg =
    toodePaigaldusaeg !== null ? toodePaigaldusaeg : grupp?.paigaldusaeg_h_ühik ?? null;
  const efektiivneKate = grupp?.kate_koefitsient_override ?? null;

  return {
    ok: true,
    fields: {
      toode_snapshot_tarnija: tarnija,
      toode_snapshot_kood: (t.tarnija_kood ?? null) as string | null,
      toode_snapshot_nimetus: (t.tarnija_nimetus ?? null) as string | null,
      toode_snapshot_brand: (t.tarnija_brand ?? null) as string | null,
      ostuhind_snapshot: (t.ostuhind_neto ?? null) as number | null,
      paigaldusaeg_snapshot: efektiivnePaigaldusaeg,
      kate_snapshot: efektiivneKate,
    },
    kirjeldus: (t.kirjeldus ?? null) as ToodeKirjeldus,
  };
}

async function lisaTooteAlias(
  sb: ReturnType<typeof getServerSupabase>,
  toodeId: string,
  nimetus: string,
  tähis: string | null,
) {
  const newAlias = (tähis ? `${nimetus} ${tähis}` : nimetus).trim();
  if (!newAlias) return;

  const { data } = await sb
    .from("hinnakirja_read")
    .select("magnus_alt_nimed")
    .eq("id", toodeId)
    .maybeSingle();
  const current =
    ((data as { magnus_alt_nimed: string | null } | null)?.magnus_alt_nimed ?? "").trim();

  const existing = current
    .split(";")
    .map((s) => s.trim().toLowerCase())
    .filter(Boolean);
  if (existing.includes(newAlias.toLowerCase())) return;

  const updated = current === "" ? newAlias : `${current};${newAlias}`;
  await sb.from("hinnakirja_read").update({ magnus_alt_nimed: updated }).eq("id", toodeId);
}

// Iseõppimine parse-i ajal: pärast mahutabeli ridade sisestust, lingi need positsioonid
// varem linkitud (nimetus, tähis) paari alusel automaatselt sama toodete külge.
export async function autoLingiAjalooPõhjal(
  pakkumineId: string,
): Promise<{ ok: true; auto_linked: number } | { ok: false; error: string }> {
  const sb = getServerSupabase();

  // 1. Loe selle pakkumise lingimata positsioonid
  const { data: newRows } = await sb
    .from("positsioonid")
    .select("*")
    .eq("pakkumine_id", pakkumineId)
    .is("toode_id", null);
  const unlinked = ((newRows ?? []) as unknown as Array<{
    id: string;
    nimetus: string;
    tähis: string | null;
  }>);
  if (unlinked.length === 0) return { ok: true, auto_linked: 0 };

  // 2. Loe KÕIK varasema linkimisega positsioonid (toode_id != null)
  const { data: history } = await sb
    .from("positsioonid")
    .select("*")
    .not("toode_id", "is", null)
    .neq("pakkumine_id", pakkumineId)
    .order("uuendatud", { ascending: false });

  // 3. Ehita map: (lower(nimetus), normalized(tähis)) → toode_id (uusim võidab)
  // normalizeDimension teeb "DN32" ja "1 1/4" sama võtmega.
  const histMap = new Map<string, string>();
  for (const h of (history ?? []) as unknown as Array<{
    nimetus: string;
    tähis: string | null;
    toode_id: string;
  }>) {
    const key = `${h.nimetus.toLowerCase().trim()}|${normalizeDimension(h.tähis).toLowerCase()}`;
    if (!histMap.has(key)) histMap.set(key, h.toode_id);
  }

  // 4. Iga lingimata positsiooni jaoks: kontrolli map'i
  let autoLinked = 0;
  for (const r of unlinked) {
    const key = `${r.nimetus.toLowerCase().trim()}|${normalizeDimension(r.tähis).toLowerCase()}`;
    const toodeId = histMap.get(key);
    if (!toodeId) continue;

    const snapshot = await arvutaSnapshot(sb, toodeId);
    if (!snapshot.ok) continue;

    await sb
      .from("positsioonid")
      .update({
        toode_id: toodeId,
        ...snapshot.fields,
        toote_match_confidence: 1.0,
        toote_match_põhjendus: "Auto-linkitud varasemate pakkumiste põhjal",
        manuaalselt_muudetud: false,
      })
      .eq("id", r.id);
    autoLinked++;
  }

  if (autoLinked > 0) revalidatePath(`/pakkumised/${pakkumineId}`);
  return { ok: true, auto_linked: autoLinked };
}

export type UusPositsioonInput = {
  pakkumineId: string;
  sektsioon: string | null;
  alamsektsioon: string | null;
  nimetus: string;
  tähis: string | null;
  kogus: number | null;
  ühik: string | null;
  // Käsitsi snapshot (kui toode pole linkitud, nt komplekthind)
  ostuhind_snapshot: number | null;
  paigaldusaeg_snapshot: number | null;
  märkused: string | null;
  kirjeldus: string | null;
  // Kui täidetud → server tõmbab snapshot fields hinnakirja_read'ist + lingib toote
  toode_id?: string | null;
};

export async function lisaVaru(input: {
  pakkumineId: string;
  sektsioon: string | null;
  alamsektsioon: string | null;
  nimi: string;
  koefitsent_protsent: number;
}): Promise<{ ok: true; id: string } | { ok: false; error: string }> {
  if (!input.pakkumineId) return { ok: false, error: "Pakkumise ID puudub" };
  if (!input.nimi?.trim()) return { ok: false, error: "Varu nimetus on kohustuslik" };
  if (!Number.isFinite(input.koefitsent_protsent) || input.koefitsent_protsent <= 0) {
    return { ok: false, error: "Koefitsent peab olema positiivne (%)" };
  }
  const sb = getServerSupabase();
  const { data: maxRow } = await sb
    .from("positsioonid")
    .select("rea_nr")
    .eq("pakkumine_id", input.pakkumineId)
    .order("rea_nr", { ascending: false })
    .limit(1)
    .maybeSingle();
  const nextReaNr = ((maxRow as { rea_nr: number | null } | null)?.rea_nr ?? 0) + 1;

  const { data, error } = await sb
    .from("positsioonid")
    .insert({
      pakkumine_id: input.pakkumineId,
      rea_nr: nextReaNr,
      sektsioon: input.sektsioon?.trim() || null,
      alamsektsioon: input.alamsektsioon?.trim() || null,
      nimetus: input.nimi.trim(),
      tähis: null,
      kogus: null,
      ühik: "%",
      reservi_koefitsent: input.koefitsent_protsent,
      manuaalselt_muudetud: true,
    })
    .select("id")
    .single();
  if (error) return { ok: false, error: error.message };
  revalidatePath(`/pakkumised/${input.pakkumineId}`);
  return { ok: true, id: data.id };
}

export async function lisaPositsioon(
  input: UusPositsioonInput,
): Promise<{ ok: true; id: string } | { ok: false; error: string }> {
  if (!input.pakkumineId) return { ok: false, error: "Pakkumise ID puudub" };
  if (!input.nimetus?.trim()) return { ok: false, error: "Nimetus on kohustuslik" };
  const sb = getServerSupabase();

  // Leia viimane rea_nr selles pakkumises, et uus rida tuleks järje lõppu
  const { data: maxRow } = await sb
    .from("positsioonid")
    .select("rea_nr")
    .eq("pakkumine_id", input.pakkumineId)
    .order("rea_nr", { ascending: false })
    .limit(1)
    .maybeSingle();
  const nextReaNr = ((maxRow as { rea_nr: number | null } | null)?.rea_nr ?? 0) + 1;

  // Kui toode_id on antud, tõmba snapshot fields hinnakirja_read'ist (kate jne grupist)
  let snapshotFields: Record<string, unknown> = {};
  let snapshotKirjeldus: string | null = null;
  if (input.toode_id) {
    const snap = await arvutaSnapshot(sb, input.toode_id);
    if (snap.ok) {
      snapshotFields = { ...snap.fields };
      snapshotKirjeldus = snap.kirjeldus;
    }
  }

  // Magnuse käsitsi sisestatud ostuhind/paigaldusaeg võivad üle kirjutada toote snapshot'i
  // (nt diskonteeritud kokkulepe). Tühjad väärtused jätavad snapshot'i alles.
  if (input.ostuhind_snapshot !== null) snapshotFields.ostuhind_snapshot = input.ostuhind_snapshot;
  if (input.paigaldusaeg_snapshot !== null) snapshotFields.paigaldusaeg_snapshot = input.paigaldusaeg_snapshot;

  // Kirjeldus: kasutaja sisestatud > toote oma
  const efektiivneKirjeldus = input.kirjeldus?.trim() || snapshotKirjeldus;

  const { data, error } = await sb
    .from("positsioonid")
    .insert({
      pakkumine_id: input.pakkumineId,
      rea_nr: nextReaNr,
      sektsioon: input.sektsioon?.trim() || null,
      alamsektsioon: input.alamsektsioon?.trim() || null,
      nimetus: input.nimetus.trim(),
      tähis: input.tähis?.trim() || null,
      kogus: input.kogus,
      ühik: input.ühik?.trim() || null,
      ...snapshotFields,
      ...(input.toode_id
        ? {
            toode_id: input.toode_id,
            toote_match_confidence: 1.0,
            toote_match_põhjendus: "Käsitsi valitud kiirlisas",
          }
        : {}),
      märkused: input.märkused?.trim() || null,
      kirjeldus: efektiivneKirjeldus,
      manuaalselt_muudetud: true,
    })
    .select("id")
    .single();
  if (error) return { ok: false, error: error.message };

  revalidatePath(`/pakkumised/${input.pakkumineId}`);
  return { ok: true, id: data.id };
}

export async function muudaPakkumiseSeaded(
  pakkumineId: string,
  data: {
    tunnitasu: number;
    kate_koefitsient: number;
    km_määr: number;
  },
): Promise<{ ok: true } | { ok: false; error: string }> {
  if (!pakkumineId) return { ok: false, error: "Pakkumise ID puudub" };
  if (!Number.isFinite(data.tunnitasu) || data.tunnitasu <= 0)
    return { ok: false, error: "Tunnitasu peab olema positiivne arv" };
  if (!Number.isFinite(data.kate_koefitsient) || data.kate_koefitsient <= 0)
    return { ok: false, error: "Kate-koefitsient peab olema positiivne arv" };
  if (!Number.isFinite(data.km_määr) || data.km_määr < 0 || data.km_määr > 1)
    return { ok: false, error: "KM määr peab olema 0–1 vahel (nt 0,20 = 20%)" };
  const sb = getServerSupabase();
  const { error } = await sb
    .from("pakkumised")
    .update({
      tunnitasu: data.tunnitasu,
      kate_koefitsient: data.kate_koefitsient,
      km_määr: data.km_määr,
    })
    .eq("id", pakkumineId);
  if (error) return { ok: false, error: error.message };
  revalidatePath(`/pakkumised/${pakkumineId}`);
  return { ok: true };
}

export async function muudaPositsiooniInfo(
  positsioonId: string,
  data: { nimetus?: string; tähis?: string | null; kirjeldus?: string | null },
): Promise<{ ok: true } | { ok: false; error: string }> {
  if (!positsioonId) return { ok: false, error: "Positsiooni ID puudub" };
  const update: Record<string, unknown> = {};
  if (typeof data.nimetus === "string") {
    const v = data.nimetus.trim();
    if (!v) return { ok: false, error: "Nimetus ei saa olla tühi" };
    update.nimetus = v;
  }
  if (data.tähis !== undefined) {
    update.tähis = data.tähis === null ? null : data.tähis.trim() || null;
  }
  if (data.kirjeldus !== undefined) {
    update.kirjeldus = data.kirjeldus === null ? null : data.kirjeldus.trim() || null;
  }
  if (Object.keys(update).length === 0) return { ok: true };

  const sb = getServerSupabase();
  const { data: pos } = await sb
    .from("positsioonid")
    .select("pakkumine_id")
    .eq("id", positsioonId)
    .maybeSingle();
  const pakkumineId = (pos as { pakkumine_id: string } | null)?.pakkumine_id;
  const { error } = await sb.from("positsioonid").update(update).eq("id", positsioonId);
  if (error) return { ok: false, error: error.message };
  if (pakkumineId) revalidatePath(`/pakkumised/${pakkumineId}`);
  return { ok: true };
}

export async function muudaPositsiooniOstuhind(
  positsioonId: string,
  ostuhind_snapshot: number | null,
): Promise<{ ok: true } | { ok: false; error: string }> {
  if (!positsioonId) return { ok: false, error: "Positsiooni ID puudub" };
  if (ostuhind_snapshot !== null && (!Number.isFinite(ostuhind_snapshot) || ostuhind_snapshot < 0)) {
    return { ok: false, error: "Ostuhind peab olema 0 või positiivne arv (või tühi)" };
  }
  const sb = getServerSupabase();
  const { data: pos } = await sb
    .from("positsioonid")
    .select("pakkumine_id")
    .eq("id", positsioonId)
    .maybeSingle();
  const pakkumineId = (pos as { pakkumine_id: string } | null)?.pakkumine_id;
  const { error } = await sb
    .from("positsioonid")
    .update({ ostuhind_snapshot })
    .eq("id", positsioonId);
  if (error) return { ok: false, error: error.message };
  if (pakkumineId) revalidatePath(`/pakkumised/${pakkumineId}`);
  return { ok: true };
}

export async function muudaPositsiooniKogus(
  positsioonId: string,
  kogus: number | null,
): Promise<{ ok: true } | { ok: false; error: string }> {
  if (!positsioonId) return { ok: false, error: "Positsiooni ID puudub" };
  if (kogus !== null && (!Number.isFinite(kogus) || kogus < 0)) {
    return { ok: false, error: "Kogus peab olema 0 või positiivne arv (või tühi)" };
  }
  const sb = getServerSupabase();
  const { data: pos } = await sb
    .from("positsioonid")
    .select("pakkumine_id")
    .eq("id", positsioonId)
    .maybeSingle();
  const pakkumineId = (pos as { pakkumine_id: string } | null)?.pakkumine_id;
  const { error } = await sb
    .from("positsioonid")
    .update({ kogus })
    .eq("id", positsioonId);
  if (error) return { ok: false, error: error.message };
  if (pakkumineId) revalidatePath(`/pakkumised/${pakkumineId}`);
  return { ok: true };
}

export async function muudaPositsiooniPaigaldusaeg(
  positsioonId: string,
  paigaldusaeg_snapshot: number | null,
): Promise<{ ok: true } | { ok: false; error: string }> {
  if (!positsioonId) return { ok: false, error: "Positsiooni ID puudub" };
  if (paigaldusaeg_snapshot !== null && (!Number.isFinite(paigaldusaeg_snapshot) || paigaldusaeg_snapshot < 0)) {
    return { ok: false, error: "Paigaldusaeg peab olema 0 või positiivne arv (või tühi)" };
  }
  const sb = getServerSupabase();
  const { data: pos } = await sb
    .from("positsioonid")
    .select("pakkumine_id")
    .eq("id", positsioonId)
    .maybeSingle();
  const pakkumineId = (pos as { pakkumine_id: string } | null)?.pakkumine_id;
  const { error } = await sb
    .from("positsioonid")
    .update({ paigaldusaeg_snapshot })
    .eq("id", positsioonId);
  if (error) return { ok: false, error: error.message };
  if (pakkumineId) revalidatePath(`/pakkumised/${pakkumineId}`);
  return { ok: true };
}

export async function muudaPositsiooniKate(
  positsioonId: string,
  kate_snapshot: number | null,
): Promise<{ ok: true } | { ok: false; error: string }> {
  if (!positsioonId) return { ok: false, error: "Positsiooni ID puudub" };
  if (kate_snapshot !== null && (!Number.isFinite(kate_snapshot) || kate_snapshot <= 0)) {
    return { ok: false, error: "Kate peab olema positiivne arv või tühi" };
  }
  const sb = getServerSupabase();
  const { data: pos } = await sb
    .from("positsioonid")
    .select("pakkumine_id")
    .eq("id", positsioonId)
    .maybeSingle();
  const pakkumineId = (pos as { pakkumine_id: string } | null)?.pakkumine_id;
  const { error } = await sb
    .from("positsioonid")
    .update({ kate_snapshot })
    .eq("id", positsioonId);
  if (error) return { ok: false, error: error.message };
  if (pakkumineId) revalidatePath(`/pakkumised/${pakkumineId}`);
  return { ok: true };
}

export async function muudaMassiKate(
  ids: string[],
  kate_snapshot: number | null,
): Promise<{ ok: true; uuendatud: number } | { ok: false; error: string }> {
  if (!ids || ids.length === 0) return { ok: false, error: "Pole midagi valitud" };
  if (kate_snapshot !== null && (!Number.isFinite(kate_snapshot) || kate_snapshot <= 0)) {
    return { ok: false, error: "Kate peab olema positiivne arv või tühi (vaikimisi)" };
  }
  const sb = getServerSupabase();
  const { data: firstRow } = await sb
    .from("positsioonid")
    .select("pakkumine_id")
    .eq("id", ids[0])
    .maybeSingle();
  const pakkumineId = (firstRow as { pakkumine_id: string } | null)?.pakkumine_id;
  const { error, count } = await sb
    .from("positsioonid")
    .update({ kate_snapshot }, { count: "exact" })
    .in("id", ids);
  if (error) return { ok: false, error: error.message };
  if (pakkumineId) revalidatePath(`/pakkumised/${pakkumineId}`);
  return { ok: true, uuendatud: count ?? ids.length };
}

export async function muudaMassiSektsioon(
  ids: string[],
  sektsioon: string | null,
): Promise<{ ok: true; uuendatud: number } | { ok: false; error: string }> {
  if (!ids || ids.length === 0) return { ok: false, error: "Pole midagi valitud" };
  const sb = getServerSupabase();
  const { data: firstRow } = await sb
    .from("positsioonid")
    .select("pakkumine_id")
    .eq("id", ids[0])
    .maybeSingle();
  const pakkumineId = (firstRow as { pakkumine_id: string } | null)?.pakkumine_id;
  const { error, count } = await sb
    .from("positsioonid")
    .update({ sektsioon }, { count: "exact" })
    .in("id", ids);
  if (error) return { ok: false, error: error.message };
  if (pakkumineId) revalidatePath(`/pakkumised/${pakkumineId}`);
  return { ok: true, uuendatud: count ?? ids.length };
}

export async function muudaAlamsektsioon(
  ids: string[],
  alamsektsioon: string | null,
): Promise<{ ok: true; uuendatud: number } | { ok: false; error: string }> {
  if (!ids || ids.length === 0) return { ok: false, error: "Pole midagi valitud" };
  const sb = getServerSupabase();
  const { data: firstRow } = await sb
    .from("positsioonid")
    .select("pakkumine_id")
    .eq("id", ids[0])
    .maybeSingle();
  const pakkumineId = (firstRow as { pakkumine_id: string } | null)?.pakkumine_id;

  const { error, count } = await sb
    .from("positsioonid")
    .update({ alamsektsioon }, { count: "exact" })
    .in("id", ids);
  if (error) return { ok: false, error: error.message };
  if (pakkumineId) revalidatePath(`/pakkumised/${pakkumineId}`);
  return { ok: true, uuendatud: count ?? ids.length };
}

export async function kustutaPositsioone(
  ids: string[],
): Promise<{ ok: true; deleted: number } | { ok: false; error: string }> {
  if (!ids || ids.length === 0) return { ok: false, error: "Pole midagi kustutada" };
  const sb = getServerSupabase();

  // Loe esimene rida, et saada pakkumine_id (revalidatePath jaoks)
  const { data: firstRow } = await sb
    .from("positsioonid")
    .select("pakkumine_id")
    .eq("id", ids[0])
    .maybeSingle();
  const pakkumineId = (firstRow as { pakkumine_id: string } | null)?.pakkumine_id;

  const { error, count } = await sb
    .from("positsioonid")
    .delete({ count: "exact" })
    .in("id", ids);
  if (error) return { ok: false, error: error.message };

  if (pakkumineId) revalidatePath(`/pakkumised/${pakkumineId}`);
  return { ok: true, deleted: count ?? ids.length };
}

export async function lisaTäiendavMahutabel(
  pakkumineId: string,
  formData: FormData,
): Promise<{ ok: true; id: string } | { ok: false; error: string }> {
  const sb = getServerSupabase();
  const file = formData.get("mahutabel");
  if (!(file instanceof File) || file.size === 0) return { ok: false, error: "Fail puudub" };
  if (file.size > 20 * 1024 * 1024) return { ok: false, error: "Fail liiga suur (max 20 MB)" };
  const ext = (file.name.split(".").pop() ?? "").toLowerCase();
  if (ext !== "pdf") return { ok: false, error: "Fail peab olema PDF" };

  const { data: pkData } = await sb
    .from("pakkumised")
    .select("objekt")
    .eq("id", pakkumineId)
    .maybeSingle();
  const objekt = ((pkData as { objekt: string | null } | null)?.objekt ?? "objekt").trim() || "objekt";
  const today = new Date().toISOString().slice(0, 10);
  const storagePath = `${asciiSlug(objekt)}/${today}-${randomUUID()}.pdf`;
  const bytes = Buffer.from(await file.arrayBuffer());

  const { error: upErr } = await sb.storage
    .from("mahutabelid")
    .upload(storagePath, bytes, { contentType: "application/pdf", upsert: false });
  if (upErr) return { ok: false, error: `Storage: ${upErr.message}` };

  const { data, error: insErr } = await sb
    .from("pakkumise_mahutabelid")
    .insert({
      pakkumine_id: pakkumineId,
      faili_path: storagePath,
      faili_nimi: file.name,
    })
    .select("id")
    .single();
  if (insErr) {
    await sb.storage.from("mahutabelid").remove([storagePath]).catch(() => undefined);
    return { ok: false, error: insErr.message };
  }

  revalidatePath(`/pakkumised/${pakkumineId}`);
  return { ok: true, id: data.id };
}

export async function loendaKomplektid(): Promise<
  Array<{
    id: string;
    nimi: string;
    ridu: number;
    materjalKokku: number;
    tööH: number;
    ühik: string;
    vaike_sektsioon: string | null;
    vaike_alamsektsioon: string | null;
  }>
> {
  const sb = getServerSupabase();
  const [{ data: kpRaw }, { data: rrRaw }] = await Promise.all([
    sb.from("komplektid").select("*").order("uuendatud", { ascending: false }),
    sb.from("komplekti_read").select("*"),
  ]);
  const komplektid = ((kpRaw ?? []) as unknown) as Array<{
    id: string;
    nimi: string;
    ühik: string;
    vaike_sektsioon: string | null;
    vaike_alamsektsioon: string | null;
  }>;
  const read = (rrRaw ?? []) as Array<{
    komplekt_id: string;
    kogus: number;
    ostuhind_snapshot: number | null;
    paigaldusaeg_h_ühik_snapshot: number | null;
  }>;
  const stats = new Map<string, { ridu: number; materjalKokku: number; tööH: number }>();
  for (const r of read) {
    const cur = stats.get(r.komplekt_id) ?? { ridu: 0, materjalKokku: 0, tööH: 0 };
    cur.ridu += 1;
    cur.materjalKokku += (r.kogus ?? 0) * (r.ostuhind_snapshot ?? 0);
    cur.tööH += (r.kogus ?? 0) * (r.paigaldusaeg_h_ühik_snapshot ?? 0);
    stats.set(r.komplekt_id, cur);
  }
  return komplektid.map((k) => ({
    id: k.id,
    nimi: k.nimi,
    ühik: k.ühik,
    ridu: stats.get(k.id)?.ridu ?? 0,
    materjalKokku: stats.get(k.id)?.materjalKokku ?? 0,
    tööH: stats.get(k.id)?.tööH ?? 0,
    vaike_sektsioon: k.vaike_sektsioon ?? null,
    vaike_alamsektsioon: k.vaike_alamsektsioon ?? null,
  }));
}

export async function lisaKomplektPakkumisse(input: {
  pakkumineId: string;
  komplektId: string;
  sektsioon: string;
  alamsektsioon: string | null;
  koguseKordaja: number; // kogu komplekti rida.kogus korrutatakse selle teguriga (default 1)
}): Promise<{ ok: true; lisatudRidu: number } | { ok: false; error: string }> {
  if (!input.pakkumineId || !input.komplektId) {
    return { ok: false, error: "Pakkumise või komplekti ID puudub" };
  }
  if (!input.sektsioon.trim()) {
    return { ok: false, error: "Sektsioon (eriosa) on kohustuslik" };
  }
  const kordaja = Number.isFinite(input.koguseKordaja) && input.koguseKordaja > 0 ? input.koguseKordaja : 1;
  const sb = getServerSupabase();

  // 1) Lae komplekti read + pakkumise kate (vajame snapshot'i jaoks)
  const [{ data: kompRead }, { data: pakk }] = await Promise.all([
    sb
      .from("komplekti_read")
      .select("*")
      .eq("komplekt_id", input.komplektId)
      .order("järjekord", { ascending: true }),
    sb
      .from("pakkumised")
      .select("id, kate_koefitsient")
      .eq("id", input.pakkumineId)
      .maybeSingle(),
  ]);
  if (!pakk) return { ok: false, error: "Pakkumist ei leitud" };
  const rows = (kompRead ?? []) as Array<{
    id: string;
    toode_id: string | null;
    nimetus: string;
    tarnija: string | null;
    tarnija_kood: string | null;
    tarnija_brand: string | null;
    tähis: string | null;
    ühik: string | null;
    ostuhind_snapshot: number | null;
    paigaldusaeg_h_ühik_snapshot: number | null;
    kogus: number;
    järjekord: number;
  }>;
  if (rows.length === 0) return { ok: false, error: "Valitud komplektis pole ühtegi rida" };

  // 2) Leia järgmine rea_nr
  const { data: maxRida } = await sb
    .from("positsioonid")
    .select("rea_nr")
    .eq("pakkumine_id", input.pakkumineId)
    .order("rea_nr", { ascending: false, nullsFirst: false })
    .limit(1)
    .maybeSingle();
  const startReaNr = ((maxRida as { rea_nr: number | null } | null)?.rea_nr ?? 0) + 1;

  const pakkKate = (pakk as { kate_koefitsient: number }).kate_koefitsient ?? 1;
  const alamsektsioon = input.alamsektsioon?.trim() || null;

  // 3) Loo positsioonid (snapshot iga rea kohta)
  const positsioonid = rows.map((r, idx) => ({
    pakkumine_id: input.pakkumineId,
    rea_nr: startReaNr + idx,
    sektsioon: input.sektsioon.trim(),
    alamsektsioon,
    nimetus: r.nimetus,
    tähis: r.tähis,
    kogus: (r.kogus ?? 1) * kordaja,
    ühik: r.ühik,
    toode_id: r.toode_id,
    toote_match_confidence: r.toode_id ? 1 : null,
    toote_match_põhjendus: r.toode_id ? "komplektist" : null,
    toode_snapshot_tarnija: r.tarnija,
    toode_snapshot_kood: r.tarnija_kood,
    toode_snapshot_nimetus: r.nimetus,
    toode_snapshot_brand: r.tarnija_brand,
    ostuhind_snapshot: r.ostuhind_snapshot,
    paigaldusaeg_snapshot: r.paigaldusaeg_h_ühik_snapshot,
    kate_snapshot: pakkKate,
    manuaalselt_muudetud: false,
  }));

  const { error: insErr, count } = await sb.from("positsioonid").insert(positsioonid, { count: "exact" });
  if (insErr) return { ok: false, error: insErr.message };

  revalidatePath(`/pakkumised/${input.pakkumineId}`);
  return { ok: true, lisatudRidu: count ?? positsioonid.length };
}

export async function kustutaPakkumine(
  pakkumineId: string,
): Promise<{ ok: true } | { ok: false; error: string }> {
  if (!pakkumineId) return { ok: false, error: "Pakkumise ID puudub" };
  const sb = getServerSupabase();

  // 1) Kogu kõik storage-faili teed (algne mahutabel + täiendavad mahutabelid)
  const filePaths: string[] = [];
  const { data: pkData } = await sb
    .from("pakkumised")
    .select("mahutabel_pdf_path, vkp_nr")
    .eq("id", pakkumineId)
    .maybeSingle();
  if (!pkData) return { ok: false, error: "Pakkumist ei leitud" };
  const pk = pkData as { mahutabel_pdf_path: string | null; vkp_nr: string };
  if (pk.mahutabel_pdf_path) filePaths.push(pk.mahutabel_pdf_path);

  const { data: mhData } = await sb
    .from("pakkumise_mahutabelid")
    .select("faili_path")
    .eq("pakkumine_id", pakkumineId);
  for (const m of (mhData ?? []) as { faili_path: string }[]) {
    if (m.faili_path) filePaths.push(m.faili_path);
  }

  // 2) Kustuta storage-failid (best-effort, ei katkesta DB-kustutust)
  if (filePaths.length > 0) {
    await sb.storage.from("mahutabelid").remove(filePaths).catch(() => undefined);
  }

  // 3) Kustuta pakkumine — cascade kustutab positsioonid + pakkumise_mahutabelid
  const { error } = await sb.from("pakkumised").delete().eq("id", pakkumineId);
  if (error) return { ok: false, error: error.message };

  revalidatePath("/pakkumised");
  return { ok: true };
}

export async function kustutaMahutabel(
  mahutabelId: string,
): Promise<{ ok: true } | { ok: false; error: string }> {
  if (!mahutabelId) return { ok: false, error: "Mahutabeli ID puudub" };
  const sb = getServerSupabase();
  const { data: m } = await sb
    .from("pakkumise_mahutabelid")
    .select("*")
    .eq("id", mahutabelId)
    .maybeSingle();
  if (!m) return { ok: false, error: "Mahutabel ei leitud" };
  const mh = m as { pakkumine_id: string; faili_path: string };

  // Kustuta storage fail (best-effort)
  await sb.storage.from("mahutabelid").remove([mh.faili_path]).catch(() => undefined);

  // positsioonid.mahutabel_id läheb NULL cascade'iga, positsioonid jäävad alles
  const { error } = await sb.from("pakkumise_mahutabelid").delete().eq("id", mahutabelId);
  if (error) return { ok: false, error: error.message };

  revalidatePath(`/pakkumised/${mh.pakkumine_id}`);
  return { ok: true };
}

export async function laadiMahutabel(
  pakkumineId: string,
  formData: FormData,
): Promise<{ ok: true } | { ok: false; error: string }> {
  const sb = getServerSupabase();
  const file = formData.get("mahutabel");
  if (!(file instanceof File) || file.size === 0) return { ok: false, error: "Fail puudub" };
  if (file.size > 20 * 1024 * 1024) return { ok: false, error: "Fail liiga suur (max 20 MB)" };
  const ext = (file.name.split(".").pop() ?? "").toLowerCase();
  if (ext !== "pdf") return { ok: false, error: "Fail peab olema PDF" };

  const { data: pkData, error: pkErr } = await sb
    .from("pakkumised")
    .select("objekt, mahutabel_pdf_path")
    .eq("id", pakkumineId)
    .maybeSingle();
  if (pkErr) return { ok: false, error: pkErr.message };
  if (!pkData) return { ok: false, error: "Pakkumist ei leitud" };

  const objekt = (pkData as { objekt: string | null }).objekt ?? "objekt";
  const today = new Date().toISOString().slice(0, 10);
  const storagePath = `${asciiSlug(objekt)}/${today}-${randomUUID()}.pdf`;
  const bytes = Buffer.from(await file.arrayBuffer());

  const { error: upErr } = await sb.storage
    .from("mahutabelid")
    .upload(storagePath, bytes, { contentType: "application/pdf", upsert: false });
  if (upErr) return { ok: false, error: `Storage upload: ${upErr.message}` };

  // Kustuta vana fail kui oli
  const vana = (pkData as { mahutabel_pdf_path: string | null }).mahutabel_pdf_path;
  if (vana) await sb.storage.from("mahutabelid").remove([vana]).catch(() => undefined);

  await sb
    .from("pakkumised")
    .update({
      mahutabel_pdf_path: storagePath,
      mahutabel_pdf_nimi: file.name,
      staatus: "mustand",
    })
    .eq("id", pakkumineId);

  revalidatePath(`/pakkumised/${pakkumineId}`);
  return { ok: true };
}
