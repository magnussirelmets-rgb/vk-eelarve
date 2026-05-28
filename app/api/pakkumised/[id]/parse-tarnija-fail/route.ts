// Tarnija faili parsimine OTSE pakkumise editoris — ei salvesta Storage'i ega DB-sse.
// Ainult parsetud read tagastatakse kliendile JSON-ina; klient kuvab eelvaate dialoogi
// linnukestega ja valitud read insertitakse server-action'iga positsioonidena.

import { NextResponse } from "next/server";
import Anthropic from "@anthropic-ai/sdk";
import * as XLSX from "xlsx";
import { getAnthropic, PARSING_MODEL } from "@/lib/anthropic";

export const runtime = "nodejs";
export const maxDuration = 240;

export type TarnijaFailiRida = {
  rea_nr?: number | null;
  tarnija_kood?: string | null;
  tarnija_nimetus: string;
  tarnija_brand?: string | null;
  ühik?: string | null;
  kogus?: number | null;
  jaehind_neto?: number | null;
  ah_protsent?: number | null;
  ostuhind_neto?: number | null;
  pakkumise_summa?: number | null;
  sektsioon?: string | null;
  kirjeldus?: string | null;
};

const PARSE_TOOL: Anthropic.Tool = {
  name: "tagasta_read",
  description:
    "Tagasta tarnija pakkumis-failist parsitud read struktureeritud kujul. Iga rida = üks toode/positsioon.",
  input_schema: {
    type: "object",
    properties: {
      read: {
        type: "array",
        items: {
          type: "object",
          properties: {
            rea_nr: { type: ["integer", "null"], description: "Rea järjekorranumber PDF-is." },
            tarnija_kood: { type: ["string", "null"] },
            tarnija_nimetus: { type: "string" },
            tarnija_brand: { type: ["string", "null"] },
            sektsioon: { type: ["string", "null"] },
            ühik: { type: ["string", "null"], description: "tk, m, jm, kompl, kg, m², m³" },
            kogus: { type: ["number", "null"] },
            jaehind_neto: { type: ["number", "null"] },
            ah_protsent: { type: ["number", "null"] },
            ostuhind_neto: {
              type: ["number", "null"],
              description: "Tegelik hind mida ostja peab maksma (allahindlust arvestades).",
            },
            pakkumise_summa: { type: ["number", "null"] },
            kirjeldus: {
              type: ["string", "null"],
              description: "Pikem tehniline kirjeldus eraldi veerust (kui olemas).",
            },
          },
          required: ["tarnija_nimetus"],
          additionalProperties: false,
        },
      },
    },
    required: ["read"],
    additionalProperties: false,
  },
};

const SYSTEM_PROMPT = `Sa parsid Eesti ehitustarnija pakkumis-faili (PDF, Excel või CSV). Eesmärk: tagasta IGA tooteridu.

Ole liberaalne — kui näed andmeid mis paistavad tootereaga (nimetus + hind või vähemalt nimetus), tagasta see. Ära kunagi tagasta 0 rida kui failis on tooteridu olemas.

VEERGUDE TUVASTAMINE — võimalikud sünonüümid:
- tarnija_nimetus (KOHUSTUSLIK): nimetus, toode, mudel, model, product, artikli nimi
- tarnija_kood: kood, artikkel, art kood, SKU, tootekood
- tarnija_brand: brand, tootja, kaubamärk
- ostuhind_neto: ostuhind, ostuhind_eur, hind, price, cost
- jaehind_neto: jaehind, retail, list_price
- ah_protsent: AH%, allahindlus, discount %
- kirjeldus: tootekirjeldus, kirjeldus, description, spec

PÕHIREEGLID:
- ostuhind_neto on KRIITILINE — tegelik hind, mille ostja maksab
- Kui PDF näitab "Jaehind + AH% + Hind" → "Hind" = ostuhind_neto
- Kui ainult "Jaehind + AH%" → arvuta: ostuhind_neto = jaehind * (1 - ah/100)
- Brand on tihti nimetuse lõpus
- Sektsiooni-pealkirjad (Vesivarustus, MAASOOJUS jne) ÄRA tagasta eraldi ridadena
- KM kokkuvõtted, leheküljenumbrid, kontaktinfo — jäta vahele

ARVUDE PARSIMINE:
- US-stiil: "5,649" → 5649 (koma = tuhande eraldaja kui 3 numbrit järel)
- Eesti stiil: "46,36" → 46.36 (koma = decimal kui 1-2 numbrit järel)
- "5 649 €" → 5649 (eemalda tühikud + €)
- "33,5%" → 33.5

VALI TÖÖRIIST tagasta_read ja tagasta KÕIK tooteridad ühe kõnega.`;

function xlsxToCsv(bytes: Buffer): string {
  const wb = XLSX.read(bytes, { type: "buffer" });
  const parts: string[] = [];
  for (const name of wb.SheetNames) {
    const ws = wb.Sheets[name];
    if (!ws) continue;
    const csv = XLSX.utils.sheet_to_csv(ws, { blankrows: false }).trim();
    if (csv.length === 0) continue;
    parts.push(`=== Sheet: ${name} ===\n${csv}`);
  }
  return parts.join("\n\n");
}

export async function POST(
  req: Request,
  { params }: { params: { id: string } },
): Promise<Response> {
  const pakkumineId = params.id;
  if (!pakkumineId) return NextResponse.json({ ok: false, error: "Pakkumise ID puudub" }, { status: 400 });

  const formData = await req.formData();
  const file = formData.get("fail");
  if (!(file instanceof File) || file.size === 0) {
    return NextResponse.json({ ok: false, error: "Fail puudub" }, { status: 400 });
  }
  if (file.size > 20 * 1024 * 1024) {
    return NextResponse.json({ ok: false, error: "Fail liiga suur (max 20 MB)" }, { status: 400 });
  }

  const fileName = file.name.toLowerCase();
  const isPdf = fileName.endsWith(".pdf");
  const isXlsx = fileName.endsWith(".xlsx") || fileName.endsWith(".xls");
  const isCsv = fileName.endsWith(".csv");
  if (!isPdf && !isXlsx && !isCsv) {
    return NextResponse.json(
      { ok: false, error: "Toetatud failitüübid: .pdf, .xlsx, .xls, .csv" },
      { status: 400 },
    );
  }

  const bytes = Buffer.from(await file.arrayBuffer());

  // Ehita Claude'i sisendi sõnum
  type UserContent = Anthropic.Messages.ContentBlockParam[];
  let userContent: UserContent;
  if (isPdf) {
    userContent = [
      {
        type: "document",
        source: { type: "base64", media_type: "application/pdf", data: bytes.toString("base64") },
      },
      {
        type: "text",
        text: `Parsige see tarnija pakkumis-PDF kõik tooteread tööriistaga tagasta_read.`,
      },
    ];
  } else if (isXlsx) {
    const csv = xlsxToCsv(bytes);
    if (!csv) return NextResponse.json({ ok: false, error: "Excelis pole ühtegi rida" }, { status: 400 });
    userContent = [
      {
        type: "text",
        text:
          `Tarnija pakkumis-faili sisu CSV-vormingus (kõik lehed).\n\n` +
          `Parsige tooteread tööriistaga tagasta_read.\n\n${csv}`,
      },
    ];
  } else {
    // CSV
    let text = bytes.toString("utf-8");
    if (text.charCodeAt(0) === 0xfeff) text = text.slice(1);
    userContent = [
      {
        type: "text",
        text: `Tarnija pakkumis-CSV:\n\n${text}\n\nParsige tooteread tööriistaga tagasta_read.`,
      },
    ];
  }

  // Claude API kõne
  const client = getAnthropic();
  let response: Anthropic.Messages.Message;
  try {
    const stream = client.messages.stream({
      model: PARSING_MODEL,
      max_tokens: 32000,
      system: [{ type: "text", text: SYSTEM_PROMPT, cache_control: { type: "ephemeral" } }],
      tools: [PARSE_TOOL],
      tool_choice: { type: "tool", name: "tagasta_read" },
      messages: [{ role: "user", content: userContent }],
    });
    response = await stream.finalMessage();
  } catch (err) {
    if (err instanceof Anthropic.APIError && err.status === 529) {
      return NextResponse.json(
        { ok: false, error: "Anthropic API ülekoormatud. Proovi paari minuti pärast." },
        { status: 529 },
      );
    }
    if (err instanceof Anthropic.RateLimitError) {
      return NextResponse.json(
        { ok: false, error: "Anthropic API rate limit (429). Oota minut." },
        { status: 429 },
      );
    }
    const msg = err instanceof Error ? err.message : String(err);
    return NextResponse.json({ ok: false, error: `Anthropic API: ${msg}` }, { status: 502 });
  }

  const toolBlock = response.content.find(
    (b): b is Anthropic.Messages.ToolUseBlock =>
      b.type === "tool_use" && b.name === "tagasta_read",
  );
  if (!toolBlock) {
    return NextResponse.json(
      { ok: false, error: "Claude vastus ilma tool_use blokita" },
      { status: 502 },
    );
  }

  const input = toolBlock.input as { read?: TarnijaFailiRida[] };
  const read = input.read ?? [];

  return NextResponse.json({
    ok: true,
    faili_nimi: file.name,
    parsitud: read.length,
    read,
    input_tokens: response.usage.input_tokens,
    output_tokens: response.usage.output_tokens,
  });
}
