import { NextResponse } from "next/server";
import { getServerSupabase } from "@/lib/supabase/server";

export const dynamic = "force-dynamic";

// Escape ühe CSV-välja jaoks: kui sisaldab ;, " või reavahetust → ümbritse jutumärkidega
function csvEscape(v: unknown): string {
  if (v === null || v === undefined) return "";
  const s = String(v);
  if (s.includes(";") || s.includes('"') || s.includes("\n") || s.includes("\r")) {
    return `"${s.replace(/"/g, '""')}"`;
  }
  return s;
}

export async function GET(
  _req: Request,
  { params }: { params: { id: string } },
): Promise<Response> {
  const sb = getServerSupabase();
  const [{ data: hkData }, { data: rrData }] = await Promise.all([
    sb.from("hinnakirjad").select("tarnija, faili_nimi").eq("id", params.id).maybeSingle(),
    sb
      .from("hinnakirja_read")
      .select("*")
      .eq("hinnakiri_id", params.id)
      .order("rea_nr", { ascending: true }),
  ]);
  if (!hkData) return NextResponse.json({ error: "Hinnakirja ei leitud" }, { status: 404 });

  const hk = hkData as { tarnija: string; faili_nimi: string | null };
  const rows = ((rrData ?? []) as unknown) as Array<{
    id: string;
    tarnija_kood: string | null;
    tarnija_nimetus: string;
    tarnija_brand: string | null;
    ühik: string | null;
    ostuhind_neto: number | null;
    kirjeldus: string | null;
  }>;

  // CSV BOM Excelile + semicolon separator (Eesti Excel parsib semicolon'i otse veergudeks)
  const header = ["id", "tarnija_kood", "tarnija_nimetus", "tarnija_brand", "ühik", "ostuhind", "kirjeldus"];
  const lines: string[] = [];
  lines.push(header.map(csvEscape).join(";"));
  for (const r of rows) {
    lines.push(
      [
        r.id,
        r.tarnija_kood ?? "",
        r.tarnija_nimetus,
        r.tarnija_brand ?? "",
        r.ühik ?? "",
        r.ostuhind_neto ?? "",
        r.kirjeldus ?? "",
      ]
        .map(csvEscape)
        .join(";"),
    );
  }
  const csv = "﻿" + lines.join("\r\n");

  const fileName = `kirjeldused_${hk.tarnija.replace(/[^A-Za-z0-9._-]+/g, "_")}.csv`;
  return new Response(csv, {
    headers: {
      "Content-Type": "text/csv; charset=utf-8",
      "Content-Disposition": `attachment; filename="${fileName}"`,
      "Cache-Control": "no-store",
    },
  });
}
