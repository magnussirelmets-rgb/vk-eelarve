import Link from "next/link";
import { cn } from "@/lib/utils";

const navItems = [
  { href: "/", label: "Avaleht" },
  { href: "/kataloog", label: "Kataloog" },
  { href: "/grupid", label: "Teenused" },
  { href: "/komplektid", label: "Komplektid" },
  { href: "/hinnakirjad", label: "Hinnakirjad" },
  { href: "/pakkumised", label: "Pakkumised" },
  { href: "/seaded", label: "Seaded" },
];

export function Header() {
  return (
    <header className="border-b bg-vk-navy text-white print:hidden">
      <div className="container flex h-16 items-center justify-between">
        <Link href="/" className="flex items-center gap-3">
          <div className="grid h-9 w-9 place-items-center rounded bg-vk-red font-bold leading-none">VK</div>
          <div className="leading-tight">
            <div className="text-base font-semibold">Viru Küte</div>
            <div className="text-xs text-white/70">Eelarve süsteem</div>
          </div>
        </Link>
        <nav className="flex items-center gap-1">
          {navItems.map((item) => (
            <Link
              key={item.href}
              href={item.href}
              className={cn(
                "rounded px-3 py-2 text-sm font-medium transition-colors hover:bg-white/10",
              )}
            >
              {item.label}
            </Link>
          ))}
        </nav>
      </div>
    </header>
  );
}
