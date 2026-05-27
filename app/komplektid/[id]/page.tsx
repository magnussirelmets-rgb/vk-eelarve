import Link from "next/link";
import { notFound } from "next/navigation";
import { getServerSupabase } from "@/lib/supabase/server";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { formatEur, formatNum, formatDate } from "@/lib/utils";
import type { Komplekt, KomplektiRida } from "@/lib/types";
import { ArrowLeft, Package } from "lucide-react";
import { KomplektiKustutaNupp } from "./kustuta-nupp";
import { KomplektiRidaActions } from "./rida-actions";
import { VaikeEriosaForm } from "./vaike-eriosa-form";

export const dynamic = "force-dynamic";
export const revalidate = 0;

export default async function KomplektDetailPage({ params }: { params: { id: string } }) {
  const sb = getServerSupabase();
  const [{ data: kpData }, { data: rrData }] = await Promise.all([
    sb.from("komplektid").select("*").eq("id", params.id).maybeSingle(),
    sb
      .from("komplekti_read")
      .select("*")
      .eq("komplekt_id", params.id)
      .order("järjekord", { ascending: true }),
  ]);
  if (!kpData) notFound();

  const k = kpData as unknown as Komplekt;
  const read = (rrData ?? []) as unknown as KomplektiRida[];

  const materjalKokku = read.reduce(
    (s, r) => s + (r.kogus ?? 0) * (r.ostuhind_snapshot ?? 0),
    0,
  );
  const tööH = read.reduce(
    (s, r) => s + (r.kogus ?? 0) * (r.paigaldusaeg_h_ühik_snapshot ?? 0),
    0,
  );

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <Button asChild variant="ghost" size="sm" className="-ml-2">
          <Link href="/komplektid">
            <ArrowLeft className="h-4 w-4" />
            Tagasi komplektid
          </Link>
        </Button>
        <KomplektiKustutaNupp komplektId={k.id} komplektNimi={k.nimi} />
      </div>

      <div className="space-y-2">
        <div className="flex flex-wrap items-center gap-2">
          <Package className="h-5 w-5 text-vk-navy" />
          <h1 className="text-2xl font-bold tracking-tight text-vk-navy">{k.nimi}</h1>
          <span className="rounded bg-muted px-2 py-0.5 text-xs">{k.ühik}</span>
        </div>
        {k.kirjeldus ? <p className="text-sm text-muted-foreground">{k.kirjeldus}</p> : null}
        {k.vaike_sektsioon ? (
          <div className="flex items-center gap-1 text-xs">
            <span className="text-muted-foreground">Vaike-eriosa:</span>
            <span className="rounded bg-vk-blue/10 px-1.5 py-0.5 font-mono text-vk-blue">
              {k.vaike_sektsioon}
              {k.vaike_alamsektsioon ? ` · ${k.vaike_alamsektsioon}` : ""}
            </span>
          </div>
        ) : null}
        <p className="text-xs text-muted-foreground">Loodud {formatDate(k.loodud)}</p>
      </div>

      <VaikeEriosaForm
        komplektId={k.id}
        algneSektsioon={k.vaike_sektsioon}
        algneAlamsektsioon={k.vaike_alamsektsioon}
      />

      <div className="grid gap-3 sm:grid-cols-3">
        <div className="rounded-lg border bg-card p-4">
          <div className="text-xs uppercase tracking-wide text-muted-foreground">Ridu</div>
          <div className="mt-1 font-mono text-2xl font-semibold text-vk-navy">{read.length}</div>
        </div>
        <div className="rounded-lg border bg-card p-4">
          <div className="text-xs uppercase tracking-wide text-muted-foreground">Materjali ostuhind kokku</div>
          <div className="mt-1 font-mono text-lg font-semibold text-vk-navy">{formatEur(materjalKokku)}</div>
        </div>
        <div className="rounded-lg border bg-card p-4">
          <div className="text-xs uppercase tracking-wide text-muted-foreground">Paigaldusaeg kokku</div>
          <div className="mt-1 font-mono text-lg font-semibold text-vk-navy">
            {tööH > 0 ? `${formatNum(tööH)} h` : "—"}
          </div>
        </div>
      </div>

      <Card>
        <CardHeader>
          <CardTitle>Komplekti read</CardTitle>
          <CardDescription>
            Tooted/teenused mis kuuluvad sellesse komplekti. Vajadusel saad muuta kogust või rea
            kustutada.
          </CardDescription>
        </CardHeader>
        <CardContent className="p-0">
          {read.length === 0 ? (
            <div className="px-6 pb-6 text-sm text-muted-foreground">
              Komplektis pole ridu.
            </div>
          ) : (
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead className="w-[40px]">#</TableHead>
                  <TableHead className="w-[100px]">Tarnija</TableHead>
                  <TableHead className="w-[110px]">Kood</TableHead>
                  <TableHead>Nimetus</TableHead>
                  <TableHead className="w-[100px] text-right">Ostuhind</TableHead>
                  <TableHead className="w-[80px] text-right">Aeg h/üh</TableHead>
                  <TableHead className="w-[100px]">Kogus</TableHead>
                  <TableHead className="w-[100px] text-right">Materjal €</TableHead>
                  <TableHead className="w-[80px]"></TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {read.map((r) => {
                  const materjal = (r.kogus ?? 0) * (r.ostuhind_snapshot ?? 0);
                  return (
                    <TableRow key={r.id}>
                      <TableCell className="font-mono text-xs">{r.järjekord}</TableCell>
                      <TableCell className="text-xs">{r.tarnija ?? "—"}</TableCell>
                      <TableCell className="font-mono text-xs">{r.tarnija_kood ?? "—"}</TableCell>
                      <TableCell>
                        <div className="text-sm">{r.nimetus}</div>
                        <div className="flex flex-wrap gap-2 text-[10px] text-muted-foreground">
                          {r.tähis ? <span className="font-mono">{r.tähis}</span> : null}
                          {r.tarnija_brand ? <span>· {r.tarnija_brand}</span> : null}
                        </div>
                      </TableCell>
                      <TableCell className="text-right font-mono text-xs">{formatEur(r.ostuhind_snapshot)}</TableCell>
                      <TableCell className="text-right font-mono text-xs">
                        {r.paigaldusaeg_h_ühik_snapshot === null ? "—" : formatNum(r.paigaldusaeg_h_ühik_snapshot)}
                      </TableCell>
                      <TableCell>
                        <KomplektiRidaActions reaId={r.id} algneKogus={r.kogus} ühik={r.ühik} />
                      </TableCell>
                      <TableCell className="text-right font-mono text-xs font-semibold">
                        {formatEur(materjal)}
                      </TableCell>
                      <TableCell>
                        <KomplektiRidaActions reaId={r.id} algneKogus={r.kogus} ühik={r.ühik} kustutaNupp />
                      </TableCell>
                    </TableRow>
                  );
                })}
              </TableBody>
            </Table>
          )}
        </CardContent>
      </Card>
    </div>
  );
}
