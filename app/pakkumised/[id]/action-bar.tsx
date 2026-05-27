"use client";

import { useRouter } from "next/navigation";
import { useState, useTransition } from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Loader2, Sparkles, Upload, Trash2, FileText, Plus, AlertTriangle } from "lucide-react";
import type { PakkumiseMahutabel } from "@/lib/types";
import { formatDate } from "@/lib/utils";
import { lisaTäiendavMahutabel, kustutaMahutabel } from "../actions";

type Props = {
  pakkumineId: string;
  mahutabelid: PakkumiseMahutabel[];
};

export function ActionBar({ pakkumineId, mahutabelid }: Props) {
  const router = useRouter();
  const [busy, setBusy] = useState<string | null>(null);
  const [msg, setMsg] = useState<{ kind: "ok" | "err"; text: string } | null>(null);
  const [showUpload, setShowUpload] = useState(mahutabelid.length === 0);
  const [confirmingDelete, setConfirmingDelete] = useState<string | null>(null);
  const [, startNav] = useTransition();

  async function onUpload(formData: FormData) {
    setBusy("upload");
    setMsg(null);
    const r = await lisaTäiendavMahutabel(pakkumineId, formData);
    setBusy(null);
    if (r.ok) {
      setMsg({ kind: "ok", text: "Mahutabel üles laetud. Vajuta nüüd 'Parsi' selle juures." });
      setShowUpload(mahutabelid.length === 0);
      startNav(() => router.refresh());
    } else {
      setMsg({ kind: "err", text: r.error });
    }
  }

  async function parse(mahutabelId: string) {
    setBusy(`parse:${mahutabelId}`);
    setMsg(null);
    try {
      const r = await fetch(`/api/pakkumised/${pakkumineId}/parse?mahutabel=${mahutabelId}`, {
        method: "POST",
      });
      const data = await r.json();
      if (!r.ok || !data.ok) {
        setMsg({ kind: "err", text: data.error ?? "Parsing ebaõnnestus" });
      } else {
        const autoMsg =
          data.auto_linked > 0
            ? ` · ${data.auto_linked} auto-linkitud varasemate pakkumiste põhjal`
            : "";
        setMsg({
          kind: "ok",
          text: `${data.parsitud} positsiooni parsitud (input ${data.input_tokens}, output ${data.output_tokens} tokenit)${autoMsg}.`,
        });
        startNav(() => router.refresh());
      }
    } catch (e) {
      setMsg({ kind: "err", text: e instanceof Error ? e.message : String(e) });
    } finally {
      setBusy(null);
    }
  }

  async function doDelete(mahutabelId: string) {
    setBusy(`delete:${mahutabelId}`);
    setMsg(null);
    const r = await kustutaMahutabel(mahutabelId);
    setBusy(null);
    setConfirmingDelete(null);
    if (r.ok) {
      setMsg({ kind: "ok", text: "Mahutabel kustutatud (positsioonid jäid alles, vajavad eraldi puhastust kui vaja)" });
      startNav(() => router.refresh());
    } else {
      setMsg({ kind: "err", text: r.error });
    }
  }

  return (
    <div className="space-y-3">
      <div className="rounded-lg border bg-card">
        <div className="flex items-center justify-between border-b px-4 py-2">
          <div className="text-sm font-semibold">Mahutabelid ({mahutabelid.length})</div>
          <Button onClick={() => setShowUpload((s) => !s)} disabled={busy !== null} variant="outline" size="sm">
            <Plus className="h-3 w-3" />
            {showUpload ? "Sulge upload" : "Lisa täiendav mahutabel"}
          </Button>
        </div>

        {mahutabelid.length === 0 ? (
          <div className="px-4 py-3 text-sm text-muted-foreground">
            Ühtegi mahutabelit pole veel üles laaditud.
          </div>
        ) : (
          <ul className="divide-y">
            {mahutabelid.map((m) => {
              const isConfirming = confirmingDelete === m.id;
              const isParseBusy = busy === `parse:${m.id}`;
              const isDeleteBusy = busy === `delete:${m.id}`;
              return (
                <li key={m.id} className="flex flex-wrap items-center justify-between gap-3 px-4 py-3">
                  <div className="flex min-w-0 items-center gap-2">
                    <FileText className="h-4 w-4 shrink-0 text-muted-foreground" />
                    <div className="min-w-0">
                      <div className="truncate text-sm">{m.faili_nimi ?? m.faili_path}</div>
                      <div className="text-xs text-muted-foreground">
                        {m.parsitud_ajal ? (
                          <span>Parsitud {formatDate(m.parsitud_ajal)}</span>
                        ) : (
                          <span className="italic">Pole veel parsitud</span>
                        )}
                        <span className="mx-2">·</span>
                        Laetud {formatDate(m.loodud)}
                      </div>
                    </div>
                  </div>
                  <div className="flex items-center gap-2">
                    {isConfirming ? (
                      <>
                        <span className="flex items-center gap-1 rounded-md bg-vk-red/10 px-2 py-1 text-xs text-vk-red">
                          <AlertTriangle className="h-3 w-3" />
                          Kustutab mahutabeli + faili (positsioonid jäävad)
                        </span>
                        <Button onClick={() => doDelete(m.id)} disabled={isDeleteBusy} variant="destructive" size="sm">
                          {isDeleteBusy ? <Loader2 className="h-3 w-3 animate-spin" /> : <Trash2 className="h-3 w-3" />}
                          Kinnita
                        </Button>
                        <Button onClick={() => setConfirmingDelete(null)} variant="ghost" size="sm">
                          Tühista
                        </Button>
                      </>
                    ) : (
                      <>
                        <Button onClick={() => parse(m.id)} disabled={busy !== null} variant="primary" size="sm">
                          {isParseBusy ? <Loader2 className="h-3 w-3 animate-spin" /> : <Sparkles className="h-3 w-3" />}
                          {m.parsitud_ajal ? "Parsi uuesti" : "Parsi AI-ga"}
                        </Button>
                        <Button onClick={() => setConfirmingDelete(m.id)} disabled={busy !== null} variant="ghost" size="sm">
                          <Trash2 className="h-3 w-3" />
                        </Button>
                      </>
                    )}
                  </div>
                </li>
              );
            })}
          </ul>
        )}

        {showUpload ? (
          <form action={onUpload} className="border-t bg-muted/30 px-4 py-3 space-y-2">
            <Label htmlFor="mahutabel" className="text-xs">
              Lae üles PDF mahutabel
            </Label>
            <div className="flex items-center gap-2">
              <Input
                id="mahutabel"
                name="mahutabel"
                type="file"
                accept=".pdf"
                required
                className="cursor-pointer"
              />
              <Button type="submit" disabled={busy === "upload"} variant="primary" size="sm">
                {busy === "upload" ? <Loader2 className="h-4 w-4 animate-spin" /> : <Upload className="h-4 w-4" />}
                Laadi
              </Button>
            </div>
            <p className="text-[10px] text-muted-foreground">
              PDF, max 20 MB. Pärast üleslaadimist parsige fail eraldi nupuga. Mitu mahutabelit
              võimaldab näiteks lisada täiendava korpuse / täiendavad korruste mahutabelid samale
              objektile.
            </p>
          </form>
        ) : null}
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
