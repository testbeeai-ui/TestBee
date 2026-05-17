#!/usr/bin/env python3
from pathlib import Path

ROOT = Path(__file__).resolve().parents[1]
MC = ROOT / "components" / "teacher-portal" / "classroom" / "my-classroom"

INTERNAL_IMPORT_START = 'import type { MyClassroomViewProps } from "../types";'


def strip_auto_internal_imports(text: str) -> str:
    if INTERNAL_IMPORT_START not in text:
        return text
    lines = text.splitlines(keepends=True)
    out: list[str] = []
    skip = False
    for line in lines:
        if line.startswith(INTERNAL_IMPORT_START):
            skip = True
            continue
        if skip:
            if line.strip() == "":
                skip = False
            continue
        out.append(line)
    return "".join(out)


def main() -> None:
    # types re-export tab types from constants
    types_path = MC / "types.ts"
    types_text = types_path.read_text(encoding="utf-8")
    if 'from "./constants"' not in types_text:
        types_text += '\nexport type { DetailTab, MotivationMessageType, MotivationTarget } from "./constants";\n'
        types_path.write_text(types_text, encoding="utf-8")

    # wizard scores cache header
    scores = MC / "wizards" / "wizard-scores-cache.ts"
    scores.write_text(
        '''export const TEACHER_ASSIGNMENT_SCORES_CACHE_LS = "teacherPortal.assignmentScoresCache.v1";

export type TeacherWizardScoreRow = {
  userId: string;
  score: number;
  total: number;
  submittedAt: string | null;
};

'''
        + strip_auto_internal_imports(scores.read_text(encoding="utf-8")),
        encoding="utf-8",
    )

    # defaults
    defaults = MC / "defaults.ts"
    defaults.write_text(
        '''import type { TeacherPortalClassroomDetail } from "@/lib/teacherPortal/types";

export const emptyClassroomDetail: TeacherPortalClassroomDetail = {
  classroomId: "",
  sections: [],
  students: [],
  assignments: [],
  motivationLog: [],
  topStreakStudentIds: [],
};
''',
        encoding="utf-8",
    )

    # fix MyClassroomView imports
    main = MC / "MyClassroomView.tsx"
    text = main.read_text(encoding="utf-8")
    text = text.replace('from "../types"', 'from "./types"')
    text = text.replace('from "../wizard/constants"', 'from "./wizard/constants"')
    text = text.replace('from "../wizard/shell-persist"', 'from "./wizard/shell-persist"')
    if "emptyClassroomDetail" in text and './defaults"' not in text:
        text = text.replace(
            'import { normalizeTeacherMotivationExternalUrl } from "./utils/motivation-url";',
            'import { normalizeTeacherMotivationExternalUrl } from "./utils/motivation-url";\nimport { emptyClassroomDetail } from "./defaults";',
        )
    main.write_text(text, encoding="utf-8")

    # AssignmentCard helpers
    card = MC / "components" / "AssignmentCard.tsx"
    card_text = strip_auto_internal_imports(card.read_text(encoding="utf-8"))
    if "assignment/helpers" not in card_text:
        card_text = card_text.replace(
            '"use client";\n\n',
            '"use client";\n\nimport {\n  formatAssignmentCardDate,\n  primaryAssignmentBadge,\n  visibleTaskCountForCard,\n} from "../assignment/helpers";\nimport type { TeacherPortalAssignmentItem } from "@/lib/teacherPortal/types";\n\n',
            1,
        )
    card.write_text(card_text, encoding="utf-8")

    # StatCard - strip junk imports only
    stat = MC / "components" / "StatCard.tsx"
    stat.write_text(strip_auto_internal_imports(stat.read_text(encoding="utf-8")), encoding="utf-8")

    # wizards - add display + motivation imports where needed
    patches = {
        "TeacherAssignmentProgressWizard.tsx": 'import { formatRelativeTime, initials } from "../utils/display";\n',
        "TeacherCounselStudentWizard.tsx": (
            'import { formatOptionalPercent, initials, statusPill } from "../utils/display";\n'
            'import { normalizeTeacherMotivationExternalUrl } from "../utils/motivation-url";\n'
        ),
    }
    for name, extra in patches.items():
        p = MC / "wizards" / name
        t = strip_auto_internal_imports(p.read_text(encoding="utf-8"))
        if extra.strip().split("\n")[0] not in t:
            t = t.replace('"use client";\n\n', f'"use client";\n\n{extra}', 1)
        t = t.replace('from "../wizard/shell-persist"', 'from "../wizard/shell-persist.tsx"')
        # keep shell-persist without extension actually
        t = t.replace('from "../wizard/shell-persist.tsx"', 'from "../wizard/shell-persist"')
        p.write_text(t, encoding="utf-8")

    # shell-persist strip self-imports
    shell = MC / "wizard" / "shell-persist.tsx"
    shell.write_text(strip_auto_internal_imports(shell.read_text(encoding="utf-8")), encoding="utf-8")

    # strip from remaining tsx in my-classroom
    for path in MC.rglob("*.tsx"):
        if path.name == "MyClassroomView.tsx":
            continue
        original = path.read_text(encoding="utf-8")
        cleaned = strip_auto_internal_imports(original)
        if cleaned != original:
            path.write_text(cleaned, encoding="utf-8")

    print("fixed my-classroom split")


if __name__ == "__main__":
    main()
