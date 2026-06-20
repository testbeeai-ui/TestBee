import {
  extractCalculations,
  shouldRunCasVerification,
  translateEnglishHeadersToRegional,
} from "@/lib/casExtract";
import { ensureProfPiRegionalOutput } from "@/lib/gyan/ensureProfPiRegionalOutput";
import {
  getProfPiDesiredMaxTokens,
  getProfPiRetryTemperatureForRagKey,
  getProfPiUiLanguagePreserveClause,
} from "@/lib/gyanContentPolicy";
import { crossCheckFormulaWithRag } from "@/lib/gyan/verify/formulaCrossCheck";
import { verifyCalculation } from "@/lib/gyan/verify/casVerify";
import { maybeVerifyProfPiDraft } from "@/lib/gyan/verify/profPiVerify";
import type { ProfPiRagKey } from "@/lib/gyan/verify/profPiVerify";
import {
  formatSarvamAssistantReply,
  sarvamChatCompletion,
  stripPhysicsNarration,
} from "@/lib/sarvamGyanClient";

export type ProfPiQualitySource = "rephrase" | "rag_sarvam" | "subject_chat";

export type ProfPiQualityResult = {
  text: string;
  verifierRan: boolean;
  verifierOk: boolean;
  formulaCrossChecked: boolean;
  formulaMismatch: boolean;
  casVerified: boolean;
  casMismatches: number;
};

export type RunProfPiQualityPipelineParams = {
  draft: string;
  questionTitle: string;
  questionBody: string;
  ragKey: ProfPiRagKey;
  gradeLevel: number;
  ragContextText: string | null;
  source: ProfPiQualitySource;
  /** When true, skip verifier / formula / CAS (light conversational follow-ups). */
  skipHeavyQuality?: boolean;
  /** UI-selected lesson-chat language (kn/hi/ta/te) — preserved through verifier/CAS retries. */
  responseLanguage?: string;
  logLabel?: string;
};

export async function runProfPiQualityPipeline(
  params: RunProfPiQualityPipelineParams
): Promise<ProfPiQualityResult> {
  const logPrefix = params.logLabel ? `[profPiQuality ${params.logLabel}]` : "[profPiQuality]";
  let bodyOut = params.draft.trim();
  const emptyQuality: ProfPiQualityResult = {
    text: bodyOut,
    verifierRan: false,
    verifierOk: true,
    formulaCrossChecked: false,
    formulaMismatch: false,
    casVerified: false,
    casMismatches: 0,
  };

  if (!bodyOut) return emptyQuality;

  const lessonLang =
    params.source === "subject_chat" ? params.responseLanguage : undefined;

  if (params.skipHeavyQuality) {
    bodyOut = formatSarvamAssistantReply(bodyOut);
    if (params.ragKey === "physics") bodyOut = stripPhysicsNarration(bodyOut);
    bodyOut = translateEnglishHeadersToRegional(bodyOut);
    if (lessonLang) {
      bodyOut = await ensureProfPiRegionalOutput({
        text: bodyOut,
        languageCode: lessonLang,
        metricsLabel: params.logLabel ? `${params.logLabel}-regional` : undefined,
      });
    }
    return { ...emptyQuality, text: bodyOut };
  }

  const langClause = getProfPiUiLanguagePreserveClause(lessonLang);

  const verified = await maybeVerifyProfPiDraft({
    draft: bodyOut,
    title: params.questionTitle,
    body: params.questionBody,
    ragKey: params.ragKey,
    source: params.source === "subject_chat" ? "rag_sarvam" : params.source,
    responseLanguage: lessonLang,
  });
  bodyOut = verified.text.trim() || bodyOut;
  if (params.ragKey === "physics") bodyOut = stripPhysicsNarration(bodyOut);
  const verifyNote = verified.error ? ` verifierErr=${verified.error}` : "";
  console.info(
    `${logPrefix} ragKey=${params.ragKey} source=${params.source} verifierRan=${verified.ran} verifierOk=${verified.ok}${verifyNote} answerChars=${bodyOut.length}`
  );

  let formulaCrossChecked = false;
  let formulaMismatch = false;
  const formulaCheck = await crossCheckFormulaWithRag({
    answer: bodyOut,
    ragContext: params.ragContextText,
    subject: params.ragKey,
  });

  if (formulaCheck.ran && formulaCheck.matches === false && formulaCheck.textbookFormula) {
    formulaCrossChecked = true;
    formulaMismatch = true;

    const correctionPrompt =
      `Your answer used the formula: ${formulaCheck.answerFormula}\n` +
      `But the textbook states the correct formula is: ${formulaCheck.textbookFormula}\n\n` +
      `Please recompute using the textbook formula. Keep the same format and structure.`;

    const corrected = await sarvamChatCompletion({
      systemPrompt:
        `You are Prof-Pi, an expert tutor for Indian students (CBSE, JEE, NEET, KCET). ` +
        `You MUST use the textbook formula provided below. Keep the same answer format with **Formula:**, **Steps:**, **Answer:** sections.${langClause}`,
      userContent: `Original question:\n${params.questionTitle}\n${params.questionBody}\n\nYour previous answer:\n${bodyOut}\n\n${correctionPrompt}`,
      temperature: getProfPiRetryTemperatureForRagKey(params.ragKey),
      maxTokens: getProfPiDesiredMaxTokens(),
      metricsLabel: "formula-crosscheck-correction",
    });

    if (corrected.ok && corrected.text.length > 40) {
      bodyOut = formatSarvamAssistantReply(corrected.text);
      if (params.ragKey === "physics") bodyOut = stripPhysicsNarration(bodyOut);
      console.info(
        `${logPrefix} Formula cross-check correction applied textbookFormula=${formulaCheck.textbookFormula}`
      );
    } else {
      bodyOut +=
        "\n\n> ⚠️ *The formula used may not match the textbook. Please verify with your teacher.*";
      console.warn(`${logPrefix} Formula cross-check correction failed`);
    }
  } else if (formulaCheck.ran && formulaCheck.matches === true) {
    formulaCrossChecked = true;
    console.info(
      `${logPrefix} Formula cross-check passed formula=${formulaCheck.answerFormula}`
    );
  }

  let casVerified = false;
  let casMismatches = 0;
  const shouldCas = shouldRunCasVerification({
    subject: params.ragKey,
    doubtTitle: params.questionTitle,
    doubtBody: params.questionBody,
  });

  if (shouldCas) {
    const extracted = extractCalculations({
      answerMarkdown: bodyOut,
      doubtTitle: params.questionTitle,
      doubtBody: params.questionBody,
      subject: params.ragKey as "physics" | "math" | "chemistry",
    });

    if (extracted.length > 0) {
      casVerified = true;
      const corrections: Array<{
        operation: string;
        expression: string;
        variable: string;
        claimed: string;
        correct: string;
        reason: string;
      }> = [];

      for (const calc of extracted) {
        const result = await verifyCalculation({
          operation: calc.operation,
          expression: calc.expression,
          variable: calc.variable,
          claimedResult: calc.claimedResult,
          gradeLevel: params.gradeLevel,
          steps: calc.steps,
          params: calc.params,
          questionText: calc.questionText,
        });

        if (!result) continue;

        if (!result.correct && result.confidence !== "low") {
          casMismatches++;
          const stepInfo =
            result.steps && result.steps.length > 0
              ? `\n  Steps: ${result.steps.map((s) => `[${s.operation}] ${s.input} → ${s.output} (${s.correct ? "ok" : "fail"})`).join("; ")}`
              : "";
          corrections.push({
            operation: calc.operation,
            expression: calc.expression,
            variable: calc.variable,
            claimed: calc.claimedResult,
            correct: result.computed ?? "unknown",
            reason: result.explanation + stepInfo,
          });
        }
      }

      if (corrections.length > 0) {
        const correctionBlock = corrections
          .map(
            (c) =>
              `- Operation: ${c.operation}\n  Expression: ${c.expression}\n  Your answer: ${c.claimed}\n  Correct answer: ${c.correct}\n  Reason: ${c.reason}`
          )
          .join("\n\n");

        const correctionPrompt =
          `Your answer contained incorrect calculation(s):\n\n${correctionBlock}\n\n` +
          `Please recompute and provide the corrected answer. Keep the same format and structure.`;

        const corrected = await sarvamChatCompletion({
          systemPrompt:
            `You are Prof-Pi, an expert tutor for Indian students (CBSE, JEE, NEET, KCET). ` +
            `You MUST correct the calculation errors identified below. Keep the same answer format with **Formula:**, **Steps:**, **Answer:** sections.${langClause}`,
          userContent: `Original question:\n${params.questionTitle}\n${params.questionBody}\n\nYour previous answer:\n${bodyOut}\n\n${correctionPrompt}`,
          temperature: getProfPiRetryTemperatureForRagKey(params.ragKey),
          maxTokens: getProfPiDesiredMaxTokens(),
          metricsLabel: "cas-correction",
        });

        if (corrected.ok && corrected.text.length > 40) {
          bodyOut = formatSarvamAssistantReply(corrected.text);
          if (params.ragKey === "physics") bodyOut = stripPhysicsNarration(bodyOut);
          console.info(`${logPrefix} CAS correction applied mismatches=${corrections.length}`);
        } else {
          bodyOut +=
            "\n\n> ⚠️ *Some calculations in this answer could not be verified. Please double-check.*";
          console.warn(`${logPrefix} CAS correction re-ask failed`);
        }
      }
    }
  }

  bodyOut = translateEnglishHeadersToRegional(bodyOut);

  if (lessonLang) {
    bodyOut = await ensureProfPiRegionalOutput({
      text: bodyOut,
      languageCode: lessonLang,
      metricsLabel: params.logLabel ? `${params.logLabel}-regional` : undefined,
    });
  }

  return {
    text: bodyOut,
    verifierRan: verified.ran,
    verifierOk: verified.ok,
    formulaCrossChecked,
    formulaMismatch,
    casVerified,
    casMismatches,
  };
}
