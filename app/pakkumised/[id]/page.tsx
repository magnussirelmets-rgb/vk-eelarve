import Link from "next/link";
import { notFound } from "next/navigation";
import { getServerSupabase } from "@/lib/supabase/server";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Badge } from "@/components/ui/badge";
import { PAKKUMISE_STAATUS_LABEL, type Pakkumine, type Positsioon, type PakkumiseMahutabel } from "@/lib/types";
import { PAKKUMISE_MALL_BY_ID, formatMallVali } from "@/lib/pakkumise-mallid";
import { formatDate, formatNum } from "@/lib/utils";
import { ArrowLeft, FileText, Printer } from "lucide-react";
import { ActionBar } from "./action-bar";
import { PositsioonideTabel } from "./positsioonide-tabel";
import { PakkumiseSeadedForm } from "./pakkumise-seaded";
import { KustutaPakkumineNupp } from "../kustuta-nupp";
import { LisaKomplektDialog } from "./lisa-komplekt-dialog";
import { UusSamaleObjektileNupp } from "./uus-samale-objektile-nupp";
import { KiirLisaRida } from "./kiir-lisa-rida";

export const dynamic = "force-dynamic";
export const revalidate = 0;

function StaatuseBadge({ s }: { s: Pakkumine["staatus"] }) {
  const variant: "default" | "blue" | "red" | "secondary" =
    s === "võidetud" ? "blue" : s === "kaotatud" ? "red" : "secondary";
  return <Badge variant={variant}>{PAKKUMISE_STAATUS_LABEL[s]}</Badge>;
}

export default async function PakkumineDetailPage({ params }: { params: { id: string } }) {
  const sb = getServerSupabase();

  const [{ data: pkData, error: pkErr }, { data: posData }, { data: mhData }] = await Promise.all([
    sb.from("pakkumised").select("*").eq("id", params.id).maybeSingle(),
    sb
      .from("positsioonid")
      .select("*")
      .eq("pakkumine_id", params.id)
      .order("rea_nr", { ascending: true }),
    sb
      .from("pakkumise_mahutabelid")
      .select("*")
      .eq("pakkumine_id", params.id)
      .order("loodud", { ascending: true }),
  ]);
  if (pkErr) throw new Error(pkErr.message);
  if (!pkData) notFound();

  const pakkumine = pkData as unknown as Pakkumine;
  const positsioonid = (posData ?? []) as unknown as Positsioon[];
  const mahutabelid = (mhData ?? []) as unknown as PakkumiseMahutabel[];

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <Button asChild variant="ghost" size="sm" className="-ml-2">
          <Link href="/pakkumised">
            <ArrowLeft className="h-4 w-4" />
            Tagasi pakkumised
          </Link>
        </Button>
        <div className="flex items-center gap-2">
          <UusSamaleObjektileNupp algneId={pakkumine.id} objektiNimi={pakkumine.objekt} />
          <Button asChild variant="outline" size="sm">
            <Link href={`/pakkumised/${params.id}/trukk`}>
              <Printer className="h-4 w-4" />
              Trükivaade
            </Link>
          </Button>
          <KustutaPakkumineNupp
            pakkumineId={pakkumine.id}
            vkpNr={pakkumine.vkp_nr}
            redirectTo="/pakkumised"
          />
        </div>
      </div>

      <div className="flex flex-wrap items-start justify-between gap-4">
        <div className="space-y-2">
          <div className="flex flex-wrap items-center gap-2">
            <span className="font-mono text-sm text-muted-foreground">{pakkumine.vkp_nr}</span>
            <StaatuseBadge s={pakkumine.staatus} />
            {pakkumine.mall && PAKKUMISE_MALL_BY_ID[pakkumine.mall] ? (
              <Badge variant="secondary">
                {PAKKUMISE_MALL_BY_ID[pakkumine.mall].lühi}
              </Badge>
            ) : null}
          </div>
          <h1 className="text-2xl font-bold tracking-tight text-vk-navy">
            {pakkumine.objekt ?? "(objekt määramata)"}
          </h1>
          <div className="flex flex-wrap items-center gap-3 text-sm text-muted-foreground">
            {pakkumine.tellija_nimi ? <span>{pakkumine.tellija_nimi}</span> : null}
            {pakkumine.tellija_telefon ? (
              <span>· {pakkumine.tellija_telefon}</span>
            ) : null}
            {pakkumine.tellija_email ? <span>· {pakkumine.tellija_email}</span> : null}
            {pakkumine.projekti_nr ? (
              <span>· Projekt nr {pakkumine.projekti_nr}</span>
            ) : null}
            <span>· Loodud {formatDate(pakkumine.loodud)}</span>
          </div>
        </div>
      </div>

      {pakkumine.mahutabel_pdf_nimi ? (
        <div className="flex items-center gap-2 rounded-md border bg-muted/40 px-3 py-2 text-sm">
          <FileText className="h-4 w-4 text-muted-foreground" />
          <span>Mahutabel: {pakkumine.mahutabel_pdf_nimi}</span>
          {pakkumine.mahutabel_parsitud_ajal ? (
            <span className="text-xs text-muted-foreground">
              · parsitud {formatDate(pakkumine.mahutabel_parsitud_ajal)}
            </span>
          ) : null}
        </div>
      ) : null}

      {/* Skaalategurid (scalar veerud) */}
      {(pakkumine.püstikute_arv ||
        pakkumine.korterite_arv ||
        pakkumine.radiaatorite_arv ||
        pakkumine.keldrimagistraalide_jm ||
        pakkumine.väljavõtete_arv) ? (
        <div className="grid gap-3 sm:grid-cols-5">
          {pakkumine.püstikute_arv !== null ? (
            <Field label="Püstikute arv" value={String(pakkumine.püstikute_arv)} mono />
          ) : null}
          {pakkumine.korterite_arv !== null ? (
            <Field label="Korterite arv" value={String(pakkumine.korterite_arv)} mono />
          ) : null}
          {pakkumine.radiaatorite_arv !== null ? (
            <Field label="Radiaatorite arv" value={String(pakkumine.radiaatorite_arv)} mono />
          ) : null}
          {pakkumine.keldrimagistraalide_jm !== null ? (
            <Field label="Keldrimagistr. jm" value={formatNum(pakkumine.keldrimagistraalide_jm)} mono />
          ) : null}
          {pakkumine.väljavõtete_arv !== null ? (
            <Field label="Väljavõtete arv" value={String(pakkumine.väljavõtete_arv)} mono />
          ) : null}
        </div>
      ) : null}

      {/* Malli-spetsiifilised parameetrid (JSONB mall_andmed) */}
      {pakkumine.mall && PAKKUMISE_MALL_BY_ID[pakkumine.mall] ? (() => {
        const mallConf = PAKKUMISE_MALL_BY_ID[pakkumine.mall];
        const mallVals = pakkumine.mall_andmed ?? {};
        const seen = new Set<string>();
        const väljaPaarid: { label: string; väärtus: string }[] = [];
        for (const v of mallConf.mallVäljad) {
          if (seen.has(v.key)) continue;
          const formatitud = formatMallVali(v, (mallVals as Record<string, unknown>)[v.key]);
          if (!formatitud) continue;
          seen.add(v.key);
          väljaPaarid.push(formatitud);
        }
        if (väljaPaarid.length === 0) return null;
        return (
          <div className="grid gap-3 sm:grid-cols-3 lg:grid-cols-4">
            {väljaPaarid.map((p) => (
              <Field key={p.label} label={p.label} value={p.väärtus} mono />
            ))}
          </div>
        );
      })() : null}

      <ActionBar pakkumineId={pakkumine.id} mahutabelid={mahutabelid} />

      {/* Komplekti lisamine ühe eriosana */}
      <div className="flex items-center justify-between rounded-lg border border-dashed bg-card px-4 py-2">
        <div className="text-xs text-muted-foreground">
          Lisa salvestatud komplekt (nt &quot;Puurkaevude rajamine&quot;) tervikuna ühe eriosa alla.
        </div>
        <LisaKomplektDialog
          pakkumineId={pakkumine.id}
          soovituslikudEriosad={
            pakkumine.mall && PAKKUMISE_MALL_BY_ID[pakkumine.mall]
              ? PAKKUMISE_MALL_BY_ID[pakkumine.mall].soovituslikudEriosad
              : []
          }
        />
      </div>

      <PakkumiseSeadedForm
        pakkumineId={pakkumine.id}
        algneTunnitasu={pakkumine.tunnitasu}
        algneKate={pakkumine.kate_koefitsient}
        algneKmMäär={pakkumine.km_määr}
      />

      {!pakkumine.mahutabel_pdf_path ? (
        <KiirLisaRida
          pakkumineId={pakkumine.id}
          soovituslikudEriosad={
            pakkumine.mall && PAKKUMISE_MALL_BY_ID[pakkumine.mall]
              ? PAKKUMISE_MALL_BY_ID[pakkumine.mall].soovituslikudEriosad
              : []
          }
        />
      ) : null}

      {positsioonid.length > 0 || !pakkumine.mahutabel_pdf_path ? (
        <PositsioonideTabel
          pakkumineId={pakkumine.id}
          positsioonid={positsioonid}
          kate_koefitsient={pakkumine.kate_koefitsient}
          tunnitasu={pakkumine.tunnitasu}
          km_määr={pakkumine.km_määr}
        />
      ) : pakkumine.mahutabel_pdf_path ? (
        <Card>
          <CardContent className="py-10 text-center text-muted-foreground">
            Mahutabel pole veel parsitud. Vajuta ülal &quot;Parsi mahutabel AI-ga&quot; nuppu.
          </CardContent>
        </Card>
      ) : null}
    </div>
  );
}

function Field({ label, value, mono }: { label: string; value: string; mono?: boolean }) {
  return (
    <div className="rounded-lg border bg-card p-3">
      <div className="text-xs uppercase tracking-wide text-muted-foreground">{label}</div>
      <div className={`mt-1 ${mono ? "font-mono text-sm" : "text-sm"}`}>{value || "—"}</div>
    </div>
  );
}
