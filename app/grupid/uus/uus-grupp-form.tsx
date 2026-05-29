"use client";

import { useState, useTransition } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Loader2, Plus, Package, Wrench } from "lucide-react";
import { looGrupp } from "../actions";

export function UusGruppForm() {
  const router = useRouter();
  const sp = useSearchParams();
  const initialTüüp = sp.get("tüüp") === "teenus" ? "teenus" : "toode";
  const [tüüp, setTüüp] = useState<"toode" | "teenus">(initialTüüp);
  const [pending, startTransition] = useTransition();
  const [err, setErr] = useState<string | null>(null);

  async function onSubmit(formData: FormData) {
    setErr(null);
    formData.set("tüüp", tüüp);
    startTransition(async () => {
      const r = await looGrupp(formData);
      if (r.ok) router.push(`/grupid/${r.id}`);
      else setErr(r.error);
    });
  }

  const isToode = tüüp === "toode";

  return (
    <form action={onSubmit} className="space-y-4">
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
        <p className="text-xs text-muted-foreground">
          {isToode
            ? "Seadmete grupp (nt Alpha Innotec SWC V-Line). template_kirjeldus rakendub kõikidele mudelitele."
            : "Viru Küte teenus (paigaldus, hooldus). Paigaldusaeg + kate kanduvad seotud toodete pakkumisse."}
        </p>
      </div>

      <div className="space-y-1">
        <Label htmlFor="nimi">
          Nimi <span className="text-vk-red">*</span>
        </Label>
        <Input
          id="nimi"
          name="nimi"
          placeholder={isToode ? "nt Alpha Innotec SWC V-Line" : "nt Soojuspumba paigaldus"}
          required
        />
      </div>

      <div className="space-y-1">
        <Label htmlFor="kirjeldus">Lühike kirjeldus (valikuline)</Label>
        <Input id="kirjeldus" name="kirjeldus" placeholder="kataloogi vaates kuvatav kontekst" />
      </div>

      {isToode ? (
        <>
          <div className="space-y-1">
            <Label htmlFor="template_kirjeldus">Template kirjeldus (kliendile nähtav)</Label>
            <Textarea
              id="template_kirjeldus"
              name="template_kirjeldus"
              rows={3}
              placeholder="nt On-off maaküttepump {kw} kW võimsusega, COP kuni 4.9..."
            />
            <p className="text-[10px] text-muted-foreground">
              Toetab placeholder&apos;eid <code>{"{kw}"}</code> <code>{"{mudel}"}</code>{" "}
              <code>{"{maht}"}</code>. Iga mudeli hinnakirja_read.mudel_andmed JSONB-st asendatakse.
            </p>
          </div>

          <div className="space-y-1">
            <Label htmlFor="pakkumise_kirjeldus">Pikem pakkumise kirjeldus (PDF trükivormis)</Label>
            <Textarea
              id="pakkumise_kirjeldus"
              name="pakkumise_kirjeldus"
              rows={4}
              placeholder="Detailne tehniline spetsifikatsioon mida kuvada pakkumise PDF-is..."
            />
          </div>

          <div className="space-y-1">
            <Label htmlFor="garantii_aastad">Tootja garantii (aastates)</Label>
            <Input
              id="garantii_aastad"
              name="garantii_aastad"
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
          <Label htmlFor="paigaldusaeg_h_ühik">Paigaldusaeg (h/ühik)</Label>
          <Input
            id="paigaldusaeg_h_ühik"
            name="paigaldusaeg_h_ühik"
            type="text"
            inputMode="decimal"
            placeholder="nt 0,15"
          />
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
        </div>
      </div>

      <div className="space-y-1">
        <Label htmlFor="märkused">Märkused (sisemine)</Label>
        <Textarea id="märkused" name="märkused" rows={2} />
      </div>

      {err ? <div className="rounded-md bg-vk-red/10 px-3 py-2 text-sm text-vk-red">{err}</div> : null}
      <Button type="submit" disabled={pending} variant="primary">
        {pending ? <Loader2 className="h-4 w-4 animate-spin" /> : <Plus className="h-4 w-4" />}
        {isToode ? "Loo tootegrupp" : "Loo teenus"}
      </Button>
    </form>
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
