import Link from "next/link";
import { notFound } from "next/navigation";
import { getServerSupabase } from "@/lib/supabase/server";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Badge } from "@/components/ui/badge";
import {
  HINNAKIRJA_STAATUS_LABEL,
  type Hinnakiri,
  type HinnakirjaRida,
} from "@/lib/types";
import { formatDate, formatEur, formatNum } from "@/lib/utils";
import { ArrowLeft, AlertTriangle, FileText } from "lucide-react";
import { ActionBar } from "./action-bar";
import { HinnakirjaRidadeTabel } from "./hinnakirja-ridade-tabel";
import { MuudaTarnija } from "./muuda-tarnija";
import { KirjeldusedUpload } from "./kirjeldused-upload";
import { KustutaHinnakiriNupp } from "../kustuta-nupp";

export const dynamic = "force-dynamic";
export const revalidate = 0;

function StaatuseBadge({ s }: { s: Hinnakiri["staatus"] }) {
  const variant: "default" | "blue" | "red" | "secondary" =
    s === "parsitud" ? "blue" : s === "viga" ? "red" : "secondary";
  return <Badge variant={variant}>{HINNAKIRJA_STAATUS_LABEL[s]}</Badge>;
}

export default async function HinnakiriDetailPage({ params }: { params: { id: string } }) {
  const sb = getServerSupabase();

  const [{ data: hkData, error: hkErr }, { data: readData }] = await Promise.all([
    sb.from("hinnakirjad").select("*").eq("id", params.id).maybeSingle(),
    sb.from("hinnakirja_read").select("*").eq("hinnakiri_id", params.id).order("rea_nr", { ascending: true }),
  ]);
  if (hkErr) throw new Error(hkErr.message);
  if (!hkData) notFound();

  const hk = hkData as unknown as Hinnakiri;
  const read = (readData ?? []) as unknown as HinnakirjaRida[];

  const stats = {
    kokku: read.length,
    aktiivseid: read.filter((r) => r.staatus !== "ignoreeritud").length,
    ignoreeritud: read.filter((r) => r.staatus === "ignoreeritud").length,
  };

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <Button asChild variant="ghost" size="sm" className="-ml-2">
          <Link href="/hinnakirjad">
            <ArrowLeft className="h-4 w-4" />
            Tagasi hinnakirjade nimekirja
          </Link>
        </Button>
        <KustutaHinnakiriNupp
          hinnakirjaId={hk.id}
          tarnijaNimi={hk.tarnija}
          ridade_arv={stats.kokku}
          redirectTo="/hinnakirjad"
          variant="button"
        />
      </div>

      <div className="flex flex-wrap items-start justify-between gap-4">
        <div className="space-y-2">
          <div className="flex flex-wrap items-center gap-2">
            <span className="text-xs uppercase tracking-wide text-muted-foreground">Tarnija</span>
            <MuudaTarnija hinnakirjaId={hk.id} algneTarnija={hk.tarnija} />
            <StaatuseBadge s={hk.staatus} />
          </div>
          <div className="flex items-center gap-2 text-sm text-muted-foreground">
            <FileText className="h-4 w-4" />
            <span>{hk.faili_nimi ?? hk.faili_path}</span>
            <span className="rounded bg-muted px-1.5 py-0.5 text-xs uppercase">{hk.faili_tüüp}</span>
            <span>· laetud {formatDate(hk.laetud_kuupäev)}</span>
          </div>
        </div>
      </div>

      {hk.viga_tekst ? (
        <div className="flex items-start gap-3 rounded-md border border-vk-red/30 bg-vk-red/5 px-4 py-3 text-sm">
          <AlertTriangle className="mt-0.5 h-4 w-4 shrink-0 text-vk-red" />
          <div>
            <div className="font-medium text-vk-red">Viga töötlemisel</div>
            <div className="mt-1 text-vk-red/80">{hk.viga_tekst}</div>
          </div>
        </div>
      ) : null}

      <ActionBar hinnakirjaId={hk.id} staatus={hk.staatus} artikleidKokku={stats.kokku} />

      {stats.kokku > 0 ? (
        <div className="grid gap-3 sm:grid-cols-3">
          <Stat label="Tooted kokku" value={stats.kokku} />
          <Stat label="Aktiivseid kataloogis" value={stats.aktiivseid} accent="blue" />
          <Stat label="Ignoreeritud" value={stats.ignoreeritud} />
        </div>
      ) : null}

      {stats.kokku > 0 ? <KirjeldusedUpload hinnakirjaId={hk.id} /> : null}

      {stats.kokku > 0 ? (
        <HinnakirjaRidadeTabel read={read} />
      ) : (
        <Card>
          <CardContent className="py-10 text-center text-muted-foreground">
            Ühtegi toodet pole veel parsitud. Vajuta ülal &quot;Parsi PDF/Excel AI-ga&quot; nuppu.
          </CardContent>
        </Card>
      )}
    </div>
  );
}

function Stat({
  label,
  value,
  accent,
}: {
  label: string;
  value: number;
  accent?: "blue";
}) {
  const color = accent === "blue" ? "text-vk-blue" : "text-vk-navy";
  return (
    <div className="rounded-lg border bg-card p-4">
      <div className="text-xs uppercase tracking-wide text-muted-foreground">{label}</div>
      <div className={`mt-1 font-mono text-2xl font-semibold ${color}`}>{value}</div>
    </div>
  );
}
