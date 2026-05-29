"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Loader2, Save, Trash2, AlertTriangle, Package, Wrench } from "lucide-react";
import type { Tootegrupp } from "@/lib/types";
import { muudaGrupp, kustutaGrupp } from "../actions";

function parseNum(raw: string): number | null {
  const t = raw.trim();
  if (t === "") return null;
  const n = Number(t.replace(",", "."));
  return Number.isFinite(n) ? n : null;
}

function parseInt0to50(raw: string): number | null {
  const t = raw.trim();
  if (t === "") return null;
  const n = Number(t);
  if (!Number.isFinite(n) || !Number.isInteger(n) || n < 0 || n > 50) return null;
  return n;
}

export function MuudaGruppForm({ grupp }: { grupp: Tootegrupp }) {
  const router = useRouter();
  const [pending, startTransition] = useTransition();
  const [confirming, setConfirming] = useState(false);
  const [tüüp, setTüüp] = useState<"toode" | "teenus">(grupp.tüüp);
  const [nimi, setNimi] = useState(grupp.nimi);
  const [kirjeldus, setKirjeldus] = useState(grupp.kirjeldus ?? "");
  const [templateKirjeldus, setTemplateKirjeldus] = useState(grupp.template_kirjeldus ?? "");
  const [pakkumiseKirjeldus, setPakkumiseKirjeldus] = useState(grupp.pakkumise_kirjeldus ?? "");
  const [garantiiAastad, setGarantiiAastad] = useState(
    grupp.garantii_aastad === null ? "" : String(grupp.garantii_aastad),
  );
  const [paigaldusaeg, setPaigaldusaeg] = useState(
    grupp.paigaldusaeg_h_ühik === null ? "" : String(grupp.paigaldusaeg_h_ühik).replace(".", ","),
  );
  const [kate, setKate] = useState(
    grupp.kate_koefitsient_override === null ? "" : String(grupp.kate_koefitsient_override).replace(".", ","),
  );
  const [märkused, setMärkused] = useState(grupp.märkused ?? "");
  const [msg, setMsg] = useState<{ kind: "ok" | "err"; text: string } | null>(null);

  async function save() {
    setMsg(null);
    if (!nimi.trim()) {
      setMsg({ kind: "err", text: "Nimi on kohustuslik" });
      return;
    }
    startTransition(async () => {
      const r = await muudaGrupp(grupp.id, {
        nimi: nimi.trim(),
        tüüp,
        kirjeldus: kirjeldus.trim() || null,
        paigaldusaeg_h_ühik: parseNum(paigaldusaeg),
        kate_koefitsient_override: parseNum(kate),
        märkused: märkused.trim() || null,
        template_kirjeldus: templateKirjeldus.trim() || null,
        pakkumise_kirjeldus: pakkumiseKirjeldus.trim() || null,
        garantii_aastad: parseInt0to50(garantiiAastad),
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
      const r = await kustutaGrupp(grupp.id);
      if (r.ok) {
        router.push("/grupid");
      } else {
        setMsg({ kind: "err", text: r.error });
      }
    });
  }

  const isToode = tüüp === "toode";

  return (
    <div className="space-y-4">
      <div className="space-y-1">
        <Label>Tüüp</Label>
        <div className="flex gap-2">
          <TüüpButton active={isToode} onClick={() => setTüüp("toode")} icon={<Package className="h-3 w-3" />}>
            Toode
          </TüüpButton>
          <TüüpButton active={!isToode} onClick={() => setTüüp("teenus")} icon={<Wrench className="h-3 w-3" />}>
            Teenus
          </TüüpButton>
        </div>
      </div>

      <div className="space-y-1">
        <Label htmlFor="nimi">
          Nimi <span className="text-vk-red">*</span>
        </Label>
        <Input id="nimi" value={nimi} onChange={(e) => setNimi(e.target.value)} required />
      </div>

      <div className="space-y-1">
        <Label htmlFor="kirjeldus">Lühike kirjeldus</Label>
        <Input id="kirjeldus" value={kirjeldus} onChange={(e) => setKirjeldus(e.target.value)} />
      </div>

      {isToode ? (
        <>
          <div className="space-y-1">
            <Label htmlFor="template_kirjeldus">Template kirjeldus (kliendile nähtav)</Label>
            <Textarea
              id="template_kirjeldus"
              value={templateKirjeldus}
              onChange={(e) => setTemplateKirjeldus(e.target.value)}
              rows={3}
              placeholder="nt On-off maaküttepump {kw} kW võimsusega, COP kuni 4.9..."
            />
            <p className="text-[10px] text-muted-foreground">
              Placeholder&apos;id <code>{"{kw}"}</code> <code>{"{mudel}"}</code>{" "}
              <code>{"{maht}"}</code> asendatakse iga rea mudel_andmed JSONB-st.
            </p>
          </div>

          <div className="space-y-1">
            <Label htmlFor="pakkumise_kirjeldus">Pikem kirjeldus (PDF trükivormis)</Label>
            <Textarea
              id="pakkumise_kirjeldus"
              value={pakkumiseKirjeldus}
              onChange={(e) => setPakkumiseKirjeldus(e.target.value)}
              rows={4}
            />
          </div>

          <div className="space-y-1">
            <Label htmlFor="garantii_aastad">Tootja garantii (aastates)</Label>
            <Input
              id="garantii_aastad"
              value={garantiiAastad}
              onChange={(e) => setGarantiiAastad(e.target.value)}
              type="number"
              min={0}
              max={50}
              step={1}
              placeholder="nt 5"
            />
          </div>
        </>
      ) : null}

      <div className="grid gap-3 sm:grid-cols-2">
        <div className="space-y-1">
          <Label htmlFor="paigaldusaeg">Paigaldusaeg (h/ühik)</Label>
          <Input
            id="paigaldusaeg"
            value={paigaldusaeg}
            onChange={(e) => setPaigaldusaeg(e.target.value)}
            type="text"
            inputMode="decimal"
            placeholder="nt 0,15"
          />
        </div>
        <div className="space-y-1">
          <Label htmlFor="kate">Kate-koefitsient (override)</Label>
          <Input
            id="kate"
            value={kate}
            onChange={(e) => setKate(e.target.value)}
            type="text"
            inputMode="decimal"
            placeholder="nt 1,40 (tühi = pakkumise vaikimisi)"
          />
        </div>
      </div>

      <div className="space-y-1">
        <Label htmlFor="märkused">Märkused (sisemine)</Label>
        <Textarea id="märkused" value={märkused} onChange={(e) => setMärkused(e.target.value)} rows={2} />
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
              Grupi liikmed jäävad alles aga kaotavad grupi-seose
            </span>
            <Button onClick={kustuta} disabled={pending} variant="destructive" size="sm">
              <Trash2 className="h-3 w-3" />
              Kinnita
            </Button>
            <Button onClick={() => setConfirming(false)} disabled={pending} variant="ghost" size="sm">
              Tühista
            </Button>
          </div>
        ) : (
          <Button onClick={() => setConfirming(true)} disabled={pending} variant="ghost" size="sm">
            <Trash2 className="h-3 w-3" />
            Kustuta grupp
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

function TüüpButton({
  active,
  onClick,
  icon,
  children,
}: {
  active: boolean;
  onClick: () => void;
  icon: React.ReactNode;
  children: React.ReactNode;
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      className={`inline-flex items-center gap-1.5 rounded-md border px-3 py-1.5 text-sm transition-colors ${
        active ? "border-vk-blue bg-vk-blue text-white" : "border-border bg-card text-muted-foreground hover:border-vk-blue/40"
      }`}
    >
      {icon}
      {children}
    </button>
  );
}
