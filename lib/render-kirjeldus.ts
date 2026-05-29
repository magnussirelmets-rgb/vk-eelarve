// Renderdab tootegrupi template_kirjelduse, asendades placeholder'id
// (nt {kw}, {mudel}, {maht}) konkreetse rea mudel_andmed JSONB-st.
//
// Eeldab et mudel_andmed võtmete väärtused on string või number.
// Numbrid formaaditakse eesti stiilis (koma decimal).
//
// Fallback hierarhia ühe rea jaoks (esimene mitte-tühi võidab):
//   1. row.kirjeldus (käsitsi sisestatud per-rea kirjeldus — kõige spetsiifilisem)
//   2. renderTemplate(grupp.template_kirjeldus, row.mudel_andmed) (asendatud template)
//   3. grupp.kirjeldus (üldine grupi kirjeldus)
//   4. null (UI näitab "—")

type Mudelandmed = Record<string, string | number | null> | null | undefined;

const PLACEHOLDER_RE = /\{([a-zA-Z_][a-zA-Z0-9_]*)\}/g;

/**
 * Asenda template'is placeholder'id ({key}) mudel_andmed väärtustega.
 * Tundmatu placeholder jääb alles muutmata (visualne hint, et väärtus puudub).
 *
 * formatNumber: kui väärtus on number, kuidas seda kuvada.
 *   - "et": eesti stiil — 10.2 → "10,2", 200 → "200"
 *   - "raw": originaal JSON väärtus stringina
 */
export function renderTemplate(
  template: string | null | undefined,
  andmed: Mudelandmed,
  formatNumber: "et" | "raw" = "et",
): string | null {
  if (!template) return null;
  if (!andmed) return template;
  return template.replace(PLACEHOLDER_RE, (match, key: string) => {
    const v = andmed[key];
    if (v === null || v === undefined) return match;
    if (typeof v === "number") {
      if (formatNumber === "et") {
        return v.toString().replace(".", ",");
      }
      return String(v);
    }
    return String(v);
  });
}

/**
 * Lõplik kirjeldus ühe pakkumise rea jaoks.
 *
 * Sisendid (laisad, töötab partial andmetega):
 *   - rowKirjeldus — hinnakirja_read.kirjeldus VÕI positsioonid.kirjeldus
 *                    (kasutaja manuaalne)
 *   - templateKirjeldus — tootegrupp.template_kirjeldus
 *   - mudelAndmed — hinnakirja_read.mudel_andmed
 *   - grupiKirjeldus — tootegrupp.kirjeldus (üldine viimane fallback)
 */
export function renderKirjeldus(args: {
  rowKirjeldus?: string | null;
  templateKirjeldus?: string | null;
  mudelAndmed?: Mudelandmed;
  grupiKirjeldus?: string | null;
}): string | null {
  if (args.rowKirjeldus && args.rowKirjeldus.trim()) return args.rowKirjeldus;
  const rendered = renderTemplate(args.templateKirjeldus, args.mudelAndmed);
  if (rendered && rendered.trim()) return rendered;
  if (args.grupiKirjeldus && args.grupiKirjeldus.trim()) return args.grupiKirjeldus;
  return null;
}

/**
 * Pakkumise PDF trükivormi versioon — eelistab pakkumise_kirjeldus
 * (pikem, formaalne) tavaline template_kirjelduse asemel.
 *
 * Sama fallback ahel:
 *   1. rowKirjeldus (manuaalne per-rida)
 *   2. renderTemplate(pakkumise_kirjeldus, mudel_andmed) — pikem versioon
 *   3. renderTemplate(template_kirjeldus, mudel_andmed) — lühike
 *   4. grupp.kirjeldus
 */
export function renderPakkumiseKirjeldus(args: {
  rowKirjeldus?: string | null;
  pakkumiseKirjeldus?: string | null;
  templateKirjeldus?: string | null;
  mudelAndmed?: Mudelandmed;
  grupiKirjeldus?: string | null;
}): string | null {
  if (args.rowKirjeldus && args.rowKirjeldus.trim()) return args.rowKirjeldus;
  const pikk = renderTemplate(args.pakkumiseKirjeldus, args.mudelAndmed);
  if (pikk && pikk.trim()) return pikk;
  const luhike = renderTemplate(args.templateKirjeldus, args.mudelAndmed);
  if (luhike && luhike.trim()) return luhike;
  if (args.grupiKirjeldus && args.grupiKirjeldus.trim()) return args.grupiKirjeldus;
  return null;
}
