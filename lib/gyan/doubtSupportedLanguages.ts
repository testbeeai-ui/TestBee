/**
 * Regional languages supported in **lesson chat** (private Prof-Pi).
 * Gyan++ public doubts are English-only — do not use for doubt posting.
 * Keep in sync with translateEnglishHeadersToRegional in lib/casExtract.ts.
 */

export type DoubtSupportedLanguage = {
  id: "en" | "hi" | "te" | "kn" | "ta";
  label: string;
  native: string;
  script: string;
  sample: string;
};

export const DOUBT_SUPPORTED_LANGUAGES: readonly DoubtSupportedLanguage[] = [
  {
    id: "en",
    label: "English",
    native: "English",
    script: "Latin",
    sample: "Solve $x^2 - 5x + 6 = 0$",
  },
  {
    id: "hi",
    label: "Hindi",
    native: "हिन्दी",
    script: "Devanagari",
    sample: "इस समीकरण को हल करें: $x^2 - 5x + 6 = 0$",
  },
  {
    id: "te",
    label: "Telugu",
    native: "తెలుగు",
    script: "Telugu",
    sample: "ఈ సమీకరణాన్ని పరిష్కరించండి: $x^2 - 5x + 6 = 0$",
  },
  {
    id: "kn",
    label: "Kannada",
    native: "ಕನ್ನಡ",
    script: "Kannada",
    sample: "ಈ ಸಮೀಕರಣವನ್ನು ಬಿಡಿಸಿ: $x^2 - 5x + 6 = 0$",
  },
  {
    id: "ta",
    label: "Tamil",
    native: "தமிழ்",
    script: "Tamil",
    sample: "இந்த சமன்பாட்டைத் தீர்க்கவும்: $x^2 - 5x + 6 = 0$",
  },
] as const;

export const DOUBT_SUPPORTED_LANGUAGE_COUNT = DOUBT_SUPPORTED_LANGUAGES.length;
