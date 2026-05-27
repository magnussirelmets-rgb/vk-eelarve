"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Loader2, Plus } from "lucide-react";
import { lisaManuaalneToode } from "../actions";

function parseNum(raw: string): number | null {
  const t = raw.trim();
  if (t === "") return null;
  const n = Number(t.replace(",", "."));
  return Number.isFinite(n) ? n : null;
}

type Props = {
  grupId: string;
  grupNimi: string;
  grupTüüp: "toode" | "teenus";
  open: boolean;
  onOpenChange: (open: boolean) => void;
};

export function LisaManuaalneToodeDialog({ grupId, grupNimi, grupTüüp, open, onOpenChange }: Props) {
  const router = useRouter();
  const [pending, startTransition] = useTransition();
  const [nimetus, setNimetus] = useState("");
  const [tähis, setTähis] = useState("");
  const [ühik, setÜhik] = useState(grupTüüp === "teenus" ? "kompl" : "tk");
  const [ostuhind, setOstuhind] = useState("");
  const [paigaldusaeg, setPaigaldusaeg] = useState("");
  const [märkused, setMärkused] = useState("");
  const [altNimed, setAltNimed] = useState("");
  const [err, setErr] = useState<string | null>(null);

  function reset() {
    setNimetus("");
    setTähis("");
    setÜhik(grupTüüp === "teenus" ? "kompl" : "tk");
    setOstuhind("");
    setPaigaldusaeg("");
    setMärkused("");
    setAltNimed("");
    setErr(null);
  }

  async function onSubmit(addAnother: boolean) {
    setErr(null);
    if (!nimetus.trim()) {
      setErr("Nimetus on kohustuslik");
      return;
    }
    startTransition(async () => {
      const r = await lisaManuaalneToode({
        grupId,
        nimetus: nimetus.trim(),
        tähis: tähis.trim() || null,
        ühik: ühik.trim() || null,
        ostuhind_neto: parseNum(ostuhind),
        paigaldusaeg_h_ühik: parseNum(paigaldusaeg),
        märkused: märkused.trim() || null,
        alt_nimed: altNimed.trim() || null,
      });
      if (r.ok) {
        router.refresh();
        if (addAnother) {
          // Hoia ühik, tühjenda muu
          setNimetus("");
          setTähis("");
          setOstuhind("");
          setPaigaldusaeg("");
          setMärkused("");
          setAltNimed("");
        } else {
          reset();
          onOpenChange(false);
        }
      } else {
        setErr(r.error);
      }
    });
  }

  const label = grupTüüp === "teenus" ? "teenus" : "toode";

  return (
    <Dialog
      open={open}
      onOpenChange={(o) => {
        if (!o) reset();
        onOpenChange(o);
      }}
    >
      <DialogContent>
        <DialogHeader>
          <DialogTitle>Lisa uus {label} käsitsi</DialogTitle>
          <DialogDescription>
            Lisa uus {label} grupiga <strong>{grupNimi}</strong>. Mõeldud asjadele mis ei tule tarnija
            hinnakirjadest — näiteks Sinu enda paigaldusteenused, hooldused, konsultatsioonid või
            tooted millel pole tarnija PDF-i. Read salvestuvad &quot;VK Manuaalsed&quot; hinnakirja alla.
          </DialogDescription>
        </DialogHeader>

        <div className="grid gap-3 sm:grid-cols-2">
          <div className="space-y-1 sm:col-span-2">
            <Label htmlFor="nimetus">
              Nimetus <span className="text-vk-red">*</span>
            </Label>
            <Input
              id="nimetus"
              value={nimetus}
              onChange={(e) => setNimetus(e.target.value)}
              placeholder={
                grupTüüp === "teenus"
                  ? "nt Soojuspumba paigaldus 12kW, Hooldusleping 1 aasta"
                  : "nt Erikujundatud kollektor, Sinu manuaalne toode"
              }
              required
              autoFocus
            />
          </div>
          <div className="space-y-1">
            <Label htmlFor="tähis">Tähis (valikuline)</Label>
            <Input
              id="tähis"
              value={tähis}
              onChange={(e) => setTähis(e.target.value)}
              placeholder="nt 12kW, DN50, suurus M"
            />
          </div>
          <div className="space-y-1">
            <Label htmlFor="ühik">Ühik</Label>
            <Input
              id="ühik"
              value={ühik}
              onChange={(e) => setÜhik(e.target.value)}
              placeholder="kompl, tk, h, m"
            />
          </div>
          <div className="space-y-1">
            <Label htmlFor="ostuhind">Ostuhind (€/ühik)</Label>
            <Input
              id="ostuhind"
              value={ostuhind}
              onChange={(e) => setOstuhind(e.target.value)}
              type="text"
              inputMode="decimal"
              placeholder="nt 450,00"
            />
            <p className="text-[10px] text-muted-foreground">
              {grupTüüp === "teenus"
                ? "Teenuse hind ühe ühiku kohta. Kui kate-koefitsient grupis on 1.0×, on see ka müügihind."
                : "Toote hind ühe ühiku kohta."}
            </p>
          </div>
          <div className="space-y-1">
            <Label htmlFor="paigaldusaeg">Paigaldusaeg (h/ühik, valikuline)</Label>
            <Input
              id="paigaldusaeg"
              value={paigaldusaeg}
              onChange={(e) => setPaigaldusaeg(e.target.value)}
              type="text"
              inputMode="decimal"
              placeholder={grupTüüp === "teenus" ? "Tühjaks (teenus on töötasus juba)" : "nt 0,5"}
            />
            <p className="text-[10px] text-muted-foreground">
              {grupTüüp === "teenus"
                ? "Teenuste puhul tavaliselt tühjaks — ostuhind sisaldab juba töötasu."
                : "Tühi = ei arvestata tööd ostuhinnaga lisaks."}
            </p>
          </div>
          <div className="sm:col-span-2 space-y-1">
            <Label htmlFor="alt_nimed">Sünonüümid (semikooloniga)</Label>
            <Input
              id="alt_nimed"
              value={altNimed}
              onChange={(e) => setAltNimed(e.target.value)}
              placeholder="nt soojuspumba paigaldus;heat pump installation"
            />
          </div>
          <div className="sm:col-span-2 space-y-1">
            <Label htmlFor="märkused">Märkused (valikuline)</Label>
            <Textarea
              id="märkused"
              value={märkused}
              onChange={(e) => setMärkused(e.target.value)}
              rows={2}
              placeholder="Lisateave: mis sisaldub, eritingimused jms"
            />
          </div>
        </div>

        {err ? (
          <div className="rounded-md bg-vk-red/10 px-3 py-2 text-sm text-vk-red">{err}</div>
        ) : null}

        <DialogFooter>
          <Button variant="ghost" onClick={() => onOpenChange(false)} disabled={pending}>
            Tühista
          </Button>
          <Button variant="outline" onClick={() => onSubmit(true)} disabled={pending}>
            {pending ? <Loader2 className="h-4 w-4 animate-spin" /> : <Plus className="h-4 w-4" />}
            Salvesta ja lisa veel
          </Button>
          <Button variant="primary" onClick={() => onSubmit(false)} disabled={pending}>
            {pending ? <Loader2 className="h-4 w-4 animate-spin" /> : <Plus className="h-4 w-4" />}
            Salvesta
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
