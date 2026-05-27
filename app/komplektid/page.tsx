import Link from "next/link";
import { getServerSupabase } from "@/lib/supabase/server";
import { Button } from "@/components/ui/button";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { formatDate, formatEur, formatNum } from "@/lib/utils";
import type { Komplekt } from "@/lib/types";
import { Package } from "lucide-react";

export const dynamic = "force-dynamic";
export const revalidate = 0;

export default async function KomplektidPage() {
  const sb = getServerSupabase();
  const [{ data: komplektid }, { data: read }] = await Promise.all([
    sb.from("komplektid").select("*").order("nimi", { ascending: true }),
    sb.from("komplekti_read").select("*"),
  ]);
  const list = (komplektid ?? []) as unknown as Komplekt[];

  // Arvuta iga komplekti: ridade arv + materjali summa
  type Stat = { read: number; materjal: number; töö_h: number };
  const stats = new Map<string, Stat>();
  for (const r of (read ?? []) as unknown as Array<{
    komplekt_id: string;
    kogus: number;
    ostuhind_snapshot: number | null;
    paigaldusaeg_h_ühik_snapshot: number | null;
  }>) {
    const prev = stats.get(r.komplekt_id) ?? { read: 0, materjal: 0, töö_h: 0 };
    prev.read += 1;
    prev.materjal += (r.kogus ?? 0) * (r.ostuhind_snapshot ?? 0);
    prev.töö_h += (r.kogus ?? 0) * (r.paigaldusaeg_h_ühik_snapshot ?? 0);
    stats.set(r.komplekt_id, prev);
  }

  return (
    <div className="space-y-6">
      <div className="flex flex-wrap items-center justify-between gap-4">
        <div>
          <h1 className="text-3xl font-bold tracking-tight text-vk-navy">Komplektid</h1>
          <p className="text-sm text-muted-foreground">
            Korduvkasutatavad toodete kogumikud (radiaatori paigalduskomplekt, veemõõtja
            komplekt, käterätikuivati komplekt jne). Loo komplekt valides hinnakirja read,
            lisa hiljem pakkumistele ühe klikiga.
          </p>
        </div>
      </div>

      <div className="rounded-lg border bg-card">
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead>Nimi</TableHead>
              <TableHead className="w-[120px]">Ühik</TableHead>
              <TableHead className="w-[80px] text-right">Read</TableHead>
              <TableHead className="w-[140px] text-right">Materjal (ostu)</TableHead>
              <TableHead className="w-[140px] text-right">Töö (h)</TableHead>
              <TableHead className="w-[120px]">Loodud</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {list.length === 0 ? (
              <TableRow>
                <TableCell colSpan={6} className="py-10 text-center text-muted-foreground">
                  Ühtegi komplekti pole loodud. Mine{" "}
                  <Link href="/hinnakirjad" className="text-vk-blue hover:underline">
                    hinnakirja lehele
                  </Link>{" "}
                  ja vali read linnukestega → &quot;Tee komplekt&quot;.
                </TableCell>
              </TableRow>
            ) : (
              list.map((k) => {
                const s = stats.get(k.id) ?? { read: 0, materjal: 0, töö_h: 0 };
                return (
                  <TableRow key={k.id}>
                    <TableCell className="font-medium">
                      <Link href={`/komplektid/${k.id}`} className="flex items-center gap-2 text-vk-blue hover:underline">
                        <Package className="h-4 w-4" />
                        {k.nimi}
                      </Link>
                      {k.kirjeldus ? (
                        <div className="text-xs text-muted-foreground">{k.kirjeldus}</div>
                      ) : null}
                    </TableCell>
                    <TableCell className="text-xs">{k.ühik}</TableCell>
                    <TableCell className="text-right font-mono text-xs">{s.read}</TableCell>
                    <TableCell className="text-right font-mono text-xs">{formatEur(s.materjal)}</TableCell>
                    <TableCell className="text-right font-mono text-xs">
                      {s.töö_h > 0 ? `${formatNum(s.töö_h)} h` : "—"}
                    </TableCell>
                    <TableCell className="font-mono text-xs">{formatDate(k.loodud)}</TableCell>
                  </TableRow>
                );
              })
            )}
          </TableBody>
        </Table>
      </div>
    </div>
  );
}
