export type Osa =
  | "vesi"
  | "kanal"
  | "küte"
  | "sõlm"
  | "sanseade"
  | "ventilatsioon"
  | "jahutus"
  | "tulekustuti"
  | "muu";

export const OSA_VALUES: Osa[] = [
  "vesi",
  "kanal",
  "küte",
  "sõlm",
  "sanseade",
  "ventilatsioon",
  "jahutus",
  "tulekustuti",
  "muu",
];

export const OSA_LABEL: Record<Osa, string> = {
  vesi: "Veevarustus",
  kanal: "Kanalisatsioon",
  küte: "Küttesüsteem",
  sõlm: "Soojussõlm",
  sanseade: "Sanitaarseade",
  ventilatsioon: "Ventilatsioon",
  jahutus: "Jahutus",
  tulekustuti: "Tulekustuti",
  muu: "Muu",
};

export type Artikkel = {
  id: string;
  kood: string;
  osa: Osa;
  alamosa: string | null;
  sek_kood: string | null;
  nimetus: string;
  tähis: string | null;
  ühik: string | null;
  alt_nimed: string | null;
  aktiivne: boolean;
  loodud: string;
  uuendatud: string;
};

export type ArtikkelKehtivaHinnaga = Artikkel & {
  ostuhind_neto: number | null;
  töö_h_ühik: number | null;
  hind_kehtib_alates: string | null;
};

export type Hind = {
  id: string;
  artikkel_id: string;
  ostuhind_neto: number | null;
  töö_h_ühik: number | null;
  kehtib_alates: string;
  märkused: string | null;
  loodud: string;
};

// ============================================================================
// Päev 2: hinnakirjad
// ============================================================================

export const TARNIJAD = [
  "Küttemaailm",
  "Toru-Jüri",
  "Onninen",
  "Stokker",
  "Karl Storm",
  "Muu",
] as const;
export type Tarnija = (typeof TARNIJAD)[number];

export type HinnakirjaStaatus =
  | "mustand"
  | "parsitud"
  | "matched"
  | "kinnitatud"
  | "viga";

export const HINNAKIRJA_STAATUS_LABEL: Record<HinnakirjaStaatus, string> = {
  mustand: "Mustand",
  parsitud: "Parsitud",
  matched: "Matchitud",
  kinnitatud: "Kinnitatud",
  viga: "Viga",
};

export type Hinnakiri = {
  id: string;
  tarnija: string;
  faili_path: string;
  faili_nimi: string | null;
  faili_tüüp: "pdf" | "xlsx" | "csv";
  laetud_kuupäev: string;
  staatus: HinnakirjaStaatus;
  artiklite_arv: number;
  viga_tekst: string | null;
  märkused: string | null;
  loodud: string;
  uuendatud: string;
};

export type HinnakirjaReaStaatus =
  | "matchimata"
  | "matchitud"
  | "kinnitatud"
  | "ignoreeritud"
  | "uus_artikkel";

export type HinnakirjaRida = {
  id: string;
  hinnakiri_id: string;
  rea_nr: number | null;
  tarnija_kood: string | null;
  tarnija_nimetus: string;
  tarnija_brand: string | null;
  sektsioon: string | null;
  jaehind_neto: number | null;
  ah_protsent: number | null;
  ostuhind_neto: number | null;
  ühik: string | null;
  kogus: number | null;
  pakkumise_summa: number | null;
  vk_artikkel_id: string | null;
  match_confidence: number | null;
  match_põhjendus: string | null;
  staatus: HinnakirjaReaStaatus;
  // 0004: Magnuse tacit-teadmised otse tarnija toote juurde
  paigaldusaeg_h_ühik: number | null;
  magnus_märkused: string | null;
  magnus_alt_nimed: string | null;
  // 0016: pikem tootekirjeldus (kliendile nähtav)
  kirjeldus: string | null;
  // 0006: tootegrupp (Isolatsioon, PE-X torustik jne)
  tootegrupp_id: string | null;
  loodud: string;
  uuendatud: string;
};

export type TootegrupiTüüp = "toode" | "teenus";

export const TOOTEGRUPI_TÜÜP_LABEL: Record<TootegrupiTüüp, string> = {
  toode: "Toode",
  teenus: "Teenus",
};

export type Tootegrupp = {
  id: string;
  nimi: string;
  kirjeldus: string | null;
  paigaldusaeg_h_ühik: number | null;
  kate_koefitsient_override: number | null;
  tüüp: TootegrupiTüüp;
  märkused: string | null;
  loodud: string;
  uuendatud: string;
};

// 0011: Komplektid
export type Komplekt = {
  id: string;
  nimi: string;
  kirjeldus: string | null;
  ühik: string;
  märkused: string | null;
  // 0018: vaike-eriosa "Lisa komplekt pakkumisse" dialoogi jaoks
  vaike_sektsioon: string | null;
  vaike_alamsektsioon: string | null;
  loodud: string;
  uuendatud: string;
};

export type KomplektiRida = {
  id: string;
  komplekt_id: string;
  toode_id: string | null;
  nimetus: string;
  tarnija: string | null;
  tarnija_kood: string | null;
  tarnija_brand: string | null;
  tähis: string | null;
  ühik: string | null;
  ostuhind_snapshot: number | null;
  paigaldusaeg_h_ühik_snapshot: number | null;
  kogus: number;
  järjekord: number;
  loodud: string;
};

// Joined: hinnakirja_read + parent hinnakiri (kataloogi-vaate jaoks)
export type HinnakirjaRidaKataloogis = HinnakirjaRida & {
  hinnakirjad: {
    tarnija: string;
    faili_nimi: string | null;
    laetud_kuupäev: string;
    faili_tüüp: string;
  } | null;
  tootegrupid?: {
    id: string;
    nimi: string;
    paigaldusaeg_h_ühik: number | null;
    kate_koefitsient_override: number | null;
  } | null;
};

export type TarnijaArtikkel = {
  id: string;
  vk_artikkel_id: string;
  tarnija: string;
  tarnija_kood: string | null;
  tarnija_nimetus: string | null;
  tarnija_brand: string | null;
  viimane_ostuhind: number | null;
  viimane_jaehind: number | null;
  viimane_ah_protsent: number | null;
  viimati_uuendatud: string;
  märkused: string | null;
};

// ============================================================================
// Päev 3: pakkumised + positsioonid (mahutabel)
// ============================================================================

export type PakkumiseStaatus =
  | "mustand"
  | "parsitud"
  | "saadetud"
  | "võidetud"
  | "kaotatud";

export const PAKKUMISE_STAATUS_LABEL: Record<PakkumiseStaatus, string> = {
  mustand: "Mustand",
  parsitud: "Mahutabel parsitud",
  saadetud: "Saadetud",
  võidetud: "Võidetud",
  kaotatud: "Kaotatud",
};

export type Pakkumine = {
  id: string;
  vkp_nr: string;
  tellija_nimi: string | null;
  tellija_email: string | null;
  tellija_telefon: string | null;
  objekt: string | null;
  projekti_nr: string | null;
  pakkumise_kuupäev: string;
  kehtiv_kuni: string | null;
  staatus: PakkumiseStaatus;
  tunnitasu: number;
  kate_koefitsient: number;
  km_määr: number;
  püstikute_arv: number | null;
  korterite_arv: number | null;
  radiaatorite_arv: number | null;
  keldrimagistraalide_jm: number | null;
  väljavõtete_arv: number | null;
  mahutabel_pdf_path: string | null;
  mahutabel_pdf_nimi: string | null;
  mahutabel_parsitud_ajal: string | null;
  mall: import("./pakkumise-mallid").PakkumiseMallId;
  mall_andmed: Record<string, unknown>;
  märkused: string | null;
  loodud: string;
  uuendatud: string;
};

export type PakkumiseMahutabel = {
  id: string;
  pakkumine_id: string;
  faili_path: string;
  faili_nimi: string | null;
  parsitud_ajal: string | null;
  märkused: string | null;
  loodud: string;
};

export type Positsioon = {
  id: string;
  pakkumine_id: string;
  rea_nr: number | null;
  sektsioon: string | null;
  alamsektsioon: string | null;
  nimetus: string;
  tähis: string | null;
  kogus: number | null;
  ühik: string | null;
  toode_id: string | null;
  toote_match_confidence: number | null;
  toote_match_põhjendus: string | null;
  toode_snapshot_tarnija: string | null;
  toode_snapshot_kood: string | null;
  toode_snapshot_nimetus: string | null;
  toode_snapshot_brand: string | null;
  ostuhind_snapshot: number | null;
  paigaldusaeg_snapshot: number | null;
  pdf_rida_tekst: string | null;
  manuaalselt_muudetud: boolean;
  märkused: string | null;
  // 0017: kliendile nähtav tootekirjeldus
  kirjeldus: string | null;
  // 0006: snapshot kate (kas grupi override või pakkumise vaikimisi)
  kate_snapshot: number | null;
  // 0010: reservi-rida (kui täidetud, kogus arvutatakse sektsiooni materjali %-na)
  reservi_koefitsent: number | null;
  loodud: string;
  uuendatud: string;
};
