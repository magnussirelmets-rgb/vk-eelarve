"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Loader2, Plus, Home, Building2 } from "lucide-react";
import { looKlient } from "../actions";

export function UusKlientForm() {
  const router = useRouter();
  const [tüüp, setTüüp] = useState<"eraisik" | "juriidiline">("eraisik");
  const [pending, startTransition] = useTransition();
  const [err, setErr] = useState<string | null>(null);

  async function onSubmit(formData: FormData) {
    setErr(null);
    formData.set("tüüp", tüüp);
    startTransition(async () => {
      const r = await looKlient(formData);
      if (r.ok) router.push(`/kliendid/${r.id}`);
      else setErr(r.error);
    });
  }

  const isJur = tüüp === "juriidiline";

  return (
    <form action={onSubmit} className="space-y-4">
      <div className="space-y-1">
        <Label>Tüüp</Label>
        <div className="flex gap-2">
          <TüüpButton active={!isJur} onClick={() => setTüüp("eraisik")} icon={<Home className="h-3 w-3" />}>
            Eraisik
          </TüüpButton>
          <TüüpButton active={isJur} onClick={() => setTüüp("juriidiline")} icon={<Building2 className="h-3 w-3" />}>
            Juriidiline isik
          </TüüpButton>
        </div>
      </div>

      <div className="space-y-1">
        <Label htmlFor="nimi">
          {isJur ? "Ärinimi" : "Nimi"} <span className="text-vk-red">*</span>
        </Label>
        <Input
          id="nimi"
          name="nimi"
          placeholder={isJur ? "nt OÜ Korteriühistu Veskijärve 16" : "nt Mati Tamm"}
          required
        />
      </div>

      {isJur ? (
        <>
          <div className="grid gap-3 sm:grid-cols-2">
            <div className="space-y-1">
              <Label htmlFor="registrikood">Registrikood</Label>
              <Input id="registrikood" name="registrikood" placeholder="nt 12345678" />
            </div>
            <div className="space-y-1">
              <Label htmlFor="km_nr">KMK nr</Label>
              <Input id="km_nr" name="km_nr" placeholder="nt EE123456789" />
            </div>
          </div>
          <div className="flex items-center gap-2">
            <input
              type="checkbox"
              id="km_kohustuslane"
              name="km_kohustuslane"
              className="h-4 w-4 cursor-pointer accent-vk-blue"
            />
            <Label htmlFor="km_kohustuslane" className="cursor-pointer text-sm font-normal">
              KM-kohustuslane (mõjutab arve märgistust)
            </Label>
          </div>
        </>
      ) : null}

      <div className="grid gap-3 sm:grid-cols-2">
        <div className="space-y-1">
          <Label htmlFor="telefon">Telefon</Label>
          <Input id="telefon" name="telefon" type="tel" placeholder="+372 …" />
        </div>
        <div className="space-y-1">
          <Label htmlFor="email">Email</Label>
          <Input id="email" name="email" type="email" placeholder="nimi@…" />
        </div>
      </div>

      <div className="space-y-1">
        <Label htmlFor="märkused">Märkused (sisemine)</Label>
        <Textarea id="märkused" name="märkused" rows={2} />
      </div>

      {err ? <div className="rounded-md bg-vk-red/10 px-3 py-2 text-sm text-vk-red">{err}</div> : null}
      <Button type="submit" disabled={pending} variant="primary">
        {pending ? <Loader2 className="h-4 w-4 animate-spin" /> : <Plus className="h-4 w-4" />}
        Loo klient
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
