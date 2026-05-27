import { config } from "dotenv";
import { createClient } from "@supabase/supabase-js";
import path from "node:path";

config({ path: path.resolve(process.cwd(), ".env.local") });
const sb = createClient(process.env.NEXT_PUBLIC_SUPABASE_URL!, process.env.SUPABASE_SERVICE_ROLE_KEY!);

async function main() {
  const artikkelId = "da57783e-bd7b-4682-9e45-b97bb5be69f4";
  const { data: art } = await sb.from("artiklid").select("*").eq("id", artikkelId).single();
  console.log("Artikkel:", art?.kood, "-", art?.nimetus);
  const { data: hinnad } = await sb.from("hinnad").select("*").eq("artikkel_id", artikkelId).order("loodud", { ascending: false }).limit(10);
  console.log("Hinnad (uusim eespool):");
  for (const h of hinnad ?? []) {
    console.log("  kehtib=", h.kehtib_alates, "ostu=", h.ostuhind_neto, "töö=", h["töö_h_ühik"], "märkused=", h["märkused"]);
  }
}
main();
