"use client";

import { motion } from "framer-motion";
import { ClipboardList } from "lucide-react";
import type { PastPaper, Subject, SavedRevisionCard } from "@/types";
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
  onNextClass: (info: { name: string; time: string } | null) => void;
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
  showCbseMcqViewAllGuide?: boolean;
  showClassesViewAllGuide?: boolean;
  classesViewAllHref?: string;
  onClassesViewAllClick?: () => void;
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
  showCbseMcqViewAllGuide = false,
  showClassesViewAllGuide = false,
  classesViewAllHref = "/classrooms",
  onClassesViewAllClick,
}: PrepMockDashboardViewProps) {
  return (
    <motion.div
      key="landing"
      initial={{ opacity: 0 }}
      animate={{ opacity: 1 }}
      exit={{ opacity: 0 }}
      className="flex gap-6"
    >
      <PrepMockSidebar />

      <div className="flex-1 min-w-0 space-y-5 sm:space-y-8">
        <div className="flex items-center gap-2.5 sm:gap-3">
          <div className="w-9 h-9 gradient-primary rounded-xl flex items-center justify-center shrink-0 sm:w-10 sm:h-10">
            <ClipboardList className="w-4.5 h-4.5 text-primary-foreground sm:w-5 sm:h-5" />
          </div>
          <div>
            <h1 className="text-lg font-display font-extrabold text-foreground sm:text-xl">
              Prep + Mock
            </h1>
            <p className="text-[11px] text-muted-foreground sm:text-xs">
              Classes, AI-powered scheduling, mock tests, and smart revision
            </p>
          </div>
        </div>

        <PrepMockStatCards
          nextClassName={nextClassName}
          nextClassTime={nextClassTime}
          mockPending={mockPending}
          revisionItems={revisionItems}
          accuracy={accuracy}
        />

        <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
          <div className="space-y-6 order-2 lg:order-none">
            <ClassesSection
              userId={authUserId}
              onNextClass={onNextClass}
              accessToken={accessToken}
              onClassCalendar={onClassCalendar}
              showClassesViewAllGuide={showClassesViewAllGuide}
              viewAllHref={classesViewAllHref}
              onViewAllClick={onClassesViewAllClick}
            />
            <div id="calendar" className="scroll-mt-24">
              <StreakCalendar
                userId={authUserId || null}
                accessToken={accessToken}
                refreshKey={calendarRefreshKey}
              />
            </div>
          </div>

          <div className="space-y-6 order-1 lg:order-none">
            <MockTestsSection
              subjects={subjects}
              onStartMock={onStartMock}
              onViewAll={onViewAll}
              featuredPaper={featuredPaper}
              featuredLoading={featuredLoading}
              onStartFeaturedPaper={onStartFeaturedPaper}
              showCbseMcqViewAllGuide={showCbseMcqViewAllGuide}
            />
            <RevisionInstaCueSection
              cards={revisionCards}
              accessToken={accessToken}
              userId={authUserId || null}
              onCalendarActivity={onCalendarActivity}
            />
          </div>
        </div>
      </div>
    </motion.div>
  );
}
