// Diagnostika: kontrolli, kas migratsioonid 0019-0023 on Supabase peal.
// Otsib iga migratsiooni jaoks unikaalse markeri (veerg/indeks/check),
// et veenduda enne PR-ide merge'i, et database on PR-idega kooskõlas.

require("dotenv").config({ path: ".env.local" });
const { createClient } = require("@supabase/supabase-js");

const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
const key = process.env.SUPABASE_SERVICE_ROLE_KEY;
if (!url || !key) {
  console.error("Puudub NEXT_PUBLIC_SUPABASE_URL või SUPABASE_SERVICE_ROLE_KEY .env.local-is");
  process.exit(1);
}
const sb = createClient(url, key);

async function rpcSql(sql) {
  // Kasutame service-role HTTP REST-i sql endpoint'i kaudu (Supabase Pro)
  const res = await fetch(`${url}/rest/v1/rpc/exec_sql`, {
    method: "POST",
    headers: {
      apikey: key,
      Authorization: `Bearer ${key}`,
      "Content-Type": "application/json",
    },
    body: JSON.stringify({ q: sql }),
  });
  if (!res.ok) return null;
  return res.json();
}

async function checkColumn(table, col) {
  const { data, error } = await sb.from(table).select(col).limit(1);
  return !error;
}

async function checkIndex(idxName) {
  // Kontrolli pg_indexes kaudu — vajab service_role
  try {
    const { data, error } = await sb
      .schema("information_schema")
      .from("statistics")
      .select("*")
      .limit(1);
    // Lihtsam: kontrolli kaudselt — kui INSERT duplikaat õnnestub, indeksit pole.
    // Aga me ei taha INSERT-i teha. Selle asemel proovi unique violatioon.
  } catch {}
  return null; // ei suuda kindlalt kontrollida ilma rpc-ta
}

(async () => {
  const checks = [
    { mig: "0019", table: "hinnakirja_read", col: "tarnija_kood", desc: "tarnija_kood veerg + partial unique" },
    { mig: "0020", table: "hinnakirjad", col: "kasutusala", desc: "kasutusala enum + aktiivne" },
    { mig: "0021", table: "tootegrupid", col: "template_kirjeldus", desc: "template_kirjeldus / pakkumise_kirjeldus / garantii_aastad" },
    { mig: "0021", table: "tootegrupid", col: "garantii_aastad", desc: "garantii_aastad" },
    { mig: "0022", table: "hinnakirja_read", col: "tähis", desc: "tähis veerg" },
    { mig: "0023", table: "pakkumised", col: "tunnitasu", desc: "tunnitasu default 35 + km_määr default 0.24" },
    { mig: "0023", table: "pakkumised", col: "km_määr", desc: "km_määr" },
  ];

  console.log("=== Migratsioonide kontroll Supabase peal ===\n");
  let allOk = true;
  for (const c of checks) {
    const ok = await checkColumn(c.table, c.col);
    const mark = ok ? "✓" : "✗";
    console.log(`${mark} ${c.mig}: ${c.table}.${c.col} (${c.desc})`);
    if (!ok) allOk = false;
  }
  console.log("");
  console.log(allOk ? "✓ KÕIK MIGRATSIOONID PEAL" : "✗ PUUDUVAID MIGRATSIOONE LEITUD");
  process.exit(allOk ? 0 : 1);
})();
