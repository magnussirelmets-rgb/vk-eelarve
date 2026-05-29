"use client";

import Link from "next/link";
import { useState, useMemo, useTransition } from "react";
import { useRouter } from "next/navigation";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Trash2, Loader2, AlertTriangle, Plus, FolderTree, Percent, Check, Pencil, X } from "lucide-react";
import type { Positsioon } from "@/lib/types";
import { formatEur, formatNum } from "@/lib/utils";
import { LisaVaruDialog } from "./lisa-varu-dialog";
import {
  kustutaPositsioone,
  muudaAlamsektsioon,
  muudaMassiKate,
  muudaMassiSektsioon,
  muudaPositsiooniKate,
  muudaPositsiooniPaigaldusaeg,
  muudaPositsiooniKogus,
  muudaPositsiooniOstuhind,
  muudaPositsiooniInfo,
  otsiTooteid,
  seoToode,
  type ToodeKandidaat,
} from "../actions";
import { Search } from "lucide-react";
import { useEffect, useRef } from "react";
import { ToodeValija } from "./toote-valija";
import { LisaPositsioonDialog } from "./lisa-positsioon-dialog";

// SEKT_KIRJELDUS = vaikenimed standardkoodidele. Kasutame AINULT siis kui
// kasutaja sektsioon väärtus on ainult kood (nt "711"). Kui kasutaja on
// lisanud oma nime (nt "711 Puurkaevude rajamine"), siis tema väärtus jääb peale.
const SEKT_KIRJELDUS: Record<string, string> = {
  "711": "Veevarustus",
  "712": "Kanalisatsioon",
  "713": "Sademevesi/drenaaž",
  "721": "Küttesüsteem",
  "722": "Küttekehad",
  "723": "Soojussõlm",
  "724": "Ventilatsioon",
};

function sektsiooniLabel(sekt: string | null | undefined): string {
  if (!sekt) return "(määramata)";
  const trimmed = String(sekt).trim();
  if (!trimmed) return "(määramata)";
  const code = sektsiooniKood(trimmed);
  // Kui väärtus on AINULT kood (nt "711") ja meil on vaikenimi → liidame
  if (code && trimmed === code && SEKT_KIRJELDUS[code]) {
    return `${code} ${SEKT_KIRJELDUS[code]}`;
  }
  return trimmed;
}

const ALAMSEKT_PLACEHOLDER = "(üldine)"; // kuvatakse kui alamsektsioon puudub

function sektsiooniKood(s: string | null): string | null {
  if (!s) return null;
  const m = s.match(/^(\d{3})/);
  return m ? m[1] : s;
}

type RaArvutus = {
  materjal_neto: number;
  töö_neto: number;
  kokku_neto: number;
};

function arvutaTavalineRida(p: Positsioon, pakkumineKate: number, tunnitasu: number): RaArvutus {
  const kogus = p.kogus ?? 0;
  const ostuhind = p.ostuhind_snapshot ?? 0;
  const aeg = p.paigaldusaeg_snapshot ?? 0;
  const efektiivneKate = p.kate_snapshot ?? pakkumineKate;
  const materjal = kogus * ostuhind * efektiivneKate;
  const töö = kogus * aeg * tunnitasu;
  return { materjal_neto: materjal, töö_neto: töö, kokku_neto: materjal + töö };
}

function arvutaRida(p: Positsioon, pakkumineKate: number, tunnitasu: number, sektsiooniBaas?: number): RaArvutus {
  if (p.reservi_koefitsent !== null && p.reservi_koefitsent !== undefined) {
    const summa = (sektsiooniBaas ?? 0) * (p.reservi_koefitsent / 100);
    return { materjal_neto: summa, töö_neto: 0, kokku_neto: summa };
  }
  return arvutaTavalineRida(p, pakkumineKate, tunnitasu);
}

type AlamsektSum = { materjal: number; töö: number; kokku: number; linkitud: number; kokkuRidu: number };
type SektsiooniSum = AlamsektSum & { alamsektsioonid: Map<string, AlamsektSum> };

type Props = {
  pakkumineId: string;
  positsioonid: Positsioon[];
  kate_koefitsient: number;
  tunnitasu: number;
  km_määr: number;
};

export function PositsioonideTabel({ pakkumineId, positsioonid, kate_koefitsient, tunnitasu, km_määr }: Props) {
  const router = useRouter();
  const [selected, setSelected] = useState<Set<string>>(new Set());
  const [sektsiooniFilter, setSektsiooniFilter] = useState<string | null>(null);
  const [confirming, setConfirming] = useState(false);
  const [busy, setBusy] = useState<null | "delete" | "alamsekt" | "kate" | "sekt">(null);
  const [bulkSekt, setBulkSekt] = useState("");
  const [bulkAlamsekt, setBulkAlamsekt] = useState("");
  const [bulkKate, setBulkKate] = useState("");
  const [msg, setMsg] = useState<{ kind: "ok" | "err"; text: string } | null>(null);
  const [addCtx, setAddCtx] = useState<{ sektsioon: string; alamsektsioon: string } | null>(null);
  const [varuCtx, setVaruCtx] = useState<{ sektsioon: string; alamsektsioon: string } | null>(null);
  const [, startNav] = useTransition();

  // Inline-edit sektsiooni nime jaoks
  const [editingSekt, setEditingSekt] = useState<string | null>(null);
  const [editSektNimi, setEditSektNimi] = useState("");
  const [editSektBusy, setEditSektBusy] = useState(false);

  async function alustaSektEditi(sekt: string) {
    setEditingSekt(sekt);
    setEditSektNimi(sekt === "(määramata)" ? "" : sekt);
  }
  function tühistaSektEdit() {
    setEditingSekt(null);
    setEditSektNimi("");
  }
  async function salvestaSektEdit(originaalSekt: string, ridadeIdid: string[]) {
    const uusNimi = editSektNimi.trim();
    if (!uusNimi) {
      setMsg({ kind: "err", text: "Sektsiooni nimi ei tohi olla tühi" });
      return;
    }
    if (uusNimi === originaalSekt) {
      tühistaSektEdit();
      return;
    }
    setEditSektBusy(true);
    setMsg(null);
    const r = await muudaMassiSektsioon(ridadeIdid, uusNimi);
    setEditSektBusy(false);
    if (r.ok) {
      setMsg({ kind: "ok", text: `Sektsioon "${originaalSekt}" → "${uusNimi}" (${r.uuendatud} rida)` });
      tühistaSektEdit();
      // Kui aktiivne filter oli vana nimega, säilita filter uue nimega
      if (sektsiooniFilter === originaalSekt) setSektsiooniFilter(uusNimi);
      startNav(() => router.refresh());
    } else {
      setMsg({ kind: "err", text: r.error });
    }
  }

  function avaLisaDialog(sektsioon = "", alamsektsioon = "") {
    setAddCtx({ sektsioon, alamsektsioon });
  }
  function avaVaruDialog(sektsioon = "", alamsektsioon = "") {
    setVaruCtx({ sektsioon, alamsektsioon });
  }

  const sections = useMemo(() => {
    const counts = new Map<string, number>();
    for (const p of positsioonid) {
      const key = p.sektsioon ?? "(määramata)";
      counts.set(key, (counts.get(key) ?? 0) + 1);
    }
    return Array.from(counts.entries()).sort(([a], [b]) => a.localeCompare(b));
  }, [positsioonid]);

  const visible = useMemo(() => {
    if (!sektsiooniFilter) return positsioonid;
    return positsioonid.filter((p) => (p.sektsioon ?? "(määramata)") === sektsiooniFilter);
  }, [positsioonid, sektsiooniFilter]);

  // Nested grouping: sektsioon → alamsektsioon → read
  const grouped = useMemo(() => {
    const m = new Map<string, Map<string, Positsioon[]>>();
    for (const p of visible) {
      const sekt = p.sektsioon ?? "(määramata)";
      const sub = p.alamsektsioon?.trim() || ALAMSEKT_PLACEHOLDER;
      if (!m.has(sekt)) m.set(sekt, new Map());
      const subMap = m.get(sekt)!;
      if (!subMap.has(sub)) subMap.set(sub, []);
      subMap.get(sub)!.push(p);
    }
    return Array.from(m.entries())
      .sort(([a], [b]) => a.localeCompare(b))
      .map(
        ([sekt, subMap]) =>
          [
            sekt,
            Array.from(subMap.entries()).sort(([a], [b]) => {
              // Put placeholder ("(üldine)") last
              if (a === ALAMSEKT_PLACEHOLDER) return 1;
              if (b === ALAMSEKT_PLACEHOLDER) return -1;
              return a.localeCompare(b);
            }),
          ] as const,
      );
  }, [visible]);

  // Sektsiooni materjali baas — kasutab reservide arvutamiseks. Reservid ise välja arvatud.
  const sektsiooniMaterjalBaas = useMemo(() => {
    const m = new Map<string, number>();
    for (const p of positsioonid) {
      if (p.reservi_koefitsent !== null && p.reservi_koefitsent !== undefined) continue;
      const sekt = p.sektsioon ?? "(määramata)";
      const a = arvutaTavalineRida(p, kate_koefitsient, tunnitasu);
      m.set(sekt, (m.get(sekt) ?? 0) + a.materjal_neto);
    }
    return m;
  }, [positsioonid, kate_koefitsient, tunnitasu]);

  // Iga rea arvutus (sh reservid) — cached per row ID
  const rowCalcs = useMemo(() => {
    const m = new Map<string, RaArvutus>();
    for (const p of positsioonid) {
      const sekt = p.sektsioon ?? "(määramata)";
      m.set(p.id, arvutaRida(p, kate_koefitsient, tunnitasu, sektsiooniMaterjalBaas.get(sekt)));
    }
    return m;
  }, [positsioonid, kate_koefitsient, tunnitasu, sektsiooniMaterjalBaas]);

  // Summad sektsiooni-kaupa + alamsektsiooni-kaupa
  const sektsiooniArvutus = useMemo(() => {
    const m = new Map<string, SektsiooniSum>();
    for (const p of positsioonid) {
      const sekt = p.sektsioon ?? "(määramata)";
      const sub = p.alamsektsioon?.trim() || ALAMSEKT_PLACEHOLDER;
      const a = rowCalcs.get(p.id) ?? { materjal_neto: 0, töö_neto: 0, kokku_neto: 0 };

      if (!m.has(sekt)) {
        m.set(sekt, {
          materjal: 0,
          töö: 0,
          kokku: 0,
          linkitud: 0,
          kokkuRidu: 0,
          alamsektsioonid: new Map(),
        });
      }
      const sektSum = m.get(sekt)!;
      sektSum.materjal += a.materjal_neto;
      sektSum.töö += a.töö_neto;
      sektSum.kokku += a.kokku_neto;
      sektSum.kokkuRidu += 1;
      if (p.toode_id) sektSum.linkitud += 1;

      if (!sektSum.alamsektsioonid.has(sub)) {
        sektSum.alamsektsioonid.set(sub, {
          materjal: 0,
          töö: 0,
          kokku: 0,
          linkitud: 0,
          kokkuRidu: 0,
        });
      }
      const subSum = sektSum.alamsektsioonid.get(sub)!;
      subSum.materjal += a.materjal_neto;
      subSum.töö += a.töö_neto;
      subSum.kokku += a.kokku_neto;
      subSum.kokkuRidu += 1;
      if (p.toode_id) subSum.linkitud += 1;
    }
    return m;
  }, [positsioonid, rowCalcs]);

  const grandTotal = useMemo(() => {
    let materjal = 0;
    let töö = 0;
    for (const v of sektsiooniArvutus.values()) {
      materjal += v.materjal;
      töö += v.töö;
    }
    const neto = materjal + töö;
    const km = neto * km_määr;
    const bruto = neto + km;
    return { materjal, töö, neto, km, bruto };
  }, [sektsiooniArvutus, km_määr]);

  function toggleOne(id: string, on: boolean) {
    setSelected((prev) => {
      const next = new Set(prev);
      if (on) next.add(id);
      else next.delete(id);
      return next;
    });
  }
  function toggleAllVisible(on: boolean) {
    setSelected((prev) => {
      const next = new Set(prev);
      for (const p of visible) {
        if (on) next.add(p.id);
        else next.delete(p.id);
      }
      return next;
    });
  }
  function selectWholeSection(key: string) {
    setSelected((prev) => {
      const next = new Set(prev);
      for (const p of positsioonid) {
        if ((p.sektsioon ?? "(määramata)") === key) next.add(p.id);
      }
      return next;
    });
  }

  async function doDelete() {
    setBusy("delete");
    setMsg(null);
    const ids = Array.from(selected);
    const r = await kustutaPositsioone(ids);
    setBusy(null);
    if (r.ok) {
      setSelected(new Set());
      setConfirming(false);
      setMsg({ kind: "ok", text: `${r.deleted} positsiooni kustutatud` });
      startNav(() => router.refresh());
    } else {
      setMsg({ kind: "err", text: r.error });
    }
  }

  async function doSetSekt() {
    setBusy("sekt");
    setMsg(null);
    const ids = Array.from(selected);
    const value = bulkSekt.trim() || null;
    const r = await muudaMassiSektsioon(ids, value);
    setBusy(null);
    if (r.ok) {
      setSelected(new Set());
      setBulkSekt("");
      setMsg({
        kind: "ok",
        text: value
          ? `${r.uuendatud} rea sektsioon määratud: "${value}"`
          : `${r.uuendatud} rea sektsioon eemaldatud`,
      });
      startNav(() => router.refresh());
    } else {
      setMsg({ kind: "err", text: r.error });
    }
  }

  async function doSetKate() {
    setBusy("kate");
    setMsg(null);
    const ids = Array.from(selected);
    const raw = bulkKate.trim();
    let value: number | null;
    if (raw === "") {
      value = null;
    } else {
      const n = Number(raw.replace(",", "."));
      if (!Number.isFinite(n) || n <= 0) {
        setBusy(null);
        setMsg({ kind: "err", text: "Kate peab olema positiivne arv (nt 1,30) või tühi" });
        return;
      }
      value = n;
    }
    const r = await muudaMassiKate(ids, value);
    setBusy(null);
    if (r.ok) {
      setSelected(new Set());
      setBulkKate("");
      setMsg({
        kind: "ok",
        text:
          value === null
            ? `${r.uuendatud} rea kate eemaldatud (kasutab nüüd pakkumise vaikimisi)`
            : `${r.uuendatud} rea kate määratud: ${value.toFixed(2)}×`,
      });
      startNav(() => router.refresh());
    } else {
      setMsg({ kind: "err", text: r.error });
    }
  }

  async function doSetAlamsekt() {
    setBusy("alamsekt");
    setMsg(null);
    const ids = Array.from(selected);
    const value = bulkAlamsekt.trim() || null;
    const r = await muudaAlamsektsioon(ids, value);
    setBusy(null);
    if (r.ok) {
      setSelected(new Set());
      setBulkAlamsekt("");
      setMsg({
        kind: "ok",
        text: value
          ? `${r.uuendatud} rea alamsektsioon määratud: "${value}"`
          : `${r.uuendatud} rea alamsektsioon eemaldatud`,
      });
      startNav(() => router.refresh());
    } else {
      setMsg({ kind: "err", text: r.error });
    }
  }

  const count = selected.size;
  const visibleAllSelected = visible.length > 0 && visible.every((p) => selected.has(p.id));
  const visibleSomeSelected = visible.some((p) => selected.has(p.id)) && !visibleAllSelected;

  const linkitudKokku = positsioonid.filter((p) => p.toode_id !== null).length;
  const matchimataKokku = positsioonid.length - linkitudKokku;

  return (
    <>
      <Card>
        <CardHeader>
          <div className="flex flex-wrap items-start justify-between gap-3">
            <div>
              <CardTitle>Pakkumise positsioonid</CardTitle>
              <CardDescription>
                {positsioonid.length} positsiooni · {linkitudKokku} linkitud · {matchimataKokku} veel linkimata
              </CardDescription>
            </div>
            <div className="flex flex-col items-end gap-2">
              <Button onClick={() => avaLisaDialog()} variant="outline" size="sm">
                <Plus className="h-4 w-4" />
                Lisa positsioon käsitsi
              </Button>
              <div className="text-right text-xs text-muted-foreground">
                Kate {kate_koefitsient.toFixed(2)}× · Tunnitasu {formatEur(tunnitasu)}/h · KM {(km_määr * 100).toFixed(0)}%
              </div>
            </div>
          </div>
        </CardHeader>
        <CardContent className="space-y-3 p-6">
          {/* Sektsiooni filter chip'id */}
          <div className="flex flex-wrap items-center gap-2 text-sm">
            <button
              type="button"
              onClick={() => setSektsiooniFilter(null)}
              className={`rounded-full border px-3 py-1 transition-colors ${
                sektsiooniFilter === null
                  ? "border-vk-navy bg-vk-navy text-white"
                  : "border-input bg-background hover:bg-accent"
              }`}
            >
              Kõik <span className="ml-1 text-xs opacity-70">{positsioonid.length}</span>
            </button>
            {sections.map(([key, count]) => {
              const label = sektsiooniLabel(key);
              return (
                <div key={key} className="flex items-center gap-1">
                  <button
                    type="button"
                    onClick={() => setSektsiooniFilter(key)}
                    className={`rounded-full border px-3 py-1 transition-colors ${
                      sektsiooniFilter === key
                        ? "border-vk-navy bg-vk-navy text-white"
                        : "border-input bg-background hover:bg-accent"
                    }`}
                  >
                    {label} <span className="ml-1 text-xs opacity-70">{count}</span>
                  </button>
                  <button
                    type="button"
                    onClick={() => selectWholeSection(key)}
                    className="rounded border border-input px-2 py-1 text-xs text-muted-foreground hover:bg-accent"
                    title="Vali kogu sektsioon"
                  >
                    +vali
                  </button>
                </div>
              );
            })}
          </div>

          {count > 0 ? (
            <div className="space-y-2 rounded-md border bg-vk-blue/5 px-4 py-2.5 text-sm">
              <div className="flex flex-wrap items-center justify-between gap-3">
                <span className="font-medium">
                  <span className="font-mono text-vk-blue">{count}</span> positsiooni valitud
                </span>
                <div className="flex flex-wrap items-center gap-2">
                  {confirming ? (
                    <>
                      <span className="flex items-center gap-1 rounded-md bg-vk-red/10 px-2 py-1 text-xs text-vk-red">
                        <AlertTriangle className="h-3 w-3" />
                        Pole tagasi
                      </span>
                      <Button onClick={doDelete} disabled={busy !== null} variant="destructive" size="sm">
                        {busy === "delete" ? <Loader2 className="h-4 w-4 animate-spin" /> : <Trash2 className="h-4 w-4" />}
                        Kinnita kustutamine
                      </Button>
                      <Button onClick={() => setConfirming(false)} disabled={busy !== null} variant="ghost" size="sm">
                        Tühista
                      </Button>
                    </>
                  ) : (
                    <>
                      <Input
                        value={bulkSekt}
                        onChange={(e) => setBulkSekt(e.target.value)}
                        placeholder="Sektsioon (nt 711 Veevarustus)"
                        className="h-8 w-48 text-sm"
                      />
                      <Button
                        onClick={doSetSekt}
                        disabled={busy !== null}
                        variant="primary"
                        size="sm"
                        title={
                          bulkSekt.trim()
                            ? `Tõsta read sektsiooni "${bulkSekt.trim()}"`
                            : "Tühi väärtus eemaldab sektsiooni"
                        }
                      >
                        {busy === "sekt" ? <Loader2 className="h-4 w-4 animate-spin" /> : <FolderTree className="h-4 w-4" />}
                        {bulkSekt.trim() ? "Tõsta sektsiooni" : "Eemalda sektsioon"}
                      </Button>
                      <span className="h-5 border-l border-input" />
                      <Input
                        value={bulkAlamsekt}
                        onChange={(e) => setBulkAlamsekt(e.target.value)}
                        placeholder="Alamsektsioon (nt Püstikud)"
                        className="h-8 w-44 text-sm"
                      />
                      <Button
                        onClick={doSetAlamsekt}
                        disabled={busy !== null}
                        variant="primary"
                        size="sm"
                        title={
                          bulkAlamsekt.trim()
                            ? `Määra alamsektsiooniks "${bulkAlamsekt.trim()}"`
                            : "Tühi väärtus eemaldab alamsektsiooni"
                        }
                      >
                        {busy === "alamsekt" ? <Loader2 className="h-4 w-4 animate-spin" /> : <FolderTree className="h-4 w-4" />}
                        {bulkAlamsekt.trim() ? "Määra alamsekt." : "Eemalda alamsekt."}
                      </Button>
                      <span className="h-5 border-l border-input" />
                      <Input
                        value={bulkKate}
                        onChange={(e) => setBulkKate(e.target.value)}
                        placeholder="Kate (nt 1,30)"
                        className="h-8 w-28 text-sm"
                        type="text"
                        inputMode="decimal"
                      />
                      <Button
                        onClick={doSetKate}
                        disabled={busy !== null}
                        variant="primary"
                        size="sm"
                        title={
                          bulkKate.trim()
                            ? `Määra kate ${bulkKate.trim()}× valitud ridadele`
                            : "Tühi väärtus = kasuta pakkumise vaikimisi"
                        }
                      >
                        {busy === "kate" ? <Loader2 className="h-4 w-4 animate-spin" /> : <Percent className="h-4 w-4" />}
                        {bulkKate.trim() ? "Määra kate" : "Eemalda kate"}
                      </Button>
                      <span className="h-5 border-l border-input" />
                      <Button onClick={() => setSelected(new Set())} variant="ghost" size="sm">
                        Tühista valik
                      </Button>
                      <Button onClick={() => setConfirming(true)} variant="destructive" size="sm">
                        <Trash2 className="h-4 w-4" />
                        Kustuta ({count})
                      </Button>
                    </>
                  )}
                </div>
              </div>
            </div>
          ) : null}

          {msg ? (
            <div
              className={`rounded-md px-3 py-2 text-sm ${
                msg.kind === "ok" ? "bg-vk-blue/10 text-vk-blue" : "bg-vk-red/10 text-vk-red"
              }`}
            >
              {msg.text}
            </div>
          ) : null}

          <div className="overflow-x-auto rounded-lg border">
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead className="w-[36px]">
                    <input
                      type="checkbox"
                      checked={visibleAllSelected}
                      ref={(el) => {
                        if (el) el.indeterminate = visibleSomeSelected;
                      }}
                      onChange={(e) => toggleAllVisible(e.target.checked)}
                      aria-label="Vali kõik nähtavad"
                      className="h-4 w-4 cursor-pointer"
                    />
                  </TableHead>
                  <TableHead className="w-[36px]">#</TableHead>
                  <TableHead className="min-w-[200px]">Mahutabeli toode</TableHead>
                  <TableHead className="w-[80px] text-right">Kogus</TableHead>
                  <TableHead className="min-w-[220px]">Tarnija toode</TableHead>
                  <TableHead className="w-[100px] text-right">Ostuhind</TableHead>
                  <TableHead className="w-[80px] text-right">Aeg h/üh</TableHead>
                  <TableHead className="w-[80px] text-right">Kate ×</TableHead>
                  <TableHead className="w-[110px] text-right">Materjal €</TableHead>
                  <TableHead className="w-[110px] text-right">Töö €</TableHead>
                  <TableHead className="w-[110px] text-right font-semibold">Kokku €</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {grouped.length === 0 ? (
                  <TableRow>
                    <TableCell colSpan={11} className="py-8 text-center text-muted-foreground">
                      Ühtegi positsiooni ei leitud.
                    </TableCell>
                  </TableRow>
                ) : (
                  grouped.flatMap(([sekt, subList]) => {
                    const sektLabel = sektsiooniLabel(sekt);
                    const sektCalc = sektsiooniArvutus.get(sekt);
                    const sektRidadeIdid: string[] = [];
                    for (const [, rrs] of subList) for (const r of rrs) sektRidadeIdid.push(r.id);
                    const isEditingThisSekt = editingSekt === sekt;
                    const renderedRows: React.ReactNode[] = [];
                    renderedRows.push(
                      <TableRow key={`hdr-${sekt}`} className="bg-muted/30">
                        <TableCell
                          colSpan={8}
                          className="py-2 text-xs font-semibold uppercase tracking-wide text-muted-foreground"
                        >
                          <span className="inline-flex flex-wrap items-center gap-3">
                            {isEditingThisSekt ? (
                              <span className="inline-flex items-center gap-1.5">
                                <Input
                                  autoFocus
                                  value={editSektNimi}
                                  onChange={(e) => setEditSektNimi(e.target.value)}
                                  onKeyDown={(e) => {
                                    if (e.key === "Enter") {
                                      e.preventDefault();
                                      salvestaSektEdit(sekt, sektRidadeIdid);
                                    } else if (e.key === "Escape") {
                                      tühistaSektEdit();
                                    }
                                  }}
                                  disabled={editSektBusy}
                                  className="h-7 w-72 text-xs uppercase tracking-wide text-vk-navy"
                                  placeholder="nt 723 Soojusallikas"
                                />
                                <button
                                  type="button"
                                  onClick={() => salvestaSektEdit(sekt, sektRidadeIdid)}
                                  disabled={editSektBusy}
                                  className="rounded bg-vk-blue px-2 py-1 text-[10px] font-medium normal-case text-white hover:bg-vk-blue/90"
                                  title="Salvesta sektsiooni uus nimi (Enter)"
                                >
                                  {editSektBusy ? (
                                    <Loader2 className="inline h-3 w-3 animate-spin" />
                                  ) : (
                                    <Check className="inline h-3 w-3" />
                                  )}
                                  Salvesta
                                </button>
                                <button
                                  type="button"
                                  onClick={tühistaSektEdit}
                                  disabled={editSektBusy}
                                  className="rounded border border-input bg-background px-2 py-1 text-[10px] font-normal normal-case text-muted-foreground hover:bg-muted"
                                  title="Tühista (Esc)"
                                >
                                  <X className="inline h-3 w-3" />
                                </button>
                                <span className="text-[10px] font-normal normal-case text-muted-foreground">
                                  mõjutab {sektRidadeIdid.length} rida
                                </span>
                              </span>
                            ) : (
                              <>
                                <span>{sektLabel}</span>
                                {sektCalc ? (
                                  <span className="font-mono text-vk-navy">
                                    · {sektCalc.linkitud}/{sektCalc.kokkuRidu} linkitud
                                  </span>
                                ) : null}
                                <button
                                  type="button"
                                  onClick={() => alustaSektEditi(sekt)}
                                  className="rounded border border-input bg-background p-1 text-muted-foreground hover:border-vk-blue hover:text-vk-blue"
                                  title="Muuda sektsiooni nime"
                                >
                                  <Pencil className="h-3 w-3" />
                                </button>
                                <button
                                  type="button"
                                  onClick={() => avaLisaDialog(sekt, "")}
                                  className="rounded border border-input bg-background px-2 py-0.5 text-[10px] font-normal normal-case text-vk-blue hover:bg-vk-blue/10"
                                  title="Lisa uus rida sellele sektsioonile"
                                >
                                  + Lisa rida
                                </button>
                                <button
                                  type="button"
                                  onClick={() => avaVaruDialog(sekt, "")}
                                  className="rounded border border-amber-300 bg-amber-50 px-2 py-0.5 text-[10px] font-normal normal-case text-amber-900 hover:bg-amber-100"
                                  title="Lisa varu (% sektsiooni materjalist)"
                                >
                                  + Varu
                                </button>
                              </>
                            )}
                          </span>
                        </TableCell>
                        <TableCell className="py-2 text-right font-mono text-xs font-semibold text-vk-navy">
                          {sektCalc ? formatEur(sektCalc.materjal) : "—"}
                        </TableCell>
                        <TableCell className="py-2 text-right font-mono text-xs font-semibold text-vk-navy">
                          {sektCalc ? formatEur(sektCalc.töö) : "—"}
                        </TableCell>
                        <TableCell className="py-2 text-right font-mono text-xs font-semibold text-vk-navy">
                          {sektCalc ? formatEur(sektCalc.kokku) : "—"}
                        </TableCell>
                      </TableRow>,
                    );
                    for (const [sub, rows] of subList) {
                      const subCalc = sektCalc?.alamsektsioonid.get(sub);
                      // Alamsekt päise rida — kuva ainult kui >1 alamsektsioon või kui pole placeholder
                      const showSubHeader = subList.length > 1 || sub !== ALAMSEKT_PLACEHOLDER;
                      if (showSubHeader) {
                        const dialogAlamsekt = sub === ALAMSEKT_PLACEHOLDER ? "" : sub;
                        renderedRows.push(
                          <TableRow key={`subhdr-${sekt}-${sub}`} className="bg-muted/10">
                            <TableCell
                              colSpan={8}
                              className="py-1.5 pl-8 text-[11px] font-medium text-muted-foreground"
                            >
                              <span className="inline-flex items-center gap-3">
                                <span>
                                  ↳ {sub === ALAMSEKT_PLACEHOLDER ? <span className="italic">üldine</span> : sub}
                                </span>
                                {subCalc ? (
                                  <span className="font-mono">
                                    · {subCalc.linkitud}/{subCalc.kokkuRidu}
                                  </span>
                                ) : null}
                                <button
                                  type="button"
                                  onClick={() => avaLisaDialog(sekt, dialogAlamsekt)}
                                  className="rounded border border-input bg-background px-2 py-0.5 text-[10px] font-normal text-vk-blue hover:bg-vk-blue/10"
                                  title={
                                    dialogAlamsekt
                                      ? `Lisa uus rida alamsektsiooni "${dialogAlamsekt}"`
                                      : "Lisa uus rida üldiseks (ilma alamsektsioonita)"
                                  }
                                >
                                  + Lisa rida {dialogAlamsekt ? `(${dialogAlamsekt})` : "(üldine)"}
                                </button>
                              </span>
                            </TableCell>
                            <TableCell className="py-1.5 text-right font-mono text-[11px]">
                              {subCalc ? formatEur(subCalc.materjal) : "—"}
                            </TableCell>
                            <TableCell className="py-1.5 text-right font-mono text-[11px]">
                              {subCalc ? formatEur(subCalc.töö) : "—"}
                            </TableCell>
                            <TableCell className="py-1.5 text-right font-mono text-[11px] font-semibold">
                              {subCalc ? formatEur(subCalc.kokku) : "—"}
                            </TableCell>
                          </TableRow>,
                        );
                      }
                      for (const p of rows) {
                        const a = rowCalcs.get(p.id) ?? { materjal_neto: 0, töö_neto: 0, kokku_neto: 0 };
                        const isReserv = p.reservi_koefitsent !== null && p.reservi_koefitsent !== undefined;
                        renderedRows.push(
                          <TableRow
                            key={p.id}
                            data-selected={selected.has(p.id) || undefined}
                            className={isReserv ? "bg-amber-50/50 italic" : undefined}
                          >
                            <TableCell>
                              <input
                                type="checkbox"
                                checked={selected.has(p.id)}
                                onChange={(e) => toggleOne(p.id, e.target.checked)}
                                aria-label={`Vali rida ${p.id}`}
                                className="h-4 w-4 cursor-pointer"
                              />
                            </TableCell>
                            <TableCell className="font-mono text-xs">{p.rea_nr ?? "—"}</TableCell>
                            <TableCell>
                              <div className="space-y-1">
                                <div className="flex flex-wrap items-center gap-2">
                                  <NimetusInput positsioonId={p.id} algne={p.nimetus} />
                                  <TähisInput positsioonId={p.id} algne={p.tähis} />
                                </div>
                                <KirjeldusInput positsioonId={p.id} algne={p.kirjeldus} />
                              </div>
                            </TableCell>
                            <TableCell className="text-right">
                              <KogusInput
                                positsioonId={p.id}
                                algne={p.kogus}
                                ühik={p.ühik}
                              />
                            </TableCell>
                            <TableCell>
                              {p.toode_id ? (
                                <div className="space-y-0.5">
                                  <div className="text-[11px]">
                                    <span className="rounded bg-vk-navy/10 px-1 text-[10px]">
                                      {p.toode_snapshot_tarnija ?? "—"}
                                    </span>
                                    {p.toode_snapshot_kood ? (
                                      <span className="ml-1 font-mono text-muted-foreground">{p.toode_snapshot_kood}</span>
                                    ) : null}
                                    {p.toode_snapshot_brand ? (
                                      <span className="ml-1 text-muted-foreground">· {p.toode_snapshot_brand}</span>
                                    ) : null}
                                  </div>
                                  <div className="text-xs">
                                    <Link href={`/kataloog/${p.toode_id}`} className="hover:underline">
                                      {p.toode_snapshot_nimetus}
                                    </Link>
                                  </div>
                                  <ToodeValija
                                    positsioonId={p.id}
                                    algneOtsing={`${p.nimetus} ${p.tähis ?? ""}`.trim()}
                                    praeguneToodeId={p.toode_id}
                                  />
                                </div>
                              ) : (
                                <ToodeValija
                                  positsioonId={p.id}
                                  algneOtsing={`${p.nimetus} ${p.tähis ?? ""}`.trim()}
                                  praeguneToodeId={null}
                                />
                              )}
                            </TableCell>
                            <TableCell className="text-right">
                              <OstuhindInput
                                positsioonId={p.id}
                                algne={p.ostuhind_snapshot}
                                onToode={p.toode_id !== null}
                              />
                            </TableCell>
                            <TableCell className="text-right">
                              <PaigaldusaegInput positsioonId={p.id} algne={p.paigaldusaeg_snapshot} />
                            </TableCell>
                            <TableCell className="text-right">
                              <KateInput
                                positsioonId={p.id}
                                algne={p.kate_snapshot}
                                vaikimisi={kate_koefitsient}
                              />
                            </TableCell>
                            <TableCell className="text-right font-mono text-xs">
                              {a.materjal_neto > 0 ? formatEur(a.materjal_neto) : "—"}
                            </TableCell>
                            <TableCell className="text-right font-mono text-xs">
                              {a.töö_neto > 0 ? formatEur(a.töö_neto) : "—"}
                            </TableCell>
                            <TableCell className="text-right font-mono text-xs font-semibold text-vk-navy">
                              {a.kokku_neto > 0 ? formatEur(a.kokku_neto) : "—"}
                            </TableCell>
                          </TableRow>,
                        );
                      }
                    }
                    return renderedRows;
                  })
                )}
              </TableBody>
            </Table>
          </div>
        </CardContent>
      </Card>

      {/* Koondvaade */}
      {positsioonid.length > 0 ? (
        <Card>
          <CardHeader>
            <CardTitle>Pakkumise koond</CardTitle>
            <CardDescription>
              {linkitudKokku} linkitud positsiooni / {positsioonid.length} kokku. Alamsektsioonid kuvatud sissetõmbega.
            </CardDescription>
          </CardHeader>
          <CardContent className="space-y-3">
            <div className="overflow-x-auto">
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>Sektsioon</TableHead>
                    <TableHead className="w-[80px] text-right">Read</TableHead>
                    <TableHead className="w-[140px] text-right">Materjal €</TableHead>
                    <TableHead className="w-[140px] text-right">Töö €</TableHead>
                    <TableHead className="w-[140px] text-right font-semibold">Kokku €</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {sections.flatMap(([key]) => {
                    const sektLabel = sektsiooniLabel(key);
                    const v = sektsiooniArvutus.get(key);
                    if (!v) return [];
                    const rows: React.ReactNode[] = [];
                    rows.push(
                      <TableRow key={`sekt-${key}`} className="bg-muted/20">
                        <TableCell className="font-semibold">{sektLabel}</TableCell>
                        <TableCell className="text-right font-mono text-xs">
                          {v.linkitud}/{v.kokkuRidu}
                        </TableCell>
                        <TableCell className="text-right font-mono text-xs">{formatEur(v.materjal)}</TableCell>
                        <TableCell className="text-right font-mono text-xs">{formatEur(v.töö)}</TableCell>
                        <TableCell className="text-right font-mono font-semibold text-vk-navy">{formatEur(v.kokku)}</TableCell>
                      </TableRow>,
                    );
                    // Kuva alamsektsioonid kui neid on >1 (siis on tähendust)
                    const alamList = Array.from(v.alamsektsioonid.entries()).sort(([a], [b]) => {
                      if (a === ALAMSEKT_PLACEHOLDER) return 1;
                      if (b === ALAMSEKT_PLACEHOLDER) return -1;
                      return a.localeCompare(b);
                    });
                    if (alamList.length > 1) {
                      for (const [sub, sCalc] of alamList) {
                        rows.push(
                          <TableRow key={`sekt-${key}-sub-${sub}`}>
                            <TableCell className="pl-8 text-xs text-muted-foreground">
                              {sub === ALAMSEKT_PLACEHOLDER ? (
                                <span className="italic">üldine</span>
                              ) : (
                                <>↳ {sektLabel} — {sub}</>
                              )}
                            </TableCell>
                            <TableCell className="text-right font-mono text-xs text-muted-foreground">
                              {sCalc.linkitud}/{sCalc.kokkuRidu}
                            </TableCell>
                            <TableCell className="text-right font-mono text-xs text-muted-foreground">{formatEur(sCalc.materjal)}</TableCell>
                            <TableCell className="text-right font-mono text-xs text-muted-foreground">{formatEur(sCalc.töö)}</TableCell>
                            <TableCell className="text-right font-mono text-xs text-muted-foreground">{formatEur(sCalc.kokku)}</TableCell>
                          </TableRow>,
                        );
                      }
                    }
                    return rows;
                  })}
                  <TableRow className="border-t-2 bg-muted/40 font-semibold">
                    <TableCell>Kogusumma (neto)</TableCell>
                    <TableCell className="text-right font-mono text-xs">
                      {linkitudKokku}/{positsioonid.length}
                    </TableCell>
                    <TableCell className="text-right font-mono text-sm">{formatEur(grandTotal.materjal)}</TableCell>
                    <TableCell className="text-right font-mono text-sm">{formatEur(grandTotal.töö)}</TableCell>
                    <TableCell className="text-right font-mono text-sm text-vk-navy">{formatEur(grandTotal.neto)}</TableCell>
                  </TableRow>
                  <TableRow>
                    <TableCell colSpan={4} className="text-right text-sm">
                      KM ({(km_määr * 100).toFixed(0)}%)
                    </TableCell>
                    <TableCell className="text-right font-mono text-sm">{formatEur(grandTotal.km)}</TableCell>
                  </TableRow>
                  <TableRow className="bg-vk-blue/5 font-bold">
                    <TableCell colSpan={4} className="text-right">
                      Pakkumus kokku (bruto)
                    </TableCell>
                    <TableCell className="text-right font-mono text-base text-vk-blue">{formatEur(grandTotal.bruto)}</TableCell>
                  </TableRow>
                </TableBody>
              </Table>
            </div>
            <div className="text-xs text-muted-foreground">
              <strong>Arvutus:</strong> materjal = kogus × ostuhind × kate ({kate_koefitsient.toFixed(2)}); töö = kogus × paigaldusaeg × tunnitasu ({formatEur(tunnitasu)}/h). Sektsiooni summa = materjal + töö. Pakkumus bruto = (kogusumma neto) × (1 + KM).
            </div>
          </CardContent>
        </Card>
      ) : null}

      {/* Inline kate-edit komponent */}
      <LisaPositsioonDialog
        key={addCtx ? `${addCtx.sektsioon}|${addCtx.alamsektsioon}` : "closed"}
        pakkumineId={pakkumineId}
        open={addCtx !== null}
        onOpenChange={(o) => {
          if (!o) setAddCtx(null);
        }}
        initialSektsioon={addCtx?.sektsioon ?? ""}
        initialAlamsektsioon={addCtx?.alamsektsioon ?? ""}
      />
      <LisaVaruDialog
        key={varuCtx ? `varu-${varuCtx.sektsioon}|${varuCtx.alamsektsioon}` : "varu-closed"}
        pakkumineId={pakkumineId}
        sektsioon={varuCtx?.sektsioon ?? ""}
        alamsektsioon={varuCtx?.alamsektsioon ?? ""}
        open={varuCtx !== null}
        onOpenChange={(o) => {
          if (!o) setVaruCtx(null);
        }}
      />
    </>
  );
}

function KirjeldusInput({
  positsioonId,
  algne,
}: {
  positsioonId: string;
  algne: string | null;
}) {
  const router = useRouter();
  const [value, setValue] = useState(algne ?? "");
  const [näita, setNäita] = useState(!!algne);
  const [busy, setBusy] = useState(false);
  const [state, setState] = useState<"idle" | "ok" | "err">("idle");
  const [, startNav] = useTransition();

  async function save() {
    const trimmed = value.trim();
    const current = (algne ?? "").trim();
    if (trimmed === current) return;
    setBusy(true);
    setState("idle");
    const r = await muudaPositsiooniInfo(positsioonId, {
      kirjeldus: trimmed === "" ? null : trimmed,
    });
    setBusy(false);
    if (r.ok) {
      setState("ok");
      startNav(() => router.refresh());
      setTimeout(() => setState("idle"), 1500);
    } else {
      setState("err");
    }
  }

  if (!näita && !value) {
    return (
      <button
        type="button"
        onClick={() => setNäita(true)}
        className="text-[11px] text-muted-foreground hover:text-vk-blue hover:underline"
      >
        + lisa kirjeldus
      </button>
    );
  }

  const dirty = value !== (algne ?? "");
  const borderClass =
    state === "ok"
      ? "border-vk-blue"
      : state === "err" || dirty
        ? "border-amber-400 bg-amber-50"
        : "border-transparent hover:border-input";

  return (
    <div className="flex items-start gap-1">
      <textarea
        value={value}
        onChange={(e) => {
          setValue(e.target.value);
          setState("idle");
        }}
        onBlur={save}
        rows={Math.max(1, Math.min(4, value.split("\n").length))}
        disabled={busy}
        placeholder="Kliendile nähtav rea kirjeldus…"
        className={`flex-1 resize-y rounded-md border bg-transparent px-2 py-1 text-[11px] italic text-muted-foreground focus:border-input focus:not-italic focus:text-vk-navy focus:outline-none focus:ring-2 focus:ring-ring ${borderClass}`}
      />
      {busy ? (
        <Loader2 className="mt-1 h-3 w-3 animate-spin text-muted-foreground" />
      ) : state === "ok" ? (
        <Check className="mt-1 h-3 w-3 text-vk-blue" />
      ) : null}
    </div>
  );
}

function NimetusInput({ positsioonId, algne }: { positsioonId: string; algne: string }) {
  const router = useRouter();
  const [value, setValue] = useState(algne);
  const [busy, setBusy] = useState(false);
  const [state, setState] = useState<"idle" | "ok" | "err">("idle");
  const [, startNav] = useTransition();

  // Otsing
  const [tulemused, setTulemused] = useState<ToodeKandidaat[]>([]);
  const [dropdownAvatud, setDropdownAvatud] = useState(false);
  const [valitudIdx, setValitudIdx] = useState(-1);
  const [searching, startSearch] = useTransition();
  const wrapperRef = useRef<HTMLDivElement>(null);

  // Sulge dropdown väljaspool-klikiga
  useEffect(() => {
    function onClick(e: MouseEvent) {
      if (wrapperRef.current && !wrapperRef.current.contains(e.target as Node)) {
        setDropdownAvatud(false);
      }
    }
    if (dropdownAvatud) {
      document.addEventListener("mousedown", onClick);
      return () => document.removeEventListener("mousedown", onClick);
    }
  }, [dropdownAvatud]);

  // Debounce-otsing
  useEffect(() => {
    if (!dropdownAvatud) return;
    const v = value.trim();
    if (v.length < 2) {
      setTulemused([]);
      return;
    }
    const t = setTimeout(() => {
      startSearch(async () => {
        const r = await otsiTooteid(v);
        setTulemused(r);
        setValitudIdx(-1);
      });
    }, 220);
    return () => clearTimeout(t);
  }, [value, dropdownAvatud]);

  async function save() {
    if (value === algne || dropdownAvatud) return;
    const trimmed = value.trim();
    if (!trimmed) {
      setState("err");
      setValue(algne);
      return;
    }
    setBusy(true);
    setState("idle");
    const r = await muudaPositsiooniInfo(positsioonId, { nimetus: trimmed });
    setBusy(false);
    if (r.ok) {
      setState("ok");
      startNav(() => router.refresh());
      setTimeout(() => setState("idle"), 1500);
    } else {
      setState("err");
    }
  }

  async function lingiToode(t: ToodeKandidaat) {
    setDropdownAvatud(false);
    setTulemused([]);
    setBusy(true);
    setState("idle");
    const r = await seoToode(positsioonId, t.id);
    setBusy(false);
    if (r.ok) {
      setValue(t.tarnija_nimetus);
      setState("ok");
      startNav(() => router.refresh());
      setTimeout(() => setState("idle"), 1500);
    } else {
      setState("err");
    }
  }

  function onKey(e: React.KeyboardEvent<HTMLInputElement>) {
    if (dropdownAvatud && tulemused.length > 0) {
      if (e.key === "ArrowDown") {
        e.preventDefault();
        setValitudIdx((i) => Math.min(i + 1, tulemused.length - 1));
        return;
      }
      if (e.key === "ArrowUp") {
        e.preventDefault();
        setValitudIdx((i) => Math.max(i - 1, -1));
        return;
      }
      if (e.key === "Enter" && valitudIdx >= 0 && tulemused[valitudIdx]) {
        e.preventDefault();
        lingiToode(tulemused[valitudIdx]);
        return;
      }
    }
    if (e.key === "Escape") {
      e.preventDefault();
      setDropdownAvatud(false);
      return;
    }
    if (e.key === "Enter") {
      e.preventDefault();
      setDropdownAvatud(false);
      (e.target as HTMLInputElement).blur();
    }
  }

  const dirty = value !== algne;
  const borderClass =
    state === "ok"
      ? "border-vk-blue"
      : state === "err" || dirty
        ? "border-amber-400 bg-amber-50"
        : "border-transparent";

  return (
    <div ref={wrapperRef} className="relative flex flex-1 min-w-[160px] items-center gap-1">
      <Search className="pointer-events-none absolute left-1.5 top-1/2 h-3 w-3 -translate-y-1/2 text-muted-foreground/60" />
      <input
        value={value}
        onChange={(e) => {
          setValue(e.target.value);
          setState("idle");
          setDropdownAvatud(true);
        }}
        onFocus={() => {
          if (value.trim().length >= 2) setDropdownAvatud(true);
        }}
        onBlur={() => {
          // Lükka save mõni ms, et dropdown-i klõpsamise event jõuaks ennetada
          setTimeout(() => save(), 150);
        }}
        onKeyDown={onKey}
        disabled={busy}
        className={`flex-1 rounded-md border bg-transparent pl-6 pr-2 py-1 text-sm hover:border-input focus:border-input focus:outline-none focus:ring-2 focus:ring-ring ${borderClass}`}
      />
      {busy ? (
        <Loader2 className="h-3 w-3 animate-spin text-muted-foreground" />
      ) : state === "ok" ? (
        <Check className="h-3 w-3 text-vk-blue" />
      ) : null}

      {/* Dropdown otsingu tulemustega */}
      {dropdownAvatud && (searching || tulemused.length > 0) ? (
        <div className="absolute left-0 top-full z-20 mt-1 w-[420px] max-w-[90vw] rounded-md border bg-card shadow-lg">
          {searching ? (
            <div className="px-3 py-2 text-xs text-muted-foreground">
              <Loader2 className="mr-1 inline h-3 w-3 animate-spin" />
              Otsin…
            </div>
          ) : null}
          <ul className="max-h-64 overflow-y-auto">
            {tulemused.map((t, idx) => (
              <li key={t.id}>
                <button
                  type="button"
                  onMouseDown={(e) => {
                    e.preventDefault();
                    lingiToode(t);
                  }}
                  onMouseEnter={() => setValitudIdx(idx)}
                  className={`block w-full px-3 py-1.5 text-left text-xs ${
                    idx === valitudIdx ? "bg-vk-blue/10" : "hover:bg-muted/50"
                  }`}
                >
                  <div className="flex items-center justify-between gap-2">
                    <div className="font-medium text-vk-navy">
                      <span className="rounded bg-vk-navy/10 px-1 text-[10px]">{t.tarnija}</span>
                      {t.tarnija_kood ? (
                        <span className="ml-1 font-mono text-muted-foreground">{t.tarnija_kood}</span>
                      ) : null}
                    </div>
                    <span className="font-mono text-vk-blue">{formatEur(t.ostuhind_neto)}</span>
                  </div>
                  <div className="text-muted-foreground">{t.tarnija_nimetus}</div>
                </button>
              </li>
            ))}
          </ul>
          {tulemused.length === 0 && !searching && value.trim().length >= 2 ? (
            <div className="px-3 py-2 text-xs text-muted-foreground">
              Ei leidnud — jätka tippimist või vajuta Esc et sulgeda
            </div>
          ) : null}
        </div>
      ) : null}
    </div>
  );
}

function TähisInput({ positsioonId, algne }: { positsioonId: string; algne: string | null }) {
  const router = useRouter();
  const [value, setValue] = useState(algne ?? "");
  const [busy, setBusy] = useState(false);
  const [state, setState] = useState<"idle" | "ok" | "err">("idle");
  const [, startNav] = useTransition();

  async function save() {
    const initial = algne ?? "";
    if (value === initial) return;
    setBusy(true);
    setState("idle");
    const trimmed = value.trim();
    const r = await muudaPositsiooniInfo(positsioonId, {
      tähis: trimmed === "" ? null : trimmed,
    });
    setBusy(false);
    if (r.ok) {
      setState("ok");
      startNav(() => router.refresh());
      setTimeout(() => setState("idle"), 1500);
    } else {
      setState("err");
    }
  }

  const dirty = value !== (algne ?? "");
  const hasValue = value.trim().length > 0;
  // 3 stiili: täidetud (kollane chip), tühi (punane hoiatus), pending (kollane border)
  let borderClass = "";
  let bgClass = "";
  let textClass = "";
  if (state === "ok") {
    borderClass = "border-vk-blue";
    bgClass = "";
    textClass = "";
  } else if (state === "err" || dirty) {
    borderClass = "border-amber-400";
    bgClass = "bg-amber-50";
  } else if (hasValue) {
    borderClass = "border-amber-200";
    bgClass = "bg-amber-100";
    textClass = "text-amber-900 font-semibold";
  } else {
    borderClass = "border-vk-red/40";
    bgClass = "bg-vk-red/5";
    textClass = "italic text-vk-red placeholder:text-vk-red/60";
  }

  return (
    <div className="flex items-center gap-1">
      <input
        value={value}
        onChange={(e) => {
          setValue(e.target.value);
          setState("idle");
        }}
        onBlur={save}
        onKeyDown={(e) => {
          if (e.key === "Enter") {
            e.preventDefault();
            (e.target as HTMLInputElement).blur();
          }
        }}
        placeholder={hasValue ? "" : "⚠ mõõt"}
        title={hasValue ? `Mõõt: ${value}` : "Sisesta toote mõõt (auto-propagatsioon vajab)"}
        disabled={busy}
        className={`w-24 rounded border px-1.5 py-0.5 text-center font-mono text-[11px] focus:outline-none focus:ring-2 focus:ring-ring ${borderClass} ${bgClass} ${textClass}`}
      />
      {busy ? (
        <Loader2 className="h-3 w-3 animate-spin text-muted-foreground" />
      ) : state === "ok" ? (
        <Check className="h-3 w-3 text-vk-blue" />
      ) : null}
    </div>
  );
}

function OstuhindInput({
  positsioonId,
  algne,
  onToode,
}: {
  positsioonId: string;
  algne: number | null;
  onToode: boolean;
}) {
  const router = useRouter();
  const [value, setValue] = useState(algne === null ? "" : String(algne).replace(".", ","));
  const [busy, setBusy] = useState(false);
  const [state, setState] = useState<"idle" | "ok" | "err">("idle");
  const [, startNav] = useTransition();

  async function save() {
    const initial = algne === null ? "" : String(algne).replace(".", ",");
    if (value === initial) return;
    setBusy(true);
    setState("idle");
    const trimmed = value.trim();
    let newHind: number | null;
    if (trimmed === "") {
      newHind = null;
    } else {
      const n = Number(trimmed.replace(",", "."));
      if (!Number.isFinite(n) || n < 0) {
        setState("err");
        setBusy(false);
        return;
      }
      newHind = n;
    }
    const r = await muudaPositsiooniOstuhind(positsioonId, newHind);
    setBusy(false);
    if (r.ok) {
      setState("ok");
      startNav(() => router.refresh());
      setTimeout(() => setState("idle"), 1500);
    } else {
      setState("err");
    }
  }

  const dirty = value !== (algne === null ? "" : String(algne).replace(".", ","));
  const borderClass =
    state === "ok"
      ? "border-vk-blue"
      : state === "err" || dirty
        ? "border-amber-400 bg-amber-50"
        : "";

  return (
    <div className="flex items-center justify-end gap-1">
      <input
        value={value}
        onChange={(e) => {
          setValue(e.target.value);
          setState("idle");
        }}
        onBlur={save}
        onKeyDown={(e) => {
          if (e.key === "Enter") {
            e.preventDefault();
            (e.target as HTMLInputElement).blur();
          }
        }}
        placeholder={onToode ? "snapshot" : "hüpot."}
        title={
          onToode
            ? "Toodelt snapshot'itud ostuhind. Saad käsitsi üle kirjutada (override)."
            : "Hüpoteetiline ostuhind — pole tooteid linkitud. Sisesta otse."
        }
        disabled={busy}
        className={`h-7 w-20 rounded-md border border-input bg-background px-2 text-right font-mono text-xs ${
          !onToode && algne === null && !dirty ? "border-dashed italic placeholder:text-vk-red/60" : ""
        } ${borderClass}`}
      />
      {busy ? (
        <Loader2 className="h-3 w-3 animate-spin text-muted-foreground" />
      ) : state === "ok" ? (
        <Check className="h-3 w-3 text-vk-blue" />
      ) : null}
    </div>
  );
}

function KogusInput({
  positsioonId,
  algne,
  ühik,
}: {
  positsioonId: string;
  algne: number | null;
  ühik: string | null;
}) {
  const router = useRouter();
  const [value, setValue] = useState(algne === null ? "" : String(algne).replace(".", ","));
  const [busy, setBusy] = useState(false);
  const [state, setState] = useState<"idle" | "ok" | "err">("idle");
  const [, startNav] = useTransition();

  async function save() {
    const initial = algne === null ? "" : String(algne).replace(".", ",");
    if (value === initial) return;
    setBusy(true);
    setState("idle");
    const trimmed = value.trim();
    let newKogus: number | null;
    if (trimmed === "") {
      newKogus = null;
    } else {
      const n = Number(trimmed.replace(",", "."));
      if (!Number.isFinite(n) || n < 0) {
        setState("err");
        setBusy(false);
        return;
      }
      newKogus = n;
    }
    const r = await muudaPositsiooniKogus(positsioonId, newKogus);
    setBusy(false);
    if (r.ok) {
      setState("ok");
      startNav(() => router.refresh());
      setTimeout(() => setState("idle"), 1500);
    } else {
      setState("err");
    }
  }

  const dirty = value !== (algne === null ? "" : String(algne).replace(".", ","));
  const borderClass =
    state === "ok"
      ? "border-vk-blue"
      : state === "err" || dirty
        ? "border-amber-400 bg-amber-50"
        : "";

  return (
    <div className="flex items-center justify-end gap-1">
      <input
        value={value}
        onChange={(e) => {
          setValue(e.target.value);
          setState("idle");
        }}
        onBlur={save}
        onKeyDown={(e) => {
          if (e.key === "Enter") {
            e.preventDefault();
            (e.target as HTMLInputElement).blur();
          }
        }}
        placeholder="—"
        disabled={busy}
        className={`h-7 w-16 rounded-md border border-input bg-background px-2 text-right font-mono text-xs ${borderClass}`}
      />
      <span className="text-[10px] text-muted-foreground">{ühik ?? ""}</span>
      {busy ? (
        <Loader2 className="h-3 w-3 animate-spin text-muted-foreground" />
      ) : state === "ok" ? (
        <Check className="h-3 w-3 text-vk-blue" />
      ) : null}
    </div>
  );
}

function PaigaldusaegInput({
  positsioonId,
  algne,
}: {
  positsioonId: string;
  algne: number | null;
}) {
  const router = useRouter();
  const [value, setValue] = useState(algne === null ? "" : String(algne).replace(".", ","));
  const [busy, setBusy] = useState(false);
  const [state, setState] = useState<"idle" | "ok" | "err">("idle");
  const [, startNav] = useTransition();

  async function save() {
    const initial = algne === null ? "" : String(algne).replace(".", ",");
    if (value === initial) return;
    setBusy(true);
    setState("idle");
    const trimmed = value.trim();
    let newAeg: number | null;
    if (trimmed === "") {
      newAeg = null;
    } else {
      const n = Number(trimmed.replace(",", "."));
      if (!Number.isFinite(n) || n < 0) {
        setState("err");
        setBusy(false);
        return;
      }
      newAeg = n;
    }
    const r = await muudaPositsiooniPaigaldusaeg(positsioonId, newAeg);
    setBusy(false);
    if (r.ok) {
      setState("ok");
      startNav(() => router.refresh());
      setTimeout(() => setState("idle"), 1500);
    } else {
      setState("err");
    }
  }

  const dirty = value !== (algne === null ? "" : String(algne).replace(".", ","));
  const borderClass =
    state === "ok"
      ? "border-vk-blue"
      : state === "err" || dirty
        ? "border-amber-400 bg-amber-50"
        : "";

  return (
    <div className="flex items-center justify-end gap-1">
      <input
        value={value}
        onChange={(e) => {
          setValue(e.target.value);
          setState("idle");
        }}
        onBlur={save}
        onKeyDown={(e) => {
          if (e.key === "Enter") {
            e.preventDefault();
            (e.target as HTMLInputElement).blur();
          }
        }}
        placeholder="—"
        title={algne === null ? "Tühi = töötasu ei arvestata" : `${algne} h/ühik`}
        disabled={busy}
        className={`h-7 w-16 rounded-md border border-input bg-background px-2 text-right font-mono text-xs ${borderClass}`}
      />
      {busy ? (
        <Loader2 className="h-3 w-3 animate-spin text-muted-foreground" />
      ) : state === "ok" ? (
        <Check className="h-3 w-3 text-vk-blue" />
      ) : null}
    </div>
  );
}

function KateInput({
  positsioonId,
  algne,
  vaikimisi,
}: {
  positsioonId: string;
  algne: number | null;
  vaikimisi: number;
}) {
  const router = useRouter();
  const [value, setValue] = useState(algne === null ? "" : String(algne).replace(".", ","));
  const [busy, setBusy] = useState(false);
  const [state, setState] = useState<"idle" | "ok" | "err">("idle");
  const [, startNav] = useTransition();

  async function save() {
    const initial = algne === null ? "" : String(algne).replace(".", ",");
    if (value === initial) return;
    setBusy(true);
    setState("idle");
    const trimmed = value.trim();
    let newKate: number | null;
    if (trimmed === "") {
      newKate = null;
    } else {
      const n = Number(trimmed.replace(",", "."));
      if (!Number.isFinite(n) || n <= 0) {
        setState("err");
        setBusy(false);
        return;
      }
      newKate = n;
    }
    const r = await muudaPositsiooniKate(positsioonId, newKate);
    setBusy(false);
    if (r.ok) {
      setState("ok");
      startNav(() => router.refresh());
      setTimeout(() => setState("idle"), 1500);
    } else {
      setState("err");
    }
  }

  const efektiivne = algne ?? vaikimisi;
  const dirty = value !== (algne === null ? "" : String(algne).replace(".", ","));
  const borderClass =
    state === "ok"
      ? "border-vk-blue"
      : state === "err" || dirty
        ? "border-amber-400 bg-amber-50"
        : "";

  return (
    <div className="flex items-center justify-end gap-1">
      <input
        value={value}
        onChange={(e) => {
          setValue(e.target.value);
          setState("idle");
        }}
        onBlur={save}
        onKeyDown={(e) => {
          if (e.key === "Enter") {
            e.preventDefault();
            (e.target as HTMLInputElement).blur();
          }
        }}
        placeholder={vaikimisi.toFixed(2)}
        title={
          algne === null
            ? `Kasutab pakkumise vaikimisi (${vaikimisi.toFixed(2)}×)`
            : `Override: ${algne.toFixed(2)}×`
        }
        disabled={busy}
        className={`h-7 w-14 rounded-md border border-input bg-background px-2 text-right font-mono text-xs ${borderClass}`}
      />
      {busy ? (
        <Loader2 className="h-3 w-3 animate-spin text-muted-foreground" />
      ) : state === "ok" ? (
        <Check className="h-3 w-3 text-vk-blue" />
      ) : null}
    </div>
  );
}
