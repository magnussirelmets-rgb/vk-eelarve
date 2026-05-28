"use client";

import { useEffect, useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Loader2, Package, Plus } from "lucide-react";
import { formatEur, formatNum } from "@/lib/utils";
import { loendaKomplektid, lisaKomplektPakkumisse, type KomplektiLisamiseRežiim } from "../actions";

type KomplektInfo = {
  id: string;
  nimi: string;
  ridu: number;
  materjalKokku: number;
  tööH: number;
  ühik: string;
  vaike_sektsioon: string | null;
  vaike_alamsektsioon: string | null;
};

type Props = {
  pakkumineId: string;
  /** Soovituslikud eriosa-koodid (mall_id põhjal) — kuvatakse kiirvalikuna */
  soovituslikudEriosad?: { kood: string; nimi: string }[];
};

export function LisaKomplektDialog({ pakkumineId, soovituslikudEriosad = [] }: Props) {
  const router = useRouter();
  const [open, setOpen] = useState(false);
  const [komplektid, setKomplektid] = useState<KomplektInfo[] | null>(null);
  const [loading, setLoading] = useState(false);
  const [valitudId, setValitudId] = useState<string | null>(null);
  const [sektsioon, setSektsioon] = useState("");
  const [alamsektsioon, setAlamsektsioon] = useState("");
  const [kordaja, setKordaja] = useState("1");
  const [režiim, setRežiim] = useState<KomplektiLisamiseRežiim>("kokku_rida");
  const [err, setErr] = useState<string | null>(null);
  const [pending, startTransition] = useTransition();

  useEffect(() => {
    if (open && komplektid === null) {
      setLoading(true);
      loendaKomplektid()
        .then((list) => setKomplektid(list))
        .catch(() => setKomplektid([]))
        .finally(() => setLoading(false));
    }
  }, [open, komplektid]);

  function reset() {
    setValitudId(null);
    setSektsioon("");
    setAlamsektsioon("");
    setKordaja("1");
    setRežiim("kokku_rida");
    setErr(null);
  }

  function onSubmit() {
    if (!valitudId) {
      setErr("Vali komplekt nimekirjast");
      return;
    }
    if (!sektsioon.trim()) {
      setErr("Eriosa (sektsioon) on kohustuslik");
      return;
    }
    const k = Number(kordaja.replace(",", ".")) || 1;
    setErr(null);
    startTransition(async () => {
      const r = await lisaKomplektPakkumisse({
        pakkumineId,
        komplektId: valitudId,
        sektsioon: sektsioon.trim(),
        alamsektsioon: alamsektsioon.trim() || null,
        koguseKordaja: k,
        režiim,
      });
      if (r.ok) {
        setOpen(false);
        reset();
        router.refresh();
      } else {
        setErr(r.error);
      }
    });
  }

  const valitudKomplekt = komplektid?.find((k) => k.id === valitudId);

  return (
    <Dialog
      open={open}
      onOpenChange={(o) => {
        setOpen(o);
        if (!o) reset();
      }}
    >
      <DialogTrigger asChild>
        <Button variant="outline" size="sm">
          <Package className="h-4 w-4" />
          Lisa komplekt eriosana
        </Button>
      </DialogTrigger>
      <DialogContent className="max-w-2xl">
        <DialogHeader>
          <DialogTitle>Lisa komplekt eriosana</DialogTitle>
          <DialogDescription>
            Vali komplekt — kõik selle read lisanduvad positsioonidena ühe valitud eriosa alla.
            Snapshot väärtustega (ostuhind + paigaldusaeg) säilivad ka kui hinnakiri hiljem muutub.
          </DialogDescription>
        </DialogHeader>

        {/* Komplektide nimekiri */}
        <div className="space-y-2">
          <Label>Komplekt</Label>
          {loading ? (
            <div className="flex items-center gap-2 py-4 text-sm text-muted-foreground">
              <Loader2 className="h-4 w-4 animate-spin" />
              Lae komplektid…
            </div>
          ) : komplektid && komplektid.length > 0 ? (
            <div className="max-h-64 overflow-y-auto rounded-md border">
              {komplektid.map((k) => {
                const valitud = valitudId === k.id;
                return (
                  <button
                    key={k.id}
                    type="button"
                    onClick={() => {
                      setValitudId(k.id);
                      // Prefilli vaike-eriosa kui komplektil on need määratud
                      if (k.vaike_sektsioon && !sektsioon.trim()) {
                        setSektsioon(k.vaike_sektsioon);
                      }
                      if (k.vaike_alamsektsioon && !alamsektsioon.trim()) {
                        setAlamsektsioon(k.vaike_alamsektsioon);
                      }
                    }}
                    className={
                      "flex w-full items-center justify-between border-b px-3 py-2 text-left last:border-b-0 transition-colors " +
                      (valitud
                        ? "bg-vk-blue/10 text-vk-navy"
                        : "hover:bg-muted/50")
                    }
                  >
                    <div className="min-w-0">
                      <div className="text-sm font-semibold text-vk-navy">{k.nimi}</div>
                      <div className="text-xs text-muted-foreground">
                        {k.ridu} rida · materjal {formatEur(k.materjalKokku)}
                        {k.tööH > 0 ? ` · töö ${formatNum(k.tööH)} h` : ""}
                      </div>
                      {k.vaike_sektsioon ? (
                        <div className="mt-0.5 text-[10px] text-vk-blue">
                          → vaike-eriosa: {k.vaike_sektsioon}
                          {k.vaike_alamsektsioon ? ` · ${k.vaike_alamsektsioon}` : ""}
                        </div>
                      ) : null}
                    </div>
                    <span className="rounded bg-muted px-1.5 py-0.5 font-mono text-[10px] text-muted-foreground">
                      {k.ühik}
                    </span>
                  </button>
                );
              })}
            </div>
          ) : (
            <div className="rounded-md border border-dashed px-3 py-4 text-sm text-muted-foreground">
              Komplektid puuduvad. Loo mõni hinnakirja-lehel (vali read → &quot;Tee komplekt&quot;).
            </div>
          )}
        </div>

        {/* Eriosa + kogus */}
        <div className="grid gap-3 sm:grid-cols-2">
          <div className="space-y-1 sm:col-span-2">
            <Label htmlFor="kompl-sektsioon">
              Eriosa (sektsioon) <span className="text-vk-red">*</span>
            </Label>
            <Input
              id="kompl-sektsioon"
              value={sektsioon}
              onChange={(e) => setSektsioon(e.target.value)}
              placeholder="nt 726 Puurkaevude rajamine"
            />
            {soovituslikudEriosad.length > 0 ? (
              <div className="flex flex-wrap gap-1 pt-1">
                {soovituslikudEriosad.map((e) => (
                  <button
                    key={e.kood}
                    type="button"
                    onClick={() => setSektsioon(`${e.kood} ${e.nimi}`)}
                    className="rounded border border-input bg-card px-2 py-0.5 font-mono text-[10px] text-muted-foreground hover:border-vk-blue hover:text-vk-navy"
                  >
                    {e.kood} {e.nimi}
                  </button>
                ))}
              </div>
            ) : null}
          </div>
          <div className="space-y-1">
            <Label htmlFor="kompl-alamsekt">Alamsektsioon (valikuline)</Label>
            <Input
              id="kompl-alamsekt"
              value={alamsektsioon}
              onChange={(e) => setAlamsektsioon(e.target.value)}
              placeholder="nt Puurkaev #1"
            />
          </div>
          <div className="space-y-1">
            <Label htmlFor="kompl-kordaja">Koguse kordaja</Label>
            <Input
              id="kompl-kordaja"
              type="text"
              inputMode="decimal"
              value={kordaja}
              onChange={(e) => setKordaja(e.target.value)}
              placeholder="1"
            />
            <p className="text-[10px] text-muted-foreground">
              Nt 2 puurkaevu = 2.
            </p>
          </div>
        </div>

        {/* Lisamise režiim */}
        <div className="space-y-1.5 rounded-md border border-vk-blue/30 bg-vk-blue/5 p-3">
          <Label className="text-xs">Kuidas lisada pakkumisse?</Label>
          <div className="flex flex-col gap-2 text-xs sm:flex-row">
            <label className="flex flex-1 cursor-pointer items-start gap-2 rounded-md border bg-card p-2 hover:border-vk-blue">
              <input
                type="radio"
                name="režiim"
                value="kokku_rida"
                checked={režiim === "kokku_rida"}
                onChange={() => setRežiim("kokku_rida")}
                className="mt-0.5 accent-vk-blue"
              />
              <div>
                <div className="font-semibold text-vk-navy">Üks koondrida</div>
                <div className="text-muted-foreground">
                  Komplekt lisatakse ühe positsioonina (nimetus = komplekti nimi, hind kokku).
                  Klient näeb ühte rida, mitte iga komponendi eraldi hinda.
                </div>
              </div>
            </label>
            <label className="flex flex-1 cursor-pointer items-start gap-2 rounded-md border bg-card p-2 hover:border-vk-blue">
              <input
                type="radio"
                name="režiim"
                value="eraldi_read"
                checked={režiim === "eraldi_read"}
                onChange={() => setRežiim("eraldi_read")}
                className="mt-0.5 accent-vk-blue"
              />
              <div>
                <div className="font-semibold text-vk-navy">Eraldi read</div>
                <div className="text-muted-foreground">
                  Iga komplekti komponent = eraldi positsioon (puurmasin, kollektor, paigaldus
                  eraldi). Detailne breakdown nähtav.
                </div>
              </div>
            </label>
          </div>
        </div>

        {valitudKomplekt && Number(kordaja.replace(",", ".")) > 0 ? (
          <div className="rounded-md border bg-muted/30 p-2 text-xs">
            <span className="font-semibold">Lisanduvad ridu:</span>{" "}
            {režiim === "kokku_rida" ? "1 (koondrida)" : valitudKomplekt.ridu} ·{" "}
            <span className="font-semibold">Materjal kokku:</span>{" "}
            {formatEur(valitudKomplekt.materjalKokku * (Number(kordaja.replace(",", ".")) || 1))}
            {valitudKomplekt.tööH > 0
              ? ` · Töö: ${formatNum(valitudKomplekt.tööH * (Number(kordaja.replace(",", ".")) || 1))} h`
              : ""}
          </div>
        ) : null}

        {err ? (
          <div className="rounded-md bg-vk-red/10 px-3 py-2 text-sm text-vk-red">{err}</div>
        ) : null}

        <DialogFooter>
          <Button variant="ghost" onClick={() => setOpen(false)} type="button">
            Tühista
          </Button>
          <Button onClick={onSubmit} disabled={pending || !valitudId} variant="primary" type="button">
            {pending ? <Loader2 className="h-4 w-4 animate-spin" /> : <Plus className="h-4 w-4" />}
            Lisa komplekt
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
