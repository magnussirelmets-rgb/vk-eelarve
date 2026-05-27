"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { Button } from "@/components/ui/button";
import { Loader2, Trash2, AlertTriangle } from "lucide-react";
import { kustutaKomplekt } from "../actions";

export function KomplektiKustutaNupp({ komplektId, komplektNimi }: { komplektId: string; komplektNimi: string }) {
  const router = useRouter();
  const [pending, startTransition] = useTransition();
  const [confirming, setConfirming] = useState(false);

  async function doDelete() {
    startTransition(async () => {
      const r = await kustutaKomplekt(komplektId);
      if (r.ok) router.push("/komplektid");
    });
  }

  if (!confirming) {
    return (
      <Button onClick={() => setConfirming(true)} variant="ghost" size="sm">
        <Trash2 className="h-4 w-4" />
        Kustuta komplekt
      </Button>
    );
  }
  return (
    <div className="flex items-center gap-2">
      <span className="flex items-center gap-1 rounded-md bg-vk-red/10 px-2 py-1 text-xs text-vk-red">
        <AlertTriangle className="h-3 w-3" />
        Pole tagasi
      </span>
      <Button onClick={doDelete} disabled={pending} variant="destructive" size="sm">
        {pending ? <Loader2 className="h-4 w-4 animate-spin" /> : <Trash2 className="h-4 w-4" />}
        Kustuta &quot;{komplektNimi}&quot;
      </Button>
      <Button onClick={() => setConfirming(false)} disabled={pending} variant="ghost" size="sm">
        Tühista
      </Button>
    </div>
  );
}
