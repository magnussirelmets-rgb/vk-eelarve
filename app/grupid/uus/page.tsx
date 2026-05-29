import Link from "next/link";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { ArrowLeft } from "lucide-react";
import { UusGruppForm } from "./uus-grupp-form";

export default function UusGruppLeht({
  searchParams,
}: {
  searchParams: { tüüp?: string };
}) {
  const isToode = searchParams.tüüp !== "teenus";
  const back = isToode ? "/grupid?tüüp=toode" : "/grupid?tüüp=teenus";

  return (
    <div className="space-y-6">
      <Button asChild variant="ghost" size="sm" className="-ml-2">
        <Link href={back}>
          <ArrowLeft className="h-4 w-4" />
          Tagasi grupid
        </Link>
      </Button>
      <div>
        <h1 className="text-3xl font-bold tracking-tight text-vk-navy">
          {isToode ? "Uus tootegrupp" : "Uus teenus"}
        </h1>
      </div>
      <Card>
        <CardHeader>
          <CardTitle>{isToode ? "Tootegrupi andmed" : "Teenuse andmed"}</CardTitle>
          <CardDescription>
            {isToode
              ? "Seadme-mudelite grupp ühise kirjelduse + garantiiga. Iga mudeli täpne kirjeldus genereeritakse template'ist."
              : "VK enda teenus — paigaldus, hooldus jne. Paigaldusaeg ja kate kanduvad seotud toodete pakkumisse."}
          </CardDescription>
        </CardHeader>
        <CardContent>
          <UusGruppForm />
        </CardContent>
      </Card>
    </div>
  );
}
