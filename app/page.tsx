import Link from "next/link";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { ArrowRight, BookOpen, FileText, Receipt, Settings } from "lucide-react";

const cards = [
  {
    href: "/kataloog",
    title: "Kataloog",
    description: "VK artiklite andmebaas — hinnad, töötunnid, ajalugu",
    icon: BookOpen,
  },
  {
    href: "/hinnakirjad",
    title: "Hinnakirjad",
    description: "Tarnijate PDF/Excel hinnakirjad — laadi üles, AI parsib",
    icon: Receipt,
  },
  {
    href: "/pakkumised",
    title: "Pakkumised",
    description: "Peatöövõtja pakkumised — mahutabel → hinnastamine → PDF",
    icon: FileText,
  },
  {
    href: "/seaded",
    title: "Seaded",
    description: "Tunnitasu, kate-koefitsient, KM määr",
    icon: Settings,
  },
];

export default function HomePage() {
  return (
    <div className="space-y-8">
      <div>
        <h1 className="text-3xl font-bold tracking-tight text-vk-navy">Tere, Magnus!</h1>
        <p className="mt-2 text-muted-foreground">
          Viru Küte pakkumiste süsteem. Vali allpool, kuhu liikuda.
        </p>
      </div>

      <div className="grid gap-4 sm:grid-cols-2">
        {cards.map((c) => (
          <Link key={c.href} href={c.href}>
            <Card className="h-full transition-shadow hover:shadow-md">
              <CardHeader>
                <div className="flex items-center justify-between">
                  <div className="grid h-10 w-10 place-items-center rounded-md bg-vk-blue/10 text-vk-blue">
                    <c.icon className="h-5 w-5" />
                  </div>
                  <ArrowRight className="h-4 w-4 text-muted-foreground" />
                </div>
                <CardTitle className="mt-3">{c.title}</CardTitle>
                <CardDescription>{c.description}</CardDescription>
              </CardHeader>
              <CardContent />
            </Card>
          </Link>
        ))}
      </div>
    </div>
  );
}
