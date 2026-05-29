"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import {
  Download,
  Upload,
  Loader2,
  CheckCircle2,
  AlertTriangle,
  FileSpreadsheet,
  AlertCircle,
} from "lucide-react";
import {
  parsiImpordiFail,
  impordiValitudRead,
  type ImpordiRida,
} from "./actions";
import { formatEur } from "@/lib/utils";

type Tulemus = {
  uuendatud: number;
  loodud: number;
  vigade_arv: number;
  vea_näited: string[];
  kontrollitud: number;
};

export function ImportExportPaneel() {
  const router = useRouter();
  const [pending, startTransition] = useTransition();
  const [fileName, setFileName] = useState("");
  const [err, setErr] = useState<string | null>(null);
  const [tulemus, setTulemus] = useState<Tulemus | null>(null);

  // Preview olek
  const [previewOpen, setPreviewOpen] = useState(false);
  const [previewRead, setPreviewRead] = useState<ImpordiRida[] | null>(null);
  const [previewValitud, setPreviewValitud] = useState<Record<string, boolean>>({});
  const [previewMeta, setPreviewMeta] = useState<{
    duplikaate: number;
    pärit_nimi: string;
  } | null>(null);

  async function onParse(formData: FormData) {
    setErr(null);
    setTulemus(null);
    startTransition(async () => {
      const r = await parsiImpordiFail(formData);
      if (!r.ok) {
        setErr(r.error);
        return;
      }
      setPreviewRead(r.read);
      setPreviewMeta({ duplikaate: r.duplikaate, pärit_nimi: r.pärit_nimi });
      // Vaikimisi kõik linnukesed peal
      const initial: Record<string, boolean> = {};
      for (const rida of r.read) initial[rida._tempId] = true;
      setPreviewValitud(initial);
      setPreviewOpen(true);
    });
  }

  function valiKõik() {
    if (!previewRead) return;
    const all: Record<string, boolean> = {};
    for (const r of previewRead) all[r._tempId] = true;
    setPreviewValitud(all);
  }
  function tühistaKõik() {
    if (!previewRead) return;
    const none: Record<string, boolean> = {};
    for (const r of previewRead) none[r._tempId] = false;
    setPreviewValitud(none);
  }
  function valiAinultUued() {
    if (!previewRead) return;
    const kaart: Record<string, boolean> = {};
    for (const r of previewRead) kaart[r._tempId] = !r.duplikaat;
    setPreviewValitud(kaart);
  }
  function lülitaRida(tempId: string) {
    setPreviewValitud((prev) => ({ ...prev, [tempId]: !prev[tempId] }));
  }

  function onImpordi() {
    if (!previewRead) return;
    const valitudRead = previewRead.filter((r) => previewValitud[r._tempId]);
    if (valitudRead.length === 0) {
      setErr("Pole ühtegi rida valitud");
      return;
    }
    setErr(null);
    startTransition(async () => {
      const r = await impordiValitudRead(valitudRead);
      if ("error" in r) {
        setErr(r.error);
      } else {
        setTulemus(r);
        setPreviewOpen(false);
        setPreviewRead(null);
        setPreviewMeta(null);
        setPreviewValitud({});
        router.refresh();
      }
    });
  }

  const valitudArv = previewRead
    ? previewRead.filter((r) => previewValitud[r._tempId]).length
    : 0;
  const valitudSumma = previewRead
    ? previewRead
        .filter((r) => previewValitud[r._tempId])
        .reduce((s, r) => s + (r.ostuhind_neto ?? 0), 0)
    : 0;

  return (
    <>
      <Card>
        <CardHeader>
          <div className="flex items-start justify-between gap-3">
            <div>
              <CardTitle className="flex items-center gap-2 text-base">
                <FileSpreadsheet className="h-4 w-4 text-vk-blue" />
                Excel export / import
              </CardTitle>
              <CardDescription>
                Lae alla CSV-na, redigeeri Excelis, lae üles tagasi. Eelvaate
                tabelis vali linnukestega read mida importida. Duplikaadid
                (sama tarnija + kood juba kataloogis) on märgitud.
              </CardDescription>
            </div>
            <Button asChild variant="outline" size="sm">
              <a href="/api/kataloog/export" download>
                <Download className="h-4 w-4" />
                Lae alla CSV
              </a>
            </Button>
          </div>
        </CardHeader>
        <CardContent className="space-y-3">
          <form action={onParse} className="space-y-2">
            <div className="flex items-center gap-2">
              <Input
                name="fail"
                type="file"
                accept=".csv,.xlsx,.xls"
                required
                onChange={(e) => setFileName(e.target.files?.[0]?.name ?? "")}
                className="cursor-pointer"
              />
              <Button type="submit" disabled={pending} variant="primary" size="sm">
                {pending ? (
                  <Loader2 className="h-4 w-4 animate-spin" />
                ) : (
                  <Upload className="h-4 w-4" />
                )}
                Loe fail & ava eelvaade
              </Button>
            </div>
            <p className="text-[10px] text-muted-foreground">
              Toetatud .csv ja .xlsx. Eelvaates saad valida millised read importida.
              {fileName ? <span className="ml-1 font-medium">Valitud: {fileName}</span> : null}
            </p>
          </form>

          {err ? (
            <div className="flex items-start gap-2 rounded-md bg-vk-red/10 px-3 py-2 text-sm text-vk-red">
              <AlertTriangle className="mt-0.5 h-4 w-4 shrink-0" />
              <div>{err}</div>
            </div>
          ) : null}

          {tulemus ? (
            <div className="space-y-2 rounded-md border border-vk-blue/30 bg-vk-blue/5 px-3 py-2 text-sm">
              <div className="flex items-center gap-2 font-semibold text-vk-blue">
                <CheckCircle2 className="h-4 w-4" />
                {tulemus.uuendatud} uuendatud · {tulemus.loodud} uut toodet · {tulemus.kontrollitud}{" "}
                rida kontrollitud
              </div>
              {tulemus.vigade_arv > 0 ? (
                <div>
                  <div className="text-xs font-medium text-vk-red">
                    {tulemus.vigade_arv} viga / hoiatust:
                  </div>
                  <ul className="mt-1 max-h-32 list-disc space-y-0.5 overflow-y-auto pl-5 text-[11px] text-muted-foreground">
                    {tulemus.vea_näited.map((v, i) => (
                      <li key={i}>{v}</li>
                    ))}
                  </ul>
                </div>
              ) : null}
            </div>
          ) : null}
        </CardContent>
      </Card>

      <Dialog open={previewOpen} onOpenChange={setPreviewOpen}>
        <DialogContent className="max-h-[90vh] max-w-5xl overflow-hidden p-0">
          <DialogHeader className="border-b px-6 pt-5 pb-3">
            <DialogTitle>Impordi eelvaade</DialogTitle>
            <DialogDescription>
              {previewMeta ? (
                <>
                  <span className="font-mono">{previewMeta.pärit_nimi}</span>
                  {" · "}
                  {previewRead?.length} rida parsitud
                  {previewMeta.duplikaate > 0 ? (
                    <>
                      {" · "}
                      <span className="text-amber-700">
                        {previewMeta.duplikaate} duplikaati (sama kood juba kataloogis)
                      </span>
                    </>
                  ) : null}
                </>
              ) : null}
            </DialogDescription>
          </DialogHeader>

          {/* Toolbar */}
          <div className="flex flex-wrap items-center justify-between gap-3 border-b bg-muted/30 px-6 py-2 text-xs">
            <span className="font-medium text-vk-navy">
              Valitud: <span className="font-mono">{valitudArv}</span> /{" "}
              {previewRead?.length ?? 0} ·{" "}
              <span className="text-muted-foreground">summa {formatEur(valitudSumma)}</span>
            </span>
            <div className="flex flex-wrap gap-1.5">
              <Button onClick={valiKõik} variant="ghost" size="sm" className="h-7">
                Vali kõik
              </Button>
              <Button
                onClick={valiAinultUued}
                variant="ghost"
                size="sm"
                className="h-7"
                disabled={!previewRead || previewMeta?.duplikaate === 0}
                title="Vali ainult need read, mille kood pole veel kataloogis"
              >
                Vali ainult uued
              </Button>
              <Button onClick={tühistaKõik} variant="ghost" size="sm" className="h-7">
                Tühista kõik
              </Button>
            </div>
          </div>

          {/* Tabel */}
          <div className="max-h-[55vh] overflow-y-auto">
            <table className="w-full text-sm">
              <thead className="sticky top-0 bg-card shadow-sm">
                <tr className="border-b text-[11px] uppercase tracking-wider text-muted-foreground">
                  <th className="w-10 p-2 text-center"></th>
                  <th className="w-12 p-2 text-right">#</th>
                  <th className="p-2 text-left">Nimetus</th>
                  <th className="w-24 p-2 text-left">Kood</th>
                  <th className="w-28 p-2 text-left">Tarnija</th>
                  <th className="w-16 p-2 text-center">Ühik</th>
                  <th className="w-24 p-2 text-right">Ostuhind</th>
                  <th className="w-32 p-2 text-left">Olek</th>
                </tr>
              </thead>
              <tbody>
                {previewRead?.map((r) => {
                  const checked = previewValitud[r._tempId] ?? false;
                  return (
                    <tr
                      key={r._tempId}
                      className={`border-b hover:bg-muted/30 ${checked ? "" : "opacity-40"}`}
                    >
                      <td className="p-2 text-center">
                        <input
                          type="checkbox"
                          checked={checked}
                          onChange={() => lülitaRida(r._tempId)}
                          className="h-4 w-4 cursor-pointer accent-vk-blue"
                        />
                      </td>
                      <td className="p-2 text-right font-mono text-[11px] text-muted-foreground">
                        {r.rea_nr}
                      </td>
                      <td className="p-2">
                        <div className="text-sm">{r.tarnija_nimetus}</div>
                        {r.tähis ? (
                          <div className="text-[10px] font-mono text-muted-foreground">
                            {r.tähis}
                          </div>
                        ) : null}
                        {r.kirjeldus ? (
                          <div className="mt-0.5 line-clamp-1 text-[10px] italic text-muted-foreground">
                            {r.kirjeldus}
                          </div>
                        ) : null}
                      </td>
                      <td className="p-2 font-mono text-xs text-muted-foreground">
                        {r.tarnija_kood ?? "—"}
                      </td>
                      <td className="p-2 text-xs">{r.tarnija ?? "—"}</td>
                      <td className="p-2 text-center text-xs text-muted-foreground">
                        {r.ühik ?? "—"}
                      </td>
                      <td className="p-2 text-right font-mono text-xs">
                        {formatEur(r.ostuhind_neto)}
                      </td>
                      <td className="p-2 text-xs">
                        {r.id_olemas ? (
                          <span className="inline-flex items-center gap-1 rounded bg-vk-blue/10 px-1.5 py-0.5 text-[10px] text-vk-blue">
                            <CheckCircle2 className="h-2.5 w-2.5" />
                            uuendab id järgi
                          </span>
                        ) : r.duplikaat ? (
                          <span className="inline-flex items-center gap-1 rounded bg-amber-100 px-1.5 py-0.5 text-[10px] text-amber-900">
                            <AlertCircle className="h-2.5 w-2.5" />
                            juba kataloogis (uuendab)
                          </span>
                        ) : (
                          <span className="inline-flex items-center gap-1 rounded bg-emerald-50 px-1.5 py-0.5 text-[10px] text-emerald-800">
                            <CheckCircle2 className="h-2.5 w-2.5" />
                            uus toode
                          </span>
                        )}
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
            <Button variant="outline" onClick={() => setPreviewOpen(false)} disabled={pending}>
              Tühista
            </Button>
            <Button
              onClick={onImpordi}
              disabled={pending || valitudArv === 0}
              variant="primary"
            >
              {pending ? <Loader2 className="h-4 w-4 animate-spin" /> : <Upload className="h-4 w-4" />}
              Impordi {valitudArv} {valitudArv === 1 ? "rida" : "rida"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </>
  );
}
