"use client";

import { useState, useMemo, useEffect } from "react";
import Link from "next/link";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { ChevronDown, Check, Plus, X, ExternalLink, Building2, Home } from "lucide-react";
import type { Klient, Objekt } from "@/lib/types";
import { KLIENDI_TÜÜP_LABEL } from "@/lib/types";

type Props = {
  kliendid: Klient[];
  objektid: Objekt[];
  // Form'i välimised hidden input'id (tellija_nimi/email/telefon, objekt, projekti_nr)
  // täidetakse selle komponendi seest, et server action saaks snapshoti.
};

export function KlientObjektPicker({ kliendid, objektid }: Props) {
  const [klientId, setKlientId] = useState<string | null>(null);
  const [objektId, setObjektId] = useState<string | null>(null);
  const [klientFilter, setKlientFilter] = useState("");
  const [objektFilter, setObjektFilter] = useState("");
  const [klientOpen, setKlientOpen] = useState(false);
  const [objektOpen, setObjektOpen] = useState(false);

  const valitudKlient = klientId ? kliendid.find((k) => k.id === klientId) ?? null : null;
  const valitudObjekt = objektId ? objektid.find((o) => o.id === objektId) ?? null : null;

  const filtreeritudKliendid = useMemo(() => {
    const q = klientFilter.trim().toLowerCase();
    const list = q
      ? kliendid.filter(
          (k) =>
            k.nimi.toLowerCase().includes(q) ||
            (k.email ?? "").toLowerCase().includes(q) ||
            (k.telefon ?? "").includes(q),
        )
      : kliendid;
    return list.slice(0, 50);
  }, [kliendid, klientFilter]);

  const klientObjektid = useMemo(
    () => (klientId ? objektid.filter((o) => o.klient_id === klientId) : []),
    [klientId, objektid],
  );
  const filtreeritudObjektid = useMemo(() => {
    const q = objektFilter.trim().toLowerCase();
    const list = q
      ? klientObjektid.filter(
          (o) =>
            o.nimi.toLowerCase().includes(q) ||
            (o.aadress ?? "").toLowerCase().includes(q) ||
            (o.projekti_nr ?? "").toLowerCase().includes(q),
        )
      : klientObjektid;
    return list.slice(0, 30);
  }, [klientObjektid, objektFilter]);

  // Klient vahetus → tühista objekt
  useEffect(() => {
    if (klientId && valitudObjekt && valitudObjekt.klient_id !== klientId) {
      setObjektId(null);
    }
  }, [klientId, valitudObjekt]);

  return (
    <div className="space-y-3">
      {/* Hidden input'id formData jaoks */}
      <input type="hidden" name="klient_id" value={klientId ?? ""} />
      <input type="hidden" name="objekt_id" value={objektId ?? ""} />
      {/* Snapshot väljad — kasutab valitud kliendi/objekti väärtused; jätab tühjaks
          kui kasutaja pole valinud (siis fallback originaal manuaalsetele input'ile alla) */}
      <input type="hidden" name="tellija_nimi" value={valitudKlient?.nimi ?? ""} />
      <input type="hidden" name="tellija_email" value={valitudKlient?.email ?? ""} />
      <input type="hidden" name="tellija_telefon" value={valitudKlient?.telefon ?? ""} />
      <input type="hidden" name="objekt" value={valitudObjekt?.nimi ?? ""} />
      <input type="hidden" name="projekti_nr" value={valitudObjekt?.projekti_nr ?? ""} />

      {/* KLIENT */}
      <div className="space-y-1">
        <div className="flex items-center justify-between">
          <Label htmlFor="klient-otsing">
            Klient <span className="text-vk-red">*</span>
          </Label>
          <Link
            href="/kliendid/uus"
            target="_blank"
            className="inline-flex items-center gap-1 text-xs text-vk-blue hover:underline"
          >
            <Plus className="h-3 w-3" /> Loo uus klient (uus vahekaart)
          </Link>
        </div>
        {valitudKlient ? (
          <div className="flex items-center justify-between rounded-md border border-vk-blue/40 bg-vk-blue/5 px-3 py-2">
            <div className="flex items-center gap-2 text-sm">
              {valitudKlient.tüüp === "juriidiline" ? (
                <Building2 className="h-3.5 w-3.5 text-vk-blue" />
              ) : (
                <Home className="h-3.5 w-3.5 text-vk-blue" />
              )}
              <span className="font-medium text-vk-navy">{valitudKlient.nimi}</span>
              <Badge variant="secondary" className="text-[10px]">
                {KLIENDI_TÜÜP_LABEL[valitudKlient.tüüp]}
              </Badge>
              {valitudKlient.telefon ? (
                <span className="text-xs text-muted-foreground">· {valitudKlient.telefon}</span>
              ) : null}
            </div>
            <Button
              type="button"
              variant="ghost"
              size="sm"
              onClick={() => {
                setKlientId(null);
                setObjektId(null);
                setKlientFilter("");
              }}
            >
              <X className="h-3 w-3" /> Muuda
            </Button>
          </div>
        ) : (
          <div className="relative">
            <Input
              id="klient-otsing"
              value={klientFilter}
              onChange={(e) => {
                setKlientFilter(e.target.value);
                setKlientOpen(true);
              }}
              onFocus={() => setKlientOpen(true)}
              onBlur={() => setTimeout(() => setKlientOpen(false), 150)}
              placeholder="Otsi kliendi nime, telefon vm…"
              autoComplete="off"
            />
            {klientOpen && filtreeritudKliendid.length > 0 ? (
              <div className="absolute z-20 mt-1 max-h-64 w-full overflow-y-auto rounded-md border bg-card shadow-lg">
                {filtreeritudKliendid.map((k) => (
                  <button
                    key={k.id}
                    type="button"
                    onMouseDown={(e) => e.preventDefault()}
                    onClick={() => {
                      setKlientId(k.id);
                      setKlientFilter("");
                      setKlientOpen(false);
                    }}
                    className="flex w-full items-center justify-between gap-2 px-3 py-2 text-left text-sm hover:bg-vk-blue/10"
                  >
                    <div className="flex min-w-0 items-center gap-2">
                      {k.tüüp === "juriidiline" ? (
                        <Building2 className="h-3.5 w-3.5 shrink-0 text-muted-foreground" />
                      ) : (
                        <Home className="h-3.5 w-3.5 shrink-0 text-muted-foreground" />
                      )}
                      <span className="truncate font-medium">{k.nimi}</span>
                      {k.telefon ? (
                        <span className="shrink-0 text-xs text-muted-foreground">
                          {k.telefon}
                        </span>
                      ) : null}
                    </div>
                  </button>
                ))}
              </div>
            ) : null}
            {klientOpen && filtreeritudKliendid.length === 0 ? (
              <div className="absolute z-20 mt-1 w-full rounded-md border bg-card px-3 py-2 text-sm text-muted-foreground shadow-lg">
                Ei leitud.{" "}
                <Link
                  href="/kliendid/uus"
                  target="_blank"
                  className="text-vk-blue hover:underline"
                >
                  Loo uus klient →
                </Link>
              </div>
            ) : null}
          </div>
        )}
      </div>

      {/* OBJEKT */}
      <div className="space-y-1">
        <div className="flex items-center justify-between">
          <Label htmlFor="objekt-otsing">
            Objekt <span className="text-vk-red">*</span>
          </Label>
          {valitudKlient ? (
            <Link
              href={`/kliendid/${valitudKlient.id}`}
              target="_blank"
              className="inline-flex items-center gap-1 text-xs text-vk-blue hover:underline"
            >
              <ExternalLink className="h-3 w-3" /> Halda kliendi objekte
            </Link>
          ) : null}
        </div>
        {!valitudKlient ? (
          <div className="rounded-md border border-dashed bg-muted/40 px-3 py-2 text-sm text-muted-foreground">
            Vali kõigepealt klient.
          </div>
        ) : valitudObjekt ? (
          <div className="flex items-center justify-between rounded-md border border-vk-blue/40 bg-vk-blue/5 px-3 py-2">
            <div className="text-sm">
              <span className="font-medium text-vk-navy">{valitudObjekt.nimi}</span>
              {valitudObjekt.projekti_nr ? (
                <span className="ml-2 font-mono text-xs text-muted-foreground">
                  · {valitudObjekt.projekti_nr}
                </span>
              ) : null}
            </div>
            <Button
              type="button"
              variant="ghost"
              size="sm"
              onClick={() => {
                setObjektId(null);
                setObjektFilter("");
              }}
            >
              <X className="h-3 w-3" /> Muuda
            </Button>
          </div>
        ) : (
          <div className="relative">
            <Input
              id="objekt-otsing"
              value={objektFilter}
              onChange={(e) => {
                setObjektFilter(e.target.value);
                setObjektOpen(true);
              }}
              onFocus={() => setObjektOpen(true)}
              onBlur={() => setTimeout(() => setObjektOpen(false), 150)}
              placeholder={
                klientObjektid.length === 0
                  ? "Sellel kliendil pole veel objekte — loo uus"
                  : "Otsi objekti…"
              }
              autoComplete="off"
            />
            {objektOpen && filtreeritudObjektid.length > 0 ? (
              <div className="absolute z-20 mt-1 max-h-64 w-full overflow-y-auto rounded-md border bg-card shadow-lg">
                {filtreeritudObjektid.map((o) => (
                  <button
                    key={o.id}
                    type="button"
                    onMouseDown={(e) => e.preventDefault()}
                    onClick={() => {
                      setObjektId(o.id);
                      setObjektFilter("");
                      setObjektOpen(false);
                    }}
                    className="flex w-full items-center justify-between gap-2 px-3 py-2 text-left text-sm hover:bg-vk-blue/10"
                  >
                    <div className="flex min-w-0 flex-col">
                      <span className="truncate font-medium">{o.nimi}</span>
                      {o.aadress || o.projekti_nr ? (
                        <span className="truncate text-xs text-muted-foreground">
                          {o.aadress ?? ""}
                          {o.aadress && o.projekti_nr ? " · " : ""}
                          {o.projekti_nr ?? ""}
                        </span>
                      ) : null}
                    </div>
                  </button>
                ))}
              </div>
            ) : null}
            {objektOpen && filtreeritudObjektid.length === 0 ? (
              <div className="absolute z-20 mt-1 w-full rounded-md border bg-card px-3 py-2 text-sm text-muted-foreground shadow-lg">
                Ei leitud.{" "}
                <Link
                  href={`/kliendid/${valitudKlient.id}`}
                  target="_blank"
                  className="text-vk-blue hover:underline"
                >
                  Lisa objekt kliendi alla →
                </Link>
              </div>
            ) : null}
          </div>
        )}
      </div>

      {!valitudKlient || !valitudObjekt ? (
        <p className="text-[11px] text-muted-foreground">
          Klient ja objekt on vajalikud uue pakkumise jaoks. Kui tellija pole veel süsteemis,{" "}
          <Link href="/kliendid/uus" target="_blank" className="text-vk-blue hover:underline">
            loo klient siit
          </Link>{" "}
          ja seejärel lisa talle objekt.
        </p>
      ) : null}
    </div>
  );
}
