"use client";

import { useEffect, useRef, useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { Card, CardContent } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { Plus, Loader2, CheckCircle2, Search, Package, X } from "lucide-react";
import { cn, formatEur, formatNum } from "@/lib/utils";
import { lisaPositsioon, otsiTooteid, type ToodeKandidaat } from "../actions";

type SoovituslikEriosa = { kood: string; nimi: string };

type Props = {
  pakkumineId: string;
  soovituslikudEriosad?: SoovituslikEriosa[];
};

function parseNum(raw: string): number | null {
  const t = raw.trim();
  if (t === "") return null;
  const n = Number(t.replace(",", "."));
  return Number.isFinite(n) ? n : null;
}

export function KiirLisaRida({ pakkumineId, soovituslikudEriosad = [] }: Props) {
  const router = useRouter();
  const nimetusRef = useRef<HTMLInputElement>(null);
  const containerRef = useRef<HTMLDivElement>(null);

  // Sticky väärtused
  const [eriosa, setEriosa] = useState("");
  const [ühik, setÜhik] = useState("tk");

  // Per-rea väärtused
  const [nimetus, setNimetus] = useState("");
  const [tähis, setTähis] = useState("");
  const [kogus, setKogus] = useState("1");
  const [ostuhind, setOstuhind] = useState("");
  const [paigaldusaeg, setPaigaldusaeg] = useState("");
  const [kirjeldus, setKirjeldus] = useState("");
  const [näitaKirjeldust, setNäitaKirjeldust] = useState(false);

  // Toote-otsing
  const [valitudToode, setValitudToode] = useState<ToodeKandidaat | null>(null);
  const [tulemused, setTulemused] = useState<ToodeKandidaat[]>([]);
  const [dropdownAvatud, setDropdownAvatud] = useState(false);
  const [valitudIdx, setValitudIdx] = useState(-1);
  const [searching, startSearch] = useTransition();

  const [pending, startTransition] = useTransition();
  const [err, setErr] = useState<string | null>(null);
  const [lastAdded, setLastAdded] = useState<string | null>(null);

  // Sulge dropdown kui klikitakse väljapoole
  useEffect(() => {
    function handleClickOutside(e: MouseEvent) {
      if (containerRef.current && !containerRef.current.contains(e.target as Node)) {
        setDropdownAvatud(false);
      }
    }
    if (dropdownAvatud) {
      document.addEventListener("mousedown", handleClickOutside);
      return () => document.removeEventListener("mousedown", handleClickOutside);
    }
  }, [dropdownAvatud]);

  // Debounce-otsing kui nimetus muutub
  useEffect(() => {
    const v = nimetus.trim();
    if (v.length < 2 || valitudToode) {
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
  }, [nimetus, valitudToode]);

  function valiToode(t: ToodeKandidaat) {
    setValitudToode(t);
    setNimetus(t.tarnija_nimetus);
    setTähis(""); // tähis tuleb ostja-tähisest, mitte tarnija omast — jäta tühjaks
    setÜhik(t.ühik ?? "tk");
    setOstuhind(t.ostuhind_neto !== null ? String(t.ostuhind_neto).replace(".", ",") : "");
    setPaigaldusaeg(
      t.paigaldusaeg_h_ühik !== null ? String(t.paigaldusaeg_h_ühik).replace(".", ",") : "",
    );
    if (t.kirjeldus) {
      setKirjeldus(t.kirjeldus);
      setNäitaKirjeldust(true);
    }
    setDropdownAvatud(false);
    setTulemused([]);
    // Liiguta fookus kogus-välja peale (kasutaja peab tavaliselt koguse muutma)
    setTimeout(() => {
      const kog = document.getElementById("kiir-kogus");
      kog?.focus();
      (kog as HTMLInputElement | null)?.select();
    }, 50);
  }

  function tühjenda() {
    setValitudToode(null);
    setNimetus("");
    setTähis("");
    setKogus("1");
    setOstuhind("");
    setPaigaldusaeg("");
    setKirjeldus("");
    setNäitaKirjeldust(false);
    setDropdownAvatud(false);
    setTulemused([]);
    nimetusRef.current?.focus();
  }

  function submit() {
    if (!nimetus.trim()) {
      setErr("Nimetus on kohustuslik");
      nimetusRef.current?.focus();
      return;
    }
    setErr(null);
    setDropdownAvatud(false);

    const snapshot = nimetus.trim();
    const koguseStr = kogus.trim() || "1";
    const hinnaStr = ostuhind.trim();
    const summary = [
      snapshot,
      `${koguseStr} ${ühik || ""}`.trim(),
      hinnaStr ? `${hinnaStr} €` : "",
      valitudToode ? `(${valitudToode.tarnija})` : "",
    ]
      .filter(Boolean)
      .join(" · ");

    startTransition(async () => {
      const r = await lisaPositsioon({
        pakkumineId,
        sektsioon: eriosa.trim() || null,
        alamsektsioon: null,
        nimetus: snapshot,
        tähis: tähis.trim() || null,
        kogus: parseNum(kogus) ?? 1,
        ühik: ühik.trim() || null,
        ostuhind_snapshot: parseNum(ostuhind),
        paigaldusaeg_snapshot: parseNum(paigaldusaeg),
        märkused: null,
        kirjeldus: kirjeldus.trim() || null,
        toode_id: valitudToode?.id ?? null,
      });
      if (r.ok) {
        setLastAdded(summary);
        tühjenda();
        router.refresh();
      } else {
        setErr(r.error);
      }
    });
  }

  function onNimetusKey(e: React.KeyboardEvent<HTMLInputElement>) {
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
      if (e.key === "Enter") {
        if (valitudIdx >= 0 && tulemused[valitudIdx]) {
          e.preventDefault();
          valiToode(tulemused[valitudIdx]);
          return;
        }
      }
      if (e.key === "Escape") {
        e.preventDefault();
        setDropdownAvatud(false);
        return;
      }
    }
    if (e.key === "Enter" && !e.shiftKey) {
      e.preventDefault();
      submit();
    }
  }

  function onMuuKey(e: React.KeyboardEvent) {
    if (e.key === "Enter" && !e.shiftKey) {
      e.preventDefault();
      submit();
    }
  }

  return (
    <Card className="border-vk-blue/30 bg-vk-blue/5">
      <CardContent className="space-y-2 p-4" ref={containerRef}>
        <div className="flex flex-wrap items-center justify-between gap-2">
          <div className="flex items-center gap-2 text-sm font-semibold text-vk-navy">
            <Plus className="h-4 w-4 text-vk-blue" />
            Kiirlisa positsioon
            <span className="text-xs font-normal text-muted-foreground">
              (otsi nimetuse järgi · ↓↑ navigeeri · Enter = vali / lisa)
            </span>
          </div>
          {lastAdded ? (
            <span className="flex items-center gap-1 text-xs text-vk-blue">
              <CheckCircle2 className="h-3.5 w-3.5" />
              Lisatud: {lastAdded}
            </span>
          ) : null}
        </div>

        {/* Eriosa-rida */}
        <div className="flex flex-wrap items-center gap-1.5">
          <span className="text-xs font-medium text-muted-foreground">Eriosa:</span>
          {soovituslikudEriosad.map((e) => {
            const label = `${e.kood} ${e.nimi}`;
            const valitud = eriosa === label;
            return (
              <button
                key={e.kood}
                type="button"
                onClick={() => setEriosa(label)}
                className={cn(
                  "rounded border px-2 py-0.5 text-[11px] transition-colors",
                  valitud
                    ? "border-vk-blue bg-vk-blue text-white"
                    : "border-input bg-card text-muted-foreground hover:border-vk-blue hover:text-vk-navy",
                )}
              >
                <span className="font-mono">{e.kood}</span>{" "}
                <span className="hidden sm:inline">{e.nimi}</span>
              </button>
            );
          })}
          <Input
            value={eriosa}
            onChange={(e) => setEriosa(e.target.value)}
            placeholder="või sisesta käsitsi"
            className="h-7 max-w-[200px] text-xs"
          />
        </div>

        {/* Põhirida */}
        <div className="grid gap-2 sm:grid-cols-12">
          {/* Nimetus + dropdown */}
          <div className="relative sm:col-span-5">
            <div className="relative">
              <Search className="pointer-events-none absolute left-2 top-1/2 h-3.5 w-3.5 -translate-y-1/2 text-muted-foreground" />
              <Input
                ref={nimetusRef}
                value={nimetus}
                onChange={(e) => {
                  setNimetus(e.target.value);
                  if (valitudToode) setValitudToode(null); // kasutaja muutis manuaalselt
                  setDropdownAvatud(true);
                  setErr(null);
                }}
                onFocus={() => {
                  if (nimetus.trim().length >= 2 && !valitudToode) setDropdownAvatud(true);
                }}
                onKeyDown={onNimetusKey}
                placeholder="Otsi toodet / teenust (vähemalt 2 tähte) või kirjuta vabalt"
                className="h-9 pl-8"
                autoFocus
              />
              {valitudToode ? (
                <button
                  type="button"
                  onClick={tühjenda}
                  className="absolute right-2 top-1/2 -translate-y-1/2 rounded p-0.5 text-muted-foreground hover:bg-muted hover:text-vk-red"
                  title="Tühjenda valik"
                >
                  <X className="h-3 w-3" />
                </button>
              ) : null}
            </div>

            {/* Toote info kui valitud */}
            {valitudToode ? (
              <div className="mt-1 flex flex-wrap items-center gap-1 text-[10px] text-muted-foreground">
                <Package className="h-3 w-3 text-vk-blue" />
                <span className="rounded bg-vk-navy/10 px-1 font-mono">{valitudToode.tarnija}</span>
                {valitudToode.tarnija_kood ? (
                  <span className="font-mono">{valitudToode.tarnija_kood}</span>
                ) : null}
                {valitudToode.tarnija_brand ? (
                  <span>· {valitudToode.tarnija_brand}</span>
                ) : null}
              </div>
            ) : null}

            {/* Dropdown otsingu tulemustega */}
            {dropdownAvatud && (searching || tulemused.length > 0) ? (
              <div className="absolute z-10 mt-1 w-full max-w-md rounded-md border bg-card shadow-lg">
                {searching ? (
                  <div className="px-3 py-2 text-xs text-muted-foreground">
                    <Loader2 className="mr-1 inline h-3 w-3 animate-spin" />
                    Otsin…
                  </div>
                ) : null}
                <ul className="max-h-72 overflow-y-auto">
                  {tulemused.map((t, idx) => (
                    <li key={t.id}>
                      <button
                        type="button"
                        onMouseDown={(e) => {
                          e.preventDefault();
                          valiToode(t);
                        }}
                        onMouseEnter={() => setValitudIdx(idx)}
                        className={cn(
                          "block w-full px-3 py-1.5 text-left text-xs",
                          idx === valitudIdx ? "bg-vk-blue/10" : "hover:bg-muted/50",
                        )}
                      >
                        <div className="flex items-center justify-between gap-2">
                          <div className="font-medium text-vk-navy">
                            <span className="rounded bg-vk-navy/10 px-1 text-[10px]">{t.tarnija}</span>
                            {t.tarnija_kood ? (
                              <span className="ml-1 font-mono text-muted-foreground">
                                {t.tarnija_kood}
                              </span>
                            ) : null}
                            {t.tarnija_brand ? (
                              <span className="ml-1 text-muted-foreground">· {t.tarnija_brand}</span>
                            ) : null}
                          </div>
                          <span className="font-mono text-vk-blue">{formatEur(t.ostuhind_neto)}</span>
                        </div>
                        <div className="text-muted-foreground">{t.tarnija_nimetus}</div>
                        {t.paigaldusaeg_h_ühik !== null ? (
                          <div className="text-[10px] text-muted-foreground">
                            paigald. {formatNum(t.paigaldusaeg_h_ühik)} h/{t.ühik ?? "—"}
                          </div>
                        ) : null}
                      </button>
                    </li>
                  ))}
                </ul>
                {tulemused.length === 0 && !searching ? (
                  <div className="px-3 py-2 text-xs text-muted-foreground">
                    Ei leidnud — vajuta Enter, et lisada käsitsi sisestatud rida
                  </div>
                ) : null}
              </div>
            ) : null}
          </div>

          <Input
            value={tähis}
            onChange={(e) => setTähis(e.target.value)}
            onKeyDown={onMuuKey}
            placeholder="Tähis"
            className="h-9 sm:col-span-2"
          />
          <Input
            id="kiir-kogus"
            value={kogus}
            onChange={(e) => setKogus(e.target.value)}
            onKeyDown={onMuuKey}
            inputMode="decimal"
            placeholder="Kogus"
            className="h-9 text-right font-mono sm:col-span-1"
          />
          <Input
            value={ühik}
            onChange={(e) => setÜhik(e.target.value)}
            onKeyDown={onMuuKey}
            placeholder="tk"
            className="h-9 text-center sm:col-span-1"
          />
          <Input
            value={ostuhind}
            onChange={(e) => setOstuhind(e.target.value)}
            onKeyDown={onMuuKey}
            inputMode="decimal"
            placeholder="Hind €"
            className="h-9 text-right font-mono sm:col-span-1"
          />
          <Input
            value={paigaldusaeg}
            onChange={(e) => setPaigaldusaeg(e.target.value)}
            onKeyDown={onMuuKey}
            inputMode="decimal"
            placeholder="Aeg h"
            className="h-9 text-right font-mono sm:col-span-1"
          />
          <Button
            onClick={submit}
            disabled={pending}
            variant="primary"
            size="sm"
            className="h-9 sm:col-span-1"
          >
            {pending ? (
              <Loader2 className="h-4 w-4 animate-spin" />
            ) : (
              <>
                <Plus className="h-4 w-4" />
                <span className="ml-1 hidden sm:inline">Lisa</span>
              </>
            )}
          </Button>
        </div>

        {/* Kirjeldus */}
        <div>
          {!näitaKirjeldust && !kirjeldus ? (
            <button
              type="button"
              onClick={() => setNäitaKirjeldust(true)}
              className="text-xs text-vk-blue hover:underline"
            >
              + Lisa rea kirjeldus
            </button>
          ) : (
            <div className="space-y-1">
              <div className="flex items-center justify-between">
                <label htmlFor="kirj-rea" className="text-xs font-medium text-muted-foreground">
                  Rea kirjeldus (kliendile nähtav printvormis)
                </label>
                <button
                  type="button"
                  onClick={() => {
                    setKirjeldus("");
                    setNäitaKirjeldust(false);
                  }}
                  className="text-[10px] text-muted-foreground hover:text-vk-red"
                >
                  ✕ peida
                </button>
              </div>
              <textarea
                id="kirj-rea"
                value={kirjeldus}
                onChange={(e) => setKirjeldus(e.target.value)}
                rows={2}
                placeholder="nt 'Daikin Altherma 3 H HT, 14 kW, monoblock välisüksus + sisemoodul'"
                className="w-full rounded-md border border-input bg-background px-2 py-1.5 text-xs"
              />
            </div>
          )}
        </div>

        {err ? (
          <div className="rounded-md bg-vk-red/10 px-2 py-1 text-xs text-vk-red">{err}</div>
        ) : null}
      </CardContent>
    </Card>
  );
}
