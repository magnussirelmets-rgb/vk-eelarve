"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { getServerSupabase } from "@/lib/supabase/server";
import type { Tootegrupp } from "@/lib/types";

function num(raw: FormDataEntryValue | null): number | null {
  if (raw === null) return null;
  const s = String(raw).trim();
  if (s === "") return null;
  const n = Number(s.replace(",", "."));
  return Number.isFinite(n) ? n : null;
}

export async function looGrupp(formData: FormData): Promise<{ ok: true; id: string } | { ok: false; error: string }> {
  const sb = getServerSupabase();
  const nimi = String(formData.get("nimi") ?? "").trim();
  if (!nimi) return { ok: false, error: "Teenuse nimi on kohustuslik" };

  const { data, error } = await sb
    .from("tootegrupid")
    .insert({
      nimi,
      tüüp: "teenus",
      kirjeldus: String(formData.get("kirjeldus") ?? "").trim() || null,
      paigaldusaeg_h_ühik: num(formData.get("paigaldusaeg_h_ühik")),
      kate_koefitsient_override: num(formData.get("kate_koefitsient_override")),
      märkused: String(formData.get("märkused") ?? "").trim() || null,
    })
    .select("id")
    .single();
  if (error) return { ok: false, error: error.message };

  revalidatePath("/grupid");
  revalidatePath("/kataloog");
  return { ok: true, id: data.id };
}

export async function muudaGrupp(
  id: string,
  data: {
    nimi: string;
    tüüp: "toode" | "teenus";
    kirjeldus: string | null;
    paigaldusaeg_h_ühik: number | null;
    kate_koefitsient_override: number | null;
    märkused: string | null;
  },
): Promise<{ ok: true } | { ok: false; error: string }> {
  if (!id) return { ok: false, error: "Grupi ID puudub" };
  if (!data.nimi.trim()) return { ok: false, error: "Nimi on kohustuslik" };
  if (data.tüüp !== "toode" && data.tüüp !== "teenus") {
    return { ok: false, error: "Vigane tüüp" };
  }
  const sb = getServerSupabase();
  const { error } = await sb.from("tootegrupid").update(data).eq("id", id);
  if (error) return { ok: false, error: error.message };
  revalidatePath(`/grupid/${id}`);
  revalidatePath("/grupid");
  revalidatePath("/kataloog");
  return { ok: true };
}

export async function kustutaGrupp(id: string): Promise<{ ok: true } | { ok: false; error: string }> {
  if (!id) return { ok: false, error: "Grupi ID puudub" };
  const sb = getServerSupabase();
  // ON DELETE SET NULL kaaslased — grupi liikmed jäävad alles aga kaotavad grupi-seose
  const { error } = await sb.from("tootegrupid").delete().eq("id", id);
  if (error) return { ok: false, error: error.message };
  revalidatePath("/grupid");
  revalidatePath("/kataloog");
  return { ok: true };
}

export async function seoToodedGrupiga(
  toodeIds: string[],
  grupId: string | null,
): Promise<{ ok: true; uuendatud: number } | { ok: false; error: string }> {
  if (!toodeIds || toodeIds.length === 0) return { ok: false, error: "Pole tooteid valitud" };
  const sb = getServerSupabase();
  const { error, count } = await sb
    .from("hinnakirja_read")
    .update({ tootegrupp_id: grupId }, { count: "exact" })
    .in("id", toodeIds);
  if (error) return { ok: false, error: error.message };
  revalidatePath("/kataloog");
  if (grupId) revalidatePath(`/grupid/${grupId}`);
  revalidatePath("/grupid");
  return { ok: true, uuendatud: count ?? toodeIds.length };
}

export async function listAllGrupid(): Promise<Tootegrupp[]> {
  const sb = getServerSupabase();
  const { data } = await sb.from("tootegrupid").select("*").order("nimi", { ascending: true });
  return ((data ?? []) as unknown as Tootegrupp[]);
}

// ----------------------------------------------------------------------------
// Käsitsi sisestatud tooted/teenused (mis ei tule tarnija hinnakirjadest)
// Lood "VK Manuaalsed" hinnakirja kõikide selliste ridade alla.
// ----------------------------------------------------------------------------

const MANUAL_HINNAKIRJA_TARNIJA = "VK Manuaalsed";

async function getManualHinnakiriId(
  sb: ReturnType<typeof getServerSupabase>,
): Promise<{ ok: true; id: string } | { ok: false; error: string }> {
  const { data: existing } = await sb
    .from("hinnakirjad")
    .select("id")
    .eq("tarnija", MANUAL_HINNAKIRJA_TARNIJA)
    .eq("faili_tüüp", "manual")
    .maybeSingle();
  if (existing) return { ok: true, id: (existing as { id: string }).id };

  const { data: created, error } = await sb
    .from("hinnakirjad")
    .insert({
      tarnija: MANUAL_HINNAKIRJA_TARNIJA,
      faili_path: null,
      faili_nimi: null,
      faili_tüüp: "manual",
      staatus: "kinnitatud",
      "märkused":
        "Käsitsi sisestatud tooted/teenused (ei tule tarnija hinnakirjast). Genereeritud automaatselt.",
    })
    .select("id")
    .single();
  if (error || !created) return { ok: false, error: error?.message ?? "Manuaalse hinnakirja loomine ebaõnnestus" };
  return { ok: true, id: (created as { id: string }).id };
}

export type ManuaalneToodeInput = {
  grupId: string;
  nimetus: string;
  tähis: string | null;
  ühik: string | null;
  ostuhind_neto: number | null;
  paigaldusaeg_h_ühik: number | null;
  märkused: string | null;
  alt_nimed: string | null;
};

export async function lisaManuaalneToode(
  input: ManuaalneToodeInput,
): Promise<{ ok: true; id: string } | { ok: false; error: string }> {
  if (!input.grupId) return { ok: false, error: "Grupi ID puudub" };
  if (!input.nimetus?.trim()) return { ok: false, error: "Nimetus on kohustuslik" };

  const sb = getServerSupabase();

  const hk = await getManualHinnakiriId(sb);
  if (!hk.ok) return hk;

  const { data, error } = await sb
    .from("hinnakirja_read")
    .insert({
      hinnakiri_id: hk.id,
      tarnija_nimetus: input.nimetus.trim(),
      tarnija_kood: null,
      tarnija_brand: null,
      sektsioon: null,
      ostuhind_neto: input.ostuhind_neto,
      ühik: input.ühik?.trim() || null,
      kogus: null,
      paigaldusaeg_h_ühik: input.paigaldusaeg_h_ühik,
      magnus_märkused: input.märkused?.trim() || null,
      magnus_alt_nimed: input.alt_nimed?.trim() || null,
      tootegrupp_id: input.grupId,
      staatus: "matched",
    })
    .select("id")
    .single();
  if (error) return { ok: false, error: error.message };

  revalidatePath(`/grupid/${input.grupId}`);
  revalidatePath("/grupid");
  revalidatePath("/kataloog");
  return { ok: true, id: (data as { id: string }).id };
}
