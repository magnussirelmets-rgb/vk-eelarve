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
import { lisaPositsioon } from "../actions";

type Props = {
  pakkumineId: string;
  open: boolean;
  onOpenChange: (open: boolean) => void;
  initialSektsioon?: string;
  initialAlamsektsioon?: string;
};

function parseNum(raw: string): number | null {
  const t = raw.trim();
  if (t === "") return null;
  const n = Number(t.replace(",", "."));
  return Number.isFinite(n) ? n : null;
}

export function LisaPositsioonDialog({
  pakkumineId,
  open,
  onOpenChange,
  initialSektsioon = "",
  initialAlamsektsioon = "",
}: Props) {
  const router = useRouter();
  const [pending, startTransition] = useTransition();
  const [sektsioon, setSektsioon] = useState(initialSektsioon);
  const [alamsektsioon, setAlamsektsioon] = useState(initialAlamsektsioon);
  const [nimetus, setNimetus] = useState("");
  const [tähis, setTähis] = useState("");
  const [kogus, setKogus] = useState("1");
  const [ühik, setÜhik] = useState("tk");
  const [ostuhind, setOstuhind] = useState("");
  const [paigaldusaeg, setPaigaldusaeg] = useState("");
  const [märkused, setMärkused] = useState("");
  const [kirjeldus, setKirjeldus] = useState("");
  const [err, setErr] = useState<string | null>(null);

  function reset() {
    setSektsioon(initialSektsioon);
    setAlamsektsioon(initialAlamsektsioon);
    setNimetus("");
    setTähis("");
    setKogus("1");
    setÜhik("tk");
    setOstuhind("");
    setPaigaldusaeg("");
    setMärkused("");
    setKirjeldus("");
    setErr(null);
  }

  async function onSubmit(addAnother: boolean) {
    setErr(null);
    if (!nimetus.trim()) {
      setErr("Nimetus on kohustuslik");
      return;
    }
    startTransition(async () => {
      const r = await lisaPositsioon({
        pakkumineId,
        sektsioon: sektsioon.trim() || null,
        alamsektsioon: alamsektsioon.trim() || null,
        nimetus: nimetus.trim(),
        tähis: tähis.trim() || null,
        kogus: parseNum(kogus),
        ühik: ühik.trim() || null,
        ostuhind_snapshot: parseNum(ostuhind),
        paigaldusaeg_snapshot: parseNum(paigaldusaeg),
        märkused: märkused.trim() || null,
        kirjeldus: kirjeldus.trim() || null,
      });
      if (r.ok) {
        router.refresh();
        if (addAnother) {
          // Hoia sektsioon/alamsektsioon/ühik samaks, tühjenda muu — kiire järgmise rea lisamiseks
          setNimetus("");
          setTähis("");
          setKogus("1");
          setOstuhind("");
          setPaigaldusaeg("");
          setMärkused("");
          setKirjeldus("");
        } else {
          reset();
          onOpenChange(false);
        }
      } else {
        setErr(r.error);
      }
    });
  }

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
          <DialogTitle>Lisa positsioon käsitsi</DialogTitle>
          <DialogDescription>
            Lisa positsioon, mida mahutabel ei sisaldanud või mille parser jättis vahele
            (nt 713 grupi komplekthind, lisatööd, korterite kanalisatsiooni väljavõtted).
            Saad lisada ka kohe ostuhinna + paigaldusaja ilma tarnija tootele linkimata.
          </DialogDescription>
        </DialogHeader>

        <div className="grid gap-3 sm:grid-cols-2">
          <div className="space-y-1">
            <Label htmlFor="sektsioon">Sektsioon (SEK kood + nimi)</Label>
            <Input
              id="sektsioon"
              value={sektsioon}
              onChange={(e) => setSektsioon(e.target.value)}
              placeholder="nt 711 Veevarustus"
            />
          </div>
          <div className="space-y-1">
            <Label htmlFor="alamsektsioon">Alamsektsioon (valikuline)</Label>
            <Input
              id="alamsektsioon"
              value={alamsektsioon}
              onChange={(e) => setAlamsektsioon(e.target.value)}
              placeholder="nt Püstikud, Kelder, Komplekttöö"
            />
          </div>
          <div className="space-y-1">
            <Label htmlFor="ühik">Ühik</Label>
            <Input
              id="ühik"
              value={ühik}
              onChange={(e) => setÜhik(e.target.value)}
              placeholder="tk, kompl, m, jm, h"
            />
          </div>
          <div className="space-y-1 sm:col-span-2">
            <Label htmlFor="nimetus">
              Nimetus <span className="text-vk-red">*</span>
            </Label>
            <Input
              id="nimetus"
              value={nimetus}
              onChange={(e) => setNimetus(e.target.value)}
              placeholder="nt Soojussõlm komplekt, Sadeveepump 80, Korteri WC-väljavõte"
              required
              autoFocus
            />
          </div>
          <div className="space-y-1">
            <Label htmlFor="tähis">Tähis</Label>
            <Input
              id="tähis"
              value={tähis}
              onChange={(e) => setTähis(e.target.value)}
              placeholder="nt DN20, K110"
            />
          </div>
          <div className="space-y-1">
            <Label htmlFor="kogus">Kogus</Label>
            <Input
              id="kogus"
              value={kogus}
              onChange={(e) => setKogus(e.target.value)}
              type="text"
              inputMode="decimal"
              placeholder="nt 1"
            />
          </div>
          <div className="space-y-1">
            <Label htmlFor="ostuhind">Ostuhind (€/ühik, valikuline)</Label>
            <Input
              id="ostuhind"
              value={ostuhind}
              onChange={(e) => setOstuhind(e.target.value)}
              type="text"
              inputMode="decimal"
              placeholder="nt 5000,00"
            />
            <p className="text-[10px] text-muted-foreground">
              Komplekthinna jaoks sisesta otse. Tarnija tootele linkimine on valikuline.
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
              placeholder="nt 40 (täie sõlme komplektpaigaldus)"
            />
          </div>
          <div className="sm:col-span-2 space-y-1">
            <Label htmlFor="kirjeldus">Tootekirjeldus (kliendile nähtav printvormis)</Label>
            <Textarea
              id="kirjeldus"
              value={kirjeldus}
              onChange={(e) => setKirjeldus(e.target.value)}
              rows={2}
              placeholder="nt 'Daikin Altherma 3 H HT, 14 kW, monoblock + sisemoodul + puhverpaak 300L'"
            />
          </div>
          <div className="sm:col-span-2 space-y-1">
            <Label htmlFor="märkused">Sisemised märkused (valikuline, kliendile ei näidata)</Label>
            <Textarea
              id="märkused"
              value={märkused}
              onChange={(e) => setMärkused(e.target.value)}
              rows={2}
              placeholder="Kontekst Magnusele endale"
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
