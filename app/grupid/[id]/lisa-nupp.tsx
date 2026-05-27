"use client";

import { useState } from "react";
import { Button } from "@/components/ui/button";
import { Plus } from "lucide-react";
import { LisaManuaalneToodeDialog } from "./lisa-manuaalne-toode-dialog";

type Props = {
  grupId: string;
  grupNimi: string;
  grupTüüp: "toode" | "teenus";
};

export function LisaNupp({ grupId, grupNimi, grupTüüp }: Props) {
  const [open, setOpen] = useState(false);
  return (
    <>
      <Button onClick={() => setOpen(true)} variant="primary" size="sm">
        <Plus className="h-4 w-4" />
        Lisa {grupTüüp === "teenus" ? "teenus" : "toode"} käsitsi
      </Button>
      <LisaManuaalneToodeDialog
        grupId={grupId}
        grupNimi={grupNimi}
        grupTüüp={grupTüüp}
        open={open}
        onOpenChange={setOpen}
      />
    </>
  );
}
