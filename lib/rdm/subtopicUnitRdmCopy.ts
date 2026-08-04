/**
 * Finish-summary / tip copy for Quiz set + Numerals pack RDM.
 *
 * Product rule: +N per-unit RDM only on the **first** quiz set / first formula pack
 * (with ≥60%). Later units do not earn per-unit RDM; overall still when all done ≥60%.
 */

export function isFirstQuizSetForRdm(quizSet: number): boolean {
  return quizSet === 1;
}

/** First formula index that has practice questions (UI order). */
export function firstNumeralsPackIndexForRdm(
  formulas: ReadonlyArray<{ bitsQuestions?: unknown[] | null }>
): number | null {
  for (let i = 0; i < formulas.length; i++) {
    if ((formulas[i]?.bitsQuestions?.length ?? 0) > 0) return i;
  }
  return null;
}

export function isFirstNumeralsPackForRdm(
  formulaIndex: number,
  formulas: ReadonlyArray<{ bitsQuestions?: unknown[] | null }>
): boolean {
  const first = firstNumeralsPackIndexForRdm(formulas);
  return first != null && formulaIndex === first;
}

export function quizFinishRdmLabel(input: {
  setIndex: number;
  setPct: number;
  setRdm: number;
  overallRdm: number;
  isLastSet: boolean;
  creditedParts: string[];
  setAlreadyClaimed?: boolean;
  overallAlreadyClaimed?: boolean;
  overallBelowThreshold?: boolean;
}): string {
  const {
    setIndex,
    setPct,
    setRdm,
    overallRdm,
    isLastSet,
    creditedParts,
    setAlreadyClaimed,
    overallAlreadyClaimed,
    overallBelowThreshold,
  } = input;

  if (creditedParts.length > 0) {
    return `${creditedParts.join(" · ")} credited`;
  }

  if (overallAlreadyClaimed) {
    return "Already claimed for this subtopic";
  }

  const isFirst = isFirstQuizSetForRdm(setIndex);

  if (isFirst) {
    if (setAlreadyClaimed) {
      return isLastSet
        ? overallBelowThreshold
          ? `Requires ≥60% overall for +${overallRdm}`
          : `Set 1 bonus already claimed · overall +${overallRdm} if ≥60%`
        : `Set 1 bonus already claimed · overall +${overallRdm} when all sets ≥60%`;
    }
    if (setPct < 60) {
      return isLastSet
        ? `Requires ≥60% on set 1 for +${setRdm} · overall +${overallRdm} if ≥60%`
        : `Requires ≥60% on set 1 for +${setRdm}`;
    }
    if (isLastSet && overallBelowThreshold) {
      return `Requires ≥60% overall for +${overallRdm}`;
    }
    return isLastSet
      ? `Overall +${overallRdm} if ≥60%`
      : `Overall +${overallRdm} when all sets ≥60%`;
  }

  // Set 2+ — no per-set +N; nudge toward overall completion bonus
  if (isLastSet) {
    if (overallBelowThreshold) {
      return `Requires ≥60% overall for +${overallRdm}`;
    }
    return `Complete all sets · earn +${overallRdm} RDM (≥60% overall)`;
  }
  return `Complete all sets · earn +${overallRdm} RDM (≥60% overall)`;
}

export function numeralsFinishRdmLabel(input: {
  isFirstPack: boolean;
  packPct: number;
  formulaRdm: number;
  overallRdm: number;
  allPacksSubmitted: boolean;
  creditedParts: string[];
  formulaAlreadyClaimed?: boolean;
  overallAlreadyClaimed?: boolean;
  overallBelowThreshold?: boolean;
}): string {
  const {
    isFirstPack,
    packPct,
    formulaRdm,
    overallRdm,
    allPacksSubmitted,
    creditedParts,
    formulaAlreadyClaimed,
    overallAlreadyClaimed,
    overallBelowThreshold,
  } = input;

  if (creditedParts.length > 0) {
    return `${creditedParts.join(" · ")} credited`;
  }

  if (overallAlreadyClaimed) {
    return "Already claimed for this subtopic";
  }

  if (isFirstPack) {
    if (formulaAlreadyClaimed) {
      return allPacksSubmitted
        ? overallBelowThreshold
          ? `Requires ≥60% overall for +${overallRdm}`
          : `First-pack bonus already claimed · overall +${overallRdm} if ≥60%`
        : `First-pack bonus already claimed · overall +${overallRdm} when all packs ≥60%`;
    }
    if (packPct < 60) {
      return allPacksSubmitted
        ? `Requires ≥60% on first pack for +${formulaRdm} · overall +${overallRdm} if ≥60%`
        : `Requires ≥60% on first pack for +${formulaRdm}`;
    }
    if (allPacksSubmitted && overallBelowThreshold) {
      return `Requires ≥60% overall for +${overallRdm}`;
    }
    return allPacksSubmitted
      ? `Overall +${overallRdm} if ≥60%`
      : `Overall +${overallRdm} when all packs ≥60%`;
  }

  // Later packs — no per-pack +N; nudge toward overall completion bonus
  if (allPacksSubmitted) {
    if (overallBelowThreshold) {
      return `Requires ≥60% overall for +${overallRdm}`;
    }
    return `Complete all packs · earn +${overallRdm} RDM (≥60% overall)`;
  }
  return `Complete all packs · earn +${overallRdm} RDM (≥60% overall)`;
}

export function quizRdmTipLines(setRdm: number, overallRdm: number): string[] {
  return [
    `+${setRdm} RDM on set 1 when ≥60% (once per subtopic)`,
    `+${overallRdm} RDM overall when all sets are done with ≥60% (once per subtopic)`,
  ];
}

export function numeralsRdmTipLines(formulaRdm: number, overallRdm: number): string[] {
  return [
    `+${formulaRdm} RDM on the first formula pack when ≥60% (once per subtopic)`,
    `+${overallRdm} RDM overall when all packs are done with ≥60% (once per subtopic)`,
  ];
}
