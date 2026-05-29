import Link from "next/link";
import { notFound } from "next/navigation";
import { getServerSupabase } from "@/lib/supabase/server";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { ArrowLeft, FileText } from "lucide-react";
import type { Klient, Objekt, Pakkumine } from "@/lib/types";
import { HOONE_TÜÜP_LABEL, PAKKUMISE_STAATUS_LABEL } from "@/lib/types";
import { formatDate } from "@/lib/utils";
import { MuudaObjektForm } from "./muuda-objekt-form";

export const dynamic = "force-dynamic";
export const revalidate = 0;

export default async function ObjektiDetailPage({
  params,
}: {
  params: { id: string };
}) {
  const sb = getServerSupabase();
  const [{ data: objekt }, { data: pakkumised }] = await Promise.all([
    sb.from("objektid").select("*").eq("id", params.id).maybeSingle(),
    sb
      .from("pakkumised")
      .select("id, vkp_nr, objekt, pakkumise_kuupäev, staatus, mall")
      .eq("objekt_id", params.id)
      .order("loodud", { ascending: false }),
  ]);

  if (!objekt) notFound();
  const o = objekt as unknown as Objekt;
  const pList = (pakkumised ?? []) as unknown as Array<
    Pick<Pakkumine, "id" | "vkp_nr" | "objekt" | "pakkumise_kuupäev" | "staatus" | "mall">
  >;

  // Lae klient breadcrumb'i jaoks
  const { data: klient } = await sb
    .from("kliendid")
    .select("id, nimi, tüüp")
    .eq("id", o.klient_id)
    .maybeSingle();
  const k = klient as unknown as Pick<Klient, "id" | "nimi" | "tüüp"> | null;

  return (
    <div className="space-y-6">
      <div className="flex items-center gap-2">
        <Button asChild variant="ghost" size="sm" className="-ml-2">
          <Link href={k ? `/kliendid/${k.id}` : "/kliendid"}>
            <ArrowLeft className="h-4 w-4" />
            {k ? `Tagasi ${k.nimi}` : "Tagasi kliendid"}
          </Link>
        </Button>
      </div>

      <div className="space-y-2">
        <div className="flex flex-wrap items-center gap-2">
          <h1 className="text-3xl font-bold tracking-tight text-vk-navy">{o.nimi}</h1>
          {o.hoone_tüüp ? (
            <Badge variant="secondary">{HOONE_TÜÜP_LABEL[o.hoone_tüüp]}</Badge>
          ) : null}
        </div>
        <div className="flex flex-wrap items-center gap-3 text-sm text-muted-foreground">
          {k ? (
            <Link href={`/kliendid/${k.id}`} className="hover:underline">
              {k.nimi}
            </Link>
          ) : (
            <span>(klient eemaldatud)</span>
          )}
          {o.aadress ? <span>· {o.aadress}</span> : null}
          {o.projekti_nr ? <span>· Projekt {o.projekti_nr}</span> : null}
        </div>
      </div>

      <Card>
        <CardHeader>
          <CardTitle>Objekti seaded</CardTitle>
          <CardDescription>
            Korterite/korruste arv ja pindala kantakse pakkumise loomisel skaalategurite
            vaikeväärtuseks (kortermaja mall). Kustutamine säilitab pakkumised (objekt_id
            NULLitakse).
          </CardDescription>
        </CardHeader>
        <CardContent>
          <MuudaObjektForm objekt={o} />
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <FileText className="h-4 w-4" /> Pakkumised
            <span className="text-sm font-normal text-muted-foreground">({pList.length})</span>
          </CardTitle>
          <CardDescription>
            Kõik selle objekti pakkumised — aja-järjekorras (uusimad esmajoones).
          </CardDescription>
        </CardHeader>
        <CardContent className="p-0">
          {pList.length === 0 ? (
            <div className="px-6 pb-6 text-sm text-muted-foreground">
              Ühtegi pakkumist pole sellele objektile veel tehtud.
            </div>
          ) : (
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead className="w-[130px]">VKP nr</TableHead>
                  <TableHead>Pealkiri</TableHead>
                  <TableHead className="w-[110px]">Kuupäev</TableHead>
                  <TableHead className="w-[110px]">Staatus</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {pList.map((p) => (
                  <TableRow key={p.id}>
                    <TableCell className="font-mono text-xs">
                      <Link href={`/pakkumised/${p.id}`} className="text-vk-blue hover:underline">
                        {p.vkp_nr}
                      </Link>
                    </TableCell>
                    <TableCell className="text-sm">{p.objekt ?? "—"}</TableCell>
                    <TableCell className="text-xs">{formatDate(p.pakkumise_kuupäev)}</TableCell>
                    <TableCell>
                      <Badge variant="secondary">{PAKKUMISE_STAATUS_LABEL[p.staatus]}</Badge>
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          )}
        </CardContent>
      </Card>
    </div>
  );
}
