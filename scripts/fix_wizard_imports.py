#!/usr/bin/env python3
from pathlib import Path

MC = Path(__file__).resolve().parents[1] / "components" / "teacher-portal" / "classroom" / "my-classroom"

INSERTS: dict[str, str] = {
    "wizards/TeacherWizardPopup.tsx": '''
import type { MyClassroomViewProps } from "../types";
import { WIZARD_TASKS } from "../wizard/constants";
import {
  buildWizardShellInitialState,
  writeWizardShellPersisted,
  type WizardShellPersistedV2,
  type WizardSectionDraftPersist,
  type TPWizardSubject,
  type TPWizardPuc,
  type TPWizardExam,
} from "../wizard/shell-persist";
import { SUBJECT_OPTIONS, PUC_OPTIONS, EXAM_OPTIONS } from "../constants";
import { TeacherNudgeWithRdmWizard, type TeacherNudgeWithRdmWizardHandle } from "./TeacherNudgeWithRdmWizard";
import { TeacherAssignmentProgressWizard } from "./TeacherAssignmentProgressWizard";
import { TeacherCounselStudentWizard } from "./TeacherCounselStudentWizard";
''',
    "wizards/TeacherAssignmentProgressWizard.tsx": '''
import type { MyClassroomViewProps } from "../types";
import {
  mergeTeacherWizardScores,
  readTeacherWizardScoresCache,
  writeTeacherWizardScoresCache,
  type TeacherWizardScoreRow,
} from "./wizard-scores-cache";
import { formatRelativeTime, initials } from "../utils/display";
''',
    "wizards/TeacherNudgeWithRdmWizard.tsx": '''
import type { MyClassroomViewProps } from "../types";
import { defaultDueDateIsoDaysAhead, normalizeTeacherMotivationExternalUrl } from "../utils/motivation-url";
''',
    "wizards/TeacherCounselStudentWizard.tsx": '''
import type { MyClassroomViewProps } from "../types";
import { formatOptionalPercent, initials, statusPill } from "../utils/display";
import { normalizeTeacherMotivationExternalUrl } from "../utils/motivation-url";
''',
    "wizard/shell-persist.tsx": '''
import { WIZARD_TASKS } from "./constants";
''',
}


def insert_after_external_imports(path: Path, insert: str) -> None:
    text = path.read_text(encoding="utf-8")
    marker = 'import { assignmentItemIsNudgeMcqTarget } from "@/lib/teacherPortal/nudgeMcqPosts";'
    if insert.strip() in text:
        return
    if marker not in text:
        raise RuntimeError(f"marker missing in {path}")
    text = text.replace(marker, marker + "\n" + insert, 1)
    path.write_text(text, encoding="utf-8")


def slim_assignment_card() -> None:
    path = MC / "components" / "AssignmentCard.tsx"
    path.write_text(
        '''"use client";

import type { TeacherPortalAssignmentItem, TeacherPortalClassroomSection } from "@/lib/teacherPortal/types";
import {
  formatAssignmentCardDate,
  primaryAssignmentBadge,
  visibleTaskCountForCard,
} from "../assignment/helpers";

export function AssignmentCard({
  item,
  onOpen,
  progress,
  sections,
}: {
  item: TeacherPortalAssignmentItem;
  onOpen: () => void;
  progress?: { completionPercent: number; completedCount: number; totalCount: number };
  sections: TeacherPortalClassroomSection[];
}) {
''',
        encoding="utf-8",
    )
    # append body from line 122 onwards of current file
    old = path.read_text(encoding="utf-8")
    # read broken file - get from backup extract
    backup_card = None
    full = (MC.parent.parent / "MyClassroomView.tsx.bak").read_text(encoding="utf-8").splitlines()
    start = next(i for i, l in enumerate(full) if l.startswith("function AssignmentCard"))
    end = next(i for i, l in enumerate(full) if i > start and l.startswith("const emptyClassroomDetail"))
    body_lines = full[start + 10 : end]  # skip function signature lines
    path.write_text(
        path.read_text(encoding="utf-8").rstrip()
        + "\n"
        + "\n".join(body_lines)
        + "\n",
        encoding="utf-8",
    )


def slim_stat_card() -> None:
    (MC / "components" / "StatCard.tsx").write_text(
        '''"use client";

export function StatCard(props: { label: string; value: string; sub: string; accent: string }) {
  return (
    <motion.div className="rounded-xl border border-white/10 bg-[#15162b] p-2.5 sm:p-3">
      <div className="text-[10px] uppercase tracking-widest text-slate-500">{props.label}</motion.div>
      <div className={`mt-1 font-serif text-2xl sm:text-3xl ${props.accent}`}>{props.value}</motion.div>
      <div className="text-xs text-slate-400">{props.sub}</motion.div>
    </motion.div>
  );
}
'''.replace("motion.div", "motion.div").replace("motion.div", "div"),
        encoding="utf-8",
    )
    text = (MC / "components" / "StatCard.tsx").read_text(encoding="utf-8")
    text = text.replace("motion.div", "div")
    (MC / "components" / "StatCard.tsx").write_text(text, encoding="utf-8")


def main() -> None:
    for rel, insert in INSERTS.items():
        insert_after_external_imports(MC / rel, insert)

    slim_stat_card()

    # Assignment card from backup
    full_lines = (MC.parent.parent / "MyClassroomView.tsx.bak").read_text(encoding="utf-8").splitlines()
    start = next(i for i, l in enumerate(full_lines) if l.strip().startswith("function AssignmentCard"))
    end = next(i for i, l in enumerate(full_lines) if i > start and l.strip().startswith("const emptyClassroomDetail"))
    body = "\n".join(full_lines[start:end]) + "\n"
    body = body.replace("function AssignmentCard", "export function AssignmentCard", 1)
    header = '''"use client";

import type { TeacherPortalAssignmentItem, TeacherPortalClassroomSection } from "@/lib/teacherPortal/types";
import {
  formatAssignmentCardDate,
  primaryAssignmentBadge,
  visibleTaskCountForCard,
} from "../assignment/helpers";

'''
    (MC / "components" / "AssignmentCard.tsx").write_text(header + body, encoding="utf-8")
    print("wizard imports fixed")


if __name__ == "__main__":
    main()
