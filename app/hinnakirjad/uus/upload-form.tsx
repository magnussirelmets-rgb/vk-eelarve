"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Upload } from "lucide-react";
import { TARNIJAD } from "@/lib/types";
import { uploadHinnakiri } from "../actions";

type Props = {
  eelnevadTarnijad?: string[];
};

export function UploadForm({ eelnevadTarnijad = [] }: Props) {
  const router = useRouter();
  const [pending, startTransition] = useTransition();
  const [error, setError] = useState<string | null>(null);
  const [selectedTarnija, setSelectedTarnija] = useState<string>("");
  const [fileName, setFileName] = useState<string>("");

  async function onSubmit(formData: FormData) {
    setError(null);
    startTransition(async () => {
      const res = await uploadHinnakiri(formData);
      if (res.ok) {
        router.push(`/hinnakirjad/${res.id}`);
      } else {
        setError(res.error);
      }
    });
  }

  // TARNIJAD'is on "Muu" — jäta see kõige lõppu
  const baasTarnijad = TARNIJAD.filter((t) => t !== "Muu");
  const showMuuOption = TARNIJAD.includes("Muu" as never);

  return (
    <form action={onSubmit} className="space-y-6">
      <div className="space-y-1">
        <Label htmlFor="tarnija">
          Tarnija <span className="text-vk-red">*</span>
        </Label>
        <select
          id="tarnija"
          name="tarnija"
          required
          value={selectedTarnija}
          onChange={(e) => setSelectedTarnija(e.target.value)}
          className="flex h-10 w-full rounded-md border border-input bg-background px-3 py-2 text-sm"
        >
          <option value="" disabled>
            Vali tarnija…
          </option>

          {baasTarnijad.length > 0 ? (
            <optgroup label="Põhitarnijad">
              {baasTarnijad.map((t) => (
                <option key={t} value={t}>
                  {t}
                </option>
              ))}
            </optgroup>
          ) : null}

          {eelnevadTarnijad.length > 0 ? (
            <optgroup label="Varem kasutatud">
              {eelnevadTarnijad.map((t) => (
                <option key={t} value={t}>
                  {t}
                </option>
              ))}
            </optgroup>
          ) : null}

          {showMuuOption ? <option value="Muu">+ Uus tarnija (sisesta nimi)</option> : null}
        </select>
        {eelnevadTarnijad.length > 0 ? (
          <p className="text-[10px] text-muted-foreground">
            {eelnevadTarnijad.length} varem lisatud tarnijat on nimekirjas.
          </p>
        ) : null}
      </div>

      {selectedTarnija === "Muu" ? (
        <div className="space-y-1">
          <Label htmlFor="tarnija_muu">
            Uue tarnija nimi <span className="text-vk-red">*</span>
          </Label>
          <Input
            id="tarnija_muu"
            name="tarnija_muu"
            placeholder="nt Onninen, Würth, Geoenergia OÜ"
            required
          />
          <p className="text-[10px] text-muted-foreground">
            Pärast salvestamist ilmub see tarnija &quot;Varem kasutatud&quot; loendisse järgmiseks
            korraks.
          </p>
        </div>
      ) : null}

      <div className="space-y-1">
        <Label htmlFor="fail">
          Fail <span className="text-vk-red">*</span>
        </Label>
        <Input
          id="fail"
          name="fail"
          type="file"
          required
          accept=".pdf,.xlsx,.xls,.csv"
          onChange={(e) => setFileName(e.target.files?.[0]?.name ?? "")}
          className="cursor-pointer"
        />
        <p className="text-xs text-muted-foreground">
          PDF, XLSX, XLS või CSV. Max 20 MB.
          {fileName ? <span className="ml-2 font-medium">Valitud: {fileName}</span> : null}
        </p>
      </div>

      {error ? (
        <div className="rounded-md bg-vk-red/10 px-3 py-2 text-sm text-vk-red">{error}</div>
      ) : null}

      <div className="flex gap-2">
        <Button type="submit" disabled={pending} variant="primary">
          {pending ? "Laen üles…" : (<><Upload className="h-4 w-4" />Laadi üles ja parsige</>)}
        </Button>
      </div>
    </form>
  );
}
