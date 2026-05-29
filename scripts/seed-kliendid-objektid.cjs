// Faas A.3: deduplitseeri olemasolevad pakkumised → kliendid + objektid tabelitesse.
//
// Dedup-võti:
//   klient = (lower(tellija_nimi), lower(tellija_email), telefon) — sama nimi/email/telefon = sama klient
//   objekt = (klient_id, lower(objekt), lower(projekti_nr || "")) — sama objekt + projekti_nr ühel kliendil = sama objekt
//
// Olemasolevaid kliendi/objekti ridu EI puudutata (re-runable, idempotent).
// pakkumised.klient_id + objekt_id täidetakse leitud/loodud ID-dega.
// Pakkumiste tellija_* ja objekt string-väljad jäävad alles (snapshot).
require("dotenv").config({ path: ".env.local" });
const { createClient } = require("@supabase/supabase-js");
const sb = createClient(process.env.NEXT_PUBLIC_SUPABASE_URL, process.env.SUPABASE_SERVICE_ROLE_KEY);

function normNimi(s) {
  return (s ?? "").trim().toLowerCase();
}
function normTel(s) {
  return (s ?? "").replace(/[\s\-()]/g, "").trim();
}

(async () => {
  // 1. Lae kõik pakkumised
  const { data: pakk, error: pErr } = await sb
    .from("pakkumised")
    .select("id, vkp_nr, tellija_nimi, tellija_email, tellija_telefon, objekt, projekti_nr, klient_id, objekt_id")
    .order("loodud");
  if (pErr) {
    console.error("pakkumised laadimine:", pErr.message);
    process.exit(1);
  }
  console.log(`=== Faas A.3 andmemigratsioon ===`);
  console.log(`Leitud ${pakk.length} pakkumist.\n`);

  if (pakk.length === 0) {
    console.log("Pakkumisi pole — pole midagi migreerida.");
    return;
  }

  // 2. Lae olemasolevad kliendid + objektid (et mitte duplitseerida)
  const { data: kliendid } = await sb.from("kliendid").select("id, nimi, email, telefon");
  const { data: objektid } = await sb
    .from("objektid")
    .select("id, klient_id, nimi, projekti_nr");

  // Lookup mapid
  const klientByKey = new Map();
  for (const k of kliendid ?? []) {
    const key = `${normNimi(k.nimi)}|${normNimi(k.email)}|${normTel(k.telefon)}`;
    klientByKey.set(key, k.id);
  }
  const objektByKey = new Map();
  for (const o of objektid ?? []) {
    const key = `${o.klient_id}|${normNimi(o.nimi)}|${normNimi(o.projekti_nr)}`;
    objektByKey.set(key, o.id);
  }

  const stats = { kliendidLoodud: 0, objektidLoodud: 0, pakkUuendatud: 0, skipped: 0 };

  for (const p of pakk) {
    // Kui juba mõlemad seotud, jäta vahele
    if (p.klient_id && p.objekt_id) {
      stats.skipped++;
      continue;
    }

    const tellijaNimi = (p.tellija_nimi ?? "").trim();
    if (!tellijaNimi) {
      console.log(`  · ${p.vkp_nr} — pole tellija_nimi, jäta vahele`);
      stats.skipped++;
      continue;
    }

    // -- 2a. Klient
    let klient_id = p.klient_id;
    if (!klient_id) {
      const klientKey = `${normNimi(tellijaNimi)}|${normNimi(p.tellija_email)}|${normTel(p.tellija_telefon)}`;
      klient_id = klientByKey.get(klientKey);
      if (!klient_id) {
        const { data: created, error } = await sb
          .from("kliendid")
          .insert({
            nimi: tellijaNimi,
            tüüp: "eraisik", // vaikimisi — Magnus saab UI'st muuta
            email: p.tellija_email?.trim() || null,
            telefon: p.tellija_telefon?.trim() || null,
          })
          .select("id")
          .single();
        if (error || !created) {
          console.error(`  ✗ Klient "${tellijaNimi}":`, error?.message);
          continue;
        }
        klient_id = created.id;
        klientByKey.set(klientKey, klient_id);
        stats.kliendidLoodud++;
        console.log(`  ✓ Klient loodud: ${tellijaNimi}`);
      }
    }

    // -- 2b. Objekt
    let objekt_id = p.objekt_id;
    if (!objekt_id) {
      const objektNimi = (p.objekt ?? "(määramata objekt)").trim();
      const projNr = p.projekti_nr?.trim() || null;
      const objektKey = `${klient_id}|${normNimi(objektNimi)}|${normNimi(projNr)}`;
      objekt_id = objektByKey.get(objektKey);
      if (!objekt_id) {
        const { data: created, error } = await sb
          .from("objektid")
          .insert({
            klient_id,
            nimi: objektNimi,
            aadress: null,
            projekti_nr: projNr,
          })
          .select("id")
          .single();
        if (error || !created) {
          console.error(`  ✗ Objekt "${objektNimi}" (klient=${tellijaNimi}):`, error?.message);
          continue;
        }
        objekt_id = created.id;
        objektByKey.set(objektKey, objekt_id);
        stats.objektidLoodud++;
        console.log(`    ✓ Objekt loodud: ${objektNimi} ${projNr ? `(${projNr})` : ""}`);
      }
    }

    // -- 2c. Uuenda pakkumine
    const { error: uErr } = await sb
      .from("pakkumised")
      .update({ klient_id, objekt_id })
      .eq("id", p.id);
    if (uErr) {
      console.error(`  ✗ Pakkumise update ${p.vkp_nr}:`, uErr.message);
    } else {
      stats.pakkUuendatud++;
    }
  }

  console.log(`\n=== Tulemused ===`);
  console.log(`  Kliente loodud:    ${stats.kliendidLoodud}`);
  console.log(`  Objekte loodud:    ${stats.objektidLoodud}`);
  console.log(`  Pakkumisi seotud:  ${stats.pakkUuendatud}`);
  console.log(`  Skipped:           ${stats.skipped}`);

  // 3. Verifikatsioon
  const { count: kliendidKokku } = await sb
    .from("kliendid")
    .select("id", { count: "exact", head: true });
  const { count: objektidKokku } = await sb
    .from("objektid")
    .select("id", { count: "exact", head: true });
  const { count: seotudPakk } = await sb
    .from("pakkumised")
    .select("id", { count: "exact", head: true })
    .not("klient_id", "is", null);
  console.log(`\nDB seis:`);
  console.log(`  kliendid kokku:        ${kliendidKokku}`);
  console.log(`  objektid kokku:        ${objektidKokku}`);
  console.log(`  seotud pakkumised:     ${seotudPakk} / ${pakk.length}`);
})();
