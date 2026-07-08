"use client";

import { useState } from "react";
import { Compass } from "lucide-react";
import { useTopicTaxonomy } from "@/hooks/useTopicTaxonomy";
import type { Subject, ExamType, ClassLevel } from "@/types";
import type { TopicNode } from "@/data/topicTaxonomy";

import ExploreHubSidebar from "./ExploreHubSidebar";
import SubjectChips from "./SubjectChips";
import RandomTopicExplorer from "./RandomTopicExplorer";
import TrendingTopics from "./TrendingTopics";
import SavedWorkSection from "./SavedWorkSection";
import StreakCalendar from "../prep-mock/StreakCalendar";
import { useAuth } from "@/hooks/useAuth";

interface ExploreHubDashboardProps {
  onNavigateToSubjects: () => void;
  onNavigateToSubject: (subject: Subject) => void;
  onNavigateToTopic?: (node: TopicNode) => void;
  /** When set (e.g. onboarding reward flow), Random topic explorer uses this instead of onNavigateToTopic. */
  onExploreRandomTopic?: (node: TopicNode) => void;
  onNavigateToSubjectWithExam?: (
    subject: Subject,
    exam: ExamType | null,
    classLevel: ClassLevel
  ) => void;
  showLessonsSubjectPickGuide?: boolean;
  onLessonsSubjectPickGuideDismiss?: () => void;
}

export default function ExploreHubDashboard({
  onNavigateToSubjects,
  onNavigateToSubject,
  onNavigateToTopic,
  onExploreRandomTopic,
  onNavigateToSubjectWithExam,
  showLessonsSubjectPickGuide = false,
  onLessonsSubjectPickGuideDismiss,
}: ExploreHubDashboardProps) {
  const { taxonomy } = useTopicTaxonomy();
  const { user, session } = useAuth();

  const handleDirectTopic = (node: TopicNode) => {
    if (onNavigateToTopic) {
      onNavigateToTopic(node);
    } else {
      onNavigateToSubject(node.subject);
    }
  };

  return (
    <div className="max-w-7xl mx-auto">
      {/* Main layout: sidebar + content */}
      <div className="flex gap-0 lg:gap-6">
        <ExploreHubSidebar />

        {/* Main content */}
        <div className="flex-1 min-w-0 space-y-6 sm:space-y-8">
          <SubjectChips
            showSubjectPickGuide={showLessonsSubjectPickGuide}
            onSubjectPickGuideDismiss={onLessonsSubjectPickGuideDismiss}
            onSelectSubject={(subject, exam, classLevel) => {
              if (onNavigateToSubjectWithExam) {
                onNavigateToSubjectWithExam(subject, exam, classLevel);
              } else {
                onNavigateToSubject(subject);
              }
            }}
          />

          {/* Bottom columns — equal thirds, tight gap between cards */}
          <div className="grid grid-cols-1 items-stretch gap-3 md:grid-cols-3 md:gap-3 lg:gap-3.5">
            <SavedWorkSection />

            <div className="flex flex-col space-y-3 rounded-xl border border-border/50 bg-card/30 p-3.5">
              <div className="flex items-center">
                <span className="text-[10px] font-extrabold uppercase tracking-[0.16em] text-muted-foreground">
                  AI PREPARATION CALENDAR
                </span>
              </div>
              <StreakCalendar
                userId={user?.id || null}
                accessToken={session?.access_token}
                hideHeader
                cardTitle="Your study plan"
                compact
                noCardWrapper
              />
            </div>

            <div className="flex flex-col space-y-3 rounded-xl border border-border/50 bg-card/30 p-3.5">
              <div className="flex items-center justify-between">
                <span className="text-[10px] font-extrabold uppercase tracking-[0.16em] text-muted-foreground">
                  DISCOVERY
                </span>
              </div>
              <h3 className="text-base font-bold tracking-tight text-foreground">Random Topic Explorer</h3>
              <RandomTopicExplorer
                taxonomy={taxonomy}
                onExploreTopic={onExploreRandomTopic ?? handleDirectTopic}
                compact
                noCardWrapper
              />
              <div className="border-t border-white/10" />
              <TrendingTopics
                taxonomy={taxonomy}
                onExploreTopic={handleDirectTopic}
                compact
                noCardWrapper
              />
            </div>
          </div>

        </div>
      </div>
    </div>
  );
}

