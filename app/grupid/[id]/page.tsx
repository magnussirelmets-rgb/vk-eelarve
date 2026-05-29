import Link from "next/link";
import { notFound } from "next/navigation";
import { getServerSupabase } from "@/lib/supabase/server";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { ArrowLeft, Truck } from "lucide-react";
import type { Tootegrupp, HinnakirjaRidaKataloogis } from "@/lib/types";
import { formatEur, formatNum } from "@/lib/utils";
import { MuudaGruppForm } from "./muuda-grupp-form";
import { LisaNupp } from "./lisa-nupp";

export const dynamic = "force-dynamic";
export const revalidate = 0;

export default async function GrupiDetailPage({ params }: { params: { id: string } }) {
  const sb = getServerSupabase();
  const [{ data: grupp }, { data: members }] = await Promise.all([
    sb.from("tootegrupid").select("*").eq("id", params.id).maybeSingle(),
    sb
      .from("hinnakirja_read")
      .select("*, hinnakirjad(tarnija, faili_nimi)")
      .eq("tootegrupp_id", params.id)
      .neq("staatus", "ignoreeritud")
      .order("tarnija_nimetus", { ascending: true }),
  ]);

  if (!grupp) notFound();
  const g = grupp as unknown as Tootegrupp;
  const liikmed = (members ?? []) as unknown as HinnakirjaRidaKataloogis[];

  const backHref = g.tüüp === "teenus" ? "/grupid?tüüp=teenus" : "/grupid?tüüp=toode";
  const seadetelLabel = g.tüüp === "teenus" ? "Teenuse seaded" : "Tootegrupi seaded";
  const seadetelDescription =
    g.tüüp === "teenus"
      ? "Paigaldusaeg ja kate-koefitsient kanduvad automaatselt selle teenusega seotud toodetele pakkumise arvutusel. Iga toode võib siiski oma väärtuse üle kirjutada."
      : "Template kirjeldus + garantii rakenduvad kõikidele tootegrupi liikmetele. Iga rea mudel_andmed JSONB-st asendatakse placeholder'id ({kw}, {mudel}, {maht}).";

  return (
    <div className="space-y-6">
      <Button asChild variant="ghost" size="sm" className="-ml-2">
        <Link href={backHref}>
          <ArrowLeft className="h-4 w-4" />
          Tagasi grupid
        </Link>
      </Button>

      <div>
        <h1 className="text-3xl font-bold tracking-tight text-vk-navy">{g.nimi}</h1>
        {g.kirjeldus ? <p className="text-sm text-muted-foreground">{g.kirjeldus}</p> : null}
      </div>

      <Card>
        <CardHeader>
          <CardTitle>{seadetelLabel}</CardTitle>
          <CardDescription>{seadetelDescription}</CardDescription>
        </CardHeader>
        <CardContent>
          <MuudaGruppForm grupp={g} />
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <div className="flex flex-wrap items-start justify-between gap-3">
            <div>
              <CardTitle className="flex items-center gap-2">
                <Truck className="h-4 w-4" /> Seotud tooted
                <span className="text-sm font-normal text-muted-foreground">({liikmed.length})</span>
              </CardTitle>
              <CardDescription>
                Tooted hinnakirjadest, mis on selle teenusega seotud. Lisaks võid lisada käsitsi (nt
                erikujundatud teenuse-variandid) või linkida kataloogist linnukestega
                bulk-assignides (vt /kataloog).
              </CardDescription>
            </div>
            <LisaNupp grupId={g.id} grupNimi={g.nimi} grupTüüp={g.tüüp} />
          </div>
        </CardHeader>
        <CardContent className="p-0">
          {liikmed.length === 0 ? (
            <div className="px-6 pb-6 text-sm text-muted-foreground">
              Ühtegi toodet pole selle teenusega seotud.{" "}
              <Link href="/kataloog" className="text-vk-blue hover:underline">
                Mine kataloogi
              </Link>{" "}
              ja vali toodete linnukesed → bulk action &quot;Lisa teenusele…&quot;.
            </div>
          ) : (
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead className="w-[120px]">Tarnija</TableHead>
                  <TableHead className="w-[110px]">Kood</TableHead>
                  <TableHead>Nimetus</TableHead>
                  <TableHead className="w-[100px]">Brand</TableHead>
                  <TableHead className="w-[60px]">Ühik</TableHead>
                  <TableHead className="w-[100px] text-right">Ostuhind</TableHead>
                  <TableHead className="w-[130px] text-right">Paigald. (toode)</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {liikmed.map((m) => (
                  <TableRow key={m.id}>
                    <TableCell className="text-sm">{m.hinnakirjad?.tarnija ?? "—"}</TableCell>
                    <TableCell className="font-mono text-xs">{m.tarnija_kood ?? "—"}</TableCell>
                    <TableCell>
                      <Link href={`/kataloog/${m.id}`} className="hover:underline">
                        {m.tarnija_nimetus}
                      </Link>
                    </TableCell>
                    <TableCell className="text-xs">{m.tarnija_brand ?? "—"}</TableCell>
                    <TableCell className="text-xs">{m.ühik ?? "—"}</TableCell>
                    <TableCell className="text-right font-mono text-xs">{formatEur(m.ostuhind_neto)}</TableCell>
                    <TableCell className="text-right font-mono text-xs">
                      {m.paigaldusaeg_h_ühik === null ? (
                        <span className="text-muted-foreground" title="kasutab grupi vaikimisi">
                          {g.paigaldusaeg_h_ühik === null ? "—" : `${formatNum(g.paigaldusaeg_h_ühik)} h *`}
                        </span>
                      ) : (
                        `${formatNum(m.paigaldusaeg_h_ühik)} h`
                      )}
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          )}
          {liikmed.length > 0 && g.paigaldusaeg_h_ühik !== null ? (
            <div className="px-6 py-3 text-xs text-muted-foreground">
              * = kasutab grupi vaikimisi paigaldusaja ({formatNum(g.paigaldusaeg_h_ühik)} h/ühik), kuna tootel pole oma väärtust
            </div>
          ) : null}
        </CardContent>
      </Card>
    </div>
  );
}
