"use client";

import { useEffect, useMemo, useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Loader2, Upload, Check } from "lucide-react";
import { looPakkumine } from "../actions";
import {
  PAKKUMISE_MALLID,
  PAKKUMISE_MALL_DEFAULT,
  PAKKUMISE_MALL_BY_ID,
  type PakkumiseMallId,
  type MallVali,
  type SkaalateguriVäli,
} from "@/lib/pakkumise-mallid";

const SKAALA_LABELS: Record<SkaalateguriVäli, { label: string; placeholder: string; mode?: string }> = {
  püstikute_arv: { label: "Püstikute arv", placeholder: "nt 4" },
  korterite_arv: { label: "Korterite arv", placeholder: "nt 32" },
  radiaatorite_arv: { label: "Radiaatorite arv", placeholder: "nt 64" },
  keldrimagistraalide_jm: { label: "Keldrimagistraalid (jm)", placeholder: "nt 120,5", mode: "decimal" },
  väljavõtete_arv: { label: "Väljavõtete arv", placeholder: "nt 24" },
};

type MallValueState = Record<string, string | boolean>;

function vastabTingimusele(
  v: MallVali,
  state: MallValueState,
): boolean {
  if (!v.kuvaKui) return true;
  const cur = state[v.kuvaKui.key];
  const expected = v.kuvaKui.väärtus;
  if (Array.isArray(expected)) return expected.includes(cur as string | boolean);
  return cur === expected;
}

function vaikeväärtused(väljad: MallVali[]): MallValueState {
  const state: MallValueState = {};
  for (const v of väljad) {
    if (v.tüüp === "radio" && v.vaikimisi !== undefined) {
      state[v.key] = v.vaikimisi;
    } else if (v.tüüp === "checkbox") {
      state[v.key] = false;
    }
  }
  return state;
}

export function UusPakkumineForm() {
  const router = useRouter();
  const [pending, startTransition] = useTransition();
  const [err, setErr] = useState<string | null>(null);
  const [fileName, setFileName] = useState("");
  const [mall, setMall] = useState<PakkumiseMallId>(PAKKUMISE_MALL_DEFAULT);
  const [mallVals, setMallVals] = useState<MallValueState>(() =>
    vaikeväärtused(PAKKUMISE_MALL_BY_ID[PAKKUMISE_MALL_DEFAULT].mallVäljad),
  );

  const mallConf = useMemo(() => PAKKUMISE_MALL_BY_ID[mall], [mall]);

  // Malli vahetus → vaikeväärtused
  useEffect(() => {
    setMallVals(vaikeväärtused(mallConf.mallVäljad));
  }, [mallConf]);

  // Nähtavad väljad (deduplicated key-de järgi: kui sama key on dubleeritud erinevate
  // tingimustega, näita ainult esimest mis tingimuse rahuldab)
  const nähtavadVäljad = useMemo(() => {
    const seen = new Set<string>();
    const out: MallVali[] = [];
    for (const v of mallConf.mallVäljad) {
      if (!vastabTingimusele(v, mallVals)) continue;
      if (seen.has(v.key)) continue;
      seen.add(v.key);
      out.push(v);
    }
    return out;
  }, [mallConf, mallVals]);

  function setVal(key: string, väärtus: string | boolean) {
    setMallVals((s) => ({ ...s, [key]: väärtus }));
  }

  async function onSubmit(formData: FormData) {
    setErr(null);
    formData.set("mall", mall);
    // Kogu mall_andmed JSON-string'iks (server parsib selle ja salvestab JSONB-veergu)
    const mallAndmed: Record<string, unknown> = {};
    for (const v of mallConf.mallVäljad) {
      if (!vastabTingimusele(v, mallVals)) continue;
      const cur = mallVals[v.key];
      if (v.tüüp === "checkbox") {
        if (cur) mallAndmed[v.key] = true;
      } else if (v.tüüp === "radio") {
        if (cur !== undefined && cur !== "") mallAndmed[v.key] = cur;
      } else if (v.tüüp === "number") {
        if (cur !== undefined && cur !== "") {
          const n = Number(String(cur));
          if (Number.isFinite(n)) mallAndmed[v.key] = n;
        }
      } else if (v.tüüp === "decimal") {
        if (cur !== undefined && cur !== "") {
          const n = Number(String(cur).replace(",", "."));
          if (Number.isFinite(n)) mallAndmed[v.key] = n;
        }
      }
    }
    formData.set("mall_andmed", JSON.stringify(mallAndmed));

    startTransition(async () => {
      const r = await looPakkumine(formData);
      if (r.ok) router.push(`/pakkumised/${r.id}`);
      else setErr(r.error);
    });
  }

  return (
    <form action={onSubmit} className="space-y-6">
      {/* MALL — kaartide valik */}
      <div className="space-y-3">
        <h3 className="text-sm font-semibold uppercase tracking-wide text-muted-foreground">
          Pakkumise tüüp <span className="text-vk-red">*</span>
        </h3>
        <div className="grid gap-2 sm:grid-cols-2">
          {PAKKUMISE_MALLID.map((m) => {
            const valitud = mall === m.id;
            return (
              <button
                key={m.id}
                type="button"
                onClick={() => setMall(m.id)}
                className={
                  "group relative flex flex-col gap-1 rounded-lg border p-3 text-left transition-colors " +
                  (valitud
                    ? "border-vk-blue bg-vk-blue/5 ring-2 ring-vk-blue/20"
                    : "border-input hover:border-vk-blue/50 hover:bg-vk-blue/5")
                }
                aria-pressed={valitud}
              >
                <div className="flex items-start justify-between gap-2">
                  <div className="text-sm font-semibold text-vk-navy">{m.nimi}</div>
                  {valitud ? <Check className="h-4 w-4 shrink-0 text-vk-blue" aria-hidden /> : null}
                </div>
                <div className="text-xs text-muted-foreground">{m.kirjeldus}</div>
                {m.soovituslikudEriosad.length > 0 ? (
                  <div className="mt-1 flex flex-wrap gap-1">
                    {m.soovituslikudEriosad.map((e) => (
                      <span
                        key={e.kood}
                        className="rounded bg-muted px-1.5 py-0.5 font-mono text-[10px] text-muted-foreground"
                      >
                        {e.kood} {e.nimi}
                      </span>
                    ))}
                  </div>
                ) : null}
              </button>
            );
          })}
        </div>
      </div>

      {/* Tellija ja objekt */}
      <div className="space-y-3">
        <h3 className="text-sm font-semibold uppercase tracking-wide text-muted-foreground">
          Tellija ja objekt
        </h3>
        <div className="grid gap-4 sm:grid-cols-2">
          <div className="space-y-1 sm:col-span-2">
            <Label htmlFor="objekt">
              Objekt <span className="text-vk-red">*</span>
            </Label>
            <Input id="objekt" name="objekt" placeholder="nt Tamsalu Ääsi 2 KVVK rekonstr." required />
          </div>
          <div className="space-y-1">
            <Label htmlFor="projekti_nr">Projekti nr</Label>
            <Input id="projekti_nr" name="projekti_nr" placeholder="nt 22028" />
          </div>
          <div className="space-y-1">
            <Label htmlFor="tellija_nimi">Tellija nimi</Label>
            <Input id="tellija_nimi" name="tellija_nimi" placeholder="nt Eesti Ehitus OÜ või Jaan Tamm" />
          </div>
          <div className="space-y-1">
            <Label htmlFor="tellija_telefon">Tellija telefon</Label>
            <Input
              id="tellija_telefon"
              name="tellija_telefon"
              type="tel"
              placeholder="nt +372 5xxx xxxx"
            />
          </div>
          <div className="space-y-1">
            <Label htmlFor="tellija_email">Tellija e-post</Label>
            <Input
              id="tellija_email"
              name="tellija_email"
              type="email"
              placeholder="nt info@example.ee"
            />
          </div>
        </div>
      </div>

      {/* Skaalategurid (scalar veerud — kasutusel kortermaja malli auto-arvutuses) */}
      {mallConf.näitaSkaalategureid.length > 0 ? (
        <div className="space-y-3">
          <h3 className="text-sm font-semibold uppercase tracking-wide text-muted-foreground">
            {mallConf.lühi} skaalategurid (valikuline)
          </h3>
          <p className="text-xs text-muted-foreground">
            Need numbrid mõjutavad kinnituselementide ja korterite väljavõtete auto-arvutust. Saad
            need lisada/muuta ka hiljem pakkumise detail-lehel.
          </p>
          <div className="grid gap-4 sm:grid-cols-3">
            {mallConf.näitaSkaalategureid.map((väli) => {
              const l = SKAALA_LABELS[väli];
              return (
                <div key={väli} className="space-y-1">
                  <Label htmlFor={väli}>{l.label}</Label>
                  <Input
                    id={väli}
                    name={väli}
                    type={l.mode === "decimal" ? "text" : "number"}
                    inputMode={l.mode === "decimal" ? "decimal" : undefined}
                    min={l.mode === "decimal" ? undefined : "0"}
                    placeholder={l.placeholder}
                  />
                </div>
              );
            })}
          </div>
        </div>
      ) : null}

      {/* Mall-spetsiifilised väljad (JSONB) */}
      {nähtavadVäljad.length > 0 ? (
        <div className="space-y-3">
          <h3 className="text-sm font-semibold uppercase tracking-wide text-muted-foreground">
            {mallConf.lühi} parameetrid
          </h3>
          <div className="grid gap-4 sm:grid-cols-2">
            {nähtavadVäljad.map((v) => (
              <MallVäliInput
                key={`${v.key}-${"options" in v ? "r" : v.tüüp}`}
                v={v}
                value={mallVals[v.key]}
                onChange={(val) => setVal(v.key, val)}
              />
            ))}
          </div>
        </div>
      ) : null}

      {/* Mahutabel */}
      {mallConf.toetabMahutabelit ? (
        <div className="space-y-3">
          <h3 className="text-sm font-semibold uppercase tracking-wide text-muted-foreground">
            Mahutabel (valikuline — saad hiljem üles laadida)
          </h3>
          <div className="space-y-1">
            <Label htmlFor="mahutabel">Mahutabeli PDF</Label>
            <Input
              id="mahutabel"
              name="mahutabel"
              type="file"
              accept=".pdf"
              onChange={(e) => setFileName(e.target.files?.[0]?.name ?? "")}
              className="cursor-pointer"
            />
            <p className="text-xs text-muted-foreground">
              PDF, max 20 MB.{" "}
              {fileName ? <span className="font-medium">Valitud: {fileName}</span> : null}
            </p>
          </div>
        </div>
      ) : null}

      {/* Märkused */}
      <div className="space-y-1">
        <Label htmlFor="märkused">Märkused (valikuline)</Label>
        <Textarea id="märkused" name="märkused" rows={2} placeholder="Sisedokumentides nähtav märkus" />
      </div>

      {err ? <div className="rounded-md bg-vk-red/10 px-3 py-2 text-sm text-vk-red">{err}</div> : null}

      <div className="flex items-center gap-2">
        <Button type="submit" disabled={pending} variant="primary">
          {pending ? <Loader2 className="h-4 w-4 animate-spin" /> : <Upload className="h-4 w-4" />}
          Loo pakkumine
        </Button>
        <span className="text-xs text-muted-foreground">
          VKP-nr genereeritakse automaatselt järjekorra järgi
        </span>
      </div>
    </form>
  );
}

function MallVäliInput({
  v,
  value,
  onChange,
}: {
  v: MallVali;
  value: string | boolean | undefined;
  onChange: (val: string | boolean) => void;
}) {
  if (v.tüüp === "radio") {
    return (
      <div className="space-y-1 sm:col-span-2">
        <Label>{v.label}</Label>
        <div className="flex flex-wrap gap-2">
          {v.options.map((o) => {
            const valitud = value === o.value;
            return (
              <button
                key={o.value}
                type="button"
                onClick={() => onChange(o.value)}
                className={
                  "rounded-md border px-3 py-1.5 text-xs transition-colors " +
                  (valitud
                    ? "border-vk-blue bg-vk-blue/10 text-vk-navy"
                    : "border-input hover:border-vk-blue/50 hover:bg-vk-blue/5")
                }
              >
                {o.label}
              </button>
            );
          })}
        </div>
      </div>
    );
  }
  if (v.tüüp === "checkbox") {
    return (
      <div className="flex items-center gap-2 sm:col-span-2">
        <input
          id={v.key}
          type="checkbox"
          checked={!!value}
          onChange={(e) => onChange(e.target.checked)}
          className="h-4 w-4 cursor-pointer accent-vk-blue"
        />
        <Label htmlFor={v.key} className="cursor-pointer">
          {v.label}
        </Label>
      </div>
    );
  }
  // number / decimal
  return (
    <div className="space-y-1">
      <Label htmlFor={v.key}>
        {v.label}
        {"unit" in v && v.unit ? (
          <span className="ml-1 text-muted-foreground">({v.unit})</span>
        ) : null}
      </Label>
      <Input
        id={v.key}
        type={v.tüüp === "decimal" ? "text" : "number"}
        inputMode={v.tüüp === "decimal" ? "decimal" : undefined}
        min={v.tüüp === "number" ? "0" : undefined}
        placeholder={v.placeholder}
        value={typeof value === "boolean" ? "" : (value ?? "")}
        onChange={(e) => onChange(e.target.value)}
      />
    </div>
  );
}
