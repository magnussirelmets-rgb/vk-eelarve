"use server";

import { revalidatePath } from "next/cache";
import { getServerSupabase } from "@/lib/supabase/server";

export type LooKomplektiInput = {
  nimi: string;
  kirjeldus: string | null;
  ühik: string;
  märkused: string | null;
  vaike_sektsioon?: string | null;
  vaike_alamsektsioon?: string | null;
  toode_idid: string[]; // hinnakirja_read ID-d valitud ridadest
};

export async function muudaKomplekti(
  id: string,
  data: {
    nimi?: string;
    kirjeldus?: string | null;
    ühik?: string;
    märkused?: string | null;
    vaike_sektsioon?: string | null;
    vaike_alamsektsioon?: string | null;
  },
): Promise<{ ok: true } | { ok: false; error: string }> {
  if (!id) return { ok: false, error: "Komplekti ID puudub" };
  const sb = getServerSupabase();
  const upd: Record<string, unknown> = {};
  if (data.nimi !== undefined) {
    const v = data.nimi.trim();
    if (!v) return { ok: false, error: "Nimi ei tohi olla tühi" };
    upd.nimi = v;
  }
  if (data.kirjeldus !== undefined) upd.kirjeldus = data.kirjeldus?.trim() || null;
  if (data.ühik !== undefined) upd.ühik = data.ühik.trim() || "kompl";
  if (data.märkused !== undefined) upd.märkused = data.märkused?.trim() || null;
  if (data.vaike_sektsioon !== undefined) upd.vaike_sektsioon = data.vaike_sektsioon?.trim() || null;
  if (data.vaike_alamsektsioon !== undefined)
    upd.vaike_alamsektsioon = data.vaike_alamsektsioon?.trim() || null;
  if (Object.keys(upd).length === 0) return { ok: true };
  const { error } = await sb.from("komplektid").update(upd).eq("id", id);
  if (error) return { ok: false, error: error.message };
  revalidatePath(`/komplektid/${id}`);
  revalidatePath("/komplektid");
  return { ok: true };
}

export async function looKomplekt(
  input: LooKomplektiInput,
): Promise<{ ok: true; id: string; ridu: number } | { ok: false; error: string }> {
  if (!input.nimi?.trim()) return { ok: false, error: "Komplekti nimi on kohustuslik" };
  if (!input.toode_idid || input.toode_idid.length === 0) {
    return { ok: false, error: "Vali vähemalt üks rida hinnakirjast" };
  }
  const sb = getServerSupabase();

  // Loe valitud hinnakirja_read read snapshotiks
  const { data: rows, error: rErr } = await sb
    .from("hinnakirja_read")
    .select("*, hinnakirjad(tarnija)")
    .in("id", input.toode_idid);
  if (rErr) return { ok: false, error: rErr.message };
  if (!rows || rows.length === 0) return { ok: false, error: "Valitud read ei leitud" };

  // Loo komplekt
  const { data: kpData, error: kpErr } = await sb
    .from("komplektid")
    .insert({
      nimi: input.nimi.trim(),
      kirjeldus: input.kirjeldus?.trim() || null,
      ühik: input.ühik.trim() || "kompl",
      märkused: input.märkused?.trim() || null,
      vaike_sektsioon: input.vaike_sektsioon?.trim() || null,
      vaike_alamsektsioon: input.vaike_alamsektsioon?.trim() || null,
    })
    .select("id")
    .single();
  if (kpErr || !kpData) return { ok: false, error: kpErr?.message ?? "Komplekti loomine ebaõnnestus" };
  const komplektId = (kpData as { id: string }).id;

  // Loo komplekti read snapshot'iga
  const readRows = (rows as unknown as Array<Record<string, unknown>>).map((r, idx) => ({
    komplekt_id: komplektId,
    toode_id: r.id as string,
    nimetus: r.tarnija_nimetus as string,
    tarnija: ((r.hinnakirjad as { tarnija?: string } | null)?.tarnija ?? null) as string | null,
    tarnija_kood: (r.tarnija_kood ?? null) as string | null,
    tarnija_brand: (r.tarnija_brand ?? null) as string | null,
    tähis: (r.tähis ?? null) as string | null,
    ühik: (r["ühik"] ?? null) as string | null,
    ostuhind_snapshot: (r.ostuhind_neto ?? null) as number | null,
    paigaldusaeg_h_ühik_snapshot: (r.paigaldusaeg_h_ühik ?? null) as number | null,
    kogus: 1,
    järjekord: idx + 1,
  }));
  const { error: insErr } = await sb.from("komplekti_read").insert(readRows);
  if (insErr) {
    // Roll back komplekt
    await sb.from("komplektid").delete().eq("id", komplektId);
    return { ok: false, error: insErr.message };
  }

  revalidatePath("/komplektid");
  return { ok: true, id: komplektId, ridu: readRows.length };
}

export async function muudaKomplektiRea(
  reaId: string,
  data: { kogus?: number; nimetus?: string; ostuhind_snapshot?: number | null },
): Promise<{ ok: true } | { ok: false; error: string }> {
  if (!reaId) return { ok: false, error: "Rea ID puudub" };
  const sb = getServerSupabase();
  const { data: rida } = await sb
    .from("komplekti_read")
    .select("komplekt_id")
    .eq("id", reaId)
    .maybeSingle();
  const komplektId = (rida as { komplekt_id: string } | null)?.komplekt_id;
  const { error } = await sb.from("komplekti_read").update(data).eq("id", reaId);
  if (error) return { ok: false, error: error.message };
  if (komplektId) revalidatePath(`/komplektid/${komplektId}`);
  return { ok: true };
}

export async function kustutaKomplektiRida(
  reaId: string,
): Promise<{ ok: true } | { ok: false; error: string }> {
  if (!reaId) return { ok: false, error: "Rea ID puudub" };
  const sb = getServerSupabase();
  const { data: rida } = await sb
    .from("komplekti_read")
    .select("komplekt_id")
    .eq("id", reaId)
    .maybeSingle();
  const komplektId = (rida as { komplekt_id: string } | null)?.komplekt_id;
  const { error } = await sb.from("komplekti_read").delete().eq("id", reaId);
  if (error) return { ok: false, error: error.message };
  if (komplektId) revalidatePath(`/komplektid/${komplektId}`);
  return { ok: true };
}

export async function kustutaKomplekt(
  id: string,
): Promise<{ ok: true } | { ok: false; error: string }> {
  if (!id) return { ok: false, error: "Komplekti ID puudub" };
  const sb = getServerSupabase();
  const { error } = await sb.from("komplektid").delete().eq("id", id);
  if (error) return { ok: false, error: error.message };
  revalidatePath("/komplektid");
  return { ok: true };
}
