"use client";

import Link from "next/link";
import { useState, useMemo, useEffect, useTransition, type ChangeEvent } from "react";
import { useRouter } from "next/navigation";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Save, Loader2, X, FileText, Undo2, FolderPlus, Trash2, AlertTriangle } from "lucide-react";
import type { HinnakirjaRidaKataloogis, Tootegrupp } from "@/lib/types";
import { formatEur, formatDate } from "@/lib/utils";
import { salvestaPaigaldusajadMass, ignoreeriMassi, kustutaTooted } from "./actions";
import { seoToodedGrupiga } from "../grupid/actions";

function parseAeg(raw: string): { ok: true; value: number | null } | { ok: false } {
  const t = raw.trim();
  if (t === "") return { ok: true, value: null };
  const n = Number(t.replace(",", "."));
  if (!Number.isFinite(n) || n < 0) return { ok: false };
  return { ok: true, value: n };
}

function aegToString(v: number | null | undefined): string {
  if (v === null || v === undefined) return "";
  return String(v).replace(".", ",");
}

export function TootedTabel({
  read,
  grupid,
}: {
  read: HinnakirjaRidaKataloogis[];
  grupid: Tootegrupp[];
}) {
  const router = useRouter();

  // Algne väärtus DB-st (uuendub pärast salvestust)
  const [origValues, setOrigValues] = useState<Record<string, number | null>>(() => {
    const m: Record<string, number | null> = {};
    for (const r of read) m[r.id] = r.paigaldusaeg_h_ühik;
    return m;
  });
  // Praegune input-string per rida
  const [inputValues, setInputValues] = useState<Record<string, string>>(() => {
    const m: Record<string, string> = {};
    for (const r of read) m[r.id] = aegToString(r.paigaldusaeg_h_ühik);
    return m;
  });
  // Sünkroniseeri kui server toob uue read'i (nt pärast ignoreerimist tabel uueneb)
  useEffect(() => {
    const nextOrig: Record<string, number | null> = {};
    const nextInput: Record<string, string> = {};
    for (const r of read) {
      nextOrig[r.id] = r.paigaldusaeg_h_ühik;
      // Kui kasutaja on muudatuses, hoia tema väärtust; muidu sünkroniseeri DB-ga
      const existingInput = inputValues[r.id];
      const existingOrig = origValues[r.id];
      const isDirty =
        existingInput !== undefined &&
        existingInput !== aegToString(existingOrig ?? null);
      nextInput[r.id] = isDirty ? existingInput : aegToString(r.paigaldusaeg_h_ühik);
    }
    setOrigValues(nextOrig);
    setInputValues(nextInput);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [read]);

  const [selected, setSelected] = useState<Set<string>>(new Set());
  const [bulkAeg, setBulkAeg] = useState("");
  const [bulkGrupId, setBulkGrupId] = useState<string>("");
  const [busy, setBusy] = useState<null | "save" | "ignore" | "grup" | "delete" | "delete-row">(null);
  const [confirmingBulkDelete, setConfirmingBulkDelete] = useState(false);
  const [confirmingRowDelete, setConfirmingRowDelete] = useState<string | null>(null);
  const [msg, setMsg] = useState<{ kind: "ok" | "err"; text: string } | null>(null);
  const [, startNav] = useTransition();

  // Arvuta muutmata ridade ID-d (kus input != orig)
  const { pendingIds, invalidIds } = useMemo(() => {
    const pending: string[] = [];
    const invalid: string[] = [];
    for (const r of read) {
      const inp = inputValues[r.id] ?? "";
      const orig = aegToString(origValues[r.id]);
      if (inp !== orig) {
        const p = parseAeg(inp);
        if (!p.ok) invalid.push(r.id);
        else pending.push(r.id);
      }
    }
    return { pendingIds: pending, invalidIds: invalid };
  }, [read, inputValues, origValues]);

  function setInput(id: string, value: string) {
    setInputValues((prev) => ({ ...prev, [id]: value }));
    setMsg(null);
  }
  function toggleOne(id: string, on: boolean) {
    setSelected((prev) => {
      const next = new Set(prev);
      if (on) next.add(id);
      else next.delete(id);
      return next;
    });
  }
  function toggleAll(on: boolean) {
    setSelected(on ? new Set(read.map((r) => r.id)) : new Set());
  }

  function bulkApplyToSelected() {
    if (selected.size === 0) return;
    const ids = Array.from(selected);
    setInputValues((prev) => {
      const next = { ...prev };
      for (const id of ids) next[id] = bulkAeg;
      return next;
    });
    setMsg({
      kind: "ok",
      text: `${ids.length} rea paigaldusaeg täidetud sisestusväljadele. Vajuta "Salvesta muudatused" et DB-sse kanda.`,
    });
  }

  async function saveAll() {
    if (invalidIds.length > 0) {
      setMsg({ kind: "err", text: `${invalidIds.length} reas on vigane väärtus — punase äärisega input` });
      return;
    }
    if (pendingIds.length === 0) {
      setMsg({ kind: "err", text: "Pole midagi salvestada" });
      return;
    }
    const changes = pendingIds.map((id) => {
      const p = parseAeg(inputValues[id]);
      return {
        id,
        paigaldusaeg_h_ühik: p.ok ? p.value : null,
      };
    });
    setBusy("save");
    setMsg(null);
    const r = await salvestaPaigaldusajadMass(changes);
    setBusy(null);
    if (r.ok) {
      // Uuenda orig — pending tühjeneb automaatselt
      setOrigValues((prev) => {
        const next = { ...prev };
        for (const c of changes) next[c.id] = c.paigaldusaeg_h_ühik;
        return next;
      });
      setMsg({ kind: "ok", text: `${r.uuendatud} rea paigaldusaeg salvestatud` });
    } else {
      setMsg({ kind: "err", text: r.error });
    }
  }

  function revertAll() {
    setInputValues((prev) => {
      const next = { ...prev };
      for (const id of pendingIds.concat(invalidIds)) {
        next[id] = aegToString(origValues[id]);
      }
      return next;
    });
    setMsg(null);
  }

  async function bulkIgnore() {
    if (selected.size === 0) return;
    setBusy("ignore");
    setMsg(null);
    const r = await ignoreeriMassi(Array.from(selected));
    setBusy(null);
    if (r.ok) {
      setMsg({ kind: "ok", text: `${r.uuendatud} rida ignoreeritud (kadusid kataloogist)` });
      setSelected(new Set());
      startNav(() => router.refresh());
    } else {
      setMsg({ kind: "err", text: r.error });
    }
  }

  async function bulkDelete() {
    if (selected.size === 0) return;
    setBusy("delete");
    setMsg(null);
    const r = await kustutaTooted(Array.from(selected));
    setBusy(null);
    setConfirmingBulkDelete(false);
    if (r.ok) {
      setMsg({
        kind: "ok",
        text: `${r.kustutatud} toode püsivalt kustutatud (pakkumised säilivad snapshot-väärtustega)`,
      });
      setSelected(new Set());
      startNav(() => router.refresh());
    } else {
      setMsg({ kind: "err", text: r.error });
    }
  }

  async function rowDelete(id: string) {
    setBusy("delete-row");
    setMsg(null);
    const r = await kustutaTooted([id]);
    setBusy(null);
    setConfirmingRowDelete(null);
    if (r.ok) {
      setMsg({ kind: "ok", text: "Toode kustutatud" });
      setSelected((prev) => {
        const next = new Set(prev);
        next.delete(id);
        return next;
      });
      startNav(() => router.refresh());
    } else {
      setMsg({ kind: "err", text: r.error });
    }
  }

  async function bulkSeoGrupiga() {
    if (selected.size === 0) return;
    if (!bulkGrupId) {
      setMsg({ kind: "err", text: "Vali grupp" });
      return;
    }
    setBusy("grup");
    setMsg(null);
    const grupId = bulkGrupId === "__none__" ? null : bulkGrupId;
    const r = await seoToodedGrupiga(Array.from(selected), grupId);
    setBusy(null);
    if (r.ok) {
      const grupNimi = grupId ? grupid.find((g) => g.id === grupId)?.nimi : "(teenuse-seos eemaldatud)";
      setMsg({
        kind: "ok",
        text: `${r.uuendatud} toodet seotud teenusega: ${grupNimi}`,
      });
      setSelected(new Set());
      setBulkGrupId("");
      startNav(() => router.refresh());
    } else {
      setMsg({ kind: "err", text: r.error });
    }
  }

  const pendingCount = pendingIds.length + invalidIds.length;
  const allSelected = selected.size > 0 && selected.size === read.length;
  const someSelected = selected.size > 0 && selected.size < read.length;

  return (
    <div className="space-y-3">
      {/* Sticky bar — pending muudatused JA/VÕI valik */}
      {(pendingCount > 0 || selected.size > 0) ? (
        <div className="sticky top-0 z-10 space-y-2">
          {pendingCount > 0 ? (
            <div className="flex flex-wrap items-center justify-between gap-3 rounded-md border bg-amber-50 px-4 py-2.5 text-sm shadow-sm">
              <span className="font-medium">
                <span className="font-mono text-amber-700">{pendingCount}</span> salvestamata muudatust
                {invalidIds.length > 0 ? (
                  <span className="ml-2 text-vk-red">({invalidIds.length} vigast väärtust)</span>
                ) : null}
              </span>
              <div className="flex items-center gap-2">
                <Button onClick={revertAll} variant="ghost" size="sm" disabled={busy !== null}>
                  <Undo2 className="h-4 w-4" />
                  Tagasta
                </Button>
                <Button
                  onClick={saveAll}
                  disabled={busy !== null || invalidIds.length > 0 || pendingIds.length === 0}
                  variant="primary"
                  size="sm"
                >
                  {busy === "save" ? <Loader2 className="h-4 w-4 animate-spin" /> : <Save className="h-4 w-4" />}
                  Salvesta muudatused ({pendingIds.length})
                </Button>
              </div>
            </div>
          ) : null}
          {selected.size > 0 ? (
            <div className="flex flex-wrap items-center gap-3 rounded-md border bg-vk-blue/5 px-4 py-2.5 text-sm shadow-sm">
              <span className="font-medium">
                <span className="font-mono text-vk-blue">{selected.size}</span> rida valitud
              </span>
              <div className="flex flex-wrap items-center gap-2">
                <Input
                  value={bulkAeg}
                  onChange={(e) => setBulkAeg(e.target.value)}
                  placeholder="Paigaldusaeg (nt 0,5)"
                  className="h-8 w-32 text-sm"
                  type="text"
                  inputMode="decimal"
                />
                <Button
                  onClick={bulkApplyToSelected}
                  disabled={busy !== null}
                  variant="outline"
                  size="sm"
                  title="Täidab valitud ridade paigaldusaeg-väljad sisestatud väärtusega (ei salvesta veel)"
                >
                  Täida valitud ridadele
                </Button>
                <span className="ml-1 h-5 border-l border-input" />
                <select
                  value={bulkGrupId}
                  onChange={(e) => setBulkGrupId(e.target.value)}
                  className="flex h-8 rounded-md border border-input bg-background px-2 text-xs"
                >
                  <option value="" disabled>
                    Vali teenus…
                  </option>
                  <option value="__none__">— Eemalda teenuse-seos —</option>
                  {grupid.map((g) => (
                    <option key={g.id} value={g.id}>
                      {g.nimi}
                    </option>
                  ))}
                </select>
                <Button
                  onClick={bulkSeoGrupiga}
                  disabled={busy !== null || !bulkGrupId}
                  variant="primary"
                  size="sm"
                >
                  {busy === "grup" ? <Loader2 className="h-4 w-4 animate-spin" /> : <FolderPlus className="h-4 w-4" />}
                  Lisa teenusele
                </Button>
                <span className="ml-1 h-5 border-l border-input" />
                <Button onClick={bulkIgnore} disabled={busy !== null} variant="ghost" size="sm" title="Märgi ignoreerituks (peidetakse, kuid DB-st ei kustuta)">
                  {busy === "ignore" ? <Loader2 className="h-4 w-4 animate-spin" /> : <X className="h-4 w-4" />}
                  Ignoreeri
                </Button>
                {confirmingBulkDelete ? (
                  <>
                    <span className="flex items-center gap-1 rounded-md bg-vk-red/10 px-2 py-1 text-[10px] text-vk-red">
                      <AlertTriangle className="h-3 w-3" />
                      Kustutab {selected.size} toodet DB-st (pakkumised säilivad)
                    </span>
                    <Button onClick={bulkDelete} disabled={busy !== null} variant="destructive" size="sm">
                      {busy === "delete" ? <Loader2 className="h-4 w-4 animate-spin" /> : <Trash2 className="h-4 w-4" />}
                      Kinnita
                    </Button>
                    <Button onClick={() => setConfirmingBulkDelete(false)} variant="ghost" size="sm">
                      Tühista
                    </Button>
                  </>
                ) : (
                  <Button
                    onClick={() => setConfirmingBulkDelete(true)}
                    disabled={busy !== null}
                    variant="ghost"
                    size="sm"
                    className="text-muted-foreground hover:text-vk-red"
                  >
                    <Trash2 className="h-4 w-4" />
                    Kustuta
                  </Button>
                )}
                <Button onClick={() => setSelected(new Set())} variant="ghost" size="sm">
                  Tühista valik
                </Button>
              </div>
            </div>
          ) : null}
        </div>
      ) : null}

      {msg ? (
        <div
          className={`rounded-md px-3 py-2 text-sm ${
            msg.kind === "ok" ? "bg-vk-blue/10 text-vk-blue" : "bg-vk-red/10 text-vk-red"
          }`}
        >
          {msg.text}
        </div>
      ) : null}

      <div className="rounded-lg border bg-card">
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead className="w-[40px]">
                <input
                  type="checkbox"
                  checked={allSelected}
                  ref={(el) => {
                    if (el) el.indeterminate = someSelected;
                  }}
                  onChange={(e) => toggleAll(e.target.checked)}
                  aria-label="Vali kõik"
                  className="h-4 w-4 cursor-pointer"
                />
              </TableHead>
              <TableHead className="w-[120px]">Tarnija</TableHead>
              <TableHead className="w-[110px]">Kood</TableHead>
              <TableHead>Nimetus</TableHead>
              <TableHead className="w-[120px]">Teenus</TableHead>
              <TableHead className="w-[100px]">Brand</TableHead>
              <TableHead className="w-[60px]">Ühik</TableHead>
              <TableHead className="w-[100px] text-right">Ostuhind</TableHead>
              <TableHead className="w-[130px]">Paigaldusaeg (h)</TableHead>
              <TableHead className="w-[100px]">Hinnakiri</TableHead>
              <TableHead className="w-[50px]" />
            </TableRow>
          </TableHeader>
          <TableBody>
            {read.length === 0 ? (
              <TableRow>
                <TableCell colSpan={11} className="py-10 text-center text-muted-foreground">
                  Ühtegi toodet ei leitud.
                </TableCell>
              </TableRow>
            ) : (
              read.map((r) => {
                const inp = inputValues[r.id] ?? "";
                const orig = aegToString(origValues[r.id]);
                const isDirty = inp !== orig;
                const isInvalid = isDirty && !parseAeg(inp).ok;
                const isPending = isDirty && !isInvalid;
                return (
                  <TableRow key={r.id} data-selected={selected.has(r.id) || undefined}>
                    <TableCell>
                      <input
                        type="checkbox"
                        checked={selected.has(r.id)}
                        onChange={(e) => toggleOne(r.id, e.target.checked)}
                        aria-label={`Vali rida ${r.id}`}
                        className="h-4 w-4 cursor-pointer"
                      />
                    </TableCell>
                    <TableCell className="font-medium text-sm">
                      {r.hinnakirjad?.tarnija ?? "—"}
                    </TableCell>
                    <TableCell className="font-mono text-xs">{r.tarnija_kood ?? "—"}</TableCell>
                    <TableCell>
                      <Link href={`/kataloog/${r.id}`} className="hover:underline">
                        {r.tarnija_nimetus}
                      </Link>
                      {r.sektsioon ? (
                        <div className="text-[10px] uppercase tracking-wide text-muted-foreground">
                          {r.sektsioon}
                        </div>
                      ) : null}
                      {r.magnus_märkused ? (
                        <div className="text-xs italic text-muted-foreground">✎ {r.magnus_märkused}</div>
                      ) : null}
                    </TableCell>
                    <TableCell className="text-xs">{r.tarnija_brand ?? "—"}</TableCell>
                    <TableCell className="text-xs">{r.ühik ?? "—"}</TableCell>
                    <TableCell className="text-right font-mono text-xs">{formatEur(r.ostuhind_neto)}</TableCell>
                    <TableCell>
                      <Input
                        value={inp}
                        onChange={(e: ChangeEvent<HTMLInputElement>) => setInput(r.id, e.target.value)}
                        placeholder="—"
                        type="text"
                        inputMode="decimal"
                        className={`h-8 w-24 text-right font-mono text-xs ${
                          isInvalid
                            ? "border-vk-red bg-vk-red/5"
                            : isPending
                              ? "border-amber-400 bg-amber-50"
                              : ""
                        }`}
                      />
                    </TableCell>
                    <TableCell className="text-xs text-muted-foreground">
                      <Link
                        href={`/hinnakirjad/${r.hinnakiri_id}`}
                        className="flex items-center gap-1 hover:underline"
                      >
                        <FileText className="h-3 w-3" />
                        {r.hinnakirjad ? formatDate(r.hinnakirjad.laetud_kuupäev) : "—"}
                      </Link>
                    </TableCell>
                    <TableCell>
                      {confirmingRowDelete === r.id ? (
                        <div className="flex items-center gap-1">
                          <Button
                            type="button"
                            onClick={() => rowDelete(r.id)}
                            disabled={busy !== null}
                            variant="destructive"
                            size="sm"
                            className="h-7 px-2"
                          >
                            {busy === "delete-row" ? (
                              <Loader2 className="h-3 w-3 animate-spin" />
                            ) : (
                              <Trash2 className="h-3 w-3" />
                            )}
                          </Button>
                          <Button
                            type="button"
                            onClick={() => setConfirmingRowDelete(null)}
                            variant="ghost"
                            size="sm"
                            className="h-7 px-1.5"
                          >
                            <X className="h-3 w-3" />
                          </Button>
                        </div>
                      ) : (
                        <Button
                          type="button"
                          onClick={() => setConfirmingRowDelete(r.id)}
                          variant="ghost"
                          size="sm"
                          className="h-7 w-7 p-0 text-muted-foreground hover:text-vk-red"
                          title="Kustuta toode"
                        >
                          <Trash2 className="h-3 w-3" />
                        </Button>
                      )}
                    </TableCell>
                  </TableRow>
                );
              })
            )}
          </TableBody>
        </Table>
      </div>
    </div>
  );
}
