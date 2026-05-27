"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Download, Upload, Loader2, CheckCircle2, AlertTriangle, FileSpreadsheet } from "lucide-react";
import { kataloogiImport } from "./actions";

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

  async function onSubmit(formData: FormData) {
    setErr(null);
    setTulemus(null);
    startTransition(async () => {
      const r = await kataloogiImport(formData);
      if ("error" in r) {
        setErr(r.error);
      } else {
        setTulemus(r);
        router.refresh();
      }
    });
  }

  return (
    <Card>
      <CardHeader>
        <div className="flex items-start justify-between gap-3">
          <div>
            <CardTitle className="flex items-center gap-2 text-base">
              <FileSpreadsheet className="h-4 w-4 text-vk-blue" />
              Excel export / import
            </CardTitle>
            <CardDescription>
              Lae alla kogu kataloog CSV-na (avab Exceliga), redigeeri väärtusi või lisa uusi
              tooteid, lae üles tagasi. Rida id-ga uuendatakse; tühja id-ga rida lisatakse uue
              tootena.
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
        <form action={onSubmit} className="space-y-2">
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
              {pending ? <Loader2 className="h-4 w-4 animate-spin" /> : <Upload className="h-4 w-4" />}
              Impordi
            </Button>
          </div>
          <p className="text-[10px] text-muted-foreground">
            Veerud (eestikeelne header): <span className="font-mono">id</span>{" "}
            <span className="font-mono">tarnija</span>{" "}
            <span className="font-mono">tarnija_kood</span>{" "}
            <span className="font-mono">tarnija_nimetus</span> (kohustuslik){" "}
            <span className="font-mono">tarnija_brand</span>{" "}
            <span className="font-mono">tähis</span> <span className="font-mono">ühik</span>{" "}
            <span className="font-mono">ostuhind</span>{" "}
            <span className="font-mono">paigaldusaeg_h</span>{" "}
            <span className="font-mono">kirjeldus</span>{" "}
            <span className="font-mono">alt_nimed</span>{" "}
            <span className="font-mono">sisemised_märkused</span>.
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
  );
}
