"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { TableCell, TableRow } from "@/components/ui/table";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Pencil, Check, X, Trash2, Loader2, AlertTriangle } from "lucide-react";
import { formatDate } from "@/lib/utils";
import { muudaTarnijat, kustutaTarnija } from "../actions";

type Props = {
  t: {
    nimi: string;
    hinnakirju: number;
    riduKokku: number;
    viimaneLaetud: string | null;
  };
};

export function TarnijaRida({ t }: Props) {
  const router = useRouter();
  const [editing, setEditing] = useState(false);
  const [confirmingDelete, setConfirmingDelete] = useState(false);
  const [value, setValue] = useState(t.nimi);
  const [pending, startTransition] = useTransition();
  const [err, setErr] = useState<string | null>(null);

  function startEdit() {
    setValue(t.nimi);
    setErr(null);
    setEditing(true);
  }

  function cancelEdit() {
    setEditing(false);
    setValue(t.nimi);
    setErr(null);
  }

  function saveEdit() {
    const trimmed = value.trim();
    if (!trimmed) {
      setErr("Nimi ei tohi olla tühi");
      return;
    }
    if (trimmed === t.nimi) {
      setEditing(false);
      return;
    }
    setErr(null);
    startTransition(async () => {
      const r = await muudaTarnijat(t.nimi, trimmed);
      if (r.ok) {
        setEditing(false);
        router.refresh();
      } else {
        setErr(r.error);
      }
    });
  }

  function doDelete() {
    setErr(null);
    startTransition(async () => {
      const r = await kustutaTarnija(t.nimi);
      if (r.ok) {
        setConfirmingDelete(false);
        router.refresh();
      } else {
        setErr(r.error);
        setConfirmingDelete(false);
      }
    });
  }

  return (
    <TableRow>
      <TableCell className="font-medium">
        {editing ? (
          <div className="flex items-center gap-2">
            <Input
              autoFocus
              value={value}
              onChange={(e) => setValue(e.target.value)}
              onKeyDown={(e) => {
                if (e.key === "Enter") saveEdit();
                else if (e.key === "Escape") cancelEdit();
              }}
              disabled={pending}
              className="h-8 max-w-sm text-sm"
            />
            <Button onClick={saveEdit} disabled={pending} size="sm" variant="primary" className="h-8">
              {pending ? <Loader2 className="h-3 w-3 animate-spin" /> : <Check className="h-3 w-3" />}
              Salvesta
            </Button>
            <Button onClick={cancelEdit} disabled={pending} size="sm" variant="ghost" className="h-8">
              <X className="h-3 w-3" />
            </Button>
          </div>
        ) : (
          <span className="text-vk-navy">{t.nimi}</span>
        )}
        {err ? <div className="mt-1 text-xs text-vk-red">{err}</div> : null}
      </TableCell>
      <TableCell className="text-right font-mono text-xs">{t.hinnakirju}</TableCell>
      <TableCell className="text-right font-mono text-xs">{t.riduKokku}</TableCell>
      <TableCell className="font-mono text-xs">
        {t.viimaneLaetud ? formatDate(t.viimaneLaetud) : "—"}
      </TableCell>
      <TableCell className="text-right">
        {confirmingDelete ? (
          <div className="flex items-center justify-end gap-1.5">
            <span className="flex items-center gap-1 rounded-md bg-vk-red/10 px-2 py-1 text-[10px] text-vk-red">
              <AlertTriangle className="h-3 w-3" />
              Kustutab {t.hinnakirju} hinnakirja + {t.riduKokku} toodet
            </span>
            <Button
              onClick={doDelete}
              disabled={pending}
              variant="destructive"
              size="sm"
              className="h-7"
            >
              {pending ? <Loader2 className="h-3 w-3 animate-spin" /> : <Trash2 className="h-3 w-3" />}
              Kinnita
            </Button>
            <Button
              onClick={() => setConfirmingDelete(false)}
              disabled={pending}
              variant="ghost"
              size="sm"
              className="h-7"
            >
              Tühista
            </Button>
          </div>
        ) : editing ? null : (
          <div className="flex items-center justify-end gap-1">
            <Button
              onClick={startEdit}
              variant="ghost"
              size="sm"
              className="h-7"
              title="Muuda nime"
            >
              <Pencil className="h-3 w-3" />
              Muuda
            </Button>
            <Button
              onClick={() => setConfirmingDelete(true)}
              variant="ghost"
              size="sm"
              className="h-7 text-muted-foreground hover:text-vk-red"
              title="Kustuta tarnija (cascade)"
            >
              <Trash2 className="h-3 w-3" />
              Kustuta
            </Button>
          </div>
        )}
      </TableCell>
    </TableRow>
  );
}
