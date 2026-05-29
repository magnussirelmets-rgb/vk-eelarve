"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Loader2, Save, Trash2, AlertTriangle, Home, Building2 } from "lucide-react";
import type { Klient } from "@/lib/types";
import { muudaKlient, kustutaKlient } from "../actions";

export function MuudaKlientForm({ klient }: { klient: Klient }) {
  const router = useRouter();
  const [pending, startTransition] = useTransition();
  const [confirming, setConfirming] = useState(false);
  const [tüüp, setTüüp] = useState<"eraisik" | "juriidiline">(klient.tüüp);
  const [nimi, setNimi] = useState(klient.nimi);
  const [email, setEmail] = useState(klient.email ?? "");
  const [telefon, setTelefon] = useState(klient.telefon ?? "");
  const [registrikood, setRegistrikood] = useState(klient.registrikood ?? "");
  const [kmNr, setKmNr] = useState(klient.km_nr ?? "");
  const [kmKohustuslane, setKmKohustuslane] = useState(klient.km_kohustuslane);
  const [märkused, setMärkused] = useState(klient.märkused ?? "");
  const [msg, setMsg] = useState<{ kind: "ok" | "err"; text: string } | null>(null);

  async function save() {
    setMsg(null);
    if (!nimi.trim()) {
      setMsg({ kind: "err", text: "Nimi on kohustuslik" });
      return;
    }
    startTransition(async () => {
      const r = await muudaKlient(klient.id, {
        nimi: nimi.trim(),
        tüüp,
        email: email.trim() || null,
        telefon: telefon.trim() || null,
        registrikood: registrikood.trim() || null,
        km_kohustuslane: kmKohustuslane,
        km_nr: kmNr.trim() || null,
        märkused: märkused.trim() || null,
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
      const r = await kustutaKlient(klient.id);
      if (r.ok) router.push("/kliendid");
      else setMsg({ kind: "err", text: r.error });
    });
  }

  const isJur = tüüp === "juriidiline";

  return (
    <div className="space-y-4">
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
        <Input id="nimi" value={nimi} onChange={(e) => setNimi(e.target.value)} required />
      </div>

      {isJur ? (
        <>
          <div className="grid gap-3 sm:grid-cols-2">
            <div className="space-y-1">
              <Label htmlFor="registrikood">Registrikood</Label>
              <Input
                id="registrikood"
                value={registrikood}
                onChange={(e) => setRegistrikood(e.target.value)}
              />
            </div>
            <div className="space-y-1">
              <Label htmlFor="km_nr">KMK nr</Label>
              <Input id="km_nr" value={kmNr} onChange={(e) => setKmNr(e.target.value)} />
            </div>
          </div>
          <div className="flex items-center gap-2">
            <input
              type="checkbox"
              id="km_kohustuslane"
              checked={kmKohustuslane}
              onChange={(e) => setKmKohustuslane(e.target.checked)}
              className="h-4 w-4 cursor-pointer accent-vk-blue"
            />
            <Label htmlFor="km_kohustuslane" className="cursor-pointer text-sm font-normal">
              KM-kohustuslane
            </Label>
          </div>
        </>
      ) : null}

      <div className="grid gap-3 sm:grid-cols-2">
        <div className="space-y-1">
          <Label htmlFor="telefon">Telefon</Label>
          <Input
            id="telefon"
            value={telefon}
            onChange={(e) => setTelefon(e.target.value)}
            type="tel"
          />
        </div>
        <div className="space-y-1">
          <Label htmlFor="email">Email</Label>
          <Input id="email" value={email} onChange={(e) => setEmail(e.target.value)} type="email" />
        </div>
      </div>

      <div className="space-y-1">
        <Label htmlFor="märkused">Märkused (sisemine)</Label>
        <Textarea
          id="märkused"
          value={märkused}
          onChange={(e) => setMärkused(e.target.value)}
          rows={2}
        />
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
              Kliendi kustutamine kustutab kõik tema objektid (CASCADE).
              Pakkumiste klient_id NULLitakse — tellija_nimi/email/telefon säilib.
            </span>
            <Button onClick={kustuta} disabled={pending} variant="destructive" size="sm">
              <Trash2 className="h-3 w-3" />
              Kinnita
            </Button>
            <Button
              onClick={() => setConfirming(false)}
              disabled={pending}
              variant="ghost"
              size="sm"
            >
              Tühista
            </Button>
          </div>
        ) : (
          <Button
            onClick={() => setConfirming(true)}
            disabled={pending}
            variant="ghost"
            size="sm"
          >
            <Trash2 className="h-3 w-3" />
            Kustuta klient
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
