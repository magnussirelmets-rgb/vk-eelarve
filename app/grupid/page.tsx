import Link from "next/link";
import { getServerSupabase } from "@/lib/supabase/server";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Plus, Package, Wrench } from "lucide-react";
import type { Tootegrupp, TootegrupiTüüp } from "@/lib/types";
import { formatNum } from "@/lib/utils";

export const dynamic = "force-dynamic";
export const revalidate = 0;

type Filter = TootegrupiTüüp | "koik";

function isFilter(s: string | undefined): s is Filter {
  return s === "toode" || s === "teenus" || s === "koik";
}

export default async function GrupidPage({
  searchParams,
}: {
  searchParams: { tüüp?: string };
}) {
  const tabRaw = searchParams.tüüp;
  const active: Filter = isFilter(tabRaw) ? tabRaw : "toode";

  const sb = getServerSupabase();
  const [{ data: grupid }, { data: members }] = await Promise.all([
    sb.from("tootegrupid").select("*").order("nimi", { ascending: true }),
    sb.from("hinnakirja_read").select("tootegrupp_id").not("tootegrupp_id", "is", null),
  ]);
  const allList = (grupid ?? []) as unknown as Tootegrupp[];
  const counts = new Map<string, number>();
  for (const m of (members ?? []) as Array<{ tootegrupp_id: string | null }>) {
    if (m.tootegrupp_id) counts.set(m.tootegrupp_id, (counts.get(m.tootegrupp_id) ?? 0) + 1);
  }

  const filtered = active === "koik" ? allList : allList.filter((g) => g.tüüp === active);
  const tootedCount = allList.filter((g) => g.tüüp === "toode").length;
  const teenusedCount = allList.filter((g) => g.tüüp === "teenus").length;

  const heading = active === "toode" ? "Tootegrupid" : active === "teenus" ? "Teenused" : "Kõik grupid";
  const description =
    active === "toode"
      ? "Seadme-mudelite grupid (nt Alpha Innotec SWC V-Line). Ühe grupi template_kirjeldus rakendub kõikidele mudelitele — ei pea iga mudeli kirjeldust eraldi sisestama."
      : active === "teenus"
        ? "Viru Küte enda teenused — paigaldus, hooldus, komplekttööd. Iga teenusel paigaldusaeg ja kate-koefitsient mis kanduvad seotud toodete pakkumise arvutusele."
        : "Kõik tootegrupid ja teenused.";
  const uusHref = active === "teenus" ? "/grupid/uus?tüüp=teenus" : "/grupid/uus?tüüp=toode";
  const uusLabel = active === "teenus" ? "Uus teenus" : "Uus tootegrupp";

  return (
    <div className="space-y-6">
      <div className="flex flex-wrap items-center justify-between gap-4">
        <div>
          <h1 className="text-3xl font-bold tracking-tight text-vk-navy">{heading}</h1>
          <p className="text-sm text-muted-foreground">{description}</p>
        </div>
        <Button asChild variant="primary">
          <Link href={uusHref}>
            <Plus className="h-4 w-4" />
            {uusLabel}
          </Link>
        </Button>
      </div>

      <div className="flex flex-wrap gap-2">
        <FilterChip href="/grupid?tüüp=toode" active={active === "toode"} icon={<Package className="h-3 w-3" />}>
          Tooted ({tootedCount})
        </FilterChip>
        <FilterChip href="/grupid?tüüp=teenus" active={active === "teenus"} icon={<Wrench className="h-3 w-3" />}>
          Teenused ({teenusedCount})
        </FilterChip>
        <FilterChip href="/grupid?tüüp=koik" active={active === "koik"}>
          Kõik ({allList.length})
        </FilterChip>
      </div>

      <div className="rounded-lg border bg-card">
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead>Nimi</TableHead>
              {active === "koik" ? <TableHead className="w-[80px]">Tüüp</TableHead> : null}
              <TableHead>Kirjeldus / template</TableHead>
              <TableHead className="w-[100px] text-right">Seotud tooteid</TableHead>
              {active !== "teenus" ? (
                <TableHead className="w-[80px] text-right">Garantii</TableHead>
              ) : null}
              <TableHead className="w-[120px] text-right">Paigald. aeg</TableHead>
              <TableHead className="w-[120px] text-right">Kate (override)</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {filtered.length === 0 ? (
              <TableRow>
                <TableCell colSpan={7} className="py-10 text-center text-muted-foreground">
                  {active === "toode"
                    ? "Tootegruppe pole. Loo esimene — nt 'Alpha Innotec SWC V-Line' kõikide SWC mudelite jaoks."
                    : active === "teenus"
                      ? "Ühtegi teenust pole loodud. Loo esimene paigaldus-/hooldusteenus."
                      : "Ühtegi gruppi pole."}
                </TableCell>
              </TableRow>
            ) : (
              filtered.map((g) => (
                <TableRow key={g.id}>
                  <TableCell className="font-medium">
                    <Link href={`/grupid/${g.id}`} className="text-vk-blue hover:underline">
                      {g.nimi}
                    </Link>
                  </TableCell>
                  {active === "koik" ? (
                    <TableCell>
                      <Badge variant={g.tüüp === "toode" ? "blue" : "secondary"}>
                        {g.tüüp === "toode" ? "Toode" : "Teenus"}
                      </Badge>
                    </TableCell>
                  ) : null}
                  <TableCell className="text-sm text-muted-foreground">
                    {g.template_kirjeldus ? (
                      <span className="line-clamp-1 italic">{g.template_kirjeldus}</span>
                    ) : (
                      g.kirjeldus ?? "—"
                    )}
                  </TableCell>
                  <TableCell className="text-right font-mono text-xs">{counts.get(g.id) ?? 0}</TableCell>
                  {active !== "teenus" ? (
                    <TableCell className="text-right font-mono text-xs">
                      {g.garantii_aastad === null ? "—" : `${g.garantii_aastad}a`}
                    </TableCell>
                  ) : null}
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
