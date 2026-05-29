"use server";

import { revalidatePath } from "next/cache";
import { getServerSupabase } from "@/lib/supabase/server";
import type { KliendiTüüp, HooneTüüp } from "@/lib/types";

function str(raw: FormDataEntryValue | null): string | null {
  if (raw === null) return null;
  const s = String(raw).trim();
  return s === "" ? null : s;
}

function num(raw: FormDataEntryValue | null): number | null {
  const s = str(raw);
  if (s === null) return null;
  const n = Number(s.replace(",", "."));
  return Number.isFinite(n) ? n : null;
}

function intPos(raw: FormDataEntryValue | null): number | null {
  const s = str(raw);
  if (s === null) return null;
  const n = parseInt(s, 10);
  return Number.isFinite(n) && n >= 0 ? n : null;
}

function asTüüp(raw: FormDataEntryValue | null): KliendiTüüp {
  return raw === "juriidiline" ? "juriidiline" : "eraisik";
}

function asHooneTüüp(raw: FormDataEntryValue | null): HooneTüüp | null {
  const s = str(raw);
  if (!s) return null;
  const valid: HooneTüüp[] = [
    "kortermaja", "eramaja", "rida_paarismaja", "ärihoone", "tööstushoone", "muu",
  ];
  return (valid as string[]).includes(s) ? (s as HooneTüüp) : null;
}

export async function looKlient(
  formData: FormData,
): Promise<{ ok: true; id: string } | { ok: false; error: string }> {
  const sb = getServerSupabase();
  const nimi = str(formData.get("nimi"));
  if (!nimi) return { ok: false, error: "Nimi on kohustuslik" };

  const tüüp = asTüüp(formData.get("tüüp"));
  const { data, error } = await sb
    .from("kliendid")
    .insert({
      nimi,
      tüüp,
      email: str(formData.get("email")),
      telefon: str(formData.get("telefon")),
      registrikood: str(formData.get("registrikood")),
      km_kohustuslane: formData.get("km_kohustuslane") === "on",
      km_nr: str(formData.get("km_nr")),
      märkused: str(formData.get("märkused")),
    })
    .select("id")
    .single();
  if (error) return { ok: false, error: error.message };

  revalidatePath("/kliendid");
  return { ok: true, id: data.id };
}

export async function muudaKlient(
  id: string,
  data: {
    nimi: string;
    tüüp: KliendiTüüp;
    email: string | null;
    telefon: string | null;
    registrikood: string | null;
    km_kohustuslane: boolean;
    km_nr: string | null;
    märkused: string | null;
  },
): Promise<{ ok: true } | { ok: false; error: string }> {
  if (!id) return { ok: false, error: "Kliendi ID puudub" };
  if (!data.nimi.trim()) return { ok: false, error: "Nimi on kohustuslik" };
  if (data.tüüp !== "eraisik" && data.tüüp !== "juriidiline") {
    return { ok: false, error: "Vigane tüüp" };
  }
  const sb = getServerSupabase();
  const { error } = await sb.from("kliendid").update(data).eq("id", id);
  if (error) return { ok: false, error: error.message };
  revalidatePath(`/kliendid/${id}`);
  revalidatePath("/kliendid");
  return { ok: true };
}

export async function kustutaKlient(
  id: string,
): Promise<{ ok: true } | { ok: false; error: string }> {
  if (!id) return { ok: false, error: "Kliendi ID puudub" };
  const sb = getServerSupabase();
  // ON DELETE CASCADE objektidele; pakkumised.klient_id NULLitakse
  const { error } = await sb.from("kliendid").delete().eq("id", id);
  if (error) return { ok: false, error: error.message };
  revalidatePath("/kliendid");
  revalidatePath("/pakkumised");
  return { ok: true };
}

export async function looObjekt(
  klientId: string,
  formData: FormData,
): Promise<{ ok: true; id: string } | { ok: false; error: string }> {
  if (!klientId) return { ok: false, error: "Kliendi ID puudub" };
  const sb = getServerSupabase();
  const nimi = str(formData.get("nimi"));
  if (!nimi) return { ok: false, error: "Objekti nimi on kohustuslik" };

  const { data, error } = await sb
    .from("objektid")
    .insert({
      klient_id: klientId,
      nimi,
      aadress: str(formData.get("aadress")),
      projekti_nr: str(formData.get("projekti_nr")),
      hoone_tüüp: asHooneTüüp(formData.get("hoone_tüüp")),
      korterite_arv: intPos(formData.get("korterite_arv")),
      korruste_arv: intPos(formData.get("korruste_arv")),
      pindala_m2: num(formData.get("pindala_m2")),
      märkused: str(formData.get("märkused")),
    })
    .select("id")
    .single();
  if (error) return { ok: false, error: error.message };

  revalidatePath(`/kliendid/${klientId}`);
  revalidatePath("/kliendid");
  return { ok: true, id: data.id };
}

export async function muudaObjekt(
  id: string,
  data: {
    nimi: string;
    aadress: string | null;
    projekti_nr: string | null;
    hoone_tüüp: HooneTüüp | null;
    korterite_arv: number | null;
    korruste_arv: number | null;
    pindala_m2: number | null;
    märkused: string | null;
  },
): Promise<{ ok: true; klient_id: string } | { ok: false; error: string }> {
  if (!id) return { ok: false, error: "Objekti ID puudub" };
  if (!data.nimi.trim()) return { ok: false, error: "Nimi on kohustuslik" };
  const sb = getServerSupabase();
  const { data: updated, error } = await sb
    .from("objektid")
    .update(data)
    .eq("id", id)
    .select("klient_id")
    .single();
  if (error) return { ok: false, error: error.message };
  revalidatePath(`/objektid/${id}`);
  revalidatePath(`/kliendid/${(updated as { klient_id: string }).klient_id}`);
  return { ok: true, klient_id: (updated as { klient_id: string }).klient_id };
}

export async function kustutaObjekt(
  id: string,
): Promise<{ ok: true } | { ok: false; error: string }> {
  if (!id) return { ok: false, error: "Objekti ID puudub" };
  const sb = getServerSupabase();
  // Lae klient_id enne kustutamist (revalidate jaoks)
  const { data: obj } = await sb
    .from("objektid")
    .select("klient_id")
    .eq("id", id)
    .maybeSingle();
  const { error } = await sb.from("objektid").delete().eq("id", id);
  if (error) return { ok: false, error: error.message };
  if (obj) revalidatePath(`/kliendid/${(obj as { klient_id: string }).klient_id}`);
  revalidatePath("/kliendid");
  return { ok: true };
}
