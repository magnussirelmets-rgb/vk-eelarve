export type PakkumiseMallId =
  | "kortermaja_rekonstr"
  | "eramaja_kvvk"
  | "vesi_kanal"
  | "pv_susteem"
  | "ehitustood";

// Skalaarsed väljad mis salvestuvad pakkumised tabeli omaette veergudesse
// (kasutusel fastener auto-arvutuses; vt project_kortermaja_workflow).
export type SkaalateguriVäli =
  | "püstikute_arv"
  | "korterite_arv"
  | "radiaatorite_arv"
  | "keldrimagistraalide_jm"
  | "väljavõtete_arv";

export type SoovituslikEriosa = { kood: string; nimi: string };

// Malli-spetsiifilised väljad mis salvestuvad pakkumised.mall_andmed JSONB veergu.
export type MallVali =
  | {
      key: string;
      label: string;
      tüüp: "number";
      placeholder?: string;
      unit?: string;
      kuvaKui?: { key: string; väärtus: string | boolean | Array<string | boolean> };
    }
  | {
      key: string;
      label: string;
      tüüp: "decimal";
      placeholder?: string;
      unit?: string;
      kuvaKui?: { key: string; väärtus: string | boolean | Array<string | boolean> };
    }
  | {
      key: string;
      label: string;
      tüüp: "checkbox";
      kuvaKui?: { key: string; väärtus: string | boolean | Array<string | boolean> };
    }
  | {
      key: string;
      label: string;
      tüüp: "radio";
      options: { value: string; label: string }[];
      vaikimisi?: string;
      kuvaKui?: { key: string; väärtus: string | boolean | Array<string | boolean> };
    };

export type PakkumiseMall = {
  id: PakkumiseMallId;
  nimi: string;
  lühi: string;
  kirjeldus: string;
  soovituslikudEriosad: SoovituslikEriosa[];
  // Scalar veerud mida see mall kasutab pakkumised tabeli omaette veergudest
  näitaSkaalategureid: SkaalateguriVäli[];
  // Malli-spetsiifilised JSONB väljad
  mallVäljad: MallVali[];
  // Kas malli vorm pakub mahutabeli uploadit
  toetabMahutabelit: boolean;
};

export const PAKKUMISE_MALLID: PakkumiseMall[] = [
  {
    id: "kortermaja_rekonstr",
    nimi: "Kortermaja rekonstrueerimine",
    lühi: "Kortermaja",
    kirjeldus:
      "KVVK rekonstrueerimine korterelamus: torustik, radiaatorid, soojussõlm. Kasutab mahutabelit ja püstikute/korterite skaalategureid.",
    soovituslikudEriosad: [
      { kood: "711", nimi: "Veevarustus" },
      { kood: "712", nimi: "Kanalisatsioon" },
      { kood: "713", nimi: "Sademevesi / drenaaž" },
      { kood: "721", nimi: "Küttesüsteem" },
      { kood: "722", nimi: "Küttekehad" },
      { kood: "723", nimi: "Soojussõlm" },
    ],
    näitaSkaalategureid: [
      "püstikute_arv",
      "korterite_arv",
      "radiaatorite_arv",
      "keldrimagistraalide_jm",
      "väljavõtete_arv",
    ],
    mallVäljad: [],
    toetabMahutabelit: true,
  },
  {
    id: "eramaja_kvvk",
    nimi: "Eramaja kütte-, jahutus-, ventilatsioonisüsteemi ehitus",
    lühi: "Eramaja KJV",
    kirjeldus:
      "Eramaja KJV-süsteemide paigaldus: küttesüsteem (radiaator või põrandaküte), ventilatsioon, jahutus.",
    soovituslikudEriosad: [
      { kood: "721", nimi: "Küttesüsteem" },
      { kood: "722", nimi: "Küttekehad / põrandaküte" },
      { kood: "723", nimi: "Soojusallikas" },
      { kood: "724", nimi: "Ventilatsioon" },
      { kood: "725", nimi: "Jahutus / konditsioneer" },
    ],
    näitaSkaalategureid: [],
    mallVäljad: [
      // —— HOONE INFO ——
      {
        key: "hoone_tüüp",
        label: "Hoone tüüp",
        tüüp: "radio",
        vaikimisi: "eramaja",
        options: [
          { value: "eramaja", label: "Eramaja" },
          { value: "ridaelamu", label: "Ridaelamu" },
          { value: "paarismaja", label: "Paarismaja" },
          { value: "korter", label: "Korter" },
        ],
      },
      {
        key: "köetav_pindala_m2",
        label: "Hoone küttepindala",
        tüüp: "decimal",
        placeholder: "nt 180",
        unit: "m²",
      },
      {
        key: "energiaklass",
        label: "Hoone energiaklass",
        tüüp: "radio",
        options: [
          { value: "A", label: "A" },
          { value: "B", label: "B" },
          { value: "C", label: "C" },
          { value: "D", label: "D" },
          { value: "E", label: "E" },
          { value: "F", label: "F" },
          { value: "G", label: "G" },
          { value: "H", label: "H" },
        ],
      },

      // —— KÜTTESÜSTEEM ——
      {
        key: "kütte_tüüp",
        label: "Küttesüsteemi valik",
        tüüp: "radio",
        vaikimisi: "radiaator",
        options: [
          { value: "radiaator", label: "Radiaatorid" },
          { value: "põrandaküte", label: "Põrandaküte" },
          { value: "mõlemad", label: "Radiaator + põrandaküte" },
        ],
      },

      // —— SOOJUSALLIKAS ——
      {
        key: "soojusallika_tüüp",
        label: "Soojusallikas",
        tüüp: "radio",
        vaikimisi: "katel",
        options: [
          { value: "katel", label: "Katel" },
          { value: "õhkvesi", label: "Õhk-vesi soojuspump" },
          { value: "maasoojuspump", label: "Maasoojuspump" },
        ],
      },

      // —— KONDITSIONEER (õhk-õhk soojuspump) ——
      {
        key: "õhkõhk_konditsioneer",
        label: "Lisaks paigaldatakse konditsioneer (õhk-õhk soojuspump)",
        tüüp: "checkbox",
      },

      // —— VENTILATSIOON ——
      {
        key: "ventilatsioon_paigaldatakse",
        label: "Paigaldatakse ka soojustagastusega ventilatsioon",
        tüüp: "checkbox",
      },
    ],
    toetabMahutabelit: false,
  },
  {
    id: "vesi_kanal",
    nimi: "Vee- ja kanalisatsioonisüsteemi ehitus",
    lühi: "Vesi & kanal",
    kirjeldus:
      "Veevarustuse, kanalisatsiooni ja sademevee/drenaaži paigaldus. Sobib uusehituseks või osaliseks tööks.",
    soovituslikudEriosad: [
      { kood: "711", nimi: "Veevarustus" },
      { kood: "712", nimi: "Kanalisatsioon" },
      { kood: "713", nimi: "Sademevesi / drenaaž" },
    ],
    näitaSkaalategureid: ["keldrimagistraalide_jm"],
    mallVäljad: [
      {
        key: "kraanikausse",
        label: "Kraanikausse",
        tüüp: "number",
        placeholder: "nt 3",
      },
      {
        key: "wc_potte",
        label: "WC-potte",
        tüüp: "number",
        placeholder: "nt 2",
      },
      {
        key: "duššikabiine",
        label: "Duššikabiine",
        tüüp: "number",
        placeholder: "nt 2",
      },
      {
        key: "vanne",
        label: "Vanne",
        tüüp: "number",
        placeholder: "nt 1",
      },
      {
        key: "köögivalamuid",
        label: "Köögivalamuid",
        tüüp: "number",
        placeholder: "nt 1",
      },
      {
        key: "pesumasinaid",
        label: "Pesumasina ühendusi",
        tüüp: "number",
        placeholder: "nt 1",
      },
      {
        key: "veearvesteid",
        label: "Veearvesteid",
        tüüp: "number",
        placeholder: "nt 1",
      },
    ],
    toetabMahutabelit: true,
  },
  {
    id: "pv_susteem",
    nimi: "PV süsteemi ehitus",
    lühi: "PV",
    kirjeldus:
      "Päikeseelektrijaama (PV) ehitus: paneelid, raamistused, inverter, kaablitööd ja võrku ühendamine.",
    soovituslikudEriosad: [
      { kood: "PV1", nimi: "Paneelid + raamistused" },
      { kood: "PV2", nimi: "Inverter + montaaž" },
      { kood: "PV3", nimi: "Kaablitööd + võrku ühendamine" },
    ],
    näitaSkaalategureid: [],
    mallVäljad: [
      {
        key: "paigalduse_tüüp",
        label: "Paigalduse tüüp",
        tüüp: "radio",
        vaikimisi: "katus_kald",
        options: [
          { value: "katus_kald", label: "Kaldkatus" },
          { value: "katus_lame", label: "Lamekatus" },
          { value: "maa", label: "Maapealne" },
          { value: "fassad", label: "Fassaad" },
        ],
      },
      {
        key: "paneelide_arv",
        label: "Paneelide arv",
        tüüp: "number",
        placeholder: "nt 24",
      },
      {
        key: "paneeli_võimsus_w",
        label: "Ühe paneeli võimsus",
        tüüp: "number",
        placeholder: "nt 450",
        unit: "W",
      },
      {
        key: "inverteri_võimsus_kw",
        label: "Inverteri võimsus",
        tüüp: "decimal",
        placeholder: "nt 10",
        unit: "kW",
      },
      {
        key: "akupank_vajab",
        label: "Paigaldatakse ka akupank",
        tüüp: "checkbox",
      },
      {
        key: "akupanga_mahtuvus_kwh",
        label: "Akupanga mahtuvus",
        tüüp: "decimal",
        placeholder: "nt 10",
        unit: "kWh",
        kuvaKui: { key: "akupank_vajab", väärtus: true },
      },
      {
        key: "võrku_ühendus",
        label: "Vajab võrku ühendamist (Elektrilevi-leping)",
        tüüp: "checkbox",
      },
    ],
    toetabMahutabelit: false,
  },
  {
    id: "ehitustood",
    nimi: "Ehitustööde teostamine",
    lühi: "Ehitus",
    kirjeldus:
      "Üldehitustööde teostamine — vaba struktuuriga pakkumine ilma fikseeritud eriosadeta. Magnus lisab eriosad käsitsi.",
    soovituslikudEriosad: [],
    näitaSkaalategureid: [],
    mallVäljad: [
      {
        key: "objekti_pindala_m2",
        label: "Objekti üldpindala",
        tüüp: "decimal",
        placeholder: "nt 220",
        unit: "m²",
      },
    ],
    toetabMahutabelit: false,
  },
];

export const PAKKUMISE_MALL_BY_ID = Object.fromEntries(
  PAKKUMISE_MALLID.map((m) => [m.id, m] as const),
) as Record<PakkumiseMallId, PakkumiseMall>;

export const PAKKUMISE_MALL_DEFAULT: PakkumiseMallId = "kortermaja_rekonstr";

export function isPakkumiseMallId(v: unknown): v is PakkumiseMallId {
  return typeof v === "string" && v in PAKKUMISE_MALL_BY_ID;
}

// Helper: formatib mall_andmed väärtuse inimloetavalt detail-lehel.
export function formatMallVali(
  väli: MallVali,
  väärtus: unknown,
): { label: string; väärtus: string } | null {
  if (väärtus === null || väärtus === undefined || väärtus === "") return null;
  const unit = "unit" in väli && väli.unit ? ` ${väli.unit}` : "";
  if (väli.tüüp === "checkbox") {
    if (!väärtus) return null;
    return { label: väli.label, väärtus: "Jah" };
  }
  if (väli.tüüp === "radio") {
    const opt = väli.options.find((o) => o.value === väärtus);
    return { label: väli.label, väärtus: opt?.label ?? String(väärtus) };
  }
  return { label: väli.label, väärtus: `${väärtus}${unit}` };
}
