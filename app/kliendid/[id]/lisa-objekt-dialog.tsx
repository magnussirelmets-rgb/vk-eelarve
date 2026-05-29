"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Plus, Loader2 } from "lucide-react";
import { HOONE_TÜÜP_LABEL, type HooneTüüp } from "@/lib/types";
import { looObjekt } from "../actions";

const HOONE_TÜÜBID: HooneTüüp[] = [
  "kortermaja",
  "eramaja",
  "rida_paarismaja",
  "ärihoone",
  "tööstushoone",
  "muu",
];

export function LisaObjektDialog({ klientId }: { klientId: string }) {
  const router = useRouter();
  const [open, setOpen] = useState(false);
  const [pending, startTransition] = useTransition();
  const [err, setErr] = useState<string | null>(null);

  async function onSubmit(formData: FormData) {
    setErr(null);
    startTransition(async () => {
      const r = await looObjekt(klientId, formData);
      if (r.ok) {
        setOpen(false);
        router.push(`/objektid/${r.id}`);
      } else {
        setErr(r.error);
      }
    });
  }

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger asChild>
        <Button variant="outline" size="sm">
          <Plus className="h-3.5 w-3.5" />
          Lisa objekt
        </Button>
      </DialogTrigger>
      <DialogContent className="sm:max-w-lg">
        <form action={onSubmit}>
          <DialogHeader>
            <DialogTitle>Uus objekt</DialogTitle>
            <DialogDescription>
              Objekt = aadress + projekti_nr. Iga objekti all võib olla mitu pakkumist.
            </DialogDescription>
          </DialogHeader>

          <div className="space-y-3 py-4">
            <div className="space-y-1">
              <Label htmlFor="nimi">
                Nimi <span className="text-vk-red">*</span>
              </Label>
              <Input id="nimi" name="nimi" placeholder="nt Veskijärve tn 16" required />
            </div>

            <div className="space-y-1">
              <Label htmlFor="aadress">Aadress</Label>
              <Input id="aadress" name="aadress" placeholder="nt Veskijärve tn 16, Haljala" />
            </div>

            <div className="grid gap-3 sm:grid-cols-2">
              <div className="space-y-1">
                <Label htmlFor="projekti_nr">Projekti nr</Label>
                <Input id="projekti_nr" name="projekti_nr" placeholder="nt P-2026-12" />
              </div>
              <div className="space-y-1">
                <Label htmlFor="hoone_tüüp">Hoone tüüp</Label>
                <select
                  id="hoone_tüüp"
                  name="hoone_tüüp"
                  className="flex h-10 w-full rounded-md border border-input bg-background px-3 py-2 text-sm ring-offset-background focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2"
                  defaultValue=""
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
                  name="korterite_arv"
                  type="number"
                  min={0}
                  placeholder="nt 16"
                />
              </div>
              <div className="space-y-1">
                <Label htmlFor="korruste_arv">Korruste arv</Label>
                <Input
                  id="korruste_arv"
                  name="korruste_arv"
                  type="number"
                  min={0}
                  placeholder="nt 5"
                />
              </div>
              <div className="space-y-1">
                <Label htmlFor="pindala_m2">Pindala m²</Label>
                <Input
                  id="pindala_m2"
                  name="pindala_m2"
                  type="text"
                  inputMode="decimal"
                  placeholder="nt 1200"
                />
              </div>
            </div>

            <div className="space-y-1">
              <Label htmlFor="märkused">Märkused</Label>
              <Textarea id="märkused" name="märkused" rows={2} />
            </div>

            {err ? (
              <div className="rounded-md bg-vk-red/10 px-3 py-2 text-sm text-vk-red">{err}</div>
            ) : null}
          </div>

          <DialogFooter>
            <Button type="button" variant="ghost" onClick={() => setOpen(false)} disabled={pending}>
              Tühista
            </Button>
            <Button type="submit" disabled={pending} variant="primary">
              {pending ? <Loader2 className="h-4 w-4 animate-spin" /> : <Plus className="h-4 w-4" />}
              Loo objekt
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}
