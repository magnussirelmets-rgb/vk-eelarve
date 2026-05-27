import Link from "next/link";
import { getServerSupabase } from "@/lib/supabase/server";

export const dynamic = "force-dynamic";
export const revalidate = 0;
import { Button } from "@/components/ui/button";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Badge } from "@/components/ui/badge";
import { HINNAKIRJA_STAATUS_LABEL, type Hinnakiri } from "@/lib/types";
import { formatDate } from "@/lib/utils";
import { Plus, FileText, Users } from "lucide-react";
import { KustutaHinnakiriNupp } from "./kustuta-nupp";

function StaatuseBadge({ s }: { s: Hinnakiri["staatus"] }) {
  const variant: "default" | "blue" | "red" | "secondary" =
    s === "kinnitatud" ? "blue" : s === "viga" ? "red" : "secondary";
  return <Badge variant={variant}>{HINNAKIRJA_STAATUS_LABEL[s]}</Badge>;
}

export default async function HinnakirjadPage() {
  const sb = getServerSupabase();
  const { data, error } = await sb
    .from("hinnakirjad")
    .select("*")
    .order("loodud", { ascending: false })
    .limit(100);
  if (error) throw new Error(`Hinnakirjade laadimine ebaõnnestus: ${error.message}`);
  const hinnakirjad = (data ?? []) as unknown as Hinnakiri[];

  return (
    <div className="space-y-6">
      <div className="flex flex-wrap items-center justify-between gap-4">
        <div>
          <h1 className="text-3xl font-bold tracking-tight text-vk-navy">Hinnakirjad</h1>
          <p className="text-sm text-muted-foreground">
            {hinnakirjad.length} {hinnakirjad.length === 1 ? "hinnakiri" : "hinnakirja"} kokku
          </p>
        </div>
        <div className="flex items-center gap-2">
          <Button asChild variant="outline">
            <Link href="/hinnakirjad/tarnijad">
              <Users className="h-4 w-4" />
              Halda tarnijaid
            </Link>
          </Button>
          <Button asChild variant="primary">
            <Link href="/hinnakirjad/uus">
              <Plus className="h-4 w-4" />
              Uus hinnakiri
            </Link>
          </Button>
        </div>
      </div>

      <div className="rounded-lg border bg-card">
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead>Tarnija</TableHead>
              <TableHead>Fail</TableHead>
              <TableHead className="w-[120px]">Laetud</TableHead>
              <TableHead className="w-[100px] text-right">Ridu</TableHead>
              <TableHead className="w-[120px]">Staatus</TableHead>
              <TableHead className="w-[50px]" />
            </TableRow>
          </TableHeader>
          <TableBody>
            {hinnakirjad.length === 0 ? (
              <TableRow>
                <TableCell colSpan={6} className="py-10 text-center text-muted-foreground">
                  Ühtegi hinnakirja pole veel üles laetud. Klõpsa &quot;Uus hinnakiri&quot;.
                </TableCell>
              </TableRow>
            ) : (
              hinnakirjad.map((h) => (
                <TableRow key={h.id}>
                  <TableCell className="font-medium">
                    <Link href={`/hinnakirjad/${h.id}`} className="text-vk-blue hover:underline">
                      {h.tarnija}
                    </Link>
                  </TableCell>
                  <TableCell>
                    <div className="flex items-center gap-2 text-sm">
                      <FileText className="h-4 w-4 text-muted-foreground" />
                      <span className="truncate">{h.faili_nimi ?? h.faili_path}</span>
                      <span className="rounded bg-muted px-1.5 py-0.5 text-xs uppercase">{h.faili_tüüp}</span>
                    </div>
                  </TableCell>
                  <TableCell className="font-mono text-xs">{formatDate(h.laetud_kuupäev)}</TableCell>
                  <TableCell className="text-right font-mono text-xs">{h.artiklite_arv}</TableCell>
                  <TableCell>
                    <StaatuseBadge s={h.staatus} />
                  </TableCell>
                  <TableCell className="text-right">
                    <KustutaHinnakiriNupp
                      hinnakirjaId={h.id}
                      tarnijaNimi={h.tarnija}
                      ridade_arv={h.artiklite_arv ?? 0}
                      variant="icon"
                    />
                  </TableCell>
                </TableRow>
              ))
            )}
          </TableBody>
        </Table>
      </div>
    </div>
  );
}
