"use client";

import { useState } from "react";
import { Compass } from "lucide-react";
import { useTopicTaxonomy } from "@/hooks/useTopicTaxonomy";
import type { Subject, ExamType, ClassLevel } from "@/types";
import type { TopicNode } from "@/data/topicTaxonomy";

import ExploreHubSidebar from "./ExploreHubSidebar";
import SubjectChips from "./SubjectChips";
import RawPostComposer from "./RawPostComposer";
import RawCommunityFeed from "./RawCommunityFeed";
import RandomTopicExplorer from "./RandomTopicExplorer";
import TrendingTopics from "./TrendingTopics";

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
  const [rawFeedRefresh, setRawFeedRefresh] = useState(0);

  const handleDirectTopic = (node: TopicNode) => {
    if (onNavigateToTopic) {
      onNavigateToTopic(node);
    } else {
      onNavigateToSubject(node.subject);
    }
  };

  return (
    <div className="max-w-7xl mx-auto">
      {/* Header */}
      <div className="edu-page-header mb-4 sm:mb-6">
        <h2 className="edu-page-title flex items-center gap-2.5 sm:gap-3">
          <div className="w-9 h-9 gradient-primary rounded-xl flex items-center justify-center sm:w-10 sm:h-10">
            <Compass className="w-4.5 h-4.5 text-primary-foreground sm:w-5 sm:h-5" />
          </div>
          Lessons
        </h2>
        <p className="edu-page-desc">Discover lessons, connect with learners, and grow every day</p>
      </div>

      {/* Main layout: sidebar + content */}
      <div className="flex gap-0 lg:gap-6">
        <ExploreHubSidebar />

        {/* Main content */}
        <div className="flex-1 min-w-0 space-y-4 sm:space-y-5 lg:space-y-6">
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
          <RawPostComposer onPosted={() => setRawFeedRefresh((k) => k + 1)} />

          {/* Two-column: feed on left (desktop), feed last (mobile) */}
          <div className="grid grid-cols-1 lg:grid-cols-5 gap-6">
            <div className="lg:col-span-3 order-2 lg:order-none">
              <RawCommunityFeed refreshKey={rawFeedRefresh} />
            </div>
            <div className="lg:col-span-2 space-y-4 order-1 lg:order-none">
              <RandomTopicExplorer
                taxonomy={taxonomy}
                onExploreTopic={onExploreRandomTopic ?? handleDirectTopic}
              />
              <TrendingTopics taxonomy={taxonomy} onExploreTopic={handleDirectTopic} />
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
