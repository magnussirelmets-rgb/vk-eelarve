import Link from "next/link";
import { getServerSupabase } from "@/lib/supabase/server";
import { Button } from "@/components/ui/button";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Plus } from "lucide-react";
import type { Tootegrupp } from "@/lib/types";
import { formatNum } from "@/lib/utils";

export const dynamic = "force-dynamic";
export const revalidate = 0;

export default async function TeenusedPage() {
  const sb = getServerSupabase();
  const [{ data: grupid }, { data: members }] = await Promise.all([
    sb.from("tootegrupid").select("*").order("nimi", { ascending: true }),
    sb.from("hinnakirja_read").select("tootegrupp_id").not("tootegrupp_id", "is", null),
  ]);
  const list = (grupid ?? []) as unknown as Tootegrupp[];
  const counts = new Map<string, number>();
  for (const m of (members ?? []) as Array<{ tootegrupp_id: string | null }>) {
    if (m.tootegrupp_id) counts.set(m.tootegrupp_id, (counts.get(m.tootegrupp_id) ?? 0) + 1);
  }

  return (
    <div className="space-y-6">
      <div className="flex flex-wrap items-center justify-between gap-4">
        <div>
          <h1 className="text-3xl font-bold tracking-tight text-vk-navy">Teenused</h1>
          <p className="text-sm text-muted-foreground">
            Viru Küte enda teenused — paigaldus, hooldus, komplekttööd, soojuspumba paigaldus jne.
            Iga teenusel paigaldusaeg ja kate-koefitsient mis kanduvad seotud toodete pakkumise
            arvutusele.
          </p>
        </div>
        <Button asChild variant="primary">
          <Link href="/grupid/uus">
            <Plus className="h-4 w-4" />
            Uus teenus
          </Link>
        </Button>
      </div>

      <div className="rounded-lg border bg-card">
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead>Nimi</TableHead>
              <TableHead>Kirjeldus</TableHead>
              <TableHead className="w-[100px] text-right">Seotud tooteid</TableHead>
              <TableHead className="w-[120px] text-right">Paigald. aeg</TableHead>
              <TableHead className="w-[120px] text-right">Kate (override)</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {list.length === 0 ? (
              <TableRow>
                <TableCell colSpan={5} className="py-10 text-center text-muted-foreground">
                  Ühtegi teenust pole loodud. Loo esimene paigaldus-/hooldusteenus.
                </TableCell>
              </TableRow>
            ) : (
              list.map((g) => (
                <TableRow key={g.id}>
                  <TableCell className="font-medium">
                    <Link href={`/grupid/${g.id}`} className="text-vk-blue hover:underline">
                      {g.nimi}
                    </Link>
                  </TableCell>
                  <TableCell className="text-sm text-muted-foreground">{g.kirjeldus ?? "—"}</TableCell>
                  <TableCell className="text-right font-mono text-xs">{counts.get(g.id) ?? 0}</TableCell>
                  <TableCell className="text-right font-mono text-xs">
                    {g.paigaldusaeg_h_ühik === null ? "—" : `${formatNum(g.paigaldusaeg_h_ühik)} h`}
                  </TableCell>
                  <TableCell className="text-right font-mono text-xs">
                    {g.kate_koefitsient_override === null ? "—" : `${g.kate_koefitsient_override.toFixed(2)}×`}
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
