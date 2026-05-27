"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Loader2, Plus } from "lucide-react";
import { looGrupp } from "../actions";

export function UusGruppForm() {
  const router = useRouter();
  const [pending, startTransition] = useTransition();
  const [err, setErr] = useState<string | null>(null);

  async function onSubmit(formData: FormData) {
    setErr(null);
    startTransition(async () => {
      const r = await looGrupp(formData);
      if (r.ok) router.push(`/grupid/${r.id}`);
      else setErr(r.error);
    });
  }

  return (
    <form action={onSubmit} className="space-y-4">
      <div className="space-y-1">
        <Label htmlFor="nimi">
          Nimi <span className="text-vk-red">*</span>
        </Label>
        <Input
          id="nimi"
          name="nimi"
          placeholder="nt Soojuspumba paigaldus, Vee püstiku ehitus, Soojussõlme paigaldus"
          required
        />
      </div>
      <div className="space-y-1">
        <Label htmlFor="kirjeldus">Kirjeldus (valikuline)</Label>
        <Input id="kirjeldus" name="kirjeldus" placeholder="lühike kontekst" />
      </div>
      <div className="grid gap-3 sm:grid-cols-2">
        <div className="space-y-1">
          <Label htmlFor="paigaldusaeg_h_ühik">Paigaldusaeg (h/ühik)</Label>
          <Input
            id="paigaldusaeg_h_ühik"
            name="paigaldusaeg_h_ühik"
            type="text"
            inputMode="decimal"
            placeholder="nt 0,15"
          />
          <p className="text-xs text-muted-foreground">
            Rakendub kõikidele teenusega seotud toodetele.
          </p>
        </div>
        <div className="space-y-1">
          <Label htmlFor="kate_koefitsient_override">Kate-koefitsient (override)</Label>
          <Input
            id="kate_koefitsient_override"
            name="kate_koefitsient_override"
            type="text"
            inputMode="decimal"
            placeholder="nt 1,40 (tühi = pakkumise vaikimisi)"
          />
          <p className="text-xs text-muted-foreground">
            Tühi → kasutab pakkumise vaikimisi katet. Täida ainult kui erinev marginaal.
          </p>
        </div>
      </div>
      <div className="space-y-1">
        <Label htmlFor="märkused">Märkused (valikuline)</Label>
        <Textarea id="märkused" name="märkused" rows={2} />
      </div>
      {err ? <div className="rounded-md bg-vk-red/10 px-3 py-2 text-sm text-vk-red">{err}</div> : null}
      <Button type="submit" disabled={pending} variant="primary">
        {pending ? <Loader2 className="h-4 w-4 animate-spin" /> : <Plus className="h-4 w-4" />}
        Loo teenus
      </Button>
    </form>
  );
}
