"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { useState, useTransition } from "react";
import { Button } from "@/components/ui/button";
import { ExternalLink, X, Loader2 } from "lucide-react";
import { ignoreRida, tagastaRida } from "../actions";

type Props = {
  reaId: string;
  reaStaatus: string;
};

export function RowActions({ reaId, reaStaatus }: Props) {
  const router = useRouter();
  const [busy, setBusy] = useState<null | "ignore" | "tagasta">(null);
  const [, startNav] = useTransition();
  const onIgnored = reaStaatus === "ignoreeritud";

  async function doIgnore() {
    setBusy("ignore");
    const r = await ignoreRida(reaId);
    if (r.ok) startNav(() => router.refresh());
    setBusy(null);
  }

  async function doTagasta() {
    setBusy("tagasta");
    const r = await tagastaRida(reaId);
    if (r.ok) startNav(() => router.refresh());
    setBusy(null);
  }

  return (
    <div className="flex flex-wrap items-center gap-1">
      <Button asChild size="sm" variant="outline">
        <Link href={`/kataloog/${reaId}`}>
          <ExternalLink className="h-3 w-3" />
          Vaata
        </Link>
      </Button>
      {onIgnored ? (
        <Button onClick={doTagasta} disabled={busy !== null} size="sm" variant="ghost">
          {busy === "tagasta" ? <Loader2 className="h-3 w-3 animate-spin" /> : null}
          Taasta
        </Button>
      ) : (
        <Button onClick={doIgnore} disabled={busy !== null} size="sm" variant="ghost">
          {busy === "ignore" ? <Loader2 className="h-3 w-3 animate-spin" /> : <X className="h-3 w-3" />}
          Ignoreeri
        </Button>
      )}
    </div>
  );
}
