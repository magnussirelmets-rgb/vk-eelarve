"use client";

import { useState } from "react";
import { formatEur, formatNum } from "@/lib/utils";

type Alamsekt = {
  sub: string;
  materjal: number;
  töö: number;
  kokku: number;
};

export type EriosaRida = {
  nimetus: string;
  tähis: string | null;
  kirjeldus: string | null;
  kogus: number | null;
  ühik: string | null;
  materjal: number;
  töö: number;
  kokku: number;
};

export type Eriosa = {
  sekt: string;
  sektLabel: string;
  materjal: number;
  töö: number;
  kokku: number;
  alamsektsioonid: Alamsekt[];
  read: EriosaRida[];
};

type Props = {
  eriosad: Eriosa[];
  km_määr: number;
  grandMaterjal: number;
  grandTöö: number;
  grandNeto: number;
  grandKm: number;
  grandBruto: number;
};

const ALAMSEKT_PLACEHOLDER = "(üldine)";

export function EriosaTabel({
  eriosad,
  km_määr,
  grandMaterjal,
  grandTöö,
  grandNeto,
  grandKm,
  grandBruto,
}: Props) {
  const [peidaMaterjal, setPeidaMaterjal] = useState(false);
  const [näitaRidu, setNäitaRidu] = useState(false);

  return (
    <>
      {/* Toggles — ainult ekraanil */}
      <div className="flex flex-wrap gap-2 px-8 pb-1 pt-2 print:hidden">
        <label className="inline-flex cursor-pointer select-none items-center gap-2 rounded-md border border-dashed border-vk-blue/40 bg-vk-blue/5 px-3 py-1.5 text-xs text-vk-navy hover:bg-vk-blue/10">
          <input
            type="checkbox"
            checked={peidaMaterjal}
            onChange={(e) => setPeidaMaterjal(e.target.checked)}
            className="h-3.5 w-3.5 cursor-pointer accent-vk-blue"
          />
          <span>
            Peida materjali ja töö maksumus — kuva ainult eriosa{" "}
            <span className="font-semibold">kogusumma</span>
          </span>
        </label>
        <label className="inline-flex cursor-pointer select-none items-center gap-2 rounded-md border border-dashed border-vk-blue/40 bg-vk-blue/5 px-3 py-1.5 text-xs text-vk-navy hover:bg-vk-blue/10">
          <input
            type="checkbox"
            checked={näitaRidu}
            onChange={(e) => setNäitaRidu(e.target.checked)}
            className="h-3.5 w-3.5 cursor-pointer accent-vk-blue"
          />
          <span>
            Näita eriosa <span className="font-semibold">üksikuid ridu</span> (nimetus, kogus, hind)
          </span>
        </label>
      </div>

      {/* SUMMARY TABEL */}
      <div className="px-8 pb-2 pt-2 print:px-6">
        <div className="mb-2 flex items-center gap-2">
          <span className="h-5 w-1 rounded-sm bg-vk-blue" />
          <h2 className="text-sm font-bold uppercase tracking-wide text-vk-navy">
            Pakkumus eriosade kaupa
          </h2>
        </div>

        <table className="w-full text-sm">
          <thead>
            <tr className="border-b border-vk-navy/20 text-vk-navy">
              <th className="py-2 text-left text-[11px] font-semibold uppercase tracking-wider">
                Eriosa
              </th>
              {!peidaMaterjal ? (
                <>
                  <th className="py-2 text-right text-[11px] font-semibold uppercase tracking-wider">
                    Materjal
                  </th>
                  <th className="py-2 text-right text-[11px] font-semibold uppercase tracking-wider">
                    Töö
                  </th>
                </>
              ) : null}
              <th className="py-2 text-right text-[11px] font-semibold uppercase tracking-wider">
                Kokku
              </th>
            </tr>
          </thead>
          <tbody>
            {eriosad.length === 0 ? (
              <tr>
                <td
                  colSpan={peidaMaterjal ? 2 : 4}
                  className="py-6 text-center text-muted-foreground"
                >
                  Pakkumises pole ühtegi positsiooni.
                </td>
              </tr>
            ) : (
              eriosad.flatMap((v) => {
                const rows: React.ReactNode[] = [];
                // pdf-keep-with-next: sekt header ei jää lehe lõppu ilma järgneva reata
                rows.push(
                  <tr
                    key={`sekt-${v.sekt}`}
                    className="border-b border-vk-navy/10 pdf-keep-with-next"
                  >
                    <td className="py-2.5 align-middle">
                      {v.sektLabel ? (
                        <div className="flex items-stretch gap-2.5">
                          <span className="-my-2.5 w-1 shrink-0 bg-vk-blue" />
                          <span className="font-semibold text-vk-navy">{v.sektLabel}</span>
                        </div>
                      ) : (
                        <span className="text-vk-navy italic text-xs text-muted-foreground">
                          Muud positsioonid
                        </span>
                      )}
                    </td>
                    {!peidaMaterjal ? (
                      <>
                        <td className="py-2.5 text-right font-mono text-vk-navy">
                          {formatEur(v.materjal)}
                        </td>
                        <td className="py-2.5 text-right font-mono text-vk-navy">
                          {formatEur(v.töö)}
                        </td>
                      </>
                    ) : null}
                    <td className="py-2.5 text-right font-mono font-semibold text-vk-navy">
                      {formatEur(v.kokku)}
                    </td>
                  </tr>,
                );

                // Üksikud read (kui linnuke "Näita eriosa ridu" sees)
                if (näitaRidu && v.read.length > 0) {
                  for (let i = 0; i < v.read.length; i++) {
                    const r = v.read[i];
                    rows.push(
                      <tr
                        key={`sekt-${v.sekt}-rida-${i}`}
                        className="border-b border-dotted bg-muted/10 pdf-no-break"
                      >
                        <td className="py-1.5 pl-6 text-xs">
                          <div className="text-vk-navy">
                            {r.nimetus}
                            {r.tähis ? (
                              <span className="ml-1 font-mono text-[10px] text-muted-foreground">
                                ({r.tähis})
                              </span>
                            ) : null}
                          </div>
                          {r.kirjeldus ? (
                            <div className="mt-0.5 text-[10px] italic text-muted-foreground">
                              {r.kirjeldus}
                            </div>
                          ) : null}
                          <div className="mt-0.5 text-[10px] text-muted-foreground">
                            {formatNum(r.kogus)} {r.ühik ?? ""}
                          </div>
                        </td>
                        {!peidaMaterjal ? (
                          <>
                            <td className="py-1.5 text-right font-mono text-xs text-muted-foreground">
                              {formatEur(r.materjal)}
                            </td>
                            <td className="py-1.5 text-right font-mono text-xs text-muted-foreground">
                              {formatEur(r.töö)}
                            </td>
                          </>
                        ) : null}
                        <td className="py-1.5 text-right font-mono text-xs text-vk-navy">
                          {formatEur(r.kokku)}
                        </td>
                      </tr>,
                    );
                  }
                } else if (v.alamsektsioonid.length > 1 && !peidaMaterjal) {
                  // Fallback: kui ridade kuvamine pole valitud, näita alamsektsioonide kokkuvõtteid
                  for (const s of v.alamsektsioonid) {
                    rows.push(
                      <tr key={`sekt-${v.sekt}-sub-${s.sub}`} className="border-b border-dotted">
                        <td className="py-1 pl-8 text-xs text-muted-foreground">
                          {s.sub === ALAMSEKT_PLACEHOLDER ? (
                            <span className="italic">üldine</span>
                          ) : (
                            <>↳ {s.sub}</>
                          )}
                        </td>
                        <td className="py-1 text-right font-mono text-xs text-muted-foreground">
                          {formatEur(s.materjal)}
                        </td>
                        <td className="py-1 text-right font-mono text-xs text-muted-foreground">
                          {formatEur(s.töö)}
                        </td>
                        <td className="py-1 text-right font-mono text-xs text-muted-foreground">
                          {formatEur(s.kokku)}
                        </td>
                      </tr>,
                    );
                  }
                }
                return rows;
              })
            )}
          </tbody>
        </table>
      </div>

      {/* KOGUSUMMA — pdf-no-break, et neto+KM+kokku-blokk püsiks tervena */}
      <div className="mx-8 mb-6 mt-3 print:mx-6 print:mb-4 pdf-no-break">
        <table className="w-full text-sm">
          <tbody>
            <tr className="border-t-2 border-vk-navy">
              <td className="py-2.5 text-vk-navy">
                <span className="font-semibold">Kogusumma</span>{" "}
                <span className="text-xs text-muted-foreground">(neto)</span>
              </td>
              {!peidaMaterjal ? (
                <>
                  <td className="py-2.5 text-right font-mono text-vk-navy">
                    {formatEur(grandMaterjal)}{" "}
                    <span className="text-xs text-muted-foreground">mat.</span>
                  </td>
                  <td className="py-2.5 text-right font-mono text-vk-navy">
                    {formatEur(grandTöö)}{" "}
                    <span className="text-xs text-muted-foreground">töö</span>
                  </td>
                </>
              ) : null}
              <td className="py-2.5 text-right font-mono font-bold text-vk-navy">
                {formatEur(grandNeto)}
              </td>
            </tr>
            <tr className="border-t border-vk-navy/10">
              <td
                colSpan={peidaMaterjal ? 1 : 3}
                className="py-1.5 text-right text-sm text-muted-foreground"
              >
                Käibemaks {(km_määr * 100).toFixed(0)}%
              </td>
              <td className="py-1.5 text-right font-mono text-sm text-muted-foreground">
                {formatEur(grandKm)}
              </td>
            </tr>
          </tbody>
        </table>

        {/* BIG TOTAL */}
        <div className="mt-3 flex items-center justify-between rounded-md bg-vk-navy px-5 py-4 text-white print:rounded-none">
          <div>
            <div className="text-[10px] font-medium uppercase tracking-[0.2em] text-white/70">
              Pakkumus kokku
            </div>
            <div className="text-[10px] text-white/60">koos käibemaksuga</div>
          </div>
          <div className="font-mono text-2xl font-bold leading-none">{formatEur(grandBruto)}</div>
        </div>
      </div>
    </>
  );
}
