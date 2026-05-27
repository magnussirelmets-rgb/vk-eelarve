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
import { Loader2, Package } from "lucide-react";
import { looKomplekt } from "@/app/komplektid/actions";

type Props = {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  toodeIds: string[];
  onSuccess?: () => void;
};

export function TeeKomplektDialog({ open, onOpenChange, toodeIds, onSuccess }: Props) {
  const router = useRouter();
  const [pending, startTransition] = useTransition();
  const [nimi, setNimi] = useState("");
  const [kirjeldus, setKirjeldus] = useState("");
  const [ühik, setÜhik] = useState("kompl");
  const [märkused, setMärkused] = useState("");
  const [err, setErr] = useState<string | null>(null);

  function reset() {
    setNimi("");
    setKirjeldus("");
    setÜhik("kompl");
    setMärkused("");
    setErr(null);
  }

  async function onSubmit() {
    setErr(null);
    if (!nimi.trim()) {
      setErr("Komplekti nimi on kohustuslik");
      return;
    }
    startTransition(async () => {
      const r = await looKomplekt({
        nimi: nimi.trim(),
        kirjeldus: kirjeldus.trim() || null,
        ühik: ühik.trim() || "kompl",
        märkused: märkused.trim() || null,
        toode_idid: toodeIds,
      });
      if (r.ok) {
        reset();
        onOpenChange(false);
        onSuccess?.();
        router.push(`/komplektid/${r.id}`);
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
          <DialogTitle>Tee komplekt valitud ridadest</DialogTitle>
          <DialogDescription>
            <strong>{toodeIds.length}</strong> valitud rida liidetakse uueks komplektiks. Kogus iga
            rea kohta määratakse vaikimisi 1 (saad muuta komplekti detail-lehel).
            Komplekti saab hiljem ühe klikiga pakkumisele lisada.
          </DialogDescription>
        </DialogHeader>

        <div className="grid gap-3">
          <div className="space-y-1">
            <Label htmlFor="komplekt-nimi">
              Nimi <span className="text-vk-red">*</span>
            </Label>
            <Input
              id="komplekt-nimi"
              value={nimi}
              onChange={(e) => setNimi(e.target.value)}
              placeholder="nt Radiaatori paigalduskomplekt, Veemõõtja komplekt 1/2"
              autoFocus
            />
          </div>
          <div className="grid gap-3 sm:grid-cols-2">
            <div className="space-y-1">
              <Label htmlFor="komplekt-ühik">Ühik</Label>
              <Input
                id="komplekt-ühik"
                value={ühik}
                onChange={(e) => setÜhik(e.target.value)}
                placeholder="kompl"
              />
            </div>
            <div className="space-y-1">
              <Label htmlFor="komplekt-kirjeldus">Kirjeldus (valikuline)</Label>
              <Input
                id="komplekt-kirjeldus"
                value={kirjeldus}
                onChange={(e) => setKirjeldus(e.target.value)}
                placeholder="lühike kontekst"
              />
            </div>
          </div>
          <div className="space-y-1">
            <Label htmlFor="komplekt-märkused">Märkused (valikuline)</Label>
            <Textarea
              id="komplekt-märkused"
              value={märkused}
              onChange={(e) => setMärkused(e.target.value)}
              rows={2}
              placeholder="Lisateave: mis sisaldub, eritingimused jne"
            />
          </div>
        </div>

        {err ? <div className="rounded-md bg-vk-red/10 px-3 py-2 text-sm text-vk-red">{err}</div> : null}

        <DialogFooter>
          <Button variant="ghost" onClick={() => onOpenChange(false)} disabled={pending}>
            Tühista
          </Button>
          <Button variant="primary" onClick={onSubmit} disabled={pending || toodeIds.length === 0}>
            {pending ? <Loader2 className="h-4 w-4 animate-spin" /> : <Package className="h-4 w-4" />}
            Loo komplekt
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
