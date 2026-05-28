#!/usr/bin/env node
/**
 * Smoke-test migratsiooni jaoks — kontrollib et veerg eksisteerib + insert/select/delete tsükkel töötab.
 *
 * Kasutus: node scripts/smoke-test-migration.cjs <tabel> <veerg> [näide-väärtus]
 * Näide:   node scripts/smoke-test-migration.cjs hinnakirja_read kirjeldus "Test toote kirjeldus"
 *
 * Eeldab .env.local-i NEXT_PUBLIC_SUPABASE_URL + SUPABASE_SERVICE_ROLE_KEY.
 * Loob ja kustutab automaatselt test-andmed (cascade kustutuse abil).
 */
const { createClient } = require("@supabase/supabase-js");
const { readFileSync } = require("node:fs");
const { resolve } = require("node:path");

const [, , tabel, veerg, näide = "smoke-test-väärtus"] = process.argv;
if (!tabel || !veerg) {
  console.error("Kasutus: node scripts/smoke-test-migration.cjs <tabel> <veerg> [näide-väärtus]");
  process.exit(1);
}

const env = readFileSync(resolve(__dirname, "..", ".env.local"), "utf-8");
const cfg = {};
for (const line of env.split("\n")) {
  const m = line.match(/^(\w+)=(.*)$/);
  if (m) cfg[m[1]] = m[2].replace(/^["']|["']$/g, "");
}
const sb = createClient(cfg.NEXT_PUBLIC_SUPABASE_URL, cfg.SUPABASE_SERVICE_ROLE_KEY);

(async () => {
  console.log(`Smoke test: ${tabel}.${veerg}`);

  // Erikäsitlus: hinnakirja_read vajab parent hinnakirja
  let parentId = null;
  let parentTabel = null;
  if (tabel === "hinnakirja_read") {
    const { data, error } = await sb
      .from("hinnakirjad")
      .insert({
        tarnija: "SMOKE_TEST_DELETEME",
        faili_path: null,
        faili_nimi: null,
        faili_tüüp: "manual",
        staatus: "kinnitatud",
      })
      .select("id")
      .single();
    if (error) {
      console.error("FAIL parent hinnakirja insert:", error.message);
      process.exit(1);
    }
    parentId = data.id;
    parentTabel = "hinnakirjad";
    console.log(`  1. Loodud parent hinnakiri: ${parentId.slice(0, 8)}`);
  }

  // Insert
  const insertObj = { [veerg]: näide };
  if (tabel === "hinnakirja_read") {
    insertObj.hinnakiri_id = parentId;
    insertObj.tarnija_nimetus = "Smoke Test Toode";
    insertObj.staatus = "kinnitatud";
  }
  const { data: row, error: insErr } = await sb.from(tabel).insert(insertObj).select(`id, ${veerg}`).single();
  if (insErr) {
    console.error(`FAIL insert ${tabel}.${veerg}:`, insErr.message);
    if (parentId) await sb.from(parentTabel).delete().eq("id", parentId);
    process.exit(1);
  }
  console.log(`  2. INSERT: ${tabel}.${veerg} = "${String(row[veerg]).slice(0, 60)}"`);

  // Select
  const { data: sel, error: selErr } = await sb.from(tabel).select(`id, ${veerg}`).eq("id", row.id).single();
  if (selErr || sel[veerg] !== row[veerg]) {
    console.error("FAIL select / mismatch:", selErr?.message);
    process.exit(1);
  }
  console.log(`  3. SELECT match ✓`);

  // Cleanup
  if (parentId) {
    await sb.from(parentTabel).delete().eq("id", parentId);
    const { data: verify } = await sb.from(tabel).select("id").eq("id", row.id).maybeSingle();
    console.log(`  4. Cascade delete: rida ${verify ? "JÄÄNUD ALLES (PROBLEEM!)" : "kustutatud ✓"}`);
  } else {
    await sb.from(tabel).delete().eq("id", row.id);
    console.log(`  4. DELETE ✓`);
  }
  console.log(`\n✅ Smoke test ${tabel}.${veerg} PASSED`);
})().catch((e) => {
  console.error("VIGA:", e);
  process.exit(1);
});
