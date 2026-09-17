/**
 * Exam and results both cover the viewport. After submit, dumping
 * `ChapterPyqResultView` into the list/practice page flow hides the score
 * behind the chapter grid (or clips it inside the practice card).
 */
export const PYQ_EXAM_SESSION_OVERLAY_CLASS = "fixed inset-0 z-[200] flex flex-col";

export const PYQ_RESULT_SESSION_OVERLAY_CLASS =
  "fixed inset-0 z-[200] overflow-y-auto bg-background";
