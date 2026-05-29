"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Loader2, Save, Trash2, AlertTriangle } from "lucide-react";
import type { Objekt, HooneTüüp } from "@/lib/types";
import { HOONE_TÜÜP_LABEL } from "@/lib/types";
import { muudaObjekt, kustutaObjekt } from "@/app/kliendid/actions";

const HOONE_TÜÜBID: HooneTüüp[] = [
  "kortermaja",
  "eramaja",
  "rida_paarismaja",
  "ärihoone",
  "tööstushoone",
  "muu",
];

function parseNum(raw: string): number | null {
  const t = raw.trim();
  if (t === "") return null;
  const n = Number(t.replace(",", "."));
  return Number.isFinite(n) ? n : null;
}

function parseInt0(raw: string): number | null {
  const t = raw.trim();
  if (t === "") return null;
  const n = parseInt(t, 10);
  return Number.isFinite(n) && n >= 0 ? n : null;
}

export function MuudaObjektForm({ objekt }: { objekt: Objekt }) {
  const router = useRouter();
  const [pending, startTransition] = useTransition();
  const [confirming, setConfirming] = useState(false);
  const [nimi, setNimi] = useState(objekt.nimi);
  const [aadress, setAadress] = useState(objekt.aadress ?? "");
  const [projektiNr, setProjektiNr] = useState(objekt.projekti_nr ?? "");
  const [hooneTüüp, setHooneTüüp] = useState<HooneTüüp | "">(objekt.hoone_tüüp ?? "");
  const [korterite, setKorterite] = useState(
    objekt.korterite_arv === null ? "" : String(objekt.korterite_arv),
  );
  const [korruste, setKorruste] = useState(
    objekt.korruste_arv === null ? "" : String(objekt.korruste_arv),
  );
  const [pindala, setPindala] = useState(
    objekt.pindala_m2 === null ? "" : String(objekt.pindala_m2).replace(".", ","),
  );
  const [märkused, setMärkused] = useState(objekt.märkused ?? "");
  const [msg, setMsg] = useState<{ kind: "ok" | "err"; text: string } | null>(null);

  async function save() {
    setMsg(null);
    if (!nimi.trim()) {
      setMsg({ kind: "err", text: "Nimi on kohustuslik" });
      return;
    }
    startTransition(async () => {
      const r = await muudaObjekt(objekt.id, {
        nimi: nimi.trim(),
        aadress: aadress.trim() || null,
        projekti_nr: projektiNr.trim() || null,
        hoone_tüüp: hooneTüüp || null,
        korterite_arv: parseInt0(korterite),
        korruste_arv: parseInt0(korruste),
        pindala_m2: parseNum(pindala),
        märkused: märkused.trim() || null,
      });
      if (r.ok) {
        setMsg({ kind: "ok", text: "Salvestatud" });
        router.refresh();
      } else {
        setMsg({ kind: "err", text: r.error });
      }
    });
  }

  async function kustuta() {
    startTransition(async () => {
      const r = await kustutaObjekt(objekt.id);
      if (r.ok) router.push(`/kliendid/${objekt.klient_id}`);
      else setMsg({ kind: "err", text: r.error });
    });
  }

  return (
    <div className="space-y-4">
      <div className="space-y-1">
        <Label htmlFor="nimi">
          Nimi <span className="text-vk-red">*</span>
        </Label>
        <Input id="nimi" value={nimi} onChange={(e) => setNimi(e.target.value)} required />
      </div>

      <div className="space-y-1">
        <Label htmlFor="aadress">Aadress</Label>
        <Input id="aadress" value={aadress} onChange={(e) => setAadress(e.target.value)} />
      </div>

      <div className="grid gap-3 sm:grid-cols-2">
        <div className="space-y-1">
          <Label htmlFor="projekti_nr">Projekti nr</Label>
          <Input
            id="projekti_nr"
            value={projektiNr}
            onChange={(e) => setProjektiNr(e.target.value)}
          />
        </div>
        <div className="space-y-1">
          <Label htmlFor="hoone_tüüp">Hoone tüüp</Label>
          <select
            id="hoone_tüüp"
            value={hooneTüüp}
            onChange={(e) => setHooneTüüp(e.target.value as HooneTüüp | "")}
            className="flex h-10 w-full rounded-md border border-input bg-background px-3 py-2 text-sm ring-offset-background focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2"
          >
            <option value="">—</option>
            {HOONE_TÜÜBID.map((h) => (
              <option key={h} value={h}>
                {HOONE_TÜÜP_LABEL[h]}
              </option>
            ))}
          </select>
        </div>
      </div>

      <div className="grid gap-3 sm:grid-cols-3">
        <div className="space-y-1">
          <Label htmlFor="korterite_arv">Korterite arv</Label>
          <Input
            id="korterite_arv"
            value={korterite}
            onChange={(e) => setKorterite(e.target.value)}
            type="number"
            min={0}
          />
        </div>
        <div className="space-y-1">
          <Label htmlFor="korruste_arv">Korruste arv</Label>
          <Input
            id="korruste_arv"
            value={korruste}
            onChange={(e) => setKorruste(e.target.value)}
            type="number"
            min={0}
          />
        </div>
        <div className="space-y-1">
          <Label htmlFor="pindala_m2">Pindala m²</Label>
          <Input
            id="pindala_m2"
            value={pindala}
            onChange={(e) => setPindala(e.target.value)}
            type="text"
            inputMode="decimal"
          />
        </div>
      </div>

      <div className="space-y-1">
        <Label htmlFor="märkused">Märkused</Label>
        <Textarea
          id="märkused"
          value={märkused}
          onChange={(e) => setMärkused(e.target.value)}
          rows={2}
        />
      </div>

      <div className="flex flex-wrap items-center gap-3">
        <Button onClick={save} disabled={pending} variant="primary">
          {pending ? <Loader2 className="h-4 w-4 animate-spin" /> : <Save className="h-4 w-4" />}
          Salvesta
        </Button>
        {confirming ? (
          <div className="flex items-center gap-2">
            <span className="flex items-center gap-1 rounded-md bg-vk-red/10 px-2 py-1 text-xs text-vk-red">
              <AlertTriangle className="h-3 w-3" />
              Objekti pakkumised säilivad, kuid objekt_id NULLitakse.
            </span>
            <Button onClick={kustuta} disabled={pending} variant="destructive" size="sm">
              <Trash2 className="h-3 w-3" />
              Kinnita
            </Button>
            <Button
              onClick={() => setConfirming(false)}
              disabled={pending}
              variant="ghost"
              size="sm"
            >
              Tühista
            </Button>
          </div>
        ) : (
          <Button
            onClick={() => setConfirming(true)}
            disabled={pending}
            variant="ghost"
            size="sm"
          >
            <Trash2 className="h-3 w-3" />
            Kustuta objekt
          </Button>
        )}
        {msg ? (
          <span
            className={`rounded-md px-3 py-1.5 text-sm ${
              msg.kind === "ok" ? "bg-vk-blue/10 text-vk-blue" : "bg-vk-red/10 text-vk-red"
            }`}
          >
            {msg.text}
          </span>
        ) : null}
      </div>
    </div>
  );
}
