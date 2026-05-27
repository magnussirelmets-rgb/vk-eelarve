"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Loader2, Download, Upload, FileSpreadsheet, CheckCircle2, AlertTriangle } from "lucide-react";
import { uuendaKirjeldusedExcelist } from "../actions";

type Props = {
  hinnakirjaId: string;
};

type Tulemus = {
  uuendatud: number;
  kontrollitudRidu: number;
  matchimataKoodid: string[];
};

export function KirjeldusedUpload({ hinnakirjaId }: Props) {
  const router = useRouter();
  const [pending, startTransition] = useTransition();
  const [fileName, setFileName] = useState("");
  const [err, setErr] = useState<string | null>(null);
  const [tulemus, setTulemus] = useState<Tulemus | null>(null);

  async function onSubmit(formData: FormData) {
    setErr(null);
    setTulemus(null);
    startTransition(async () => {
      const r = await uuendaKirjeldusedExcelist(hinnakirjaId, formData);
      if (r.ok) {
        setTulemus({
          uuendatud: r.uuendatud,
          kontrollitudRidu: r.kontrollitudRidu,
          matchimataKoodid: r.matchimataKoodid,
        });
        router.refresh();
      } else {
        setErr(r.error);
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
              Tootekirjeldused (mass-uuendus)
            </CardTitle>
            <CardDescription>
              Lae alla CSV-mall praeguste ridadega, täida &quot;kirjeldus&quot; veerg Excelis ja lae fail
              tagasi üles. Süsteem matchib koodi (või id) järgi ja uuendab kirjeldused.
            </CardDescription>
          </div>
          <Button asChild variant="outline" size="sm">
            <a href={`/api/hinnakirjad/${hinnakirjaId}/csv-template`} download>
              <Download className="h-4 w-4" />
              Lae alla CSV
            </a>
          </Button>
        </div>
      </CardHeader>
      <CardContent className="space-y-3">
        <form action={onSubmit} className="space-y-3">
          <div className="space-y-1">
            <Label htmlFor="kirj-fail">Lae üles täidetud Excel / CSV</Label>
            <div className="flex items-center gap-2">
              <Input
                id="kirj-fail"
                name="fail"
                type="file"
                accept=".csv,.xlsx,.xls"
                required
                onChange={(e) => setFileName(e.target.files?.[0]?.name ?? "")}
                className="cursor-pointer"
              />
              <Button type="submit" disabled={pending} variant="primary" size="sm">
                {pending ? <Loader2 className="h-4 w-4 animate-spin" /> : <Upload className="h-4 w-4" />}
                Uuenda kirjeldused
              </Button>
            </div>
            <p className="text-[10px] text-muted-foreground">
              Toetatud: .csv (eraldaja ; või ,) ja .xlsx. Vajalikud veerud:{" "}
              <span className="font-mono">tarnija_kood</span> (või{" "}
              <span className="font-mono">id</span>) ja{" "}
              <span className="font-mono">kirjeldus</span>. Tühjade kirjeldustega ridu ignoreeritakse.
              {fileName ? <span className="ml-1 font-medium">Valitud: {fileName}</span> : null}
            </p>
          </div>
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
              Uuendatud {tulemus.uuendatud} / {tulemus.kontrollitudRidu} kirjeldust
            </div>
            {tulemus.matchimataKoodid.length > 0 ? (
              <div className="text-xs text-muted-foreground">
                Failis olid järgmised koodid, mida selles hinnakirjas ei leitud:{" "}
                <span className="font-mono">{tulemus.matchimataKoodid.join(", ")}</span>
                {tulemus.matchimataKoodid.length >= 20 ? "…" : ""}
              </div>
            ) : null}
          </div>
        ) : null}
      </CardContent>
    </Card>
  );
}
