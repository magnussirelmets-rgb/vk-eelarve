import Link from "next/link";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { ArrowLeft } from "lucide-react";
import { UusGruppForm } from "./uus-grupp-form";

export default function UusTeenusLeht() {
  return (
    <div className="space-y-6">
      <Button asChild variant="ghost" size="sm" className="-ml-2">
        <Link href="/grupid">
          <ArrowLeft className="h-4 w-4" />
          Tagasi teenused
        </Link>
      </Button>
      <div>
        <h1 className="text-3xl font-bold tracking-tight text-vk-navy">Uus teenus</h1>
      </div>
      <Card>
        <CardHeader>
          <CardTitle>Teenuse andmed</CardTitle>
          <CardDescription>
            VK enda teenused mida tuuakse pakkumistesse — paigaldus, hooldus, komplekttööd jne.
            Paigaldusaeg ja kate kanduvad teenusega seotud toodete arvutamisele pakkumisel.
          </CardDescription>
        </CardHeader>
        <CardContent>
          <UusGruppForm />
        </CardContent>
      </Card>
    </div>
  );
}
