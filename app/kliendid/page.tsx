import Link from "next/link";
import { getServerSupabase } from "@/lib/supabase/server";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Plus, Users, Building2, Home } from "lucide-react";
import type { Klient, KliendiTüüp } from "@/lib/types";
import { KLIENDI_TÜÜP_LABEL } from "@/lib/types";

export const dynamic = "force-dynamic";
export const revalidate = 0;

type Filter = KliendiTüüp | "koik";

function isFilter(s: string | undefined): s is Filter {
  return s === "eraisik" || s === "juriidiline" || s === "koik";
}

export default async function KliendidPage({
  searchParams,
}: {
  searchParams: { tüüp?: string };
}) {
  const active: Filter = isFilter(searchParams.tüüp) ? searchParams.tüüp : "koik";
  const sb = getServerSupabase();
  const [{ data: kData }, { data: objektidData }, { data: pakkData }] = await Promise.all([
    sb.from("kliendid").select("*").order("nimi", { ascending: true }),
    sb.from("objektid").select("klient_id"),
    sb.from("pakkumised").select("klient_id").not("klient_id", "is", null),
  ]);
  const allList = (kData ?? []) as unknown as Klient[];

  const objektCount = new Map<string, number>();
  for (const o of (objektidData ?? []) as Array<{ klient_id: string }>) {
    objektCount.set(o.klient_id, (objektCount.get(o.klient_id) ?? 0) + 1);
  }
  const pakkCount = new Map<string, number>();
  for (const p of (pakkData ?? []) as Array<{ klient_id: string }>) {
    pakkCount.set(p.klient_id, (pakkCount.get(p.klient_id) ?? 0) + 1);
  }

  const filtered = active === "koik" ? allList : allList.filter((k) => k.tüüp === active);
  const eraisikuid = allList.filter((k) => k.tüüp === "eraisik").length;
  const juriidilisi = allList.filter((k) => k.tüüp === "juriidiline").length;

  return (
    <div className="space-y-6">
      <div className="flex flex-wrap items-center justify-between gap-4">
        <div>
          <h1 className="text-3xl font-bold tracking-tight text-vk-navy">Kliendid</h1>
          <p className="text-sm text-muted-foreground">
            Eraisikud ja juriidilised isikud. Ühe kliendi alla võivad kuuluda mitu objekti, igal
            objektil mitu pakkumist.
          </p>
        </div>
        <Button asChild variant="primary">
          <Link href="/kliendid/uus">
            <Plus className="h-4 w-4" />
            Uus klient
          </Link>
        </Button>
      </div>

      <div className="flex flex-wrap gap-2">
        <FilterChip href="/kliendid?tüüp=koik" active={active === "koik"}>
          Kõik ({allList.length})
        </FilterChip>
        <FilterChip href="/kliendid?tüüp=eraisik" active={active === "eraisik"} icon={<Home className="h-3 w-3" />}>
          Eraisikud ({eraisikuid})
        </FilterChip>
        <FilterChip
          href="/kliendid?tüüp=juriidiline"
          active={active === "juriidiline"}
          icon={<Building2 className="h-3 w-3" />}
        >
          Juriidilised ({juriidilisi})
        </FilterChip>
      </div>

      <div className="rounded-lg border bg-card">
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead>Nimi</TableHead>
              <TableHead className="w-[110px]">Tüüp</TableHead>
              <TableHead>Kontakt</TableHead>
              <TableHead className="w-[100px] text-right">Objekte</TableHead>
              <TableHead className="w-[110px] text-right">Pakkumisi</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {filtered.length === 0 ? (
              <TableRow>
                <TableCell colSpan={5} className="py-10 text-center text-muted-foreground">
                  <div className="flex flex-col items-center gap-2">
                    <Users className="h-8 w-8 text-muted-foreground/40" />
                    {active === "koik"
                      ? "Ühtegi klienti pole loodud."
                      : `Ühtegi ${active === "eraisik" ? "eraisikut" : "juriidilist isikut"} pole.`}
                  </div>
                </TableCell>
              </TableRow>
            ) : (
              filtered.map((k) => (
                <TableRow key={k.id}>
                  <TableCell className="font-medium">
                    <Link href={`/kliendid/${k.id}`} className="text-vk-blue hover:underline">
                      {k.nimi}
                    </Link>
                    {k.registrikood ? (
                      <span className="ml-2 font-mono text-[10px] text-muted-foreground">
                        rk {k.registrikood}
                      </span>
                    ) : null}
                  </TableCell>
                  <TableCell>
                    <Badge variant={k.tüüp === "juriidiline" ? "blue" : "secondary"}>
                      {KLIENDI_TÜÜP_LABEL[k.tüüp]}
                    </Badge>
                  </TableCell>
                  <TableCell className="text-xs text-muted-foreground">
                    {k.telefon ? <span>{k.telefon}</span> : null}
                    {k.telefon && k.email ? <span> · </span> : null}
                    {k.email ? <span>{k.email}</span> : null}
                    {!k.telefon && !k.email ? <span>—</span> : null}
                  </TableCell>
                  <TableCell className="text-right font-mono text-xs">{objektCount.get(k.id) ?? 0}</TableCell>
                  <TableCell className="text-right font-mono text-xs">{pakkCount.get(k.id) ?? 0}</TableCell>
                </TableRow>
              ))
            )}
          </TableBody>
        </Table>
      </div>
    </div>
  );
}

function FilterChip({
  href,
  active,
  icon,
  children,
}: {
  href: string;
  active: boolean;
  icon?: React.ReactNode;
  children: React.ReactNode;
}) {
  return (
    <Link
      href={href}
      className={`inline-flex items-center gap-1.5 rounded-full border px-3 py-1 text-xs transition-colors ${
        active
          ? "border-vk-blue bg-vk-blue text-white"
          : "border-border bg-card text-muted-foreground hover:border-vk-blue/40 hover:text-foreground"
      }`}
    >
      {icon}
      {children}
    </Link>
  );
}
