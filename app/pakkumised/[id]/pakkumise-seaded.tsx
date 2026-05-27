"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Loader2, Save, Undo2 } from "lucide-react";
import { muudaPakkumiseSeaded } from "../actions";

type Props = {
  pakkumineId: string;
  algneTunnitasu: number;
  algneKate: number;
  algneKmMäär: number;
};

function numFromString(s: string): number {
  return Number(s.replace(",", "."));
}

export function PakkumiseSeadedForm({ pakkumineId, algneTunnitasu, algneKate, algneKmMäär }: Props) {
  const router = useRouter();
  const [pending, startTransition] = useTransition();
  const [tunnitasu, setTunnitasu] = useState(String(algneTunnitasu).replace(".", ","));
  const [kate, setKate] = useState(String(algneKate).replace(".", ","));
  const [kmProtsent, setKmProtsent] = useState(String((algneKmMäär * 100).toFixed(0)));
  const [msg, setMsg] = useState<{ kind: "ok" | "err"; text: string } | null>(null);

  const dirty =
    numFromString(tunnitasu) !== algneTunnitasu ||
    numFromString(kate) !== algneKate ||
    numFromString(kmProtsent) / 100 !== algneKmMäär;

  async function save() {
    setMsg(null);
    const t = numFromString(tunnitasu);
    const k = numFromString(kate);
    const km = numFromString(kmProtsent) / 100;
    if (!Number.isFinite(t) || t <= 0) {
      setMsg({ kind: "err", text: "Tunnitasu peab olema positiivne arv" });
      return;
    }
    if (!Number.isFinite(k) || k <= 0) {
      setMsg({ kind: "err", text: "Kate peab olema positiivne arv (nt 1,30)" });
      return;
    }
    if (!Number.isFinite(km) || km < 0 || km > 1) {
      setMsg({ kind: "err", text: "KM peab olema 0–100% vahel" });
      return;
    }
    startTransition(async () => {
      const r = await muudaPakkumiseSeaded(pakkumineId, {
        tunnitasu: t,
        kate_koefitsient: k,
        km_määr: km,
      });
      if (r.ok) {
        setMsg({ kind: "ok", text: "Salvestatud — arvutused uuendatud" });
        router.refresh();
      } else {
        setMsg({ kind: "err", text: r.error });
      }
    });
  }

  function revert() {
    setTunnitasu(String(algneTunnitasu).replace(".", ","));
    setKate(String(algneKate).replace(".", ","));
    setKmProtsent(String((algneKmMäär * 100).toFixed(0)));
    setMsg(null);
  }

  return (
    <Card>
      <CardHeader className="pb-3">
        <CardTitle className="text-base">Arvutus-parameetrid</CardTitle>
        <CardDescription className="text-xs">
          Tunnitasu rakendub kõikide ridade töö-arvutusele. Kate-koefitsient on vaikimisi
          materjali-juurdehindlus (read võivad oma kate üle kirjutada). KM rakendub lõpukoondile.
          Muudatus mõjutab kohe kogu pakkumise summat.
        </CardDescription>
      </CardHeader>
      <CardContent>
        <div className="flex flex-wrap items-end gap-4">
          <div className="space-y-1">
            <Label htmlFor="tunnitasu" className="text-xs">
              Tunnitasu (€/h)
            </Label>
            <Input
              id="tunnitasu"
              value={tunnitasu}
              onChange={(e) => setTunnitasu(e.target.value)}
              type="text"
              inputMode="decimal"
              className={`h-9 w-28 text-right font-mono ${dirty ? "border-amber-400 bg-amber-50" : ""}`}
            />
          </div>
          <div className="space-y-1">
            <Label htmlFor="kate" className="text-xs">
              Kate-koefitsient (×)
            </Label>
            <Input
              id="kate"
              value={kate}
              onChange={(e) => setKate(e.target.value)}
              type="text"
              inputMode="decimal"
              className={`h-9 w-28 text-right font-mono ${dirty ? "border-amber-400 bg-amber-50" : ""}`}
            />
          </div>
          <div className="space-y-1">
            <Label htmlFor="km" className="text-xs">
              KM määr (%)
            </Label>
            <Input
              id="km"
              value={kmProtsent}
              onChange={(e) => setKmProtsent(e.target.value)}
              type="text"
              inputMode="decimal"
              className={`h-9 w-28 text-right font-mono ${dirty ? "border-amber-400 bg-amber-50" : ""}`}
            />
          </div>
          {dirty ? (
            <div className="flex items-center gap-2">
              <Button onClick={save} disabled={pending} variant="primary" size="sm">
                {pending ? <Loader2 className="h-4 w-4 animate-spin" /> : <Save className="h-4 w-4" />}
                Salvesta
              </Button>
              <Button onClick={revert} disabled={pending} variant="ghost" size="sm">
                <Undo2 className="h-4 w-4" />
                Tagasta
              </Button>
            </div>
          ) : null}
          {msg ? (
            <div
              className={`rounded-md px-3 py-1.5 text-sm ${
                msg.kind === "ok" ? "bg-vk-blue/10 text-vk-blue" : "bg-vk-red/10 text-vk-red"
              }`}
            >
              {msg.text}
            </div>
          ) : null}
        </div>
      </CardContent>
    </Card>
  );
}
