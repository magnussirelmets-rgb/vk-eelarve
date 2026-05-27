import Link from "next/link";
import { getServerSupabase } from "@/lib/supabase/server";
import { Button } from "@/components/ui/button";
import type { HinnakirjaRidaKataloogis, Tootegrupp } from "@/lib/types";
import { Upload } from "lucide-react";
import { SearchInput } from "./search-input";
import { TootedTabel } from "./tooted-tabel";
import { ImportExportPaneel } from "./import-export-paneel";
import { expandSearchQuery } from "@/lib/dimension-map";

export const dynamic = "force-dynamic";
export const revalidate = 0;

type SearchParams = { q?: string; tarnija?: string };

function escapeIlike(v: string) {
  return v.replace(/[%_,]/g, "\\$&");
}

export default async function KataloogPage({ searchParams }: { searchParams: SearchParams }) {
  const q = (searchParams.q ?? "").trim();
  const tarnijaFilter = (searchParams.tarnija ?? "").trim();
  const sb = getServerSupabase();

  let query = sb
    .from("hinnakirja_read")
    .select(
      "*, hinnakirjad(tarnija, faili_nimi, laetud_kuupäev, faili_tüüp), tootegrupid(id, nimi, paigaldusaeg_h_ühik, kate_koefitsient_override)",
    )
    .neq("staatus", "ignoreeritud")
    .order("uuendatud", { ascending: false })
    .limit(500);

  if (q) {
    // Laienda mõõdu-ekvivalentidega (DN32 ↔ 1 1/4 jne)
    const variants = expandSearchQuery(q);
    const orClauses = variants.flatMap((v) => {
      const e = escapeIlike(v);
      return [
        `tarnija_nimetus.ilike.%${e}%`,
        `tarnija_kood.ilike.%${e}%`,
        `tarnija_brand.ilike.%${e}%`,
        `magnus_alt_nimed.ilike.%${e}%`,
      ];
    });
    query = query.or(orClauses.join(","));
  }

  const { data, error } = await query;
  if (error) throw new Error(`Kataloogi laadimine ebaõnnestus: ${error.message}`);
  let read = (data ?? []) as unknown as HinnakirjaRidaKataloogis[];
  if (tarnijaFilter) read = read.filter((r) => r.hinnakirjad?.tarnija === tarnijaFilter);

  // Kõik tootegrupid (bulk-assign dropdown'i jaoks)
  const { data: grupidData } = await sb.from("tootegrupid").select("*").order("nimi", { ascending: true });
  const grupid = (grupidData ?? []) as unknown as Tootegrupp[];

  // Tarnijate nimekiri filtri jaoks
  const tarnijaSet = new Set<string>();
  for (const r of read) if (r.hinnakirjad?.tarnija) tarnijaSet.add(r.hinnakirjad.tarnija);
  const tarnijad = Array.from(tarnijaSet).sort();

  return (
    <div className="space-y-6">
      <div className="flex flex-wrap items-center justify-between gap-4">
        <div>
          <h1 className="text-3xl font-bold tracking-tight text-vk-navy">Tooted</h1>
          <p className="text-sm text-muted-foreground">
            {read.length} {read.length === 1 ? "toode" : "toodet"} kuvatud — kõikidest tarnijate hinnakirjadest, uusim eespool
          </p>
        </div>
        <Button asChild variant="primary">
          <Link href="/hinnakirjad/uus">
            <Upload className="h-4 w-4" />
            Lae uus hinnakiri
          </Link>
        </Button>
      </div>

      <ImportExportPaneel />

      <div className="space-y-3">
        <SearchInput initial={q} />
        {tarnijad.length > 0 ? (
          <div className="flex flex-wrap items-center gap-2">
            <Link
              href={q ? `/kataloog?q=${encodeURIComponent(q)}` : "/kataloog"}
              className={`rounded-full border px-3 py-1 text-sm transition-colors ${
                tarnijaFilter === ""
                  ? "border-vk-navy bg-vk-navy text-white"
                  : "border-input bg-background hover:bg-accent"
              }`}
            >
              Kõik tarnijad
            </Link>
            {tarnijad.map((t) => (
              <Link
                key={t}
                href={`/kataloog?${new URLSearchParams({ ...(q ? { q } : {}), tarnija: t }).toString()}`}
                className={`rounded-full border px-3 py-1 text-sm transition-colors ${
                  tarnijaFilter === t
                    ? "border-vk-navy bg-vk-navy text-white"
                    : "border-input bg-background hover:bg-accent"
                }`}
              >
                {t}
              </Link>
            ))}
          </div>
        ) : null}
      </div>

      <TootedTabel read={read} grupid={grupid} />
    </div>
  );
}
