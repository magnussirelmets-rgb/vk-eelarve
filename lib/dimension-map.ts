/**
 * KVVK toodete mõõdu-ekvivalendid: DN (Diameter Nominal, mm) ↔ tollid.
 * Standardsed ISO/EN väärtused — vask, teras, plastik kõik kasutavad sama vahetust.
 *
 * Kasutamine:
 * - `dimensionAliases("DN32")` → ["DN32", "1 1/4\"", "1 1/4", "1-1/4\"", "1.25\"", "1¼"]
 * - `normalizeDimension("1 1/4")` → "DN32"
 * - `expandSearchQuery("Kuulventiil DN32")` → ["Kuulventiil DN32", "Kuulventiil", "DN32", "1 1/4\"", ...]
 */

export const DN_TO_INCH: Record<string, readonly string[]> = {
  DN8: ['1/4"', "1/4", '0.25"'],
  DN10: ['3/8"', "3/8", '0.375"'],
  DN15: ['1/2"', "1/2", '0.5"'],
  DN20: ['3/4"', "3/4", '0.75"'],
  DN25: ['1"', "1", '1.0"'],
  DN32: ['1 1/4"', "1 1/4", '1-1/4"', '1.25"', "1¼\"", "1¼"],
  DN40: ['1 1/2"', "1 1/2", '1-1/2"', '1.5"', "1½\"", "1½"],
  DN50: ['2"', "2", '2.0"'],
  DN65: ['2 1/2"', "2 1/2", '2-1/2"', '2.5"', "2½\"", "2½"],
  DN80: ['3"', "3", '3.0"'],
  DN100: ['4"', "4", '4.0"'],
  DN125: ['5"', "5", '5.0"'],
  DN150: ['6"', "6", '6.0"'],
  DN200: ['8"', "8", '8.0"'],
  DN250: ['10"', "10", '10.0"'],
  DN300: ['12"', "12", '12.0"'],
};

// Ümberpööratud lookup: igast tolli-stringist → DN-vorm
const INCH_TO_DN = new Map<string, string>();
for (const [dn, inches] of Object.entries(DN_TO_INCH)) {
  for (const inch of inches) INCH_TO_DN.set(inch.toLowerCase().trim(), dn);
}

/**
 * Tagasta ühe mõõdu kõik ekvivalentsed vormid. Kui input pole tuvastatud
 * mõõt, tagasta ainult input ise.
 */
export function dimensionAliases(token: string): string[] {
  const t = token.trim();
  if (!t) return [];
  // DN-vorm: "DN32", "DN 32", "DN.32"
  const dnMatch = t.match(/^DN\s*\.?\s*(\d+)$/i);
  if (dnMatch) {
    const key = `DN${dnMatch[1]}`;
    const inches = DN_TO_INCH[key];
    return inches ? [key, ...inches] : [key];
  }
  // Tolli-vorm: lookup
  const lower = t.toLowerCase();
  const dn = INCH_TO_DN.get(lower);
  if (dn) return [dn, ...(DN_TO_INCH[dn] ?? [])];
  return [t];
}

/**
 * Normaliseeri mõõt kanoonilisele DN-vormile. Kasutatakse auto-link lookup'i
 * võtmes — DN32 ja "1 1/4" annavad sama võtme.
 */
export function normalizeDimension(input: string | null | undefined): string {
  if (!input) return "";
  const t = input.trim();
  if (!t) return "";

  // Otse DN-vorm
  const dnMatch = t.match(/^DN\s*\.?\s*(\d+)$/i);
  if (dnMatch) return `DN${dnMatch[1]}`;

  // Otsi DN-vormi sõne sees (nt "Kuulkraan DN20")
  const dnInString = t.match(/DN\s*\.?\s*(\d+)/i);
  if (dnInString) return `DN${dnInString[1]}`;

  // Otsi tolli-väljendit (sortes pikemad enne, et "1 1/4" tabaks enne kui "1")
  const inchEntries = Object.entries(DN_TO_INCH)
    .flatMap(([dn, inches]) => inches.map((i) => [i, dn] as const))
    .sort((a, b) => b[0].length - a[0].length);
  for (const [inch, dn] of inchEntries) {
    if (t.toLowerCase().includes(inch.toLowerCase())) return dn;
  }
  return t;
}

/**
 * Laienda otsisõna: lisa originaalile dimensiooni-tokenite ekvivalendid.
 * Tulemus: massiiv vorme mida saab otsingus OR-ida.
 */
export function expandSearchQuery(query: string): string[] {
  const variants = new Set<string>();
  const q = query.trim();
  if (!q) return [];
  variants.add(q);

  // Tokeniseeri ja lisa iga tokeni ekvivalendid (sõltumata kas dimensioon või mitte)
  const tokens = q.split(/\s+/).filter(Boolean);
  for (const t of tokens) {
    variants.add(t);
    for (const a of dimensionAliases(t)) variants.add(a);
  }

  // Kui kogu query on tolli-vormis (nt "1 1/4\"" sees olev), püüa kinni
  const wholeAliases = dimensionAliases(q);
  for (const a of wholeAliases) variants.add(a);

  // Cap variants lugu — vältida liiga pikki OR-pärid (URL/query limit)
  return Array.from(variants).slice(0, 30);
}
