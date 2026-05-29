import Image from "next/image";
import Link from "next/link";
import { notFound } from "next/navigation";
import { getServerSupabase } from "@/lib/supabase/server";
import { Button } from "@/components/ui/button";
import type { Pakkumine, Positsioon } from "@/lib/types";
import { formatDate, formatEur } from "@/lib/utils";
import { ArrowLeft } from "lucide-react";
import { PrintButton } from "./print-button";
import { EriosaTabel, type Eriosa } from "./eriosa-tabel";
import { BRAND } from "@/lib/brand";
import { renderPakkumiseKirjeldus } from "@/lib/render-kirjeldus";

export const dynamic = "force-dynamic";
export const revalidate = 0;

export async function generateMetadata({ params }: { params: { id: string } }) {
  const sb = getServerSupabase();
  const { data } = await sb
    .from("pakkumised")
    .select("vkp_nr, objekt")
    .eq("id", params.id)
    .maybeSingle();
  const pk = data as { vkp_nr: string; objekt: string | null } | null;
  if (!pk) return { title: "Pakkumus" };
  return {
    title: `${pk.vkp_nr}${pk.objekt ? ` — ${pk.objekt}` : ""}`,
  };
}

// Vaikenimed standardkoodidele. Kasutame AINULT kui kasutaja sektsioon väärtus
// on ainult kood (nt "711"). Kui on "711 Puurkaevude rajamine" → tema väärtus jääb peale.
const SEKT_KIRJELDUS: Record<string, string> = {
  "711": "Veevarustus",
  "712": "Kanalisatsioon",
  "713": "Sademevesi / drenaaž",
  "721": "Küttesüsteem",
  "722": "Küttekehad",
  "723": "Soojussõlm",
  "724": "Ventilatsioon",
};

// PDF-klientvaates: kui kasutaja pole eriosa selgesõnaliselt sisestanud,
// ärme näita "(määramata)" placeholder'it. Tagasta tühi string — eriosa-tabel
// kuvab sumarrida ilma sektsiooni-pealkirjata.
function sektsiooniLabel(sekt: string | null | undefined): string {
  if (!sekt) return "";
  const trimmed = String(sekt).trim();
  if (!trimmed) return "";
  const code = sektsiooniKood(trimmed);
  if (code && trimmed === code && SEKT_KIRJELDUS[code]) {
    return `${code} ${SEKT_KIRJELDUS[code]}`;
  }
  return trimmed;
}

const ALAMSEKT_PLACEHOLDER = "(üldine)";

function sektsiooniKood(s: string | null): string | null {
  if (!s) return null;
  const m = s.match(/^(\d{3})/);
  return m ? m[1] : s;
}

type AlamsektSum = { materjal: number; töö: number; kokku: number; omahind: number };
type SektsiooniSum = AlamsektSum & { alamsektsioonid: Map<string, AlamsektSum> };

function arvutaRida(p: Positsioon, pakkumineKate: number, tunnitasu: number) {
  const kogus = p.kogus ?? 0;
  const ostuhind = p.ostuhind_snapshot ?? 0;
  const aeg = p.paigaldusaeg_snapshot ?? 0;
  const efektiivneKate = p.kate_snapshot ?? pakkumineKate;
  return {
    materjal: kogus * ostuhind * efektiivneKate,
    töö: kogus * aeg * tunnitasu,
    omahind: kogus * ostuhind,
  };
}

export default async function TrükkPage({ params }: { params: { id: string } }) {
  const sb = getServerSupabase();
  const [{ data: pkData }, { data: posData }] = await Promise.all([
    sb.from("pakkumised").select("*").eq("id", params.id).maybeSingle(),
    sb.from("positsioonid").select("*").eq("pakkumine_id", params.id),
  ]);
  if (!pkData) notFound();

  const pakkumine = pkData as unknown as Pakkumine;
  const positsioonid = (posData ?? []) as unknown as Positsioon[];

  // Kogu kõikide positsioonide toode_id'd, lae hinnakirja_read + tootegrupid (template + mudel_andmed)
  // renderPakkumiseKirjeldus ahela jaoks.
  type TooteKirjeldusInfo = {
    catalogKirjeldus: string | null;
    mudel_andmed: Record<string, string | number | null> | null;
    template_kirjeldus: string | null;
    pakkumise_kirjeldus: string | null;
    grupi_kirjeldus: string | null;
  };
  const tooteKirjeldused = new Map<string, TooteKirjeldusInfo>();
  const toodeIds = Array.from(
    new Set(positsioonid.map((p) => p.toode_id).filter((id): id is string => !!id)),
  );
  if (toodeIds.length > 0) {
    const { data: hkRead } = await sb
      .from("hinnakirja_read")
      .select("id, kirjeldus, mudel_andmed, tootegrupid(template_kirjeldus, pakkumise_kirjeldus, kirjeldus)")
      .in("id", toodeIds);
    type GrupiVali = {
      template_kirjeldus: string | null;
      pakkumise_kirjeldus: string | null;
      kirjeldus: string | null;
    };
    for (const r of (hkRead ?? []) as unknown as Array<{
      id: string;
      kirjeldus: string | null;
      mudel_andmed: Record<string, string | number | null> | null;
      // Supabase nested select tagastab JOIN'i alati massiivina, isegi N-to-1 puhul
      tootegrupid: GrupiVali | GrupiVali[] | null;
    }>) {
      const grupp = Array.isArray(r.tootegrupid) ? (r.tootegrupid[0] ?? null) : r.tootegrupid;
      tooteKirjeldused.set(r.id, {
        catalogKirjeldus: r.kirjeldus,
        mudel_andmed: r.mudel_andmed,
        template_kirjeldus: grupp?.template_kirjeldus ?? null,
        pakkumise_kirjeldus: grupp?.pakkumise_kirjeldus ?? null,
        grupi_kirjeldus: grupp?.kirjeldus ?? null,
      });
    }
  }

  const sektMap = new Map<string, SektsiooniSum>();
  // Eraldi positsioonide loend eriosa kaupa (kasutatakse "Näita ridu" tooglile)
  const sektRead = new Map<string, Positsioon[]>();
  for (const p of positsioonid) {
    const sekt = p.sektsioon ?? "(määramata)";
    const sub = p.alamsektsioon?.trim() || ALAMSEKT_PLACEHOLDER;
    const a = arvutaRida(p, pakkumine.kate_koefitsient, pakkumine.tunnitasu);
    if (!sektMap.has(sekt)) {
      sektMap.set(sekt, { materjal: 0, töö: 0, kokku: 0, omahind: 0, alamsektsioonid: new Map() });
    }
    const s = sektMap.get(sekt)!;
    s.materjal += a.materjal;
    s.töö += a.töö;
    s.kokku += a.materjal + a.töö;
    s.omahind += a.omahind;
    if (!s.alamsektsioonid.has(sub)) {
      s.alamsektsioonid.set(sub, { materjal: 0, töö: 0, kokku: 0, omahind: 0 });
    }
    const sub_ = s.alamsektsioonid.get(sub)!;
    sub_.materjal += a.materjal;
    sub_.töö += a.töö;
    sub_.kokku += a.materjal + a.töö;
    sub_.omahind += a.omahind;
    if (!sektRead.has(sekt)) sektRead.set(sekt, []);
    sektRead.get(sekt)!.push(p);
  }
  const sektsioonid = Array.from(sektMap.entries()).sort(([a], [b]) => a.localeCompare(b));

  // Serialiseeritud kuju kliendi-komponendi jaoks (Map -> array; eriosa label arvutatud)
  const eriosadProp: Eriosa[] = sektsioonid.map(([sekt, v]) => {
    const sektLabel = sektsiooniLabel(sekt);
    const alamList = Array.from(v.alamsektsioonid.entries()).sort(([a], [b]) => {
      if (a === ALAMSEKT_PLACEHOLDER) return 1;
      if (b === ALAMSEKT_PLACEHOLDER) return -1;
      return a.localeCompare(b);
    });
    const ridade_loend = (sektRead.get(sekt) ?? [])
      .slice()
      .sort((a, b) => (a.rea_nr ?? 0) - (b.rea_nr ?? 0))
      .map((p) => {
        const r = arvutaRida(p, pakkumine.kate_koefitsient, pakkumine.tunnitasu);
        const info = p.toode_id ? tooteKirjeldused.get(p.toode_id) : undefined;
        const renderedKirjeldus = renderPakkumiseKirjeldus({
          rowKirjeldus: p.kirjeldus ?? info?.catalogKirjeldus ?? null,
          pakkumiseKirjeldus: info?.pakkumise_kirjeldus,
          templateKirjeldus: info?.template_kirjeldus,
          mudelAndmed: info?.mudel_andmed,
          grupiKirjeldus: info?.grupi_kirjeldus,
        });
        return {
          nimetus: p.nimetus,
          tähis: p.tähis,
          kirjeldus: renderedKirjeldus,
          kogus: p.kogus,
          ühik: p.ühik,
          materjal: r.materjal,
          töö: r.töö,
          kokku: r.materjal + r.töö,
        };
      });
    return {
      sekt,
      sektLabel,
      materjal: v.materjal,
      töö: v.töö,
      kokku: v.kokku,
      alamsektsioonid: alamList.map(([sub, s]) => ({
        sub,
        materjal: s.materjal,
        töö: s.töö,
        kokku: s.kokku,
      })),
      read: ridade_loend,
    };
  });

  const grandNeto = sektsioonid.reduce((s, [, v]) => s + v.kokku, 0);
  const grandKm = grandNeto * pakkumine.km_määr;
  const grandBruto = grandNeto + grandKm;
  const grandOmahind = sektsioonid.reduce((s, [, v]) => s + v.omahind, 0);
  const grandMaterjalMüük = sektsioonid.reduce((s, [, v]) => s + v.materjal, 0);
  const grandTööMüük = sektsioonid.reduce((s, [, v]) => s + v.töö, 0);
  const materjaliMarginaalEur = grandMaterjalMüük - grandOmahind;
  const kateKoguMüügilt = grandNeto > 0 ? (materjaliMarginaalEur / grandNeto) * 100 : 0;
  const kateMaterjalist = grandMaterjalMüük > 0 ? (materjaliMarginaalEur / grandMaterjalMüük) * 100 : 0;

  return (
    <>
    {/* Fixed footer — kordub IGAL print-lehel. Asetatud root-tasandil (mitte
        kasti sees), et browser-print correctly fixed-position rendaks. */}
    <div className="pdf-fixed-footer">
      <div className="pdf-footer-left">
        {BRAND.nimi}
        <span className="pdf-footer-soft"> · {BRAND.aadress}</span>
      </div>
      <div className="pdf-footer-right">
        {BRAND.email} · {BRAND.telefon}
        <br />
        {pakkumine.vkp_nr} · {formatDate(pakkumine.pakkumise_kuupäev)}
      </div>
    </div>

    <div className="mx-auto max-w-4xl space-y-6 p-6 print:p-0">
      {/* Toiming-nupud (print: hidden) */}
      <div className="flex items-center justify-between print:hidden">
        <Button asChild variant="ghost" size="sm">
          <Link href={`/pakkumised/${pakkumine.id}`}>
            <ArrowLeft className="h-4 w-4" />
            Tagasi pakkumisele
          </Link>
        </Button>
        <PrintButton />
      </div>

      {/* SISEMINE EELVAADE — ainult koostajale, ei trükita */}
      <div className="rounded-lg border-2 border-dashed border-vk-blue/40 bg-vk-blue/5 p-4 print:hidden">
        <div className="mb-3 flex items-center justify-between">
          <div className="flex items-center gap-2">
            <span className="rounded-md bg-vk-blue px-2 py-0.5 text-[10px] font-bold uppercase tracking-wide text-white">
              Sisemine
            </span>
            <span className="text-sm font-semibold text-vk-navy">
              Koostaja eelvaade — marginaalid (ei trükita)
            </span>
          </div>
          <div className="text-xs text-muted-foreground">Print-mode&apos;is peidetud</div>
        </div>

        <div className="grid gap-2 sm:grid-cols-4">
          <div className="rounded-md bg-white p-2 shadow-sm">
            <div className="text-[10px] uppercase tracking-wide text-muted-foreground">
              Materjali omahind
            </div>
            <div className="font-mono text-sm font-semibold">{formatEur(grandOmahind)}</div>
          </div>
          <div className="rounded-md bg-white p-2 shadow-sm">
            <div className="text-[10px] uppercase tracking-wide text-muted-foreground">
              Materjali müük
            </div>
            <div className="font-mono text-sm font-semibold">{formatEur(grandMaterjalMüük)}</div>
          </div>
          <div className="rounded-md bg-vk-blue/10 p-2 shadow-sm">
            <div className="text-[10px] uppercase tracking-wide text-muted-foreground">
              Marginaal €
            </div>
            <div className="font-mono text-sm font-bold text-vk-blue">
              {formatEur(materjaliMarginaalEur)}
            </div>
          </div>
          <div className="rounded-md bg-vk-blue/10 p-2 shadow-sm">
            <div className="text-[10px] uppercase tracking-wide text-muted-foreground">
              Kate kogu müügilt
            </div>
            <div className="font-mono text-sm font-bold text-vk-blue">
              {kateKoguMüügilt.toFixed(1)}%
            </div>
            <div className="text-[10px] text-muted-foreground">
              materjalilt: {kateMaterjalist.toFixed(1)}%
            </div>
          </div>
        </div>

        {sektsioonid.length > 0 ? (
          <div className="mt-3 overflow-hidden rounded-md border bg-white">
            <table className="w-full text-xs">
              <thead className="bg-muted/40">
                <tr>
                  <th className="px-2 py-1.5 text-left font-semibold">Sektsioon</th>
                  <th className="px-2 py-1.5 text-right font-semibold">Omahind</th>
                  <th className="px-2 py-1.5 text-right font-semibold">Müük (mat.)</th>
                  <th className="px-2 py-1.5 text-right font-semibold">Marginaal €</th>
                  <th className="px-2 py-1.5 text-right font-semibold">Marginaal %</th>
                </tr>
              </thead>
              <tbody>
                {sektsioonid.map(([sekt, v]) => {
                  const sektLabel = sektsiooniLabel(sekt);
                  const marg = v.materjal - v.omahind;
                  const margPct = v.materjal > 0 ? (marg / v.materjal) * 100 : 0;
                  return (
                    <tr key={`marg-${sekt}`} className="border-t">
                      <td className="px-2 py-1.5">{sektLabel}</td>
                      <td className="px-2 py-1.5 text-right font-mono">{formatEur(v.omahind)}</td>
                      <td className="px-2 py-1.5 text-right font-mono">{formatEur(v.materjal)}</td>
                      <td className="px-2 py-1.5 text-right font-mono font-semibold text-vk-blue">
                        {formatEur(marg)}
                      </td>
                      <td className="px-2 py-1.5 text-right font-mono font-semibold text-vk-blue">
                        {margPct.toFixed(1)}%
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        ) : null}

        <p className="mt-2 text-[10px] text-muted-foreground">
          Materjali marginaal = müük − ostuhind. Töö loetakse 100% marginaaliga (tunnitasu =
          müügihind). Kate kogu müügilt = materjali marginaal / kogusumma (neto). Print-vaates
          kuvatakse kliendile vaid alumine pakkumus.
        </p>
      </div>

      {/* ────────────────────────────────────────────────────────── */}
      {/*                    K L I E N D I  V A A D E                */}
      {/* ────────────────────────────────────────────────────────── */}
      <div className="overflow-hidden rounded-lg border bg-white shadow-sm print:rounded-none print:border-0 print:shadow-none">
        {/* PÄIS — valge taust, logo + kogu metainfo */}
        <div className="bg-white px-8 pt-6 pb-5 print:px-6 print:pt-4 print:pb-4">
          {/* Top row — logo + Pakkumus number/kuupäev */}
          <div className="flex items-start justify-between gap-6">
            <Image
              src={BRAND.logoPath}
              alt={BRAND.nimi}
              width={200}
              height={55}
              priority
              className="h-12 w-auto"
            />
            <div className="text-right">
              <div className="text-[10px] font-semibold uppercase tracking-[0.22em] text-vk-blue">
                Pakkumus
              </div>
              <div className="mt-0.5 font-mono text-2xl font-bold leading-tight text-vk-navy">
                {pakkumine.vkp_nr}
              </div>
              <div className="mt-0.5 text-xs text-muted-foreground">
                {formatDate(pakkumine.pakkumise_kuupäev)}
                {pakkumine.kehtiv_kuni ? (
                  <span className="ml-2">· kehtiv kuni {formatDate(pakkumine.kehtiv_kuni)}</span>
                ) : null}
              </div>
            </div>
          </div>

          {/* Objekt + Tellija */}
          <div className="mt-5 grid gap-5 sm:grid-cols-2">
            <div>
              <div className="text-[10px] font-semibold uppercase tracking-[0.15em] text-vk-blue">
                Objekt
              </div>
              <div className="mt-1 text-base font-semibold text-vk-navy">
                {pakkumine.objekt ?? "—"}
              </div>
              {pakkumine.projekti_nr ? (
                <div className="mt-0.5 text-xs text-muted-foreground">
                  Projekt nr {pakkumine.projekti_nr}
                </div>
              ) : null}
            </div>
            <div>
              <div className="text-[10px] font-semibold uppercase tracking-[0.15em] text-vk-blue">
                Tellija
              </div>
              <div className="mt-1 text-base font-semibold text-vk-navy">
                {pakkumine.tellija_nimi ?? "—"}
              </div>
              {pakkumine.tellija_telefon ? (
                <div className="mt-0.5 text-xs text-muted-foreground">
                  {pakkumine.tellija_telefon}
                </div>
              ) : null}
              {pakkumine.tellija_email ? (
                <div className="mt-0.5 text-xs text-muted-foreground">
                  {pakkumine.tellija_email}
                </div>
              ) : null}
            </div>
          </div>
        </div>

        {/* Eraldusriba — sinine + punane (3:1) */}
        <div className="flex h-1">
          <div className="flex-[3] bg-vk-blue" />
          <div className="flex-[1] bg-vk-red" />
        </div>

        {/* SUMMARY TABEL + KOGUSUMMA — kliendi-komponent linnukesega */}
        <EriosaTabel
          eriosad={eriosadProp}
          km_määr={pakkumine.km_määr}
          grandMaterjal={grandMaterjalMüük}
          grandTöö={grandTööMüük}
          grandNeto={grandNeto}
          grandKm={grandKm}
          grandBruto={grandBruto}
        />

        {/* MÄRKUSED */}
        {pakkumine.märkused ? (
          <div className="mx-8 mb-6 border-t pt-4 print:mx-6 print:mb-4 pdf-no-break">
            <div className="text-[10px] font-semibold uppercase tracking-[0.15em] text-vk-blue">
              Märkused
            </div>
            <div className="mt-1 whitespace-pre-wrap text-sm text-vk-navy/90">
              {pakkumine.märkused}
            </div>
          </div>
        ) : null}

        {/* ALLKIRI + JALUS */}
        <div className="border-t border-vk-navy/10 bg-muted/30 px-8 py-5 print:px-6 print:py-4 print:bg-transparent pdf-no-break">
          <div className="grid gap-6 sm:grid-cols-2">
            <div className="text-xs">
              <div className="font-semibold text-vk-navy">Pakkumise koostas</div>
              <div className="mt-1 text-vk-navy">Magnus Sirelmets</div>
              <div className="text-muted-foreground">
                {BRAND.nimi} · {formatDate(pakkumine.pakkumise_kuupäev)}
              </div>
            </div>
            <div className="text-xs">
              <div className="font-semibold text-vk-navy">Allkiri</div>
              <div className="mt-6 border-b border-vk-navy/40" />
            </div>
          </div>
        </div>

        {/* JALUSE BÄND — navy + kontakt. Ekraani-jaoks; print'is peidetud (asendub pdf-fixed-footer'iga). */}
        <div className="bg-vk-navy text-white pdf-screen-footer">
          <div className="flex h-1">
            <div className="flex-[1] bg-vk-red" />
            <div className="flex-[3] bg-vk-blue" />
          </div>
          <div className="flex flex-wrap items-center justify-between gap-3 px-8 py-3 text-[11px] print:px-6">
            <div className="font-semibold tracking-wide">
              {BRAND.nimi}
              <span className="ml-2 font-normal italic text-white/70">{BRAND.slogan}</span>
            </div>
            <div className="flex flex-wrap items-center gap-x-4 gap-y-1 text-white/85">
              <span>{BRAND.aadress}</span>
              <span className="hidden sm:inline text-white/40">·</span>
              <span>{BRAND.telefon}</span>
              <span className="hidden sm:inline text-white/40">·</span>
              <span>{BRAND.email}</span>
            </div>
          </div>
        </div>
      </div>
    </div>
    </>
  );
}
