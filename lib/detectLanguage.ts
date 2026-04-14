import { SupportedLanguage } from "./types";

function normalize(value: string): string {
  return value
    .toLowerCase()
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .replace(/[’'`"]/g, "")
    .replace(/\s+/g, " ")
    .trim();
}

export function detectLanguage(prompt: string): SupportedLanguage {
  if (/[ء-ي]/.test(prompt)) return "ar";

  const q = normalize(prompt);

  const scores: Record<SupportedLanguage, number> = {
    fr: 0,
    es: 0,
    pt: 0,
    en: 0,
    tr: 0,
    ar: 0,
  };

  const signals: Record<SupportedLanguage, string[]> = {
    fr: ["lettre", "recherche", "histoire", "france", "roi", "siecle", "source"],
    es: ["carta", "historia", "rey", "archivo", "siglo", "espana", "marruecos"],
    pt: ["carta", "historia", "rei", "arquivo", "seculo", "marrocos"],
    en: ["letter", "history", "king", "archive", "century", "morocco"],
    tr: ["mektup", "tarih", "kral", "arsiv", "yuzyil", "fas"],
    ar: ["رسالة", "تاريخ", "ملك", "أرشيف", "المغرب"],
  };

  for (const [lang, words] of Object.entries(signals) as [SupportedLanguage, string[]][]) {
    words.forEach((word) => {
      if (q.includes(word)) scores[lang] += 1;
    });
  }

  let best: SupportedLanguage = "fr";
  let bestScore = -1;

  for (const lang of Object.keys(scores) as SupportedLanguage[]) {
    if (scores[lang] > bestScore) {
      best = lang;
      bestScore = scores[lang];
    }
  }

  return best;
}