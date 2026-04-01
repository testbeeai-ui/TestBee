'use client';

import { Compass } from 'lucide-react';
import { useAuth } from '@/hooks/useAuth';
import { useTopicTaxonomy } from '@/hooks/useTopicTaxonomy';
import { useExploreHubData } from '@/hooks/useExploreHubData';
import type { Subject, ExamType } from '@/types';
import type { TopicNode } from '@/data/topicTaxonomy';

import ExploreHubSidebar from './ExploreHubSidebar';
import ExploreStatsBar from './ExploreStatsBar';
import ExploreSearchBar from './ExploreSearchBar';
import SubjectChips from './SubjectChips';
import CommunityFeed from './CommunityFeed';
import RandomTopicExplorer from './RandomTopicExplorer';
import TrendingTopics from './TrendingTopics';

interface ExploreHubDashboardProps {
  onNavigateToSubjects: () => void;
  onNavigateToSubject: (subject: Subject) => void;
  onNavigateToTopic?: (node: TopicNode) => void;
  onNavigateToSubjectWithExam?: (subject: Subject, exam: ExamType | null) => void;
}

export default function ExploreHubDashboard({
  onNavigateToSubjects,
  onNavigateToSubject,
  onNavigateToTopic,
  onNavigateToSubjectWithExam,
}: ExploreHubDashboardProps) {
  const { user, profile } = useAuth();
  const { taxonomy } = useTopicTaxonomy();
  const { stats, feedPosts, loading } = useExploreHubData(
    user?.id,
    profile?.rdm ?? 0
  );

  const handleSelectTopic = (subject: Subject, _topic: string) => {
    onNavigateToSubject(subject);
  };

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
      <div className="edu-page-header mb-6">
        <h2 className="edu-page-title flex items-center gap-3">
          <div className="w-10 h-10 gradient-primary rounded-xl flex items-center justify-center">
            <Compass className="w-5 h-5 text-primary-foreground" />
          </div>
          Explore
        </h2>
        <p className="edu-page-desc">Discover topics, connect with learners, and grow every day</p>
      </div>

      {/* Main layout: sidebar + content */}
      <div className="flex gap-4 lg:gap-6">
        <ExploreHubSidebar />

        {/* Main content */}
        <div className="flex-1 min-w-0 space-y-6">
          <ExploreStatsBar stats={stats} loading={loading} />
          <ExploreSearchBar taxonomy={taxonomy} onSelectTopic={handleSelectTopic} />
          <SubjectChips onSelectSubject={(subject, exam) => {
            if (onNavigateToSubjectWithExam) {
              onNavigateToSubjectWithExam(subject, exam);
            } else {
              onNavigateToSubject(subject);
            }
          }} />

          {/* Two-column: feed + sidebar widgets */}
          <div className="grid grid-cols-1 lg:grid-cols-5 gap-6">
            <div className="lg:col-span-3">
              <CommunityFeed taxonomy={taxonomy} onExploreTopic={handleDirectTopic} livePosts={feedPosts} />
            </div>
            <div className="lg:col-span-2 space-y-4">
              <RandomTopicExplorer taxonomy={taxonomy} onExploreTopic={handleDirectTopic} />
              <TrendingTopics taxonomy={taxonomy} onExploreTopic={handleDirectTopic} />
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
