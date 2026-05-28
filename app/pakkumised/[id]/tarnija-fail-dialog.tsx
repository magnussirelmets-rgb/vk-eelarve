"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  FileUp,
  Loader2,
  CheckCircle2,
  AlertTriangle,
  Upload,
  X,
} from "lucide-react";
import { formatEur, formatNum } from "@/lib/utils";
import { lisaTarnijaReadPakkumisse, type TarnijaPakkumiseRida } from "../actions";

type ParsedRow = TarnijaPakkumiseRida & {
  _tempId: string;
  _valitud: boolean;
  rea_nr?: number | null; // ainult display'iks (API-st saadav)
};

type Props = {
  pakkumineId: string;
  soovituslikudEriosad?: { kood: string; nimi: string }[];
};

export function TarnijaFailDialog({ pakkumineId, soovituslikudEriosad = [] }: Props) {
  const router = useRouter();
  const [open, setOpen] = useState(false);
  const [pending, startTransition] = useTransition();
  const [fileName, setFileName] = useState("");
  const [parsing, setParsing] = useState(false);
  const [parsed, setParsed] = useState<ParsedRow[] | null>(null);
  const [parseMeta, setParseMeta] = useState<{ faili_nimi: string; input_tokens: number; output_tokens: number } | null>(
    null,
  );
  const [err, setErr] = useState<string | null>(null);

  // Sektsiooni/alamsektsiooni valik
  const [sektsioon, setSektsioon] = useState("");
  const [alamsektsioon, setAlamsektsioon] = useState("");
  const [tarnijaNimi, setTarnijaNimi] = useState("");

  function reset() {
    setFileName("");
    setParsed(null);
    setParseMeta(null);
    setErr(null);
    setSektsioon("");
    setAlamsektsioon("");
    setTarnijaNimi("");
  }

  async function onUpload(formData: FormData) {
    setErr(null);
    setParsed(null);
    setParseMeta(null);
    setParsing(true);
    try {
      const r = await fetch(`/api/pakkumised/${pakkumineId}/parse-tarnija-fail`, {
        method: "POST",
        body: formData,
      });
      const data = await r.json();
      if (!r.ok || !data.ok) {
        setErr(data.error ?? "Parsing ebaõnnestus");
        return;
      }
      const rows: ParsedRow[] = (data.read as TarnijaPakkumiseRida[]).map((rida, i) => ({
        ...rida,
        _tempId: `rida-${i}`,
        _valitud: true,
      }));
      setParsed(rows);
      setParseMeta({
        faili_nimi: data.faili_nimi,
        input_tokens: data.input_tokens,
        output_tokens: data.output_tokens,
      });
      // Tarnija nimi vihje failinimest
      if (!tarnijaNimi) {
        const guess = data.faili_nimi.split(/[_\-\s.]/)[0];
        if (guess) setTarnijaNimi(guess);
      }
    } catch (e) {
      setErr(e instanceof Error ? e.message : String(e));
    } finally {
      setParsing(false);
    }
  }

  function valiKõik() {
    if (!parsed) return;
    setParsed(parsed.map((r) => ({ ...r, _valitud: true })));
  }
  function tühistaKõik() {
    if (!parsed) return;
    setParsed(parsed.map((r) => ({ ...r, _valitud: false })));
  }
  function lülitaRida(tempId: string) {
    if (!parsed) return;
    setParsed(parsed.map((r) => (r._tempId === tempId ? { ...r, _valitud: !r._valitud } : r)));
  }

  function onImpordi() {
    if (!parsed) return;
    const valitud = parsed.filter((r) => r._valitud);
    if (valitud.length === 0) {
      setErr("Pole ühtegi rida valitud");
      return;
    }
    setErr(null);
    startTransition(async () => {
      const r = await lisaTarnijaReadPakkumisse({
        pakkumineId,
        read: valitud.map((v) => ({
          tarnija_nimetus: v.tarnija_nimetus,
          tarnija_kood: v.tarnija_kood,
          tarnija_brand: v.tarnija_brand,
          ühik: v.ühik,
          kogus: v.kogus,
          ostuhind_neto: v.ostuhind_neto,
          kirjeldus: v.kirjeldus,
          sektsioon: v.sektsioon,
        })),
        sihtSektsioon: sektsioon.trim() || null,
        sihtAlamsektsioon: alamsektsioon.trim() || null,
        tarnija: tarnijaNimi.trim() || null,
      });
      if (r.ok) {
        setOpen(false);
        reset();
        router.refresh();
      } else {
        setErr(r.error);
      }
    });
  }

  const valitudArv = parsed?.filter((r) => r._valitud).length ?? 0;
  const valitudSumma =
    parsed?.filter((r) => r._valitud).reduce((s, r) => s + (r.ostuhind_neto ?? 0) * (r.kogus ?? 1), 0) ??
    0;

  return (
    <Dialog
      open={open}
      onOpenChange={(o) => {
        setOpen(o);
        if (!o) reset();
      }}
    >
      <DialogTrigger asChild>
        <Button variant="outline" size="sm">
          <FileUp className="h-4 w-4" />
          Lae tarnija pakkumine
        </Button>
      </DialogTrigger>
      <DialogContent className="max-h-[90vh] max-w-5xl overflow-hidden p-0">
        <DialogHeader className="border-b px-6 pt-5 pb-3">
          <DialogTitle>Lae tarnija pakkumine pakkumisse</DialogTitle>
          <DialogDescription>
            Lae PDF/Excel/CSV-fail (nt Küttemaailma pakkumus), AI parsib read, vali linnukestega
            need mis pakkumisse lisanduvad. Hind salvestub snapshot'ina — tarnija hinna muudatused
            hiljem EI mõjuta pakkumist.
          </DialogDescription>
        </DialogHeader>

        {!parsed ? (
          <form action={onUpload} className="space-y-3 px-6 py-4">
            <div className="space-y-1">
              <Label htmlFor="tarnija-fail">Fail</Label>
              <Input
                id="tarnija-fail"
                name="fail"
                type="file"
                accept=".pdf,.xlsx,.xls,.csv"
                required
                onChange={(e) => setFileName(e.target.files?.[0]?.name ?? "")}
                className="cursor-pointer"
              />
              <p className="text-[10px] text-muted-foreground">
                PDF, Excel või CSV. Max 20 MB. {fileName ? <span className="font-medium">Valitud: {fileName}</span> : null}
              </p>
            </div>
            {err ? (
              <div className="flex items-start gap-2 rounded-md bg-vk-red/10 px-3 py-2 text-sm text-vk-red">
                <AlertTriangle className="mt-0.5 h-4 w-4 shrink-0" />
                <div>{err}</div>
              </div>
            ) : null}
            <DialogFooter>
              <Button variant="ghost" onClick={() => setOpen(false)} type="button">
                Tühista
              </Button>
              <Button type="submit" disabled={parsing} variant="primary">
                {parsing ? <Loader2 className="h-4 w-4 animate-spin" /> : <Upload className="h-4 w-4" />}
                Parsi AI-ga
              </Button>
            </DialogFooter>
            {parsing ? (
              <div className="rounded-md border border-vk-blue/30 bg-vk-blue/5 px-3 py-2 text-xs text-vk-blue">
                AI parsib faili (Claude Sonnet 4.6) — 1–3 minutit suure faili puhul. Ära sulge dialoogi.
              </div>
            ) : null}
          </form>
        ) : (
          <>
            {/* PARSED — preview linnukestega */}
            <div className="flex flex-wrap items-center justify-between gap-3 border-b bg-muted/30 px-6 py-2 text-xs">
              <div className="space-y-0.5">
                <div className="font-medium text-vk-navy">
                  Parsitud: {parsed.length} · Valitud: <span className="font-mono">{valitudArv}</span>{" "}
                  · Summa <span className="font-mono">{formatEur(valitudSumma)}</span>
                </div>
                {parseMeta ? (
                  <div className="text-[10px] text-muted-foreground">
                    {parseMeta.faili_nimi} · tokens in={parseMeta.input_tokens} out=
                    {parseMeta.output_tokens}
                  </div>
                ) : null}
              </div>
              <div className="flex gap-1.5">
                <Button onClick={valiKõik} variant="ghost" size="sm" className="h-7">
                  Vali kõik
                </Button>
                <Button onClick={tühistaKõik} variant="ghost" size="sm" className="h-7">
                  Tühista kõik
                </Button>
                <Button
                  onClick={() => {
                    setParsed(null);
                    setParseMeta(null);
                  }}
                  variant="ghost"
                  size="sm"
                  className="h-7"
                  title="Lae teine fail"
                >
                  <X className="h-3 w-3" />
                  Lae teine
                </Button>
              </div>
            </div>

            {/* Valikud — kuhu lisada */}
            <div className="grid gap-2 border-b bg-muted/10 px-6 py-3 sm:grid-cols-3">
              <div className="space-y-1">
                <Label htmlFor="t-sekt" className="text-xs">
                  Eriosa (sektsioon)
                </Label>
                <Input
                  id="t-sekt"
                  value={sektsioon}
                  onChange={(e) => setSektsioon(e.target.value)}
                  placeholder="nt 725 Jahutus"
                  className="h-8 text-sm"
                />
                {soovituslikudEriosad.length > 0 ? (
                  <div className="flex flex-wrap gap-1">
                    {soovituslikudEriosad.map((e) => (
                      <button
                        key={e.kood}
                        type="button"
                        onClick={() => setSektsioon(`${e.kood} ${e.nimi}`)}
                        className="rounded border border-input bg-card px-1.5 py-0.5 font-mono text-[10px] text-muted-foreground hover:border-vk-blue hover:text-vk-navy"
                      >
                        {e.kood} {e.nimi}
                      </button>
                    ))}
                  </div>
                ) : null}
              </div>
              <div className="space-y-1">
                <Label htmlFor="t-alamsekt" className="text-xs">
                  Alamsektsioon (valikuline)
                </Label>
                <Input
                  id="t-alamsekt"
                  value={alamsektsioon}
                  onChange={(e) => setAlamsektsioon(e.target.value)}
                  placeholder="nt Multisplit"
                  className="h-8 text-sm"
                />
              </div>
              <div className="space-y-1">
                <Label htmlFor="t-tarnija" className="text-xs">
                  Tarnija nimi
                </Label>
                <Input
                  id="t-tarnija"
                  value={tarnijaNimi}
                  onChange={(e) => setTarnijaNimi(e.target.value)}
                  placeholder="nt Küttemaailm"
                  className="h-8 text-sm"
                />
              </div>
            </div>

            {/* Read */}
            <div className="max-h-[45vh] overflow-y-auto">
              <table className="w-full text-sm">
                <thead className="sticky top-0 bg-card shadow-sm">
                  <tr className="border-b text-[11px] uppercase tracking-wider text-muted-foreground">
                    <th className="w-10 p-2 text-center"></th>
                    <th className="w-12 p-2 text-right">#</th>
                    <th className="p-2 text-left">Nimetus</th>
                    <th className="w-20 p-2 text-left">Kood</th>
                    <th className="w-16 p-2 text-right">Kogus</th>
                    <th className="w-16 p-2 text-center">Ühik</th>
                    <th className="w-24 p-2 text-right">Ostuhind</th>
                    <th className="w-24 p-2 text-right">Summa</th>
                  </tr>
                </thead>
                <tbody>
                  {parsed.map((r, i) => {
                    const summa = (r.ostuhind_neto ?? 0) * (r.kogus ?? 1);
                    return (
                      <tr
                        key={r._tempId}
                        className={`border-b hover:bg-muted/30 ${r._valitud ? "" : "opacity-40"}`}
                      >
                        <td className="p-2 text-center">
                          <input
                            type="checkbox"
                            checked={r._valitud}
                            onChange={() => lülitaRida(r._tempId)}
                            className="h-4 w-4 cursor-pointer accent-vk-blue"
                          />
                        </td>
                        <td className="p-2 text-right font-mono text-[11px] text-muted-foreground">
                          {r.rea_nr ?? i + 1}
                        </td>
                        <td className="p-2">
                          <div className="text-sm">{r.tarnija_nimetus}</div>
                          {r.tarnija_brand ? (
                            <div className="text-[10px] text-muted-foreground">{r.tarnija_brand}</div>
                          ) : null}
                          {r.kirjeldus ? (
                            <div className="mt-0.5 line-clamp-1 text-[10px] italic text-muted-foreground">
                              {r.kirjeldus}
                            </div>
                          ) : null}
                          {r.sektsioon ? (
                            <div className="mt-0.5 text-[10px] text-vk-blue">↳ {r.sektsioon}</div>
                          ) : null}
                        </td>
                        <td className="p-2 font-mono text-xs text-muted-foreground">
                          {r.tarnija_kood ?? "—"}
                        </td>
                        <td className="p-2 text-right font-mono text-xs">
                          {r.kogus !== null ? formatNum(r.kogus) : "1"}
                        </td>
                        <td className="p-2 text-center text-xs text-muted-foreground">
                          {r.ühik ?? "tk"}
                        </td>
                        <td className="p-2 text-right font-mono text-xs">
                          {formatEur(r.ostuhind_neto)}
                        </td>
                        <td className="p-2 text-right font-mono text-xs font-semibold text-vk-navy">
                          {formatEur(summa)}
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>

            {err ? (
              <div className="mx-6 my-2 flex items-start gap-2 rounded-md bg-vk-red/10 px-3 py-2 text-sm text-vk-red">
                <AlertTriangle className="mt-0.5 h-4 w-4 shrink-0" />
                <div>{err}</div>
              </div>
            ) : null}

            <DialogFooter className="border-t bg-muted/20 px-6 py-3">
              <Button variant="outline" onClick={() => setOpen(false)} disabled={pending}>
                Tühista
              </Button>
              <Button onClick={onImpordi} disabled={pending || valitudArv === 0} variant="primary">
                {pending ? (
                  <Loader2 className="h-4 w-4 animate-spin" />
                ) : (
                  <CheckCircle2 className="h-4 w-4" />
                )}
                Lisa {valitudArv} rida pakkumisse
              </Button>
            </DialogFooter>
          </>
        )}
      </DialogContent>
    </Dialog>
  );
}
