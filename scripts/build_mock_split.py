"""Generate prep-mock library and dashboard view components from extracted JSX."""
from pathlib import Path

ROOT = Path(__file__).resolve().parents[1]
setup_body = (ROOT / "components/prep-mock/_setup_extract.txt").read_text(encoding="utf-8")
dash_body = (ROOT / "components/prep-mock/_dash_extract.txt").read_text(encoding="utf-8")

setup_body = setup_body.replace(
    """onClick={() => {
                  if (libraryStandalone) {
                    router.push("/home");
                  } else {
                    setView("landing");
                  }
                }}""",
    "onClick={onBack}",
)

library_header = '''"use client";

import { motion } from "framer-motion";
import {
  ArrowLeft,
  Award,
  BookOpen,
  Clock,
  ClipboardList,
  FileQuestion,
  GraduationCap,
  Lightbulb,
  ListOrdered,
  Search,
  ShieldCheck,
  Target,
} from "lucide-react";
import type { MockPaper, PastPaper, Subject } from "@/types";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import { cn } from "@/lib/utils";
import { mockPaperTypeLabel, type LibraryCategoryFilter } from "@/lib/mockPapersCatalog";
import { QUICK_DURATIONS, subjectEmojis } from "@/components/prep-mock/constants";
import type { LibraryCollectionTab, PaperSource } from "@/components/prep-mock/types";

export type MockTestLibraryViewProps = {
  onBack: () => void;
  libraryCollectionTab: LibraryCollectionTab;
  setLibraryCollectionTab: (tab: LibraryCollectionTab) => void;
  mockLibraryCategory: LibraryCategoryFilter;
  setMockLibraryCategory: (cat: LibraryCategoryFilter) => void;
  duration: number;
  setDuration: (d: number) => void;
  subjects: Subject[];
  selectedSubject: Subject;
  effectiveSubject: Subject;
  setSelectedSubject: (s: Subject) => void;
  startQuickTest: () => void;
  librarySearch: string;
  setLibrarySearch: (v: string) => void;
  librarySubjectFilter: "all" | Subject;
  setLibrarySubjectFilter: (v: "all" | Subject) => void;
  filteredPastCatalogPapers: PastPaper[];
  filteredMockCatalogPapers: MockPaper[];
  pastPapersByClassLevel: PastPaper[];
  mockPapersByClassLevel: MockPaper[];
  catalogLoading: boolean;
  catalogError: string | null;
  openNtaInstructionsForPaper: (
    paper: MockPaper | PastPaper,
    source: PaperSource,
    backView?: "landing" | "setup"
  ) => void;
};

export default function MockTestLibraryView({
  onBack,
  libraryCollectionTab,
  setLibraryCollectionTab,
  mockLibraryCategory,
  setMockLibraryCategory,
  duration,
  setDuration,
  subjects,
  selectedSubject,
  effectiveSubject,
  setSelectedSubject,
  startQuickTest,
  librarySearch,
  setLibrarySearch,
  librarySubjectFilter,
  setLibrarySubjectFilter,
  filteredPastCatalogPapers,
  filteredMockCatalogPapers,
  pastPapersByClassLevel,
  mockPapersByClassLevel,
  catalogLoading,
  catalogError,
  openNtaInstructionsForPaper,
}: MockTestLibraryViewProps) {
  return (
    <motion.div
      key="setup"
      initial={{ opacity: 0 }}
      animate={{ opacity: 1 }}
      exit={{ opacity: 0 }}
      className="mx-auto max-w-6xl space-y-6"
    >
'''

library_footer = """
    </motion.div>
  );
}
"""

(ROOT / "components/prep-mock/library/MockTestLibraryView.tsx").write_text(
    library_header + setup_body + library_footer, encoding="utf-8"
)

dashboard_header = '''"use client";

import { motion } from "framer-motion";
import { ClipboardList } from "lucide-react";
import type { PastPaper, Subject } from "@/types";
import type { SavedRevisionCard } from "@/types";
import PrepMockSidebar from "@/components/prep-mock/PrepMockSidebar";
import PrepMockStatCards from "@/components/prep-mock/PrepMockStatCards";
import ClassesSection from "@/components/prep-mock/ClassesSection";
import MockTestsSection from "@/components/prep-mock/MockTestsSection";
import StreakCalendar from "@/components/prep-mock/StreakCalendar";
import RevisionInstaCueSection from "@/components/prep-mock/RevisionInstaCueSection";

export type PrepMockDashboardViewProps = {
  authUserId: string;
  accessToken: string | undefined;
  nextClassName: string;
  nextClassTime: string;
  onNextClass: (info: { name: string; time: string }) => void;
  calendarRefreshKey: number;
  onClassCalendar: () => void;
  mockPending: number;
  revisionItems: number;
  accuracy: number;
  subjects: Subject[];
  onStartMock: (subject: Subject) => void;
  onViewAll: () => void;
  featuredPaper: PastPaper | null;
  featuredLoading?: boolean;
  onStartFeaturedPaper: () => void;
  revisionCards: SavedRevisionCard[];
  onCalendarActivity: () => void;
};

export default function PrepMockDashboardView({
  authUserId,
  accessToken,
  nextClassName,
  nextClassTime,
  onNextClass,
  calendarRefreshKey,
  onClassCalendar,
  mockPending,
  revisionItems,
  accuracy,
  subjects,
  onStartMock,
  onViewAll,
  featuredPaper,
  featuredLoading,
  onStartFeaturedPaper,
  revisionCards,
  onCalendarActivity,
}: PrepMockDashboardViewProps) {
  return (
'''

# Replace inline props in dash extract
dash_patched = dash_body
dash_patched = dash_patched.replace(
    """<ClassesSection
                      userId={authUser?.id ?? ""}
                      onNextClass={setNextClassInfo}
                      accessToken={session?.access_token}
                      onClassCalendar={() => setCalendarRefreshKey((k) => k + 1)}
                    />""",
    """<ClassesSection
                      userId={authUserId}
                      onNextClass={onNextClass}
                      accessToken={accessToken}
                      onClassCalendar={onClassCalendar}
                    />""",
)
dash_patched = dash_patched.replace(
    """<StreakCalendar
                        userId={authUser?.id ?? null}
                        accessToken={session?.access_token}
                        refreshKey={calendarRefreshKey}
                      />""",
    """<StreakCalendar
                        userId={authUserId || null}
                        accessToken={accessToken}
                        refreshKey={calendarRefreshKey}
                      />""",
)
dash_patched = dash_patched.replace(
    """<PrepMockStatCards
                  nextClassName={nextClassInfo?.name ?? ""}
                  nextClassTime={nextClassInfo?.time ?? ""}
                  mockPending={subjects.length}
                  revisionItems={revisionCards.length}
                  accuracy={overallAccuracy}
                />""",
    """<PrepMockStatCards
                  nextClassName={nextClassName}
                  nextClassTime={nextClassTime}
                  mockPending={mockPending}
                  revisionItems={revisionItems}
                  accuracy={accuracy}
                />""",
)
dash_patched = dash_patched.replace(
    """<MockTestsSection
                      subjects={subjects}
                      onStartMock={handleQuickStartMock}
                      onViewAll={() => {
                        setLibraryCollectionTab("past");
                        setMockLibraryCategory("all");
                        setView("setup");
                      }}
                      featuredPaper={featuredDashboardPaper ?? null}
                      featuredLoading={featuredCatalogLoading}
                      onStartFeaturedPaper={() => {
                        const p = featuredDashboardPaper;
                        if (p) openNtaInstructionsForPaper(p, "past", "landing");
                      }}
                    />""",
    """<MockTestsSection
                      subjects={subjects}
                      onStartMock={onStartMock}
                      onViewAll={onViewAll}
                      featuredPaper={featuredPaper}
                      featuredLoading={featuredLoading}
                      onStartFeaturedPaper={onStartFeaturedPaper}
                    />""",
)
dash_patched = dash_patched.replace(
    """<RevisionInstaCueSection
                      cards={revisionCards}
                      accessToken={session?.access_token}
                      userId={authUser?.id ?? null}
                      onCalendarActivity={() => setCalendarRefreshKey((k) => k + 1)}
                    />""",
    """<RevisionInstaCueSection
                      cards={revisionCards}
                      accessToken={accessToken}
                      userId={authUserId || null}
                      onCalendarActivity={onCalendarActivity}
                    />""",
)

dashboard_footer = """
  );
}
"""

(ROOT / "components/prep-mock/dashboard/PrepMockDashboardView.tsx").write_text(
    dashboard_header + dash_patched + dashboard_footer, encoding="utf-8"
)

print("Wrote library and dashboard components")
