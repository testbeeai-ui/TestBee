export type StudentAssignmentTaskHintInput = {
  kind: string;
  href?: string | null;
  visible_to_student?: boolean;
};

function visibleTasks(tasks: StudentAssignmentTaskHintInput[]): StudentAssignmentTaskHintInput[] {
  return tasks.filter((t) => t.visible_to_student !== false);
}

function isManualCustomTask(task: StudentAssignmentTaskHintInput): boolean {
  return task.kind === "free_text" && !task.href;
}

/** One-line student hint — matches real tracking (auto vs Mark as done). */
export function studentAssignmentActionHint(
  postType: string,
  tasks: StudentAssignmentTaskHintInput[]
): string {
  const list = visibleTasks(tasks);

  if (postType === "Concept Focus") {
    return "Open the lesson and finish the checklist on the topic page. Progress syncs automatically — nothing to tap here.";
  }

  if (list.length === 0) {
    return "Open the task below and finish what your teacher assigned.";
  }

  if (list.length === 1) {
    const task = list[0];
    switch (task.kind) {
      case "chapter_quiz":
        return "Start the quiz, answer every MCQ, and submit. Your score and completion save automatically.";
      case "mock_paper":
        return "Start the mock test and submit when you are done. Completion tracks automatically.";
      case "past_paper":
        return "Start the past paper and submit when you are done. Completion tracks automatically.";
      case "gyan_engagement":
        return "Open Gyan++ and post your doubt. This assignment completes automatically after you submit.";
      case "free_text":
        if (isManualCustomTask(task)) {
          return "Type your answer below and submit, or tap Mark as done if you finished offline.";
        }
        return "Open the link, complete the work, then mark as done here when finished.";
      case "topic_path":
        return "Open the lesson and complete the activities on that page. Progress syncs back here automatically.";
      case "bits":
      case "instacue":
      case "daily_dose":
        return "Open the practice activity and finish it. Completion tracks when you are done on that page.";
      default:
        if (task.href) {
          return "Open the task and complete it. Progress updates automatically when you finish.";
        }
        return "Complete this step, then tap Mark as done.";
    }
  }

  const hasQuiz = list.some(
    (t) => t.kind === "chapter_quiz" || t.kind === "mock_paper" || t.kind === "past_paper"
  );
  const hasGyan = list.some((t) => t.kind === "gyan_engagement");
  const hasManual = list.some(isManualCustomTask);
  const hasLinked = list.some((t) => Boolean(t.href) && !isManualCustomTask(t));

  const notes: string[] = ["Finish every task below."];
  if (hasQuiz) notes.push("Quizzes and mocks complete when you submit.");
  if (hasGyan) notes.push("Gyan++ completes when you post your doubt.");
  if (hasLinked) notes.push("Open each link and finish on that page — progress syncs back.");
  if (hasManual) notes.push("Custom instructions need a response or Mark as done.");

  return notes.join(" ");
}

export function studentAssignmentRewardHint(rewardRdm: number): string | null {
  const amount = Number.isFinite(rewardRdm) ? Math.max(0, Math.round(rewardRdm)) : 0;
  if (amount <= 0) return null;
  return `Earn +${amount} RDM when you finish before the due date.`;
}
