import { NextResponse } from "next/server";
import { revalidatePath } from "next/cache";
import Anthropic from "@anthropic-ai/sdk";
import { getServerSupabase } from "@/lib/supabase/server";
import { getAnthropic, PARSING_MODEL } from "@/lib/anthropic";
import { autoLingiAjalooPõhjal } from "@/app/pakkumised/actions";

export const runtime = "nodejs";
export const maxDuration = 180;

type ParsedPositsioon = {
  rea_nr?: number | null;
  sektsioon?: string | null;
  nimetus: string;
  tähis?: string | null;
  kogus?: number | null;
  ühik?: string | null;
};

const PARSE_TOOL: Anthropic.Tool = {
  name: "tagasta_positsioonid",
  description:
    "Tagasta mahutabeli kõik tooted/tööd struktureeritud kujul, ÜKS rida = üks toode/töö.",
  input_schema: {
    type: "object",
    properties: {
      positsioonid: {
        type: "array",
        description: "Massiiv parsitud ridu mahutabelist (kõik toote-/tööread järjekorras).",
        items: {
          type: "object",
          properties: {
            rea_nr: {
              type: ["integer", "null"],
              description: "Rea järjekorranumber (1-based), kui PDF-is nähtav.",
            },
            sektsioon: {
              type: ["string", "null"],
              description:
                'SEK kood + nimetus (nt "711 Veevarustus", "712 Kanalisatsioon", "721 Küttesüsteem", "722 Küttekehad", "723 Soojussõlm", "724 Ventilatsioon"). Kohalda kõikidele alaridadele kuni järgmise pealkirjani.',
            },
            nimetus: {
              type: "string",
              description: "Toote või töö nimetus, nii nagu PDF-is.",
            },
            tähis: {
              type: ["string", "null"],
              description: "Mõõt või tähis (DN20, K110, 1400-500-22, M5 jne). NULL kui pole.",
            },
            kogus: {
              type: ["number", "null"],
              description: "Kogus numbrina (punkti komaeraldajana). NULL kui pole nähtav.",
            },
            ühik: {
              type: ["string", "null"],
              description: 'Ühik: tk, m, jm, kompl, kg, m², m³, h. NULL kui pole.',
            },
          },
          required: ["nimetus"],
          additionalProperties: false,
        },
      },
    },
    required: ["positsioonid"],
    additionalProperties: false,
  },
};

const SYSTEM_PROMPT = `Sa parsid Eesti peatöövõtja KVVK mahutabeli PDF-i (kortermaja rekonstrueerimise pakkumise alus).

Mahutabel on tabel toodete/tööde kogustega, jaotatud SEK koodide järgi. KVVK valdkonnas levinud koodid (ainult näited, MITTE ammendav):
- 711 Veevarustus
- 712 Kanalisatsioon
- 713 Sademevesi / drenaaž / sõlmesisene veevarustus (kui esineb)
- 714 Reoveepumpsüsteemid (kui esineb)
- 721 Küttesüsteem (torustik, armatuur)
- 722 Küttekehad (radiaatorid jne)
- 723 Soojussõlm
- 724 Ventilatsioon
- 731+ Jahutus / kliima (kui esineb)

KRIITILINE: säilita PDF-is leitud KÕIK sektsioonide pealkirjad järgnevatele ridadele. Ka koodid mida ma ei loetlenud (nt 715, 725, 732 jne) ja ka sõnalised pealkirjad ilma koodita — pane need sektsiooni-väljale.

Reeglid:
- ÄRA tagasta sektsioonide pealkirju eraldi ridadena. Pane sektsiooni nimi (nt "713 Sademevesi") iga alarea sektsioon-väljale, kuni järgmise pealkirjani.
- Iga toote/töö rida = üks JSON objekt
- KOMPLEKTHINNAD (nt "Soojussõlm komplekt - 1 tk") on POSITSIOONID — tagasta need ka, isegi kui nad pole tüüpilised single-item read.
- Vahesummad, kokkusummad, KM info, lehe pealkirjad, kontaktinfo jms metaandmed JÄTA VAHELE (need pole tooteid/töid).
- Tähis on **mõõt/dimensioon** (DN20, K110, 22/13mm, 1 1/4", 16×2.0mm jne), mitte materjali nimi. Pane mõõt KINDLASTI tähis-väljale, MITTE nimetuse sisse. Materjali tüüp (kuulkraan, sulgkraan, isolatsioon, komposiittoru) läheb nimetuse alla, mõõt eraldi tähis-välja.
- Isolatsioonide puhul mõõt on tavaliselt formaadis "VÄLJASEINA/SISEMÕÕDU mm" (nt 22/13mm = 22mm seinapaksusega 13mm sisemõõdule) — pane KOGU see kombinatsioon tähis-väljale.
- Torustiku puhul mõõt võib olla DN (DN20), toll (1 1/4"), välimine läbimõõt (16, 20, 25mm) või lubitud kombinatsioon. Pane mis on PDF-is näha, tähis-väljale.
- KRIITILINE: kui PDF rida sisaldab mõõtu mistahes vormis, MITTE jäta tähist NULL'iks. Tähise puudumine põhjustab edaspidi auto-link probleeme.
- Kui sama rida sisaldab mitut suurust (nt "Olmereovee toru K50/K75/K110"), tagasta ERALDI read iga suuruse jaoks (kui koguseid eraldi näha) või jäta märkimisena nimetuse sisse (kui kogus on kõikide kohta üks).
- Numbrid: kasuta punkti komaeraldajana JSON-is.
- Kasuta tööriista \`tagasta_positsioonid\` kõikide ridade tagastamiseks ühes kõnes. Ära jäta ühtegi sektsiooni ega tooderea vahele.`;

export async function POST(req: Request, { params }: { params: { id: string } }) {
  const pakkumineId = params.id;
  const url = new URL(req.url);
  const mahutabelId = url.searchParams.get("mahutabel"); // optional — kui antud, pars eraldi mahutabelit
  const sb = getServerSupabase();

  // 1. Lae pakkumise päis
  const { data: pkData, error: pkErr } = await sb
    .from("pakkumised")
    .select("*")
    .eq("id", pakkumineId)
    .maybeSingle();
  if (pkErr) return NextResponse.json({ ok: false, error: pkErr.message }, { status: 500 });
  if (!pkData) return NextResponse.json({ ok: false, error: "Pakkumist ei leitud" }, { status: 404 });
  const pakkumine = pkData as { id: string; mahutabel_pdf_path: string | null };

  // 2. Vali allikas: kas konkreetne mahutabel (uus skeem) või pakkumise.mahutabel_pdf_path (legacy)
  let filePath: string;
  let activeMahutabelId: string | null = null;

  if (mahutabelId) {
    const { data: mhData, error: mhErr } = await sb
      .from("pakkumise_mahutabelid")
      .select("*")
      .eq("id", mahutabelId)
      .eq("pakkumine_id", pakkumineId)
      .maybeSingle();
    if (mhErr) return NextResponse.json({ ok: false, error: mhErr.message }, { status: 500 });
    if (!mhData) return NextResponse.json({ ok: false, error: "Mahutabel ei leitud" }, { status: 404 });
    filePath = (mhData as { faili_path: string }).faili_path;
    activeMahutabelId = mahutabelId;
  } else {
    if (!pakkumine.mahutabel_pdf_path) {
      return NextResponse.json({ ok: false, error: "Mahutabeli PDF pole üles laetud" }, { status: 400 });
    }
    filePath = pakkumine.mahutabel_pdf_path;
  }

  // 3. Lae fail Storage'ist
  const { data: blob, error: dlErr } = await sb.storage.from("mahutabelid").download(filePath);
  if (dlErr || !blob) {
    return NextResponse.json(
      { ok: false, error: `Storage download: ${dlErr?.message ?? "tundmatu"}` },
      { status: 500 },
    );
  }
  const bytes = Buffer.from(await blob.arrayBuffer());
  const pdfB64 = bytes.toString("base64");

  // 3. Claude API kõne — streaming nõutav pikkade requestide jaoks
  const client = getAnthropic();
  let response;
  try {
    const stream = client.messages.stream({
      model: PARSING_MODEL,
      max_tokens: 32000,
      system: [{ type: "text", text: SYSTEM_PROMPT, cache_control: { type: "ephemeral" } }],
      tools: [PARSE_TOOL],
      tool_choice: { type: "tool", name: "tagasta_positsioonid" },
      messages: [
        {
          role: "user",
          content: [
            {
              type: "document",
              source: { type: "base64", media_type: "application/pdf", data: pdfB64 },
            },
            {
              type: "text",
              text:
                "Parsige see mahutabeli PDF kõik tooteread (sektsioon, nimetus, tähis, kogus, ühik) " +
                "tööriistaga `tagasta_positsioonid`. Ära jäta ühtegi tooderida vahele.",
            },
          ],
        },
      ],
    });
    response = await stream.finalMessage();
  } catch (err) {
    if (err instanceof Anthropic.APIError && err.status === 529) {
      return NextResponse.json(
        {
          ok: false,
          error:
            "Anthropic API on hetkel ülekoormatud (529). Süsteem proovis automaatselt 5 korda uuesti — ebaõnnestus. Proovi paari minuti pärast uuesti.",
        },
        { status: 529 },
      );
    }
    if (err instanceof Anthropic.RateLimitError) {
      return NextResponse.json(
        { ok: false, error: "Anthropic API rate limit (429). Oota minut ja proovi uuesti." },
        { status: 429 },
      );
    }
    const msg = err instanceof Error ? err.message : String(err);
    return NextResponse.json({ ok: false, error: `Anthropic API: ${msg}` }, { status: 502 });
  }

  // 4. Leia tool_use blokk
  const toolBlock = response.content.find(
    (b): b is Anthropic.Messages.ToolUseBlock =>
      b.type === "tool_use" && b.name === "tagasta_positsioonid",
  );
  if (!toolBlock) {
    return NextResponse.json(
      { ok: false, error: "Claude ei kasutanud tagasta_positsioonid tööriista" },
      { status: 502 },
    );
  }
  const input = toolBlock.input as { positsioonid?: ParsedPositsioon[] };
  const parsed = input.positsioonid ?? [];
  if (parsed.length === 0) {
    return NextResponse.json({ ok: false, error: "Claude tagastas 0 rida" }, { status: 422 });
  }

  // 5. Kustuta vanad positsioonid (idempotent re-parse) + sisesta uued
  if (activeMahutabelId) {
    // Uus skeem: kustuta ainult selle mahutabeli read, teised pakkumise read jäävad alles
    await sb.from("positsioonid").delete().eq("mahutabel_id", activeMahutabelId);
  } else {
    // Legacy: kustuta kõik selle pakkumise read (ja need mis on linkitud esmase mahutabeliga)
    await sb.from("positsioonid").delete().eq("pakkumine_id", pakkumineId);
  }

  // Leia rea_nr offset (et uus mahutabel ei kasutaks samu rea_nr-e)
  let reaNrOffset = 0;
  if (activeMahutabelId) {
    const { data: maxRow } = await sb
      .from("positsioonid")
      .select("rea_nr")
      .eq("pakkumine_id", pakkumineId)
      .order("rea_nr", { ascending: false })
      .limit(1)
      .maybeSingle();
    reaNrOffset = ((maxRow as { rea_nr: number | null } | null)?.rea_nr ?? 0);
  }

  const rows = parsed.map((p, idx) => ({
    pakkumine_id: pakkumineId,
    mahutabel_id: activeMahutabelId,
    rea_nr: (p.rea_nr ?? idx + 1) + reaNrOffset,
    sektsioon: p.sektsioon ?? null,
    nimetus: p.nimetus,
    tähis: p.tähis ?? null,
    kogus: p.kogus ?? null,
    ühik: p.ühik ?? null,
  }));

  const { error: insErr } = await sb.from("positsioonid").insert(rows);
  if (insErr) return NextResponse.json({ ok: false, error: insErr.message }, { status: 500 });

  // Uuenda pakkumise staatus + ajatempel
  await sb
    .from("pakkumised")
    .update({ staatus: "parsitud", mahutabel_parsitud_ajal: new Date().toISOString() })
    .eq("id", pakkumineId);

  // Kui konkreetse mahutabeli parsing, uuenda ka pakkumise_mahutabelid.parsitud_ajal
  if (activeMahutabelId) {
    await sb
      .from("pakkumise_mahutabelid")
      .update({ parsitud_ajal: new Date().toISOString() })
      .eq("id", activeMahutabelId);
  }

  // Iseõppimine: lingi varasemate (nimetus, tähis) → toode seoste põhjal automaatselt
  let autoLinked = 0;
  try {
    const r = await autoLingiAjalooPõhjal(pakkumineId);
    if (r.ok) autoLinked = r.auto_linked;
  } catch (err) {
    console.warn("[parse] autoLingiAjalooPõhjal viga:", err);
  }

  revalidatePath(`/pakkumised/${pakkumineId}`);
  revalidatePath("/pakkumised");

  return NextResponse.json({
    ok: true,
    parsitud: rows.length,
    auto_linked: autoLinked,
    input_tokens: response.usage.input_tokens,
    output_tokens: response.usage.output_tokens,
    cache_read_tokens: response.usage.cache_read_input_tokens,
    cache_write_tokens: response.usage.cache_creation_input_tokens,
  });
}
