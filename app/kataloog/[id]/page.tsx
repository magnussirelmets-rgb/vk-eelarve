import Link from "next/link";
import { notFound } from "next/navigation";
import { getServerSupabase } from "@/lib/supabase/server";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import type { HinnakirjaRidaKataloogis } from "@/lib/types";
import { formatDate, formatEur, formatNum } from "@/lib/utils";
import { ArrowLeft, FileText } from "lucide-react";
import { MuudaTooteMetaForm } from "./muuda-toote-meta-form";
import { MuudaNimetus } from "./muuda-nimetus";

export const dynamic = "force-dynamic";
export const revalidate = 0;

export default async function ToodeDetailPage({ params }: { params: { id: string } }) {
  const sb = getServerSupabase();

  const { data, error } = await sb
    .from("hinnakirja_read")
    .select("*, hinnakirjad(tarnija, faili_nimi, laetud_kuupäev, faili_tüüp)")
    .eq("id", params.id)
    .maybeSingle();
  if (error) throw new Error(error.message);
  if (!data) notFound();

  const r = data as unknown as HinnakirjaRidaKataloogis;

  // Sama tarnija_kood + tarnija — mineviku hinnaajalugu (kui tarnija on sama toote varem üles laadinud)
  let history: Array<{
    id: string;
    ostuhind_neto: number | null;
    jaehind_neto: number | null;
    ah_protsent: number | null;
    laetud_kuupäev: string;
    hinnakiri_id: string;
    faili_nimi: string | null;
  }> = [];
  if (r.tarnija_kood && r.hinnakirjad?.tarnija) {
    const { data: histData } = await sb
      .from("hinnakirja_read")
      .select("id, ostuhind_neto, jaehind_neto, ah_protsent, hinnakiri_id, hinnakirjad!inner(tarnija, faili_nimi, laetud_kuupäev)")
      .eq("tarnija_kood", r.tarnija_kood)
      .eq("hinnakirjad.tarnija", r.hinnakirjad.tarnija)
      .neq("id", r.id)
      .order("loodud", { ascending: false })
      .limit(10);
    history = (histData ?? []).map((h: any) => ({
      id: h.id,
      ostuhind_neto: h.ostuhind_neto,
      jaehind_neto: h.jaehind_neto,
      ah_protsent: h.ah_protsent,
      hinnakiri_id: h.hinnakiri_id,
      laetud_kuupäev: h.hinnakirjad?.laetud_kuupäev ?? "",
      faili_nimi: h.hinnakirjad?.faili_nimi ?? null,
    }));
  }

  return (
    <div className="space-y-6">
      <Button asChild variant="ghost" size="sm" className="-ml-2">
        <Link href="/kataloog">
          <ArrowLeft className="h-4 w-4" />
          Tagasi tooted
        </Link>
      </Button>

      <div className="space-y-2">
        <div className="flex flex-wrap items-center gap-2">
          <span className="rounded bg-vk-navy px-2 py-0.5 text-xs font-semibold text-white">
            {r.hinnakirjad?.tarnija ?? "—"}
          </span>
          {r.tarnija_brand ? (
            <span className="rounded border bg-background px-2 py-0.5 text-xs">{r.tarnija_brand}</span>
          ) : null}
          {r.tarnija_kood ? (
            <span className="font-mono text-sm text-muted-foreground">{r.tarnija_kood}</span>
          ) : null}
        </div>
        <MuudaNimetus tooteId={r.id} algneNimetus={r.tarnija_nimetus} />
        {r.sektsioon ? (
          <p className="text-xs uppercase tracking-wide text-muted-foreground">{r.sektsioon}</p>
        ) : null}
      </div>

      <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
        <Field label="Ostuhind (kehtiv)" value={formatEur(r.ostuhind_neto)} mono />
        <Field
          label="Paigaldusaeg"
          value={r.paigaldusaeg_h_ühik === null ? "—" : `${formatNum(r.paigaldusaeg_h_ühik)} h/ühik`}
          mono
        />
        <Field label="Ühik" value={r.ühik ?? "—"} />
        <Field label="Jaehind / AH%" value={
          r.jaehind_neto !== null && r.ah_protsent !== null
            ? `${formatEur(r.jaehind_neto)} · -${r.ah_protsent}%`
            : "—"
        } mono />
      </div>

      <Card>
        <CardHeader>
          <CardTitle>Sinu märkused ja paigaldusaeg</CardTitle>
          <CardDescription>
            Tarnijad ei anna paigaldusaega — see on sinu enda tacit-teadmine. Lisa siia, jääb püsima
            selle toote küljes ka edaspidi (kuni hinnakirja uuesti parsid). Märkused on vabateksti
            ala — saad lisada ka oma sünonüümid mis aitavad mahutabel-otsingul leida (nt
            &quot;kuulkraan&quot;, &quot;ball valve&quot;).
          </CardDescription>
        </CardHeader>
        <CardContent>
          <MuudaTooteMetaForm
            tooteId={r.id}
            algnePaigaldusaeg={r.paigaldusaeg_h_ühik}
            algMärkused={r.magnus_märkused ?? ""}
            algAltNimed={r.magnus_alt_nimed ?? ""}
            algKirjeldus={r.kirjeldus ?? ""}
          />
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle>Allikas</CardTitle>
          <CardDescription>Sellest hinnakirjast tuli see toode</CardDescription>
        </CardHeader>
        <CardContent>
          <div className="flex items-center gap-2 text-sm">
            <FileText className="h-4 w-4 text-muted-foreground" />
            <span>{r.hinnakirjad?.faili_nimi ?? r.hinnakiri_id}</span>
            <span className="rounded bg-muted px-1.5 py-0.5 text-xs uppercase">
              {r.hinnakirjad?.faili_tüüp ?? "?"}
            </span>
            <span className="text-muted-foreground">
              · laetud {r.hinnakirjad ? formatDate(r.hinnakirjad.laetud_kuupäev) : "—"}
            </span>
            <Link
              href={`/hinnakirjad/${r.hinnakiri_id}`}
              className="ml-auto text-vk-blue hover:underline"
            >
              Vaata hinnakirja →
            </Link>
          </div>
        </CardContent>
      </Card>

      {history.length > 0 ? (
        <Card>
          <CardHeader>
            <CardTitle>Hinnaajalugu</CardTitle>
            <CardDescription>
              Sama tarnija + sama tarnija_kood teistes hinnakirjades (kui esinenud)
            </CardDescription>
          </CardHeader>
          <CardContent className="space-y-1 text-sm">
            {history.map((h) => (
              <div key={h.id} className="flex items-center justify-between rounded-md px-2 py-1.5 hover:bg-muted">
                <Link href={`/kataloog/${h.id}`} className="text-vk-blue hover:underline">
                  {formatDate(h.laetud_kuupäev)} — {h.faili_nimi ?? "—"}
                </Link>
                <span className="font-mono text-xs">{formatEur(h.ostuhind_neto)}</span>
              </div>
            ))}
          </CardContent>
        </Card>
      ) : null}
    </div>
  );
}

function Field({ label, value, mono }: { label: string; value: string | null | undefined; mono?: boolean }) {
  return (
    <div className="rounded-lg border bg-card p-4">
      <div className="text-xs uppercase tracking-wide text-muted-foreground">{label}</div>
      <div className={`mt-1 ${mono ? "font-mono text-sm" : "text-sm"}`}>{value || "—"}</div>
    </div>
  );
}
