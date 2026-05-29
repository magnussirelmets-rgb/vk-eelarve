import Link from "next/link";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { ArrowLeft } from "lucide-react";
import { UusKlientForm } from "./uus-klient-form";

export default function UusKlientLeht() {
  return (
    <div className="space-y-6">
      <Button asChild variant="ghost" size="sm" className="-ml-2">
        <Link href="/kliendid">
          <ArrowLeft className="h-4 w-4" />
          Tagasi kliendid
        </Link>
      </Button>
      <div>
        <h1 className="text-3xl font-bold tracking-tight text-vk-navy">Uus klient</h1>
      </div>
      <Card>
        <CardHeader>
          <CardTitle>Kliendi andmed</CardTitle>
          <CardDescription>
            Eraisik = nimi + kontakt. Juriidiline isik = ärinimi + registrikood + KMK nr.
            Pärast loomist saad kliendile lisada objekte.
          </CardDescription>
        </CardHeader>
        <CardContent>
          <UusKlientForm />
        </CardContent>
      </Card>
    </div>
  );
}
