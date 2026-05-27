"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Loader2, Check, Pencil, X } from "lucide-react";
import { muudaToodeNimetus } from "../actions";

type Props = {
  tooteId: string;
  algneNimetus: string;
};

export function MuudaNimetus({ tooteId, algneNimetus }: Props) {
  const router = useRouter();
  const [editing, setEditing] = useState(false);
  const [value, setValue] = useState(algneNimetus);
  const [err, setErr] = useState<string | null>(null);
  const [pending, startTransition] = useTransition();

  function start() {
    setValue(algneNimetus);
    setErr(null);
    setEditing(true);
  }

  function cancel() {
    setEditing(false);
    setValue(algneNimetus);
    setErr(null);
  }

  function save() {
    const trimmed = value.trim();
    if (!trimmed) {
      setErr("Nimetus ei tohi olla tühi");
      return;
    }
    if (trimmed === algneNimetus) {
      setEditing(false);
      return;
    }
    setErr(null);
    startTransition(async () => {
      const r = await muudaToodeNimetus(tooteId, trimmed);
      if (r.ok) {
        setEditing(false);
        router.refresh();
      } else {
        setErr(r.error);
      }
    });
  }

  if (!editing) {
    return (
      <div className="flex items-center gap-2">
        <h1 className="text-2xl font-bold tracking-tight text-vk-navy">{algneNimetus}</h1>
        <Button
          type="button"
          variant="ghost"
          size="icon"
          onClick={start}
          title="Muuda nimetust"
          className="text-muted-foreground hover:text-vk-blue"
        >
          <Pencil className="h-3.5 w-3.5" />
        </Button>
      </div>
    );
  }

  return (
    <div className="flex flex-col gap-1">
      <div className="flex items-center gap-2">
        <Input
          autoFocus
          value={value}
          onChange={(e) => setValue(e.target.value)}
          onKeyDown={(e) => {
            if (e.key === "Enter") save();
            else if (e.key === "Escape") cancel();
          }}
          disabled={pending}
          className="h-9 w-full max-w-xl text-lg font-semibold text-vk-navy"
        />
        <Button type="button" onClick={save} disabled={pending} size="sm" variant="primary">
          {pending ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : <Check className="h-3.5 w-3.5" />}
          Salvesta
        </Button>
        <Button type="button" onClick={cancel} disabled={pending} size="sm" variant="ghost">
          <X className="h-3.5 w-3.5" />
        </Button>
      </div>
      {err ? <span className="text-xs text-vk-red">{err}</span> : null}
    </div>
  );
}
