"use client";

import { useRouter } from "next/navigation";
import { useState, useTransition } from "react";
import { Button } from "@/components/ui/button";
import { Loader2, Sparkles } from "lucide-react";

type Props = {
  hinnakirjaId: string;
  staatus: string;
  artikleidKokku: number;
};

export function ActionBar({ hinnakirjaId, staatus, artikleidKokku }: Props) {
  const router = useRouter();
  const [busy, setBusy] = useState(false);
  const [msg, setMsg] = useState<{ kind: "ok" | "err"; text: string } | null>(null);
  const [, startTransition] = useTransition();

  async function parse() {
    setBusy(true);
    setMsg(null);
    try {
      const r = await fetch(`/api/hinnakirjad/${hinnakirjaId}/parse`, { method: "POST" });
      const data = await r.json();
      if (!r.ok || !data.ok) {
        setMsg({ kind: "err", text: data.error ?? "Parsing ebaõnnestus" });
      } else {
        setMsg({
          kind: "ok",
          text: `${data.parsitud} toodet parsitud (input ${data.input_tokens}, output ${data.output_tokens} tokenit). Lähevad otse kataloogi.`,
        });
        startTransition(() => router.refresh());
      }
    } catch (e) {
      setMsg({ kind: "err", text: e instanceof Error ? e.message : String(e) });
    } finally {
      setBusy(false);
    }
  }

  const showParse = staatus === "mustand" || staatus === "viga";

  return (
    <div className="space-y-3">
      <div className="flex flex-wrap gap-2">
        {showParse ? (
          <Button onClick={parse} disabled={busy} variant="primary">
            {busy ? <Loader2 className="h-4 w-4 animate-spin" /> : <Sparkles className="h-4 w-4" />}
            Parsi {staatus === "viga" ? "uuesti" : "PDF/Excel AI-ga"}
          </Button>
        ) : (
          <Button onClick={parse} disabled={busy} variant="outline">
            {busy ? <Loader2 className="h-4 w-4 animate-spin" /> : <Sparkles className="h-4 w-4" />}
            Parsi uuesti ({artikleidKokku} olemasolevat toodet asendatakse)
          </Button>
        )}
      </div>
      {msg ? (
        <div
          className={`rounded-md px-3 py-2 text-sm ${
            msg.kind === "ok" ? "bg-vk-blue/10 text-vk-blue" : "bg-vk-red/10 text-vk-red"
          }`}
        >
          {msg.text}
        </div>
      ) : null}
    </div>
  );
}
