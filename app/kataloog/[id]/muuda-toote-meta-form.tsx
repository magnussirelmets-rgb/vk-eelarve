"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { TagInput } from "@/components/ui/tag-input";
import { Loader2, Save } from "lucide-react";
import { muudaTooteMeta } from "../actions";

type Props = {
  tooteId: string;
  algnePaigaldusaeg: number | null;
  algMärkused: string;
  algAltNimed: string;
  algKirjeldus: string;
};

export function MuudaTooteMetaForm({
  tooteId,
  algnePaigaldusaeg,
  algMärkused,
  algAltNimed,
  algKirjeldus,
}: Props) {
  const router = useRouter();
  const [pending, startTransition] = useTransition();
  const [paigaldusaeg, setPaigaldusaeg] = useState(
    algnePaigaldusaeg === null ? "" : String(algnePaigaldusaeg).replace(".", ","),
  );
  const [märkused, setMärkused] = useState(algMärkused);
  const [altNimed, setAltNimed] = useState(algAltNimed);
  const [kirjeldus, setKirjeldus] = useState(algKirjeldus);
  const [msg, setMsg] = useState<{ kind: "ok" | "err"; text: string } | null>(null);

  async function onSubmit() {
    setMsg(null);
    const aegN =
      paigaldusaeg.trim() === "" ? null : Number(paigaldusaeg.replace(",", "."));
    if (aegN !== null && !Number.isFinite(aegN)) {
      setMsg({ kind: "err", text: "Paigaldusaeg peab olema number" });
      return;
    }

    startTransition(async () => {
      const r = await muudaTooteMeta({
        tooteId,
        paigaldusaeg_h_ühik: aegN,
        magnus_märkused: märkused.trim() || null,
        magnus_alt_nimed: altNimed.trim() || null,
        kirjeldus: kirjeldus.trim() || null,
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
    <div className="space-y-4">
      <div className="grid gap-4 sm:grid-cols-2">
        <div className="space-y-1">
          <Label htmlFor="paigaldusaeg">Paigaldusaeg (h/ühik)</Label>
          <Input
            id="paigaldusaeg"
            value={paigaldusaeg}
            onChange={(e) => setPaigaldusaeg(e.target.value)}
            type="text"
            inputMode="decimal"
            placeholder="nt 0,5"
          />
          <p className="text-xs text-muted-foreground">Tühi = määramata, ei tule arvutusse.</p>
        </div>
      </div>

      <div className="space-y-1">
        <Label htmlFor="alt_nimed">Sünonüümid / märksõnad</Label>
        <TagInput
          value={altNimed}
          onChange={setAltNimed}
          placeholder="Kirjuta märksõna ja vajuta Enter (nt &quot;kuulkraan&quot;, &quot;sulgkraan&quot;)"
        />
        <p className="text-xs text-muted-foreground">
          Iga märksõna omaette &quot;kiip&quot;. Vajuta Enter / koma / semikoolon märksõna lisamiseks. X eemaldab.
          Mahutabeli otsing leiab toote ka nende märksõnade järgi (näiteks &quot;Kuulventiil&quot; mahutabelis →
          leiab toote, mille märksõnade hulgas on &quot;kuulventiil&quot;).
        </p>
      </div>

      <div className="space-y-1">
        <Label htmlFor="kirjeldus">Tootekirjeldus (kliendile nähtav pakkumises)</Label>
        <Textarea
          id="kirjeldus"
          value={kirjeldus}
          onChange={(e) => setKirjeldus(e.target.value)}
          placeholder="nt 'Daikin Altherma 3 H HT, monoblock välisüksus + sisemoodul + 300L puhverpaak'"
          rows={3}
        />
        <p className="text-xs text-muted-foreground">
          Pikem tehniline kirjeldus mis kuvatakse kliendile pakkumise trükivormis. Kui AI parser
          jättis kirjelduse PDF-ist välja, lisa siia käsitsi. Mass-uuendus on võimalik hinnakirja
          lehel CSV/Excel uploadiga.
        </p>
      </div>

      <div className="space-y-1">
        <Label htmlFor="märkused">Sisemised märkused (kliendile ei näidata)</Label>
        <Textarea
          id="märkused"
          value={märkused}
          onChange={(e) => setMärkused(e.target.value)}
          placeholder="nt 'parem kvaliteet kui ABC', 'tellida tuleb min 50 tk'..."
          rows={3}
        />
      </div>

      <div className="flex items-center gap-3">
        <Button onClick={onSubmit} disabled={pending} variant="primary">
          {pending ? <Loader2 className="h-4 w-4 animate-spin" /> : <Save className="h-4 w-4" />}
          Salvesta
        </Button>
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
