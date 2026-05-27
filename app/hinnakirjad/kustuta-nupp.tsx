"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { Button } from "@/components/ui/button";
import { Loader2, Trash2, AlertTriangle } from "lucide-react";
import { kustutaHinnakiri } from "./actions";

type Props = {
  hinnakirjaId: string;
  tarnijaNimi: string;
  ridade_arv: number;
  redirectTo?: string;
  variant?: "icon" | "button";
};

export function KustutaHinnakiriNupp({
  hinnakirjaId,
  tarnijaNimi,
  ridade_arv,
  redirectTo,
  variant = "icon",
}: Props) {
  const router = useRouter();
  const [confirming, setConfirming] = useState(false);
  const [pending, startTransition] = useTransition();
  const [err, setErr] = useState<string | null>(null);

  function start(e: React.MouseEvent) {
    e.stopPropagation();
    e.preventDefault();
    setConfirming(true);
  }
  function cancel(e: React.MouseEvent) {
    e.stopPropagation();
    e.preventDefault();
    setConfirming(false);
    setErr(null);
  }
  function confirm(e: React.MouseEvent) {
    e.stopPropagation();
    e.preventDefault();
    setErr(null);
    startTransition(async () => {
      const r = await kustutaHinnakiri(hinnakirjaId);
      if (r.ok) {
        if (redirectTo) router.push(redirectTo);
        else router.refresh();
      } else {
        setErr(r.error);
        setConfirming(false);
      }
    });
  }

  if (!confirming) {
    if (variant === "icon") {
      return (
        <Button
          type="button"
          variant="ghost"
          size="icon"
          onClick={start}
          title="Kustuta hinnakiri"
          className="text-muted-foreground hover:text-vk-red"
        >
          <Trash2 className="h-4 w-4" />
        </Button>
      );
    }
    return (
      <Button
        type="button"
        variant="ghost"
        size="sm"
        onClick={start}
        className="text-muted-foreground hover:text-vk-red"
      >
        <Trash2 className="h-4 w-4" />
        Kustuta hinnakiri
      </Button>
    );
  }

  return (
    <div className="flex items-center gap-2">
      <span className="flex items-center gap-1 rounded-md bg-vk-red/10 px-2 py-1 text-[10px] text-vk-red">
        <AlertTriangle className="h-3 w-3" />
        Kustutab <span className="font-mono">{tarnijaNimi}</span> hinnakirja + {ridade_arv} toodet
      </span>
      <Button onClick={confirm} disabled={pending} variant="destructive" size="sm">
        {pending ? <Loader2 className="h-3 w-3 animate-spin" /> : <Trash2 className="h-3 w-3" />}
        Kinnita
      </Button>
      <Button onClick={cancel} disabled={pending} variant="ghost" size="sm">
        Tühista
      </Button>
      {err ? <span className="text-xs text-vk-red">{err}</span> : null}
    </div>
  );
}
