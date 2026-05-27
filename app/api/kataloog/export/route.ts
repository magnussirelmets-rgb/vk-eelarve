import { NextResponse } from "next/server";
import { getServerSupabase } from "@/lib/supabase/server";

export const dynamic = "force-dynamic";

function csvEscape(v: unknown): string {
  if (v === null || v === undefined) return "";
  const s = String(v);
  if (s.includes(";") || s.includes('"') || s.includes("\n") || s.includes("\r")) {
    return `"${s.replace(/"/g, '""')}"`;
  }
  return s;
}

export async function GET(): Promise<Response> {
  const sb = getServerSupabase();
  const { data, error } = await sb
    .from("hinnakirja_read")
    .select("*, hinnakirjad(tarnija)")
    .neq("staatus", "ignoreeritud")
    .order("loodud", { ascending: false });
  if (error) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
  const rows = ((data ?? []) as unknown) as Array<{
    id: string;
    tarnija_kood: string | null;
    tarnija_nimetus: string;
    tarnija_brand: string | null;
    tähis: string | null;
    ühik: string | null;
    ostuhind_neto: number | null;
    paigaldusaeg_h_ühik: number | null;
    kirjeldus: string | null;
    magnus_alt_nimed: string | null;
    magnus_märkused: string | null;
    hinnakirjad: { tarnija: string } | null;
  }>;

  const header = [
    "id",
    "tarnija",
    "tarnija_kood",
    "tarnija_nimetus",
    "tarnija_brand",
    "tähis",
    "ühik",
    "ostuhind",
    "paigaldusaeg_h",
    "kirjeldus",
    "alt_nimed",
    "sisemised_märkused",
  ];

  const lines: string[] = [];
  lines.push(header.map(csvEscape).join(";"));
  for (const r of rows) {
    lines.push(
      [
        r.id,
        r.hinnakirjad?.tarnija ?? "",
        r.tarnija_kood ?? "",
        r.tarnija_nimetus,
        r.tarnija_brand ?? "",
        r.tähis ?? "",
        r.ühik ?? "",
        r.ostuhind_neto ?? "",
        r.paigaldusaeg_h_ühik ?? "",
        r.kirjeldus ?? "",
        r.magnus_alt_nimed ?? "",
        r.magnus_märkused ?? "",
      ]
        .map(csvEscape)
        .join(";"),
    );
  }

  const csv = "﻿" + lines.join("\r\n");
  const today = new Date().toISOString().slice(0, 10);
  return new Response(csv, {
    headers: {
      "Content-Type": "text/csv; charset=utf-8",
      "Content-Disposition": `attachment; filename="vk-kataloog-${today}.csv"`,
      "Cache-Control": "no-store",
    },
  });
}
