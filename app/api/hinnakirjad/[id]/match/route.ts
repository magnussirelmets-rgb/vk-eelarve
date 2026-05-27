import { NextResponse } from "next/server";
import { revalidatePath } from "next/cache";
import type Anthropic from "@anthropic-ai/sdk";
import { getServerSupabase } from "@/lib/supabase/server";
import { getAnthropic, MATCHING_MODEL } from "@/lib/anthropic";

export const runtime = "nodejs";
export const maxDuration = 300; // matching may iterate up to ~100 rows

type ArtikkelLite = {
  id: string;
  kood: string;
  osa: string;
  alamosa: string | null;
  nimetus: string;
  tähis: string | null;
  ühik: string | null;
  alt_nimed: string | null;
};

type HinnakirjaReadLite = {
  id: string;
  rea_nr: number | null;
  tarnija_kood: string | null;
  tarnija_nimetus: string;
  tarnija_brand: string | null;
  sektsioon: string | null;
  ühik: string | null;
  vk_artikkel_id: string | null;
  staatus: string;
};

const MATCH_TOOL: Anthropic.Tool = {
  name: "vali_match",
  description:
    "Vali kataloogist parim sobiv VK artikkel etteantud tarnija-hinnakirja rea jaoks. Tagasta valitud artikli VK kood ja kindlustase 0-1.",
  input_schema: {
    type: "object",
    properties: {
      kood: {
        type: ["string", "null"],
        description:
          "Valitud VK artikli kood (nt VK-VESI-001). NULL kui ükski kataloogi artikkel ei sobi piisavalt.",
      },
      confidence: {
        type: "number",
        description:
          "Kindlustase 0.0 - 1.0. 1.0 = täielikult kindel; 0.85+ = väga tõenäoline (võib automaatselt kinnitada); 0.6-0.85 = võimalik aga vajab inimese pilku; alla 0.6 = ebakindel; NULL kood + 0 = pole vastet.",
      },
      põhjendus: {
        type: "string",
        description:
          "Lühike (1-2 lauset) põhjendus eesti keeles, miks see artikkel sobib või miks vastet pole. Maini võtmesõnu mis langesid kokku.",
      },
    },
    required: ["kood", "confidence", "põhjendus"],
    additionalProperties: false,
  },
};

const SYSTEM_HEAD = `Sa oled VK Eelarve süsteemi matching-tööriist. Sinu töö on leida iga tarnija hinnakirja rea jaoks parim sobiv VK kataloogi artikkel.

REEGLID:
- Vasta ainult tööriistaga \`vali_match\`.
- Eelista täpset tähise (DN-suurus, mõõdud) ja osa (vesi/kanal/küte/sõlm/...) vasted lihtsalt sõna-sarnasusele.
- Kui tähis (nt DN20, K110, 1400-500-22) ei vasta täpselt aga nimetus on selgelt sama tüüpi toode, siis confidence 0.7-0.85.
- Kui tähis on erinev (nt tarnijal DN20, kataloogis DN25) — see on ERINEV artikkel. Tagasta NULL kood, confidence 0.
- Kui tarnija nimetus on selgelt teises osas (nt tarnijal "Radiaator" aga kataloogis ainult sõlm-detailid) — tagasta NULL.
- Confidence skaala:
  * 0.95-1.0: tähis + nimetus + osa kõik täpselt sobivad
  * 0.85-0.95: tähis täpne, nimetus sünonüüm (kuulkraan/kuulventiil), osa sobib
  * 0.7-0.85: nimetus sobib, tähis lähedane aga mitte täpne
  * 0.5-0.7: nimetus võiks sobida aga tähis erineb või on ebakindel
  * <0.5: tagasta kood=NULL, confidence=0
- Brand info (Slovarm, Danfoss, Imas) on bonus aga ei pea olema otsustav.

VK KATALOOG (kõik aktiivsed artiklid):

`;

export async function POST(_req: Request, { params }: { params: { id: string } }) {
  const hinnakirjaId = params.id;
  const sb = getServerSupabase();

  // 1. Hinnakiri päise laadimine
  const { data: hk, error: hkErr } = await sb
    .from("hinnakirjad")
    .select("*")
    .eq("id", hinnakirjaId)
    .maybeSingle();
  if (hkErr) return NextResponse.json({ ok: false, error: hkErr.message }, { status: 500 });
  if (!hk) return NextResponse.json({ ok: false, error: "Hinnakirja ei leitud" }, { status: 404 });
  const tarnija = (hk as { tarnija: string }).tarnija;

  // 2. Veel matchimata read
  const { data: readData, error: rErr } = await sb
    .from("hinnakirja_read")
    .select("*")
    .eq("hinnakiri_id", hinnakirjaId)
    .eq("staatus", "matchimata")
    .order("rea_nr", { ascending: true });
  if (rErr) return NextResponse.json({ ok: false, error: rErr.message }, { status: 500 });
  const read = (readData ?? []) as unknown as HinnakirjaReadLite[];

  if (read.length === 0) {
    return NextResponse.json({ ok: true, matchitud: 0, cache_hits: 0, ai_calls: 0, info: "Pole matchimata ridu" });
  }

  // 3. Tarnija_artiklid cache (kiire lookup: tarnija + tarnija_kood)
  const { data: tarnijaArtikleidData } = await sb
    .from("tarnija_artiklid")
    .select("*")
    .eq("tarnija", tarnija);
  const tarnijaArtikleid = (tarnijaArtikleidData ?? []) as unknown as Array<{
    vk_artikkel_id: string;
    tarnija_kood: string | null;
    tarnija_nimetus: string | null;
  }>;
  const cacheByKood = new Map<string, string>();
  for (const ta of tarnijaArtikleid) {
    if (ta.tarnija_kood) cacheByKood.set(ta.tarnija_kood, ta.vk_artikkel_id);
  }

  // 4. Kõik aktiivsed kataloogi artiklid (AI-le konteksti)
  const { data: kataloogData, error: kErr } = await sb
    .from("artiklid")
    .select("*")
    .eq("aktiivne", true)
    .order("kood", { ascending: true });
  if (kErr) return NextResponse.json({ ok: false, error: kErr.message }, { status: 500 });
  const kataloog = (kataloogData ?? []) as unknown as ArtikkelLite[];

  const koodById = new Map<string, ArtikkelLite>();
  for (const a of kataloog) koodById.set(a.kood, a);

  // 5. Ehita kataloogi tekstitabel (osa Claude'i prompti)
  const kataloogText = kataloog
    .map(
      (a) =>
        `${a.kood} | ${a.osa}${a.alamosa ? " / " + a.alamosa : ""} | ${a.nimetus}${
          a.tähis ? " | tähis: " + a.tähis : ""
        }${a.ühik ? " | ühik: " + a.ühik : ""}${a.alt_nimed ? " | sünonüümid: " + a.alt_nimed : ""}`,
    )
    .join("\n");

  const systemText = SYSTEM_HEAD + kataloogText;
  const client = getAnthropic();

  let cacheHits = 0;
  let aiCalls = 0;
  let matched = 0;
  let failed = 0;

  // 6. Iga rea kohta
  for (const rida of read) {
    // 6a. Cache hit (tarnija + tarnija_kood)
    if (rida.tarnija_kood && cacheByKood.has(rida.tarnija_kood)) {
      const vkId = cacheByKood.get(rida.tarnija_kood)!;
      const { error } = await sb
        .from("hinnakirja_read")
        .update({
          vk_artikkel_id: vkId,
          match_confidence: 1.0,
          match_põhjendus: "tarnija_artiklid cache (varasem match)",
          staatus: "matchitud",
        })
        .eq("id", rida.id);
      if (!error) {
        cacheHits++;
        matched++;
      }
      continue;
    }

    // 6b. AI matching
    const userMsg = [
      `Tarnija: ${tarnija}`,
      rida.tarnija_kood ? `Tarnija kood: ${rida.tarnija_kood}` : "Tarnija kood: (puudub)",
      `Tarnija nimetus: ${rida.tarnija_nimetus}`,
      rida.tarnija_brand ? `Brand: ${rida.tarnija_brand}` : "",
      rida.sektsioon ? `Sektsioon PDF-is: ${rida.sektsioon}` : "",
      rida.ühik ? `Ühik: ${rida.ühik}` : "",
    ]
      .filter(Boolean)
      .join("\n");

    try {
      const resp = await client.messages.create({
        model: MATCHING_MODEL,
        max_tokens: 1024,
        system: [
          {
            type: "text",
            text: systemText,
            cache_control: { type: "ephemeral" },
          },
        ],
        tools: [MATCH_TOOL],
        tool_choice: { type: "tool", name: "vali_match" },
        messages: [
          {
            role: "user",
            content: `Leia kataloogist parim vaste järgmisele tarnija reale:\n\n${userMsg}\n\nKasuta tööriista \`vali_match\`.`,
          },
        ],
      });

      const toolBlock = resp.content.find(
        (b): b is Anthropic.Messages.ToolUseBlock => b.type === "tool_use" && b.name === "vali_match",
      );
      if (!toolBlock) {
        failed++;
        continue;
      }

      const input = toolBlock.input as {
        kood: string | null;
        confidence: number;
        põhjendus: string;
      };

      const valitudArtikkel = input.kood ? koodById.get(input.kood) : undefined;
      const vkArtikkelId = valitudArtikkel?.id ?? null;

      await sb
        .from("hinnakirja_read")
        .update({
          vk_artikkel_id: vkArtikkelId,
          match_confidence: input.confidence,
          match_põhjendus: input.põhjendus,
          // matchimata jääb senikaua kuni kasutaja kinnitab
          staatus: "matchimata",
        })
        .eq("id", rida.id);

      aiCalls++;
      if (vkArtikkelId) matched++;
    } catch (err) {
      console.error(`Match error rida ${rida.id}:`, err);
      failed++;
    }
  }

  await sb
    .from("hinnakirjad")
    .update({
      staatus: "matched",
    })
    .eq("id", hinnakirjaId);

  revalidatePath(`/hinnakirjad/${hinnakirjaId}`);
  revalidatePath("/hinnakirjad");

  return NextResponse.json({
    ok: true,
    cache_hits: cacheHits,
    ai_calls: aiCalls,
    soovitatud: matched,
    failed,
    kokku_töödeldud: read.length,
  });
}
