"use client";

import Link from "next/link";
import { useState } from "react";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Package } from "lucide-react";
import type { HinnakirjaRida } from "@/lib/types";
import { formatEur, formatNum } from "@/lib/utils";
import { RowActions } from "./row-actions";
import { TeeKomplektDialog } from "./tee-komplekt-dialog";

export function HinnakirjaRidadeTabel({ read }: { read: HinnakirjaRida[] }) {
  const [selected, setSelected] = useState<Set<string>>(new Set());
  const [komplektOpen, setKomplektOpen] = useState(false);

  function toggleOne(id: string, on: boolean) {
    setSelected((prev) => {
      const next = new Set(prev);
      if (on) next.add(id);
      else next.delete(id);
      return next;
    });
  }
  const visible = read.filter((r) => r.staatus !== "ignoreeritud");
  function toggleAllVisible(on: boolean) {
    setSelected((prev) => {
      const next = new Set(prev);
      for (const r of visible) {
        if (on) next.add(r.id);
        else next.delete(r.id);
      }
      return next;
    });
  }

  const count = selected.size;
  const visibleAllSelected = visible.length > 0 && visible.every((r) => selected.has(r.id));
  const visibleSomeSelected = visible.some((r) => selected.has(r.id)) && !visibleAllSelected;

  return (
    <>
      {count > 0 ? (
        <div className="sticky top-0 z-10 flex flex-wrap items-center justify-between gap-3 rounded-md border bg-vk-blue/5 px-4 py-2.5 text-sm shadow-sm">
          <span className="font-medium">
            <span className="font-mono text-vk-blue">{count}</span> rida valitud
          </span>
          <div className="flex items-center gap-2">
            <Button onClick={() => setKomplektOpen(true)} variant="primary" size="sm">
              <Package className="h-4 w-4" />
              Tee komplekt valitud ridadest
            </Button>
            <Button onClick={() => setSelected(new Set())} variant="ghost" size="sm">
              Tühista valik
            </Button>
          </div>
        </div>
      ) : null}

      <Card>
        <CardContent className="p-0">
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead className="w-[40px]">
                  <input
                    type="checkbox"
                    checked={visibleAllSelected}
                    ref={(el) => {
                      if (el) el.indeterminate = visibleSomeSelected;
                    }}
                    onChange={(e) => toggleAllVisible(e.target.checked)}
                    aria-label="Vali kõik nähtavad"
                    className="h-4 w-4 cursor-pointer"
                  />
                </TableHead>
                <TableHead className="w-[40px]">#</TableHead>
                <TableHead>Tarnija toode</TableHead>
                <TableHead className="w-[110px]">Kood</TableHead>
                <TableHead className="w-[100px]">Brand</TableHead>
                <TableHead className="w-[60px]">Ühik</TableHead>
                <TableHead className="w-[100px] text-right">Ostuhind</TableHead>
                <TableHead className="w-[100px] text-right">Paigald.</TableHead>
                <TableHead className="w-[180px]">Toimingud</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {read.map((r) => (
                <TableRow
                  key={r.id}
                  className={r.staatus === "ignoreeritud" ? "opacity-50" : undefined}
                >
                  <TableCell>
                    {r.staatus === "ignoreeritud" ? null : (
                      <input
                        type="checkbox"
                        checked={selected.has(r.id)}
                        onChange={(e) => toggleOne(r.id, e.target.checked)}
                        aria-label={`Vali rida ${r.id}`}
                        className="h-4 w-4 cursor-pointer"
                      />
                    )}
                  </TableCell>
                  <TableCell className="font-mono text-xs">{r.rea_nr ?? "—"}</TableCell>
                  <TableCell>
                    <Link href={`/kataloog/${r.id}`} className="hover:underline">
                      {r.tarnija_nimetus}
                    </Link>
                    {r.sektsioon ? (
                      <div className="text-[10px] uppercase tracking-wide text-muted-foreground">
                        {r.sektsioon}
                      </div>
                    ) : null}
                    {r.magnus_märkused ? (
                      <div className="text-xs italic text-muted-foreground">✎ {r.magnus_märkused}</div>
                    ) : null}
                  </TableCell>
                  <TableCell className="font-mono text-xs">{r.tarnija_kood ?? "—"}</TableCell>
                  <TableCell className="text-xs">{r.tarnija_brand ?? "—"}</TableCell>
                  <TableCell className="text-xs">{r.ühik ?? "—"}</TableCell>
                  <TableCell className="text-right font-mono text-xs">
                    <div>{formatEur(r.ostuhind_neto)}</div>
                    {r.jaehind_neto !== null && r.ah_protsent !== null ? (
                      <div className="text-[10px] text-muted-foreground">
                        jae {formatEur(r.jaehind_neto)} · AH {r.ah_protsent}%
                      </div>
                    ) : null}
                  </TableCell>
                  <TableCell className="text-right font-mono text-xs">
                    {r.paigaldusaeg_h_ühik === null ? (
                      <span className="text-muted-foreground">—</span>
                    ) : (
                      `${formatNum(r.paigaldusaeg_h_ühik)} h`
                    )}
                  </TableCell>
                  <TableCell>
                    <RowActions reaId={r.id} reaStaatus={r.staatus} />
                  </TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        </CardContent>
      </Card>

      <TeeKomplektDialog
        open={komplektOpen}
        onOpenChange={setKomplektOpen}
        toodeIds={Array.from(selected)}
        onSuccess={() => setSelected(new Set())}
      />
    </>
  );
}
