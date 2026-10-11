export type PyqSittingMode = "practice" | "test";

export type PyqInPaperAssists = {
  /** The in-paper Solution control. Always off — see below. */
  solution: boolean;
  /** The in-paper Tips and Formula's sheets. */
  coach: boolean;
};

/**
 * What a sitting may open while the questions are on screen.
 *
 * **Solution: neither mode.** The worked write-up belongs to the review *after submit*, which is
 * the only place a student reads it. Keeping it off in both modes is what stops the answer key
 * being opened while the clock is running. This field is deliberately always `false` and is kept
 * as a tested guard rather than dropped, so re-enabling the in-paper button has to break a test.
 *
 * **Tips / Formula's: practice only.** They hand over the method, so a paced test gets neither,
 * while practice keeps them — reading the method is the point of practising.
 *
 * The chapter session is the only caller that ever turned the Solution on, so gating it here
 * retires the in-paper button across the app. Full mocks already mount the shell with
 * `showSolution` off and `showCoach` on, which is why the two stay separate flags.
 */
export function pyqInPaperAssists(mode: PyqSittingMode): PyqInPaperAssists {
  return { solution: false, coach: mode === "practice" };
}
