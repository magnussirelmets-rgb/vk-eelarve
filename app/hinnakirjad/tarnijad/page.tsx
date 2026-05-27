import Link from "next/link";
import { getServerSupabase } from "@/lib/supabase/server";
import { Button } from "@/components/ui/button";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { ArrowLeft, FileText } from "lucide-react";
import { TarnijaRida } from "./tarnija-rida";

export const dynamic = "force-dynamic";
export const revalidate = 0;

type TarnijaInfo = {
  nimi: string;
  hinnakirju: number;
  riduKokku: number;
  viimaneLaetud: string | null;
};

export default async function TarnijateHaldusPage() {
  const sb = getServerSupabase();
  // Lae kõik hinnakirjad + agregeeri tarnija järgi
  const { data: hkRaw } = await sb.from("hinnakirjad").select("*");
  const hinnakirjad = ((hkRaw ?? []) as unknown) as Array<{
    id: string;
    tarnija: string;
    artiklite_arv: number | null;
    laetud_kuupäev: string;
  }>;

  const agg = new Map<string, TarnijaInfo>();
  for (const h of hinnakirjad) {
    const t = h.tarnija;
    const cur = agg.get(t) ?? { nimi: t, hinnakirju: 0, riduKokku: 0, viimaneLaetud: null };
    cur.hinnakirju += 1;
    cur.riduKokku += h.artiklite_arv ?? 0;
    if (!cur.viimaneLaetud || h.laetud_kuupäev > cur.viimaneLaetud) {
      cur.viimaneLaetud = h.laetud_kuupäev;
    }
    agg.set(t, cur);
  }
  const tarnijad = Array.from(agg.values()).sort((a, b) => a.nimi.localeCompare(b.nimi));

  return (
    <div className="space-y-6">
      <Button asChild variant="ghost" size="sm" className="-ml-2">
        <Link href="/hinnakirjad">
          <ArrowLeft className="h-4 w-4" />
          Tagasi hinnakirjade nimekirja
        </Link>
      </Button>

      <div>
        <h1 className="text-3xl font-bold tracking-tight text-vk-navy">Tarnijate haldus</h1>
        <p className="text-sm text-muted-foreground">
          {tarnijad.length} tarnijat kokku. Nime muutmine uuendab kõik antud tarnija hinnakirjad ja
          nende artiklid. Tarnija kustutamine eemaldab püsivalt KÕIK selle tarnija hinnakirjad,
          tooted ja Storage&apos;is olevad failid.
        </p>
      </div>

      <div className="rounded-lg border bg-card">
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead>Tarnija nimi</TableHead>
              <TableHead className="w-[120px] text-right">Hinnakirju</TableHead>
              <TableHead className="w-[120px] text-right">Tooteid</TableHead>
              <TableHead className="w-[140px]">Viimati laetud</TableHead>
              <TableHead className="w-[280px] text-right">Tegevused</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {tarnijad.length === 0 ? (
              <TableRow>
                <TableCell colSpan={5} className="py-10 text-center text-muted-foreground">
                  Ühtegi tarnijat pole veel andmebaasis (pole hinnakirju üles laetud).
                </TableCell>
              </TableRow>
            ) : (
              tarnijad.map((t) => <TarnijaRida key={t.nimi} t={t} />)
            )}
          </TableBody>
        </Table>
      </div>

      <div className="rounded-md border bg-muted/30 px-4 py-3 text-xs text-muted-foreground">
        <div className="flex items-start gap-2">
          <FileText className="mt-0.5 h-4 w-4 shrink-0" />
          <div>
            <div className="font-semibold text-vk-navy">Märkused:</div>
            <ul className="mt-1 list-disc space-y-0.5 pl-4">
              <li>
                Nime muutmine teeb &quot;rename across hinnakirjad&quot; — kõik selle tarnija
                hinnakirja_read kirjed kuvatakse uue nimega ka kataloogis, otsingus jne.
              </li>
              <li>
                Kustutamine kustutab cascade&apos;iga ka kõik hinnakirja_read kirjed. Pakkumistes
                varem linkitud positsioonid kaotavad <span className="font-mono">toode_id</span>{" "}
                viite, kuid snapshot väärtused (nimetus, hind, paigaldusaeg) säilivad.
              </li>
              <li>
                Storage&apos;is olevad PDF/Excel failid eemaldatakse ka best-effort põhimõttel.
              </li>
            </ul>
          </div>
        </div>
      </div>
    </div>
  );
}
