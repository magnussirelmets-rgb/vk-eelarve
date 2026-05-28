"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { Button } from "@/components/ui/button";
import { Loader2, FilePlus2 } from "lucide-react";
import { looPakkumineSamaleObjektile } from "../actions";

type Props = {
  algneId: string;
  objektiNimi: string | null;
};

export function UusSamaleObjektileNupp({ algneId, objektiNimi }: Props) {
  const router = useRouter();
  const [pending, startTransition] = useTransition();
  const [err, setErr] = useState<string | null>(null);

  function onClick() {
    setErr(null);
    startTransition(async () => {
      const r = await looPakkumineSamaleObjektile(algneId);
      if (r.ok) {
        router.push(`/pakkumised/${r.id}`);
      } else {
        setErr(r.error);
      }
    });
  }

  return (
    <div className="flex flex-col items-end gap-1">
      <Button
        onClick={onClick}
        disabled={pending}
        variant="outline"
        size="sm"
        title={
          objektiNimi
            ? `Loo uus pakkumine objektile "${objektiNimi}" — sama tellija + objekt + projekt, tühi positsioonidest`
            : "Loo uus pakkumine"
        }
      >
        {pending ? <Loader2 className="h-4 w-4 animate-spin" /> : <FilePlus2 className="h-4 w-4" />}
        Uus pakkumine samale objektile
      </Button>
      {err ? <span className="text-xs text-vk-red">{err}</span> : null}
    </div>
  );
}
