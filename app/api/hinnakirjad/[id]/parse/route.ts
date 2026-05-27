import { NextResponse } from "next/server";
import { revalidatePath } from "next/cache";
import Anthropic from "@anthropic-ai/sdk";
import * as XLSX from "xlsx";
import { getServerSupabase } from "@/lib/supabase/server";
import { getAnthropic, PARSING_MODEL } from "@/lib/anthropic";

export const runtime = "nodejs";
export const maxDuration = 120;

type ParsedRow = {
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
    "Tagasta tarnija hinnakirjast parsitud read struktureeritud kujul. Iga rida = üks toode/artikkel.",
  input_schema: {
    type: "object",
    properties: {
      read: {
        type: "array",
        description: "Massiiv parsitud ridu hinnakirjast.",
        items: {
          type: "object",
          properties: {
            rea_nr: {
              type: ["integer", "null"],
              description: "Rea järjekorranumber PDF-is (1-based), kui nähtav.",
            },
            tarnija_kood: {
              type: ["string", "null"],
              description:
                "Tarnija enda artikli kood (nt 1500006, 1030ST040). NULL kui pole nähtav (nt Küttemaailmis pole).",
            },
            tarnija_nimetus: {
              type: "string",
              description:
                "Toote täielik kirjeldus, nii nagu PDF-is näidatud. Ära kaasa hinda, kogust ega brand'i nime kui need on eraldi väljadel.",
            },
            tarnija_brand: {
              type: ["string", "null"],
              description:
                "Brand nimi nimetuse seest (Slovarm, Danfoss, Imas, Dražice jne). Tihti nimetuse lõpus. NULL kui brand pole tuvastatav.",
            },
            sektsioon: {
              type: ["string", "null"],
              description:
                'PDF-i sektsiooni pealkiri (nt "Vesivarustus", "TORUSTIK", "ISOLATSIOON"). Kõik selle järgi tulevad read kuni järgmise pealkirjani.',
            },
            ühik: {
              type: ["string", "null"],
              description: "Ühik: tk, m, jm, kompl, kg, m², m³. NULL kui pole näha.",
            },
            kogus: {
              type: ["number", "null"],
              description: "Kogus, mida tarnija pakkumises kasutab (kontekstiks).",
            },
            jaehind_neto: {
              type: ["number", "null"],
              description:
                'Jaehind enne allahindlust (€/ühik). Kasuta ainult kui PDF näitab seda eraldi veerus "Jaehind" (Küttemaailm). Toru-Jüris pole sellist veergu — siis NULL.',
            },
            ah_protsent: {
              type: ["number", "null"],
              description:
                'Allahindluse % (Küttemaailm "AH%" veerg, nt 55 = -55%). NULL kui pole nähtav.',
            },
            ostuhind_neto: {
              type: ["number", "null"],
              description:
                "KRIITILINE väli: tegelik ostuhind €/ühik mida kliendil tuleb maksta. Küttemaailmis veerg 'Hind' (juba arvestatud AH%-ga). Toru-Jüris veerg 'Hind'. Kui Küttemaailm näitab ainult jaehinda+AH%, arvuta: jaehind*(1-ah/100).",
            },
            pakkumise_summa: {
              type: ["number", "null"],
              description: 'Rea kokku summa (kogus × ostuhind). Sanity check. Veerg "Summa".',
            },
            kirjeldus: {
              type: ["string", "null"],
              description:
                'Pikem tehniline tootekirjeldus (eraldi PDF-i veerust nagu "Description", "Kirjeldus", "Specification"). NULL kui sellist veergu pole. Ära kopeeri tarnija_nimetust siia — see peab olema TÄIENDAV info (nt tehnilised parameetrid, mõõtmed, paigaldustingimused).',
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

const SYSTEM_PROMPT = `Sa parsid Eesti ehitustarnija või edasimüüja hinnakirja / tootekataloogi / pakkumis-spreadsheet'i (KVVK + soojuspumbad + PV jne). Sisend võib olla PDF, Exceli tabel CSV-vormingus või tava-CSV.

Põhi-eesmärk: TAGASTA IGA TOODE/ARTIKLI RIDA. Ole liberaalne — kui näed andmeid mis paistavad tootereaga (nimetus + hind või vähemalt nimetus), tagasta see. Ära kunagi tagasta 0 rida kui failis on tooteridu olemas.

VEERGUDE TUVASTAMINE — võimalikud sünonüümid:
- tarnija_nimetus (KOHUSTUSLIK): nimetus, toode, mudel, model, product, artikli nimi, toote nimetus, name
- tarnija_kood: kood, artikkel, art kood, artikli kood, SKU, tootekood, code
- tarnija_brand: brand, tootja, kaubamärk, mark, manufacturer
- ostuhind_neto: ostuhind, ostuhind_eur, hind, price, cost, cost price (KRIITILINE — tegelik hind mille pead maksma tarnijale)
- jaehind_neto: jaehind, retail, list_price, list, MSRP
- ah_protsent: AH%, allahindlus, discount %
- kirjeldus: tootekirjeldus, kirjeldus, description, spec, specification, spetsifikatsioon

PÕHIREEGLID:
- ostuhind_neto on KRIITILINE — see on tegelik tarnijale makstav hind
- Kui PDF/spreadsheet näitab "Jaehind" ja "AH%" eraldi ning eraldi "Hind" veeru, siis "Hind" = ostuhind_neto
- Kui ainult "Jaehind" ja "AH%" on antud, arvuta: ostuhind_neto = jaehind_neto * (1 - ah_protsent/100)
- Kui ainult ühte hinda näha (Toru-Jüri stiil), see on ostuhind_neto
- Kui hinnale on lisaks "price_retail" tüüpi veerg (lõpphind), siis jaehind_neto = see veerg, aga ostuhind jääb "ostuhind"/"ostuhind_eur"/"cost" veerust
- Brand on tihti nimetuse lõpus: "Kuulkraan KE-231-DN32 Slovarm" → tarnija_brand="Slovarm", tarnija_nimetus="Kuulkraan KE-231-DN32"
- Kui faili struktuur on "mudel" + "artikkel" eraldi veergudes: mudel = tarnija_nimetus, artikkel = tarnija_kood
- Kui on eraldi "kirjeldus" / "description" veerg (pikem tekst), kasuta seda kirjeldus-väljale (ÄRA kopeeri tarnija_nimetust kirjeldusse — see peab olema täiendav info)
- Sektsioonide pealkirjad (Vesivarustus, TORUSTIK, MAASOOJUS jne) ÄRA tagasta eraldi ridadena. Pane need järgnevatele toodetele sektsioon-väljale.
- Lehtede pealkirjad, KM kokkuvõtted, kokkusummad, leheküljenumbrid, kontaktinfo ja muud metaandmed jäta vahele.
- Kui tarnijal pole artikli koodi (nt Küttemaailm), jäta tarnija_kood NULL.

ARVUDE PARSIMINE (TÄHTIS!):
- US/inglise stiil — koma on TUHANDE-eraldaja, punkt on DECIMAL: "5,649" → 5649 · "1,200.50" → 1200.50 · "1.24" → 1.24
- Eesti stiil — koma on DECIMAL, tühik on TUHANDE-eraldaja: "5 649,50" → 5649.50 · "46,36" → 46.36
- Tee otsus stiili kohta IGAS ARVUSES eraldi vaadates:
  - Kui arvus on KOMA + 3 numbrit järel + ei ole punkti → tuhande eraldaja: "5,649" → 5649
  - Kui arvus on KOMA + 1-2 numbrit järel → decimal: "46,36" → 46.36
  - Punkt enne 2 numbrit ja > 100 → decimal: "1.24" → 1.24
- Eemalda alati valuutasümbolid (€, $) ja jutumärgid: '"5,649 €"' → 5649
- Protsendid: "33,5%" või "33.5%" → 33.5 (ÄRA jaga 100-ga)

MITME LEHE EXCEL:
- Iga sheet on tähistatud "=== Sheet: <nimi> ===" reaga
- Parsi AINULT lehed mis sisaldavad tooteridu (kus on hinnad ja artiklid)
- IGNOREERI metadata-lehti — nimed nagu "selgitused", "legend", "selgitus", "info", "abi", "metaandmed", "kommentaarid", "veerud"
- Kui ainult üks leht sisaldab tooteid, ignoreeri ülejäänud

VALI TÖÖRIIST \`tagasta_read\` ja tagasta KÕIK tooteridad ühe kõnega.`;

export async function POST(_req: Request, { params }: { params: { id: string } }) {
  const hinnakirjaId = params.id;
  const sb = getServerSupabase();

  // 1. Hinnakirja päise laadimine
  const { data: hk, error: hkErr } = await sb
    .from("hinnakirjad")
    .select("*")
    .eq("id", hinnakirjaId)
    .maybeSingle();
  if (hkErr) return NextResponse.json({ ok: false, error: hkErr.message }, { status: 500 });
  if (!hk) return NextResponse.json({ ok: false, error: "Hinnakirja ei leitud" }, { status: 404 });

  const tarnija = hk.tarnija as string;
  const path = hk.faili_path as string;
  const tüüp = hk.faili_tüüp as "pdf" | "xlsx" | "csv";

  // 2. Faili laadimine Storage'ist
  const { data: blob, error: dlErr } = await sb.storage.from("hinnakirjad").download(path);
  if (dlErr || !blob) {
    await markError(sb, hinnakirjaId, `Storage download: ${dlErr?.message ?? "tundmatu viga"}`);
    return NextResponse.json({ ok: false, error: dlErr?.message }, { status: 500 });
  }
  const bytes = Buffer.from(await blob.arrayBuffer());

  // 3. Sisendi ettevalmistamine vastavalt faili tüübile
  type UserContent = Anthropic.Messages.ContentBlockParam[];
  let userContent: UserContent;
  try {
    userContent = buildUserContent(tüüp, bytes, tarnija);
  } catch (err) {
    const msg = err instanceof Error ? err.message : String(err);
    await markError(sb, hinnakirjaId, msg);
    return NextResponse.json({ ok: false, error: msg }, { status: 400 });
  }

  // 4. Claude API kõne — streaming nõutav pikkade requestide jaoks
  const client = getAnthropic();

  let response;
  try {
    const stream = client.messages.stream({
      model: PARSING_MODEL,
      max_tokens: 32000,
      system: [
        {
          type: "text",
          text: SYSTEM_PROMPT,
          cache_control: { type: "ephemeral" },
        },
      ],
      tools: [PARSE_TOOL],
      tool_choice: { type: "tool", name: "tagasta_read" },
      messages: [{ role: "user", content: userContent }],
    });
    response = await stream.finalMessage();
  } catch (err) {
    if (err instanceof Anthropic.APIError && err.status === 529) {
      const msg = "Anthropic API ülekoormatud (529). Süsteem proovis 5x uuesti — ebaõnnestus. Proovi paari minuti pärast.";
      await markError(sb, hinnakirjaId, msg);
      return NextResponse.json({ ok: false, error: msg }, { status: 529 });
    }
    if (err instanceof Anthropic.RateLimitError) {
      const msg = "Anthropic API rate limit (429). Oota minut ja proovi uuesti.";
      await markError(sb, hinnakirjaId, msg);
      return NextResponse.json({ ok: false, error: msg }, { status: 429 });
    }
    const msg = err instanceof Error ? err.message : String(err);
    await markError(sb, hinnakirjaId, `Anthropic API: ${msg}`);
    return NextResponse.json({ ok: false, error: msg }, { status: 502 });
  }

  // 4. Tool_use bloki leidmine
  const toolBlock = response.content.find(
    (b): b is Anthropic.Messages.ToolUseBlock => b.type === "tool_use" && b.name === "tagasta_read",
  );
  if (!toolBlock) {
    await markError(sb, hinnakirjaId, "Claude ei kasutanud tagasta_read tööriista");
    return NextResponse.json({ ok: false, error: "Claude vastus ilma tool_use blokita" }, { status: 502 });
  }

  const input = toolBlock.input as { read?: ParsedRow[] };
  const parsed = input.read ?? [];
  if (parsed.length === 0) {
    // Diagnoosi: vaata mida Claude tagastas (stop_reason, token usage)
    console.warn("[parse] Claude tagastas 0 rida", {
      stop_reason: response.stop_reason,
      input_tokens: response.usage.input_tokens,
      output_tokens: response.usage.output_tokens,
      tool_input_keys: Object.keys(input),
    });
    const reason =
      response.stop_reason === "max_tokens"
        ? "Vastus oli liiga pikk (max_tokens). Proovi väiksema failiga või jaga mitmeks."
        : `Claude tagastas 0 rida (stop_reason: ${response.stop_reason}). Vaata kas faili sisus on tooteridu või pole AI suutnud neid tuvastada — palun proovi uuesti või jaga konkreetne fail Claude'iga.`;
    await markError(sb, hinnakirjaId, reason);
    return NextResponse.json({ ok: false, error: reason }, { status: 422 });
  }

  // 5. Salvesta hinnakirja_read'idesse
  const insertRows = parsed.map((r, idx) => ({
    hinnakiri_id: hinnakirjaId,
    rea_nr: r.rea_nr ?? idx + 1,
    tarnija_kood: r.tarnija_kood ?? null,
    tarnija_nimetus: r.tarnija_nimetus,
    tarnija_brand: r.tarnija_brand ?? null,
    sektsioon: r.sektsioon ?? null,
    ühik: r.ühik ?? null,
    kogus: r.kogus ?? null,
    jaehind_neto: r.jaehind_neto ?? null,
    ah_protsent: r.ah_protsent ?? null,
    ostuhind_neto: r.ostuhind_neto ?? null,
    pakkumise_summa: r.pakkumise_summa ?? null,
    kirjeldus: r.kirjeldus ?? null,
    staatus: "matchimata",
  }));

  // Kustuta vanad read enne lisamist (idempotent re-parse)
  await sb.from("hinnakirja_read").delete().eq("hinnakiri_id", hinnakirjaId);

  const { error: insErr } = await sb.from("hinnakirja_read").insert(insertRows);
  if (insErr) {
    await markError(sb, hinnakirjaId, `Ridade insert: ${insErr.message}`);
    return NextResponse.json({ ok: false, error: insErr.message }, { status: 500 });
  }

  await sb
    .from("hinnakirjad")
    .update({ staatus: "parsitud", artiklite_arv: insertRows.length, viga_tekst: null })
    .eq("id", hinnakirjaId);

  revalidatePath(`/hinnakirjad/${hinnakirjaId}`);
  revalidatePath("/hinnakirjad");

  return NextResponse.json({
    ok: true,
    parsitud: insertRows.length,
    cache_read_tokens: response.usage.cache_read_input_tokens,
    cache_write_tokens: response.usage.cache_creation_input_tokens,
    input_tokens: response.usage.input_tokens,
    output_tokens: response.usage.output_tokens,
  });
}

async function markError(
  sb: ReturnType<typeof getServerSupabase>,
  id: string,
  msg: string,
) {
  await sb.from("hinnakirjad").update({ staatus: "viga", viga_tekst: msg }).eq("id", id);
}

// ----------------------------------------------------------------------------
// Sisendi ehitamine PDF/XLSX/CSV jaoks
// ----------------------------------------------------------------------------

function buildUserContent(
  tüüp: "pdf" | "xlsx" | "csv",
  bytes: Buffer,
  tarnija: string,
): Anthropic.Messages.ContentBlockParam[] {
  if (tüüp === "pdf") {
    return [
      {
        type: "document",
        source: {
          type: "base64",
          media_type: "application/pdf",
          data: bytes.toString("base64"),
        },
      },
      {
        type: "text",
        text: `Tarnija: ${tarnija}\n\nParsige see hinnakirja PDF kõik tooteread tööriistaga \`tagasta_read\`. Ära jäta ühtegi toodet vahele.`,
      },
    ];
  }
  if (tüüp === "xlsx") {
    const text = xlsxToCsvText(bytes);
    if (text.trim().length === 0) {
      throw new Error("Exceli fail tundub tühi (ühtegi rida ei leitud)");
    }
    return [
      {
        type: "text",
        text:
          `Tarnija: ${tarnija}\n\n` +
          `Allpool on hinnakirja Exceli faili kõik lehed CSV-vormingus (üks sektsioon lehe kohta). ` +
          `Parsige kõik tooteread tööriistaga \`tagasta_read\`. Päise read, tühjad read ja kontaktinfo jäta vahele. ` +
          `NB: erinevatel lehtedel võivad olla erinevad veerud — analüüsi iga lehe päiserida eraldi.\n\n` +
          text,
      },
    ];
  }
  if (tüüp === "csv") {
    const text = bytes.toString("utf-8");
    if (text.trim().length === 0) {
      throw new Error("CSV fail on tühi");
    }
    return [
      {
        type: "text",
        text:
          `Tarnija: ${tarnija}\n\n` +
          `Allpool on hinnakirja CSV sisu. Parsige kõik tooteread tööriistaga \`tagasta_read\`.\n\n` +
          text,
      },
    ];
  }
  throw new Error(`Tundmatu faili tüüp: ${tüüp}`);
}

function xlsxToCsvText(bytes: Buffer): string {
  const wb = XLSX.read(bytes, { type: "buffer" });
  const parts: string[] = [];
  for (const sheetName of wb.SheetNames) {
    const ws = wb.Sheets[sheetName];
    if (!ws) continue;
    const csv = XLSX.utils.sheet_to_csv(ws, { blankrows: false }).trim();
    if (csv.length === 0) continue;
    parts.push(`=== Sheet: ${sheetName} ===\n${csv}`);
  }
  return parts.join("\n\n");
}
