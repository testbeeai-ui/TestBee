#!/usr/bin/env python3
"""Split MyClassroomView and reorganize components/teacher-portal into subfolders."""

from __future__ import annotations

import re
import shutil
from pathlib import Path

ROOT = Path(__file__).resolve().parents[1]
TP = ROOT / "components" / "teacher-portal"
SRC = TP / "MyClassroomView.tsx"
MC = TP / "classroom" / "my-classroom"

# 1-based inclusive line ranges -> relative path under my-classroom/
SPLITS: list[tuple[str, int, int, bool]] = [
    ("utils/motivation-url.ts", 109, 141, False),
    ("types.ts", 143, 233, False),
    ("components/StatCard.tsx", 235, 243, True),
    ("wizard/constants.ts", 245, 395, False),
    ("wizard/shell-persist.ts", 397, 627, True),
    ("wizards/TeacherWizardPopup.tsx", 629, 2351, True),
    ("wizards/wizard-scores-cache.ts", 2352, 2413, False),
    ("wizards/TeacherAssignmentProgressWizard.tsx", 2414, 3183, True),
    ("wizards/TeacherNudgeWithRdmWizard.tsx", 3184, 4857, True),
    ("wizards/TeacherCounselStudentWizard.tsx", 4858, 5478, True),
    ("constants.ts", 5480, 5501, False),
    ("utils/display.ts", 5503, 5570, False),
    ("assignment/helpers.ts", 5571, 5632, False),
    ("components/AssignmentCard.tsx", 5633, 5720, True),
    ("MyClassroomView.tsx", 5721, 11353, True),
    ("components/TaskPreviewBody.tsx", 11355, 11618, True),
]

IMPORT_BLOCK_END = 107  # lines 1-107 from original

FILE_MOVES: list[tuple[str, str]] = [
    ("TeacherPortalShell.tsx", "shell/TeacherPortalShell.tsx"),
    ("TeacherVerificationGate.tsx", "shell/TeacherVerificationGate.tsx"),
    ("GyanWallView.tsx", "views/gyan/GyanWallView.tsx"),
    ("MyClassesView.tsx", "views/classes/MyClassesView.tsx"),
    ("ReferEarnView.tsx", "views/refer/ReferEarnView.tsx"),
    ("TeacherProfileView.tsx", "views/profile/TeacherProfileView.tsx"),
    ("AvatarCropDialog.tsx", "views/profile/AvatarCropDialog.tsx"),
    ("TeacherWalletView.tsx", "views/wallet/TeacherWalletView.tsx"),
    ("CreateTestsView.tsx", "views/tests/CreateTestsView.tsx"),
    ("GeneratedTestPreview.tsx", "views/tests/GeneratedTestPreview.tsx"),
    ("CreateAssignmentWizard.tsx", "assignment/CreateAssignmentWizard.tsx"),
    ("ChapterQuizAssignmentFields.tsx", "assignment/fields/ChapterQuizAssignmentFields.tsx"),
    ("ConceptFocusAssignmentFields.tsx", "assignment/fields/ConceptFocusAssignmentFields.tsx"),
    ("ConceptFocusSubtopicPreview.tsx", "assignment/fields/ConceptFocusSubtopicPreview.tsx"),
    ("DailyDoseStreakAssignmentFields.tsx", "assignment/fields/DailyDoseStreakAssignmentFields.tsx"),
    ("GyanEngagementAssignmentFields.tsx", "assignment/fields/GyanEngagementAssignmentFields.tsx"),
    ("ScheduleLiveSessionPanel.tsx", "live/ScheduleLiveSessionPanel.tsx"),
    ("MeetSessionsStack.tsx", "live/MeetSessionsStack.tsx"),
    ("WallTimeSelects.tsx", "live/WallTimeSelects.tsx"),
]


def read_lines() -> list[str]:
    return SRC.read_text(encoding="utf-8").splitlines(keepends=True)


def extract(lines: list[str], start: int, end: int) -> str:
    return "".join(lines[start - 1 : end])


def import_block(lines: list[str]) -> str:
    block = "".join(lines[:IMPORT_BLOCK_END])
    block = block.replace(
        'from "@/components/teacher-portal/MeetSessionsStack"',
        'from "@/components/teacher-portal/live/MeetSessionsStack"',
    )
    block = block.replace(
        'from "@/components/teacher-portal/ChapterQuizAssignmentFields"',
        'from "@/components/teacher-portal/assignment/fields/ChapterQuizAssignmentFields"',
    )
    block = block.replace(
        'from "@/components/teacher-portal/ConceptFocusAssignmentFields"',
        'from "@/components/teacher-portal/assignment/fields/ConceptFocusAssignmentFields"',
    )
    block = block.replace(
        'from "@/components/teacher-portal/ConceptFocusSubtopicPreview"',
        'from "@/components/teacher-portal/assignment/fields/ConceptFocusSubtopicPreview"',
    )
    block = block.replace(
        'from "@/components/teacher-portal/DailyDoseStreakAssignmentFields"',
        'from "@/components/teacher-portal/assignment/fields/DailyDoseStreakAssignmentFields"',
    )
    block = block.replace(
        'from "@/components/teacher-portal/GyanEngagementAssignmentFields"',
        'from "@/components/teacher-portal/assignment/fields/GyanEngagementAssignmentFields"',
    )
    block = block.replace(
        'from "@/components/teacher-portal/CreateAssignmentWizard"',
        'from "@/components/teacher-portal/assignment/CreateAssignmentWizard"',
    )
    block = block.replace(
        'from "@/components/teacher-portal/ScheduleLiveSessionPanel"',
        'from "@/components/teacher-portal/live/ScheduleLiveSessionPanel"',
    )
    block = block.replace(
        'from "@/components/teacher-portal/CreateTestsView"',
        'from "@/components/teacher-portal/views/tests/CreateTestsView"',
    )
    block = block.replace(
        'from "@/components/teacher-portal/WallTimeSelects"',
        'from "@/components/teacher-portal/live/WallTimeSelects"',
    )
    return block


def patch_split_body(rel: str, body: str) -> str:
    """Rewrite internal references for split modules."""
    body = body.replace("interface MyClassroomViewProps", "export interface MyClassroomViewProps")
    body = body.replace("type JoinRequestRow", "export type JoinRequestRow")
    body = body.replace("type ClassroomCohortTab", "export type ClassroomCohortTab")
    body = body.replace("type DetailTab", "export type DetailTab")
    body = body.replace("type MotivationMessageType", "export type MotivationMessageType")
    body = body.replace("type MotivationTarget", "export type MotivationTarget")

    if rel == "utils/motivation-url.ts":
        body = (
            "/** Same URL cleanup as counselling wizard — http(s) links only. */\n"
            + body.replace("function normalizeTeacherMotivationExternalUrl", "export function normalizeTeacherMotivationExternalUrl", 1)
        )
        body = body.replace(
            "function defaultDueDateIsoDaysAhead",
            "export function defaultDueDateIsoDaysAhead",
            1,
        )
        return body

    if rel == "components/StatCard.tsx":
        body = body.replace("function StatCard", "export function StatCard", 1)
        return body

    if rel == "wizard/constants.ts":
        body = body.replace("type WizardTask", "export type WizardTask", 1)
        body = body.replace("const WIZARD_TASKS", "export const WIZARD_TASKS", 1)
        return body

    if rel == "wizard/shell-persist.ts":
        for name in [
            "coerceTPSubject",
            "coerceTPPuc",
            "coerceTPExam",
            "normalizeWizardShellSteps",
            "readWizardShellPersisted",
            "writeWizardShellPersisted",
            "defaultWizardShellPersisted",
            "buildWizardShellInitialState",
            "ClassroomHelpChip",
        ]:
            body = body.replace(f"function {name}", f"export function {name}", 1)
        body = body.replace("type TPWizardSubject", "export type TPWizardSubject", 1)
        body = body.replace("type TPWizardPuc", "export type TPWizardPuc", 1)
        body = body.replace("type TPWizardExam", "export type TPWizardExam", 1)
        body = body.replace("type WizardSectionDraftPersist", "export type WizardSectionDraftPersist", 1)
        body = body.replace("type WizardShellPersistedV2", "export type WizardShellPersistedV2", 1)
        return body

    if rel == "wizards/TeacherWizardPopup.tsx":
        body = body.replace("function TeacherWizardPopup", "export function TeacherWizardPopup", 1)
        return body

    if rel == "wizards/wizard-scores-cache.ts":
        for name in [
            "mergeTeacherWizardScores",
            "readTeacherWizardScoresCache",
            "writeTeacherWizardScoresCache",
        ]:
            body = body.replace(f"function {name}", f"export function {name}", 1)
        return body

    if rel == "wizards/TeacherAssignmentProgressWizard.tsx":
        body = body.replace(
            "function TeacherAssignmentProgressWizard",
            "export function TeacherAssignmentProgressWizard",
            1,
        )
        return body

    if rel == "wizards/TeacherNudgeWithRdmWizard.tsx":
        body = body.replace(
            "const TeacherNudgeWithRdmWizard = forwardRef",
            "export const TeacherNudgeWithRdmWizard = forwardRef",
            1,
        )
        body = body.replace(
            "type TeacherNudgeWithRdmWizardProps",
            "export type TeacherNudgeWithRdmWizardProps",
            1,
        )
        return body

    if rel == "wizards/TeacherCounselStudentWizard.tsx":
        body = body.replace(
            "function TeacherCounselStudentWizard",
            "export function TeacherCounselStudentWizard",
            1,
        )
        return body

    if rel == "constants.ts":
        body = body.replace("const SUBJECT_OPTIONS", "export const SUBJECT_OPTIONS", 1)
        body = body.replace("const PUC_OPTIONS", "export const PUC_OPTIONS", 1)
        body = body.replace("const EXAM_OPTIONS", "export const EXAM_OPTIONS", 1)
        body = body.replace("const WEEKDAYS", "export const WEEKDAYS", 1)
        body = body.replace("const SHOW_CLASSROOM_SCHEDULE_FORM", "export const SHOW_CLASSROOM_SCHEDULE_FORM", 1)
        return body

    if rel == "utils/display.ts":
        for name in [
            "initials",
            "formatOptionalPercent",
            "statusPill",
            "formatRelativeTime",
            "recommendedAction",
            "actionLabel",
            "actionClass",
            "messageTemplate",
        ]:
            body = body.replace(f"function {name}", f"export function {name}", 1)
        return body

    if rel == "assignment/helpers.ts":
        for name in [
            "getAssignmentTags",
            "formatAssignmentCardDate",
            "isTeacherAssignmentPastDue",
            "primaryAssignmentBadge",
            "visibleTaskCountForCard",
        ]:
            body = body.replace(f"function {name}", f"export function {name}", 1)
        return body

    if rel == "components/AssignmentCard.tsx":
        body = body.replace("function AssignmentCard", "export function AssignmentCard", 1)
        return body

    if rel == "components/TaskPreviewBody.tsx":
        body = body.replace("function restoreLatexEscapes", "export function restoreLatexEscapes", 1)
        body = body.replace("function TaskPreviewBody", "export function TaskPreviewBody", 1)
        return body

    if rel == "MyClassroomView.tsx":
        body = body.replace(
            "export default function MyClassroomView",
            "export default function MyClassroomView",
            1,
        )
        return body

    return body


def build_internal_imports(rel: str) -> str:
    parts: list[str] = []
    parts.append('import type { MyClassroomViewProps } from "../types";')

    needs_types = rel != "types.ts"
    if needs_types and rel not in ("utils/motivation-url.ts", "constants.ts", "wizard/constants.ts"):
        parts.append(
            'import type { JoinRequestRow, ClassroomCohortTab, DetailTab, MotivationMessageType, MotivationTarget } from "../types";'
        )

    if "wizard" in rel or "wizards" in rel or rel == "MyClassroomView.tsx":
        parts.append('import { WIZARD_TASKS, type WizardTask } from "../wizard/constants";')
        parts.append(
            'import { buildWizardShellInitialState, ClassroomHelpChip, readWizardShellPersisted, writeWizardShellPersisted, type WizardShellPersistedV2, type WizardSectionDraftPersist } from "../wizard/shell-persist";'
        )

    if rel.startswith("wizards/"):
        parts.append('import { SUBJECT_OPTIONS, PUC_OPTIONS, EXAM_OPTIONS } from "../constants";')
        parts.append('import { defaultDueDateIsoDaysAhead } from "../utils/motivation-url";')

    if rel == "wizards/TeacherWizardPopup.tsx":
        parts.append('import { TeacherNudgeWithRdmWizard, type TeacherNudgeWithRdmWizardHandle } from "./TeacherNudgeWithRdmWizard";')
        parts.append('import { TeacherAssignmentProgressWizard } from "./TeacherAssignmentProgressWizard";')
        parts.append('import { TeacherCounselStudentWizard } from "./TeacherCounselStudentWizard";')

    if rel == "wizards/TeacherAssignmentProgressWizard.tsx":
        parts.append('import { mergeTeacherWizardScores, readTeacherWizardScoresCache, writeTeacherWizardScoresCache } from "./wizard-scores-cache";')

    if rel == "MyClassroomView.tsx":
        parts.append('import { StatCard } from "./components/StatCard";')
        parts.append('import { AssignmentCard } from "./components/AssignmentCard";')
        parts.append('import { TaskPreviewBody } from "./components/TaskPreviewBody";')
        parts.append('import { TeacherWizardPopup } from "./wizards/TeacherWizardPopup";')
        parts.append(
            'import { SUBJECT_OPTIONS, PUC_OPTIONS, EXAM_OPTIONS, WEEKDAYS, SHOW_CLASSROOM_SCHEDULE_FORM } from "./constants";'
        )
        parts.append('import * as display from "./utils/display";')
        parts.append('import * as assignmentHelpers from "./assignment/helpers";')
        parts.append('import { normalizeTeacherMotivationExternalUrl } from "./utils/motivation-url";')

    return "\n".join(parts) + "\n\n"


def write_split_files(lines: list[str], imp: str) -> None:
    MC.mkdir(parents=True, exist_ok=True)
    for rel, start, end, use_client in SPLITS:
        out = MC / rel
        out.parent.mkdir(parents=True, exist_ok=True)
        body = patch_split_body(rel, extract(lines, start, end))

        if rel == "types.ts":
            content = body
        elif use_client:
            internal = build_internal_imports(rel)
            content = imp + internal + body
        else:
            content = body

        if use_client and not content.lstrip().startswith('"use client"'):
            content = '"use client";\n\n' + content

        out.write_text(content, encoding="utf-8")
        print(f"wrote {out.relative_to(ROOT)}")


def move_portal_files() -> None:
    for src_name, dest_rel in FILE_MOVES:
        src = TP / src_name
        dest = TP / dest_rel
        if not src.exists():
            print(f"skip missing {src_name}")
            continue
        dest.parent.mkdir(parents=True, exist_ok=True)
        shutil.move(str(src), str(dest))
        print(f"moved {src_name} -> {dest_rel}")


def rewrite_imports_in_file(path: Path) -> None:
    text = path.read_text(encoding="utf-8")
    replacements = [
        (r'@/components/teacher-portal/MyClassroomView"', '@/components/teacher-portal/classroom/my-classroom/MyClassroomView"'),
        (r'@/components/teacher-portal/MeetSessionsStack', '@/components/teacher-portal/live/MeetSessionsStack'),
        (r'@/components/teacher-portal/ChapterQuizAssignmentFields', '@/components/teacher-portal/assignment/fields/ChapterQuizAssignmentFields'),
        (r'@/components/teacher-portal/ConceptFocusAssignmentFields', '@/components/teacher-portal/assignment/fields/ConceptFocusAssignmentFields'),
        (r'@/components/teacher-portal/ConceptFocusSubtopicPreview', '@/components/teacher-portal/assignment/fields/ConceptFocusSubtopicPreview'),
        (r'@/components/teacher-portal/DailyDoseStreakAssignmentFields', '@/components/teacher-portal/assignment/fields/DailyDoseStreakAssignmentFields'),
        (r'@/components/teacher-portal/GyanEngagementAssignmentFields', '@/components/teacher-portal/assignment/fields/GyanEngagementAssignmentFields'),
        (r'@/components/teacher-portal/CreateAssignmentWizard', '@/components/teacher-portal/assignment/CreateAssignmentWizard'),
        (r'@/components/teacher-portal/ScheduleLiveSessionPanel', '@/components/teacher-portal/live/ScheduleLiveSessionPanel'),
        (r'@/components/teacher-portal/CreateTestsView', '@/components/teacher-portal/views/tests/CreateTestsView'),
        (r'@/components/teacher-portal/GeneratedTestPreview', '@/components/teacher-portal/views/tests/GeneratedTestPreview'),
        (r'@/components/teacher-portal/WallTimeSelects', '@/components/teacher-portal/live/WallTimeSelects'),
        (r'@/components/teacher-portal/AvatarCropDialog', '@/components/teacher-portal/views/profile/AvatarCropDialog'),
        (r'@/components/teacher-portal/TeacherPortalShell', '@/components/teacher-portal/shell/TeacherPortalShell'),
        (r'@/components/teacher-portal/TeacherVerificationGate', '@/components/teacher-portal/shell/TeacherVerificationGate'),
        (r'@/components/teacher-portal/GyanWallView', '@/components/teacher-portal/views/gyan/GyanWallView'),
        (r'@/components/teacher-portal/MyClassesView', '@/components/teacher-portal/views/classes/MyClassesView'),
        (r'@/components/teacher-portal/ReferEarnView', '@/components/teacher-portal/views/refer/ReferEarnView'),
        (r'@/components/teacher-portal/TeacherProfileView', '@/components/teacher-portal/views/profile/TeacherProfileView'),
        (r'@/components/teacher-portal/TeacherWalletView', '@/components/teacher-portal/views/wallet/TeacherWalletView'),
    ]
    for old, new in replacements:
        text = text.replace(old, new)
    path.write_text(text, encoding="utf-8")


def create_shims() -> None:
    shims: dict[str, str] = {
        "MyClassroomView.tsx": 'export { default } from "./classroom/my-classroom/MyClassroomView";\nexport type { MyClassroomViewProps } from "./classroom/my-classroom/types";\nexport type { TeacherNudgeWithRdmWizardHandle } from "./classroom/my-classroom/wizards/TeacherNudgeWithRdmWizard";\n',
        "TeacherPortalShell.tsx": 'export { default } from "./shell/TeacherPortalShell";\n',
        "TeacherVerificationGate.tsx": 'export { default } from "./shell/TeacherVerificationGate";\n',
        "GyanWallView.tsx": 'export { default } from "./views/gyan/GyanWallView";\n',
        "MyClassesView.tsx": 'export { default } from "./views/classes/MyClassesView";\n',
        "ReferEarnView.tsx": 'export { default } from "./views/refer/ReferEarnView";\n',
        "TeacherProfileView.tsx": 'export { default } from "./views/profile/TeacherProfileView";\n',
        "AvatarCropDialog.tsx": 'export { AvatarCropDialog } from "./views/profile/AvatarCropDialog";\n',
        "TeacherWalletView.tsx": 'export { default } from "./views/wallet/TeacherWalletView";\n',
        "CreateTestsView.tsx": 'export { default } from "./views/tests/CreateTestsView";\n',
        "GeneratedTestPreview.tsx": 'export { default } from "./views/tests/GeneratedTestPreview";\n',
        "CreateAssignmentWizard.tsx": 'export { default } from "./assignment/CreateAssignmentWizard";\n',
        "ChapterQuizAssignmentFields.tsx": 'export { default } from "./assignment/fields/ChapterQuizAssignmentFields";\n',
        "ConceptFocusAssignmentFields.tsx": 'export * from "./assignment/fields/ConceptFocusAssignmentFields";\n',
        "ConceptFocusSubtopicPreview.tsx": 'export { default } from "./assignment/fields/ConceptFocusSubtopicPreview";\n',
        "DailyDoseStreakAssignmentFields.tsx": 'export { default } from "./assignment/fields/DailyDoseStreakAssignmentFields";\n',
        "GyanEngagementAssignmentFields.tsx": 'export { default } from "./assignment/fields/GyanEngagementAssignmentFields";\n',
        "ScheduleLiveSessionPanel.tsx": 'export { default } from "./live/ScheduleLiveSessionPanel";\nexport type { ScheduleLiveSessionPayload } from "./live/ScheduleLiveSessionPanel";\n',
        "MeetSessionsStack.tsx": 'export { default } from "./live/MeetSessionsStack";\n',
        "WallTimeSelects.tsx": 'export { default } from "./live/WallTimeSelects";\n',
    }
    for name, content in shims.items():
        path = TP / name
        path.write_text(content, encoding="utf-8")
        print(f"shim {name}")


def create_index() -> None:
    index = '''/**
 * Teacher portal components — organized by domain.
 * Legacy import paths (@/components/teacher-portal/X) remain via re-export shims.
 */
export { default as MyClassroomView } from "./classroom/my-classroom/MyClassroomView";
export type { MyClassroomViewProps } from "./classroom/my-classroom/types";
export type { TeacherNudgeWithRdmWizardHandle } from "./classroom/my-classroom/wizards/TeacherNudgeWithRdmWizard";

export { default as TeacherPortalShell } from "./shell/TeacherPortalShell";
export { default as TeacherVerificationGate } from "./shell/TeacherVerificationGate";

export { default as GyanWallView } from "./views/gyan/GyanWallView";
export { default as MyClassesView } from "./views/classes/MyClassesView";
export { default as ReferEarnView } from "./views/refer/ReferEarnView";
export { default as TeacherProfileView } from "./views/profile/TeacherProfileView";
export { AvatarCropDialog } from "./views/profile/AvatarCropDialog";
export { default as TeacherWalletView } from "./views/wallet/TeacherWalletView";
export { default as CreateTestsView } from "./views/tests/CreateTestsView";
export { default as GeneratedTestPreview } from "./views/tests/GeneratedTestPreview";

export { default as CreateAssignmentWizard } from "./assignment/CreateAssignmentWizard";
export { default as ChapterQuizAssignmentFields } from "./assignment/fields/ChapterQuizAssignmentFields";
export * from "./assignment/fields/ConceptFocusAssignmentFields";
export { default as ConceptFocusSubtopicPreview } from "./assignment/fields/ConceptFocusSubtopicPreview";
export { default as DailyDoseStreakAssignmentFields } from "./assignment/fields/DailyDoseStreakAssignmentFields";
export { default as GyanEngagementAssignmentFields } from "./assignment/fields/GyanEngagementAssignmentFields";

export { default as ScheduleLiveSessionPanel } from "./live/ScheduleLiveSessionPanel";
export type { ScheduleLiveSessionPayload } from "./live/ScheduleLiveSessionPanel";
export { default as MeetSessionsStack } from "./live/MeetSessionsStack";
export { default as WallTimeSelects } from "./live/WallTimeSelects";
'''
    (TP / "index.ts").write_text(index, encoding="utf-8")


def patch_main_view(path: Path) -> None:
    text = path.read_text(encoding="utf-8")
    display_fns = [
        "initials",
        "formatOptionalPercent",
        "statusPill",
        "formatRelativeTime",
        "recommendedAction",
        "actionLabel",
        "actionClass",
        "messageTemplate",
    ]
    helper_fns = [
        "getAssignmentTags",
        "formatAssignmentCardDate",
        "isTeacherAssignmentPastDue",
        "primaryAssignmentBadge",
        "visibleTaskCountForCard",
    ]
    for fn in display_fns:
        text = re.sub(rf"(?<![\w.]){fn}\(", rf"display.{fn}(", text)
    for fn in helper_fns:
        text = re.sub(rf"(?<![\w.]){fn}\(", rf"assignmentHelpers.{fn}(", text)
    path.write_text(text, encoding="utf-8")


def patch_types(path: Path) -> None:
    text = path.read_text(encoding="utf-8")
    header = '''import type { AssignmentTaskStored } from "@/lib/classroom/assignmentTasks";
import type { ScheduleLiveSessionPayload } from "@/components/teacher-portal/live/ScheduleLiveSessionPanel";
import type {
  TeacherPortalAssignmentItem,
  TeacherPortalClassroomCard,
  TeacherPortalClassroomDetail,
  TeacherPortalChapterQuizRef,
  TeacherPortalDailyDoseStreakRef,
  TeacherPortalGyanEngagementRef,
  TeacherPortalMockNudgeLowScorer,
  TeacherPortalMockNudgeSubmittedAttempt,
  TeacherPortalMockPaperRef,
  TeacherPortalSummary,
} from "@/lib/teacherPortal/types";
import type { MotivationNudgeGoal, MotivationRecommendActionId } from "@/lib/teacherPortal/queries";

'''
    if "import type { AssignmentTaskStored }" not in text:
        text = header + text
    path.write_text(text, encoding="utf-8")


def main() -> None:
    if not SRC.exists():
        raise SystemExit(f"Missing {SRC}")

    lines = read_lines()
    imp = import_block(lines)

    # Backup original once
    backup = TP / "MyClassroomView.tsx.bak"
    if not backup.exists():
        shutil.copy2(SRC, backup)

    write_split_files(lines, imp)
    patch_types(MC / "types.ts")
    patch_main_view(MC / "MyClassroomView.tsx")
    move_portal_files()

    # Remove monolith (shim replaces it)
    if SRC.exists() and SRC.stat().st_size > 500_000:
        SRC.unlink()

    create_shims()
    create_index()

    # Rewrite imports in moved + split files
    for path in TP.rglob("*.tsx"):
        rewrite_imports_in_file(path)
    for path in TP.rglob("*.ts"):
        rewrite_imports_in_file(path)

    for path in (ROOT / "app").rglob("*.{tsx,ts}"):
        pass
    for path in list((ROOT / "app").rglob("*.tsx")) + list((ROOT / "app").rglob("*.ts")):
        rewrite_imports_in_file(path)

    print("done")


if __name__ == "__main__":
    main()
