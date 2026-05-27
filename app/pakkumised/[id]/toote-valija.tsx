"use client";

import { useState, useTransition, useEffect } from "react";
import { useRouter } from "next/navigation";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Search, X, Loader2, Check } from "lucide-react";
import { otsiTooteid, seoToode, type ToodeKandidaat } from "../actions";
import { formatEur, formatNum } from "@/lib/utils";

type Props = {
  positsioonId: string;
  algneOtsing: string;
  praeguneToodeId: string | null;
};

export function ToodeValija({ positsioonId, algneOtsing, praeguneToodeId }: Props) {
  const router = useRouter();
  const [open, setOpen] = useState(false);
  const [q, setQ] = useState(algneOtsing);
  const [tulemused, setTulemused] = useState<ToodeKandidaat[]>([]);
  const [searching, startSearch] = useTransition();
  const [, startNav] = useTransition();
  const [linking, setLinking] = useState(false);

  // Automaatne otsing kui dialog avaneb
  useEffect(() => {
    if (open && q.length >= 2) {
      startSearch(async () => {
        const r = await otsiTooteid(q);
        setTulemused(r);
      });
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [open]);

  function onChange(value: string) {
    setQ(value);
    if (value.trim().length < 2) {
      setTulemused([]);
      return;
    }
    startSearch(async () => {
      const r = await otsiTooteid(value);
      setTulemused(r);
    });
  }

  async function vali(toodeId: string) {
    setLinking(true);
    const r = await seoToode(positsioonId, toodeId);
    setLinking(false);
    if (r.ok) {
      setOpen(false);
      if (r.propagated && r.propagated > 0) {
        // Pole kohane luksus toast-system'i veel — kasutaja näeb refresh'i järel teised read juba linkitud
        console.log(`Propageeritud ${r.propagated} samas pakkumises olevat sama-laadi rida`);
      }
      startNav(() => router.refresh());
    }
  }

  async function eemalda() {
    setLinking(true);
    const r = await seoToode(positsioonId, null);
    setLinking(false);
    if (r.ok) startNav(() => router.refresh());
  }

  if (!open) {
    return (
      <div className="flex items-center gap-1">
        <Button
          onClick={() => setOpen(true)}
          size="sm"
          variant={praeguneToodeId ? "ghost" : "outline"}
          className="h-7 px-2 text-xs"
        >
          <Search className="h-3 w-3" />
          {praeguneToodeId ? "Vaheta" : "Vali toode"}
        </Button>
        {praeguneToodeId ? (
          <Button
            onClick={eemalda}
            disabled={linking}
            size="sm"
            variant="ghost"
            className="h-7 w-7 p-0"
            title="Eemalda toote seos"
          >
            {linking ? <Loader2 className="h-3 w-3 animate-spin" /> : <X className="h-3 w-3" />}
          </Button>
        ) : null}
      </div>
    );
  }

  return (
    <div className="space-y-1 rounded-md border bg-background p-2 shadow-md">
      <div className="flex items-center gap-1">
        <Input
          autoFocus
          value={q}
          onChange={(e) => onChange(e.target.value)}
          placeholder="Otsi tarnijatest…"
          className="h-7 text-xs"
        />
        <Button
          onClick={() => setOpen(false)}
          variant="ghost"
          size="sm"
          className="h-7 w-7 p-0"
        >
          <X className="h-3 w-3" />
        </Button>
      </div>
      {searching ? (
        <div className="px-1 py-1 text-[10px] text-muted-foreground">Otsin…</div>
      ) : tulemused.length === 0 && q.length >= 2 ? (
        <div className="px-1 py-1 text-[10px] text-muted-foreground">Ei leidnud</div>
      ) : (
        <ul className="max-h-60 overflow-y-auto">
          {tulemused.map((k) => (
            <li key={k.id}>
              <button
                type="button"
                onClick={() => vali(k.id)}
                disabled={linking}
                className="block w-full rounded px-2 py-1.5 text-left text-[11px] hover:bg-muted disabled:opacity-50"
              >
                <div className="flex items-center justify-between gap-2">
                  <div className="font-medium">
                    <span className="rounded bg-vk-navy/10 px-1 text-[10px]">{k.tarnija}</span>
                    {k.tarnija_kood ? <span className="ml-1 font-mono text-muted-foreground">{k.tarnija_kood}</span> : null}
                    {k.tarnija_brand ? <span className="ml-1 text-muted-foreground">· {k.tarnija_brand}</span> : null}
                  </div>
                  <span className="font-mono text-vk-blue">{formatEur(k.ostuhind_neto)}</span>
                </div>
                <div className="text-muted-foreground">{k.tarnija_nimetus}</div>
                {k.paigaldusaeg_h_ühik !== null ? (
                  <div className="text-[10px] text-muted-foreground">
                    paigald. {formatNum(k.paigaldusaeg_h_ühik)} h/{k.ühik ?? "—"}
                  </div>
                ) : null}
              </button>
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}
