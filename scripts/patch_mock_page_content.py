"""Patch MockPageContent.tsx for route split and extracted components."""
from pathlib import Path
import re

ROOT = Path(__file__).resolve().parents[1]
p = ROOT / "components/prep-mock/MockPageContent.tsx"
lines = p.read_text(encoding="utf-8").splitlines()

# Remove lines 102-353 (constants, types, latex helpers) — 1-based 102-353
lines = lines[:101] + lines[353:]

# Remove MockPage default export at end
out_lines = []
i = 0
while i < len(lines):
    if lines[i].startswith("export default function MockPage"):
        break
    out_lines.append(lines[i])
    i += 1
lines = out_lines

text = "\n".join(lines)

extra_imports = """
import { QUICK_DURATIONS, FEATURED_DASHBOARD_PYQ_SLUG, subjectEmojis } from "@/components/prep-mock/constants";
import type {
  MockPageMode,
  MockView,
  NtaExamKind,
  LibraryCollectionTab,
  PaperSource,
  NtaPendingExamMeta,
} from "@/components/prep-mock/types";
import { ReviewInlineHtml, formatMockExamTime } from "@/components/prep-mock/utils/mockLatexReview";
import MockTestLibraryView from "@/components/prep-mock/library/MockTestLibraryView";
import PrepMockDashboardView from "@/components/prep-mock/dashboard/PrepMockDashboardView";
"""

if "prep-mock/constants" not in text:
    text = text.replace(
        'import { mergeAllSavedContent } from "@/lib/mergeSavedContent";',
        'import { mergeAllSavedContent } from "@/lib/mergeSavedContent";' + extra_imports,
    )

text = re.sub(r"import katex from \"katex\";\n", "", text)

text = text.replace(
    """export type MockPageContentProps = {
  /** When true, opens straight to the mock test library (past / mock / quick) and “Back” returns to the student dashboard. */
  libraryStandalone?: boolean;
};""",
    """export type MockPageContentProps = {
  /** `dashboard` = Prep + Mock hub (`/mock`); `library` = mock test library + exam (`/mock-test`). */
  pageMode?: MockPageMode;
};""",
)

text = text.replace(
    "export function MockPageContent({ libraryStandalone = false }: MockPageContentProps = {}) {",
    """export function MockPageContent({ pageMode = "dashboard" }: MockPageContentProps = {}) {
  const isLibraryPage = pageMode === "library";""",
)

text = text.replace("libraryStandalone", "isLibraryPage")
text = text.replace("formatTime(", "formatMockExamTime(")

# Dashboard-only: redirect deep links and setup view to /mock-test
redirect_block = """
  useEffect(() => {
    if (isLibraryPage) return;
    if (deepLinkPaperSlug) {
      const q = new URLSearchParams();
      q.set("paper", deepLinkPaperSlug);
      if (classroomIdParam) q.set("classroomId", classroomIdParam);
      if (postIdParam) q.set("postId", postIdParam);
      router.replace(`/mock-test?${q.toString()}`);
    }
  }, [isLibraryPage, deepLinkPaperSlug, classroomIdParam, postIdParam, router]);

  useEffect(() => {
    if (isLibraryPage) return;
    if (initialViewParam === "setup") {
      router.replace("/mock-test");
    }
  }, [isLibraryPage, initialViewParam, router]);

  useEffect(() => {
    if (!isLibraryPage) return;
    const tab = searchParams.get("tab");
    if (tab === "past" || tab === "mock" || tab === "quick") {
      setLibraryCollectionTab(tab);
    }
    const subj = searchParams.get("subject");
    if (subj === "physics" || subj === "chemistry" || subj === "math") {
      setSelectedSubject(subj);
    }
  }, [isLibraryPage, searchParams]);
"""

if "router.replace(`/mock-test?" not in text:
    text = text.replace(
        "  useEffect(() => {\n    if (initialViewParam === \"setup\") {\n      setView(\"setup\");\n    }\n  }, [initialViewParam]);",
        redirect_block,
    )

# handleQuickStartMock - navigate from dashboard
text = text.replace(
    """  const handleQuickStartMock = useCallback((subject: Subject) => {
    setSelectedSubject(subject);
    setDuration(90);
    setLibraryCollectionTab("quick");
    setView("setup");
  }, []);""",
    """  const handleQuickStartMock = useCallback(
    (subject: Subject) => {
      if (!isLibraryPage) {
        router.push(`/mock-test?tab=quick&subject=${encodeURIComponent(subject)}`);
        return;
      }
      setSelectedSubject(subject);
      setDuration(90);
      setLibraryCollectionTab("quick");
      setView("setup");
    },
    [isLibraryPage, router]
  );""",
)

p.write_text(text, encoding="utf-8")
print("Patched MockPageContent")
