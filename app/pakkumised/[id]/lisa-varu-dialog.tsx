"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Loader2, Percent } from "lucide-react";
import { lisaVaru } from "../actions";

type Props = {
  pakkumineId: string;
  sektsioon: string;
  alamsektsioon: string;
  open: boolean;
  onOpenChange: (open: boolean) => void;
};

export function LisaVaruDialog({ pakkumineId, sektsioon, alamsektsioon, open, onOpenChange }: Props) {
  const router = useRouter();
  const [pending, startTransition] = useTransition();
  const [nimi, setNimi] = useState("Materjali varu");
  const [koef, setKoef] = useState("30");
  const [err, setErr] = useState<string | null>(null);

  function reset() {
    setNimi("Materjali varu");
    setKoef("30");
    setErr(null);
  }

  async function onSubmit() {
    setErr(null);
    const k = Number(koef.replace(",", "."));
    if (!Number.isFinite(k) || k <= 0) {
      setErr("Koefitsent peab olema positiivne arv (nt 30)");
      return;
    }
    if (!nimi.trim()) {
      setErr("Nimetus on kohustuslik");
      return;
    }
    startTransition(async () => {
      const r = await lisaVaru({
        pakkumineId,
        sektsioon: sektsioon || null,
        alamsektsioon: alamsektsioon || null,
        nimi: nimi.trim(),
        koefitsent_protsent: k,
      });
      if (r.ok) {
        reset();
        onOpenChange(false);
        router.refresh();
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
      <DialogContent className="sm:max-w-lg">
        <DialogHeader>
          <DialogTitle>Lisa varu rida</DialogTitle>
          <DialogDescription>
            Arvutuslik rida, mille summa = sektsiooni materjali (mitte teiste varude) summa × koefitsent / 100.
            Sektsioon: <strong>{sektsioon || "(määramata)"}</strong>
            {alamsektsioon ? (
              <>
                {" "}
                · Alamsektsioon: <strong>{alamsektsioon}</strong>
              </>
            ) : null}
          </DialogDescription>
        </DialogHeader>

        <div className="grid gap-3">
          <div className="space-y-1">
            <Label htmlFor="varu-nimi">Nimetus</Label>
            <Input
              id="varu-nimi"
              value={nimi}
              onChange={(e) => setNimi(e.target.value)}
              placeholder="Materjali varu / Kinnitusvahendite varu / Lisamaterjalid"
              autoFocus
            />
          </div>
          <div className="space-y-1">
            <Label htmlFor="varu-koef">Koefitsent (%)</Label>
            <div className="flex items-center gap-2">
              <Input
                id="varu-koef"
                value={koef}
                onChange={(e) => setKoef(e.target.value)}
                type="text"
                inputMode="decimal"
                placeholder="30"
                className="w-32 font-mono"
              />
              <Percent className="h-4 w-4 text-muted-foreground" />
            </div>
            <p className="text-xs text-muted-foreground">
              30 = 30% sektsiooni materjali summast lisatakse varuks. 20% kinnitusvahendid jne.
            </p>
          </div>
        </div>

        {err ? <div className="rounded-md bg-vk-red/10 px-3 py-2 text-sm text-vk-red">{err}</div> : null}

        <DialogFooter>
          <Button variant="ghost" onClick={() => onOpenChange(false)} disabled={pending}>
            Tühista
          </Button>
          <Button variant="primary" onClick={onSubmit} disabled={pending}>
            {pending ? <Loader2 className="h-4 w-4 animate-spin" /> : <Percent className="h-4 w-4" />}
            Lisa varu rida
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
