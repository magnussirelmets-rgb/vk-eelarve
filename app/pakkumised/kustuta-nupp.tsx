"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { Button } from "@/components/ui/button";
import { Loader2, Trash2, AlertTriangle } from "lucide-react";
import { kustutaPakkumine } from "./actions";

type Props = {
  pakkumineId: string;
  vkpNr: string;
  /** Kustutamisjärgne suunamine — kasuta "/pakkumised" detail-lehel, jäta lahti list-vaates */
  redirectTo?: string;
  variant?: "icon" | "button";
};

export function KustutaPakkumineNupp({
  pakkumineId,
  vkpNr,
  redirectTo,
  variant = "button",
}: Props) {
  const router = useRouter();
  const [confirming, setConfirming] = useState(false);
  const [pending, startTransition] = useTransition();
  const [err, setErr] = useState<string | null>(null);

  function onClickCancel(e: React.MouseEvent) {
    e.stopPropagation();
    e.preventDefault();
    setConfirming(false);
    setErr(null);
  }

  function onClickStart(e: React.MouseEvent) {
    e.stopPropagation();
    e.preventDefault();
    setConfirming(true);
  }

  function onClickConfirm(e: React.MouseEvent) {
    e.stopPropagation();
    e.preventDefault();
    setErr(null);
    startTransition(async () => {
      const r = await kustutaPakkumine(pakkumineId);
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
          variant="ghost"
          size="icon"
          onClick={onClickStart}
          title="Kustuta pakkumine"
          className="text-muted-foreground hover:text-vk-red"
        >
          <Trash2 className="h-4 w-4" />
        </Button>
      );
    }
    return (
      <Button variant="ghost" size="sm" onClick={onClickStart} className="text-muted-foreground hover:text-vk-red">
        <Trash2 className="h-4 w-4" />
        Kustuta
      </Button>
    );
  }

  return (
    <div className="flex items-center gap-2">
      <span className="flex items-center gap-1 rounded-md bg-vk-red/10 px-2 py-1 text-xs text-vk-red">
        <AlertTriangle className="h-3 w-3" />
        Kustutab pakkumise <span className="font-mono">{vkpNr}</span> + kõik positsioonid &amp; PDF-failid
      </span>
      <Button variant="destructive" size="sm" disabled={pending} onClick={onClickConfirm}>
        {pending ? <Loader2 className="h-3 w-3 animate-spin" /> : <Trash2 className="h-3 w-3" />}
        Kinnita
      </Button>
      <Button variant="ghost" size="sm" onClick={onClickCancel}>
        Tühista
      </Button>
      {err ? <span className="text-xs text-vk-red">{err}</span> : null}
    </div>
  );
}
