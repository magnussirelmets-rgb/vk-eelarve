require("dotenv").config({ path: ".env.local" });
const { createClient } = require("@supabase/supabase-js");
const sb = createClient(process.env.NEXT_PUBLIC_SUPABASE_URL, process.env.SUPABASE_SERVICE_ROLE_KEY);
(async () => {
  const { data, error } = await sb.from("tootegrupid").select("id, nimi, tüüp, kirjeldus, template_kirjeldus, pakkumise_kirjeldus, garantii_aastad").order("nimi");
  if (error) { console.error(error); process.exit(1); }
  console.log("Kokku grupi:", data.length);
  for (const g of data) {
    const t = g.template_kirjeldus ? `template=${g.template_kirjeldus.slice(0, 40)}…` : "—";
    const garantii = g.garantii_aastad !== null ? `${g.garantii_aastad}a` : "—";
    console.log(`  [${g.tüüp}] ${g.nimi.padEnd(40)} garantii=${garantii} ${t}`);
  }

  console.log("\n--- Hinnakirja_read ühenduvus tootegruppidega ---");
  const { data: links } = await sb.from("hinnakirja_read").select("tootegrupp_id").not("tootegrupp_id", "is", null);
  const counts = {};
  for (const l of links) counts[l.tootegrupp_id] = (counts[l.tootegrupp_id] ?? 0) + 1;
  for (const g of data) {
    const c = counts[g.id] ?? 0;
    if (c > 0) console.log(`  ${g.nimi.padEnd(40)} → ${c} toodet`);
  }
})();
