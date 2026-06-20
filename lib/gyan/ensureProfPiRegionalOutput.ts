import {
  getProfPiUiLanguagePreserveClause,
  PROF_PI_MULTILINGUAL_LATEX_CONTRACT,
  resolveProfPiUiLanguage,
} from "@/lib/gyanContentPolicy";
import {
  formatSarvamAssistantReply,
  sarvamChatCompletion,
} from "@/lib/sarvamGyanClient";
import type { DoubtSupportedLanguage } from "@/lib/gyan/doubtSupportedLanguages";

const REGIONAL_SCRIPT_DETECT: Record<
  Exclude<DoubtSupportedLanguage["id"], "en">,
  RegExp
> = {
  kn: /[\u0C80-\u0CFF]/,
  hi: /[\u0900-\u097F]/,
  te: /[\u0C00-\u0C7F]/,
  ta: /[\u0B80-\u0BFF]/,
};

/** Remove LaTeX and bold headers so script detection reflects prose only. */
export function stripLatexForLangCheck(text: string): string {
  return text
    .replace(/\$\$[\s\S]*?\$\$/g, " ")
    .replace(/\$[^$\n]+\$/g, " ")
    .replace(/\*\*[^*]+\*\*/g, " ");
}

/** True when UI language is regional but the answer prose has no matching script. */
export function proseMissingRegionalScript(text: string, langId: string): boolean {
  if (langId === "en") return false;
  const re = REGIONAL_SCRIPT_DETECT[langId as Exclude<DoubtSupportedLanguage["id"], "en">];
  if (!re) return false;
  return !re.test(stripLatexForLangCheck(text));
}

export async function ensureProfPiRegionalOutput(params: {
  text: string;
  languageCode: string;
  metricsLabel?: string;
}): Promise<string> {
  const uiLang = resolveProfPiUiLanguage(params.languageCode);
  if (!uiLang) return params.text;

  const draft = params.text.trim();
  if (!draft || !proseMissingRegionalScript(draft, uiLang.id)) {
    return params.text;
  }

  const systemPrompt =
    `You translate Prof-Pi STEM tutor answers for Indian Class 11–12 students.\n` +
    `Translate ALL explanatory sentences into ${uiLang.native} (${uiLang.label}, ${uiLang.script} script).\n` +
    `The student selected ${uiLang.native} in the app — English prose is NOT acceptable.\n` +
    `Keep these section header keywords in English exactly (do not translate): Formula, Steps, Answer, Key intuition, Exam trap, Given, Proof.\n` +
    `Copy every LaTeX math block ($...$ and $$...$$) verbatim — never change formulas.\n` +
    `Keep markdown bullets and structure. Output ONLY the translated answer — no preamble.\n` +
    getProfPiUiLanguagePreserveClause(uiLang.id) +
    `\n\n${PROF_PI_MULTILINGUAL_LATEX_CONTRACT}`;

  const r = await sarvamChatCompletion({
    systemPrompt,
    userContent: draft.slice(0, 12_000),
    temperature: 0.15,
    maxTokens: 8192,
    timeoutMs: 45_000,
    metricsLabel: params.metricsLabel ?? "profpi_regional_translate",
  });

  if (!r.ok || !r.text.trim()) {
    console.warn(
      `[ensureProfPiRegionalOutput] translate failed lang=${uiLang.id}: ${r.ok ? "empty" : r.error}`
    );
    return params.text;
  }

  const translated = formatSarvamAssistantReply(r.text);
  if (!translated || proseMissingRegionalScript(translated, uiLang.id)) {
    console.warn(
      `[ensureProfPiRegionalOutput] translate still missing ${uiLang.id} script; keeping original`
    );
    return params.text;
  }

  return translated;
}
