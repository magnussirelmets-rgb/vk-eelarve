// Faas 1.5: seedib 10 Alpha Innoteci tootegruppi + auto-linkib olemasolevad
// hinnakirja_read read tootegrupp_id'ga + täidab mudel_andmed JSONB'i (kw, mudel).
//
// Re-runable: kasutab nime järgi UPSERT'i — kui grupp eksisteerib, uuendab.
// Linki ainult kui rida pole juba grupis (säilitab käsitsi tehtud seoseid).
require("dotenv").config({ path: ".env.local" });
const { createClient } = require("@supabase/supabase-js");
const sb = createClient(process.env.NEXT_PUBLIC_SUPABASE_URL, process.env.SUPABASE_SERVICE_ROLE_KEY);

const GRUPID = [
  {
    key: "swc-vline",
    nimi: "Alpha Innotec SWC V-Line",
    kirjeldus: "Inverter-juhitavad maaküttepumbad ilma integreeritud boilerita",
    template_kirjeldus:
      "Inverter-tehnoloogiaga maaküttepump {mudel}, {kw} kW võimsusega. COP kuni 4,9. Sobib eramajadele ja kortermajadele, kus boiler paigaldatakse eraldi.",
    pakkumise_kirjeldus:
      "Alpha Innotec {mudel} on V-Line seeria inverter-juhitav maaküttepump nominaalvõimsusega {kw} kW. Moduleeruv võimsus 30-100% (silent boost'iga vaikne ka väikese koormuse korral). CTC compact integratsioonimoodul lihtsustab paigaldust. Ilma integreeritud boilerita — saab kombineerida vajaliku mahuga sooja tarbevee boileriga.",
    garantii_aastad: 5,
    paigaldusaeg_h_ühik: 16,
  },
  {
    key: "swc-vline-k",
    nimi: "Alpha Innotec SWC V-Line (K) — inverter + passiivjahutus",
    kirjeldus: "Inverter + passiivjahutusega maaküttepumbad",
    template_kirjeldus:
      "Inverter-tehnoloogiaga maaküttepump {mudel}, {kw} kW võimsusega, sisemise passiivjahutuse funktsiooniga (K). Suvise jahutuse jaoks ei vaja eraldi seadet.",
    pakkumise_kirjeldus:
      "Alpha Innotec {mudel} on V-Line seeria inverter-juhitav maaküttepump koos passiivjahutuse funktsiooniga. Nominaalvõimsus {kw} kW küttel; suvel kasutatakse maasoojuse külma kontuuri ruumide jahutamiseks. Sobib põrandakütte- ja seinapaneeli süsteemidele.",
    garantii_aastad: 5,
    paigaldusaeg_h_ühik: 18,
  },
  {
    key: "swc-onoff",
    nimi: "Alpha Innotec SWC — on-off maaküttepumbad",
    kirjeldus: "On-off juhitavad maaküttepumbad ilma boilerita",
    template_kirjeldus:
      "On-off maaküttepump {mudel}, {kw} kW võimsusega. COP kuni 4,7. Lihtne ja töökindel lahendus.",
    pakkumise_kirjeldus:
      "Alpha Innotec {mudel} on traditsioonilise on-off juhtimisega maaküttepump nominaalvõimsusega {kw} kW. Kompaktne korpus, lihtne paigaldus. Sobib hoonetele, kus küttekoormuse muutuvus on väike.",
    garantii_aastad: 5,
    paigaldusaeg_h_ühik: 14,
  },
  {
    key: "wzs-vline",
    nimi: "Alpha Innotec WZS V-Line — inverter + 180L boiler",
    kirjeldus: "Inverter maaküttepumbad integreeritud 180L tarbeveeboileriga",
    template_kirjeldus:
      "Inverter-maaküttepump {mudel} integreeritud 180L tarbeveeboileriga, võimsus {kw} kW. COP kuni 4,9. Üks kompaktne seade kogu majale.",
    pakkumise_kirjeldus:
      "Alpha Innotec {mudel} on V-Line seeria inverter-maaküttepump koos integreeritud 180L tarbeveeboileriga. Nominaalvõimsus {kw} kW küttel. Tarbevesi soojendatakse soojuspumbaga, vajadusel ka elektriküttekehaga. Kompaktne — kogu süsteem ühes seadmes.",
    garantii_aastad: 5,
    paigaldusaeg_h_ühik: 14,
  },
  {
    key: "wzs-vline-k",
    nimi: "Alpha Innotec WZS V-Line (K) — inverter + jahutus + 180L",
    kirjeldus: "Inverter + passiivjahutus + 180L boileriga maaküttepumbad",
    template_kirjeldus:
      "Inverter-maaküttepump {mudel}, {kw} kW, integreeritud 180L tarbeveeboileri ja passiivjahutuse funktsiooniga (K). Köögist saunani — küte, kuum vesi ja jahutus ühest seadmest.",
    pakkumise_kirjeldus:
      "Alpha Innotec {mudel} on V-Line seeria täisvarustuses maaküttepump: inverter-juhitav kompressor ({kw} kW küttel), integreeritud 180L tarbeveeboiler ja sisemine passiivjahutusring. Suviselt jahutab põrandakütte abil ruume ilma kompressori tööta — väga ökonoomne.",
    garantii_aastad: 5,
    paigaldusaeg_h_ühik: 16,
  },
  {
    key: "wzs-onoff",
    nimi: "Alpha Innotec WZS — on-off + 180L boiler",
    kirjeldus: "On-off maaküttepumbad integreeritud 180L tarbeveeboileriga",
    template_kirjeldus:
      "On-off maaküttepump {mudel}, {kw} kW, integreeritud 180L tarbeveeboileriga. Lihtne ja töökindel lahendus eramajale.",
    pakkumise_kirjeldus:
      "Alpha Innotec {mudel} on klassikaline on-off juhtimisega maaküttepump nominaalvõimsusega {kw} kW koos integreeritud 180L tarbeveeboileriga. Üks seade kogu maja kütte ja sooja vee tootmiseks. Sobib hoonetele, kus küttekoormuse muutuvus on väike.",
    garantii_aastad: 5,
    paigaldusaeg_h_ühik: 12,
  },
  {
    key: "wzs-r290",
    nimi: "Alpha Innotec WZS V-Line R290 — propaani külmaainega",
    kirjeldus: "Looduspärase R290 (propaan) külmaainega maaküttepumbad",
    template_kirjeldus:
      "Looduspärase külmaainega (R290 propaan) maaküttepump {mudel}, võimsus {kw} kW. Madal GWP (3) — tulevikukindel valik EU regulatsioonide vastu. Integreeritud 180L boileriga.",
    pakkumise_kirjeldus:
      "Alpha Innotec {mudel} kasutab külmaainena propaani (R290), mille GWP on vaid 3 (vs traditsiooniliste F-gaaside 1000-2000). Tagab vastavuse EU F-gaaside määruse 2024 nõuetele ka tulevikus. Inverter-juhitav, nominaalvõimsus {kw} kW, integreeritud 180L tarbeveeboiler.",
    garantii_aastad: 5,
    paigaldusaeg_h_ühik: 16,
  },
  {
    key: "swp",
    nimi: "Alpha Innotec SWP — tööstuslikud on-off maaküttepumbad",
    kirjeldus: "Suurema võimsusega tööstuslikud maaküttepumbad",
    template_kirjeldus:
      "Tööstuslik on-off maaküttepump {mudel}, {kw} kW võimsusega. Robustne konstruktsioon kortermajadele, kommertshoonetele ja tööstusobjektidele.",
    pakkumise_kirjeldus:
      "Alpha Innotec {mudel} on tööstusliku klassi maaküttepump nominaalvõimsusega {kw} kW. Sobib kortermajade, koolide, lasteaedade, hotellide ja muude suure küttekoormusega hoonete jaoks. Töökindel kompressor, kõrge tarbevee temperatuur kuni 70°C (H-mudelid).",
    garantii_aastad: 5,
    paigaldusaeg_h_ühik: 28,
  },
  {
    key: "sw",
    nimi: "Alpha Innotec SW — suurema võimsusega maaküttepumbad",
    kirjeldus: "20-30 kW võimsusega on-off maaküttepumbad",
    template_kirjeldus:
      "On-off maaküttepump {mudel}, {kw} kW võimsusega. Suuremate eramajade ja väikeste kortermajade jaoks.",
    pakkumise_kirjeldus:
      "Alpha Innotec {mudel} on suurema võimsusega ({kw} kW) on-off maaküttepump. Sobib suurte eramajade, kahekorruseliste hoonete, väikeste kortermajade ja kommertshoonete jaoks. Robustne mehaaniline konstruktsioon, lihtne hooldus.",
    garantii_aastad: 5,
    paigaldusaeg_h_ühik: 22,
  },
  {
    key: "wwb",
    nimi: "Alpha Innotec WWB — tarbevee soojuspumbad",
    kirjeldus: "Õhk-vesi tarbevee soojuspumbad sooja vee tootmiseks",
    template_kirjeldus:
      "Tarbevee soojuspump {mudel}, {maht}L tarbeveeboileriga. Sooja vee tootmine ilma keskkütte süsteemita.",
    pakkumise_kirjeldus:
      "Alpha Innotec {mudel} on iseseisev tarbevee soojuspump koos {maht}L tarbeveeboileriga. Sobib hoonetele, kus puudub keskküttesüsteem või kus tarbevee soojendamine elektriküttekehaga on liiga kallis. Töötab tehnilise ruumi õhuga (4-35°C).",
    garantii_aastad: 5,
    paigaldusaeg_h_ühik: 6,
  },
];

// Tuvasta grupp rea nimetuse + sektsiooni järgi
function classifyRow(name, sektsioon) {
  const sekt = sektsioon ?? "";
  const isLisavarustus = sekt.includes("LISAVARUSTUS");
  const isTarbevesi = sekt.includes("TARBEVESI");
  if (isLisavarustus || /\b(LUX|FSW|RBE\+|Alpha Connect|distants)\b/.test(name)) return null;
  if (isTarbevesi || /\bWWB\b/.test(name)) return "wwb";
  if (/R290/.test(name)) return "wzs-r290";

  const isK = /\(K\)/.test(name);
  const isVLine = /V-Line/.test(name);
  const swc = /\bSWC\b/.test(name);
  const wzs = /\bWZS\b/.test(name);
  const swp = /\bSWP\b/.test(name);
  const sw = /\bSW\b\s+\d/.test(name) && !swc && !swp;

  if (swp) return "swp";
  if (sw) return "sw";
  if (swc) {
    if (isVLine && isK) return "swc-vline-k";
    if (isVLine) return "swc-vline";
    return "swc-onoff";
  }
  if (wzs) {
    if (isVLine && isK) return "wzs-vline-k";
    if (isVLine) return "wzs-vline";
    return "wzs-onoff";
  }
  return null;
}

// Eralda kW väärtus mudeli koodist (nt "SWC 82" → 8, "WZS 162 V-Line" → 16, "SWP 451" → 45)
function extractKw(name) {
  const m = name.match(/(?:SWC|WZS|SWP|SW|WWB)\s+(\d{2,3})/);
  if (!m) return null;
  const numStr = m[1];
  // Viimane number on revisioonimärk (mostly "2", vahel "1"). Eemalda see.
  if (numStr.length < 2) return null;
  const kw = parseInt(numStr.slice(0, -1), 10);
  return Number.isFinite(kw) ? kw : null;
}

// Eralda puhas mudel ilma sufiks "[LISAVARUSTUS...]" jne
function extractMudel(name) {
  return name.replace(/\s*\[.*?\]\s*$/, "").trim();
}

// Eralda boileri maht (ainult WWB seeria — 190L jne)
function extractMaht(name) {
  const m = name.match(/WWB\s+(\d{2,3})/);
  return m ? parseInt(m[1], 10) : null;
}

(async () => {
  console.log("=== Faas 1.5 seedimine ===\n");

  // 1. UPSERT 10 tootegruppi nime järgi
  const grupiIdMap = new Map(); // key → tootegrupp_id
  for (const g of GRUPID) {
    const { data: existing } = await sb
      .from("tootegrupid")
      .select("id")
      .eq("nimi", g.nimi)
      .maybeSingle();

    const payload = {
      nimi: g.nimi,
      tüüp: "toode",
      kirjeldus: g.kirjeldus,
      template_kirjeldus: g.template_kirjeldus,
      pakkumise_kirjeldus: g.pakkumise_kirjeldus,
      garantii_aastad: g.garantii_aastad,
      paigaldusaeg_h_ühik: g.paigaldusaeg_h_ühik,
    };

    if (existing) {
      const { error } = await sb.from("tootegrupid").update(payload).eq("id", existing.id);
      if (error) {
        console.error(`✗ Update ebaõnnestus "${g.nimi}":`, error.message);
        continue;
      }
      grupiIdMap.set(g.key, existing.id);
      console.log(`✓ Uuendatud: ${g.nimi}`);
    } else {
      const { data, error } = await sb.from("tootegrupid").insert(payload).select("id").single();
      if (error || !data) {
        console.error(`✗ Insert ebaõnnestus "${g.nimi}":`, error?.message);
        continue;
      }
      grupiIdMap.set(g.key, data.id);
      console.log(`✓ Loodud:   ${g.nimi}`);
    }
  }

  console.log(`\n  Kokku ${grupiIdMap.size}/${GRUPID.length} gruppi DB-s.\n`);

  // 2. Loe kõik Alpha Innoteci read, klassifitseeri, uuenda tootegrupp_id + mudel_andmed
  const { data: rows, error: rowsErr } = await sb
    .from("hinnakirja_read")
    .select("id, tarnija_nimetus, tarnija_brand, tarnija_kood, sektsioon, ühik, tootegrupp_id, staatus")
    .ilike("tarnija_brand", "%alpha%");
  if (rowsErr) {
    console.error("Read laadimine ebaõnnestus:", rowsErr.message);
    return;
  }

  console.log(`Töötlen ${rows.length} Alpha Innoteci rida...\n`);

  const stats = { linked: 0, skipped: 0, alreadyLinked: 0, noMatch: 0 };
  const unmatched = [];

  for (const r of rows) {
    const key = classifyRow(r.tarnija_nimetus ?? "", r.sektsioon ?? "");
    if (!key) {
      stats.noMatch++;
      unmatched.push(`  · ${r.tarnija_nimetus} (sektsioon=${r.sektsioon ?? "—"})`);
      continue;
    }
    const tootegrupp_id = grupiIdMap.get(key);
    if (!tootegrupp_id) {
      stats.skipped++;
      continue;
    }

    const kw = extractKw(r.tarnija_nimetus ?? "");
    const mudel = extractMudel(r.tarnija_nimetus ?? "");
    const maht = extractMaht(r.tarnija_nimetus ?? "");
    const mudel_andmed = { kw, mudel };
    if (maht !== null) mudel_andmed.maht = maht;

    // Säilita kasutaja ignoreeritud/kinnitatud staatus; vaid matchimata → matched
    const update = { tootegrupp_id, mudel_andmed };
    if (r.staatus === "matchimata" || r.staatus === null) {
      update.staatus = "matchitud";
    }
    const { error } = await sb.from("hinnakirja_read").update(update).eq("id", r.id);

    if (error) {
      console.error(`✗ Update viga "${r.tarnija_nimetus}":`, error.message);
      stats.skipped++;
    } else {
      if (r.tootegrupp_id) stats.alreadyLinked++;
      else stats.linked++;
    }
  }

  console.log("=== Tulemused ===");
  console.log(`  Uued lingid:        ${stats.linked}`);
  console.log(`  Juba olid linkitud: ${stats.alreadyLinked} (uuendatud mudel_andmed)`);
  console.log(`  Klassifitseerimata: ${stats.noMatch}`);
  console.log(`  Viga / vahele:      ${stats.skipped}`);

  if (unmatched.length > 0) {
    console.log(`\nKlassifitseerimata read (jäeti puutumata):`);
    for (const u of unmatched.slice(0, 20)) console.log(u);
    if (unmatched.length > 20) console.log(`  ... ja ${unmatched.length - 20} veel`);
  }

  // 3. Lugumiseks: mis gruppides mitu rida on
  console.log("\n=== Lõplik jaotus ===");
  for (const g of GRUPID) {
    const id = grupiIdMap.get(g.key);
    if (!id) continue;
    const { count } = await sb
      .from("hinnakirja_read")
      .select("id", { count: "exact", head: true })
      .eq("tootegrupp_id", id);
    console.log(`  ${g.nimi.padEnd(60)} ${count ?? 0} rida`);
  }
})();
