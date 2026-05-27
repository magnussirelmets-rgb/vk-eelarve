import Link from "next/link";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { ArrowLeft } from "lucide-react";
import { UploadForm } from "./upload-form";
import { getServerSupabase } from "@/lib/supabase/server";
import { TARNIJAD } from "@/lib/types";

export const dynamic = "force-dynamic";

export default async function UusHinnakiriPage() {
  // Lae varem kasutatud tarnijad (custom nimedega, mida pole TARNIJAD enumis)
  const sb = getServerSupabase();
  const { data } = await sb.from("hinnakirjad").select("tarnija");
  const olemasolevad = new Set<string>(TARNIJAD as readonly string[]);
  const lisatud = new Set<string>();
  for (const r of (data ?? []) as Array<{ tarnija: string }>) {
    const t = r.tarnija?.trim();
    if (t && !olemasolevad.has(t)) lisatud.add(t);
  }
  const eelnevadTarnijad = Array.from(lisatud).sort((a, b) => a.localeCompare(b));

  return (
    <div className="space-y-6">
      <Button asChild variant="ghost" size="sm" className="-ml-2">
        <Link href="/hinnakirjad">
          <ArrowLeft className="h-4 w-4" />
          Tagasi hinnakirjade nimekirja
        </Link>
      </Button>

      <div>
        <h1 className="text-3xl font-bold tracking-tight text-vk-navy">Uus hinnakiri</h1>
        <p className="text-sm text-muted-foreground">
          Lae üles tarnija hinnakirja fail. Claude (Sonnet 4.6) parsib selle automaatselt struktureeritud
          ridadeks. Pärast parsimist saad iga rea matchida VK kataloogi artikliga.
        </p>
      </div>

      <Card>
        <CardHeader>
          <CardTitle>Faili andmed</CardTitle>
          <CardDescription>
            Tähistatud välju (*) on vaja täita. Fail laetakse Supabase Storage&apos;isse (privaatne).
          </CardDescription>
        </CardHeader>
        <CardContent>
          <UploadForm eelnevadTarnijad={eelnevadTarnijad} />
        </CardContent>
      </Card>
    </div>
  );
}
