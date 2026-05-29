// Faas 1.5: vaata kõik AI tooted (brand="Alpha Innotec") ja grupeeri mudeli järgi
require("dotenv").config({ path: ".env.local" });
const { createClient } = require("@supabase/supabase-js");
const sb = createClient(process.env.NEXT_PUBLIC_SUPABASE_URL, process.env.SUPABASE_SERVICE_ROLE_KEY);

(async () => {
  // Vaata kõiki ridu kus brand = Alpha Innotec
  const { data: rows } = await sb
    .from("hinnakirja_read")
    .select("id, tarnija_nimetus, tarnija_brand, tarnija_kood, sektsioon, ostuhind_neto, ühik, tootegrupp_id, hinnakirjad(tarnija, faili_nimi)")
    .ilike("tarnija_brand", "%alpha%");
  console.log(`Alpha Innoteci tooteid kokku: ${rows?.length ?? 0}`);

  if (!rows || rows.length === 0) {
    // Otsi nimetuse kaudu
    const { data: r2 } = await sb
      .from("hinnakirja_read")
      .select("id, tarnija_nimetus, tarnija_brand, tarnija_kood, sektsioon, ostuhind_neto, ühik, hinnakirjad(tarnija, faili_nimi)")
      .or("tarnija_nimetus.ilike.%SWC%,tarnija_nimetus.ilike.%SWP%,tarnija_nimetus.ilike.%WZS%,tarnija_nimetus.ilike.%LWAV%,tarnija_nimetus.ilike.%LWD%,tarnija_nimetus.ilike.%LWCV%,tarnija_nimetus.ilike.%LWP%");
    console.log(`Otsi SWC/SWP/WZS/LWAV/LWD/LWCV/LWP nimetuse järgi: ${r2?.length ?? 0} rida`);
    for (const r of r2 ?? []) {
      const hk = r.hinnakirjad?.tarnija ? `[${r.hinnakirjad.faili_nimi}]` : "";
      console.log(`  ${(r.tarnija_brand ?? "—").padEnd(15)} ${(r.tarnija_kood ?? "—").padEnd(15)} ${(r.tarnija_nimetus ?? "").slice(0, 70)} ${hk}`);
    }
    return;
  }

  // Grupeeri mudeli-prefiksi järgi
  // Eraldi prefiksid: SWC, SWP, WZS, LWAV, LWD, LWCV, LWP, alpha boiler line jne.
  const prefixGroups = {};
  for (const r of rows) {
    const name = (r.tarnija_nimetus ?? "").trim();
    // Esimene "SWC"/"WZS" tüüpi token, või muu suurtähtede järjend
    const m = name.match(/\b([A-Z]{2,5})(\s*\d|\s*V)/);
    const prefix = m ? m[1] : "(muu)";
    if (!prefixGroups[prefix]) prefixGroups[prefix] = [];
    prefixGroups[prefix].push(r);
  }

  console.log("\n=== Alpha Innoteci tooted prefiksi järgi ===");
  for (const k of Object.keys(prefixGroups).sort()) {
    const list = prefixGroups[k];
    console.log(`\n--- ${k} (${list.length} rida) ---`);
    for (const r of list.slice(0, 15)) {
      const sekt = r.sektsioon ? ` [${r.sektsioon.slice(0, 30)}]` : "";
      const hind = r.ostuhind_neto !== null ? `€${r.ostuhind_neto.toFixed(0).padStart(7)}` : "      —";
      console.log(`  ${hind}  ${(r.tarnija_kood ?? "—").padEnd(15)} ${(r.tarnija_nimetus ?? "").slice(0, 75)}${sekt}`);
    }
    if (list.length > 15) console.log(`  ... ja ${list.length - 15} veel`);
  }
})();
