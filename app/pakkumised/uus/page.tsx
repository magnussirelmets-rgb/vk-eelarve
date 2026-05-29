import Link from "next/link";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { ArrowLeft } from "lucide-react";
import { getServerSupabase } from "@/lib/supabase/server";
import type { Klient, Objekt } from "@/lib/types";
import { UusPakkumineForm } from "./uus-pakkumine-form";

export const dynamic = "force-dynamic";
export const revalidate = 0;

export default async function UusPakkumineLeht() {
  const sb = getServerSupabase();
  const [{ data: kData }, { data: oData }] = await Promise.all([
    sb.from("kliendid").select("*").order("nimi"),
    sb.from("objektid").select("*").order("nimi"),
  ]);
  const kliendid = (kData ?? []) as unknown as Klient[];
  const objektid = (oData ?? []) as unknown as Objekt[];

  return (
    <div className="space-y-6">
      <Button asChild variant="ghost" size="sm" className="-ml-2">
        <Link href="/pakkumised">
          <ArrowLeft className="h-4 w-4" />
          Tagasi pakkumised
        </Link>
      </Button>

      <div>
        <h1 className="text-3xl font-bold tracking-tight text-vk-navy">Uus pakkumine</h1>
        <p className="text-sm text-muted-foreground">
          Loo uus pakkumise mustand. Mahutabeli saad kohe üles laadida või lisada hiljem.
        </p>
      </div>

      <Card>
        <CardHeader>
          <CardTitle>Pakkumise andmed</CardTitle>
          <CardDescription>Tähistatud välju (*) on vaja täita.</CardDescription>
        </CardHeader>
        <CardContent>
          <UusPakkumineForm kliendid={kliendid} objektid={objektid} />
        </CardContent>
      </Card>
    </div>
  );
}
