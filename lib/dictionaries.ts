import { CanonicalDocumentType, CanonicalEntity } from "./types";

export const DOCUMENT_TYPE_SYNONYMS: Record<CanonicalDocumentType, string[]> = {
  letter: ["lettre", "letter", "carta", "mektup", "رسالة", "مراسلة"],
  manuscript: ["manuscrit", "manuscript", "manuscrito", "yazma", "مخطوط", "مخطوطة"],
  newspaper: ["journal", "newspaper", "periodico", "jornal", "gazete", "جريدة"],
  journal: ["revue", "journal", "review", "revista", "dergi", "مجلة"],
  book: ["livre", "book", "libro", "livro", "kitap", "كتاب", "bibliographie", "bibliography"],
  map: ["carte", "map", "mapa", "harita", "خريطة"],
  image: ["image", "photo", "imagen", "imagem", "fotograf", "صورة"],
  video: ["video", "film", "pelicula", "filme", "فيديو", "فيلم"],
  archive: ["archive", "archives", "archivo", "arquivo", "arsiv", "أرشيف"],
};

export const SOURCE_PREFERENCE_SYNONYMS = {
  primary: [
    "source primaire",
    "primary source",
    "fuente primaria",
    "fonte primaria",
    "birincil kaynak",
    "مصدر أولي",
    "وثيقة أصلية",
  ],
  secondary: [
    "source secondaire",
    "secondary source",
    "fuente secundaria",
    "fonte secundaria",
    "ikincil kaynak",
    "مصدر ثانوي",
  ],
};

export const ENTITY_MAP: CanonicalEntity[] = [
  {
    canonicalId: "morocco",
    canonicalLabel: "Morocco",
    variants: ["maroc", "morocco", "marruecos", "marrocos", "fas", "المغرب"],
  },
  {
    canonicalId: "aragon",
    canonicalLabel: "Aragon",
    variants: ["aragon", "aragón", "aragao", "أراغون"],
  },
  {
    canonicalId: "pedro_iv_of_aragon",
    canonicalLabel: "Pedro IV of Aragon",
    variants: [
      "pierre iv",
      "pedro iv",
      "pedro iv de aragon",
      "pedro iv de aragón",
      "peter iv of aragon",
      "بيدرو الرابع",
    ],
  },
  {
    canonicalId: "france",
    canonicalLabel: "France",
    variants: ["france", "فرنسا"],
  },
  {
    canonicalId: "cia",
    canonicalLabel: "CIA",
    variants: ["cia", "central intelligence agency", "وكالة المخابرات المركزية"],
  },
];

export const HISTORICAL_KEYWORDS = [
  "history",
  "histoire",
  "historique",
  "historia",
  "histórico",
  "tarih",
  "تاريخ",
  "archive",
  "archives",
  "archivo",
  "arquivo",
  "arsiv",
  "أرشيف",
  "manuscrit",
  "letter",
  "lettre",
  "carta",
  "mektup",
  "رسالة",
  "treaty",
  "traite",
  "tratado",
  "معاهدة",
  "king",
  "roi",
  "rey",
  "rei",
  "kral",
  "ملك",
  "sultan",
  "سلطان",
  "empire",
  "empire ottoman",
  "ottoman",
  "protectora",
  "protectorat",
  "protectorado",
  "حماية",
];

export const NON_HISTORICAL_KEYWORDS = [
  "hotel",
  "restaurant",
  "flight",
  "vol",
  "meteo",
  "weather",
  "football",
  "iphone",
  "laptop",
  "promo",
  "streaming",
];