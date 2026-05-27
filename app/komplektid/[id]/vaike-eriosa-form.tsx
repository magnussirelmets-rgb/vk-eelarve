"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Loader2, Save, Tag } from "lucide-react";
import { muudaKomplekti } from "../actions";

type Props = {
  komplektId: string;
  algneSektsioon: string | null;
  algneAlamsektsioon: string | null;
};

export function VaikeEriosaForm({ komplektId, algneSektsioon, algneAlamsektsioon }: Props) {
  const router = useRouter();
  const [sektsioon, setSektsioon] = useState(algneSektsioon ?? "");
  const [alamsektsioon, setAlamsektsioon] = useState(algneAlamsektsioon ?? "");
  const [msg, setMsg] = useState<{ kind: "ok" | "err"; text: string } | null>(null);
  const [pending, startTransition] = useTransition();

  function save() {
    setMsg(null);
    startTransition(async () => {
      const r = await muudaKomplekti(komplektId, {
        vaike_sektsioon: sektsioon.trim() || null,
        vaike_alamsektsioon: alamsektsioon.trim() || null,
      });
      if (r.ok) {
        setMsg({ kind: "ok", text: "Salvestatud" });
        router.refresh();
      } else {
        setMsg({ kind: "err", text: r.error });
      }
    });
  }

  return (
    <Card>
      <CardHeader>
        <CardTitle className="flex items-center gap-2 text-base">
          <Tag className="h-4 w-4 text-vk-blue" />
          Vaike-eriosa
        </CardTitle>
        <CardDescription>
          Kui komplekt on alati seotud sama eriosaga (nt &quot;726 Puurkaevude rajamine&quot;), siis
          määra siin vaikeväärtused. &quot;Lisa komplekt eriosana&quot; dialoog pakkumistes
          eelvalib need automaatselt — uus töötaja ei pea eriosa pähe õppima.
        </CardDescription>
      </CardHeader>
      <CardContent className="space-y-3">
        <div className="grid gap-3 sm:grid-cols-2">
          <div className="space-y-1">
            <Label htmlFor="vaike-sekt">Eriosa (sektsioon)</Label>
            <Input
              id="vaike-sekt"
              value={sektsioon}
              onChange={(e) => setSektsioon(e.target.value)}
              placeholder="nt 726 Puurkaevude rajamine"
            />
          </div>
          <div className="space-y-1">
            <Label htmlFor="vaike-alamsekt">Alamsektsioon (valikuline)</Label>
            <Input
              id="vaike-alamsekt"
              value={alamsektsioon}
              onChange={(e) => setAlamsektsioon(e.target.value)}
              placeholder="nt Vertikaalne puurkaev"
            />
          </div>
        </div>

        <div className="flex items-center gap-2">
          <Button onClick={save} disabled={pending} variant="primary" size="sm">
            {pending ? <Loader2 className="h-4 w-4 animate-spin" /> : <Save className="h-4 w-4" />}
            Salvesta vaike-eriosa
          </Button>
          {msg ? (
            <span
              className={`rounded-md px-3 py-1 text-xs ${
                msg.kind === "ok" ? "bg-vk-blue/10 text-vk-blue" : "bg-vk-red/10 text-vk-red"
              }`}
            >
              {msg.text}
            </span>
          ) : null}
        </div>
      </CardContent>
    </Card>
  );
}
