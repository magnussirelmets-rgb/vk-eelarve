import Link from "next/link";
import { notFound } from "next/navigation";
import { getServerSupabase } from "@/lib/supabase/server";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { ArrowLeft, Building2, FileText, Home } from "lucide-react";
import type { Klient, Objekt, Pakkumine } from "@/lib/types";
import {
  KLIENDI_TÜÜP_LABEL,
  HOONE_TÜÜP_LABEL,
  PAKKUMISE_STAATUS_LABEL,
} from "@/lib/types";
import { formatDate } from "@/lib/utils";
import { MuudaKlientForm } from "./muuda-klient-form";
import { LisaObjektDialog } from "./lisa-objekt-dialog";

export const dynamic = "force-dynamic";
export const revalidate = 0;

export default async function KliendiDetailPage({
  params,
}: {
  params: { id: string };
}) {
  const sb = getServerSupabase();
  const [{ data: klient }, { data: objektid }, { data: pakkumised }] = await Promise.all([
    sb.from("kliendid").select("*").eq("id", params.id).maybeSingle(),
    sb
      .from("objektid")
      .select("*")
      .eq("klient_id", params.id)
      .order("nimi", { ascending: true }),
    sb
      .from("pakkumised")
      .select("id, vkp_nr, objekt, projekti_nr, pakkumise_kuupäev, staatus, objekt_id")
      .eq("klient_id", params.id)
      .order("loodud", { ascending: false }),
  ]);

  if (!klient) notFound();
  const k = klient as unknown as Klient;
  const oList = (objektid ?? []) as unknown as Objekt[];
  const pList = (pakkumised ?? []) as unknown as Array<
    Pick<Pakkumine, "id" | "vkp_nr" | "objekt" | "projekti_nr" | "pakkumise_kuupäev" | "staatus" | "objekt_id">
  >;

  // Loendurid objekti kohta
  const pakkPerObjekt = new Map<string, number>();
  for (const p of pList) {
    if (p.objekt_id) pakkPerObjekt.set(p.objekt_id, (pakkPerObjekt.get(p.objekt_id) ?? 0) + 1);
  }

  return (
    <div className="space-y-6">
      <Button asChild variant="ghost" size="sm" className="-ml-2">
        <Link href="/kliendid">
          <ArrowLeft className="h-4 w-4" />
          Tagasi kliendid
        </Link>
      </Button>

      <div className="flex flex-wrap items-start justify-between gap-3">
        <div>
          <div className="flex flex-wrap items-center gap-2">
            <h1 className="text-3xl font-bold tracking-tight text-vk-navy">{k.nimi}</h1>
            <Badge variant={k.tüüp === "juriidiline" ? "blue" : "secondary"}>
              {KLIENDI_TÜÜP_LABEL[k.tüüp]}
            </Badge>
            {k.km_kohustuslane ? <Badge variant="secondary">KM-kohustuslane</Badge> : null}
          </div>
          <div className="mt-2 flex flex-wrap items-center gap-3 text-sm text-muted-foreground">
            {k.telefon ? <span>{k.telefon}</span> : null}
            {k.email ? <span>· {k.email}</span> : null}
            {k.registrikood ? <span>· RK {k.registrikood}</span> : null}
            {k.km_nr ? <span>· KMK {k.km_nr}</span> : null}
          </div>
        </div>
      </div>

      <Card>
        <CardHeader>
          <CardTitle>Kliendi seaded</CardTitle>
          <CardDescription>
            Salvestatud kontaktid ja arvelduse info. Kustutamise korral kustuvad ka kõik tema
            objektid (CASCADE); pakkumised säilivad aga kaotavad klient_id seose.
          </CardDescription>
        </CardHeader>
        <CardContent>
          <MuudaKlientForm klient={k} />
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <div className="flex flex-wrap items-start justify-between gap-3">
            <div>
              <CardTitle className="flex items-center gap-2">
                <Building2 className="h-4 w-4" /> Objektid
                <span className="text-sm font-normal text-muted-foreground">({oList.length})</span>
              </CardTitle>
              <CardDescription>
                Konkreetsed aadressid + projektid mis kuuluvad kliendile.
              </CardDescription>
            </div>
            <LisaObjektDialog klientId={k.id} />
          </div>
        </CardHeader>
        <CardContent className="p-0">
          {oList.length === 0 ? (
            <div className="px-6 pb-6 text-sm text-muted-foreground">
              Ühtegi objekti pole loodud. Klõpsa &quot;Lisa objekt&quot;.
            </div>
          ) : (
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Nimi</TableHead>
                  <TableHead className="w-[120px]">Tüüp</TableHead>
                  <TableHead>Aadress</TableHead>
                  <TableHead className="w-[110px]">Projekt</TableHead>
                  <TableHead className="w-[100px] text-right">Pakkumisi</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {oList.map((o) => (
                  <TableRow key={o.id}>
                    <TableCell className="font-medium">
                      <Link href={`/objektid/${o.id}`} className="text-vk-blue hover:underline">
                        {o.nimi}
                      </Link>
                    </TableCell>
                    <TableCell className="text-xs">
                      {o.hoone_tüüp ? HOONE_TÜÜP_LABEL[o.hoone_tüüp] : "—"}
                    </TableCell>
                    <TableCell className="text-xs text-muted-foreground">
                      {o.aadress ?? "—"}
                    </TableCell>
                    <TableCell className="font-mono text-xs">{o.projekti_nr ?? "—"}</TableCell>
                    <TableCell className="text-right font-mono text-xs">
                      {pakkPerObjekt.get(o.id) ?? 0}
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          )}
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <FileText className="h-4 w-4" /> Pakkumised
            <span className="text-sm font-normal text-muted-foreground">({pList.length})</span>
          </CardTitle>
          <CardDescription>
            Kõik selle kliendi pakkumised (kõikide objektide alt). Aja-järjekorras.
          </CardDescription>
        </CardHeader>
        <CardContent className="p-0">
          {pList.length === 0 ? (
            <div className="px-6 pb-6 text-sm text-muted-foreground">
              Ühtegi pakkumist pole sellele kliendile veel tehtud.
            </div>
          ) : (
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead className="w-[130px]">VKP nr</TableHead>
                  <TableHead>Objekt</TableHead>
                  <TableHead className="w-[110px]">Projekt</TableHead>
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
                    <TableCell className="font-mono text-xs">{p.projekti_nr ?? "—"}</TableCell>
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
