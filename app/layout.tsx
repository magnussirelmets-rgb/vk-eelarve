import type { Metadata } from "next";
import { Header } from "@/components/header";
import "./globals.css";

export const metadata: Metadata = {
  title: "VK Eelarve",
  description: "Viru Küte sisemine pakkumiste süsteem",
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="et">
      <body className="min-h-screen bg-background antialiased">
        <Header />
        <main className="container py-8">{children}</main>
      </body>
    </html>
  );
}
