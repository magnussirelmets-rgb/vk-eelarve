"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { Button } from "@/components/ui/button";
import { Loader2, Trash2, Check, X } from "lucide-react";
import { muudaKomplektiRea, kustutaKomplektiRida } from "../actions";

type Props = {
  reaId: string;
  algneKogus: number;
  ühik: string | null;
  kustutaNupp?: boolean;
};

export function KomplektiRidaActions({ reaId, algneKogus, ühik, kustutaNupp }: Props) {
  const router = useRouter();
  const [value, setValue] = useState(String(algneKogus).replace(".", ","));
  const [busy, setBusy] = useState(false);
  const [state, setState] = useState<"idle" | "ok" | "err">("idle");
  const [, startNav] = useTransition();

  if (kustutaNupp) {
    return (
      <Button
        onClick={() => {
          startNav(async () => {
            const r = await kustutaKomplektiRida(reaId);
            if (r.ok) router.refresh();
          });
        }}
        variant="ghost"
        size="sm"
        className="h-7 w-7 p-0"
        title="Eemalda rida komplektist"
      >
        <Trash2 className="h-3 w-3" />
      </Button>
    );
  }

  async function save() {
    const initial = String(algneKogus).replace(".", ",");
    if (value === initial) return;
    setBusy(true);
    setState("idle");
    const n = Number(value.replace(",", "."));
    if (!Number.isFinite(n) || n <= 0) {
      setState("err");
      setBusy(false);
      return;
    }
    const r = await muudaKomplektiRea(reaId, { kogus: n });
    setBusy(false);
    if (r.ok) {
      setState("ok");
      startNav(() => router.refresh());
      setTimeout(() => setState("idle"), 1500);
    } else {
      setState("err");
    }
  }

  const dirty = value !== String(algneKogus).replace(".", ",");
  const borderClass =
    state === "ok"
      ? "border-vk-blue"
      : state === "err" || dirty
        ? "border-amber-400 bg-amber-50"
        : "";

  return (
    <div className="flex items-center gap-1">
      <input
        value={value}
        onChange={(e) => {
          setValue(e.target.value);
          setState("idle");
        }}
        onBlur={save}
        onKeyDown={(e) => {
          if (e.key === "Enter") {
            e.preventDefault();
            (e.target as HTMLInputElement).blur();
          }
        }}
        disabled={busy}
        className={`h-7 w-16 rounded-md border border-input bg-background px-2 text-right font-mono text-xs ${borderClass}`}
      />
      <span className="text-[10px] text-muted-foreground">{ühik ?? ""}</span>
      {busy ? (
        <Loader2 className="h-3 w-3 animate-spin text-muted-foreground" />
      ) : state === "ok" ? (
        <Check className="h-3 w-3 text-vk-blue" />
      ) : null}
    </div>
  );
}
