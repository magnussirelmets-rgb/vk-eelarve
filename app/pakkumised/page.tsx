import Link from "next/link";
import { getServerSupabase } from "@/lib/supabase/server";
import { Button } from "@/components/ui/button";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Badge } from "@/components/ui/badge";
import { PAKKUMISE_STAATUS_LABEL, type Pakkumine } from "@/lib/types";
import { formatDate } from "@/lib/utils";
import { Plus } from "lucide-react";
import { KustutaPakkumineNupp } from "./kustuta-nupp";

export const dynamic = "force-dynamic";
export const revalidate = 0;

function StaatuseBadge({ s }: { s: Pakkumine["staatus"] }) {
  const variant: "default" | "blue" | "red" | "secondary" =
    s === "võidetud" ? "blue" : s === "kaotatud" ? "red" : "secondary";
  return <Badge variant={variant}>{PAKKUMISE_STAATUS_LABEL[s]}</Badge>;
}

export default async function PakkumisedPage() {
  const sb = getServerSupabase();
  const { data, error } = await sb
    .from("pakkumised")
    .select("*")
    .order("loodud", { ascending: false })
    .limit(100);
  if (error) throw new Error(`Pakkumiste laadimine ebaõnnestus: ${error.message}`);
  const pakkumised = (data ?? []) as unknown as Pakkumine[];

  return (
    <div className="space-y-6">
      <div className="flex flex-wrap items-center justify-between gap-4">
        <div>
          <h1 className="text-3xl font-bold tracking-tight text-vk-navy">Pakkumised</h1>
          <p className="text-sm text-muted-foreground">
            {pakkumised.length} {pakkumised.length === 1 ? "pakkumine" : "pakkumist"} kokku
          </p>
        </div>
        <Button asChild variant="primary">
          <Link href="/pakkumised/uus">
            <Plus className="h-4 w-4" />
            Uus pakkumine
          </Link>
        </Button>
      </div>

      <div className="rounded-lg border bg-card">
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead className="w-[140px]">VKP nr</TableHead>
              <TableHead>Objekt</TableHead>
              <TableHead>Tellija</TableHead>
              <TableHead className="w-[120px]">Loodud</TableHead>
              <TableHead className="w-[160px]">Staatus</TableHead>
              <TableHead className="w-[60px]" />
            </TableRow>
          </TableHeader>
          <TableBody>
            {pakkumised.length === 0 ? (
              <TableRow>
                <TableCell colSpan={6} className="py-10 text-center text-muted-foreground">
                  Ühtegi pakkumist pole veel loodud. Klõpsa &quot;Uus pakkumine&quot;.
                </TableCell>
              </TableRow>
            ) : (
              pakkumised.map((p) => (
                <TableRow key={p.id}>
                  <TableCell className="font-mono text-xs">
                    <Link href={`/pakkumised/${p.id}`} className="text-vk-blue hover:underline">
                      {p.vkp_nr}
                    </Link>
                  </TableCell>
                  <TableCell>{p.objekt ?? "—"}</TableCell>
                  <TableCell className="text-sm text-muted-foreground">
                    {p.tellija_nimi ?? "—"}
                  </TableCell>
                  <TableCell className="font-mono text-xs">{formatDate(p.loodud)}</TableCell>
                  <TableCell>
                    <StaatuseBadge s={p.staatus} />
                  </TableCell>
                  <TableCell className="text-right">
                    <KustutaPakkumineNupp pakkumineId={p.id} vkpNr={p.vkp_nr} variant="icon" />
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
