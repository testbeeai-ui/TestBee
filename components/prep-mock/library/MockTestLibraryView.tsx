"use client";

import { useState } from "react";
import { motion } from "framer-motion";
import {
  ArrowLeft,
  Award,
  BookOpen,
  Clock,
  ClipboardList,
  Lightbulb,
  History,
  ListOrdered,
  Search,
  Target,
  Play,
  Star,
  Flag,
} from "lucide-react";
import { useAuth } from "@/hooks/useAuth";
import { MockLibraryHistorySheet } from "@/components/prep-mock/library/MockLibraryHistorySheet";
import type { MockPaper, PastPaper, Subject } from "@/types";
import { cn } from "@/lib/utils";
import { isUnlimited } from "@/lib/subscription/subscriptionConfig";
import {
  mockPaperTypeLabel,
  type LibraryCategoryFilter,
  type LibraryExamFilter,
} from "@/lib/mock/mockPapersCatalog";
import { QUICK_DURATIONS, subjectEmojis, SUBJECT_LABELS } from "@/components/prep-mock/constants";
import McqChapterBrowser from "@/components/prep-mock/library/McqChapterBrowser";
import type { LibraryCollectionTab, PaperSource } from "@/components/prep-mock/types";

const EXAM_CHIPS: { id: LibraryExamFilter; label: string }[] = [
  { id: "all", label: "All" },
  { id: "kcet", label: "KCET" },
  { id: "bitsat", label: "BITSAT" },
  { id: "jee-main", label: "JEE Main" },
];

export type MockTestLibraryViewProps = {
  onBack: () => void;
  isAdminUser: boolean;
  libraryCollectionTab: LibraryCollectionTab;
  setLibraryCollectionTab: (tab: LibraryCollectionTab) => void;
  mockLibraryCategory: LibraryCategoryFilter;
  setMockLibraryCategory: (cat: LibraryCategoryFilter) => void;
  duration: number;
  setDuration: (d: number) => void;
  subjects: Subject[];
  selectedSubject: Subject | null;
  effectiveSubject: Subject;
  setSelectedSubject: (s: Subject) => void;
  startQuickTest: () => void;
  librarySearch: string;
  setLibrarySearch: (v: string) => void;
  libraryExamFilter: LibraryExamFilter;
  setLibraryExamFilter: (v: LibraryExamFilter) => void;
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
  showCbseMcqTabGuide?: boolean;
  monthlyAttemptsCount?: number | null;
  mocksPerMonthLimit?: number;
};

const LIBRARY_TABS: { id: LibraryCollectionTab; label: string; adminOnly?: boolean }[] = [
  { id: "past", label: "Past papers" },
  { id: "mock", label: "Mock papers" },
  { id: "quick", label: "Quick mock" },
  { id: "mcq", label: "CBSE MCQ's" },
];

export default function MockTestLibraryView({
  onBack,
  isAdminUser,
  libraryCollectionTab,
  setLibraryCollectionTab,
  mockLibraryCategory,
  setMockLibraryCategory,
  duration,
  setDuration,
  subjects,
  effectiveSubject,
  setSelectedSubject,
  startQuickTest,
  librarySearch,
  setLibrarySearch,
  libraryExamFilter,
  setLibraryExamFilter,
  filteredPastCatalogPapers,
  filteredMockCatalogPapers,
  pastPapersByClassLevel,
  mockPapersByClassLevel,
  catalogLoading,
  catalogError,
  openNtaInstructionsForPaper,
  showCbseMcqTabGuide = false,
  monthlyAttemptsCount,
  mocksPerMonthLimit,
}: MockTestLibraryViewProps) {
  const { user } = useAuth();
  const [historyOpen, setHistoryOpen] = useState(false);
  const [selectedYear, setSelectedYear] = useState<string>("all");

  const visibleTabs = LIBRARY_TABS.filter((tab) => !tab.adminOnly || isAdminUser);

  const getPaperYear = (title: string): number => {
    const match = title.match(/\b(20\d{2}|19\d{2})\b/);
    return match ? parseInt(match[0], 10) : 0;
  };

  const finalPastPapers = filteredPastCatalogPapers
    .filter((p) => {
      if (selectedYear === "all") return true;
      return getPaperYear(p.title) === parseInt(selectedYear, 10);
    })
    .sort((a, b) => {
      const yearA = getPaperYear(a.title);
      const yearB = getPaperYear(b.title);
      if (yearA !== yearB) return yearB - yearA;
      return a.title.localeCompare(b.title);
    });

  const finalMockPapers = filteredMockCatalogPapers
    .filter((p) => {
      if (selectedYear === "all") return true;
      return getPaperYear(p.title) === parseInt(selectedYear, 10);
    })
    .sort((a, b) => {
      const yearA = getPaperYear(a.title);
      const yearB = getPaperYear(b.title);
      if (yearA !== yearB) return yearB - yearA;
      return a.title.localeCompare(b.title);
    });

  return (
    <motion.div
      key="setup"
      initial={{ opacity: 0 }}
      animate={{ opacity: 1 }}
      exit={{ opacity: 0 }}
      className="mock-test-page"
    >
      <style>{`
        .mock-test-page {
          --bg: var(--background);
          --s1: var(--card);
          --s2: var(--muted);
          --s3: var(--accent);
          --b1: var(--border);
          --b2: var(--border);
          --t1: var(--foreground);
          --t2: var(--muted-foreground);
          --t3: var(--muted-foreground);
          --blue: #3b82f6;
          --blb: rgba(59, 130, 246, 0.1);
          --bll: #60a5fa;
          --bld: #2563eb;
          --teal: #10b981;
          --tb: rgba(16, 185, 129, 0.1);
          --tl: #34d399;
          --amber: #f59e0b;
          --ab: rgba(245, 158, 11, 0.1);
          --al: #fbbf24;
          --border-radius-md: 8px;
          --border-radius-lg: 12px;
          --font-sans: var(--font-app-sans), ui-sans-serif, system-ui, sans-serif;

          background-color: transparent !important;
          color: var(--t1) !important;
          font-family: var(--font-sans) !important;
          min-height: auto !important;
        }
        .mock-test-page .page {
          padding: 16px 0 32px !important;
          max-width: 100% !important;
          margin: 0 auto !important;
          font-family: var(--font-sans) !important;
        }
        @media (min-width: 768px) {
          .mock-test-page .page {
            padding: 20px 0 40px !important;
          }
        }
        @media (min-width: 1024px) {
          .mock-test-page .page {
            padding: 24px 0 48px !important;
          }
        }
        @media (min-width: 1440px) {
          .mock-test-page .page {
            padding: 24px 0 48px !important;
          }
        }
        .mock-test-page .back-btn {
          display: inline-flex !important;
          align-items: center !important;
          gap: 6px !important;
          padding: 8px 16px !important;
          border: 1px solid var(--b1) !important;
          border-radius: 9999px !important;
          background: var(--s2) !important;
          font-size: 12px !important;
          font-weight: 600 !important;
          cursor: pointer !important;
          color: var(--t2) !important;
          white-space: nowrap !important;
          transition: all 0.2s cubic-bezier(0.4, 0, 0.2, 1) !important;
          font-family: var(--font-sans) !important;
          box-shadow: 0 2px 4px rgba(0, 0, 0, 0.1) !important;
        }
        .mock-test-page .back-btn:hover {
          border-color: var(--blue) !important;
          color: var(--t1) !important;
          background: var(--s3) !important;
          transform: translateX(-2px) !important;
          box-shadow: 0 4px 8px rgba(0, 0, 0, 0.2), 0 0 8px rgba(59, 130, 246, 0.2) !important;
        }
        .mock-test-page .back-btn:active {
          transform: translateX(0) scale(0.97) !important;
        }
        .mock-test-page .portal-badge {
          font-size: 11px !important;
          font-weight: 600 !important;
          color: var(--blue) !important;
          letter-spacing: .08em !important;
          text-transform: uppercase !important;
          margin-bottom: 6px !important;
          font-family: var(--font-sans) !important;
        }
        .mock-test-page .page-title {
          font-size: 28px !important;
          font-weight: 700 !important;
          color: var(--t1) !important;
          font-family: var(--font-sans) !important;
          letter-spacing: -0.02em !important;
        }
        .mock-test-page .top-hdr {
          position: relative !important;
          display: flex !important;
          align-items: center !important;
          justify-content: space-between !important;
          margin-bottom: 24px !important;
          gap: 16px !important;
          min-height: 56px !important;
        }
        .mock-test-page .hdr-left {
          display: flex !important;
          justify-content: flex-start !important;
          position: relative !important;
          z-index: 2 !important;
        }
        .mock-test-page .hdr-center {
          display: flex !important;
          flex-direction: column !important;
          align-items: center !important;
          text-align: center !important;
          position: absolute !important;
          left: 50% !important;
          transform: translateX(-50%) !important;
          z-index: 1 !important;
          pointer-events: none !important;
        }
        .mock-test-page .hdr-center > * {
          pointer-events: auto !important;
        }
        .mock-test-page .hdr-right {
          display: flex !important;
          justify-content: flex-end !important;
          align-items: center !important;
          gap: 8px !important;
          position: relative !important;
          z-index: 2 !important;
        }
        @media (min-width: 768px) and (max-width: 1023px) {
          .mock-test-page .top-hdr {
            display: flex !important;
            flex-wrap: wrap !important;
            align-items: center !important;
            justify-content: space-between !important;
            position: static !important;
            gap: 16px !important;
          }
          .mock-test-page .hdr-left {
            order: 1 !important;
            flex: 1 1 auto !important;
            justify-content: flex-start !important;
          }
          .mock-test-page .hdr-right {
            order: 2 !important;
            flex: 1 1 auto !important;
            justify-content: flex-end !important;
          }
          .mock-test-page .hdr-center {
            order: 3 !important;
            flex: 0 0 100% !important;
            position: static !important;
            transform: none !important;
            margin-top: 8px !important;
          }
        }
        @media (max-width: 767px) {
          .mock-test-page .top-hdr {
            display: flex !important;
            flex-direction: column !important;
            align-items: center !important;
            text-align: center !important;
            position: static !important;
            gap: 16px !important;
          }
          .mock-test-page .hdr-left {
            order: 1 !important;
            justify-content: center !important;
            width: 100% !important;
          }
          .mock-test-page .hdr-center {
            order: 2 !important;
            position: static !important;
            transform: none !important;
            width: 100% !important;
          }
          .mock-test-page .hdr-right {
            order: 3 !important;
            justify-content: center !important;
            width: 100% !important;
            flex-direction: column !important;
            align-items: center !important;
            gap: 10px !important;
          }
        }
        .mock-test-page .history-btn {
          display: inline-flex !important;
          align-items: center !important;
          gap: 6px !important;
          padding: 8px 16px !important;
          border: 1px solid var(--b1) !important;
          border-radius: 9999px !important;
          background: transparent !important;
          font-size: 12px !important;
          font-weight: 500 !important;
          cursor: pointer !important;
          color: var(--t2) !important;
          white-space: nowrap !important;
          transition: all .2s ease !important;
          font-family: var(--font-sans) !important;
        }
        .mock-test-page .history-btn:hover {
          border-color: var(--blue) !important;
          color: var(--t1) !important;
          background: var(--s2) !important;
        }
        .mock-test-page .tab-row {
          display: flex !important;
          align-items: center !important;
          justify-content: space-between !important;
          flex-wrap: wrap !important;
          gap: 12px !important;
          margin-bottom: 24px !important;
        }
        .mock-test-page .tab-bar {
          display: flex !important;
          gap: 8px !important;
          overflow-x: auto !important;
          -webkit-overflow-scrolling: touch !important;
          max-width: 100% !important;
          scrollbar-width: none !important;
        }
        .mock-test-page .tab-bar::-webkit-scrollbar {
          display: none !important;
        }
        .mock-test-page .tab {
          padding: 8px 18px !important;
          border-radius: 9999px !important;
          border: 1px solid var(--b1) !important;
          background: var(--s2) !important;
          font-size: 13px !important;
          font-weight: 500 !important;
          cursor: pointer !important;
          color: var(--t2) !important;
          transition: all 0.2s ease !important;
          font-family: var(--font-sans) !important;
        }
        .mock-test-page .tab:hover {
          border-color: var(--b2) !important;
          color: var(--t1) !important;
          background: var(--s3) !important;
        }
        .mock-test-page .tab.on {
          background: var(--bld) !important;
          border-color: var(--bld) !important;
          color: #fff !important;
          box-shadow: 0 4px 12px rgba(37, 99, 235, 0.3) !important;
        }
        .mock-test-page .tab-meta {
          display: flex !important;
          align-items: center !important;
          gap: 6px !important;
          font-size: 12px !important;
          color: var(--t3) !important;
          font-family: var(--font-sans) !important;
        }
        .mock-test-page .tab-meta svg {
          display: inline-block !important;
          vertical-align: middle !important;
          margin-top: -2px !important;
        }
        @media (max-width: 767px) {
          .mock-test-page .tab-row {
            flex-direction: column !important;
            align-items: stretch !important;
            gap: 16px !important;
          }
          .mock-test-page .tab-bar {
            justify-content: flex-start !important;
            width: 100% !important;
            padding-bottom: 4px !important;
          }
          .mock-test-page .tab-meta {
            justify-content: center !important;
            width: 100% !important;
            background: var(--s2) !important;
            padding: 8px 12px !important;
            border-radius: 8px !important;
            border: 1px solid var(--b1) !important;
          }
        }
        .mock-test-page .sub-tab-bar {
          scrollbar-width: none !important;
          -webkit-overflow-scrolling: touch !important;
        }
        .mock-test-page .sub-tab-bar::-webkit-scrollbar {
          display: none !important;
        }
        .mock-test-page .filter-row {
          display: flex !important;
          align-items: center !important;
          gap: 12px !important;
          flex-wrap: wrap !important;
          margin-bottom: 20px !important;
        }
        .mock-test-page .search-wrap {
          display: flex !important;
          align-items: center !important;
          gap: 8px !important;
          background: var(--s2) !important;
          border: 1px solid var(--b1) !important;
          border-radius: var(--border-radius-md) !important;
          padding: 8px 14px !important;
          flex: 1 !important;
          min-width: 240px !important;
          transition: all 0.2s ease !important;
        }
        .mock-test-page .search-wrap:focus-within {
          border-color: var(--blue) !important;
          box-shadow: 0 0 0 2px rgba(59, 130, 246, 0.2) !important;
          background: var(--s3) !important;
        }
        .mock-test-page .search-wrap svg {
          color: var(--t3) !important;
          flex-shrink: 0 !important;
        }
        .mock-test-page .search-wrap input {
          border: none !important;
          background: transparent !important;
          font-size: 13px !important;
          color: var(--t1) !important;
          outline: none !important;
          width: 100% !important;
          font-family: var(--font-sans) !important;
        }
        .mock-test-page .search-wrap input::placeholder {
          color: var(--t3) !important;
        }
        .mock-test-page select {
          padding: 8px 32px 8px 14px !important;
          background: var(--s2) !important;
          border: 1px solid var(--b1) !important;
          border-radius: var(--border-radius-md) !important;
          color: var(--t1) !important;
          font-size: 13px !important;
          outline: none !important;
          cursor: pointer !important;
          transition: all 0.2s ease !important;
          appearance: none !important;
          background-image: url("data:image/svg+xml,%3Csvg xmlns='http://www.w3.org/2000/svg' width='12' height='12' viewBox='0 0 24 24' fill='none' stroke='%239BA3B8' stroke-width='2'%3E%3Cpath d='m6 9 6 6 6-6'/%3E%3C/svg%3E") !important;
          background-repeat: no-repeat !important;
          background-position: right 12px center !important;
          font-family: var(--font-sans) !important;
        }
        .mock-test-page select:focus {
          border-color: var(--blue) !important;
          box-shadow: 0 0 0 2px rgba(59, 130, 246, 0.2) !important;
          background: var(--s3) !important;
        }
        .mock-test-page select:hover {
          border-color: var(--b2) !important;
        }
        .mock-test-page select option {
          background: var(--s2) !important;
          color: var(--t1) !important;
        }
        .mock-test-page .divider-v {
          display: none !important;
        }
        @media (min-width: 1024px) {
          .mock-test-page .divider-v {
            display: block !important;
            width: 1px !important;
            height: 24px !important;
            background: var(--b1) !important;
            flex-shrink: 0 !important;
          }
        }
        @media (max-width: 1023px) and (min-width: 640px) {
          .mock-test-page .divider-v {
            display: block !important;
            width: 100% !important;
            height: 0 !important;
            background: transparent !important;
            margin: 4px 0 !important;
            flex-shrink: 0 !important;
          }
        }
        @media (max-width: 639px) {
          .mock-test-page .search-wrap {
            width: 100% !important;
            flex: none !important;
          }
          .mock-test-page select {
            width: 100% !important;
          }
          .mock-test-page .filter-row {
            gap: 8px !important;
          }
          .mock-test-page .exam-label {
            width: 100% !important;
            margin-top: 8px !important;
            margin-bottom: 4px !important;
          }
          .mock-test-page .exam-pills {
            width: 100% !important;
          }
        }
        .mock-test-page .exam-label {
          font-size: 13px !important;
          font-weight: 500 !important;
          color: var(--t2) !important;
          white-space: nowrap !important;
          font-family: var(--font-sans) !important;
        }
        .mock-test-page .exam-pills {
          display: flex !important;
          gap: 6px !important;
          flex-wrap: wrap !important;
        }
        .mock-test-page .ep {
          padding: 6px 14px !important;
          border-radius: 9999px !important;
          font-size: 12px !important;
          font-weight: 500 !important;
          cursor: pointer !important;
          border: 1px solid var(--b1) !important;
          background: var(--s2) !important;
          color: var(--t2) !important;
          transition: all 0.2s ease !important;
          font-family: var(--font-sans) !important;
        }
        .mock-test-page .ep:hover {
          border-color: var(--b2) !important;
          color: var(--t1) !important;
          background: var(--s3) !important;
        }
        .mock-test-page .ep.on {
          background: var(--blue) !important;
          border-color: var(--blue) !important;
          color: #fff !important;
          box-shadow: 0 4px 10px rgba(59, 130, 246, 0.25) !important;
        }
        .mock-test-page .showing {
          font-size: 13px !important;
          color: var(--t2) !important;
          margin-bottom: 16px !important;
          font-family: var(--font-sans) !important;
        }
        .mock-test-page .divl {
          height: 1px !important;
          background: var(--b1) !important;
          margin-bottom: 20px !important;
        }
        .mock-test-page .grid {
          display: grid !important;
          grid-template-columns: repeat(1, 1fr) !important;
          gap: 16px !important;
        }
        @media (min-width: 640px) {
          .mock-test-page .grid {
            grid-template-columns: repeat(2, 1fr) !important;
          }
        }
        @media (min-width: 1024px) {
          .mock-test-page .grid {
            grid-template-columns: repeat(3, 1fr) !important;
          }
        }
        @media (min-width: 1280px) {
          .mock-test-page .grid {
            grid-template-columns: repeat(4, 1fr) !important;
          }
        }
        .mock-test-page .card {
          background: var(--s1) !important;
          border: 1px solid var(--b1) !important;
          border-radius: var(--border-radius-lg) !important;
          padding: 18px !important;
          display: flex !important;
          flex-direction: column !important;
          gap: 12px !important;
          transition: all 0.25s cubic-bezier(0.4, 0, 0.2, 1) !important;
          position: relative !important;
          overflow: hidden !important;
        }
        .mock-test-page .card:hover {
          border-color: var(--blue) !important;
          transform: translateY(-2px) !important;
          box-shadow: 0 12px 20px -8px rgba(0, 0, 0, 0.5), 0 0 15px -3px rgba(59, 130, 246, 0.15) !important;
        }
        .mock-test-page .card.featured {
          border-color: var(--bld) !important;
          box-shadow: 0 0 10px -2px rgba(37, 99, 235, 0.1) !important;
        }
        .mock-test-page .card.featured:hover {
          box-shadow: 0 12px 20px -8px rgba(0, 0, 0, 0.5), 0 0 20px -2px rgba(37, 99, 235, 0.25) !important;
        }
        .mock-test-page .card-meta {
          display: flex !important;
          align-items: center !important;
          gap: 6px !important;
          flex-wrap: wrap !important;
        }
        .mock-test-page .cmeta-tag {
          font-size: 10px !important;
          font-weight: 600 !important;
          color: var(--t2) !important;
          text-transform: uppercase !important;
          letter-spacing: .06em !important;
          font-family: var(--font-sans) !important;
        }
        .mock-test-page .standard {
          font-size: 10px !important;
          color: var(--t3) !important;
          font-family: var(--font-sans) !important;
        }
        .mock-test-page .streak-badge {
          display: inline-flex !important;
          align-items: center !important;
          gap: 4px !important;
          font-size: 10px !important;
          font-weight: 600 !important;
          background: var(--blb) !important;
          border: 1px solid rgba(59, 130, 246, 0.2) !important;
          color: var(--bll) !important;
          border-radius: 6px !important;
          padding: 2px 8px !important;
          font-family: var(--font-sans) !important;
        }
        .mock-test-page .streak-badge svg {
          color: var(--blue) !important;
        }
        .mock-test-page .card-title {
          font-size: 16px !important;
          font-weight: 600 !important;
          color: var(--t1) !important;
          line-height: 1.3 !important;
          font-family: var(--font-sans) !important;
        }
        .mock-test-page .stats-row {
          display: flex !important;
          align-items: center !important;
          gap: 0 !important;
        }
        .mock-test-page .stat {
          display: flex !important;
          align-items: center !important;
          gap: 4px !important;
          flex: 1 !important;
          padding: 6px 0 !important;
        }
        .mock-test-page .stat svg {
          color: var(--blue) !important;
          flex-shrink: 0 !important;
        }
        .mock-test-page .stat-body {
          display: flex !important;
          align-items: baseline !important;
          gap: 2px !important;
        }
        .mock-test-page .stat-val {
          font-size: 13px !important;
          font-weight: 600 !important;
          color: var(--t1) !important;
          line-height: 1 !important;
          font-family: var(--font-sans) !important;
        }
        .mock-test-page .stat-lbl {
          font-size: 10px !important;
          color: var(--t2) !important;
          font-family: var(--font-sans) !important;
        }
        .mock-test-page .stat-sep {
          width: 1px !important;
          height: 16px !important;
          background: var(--b1) !important;
          flex-shrink: 0 !important;
          margin: 0 8px !important;
        }
        .mock-test-page .play-btn {
          width: 36px !important;
          height: 36px !important;
          border-radius: 50% !important;
          background: var(--bld) !important;
          border: none !important;
          display: flex !important;
          align-items: center !important;
          justify-content: center !important;
          cursor: pointer !important;
          flex-shrink: 0 !important;
          transition: all 0.2s ease !important;
          align-self: center !important;
          margin-left: 8px !important;
          box-shadow: 0 4px 6px -1px rgba(37, 99, 235, 0.2) !important;
        }
        .mock-test-page .play-btn:hover {
          background: var(--blue) !important;
          transform: scale(1.08) !important;
          box-shadow: 0 4px 12px rgba(59, 130, 246, 0.4) !important;
        }
        .mock-test-page .play-btn:active {
          transform: scale(0.95) !important;
        }
        @media (max-width: 479px) {
          .mock-test-page .stats-row {
            display: grid !important;
            grid-template-columns: 1fr 1fr !important;
            gap: 8px !important;
            align-items: center !important;
          }
          .mock-test-page .stat-sep {
            display: none !important;
          }
          .mock-test-page .stat {
            padding: 4px 0 !important;
          }
          .mock-test-page .play-btn {
            grid-column: 2 !important;
            grid-row: 2 !important;
            justify-self: end !important;
            margin-left: 0 !important;
          }
        }
        .mock-test-page .play-btn svg {
          color: #fff !important;
        }
        
        .mock-test-page .quick-mock-container {
          margin-top: 2rem !important;
          display: grid !important;
          gap: 1.5rem !important;
        }
        @media (min-width: 1024px) {
          .mock-test-page .quick-mock-container {
            grid-template-columns: 1fr 280px !important;
          }
        }
        .mock-test-page .quick-card {
          background: var(--s1) !important;
          border: 1px solid var(--b1) !important;
          border-radius: var(--border-radius-lg) !important;
          padding: 28px !important;
          box-shadow: 0 4px 20px -2px rgba(0, 0, 0, 0.3) !important;
        }
        .mock-test-page .quick-btn-primary {
          background: var(--bld) !important;
          color: #fff !important;
          border-radius: 8px !important;
          font-weight: 600 !important;
          padding: 12px 24px !important;
          transition: all 0.2s ease !important;
          border: none !important;
          cursor: pointer !important;
          box-shadow: 0 4px 12px rgba(37, 99, 235, 0.3) !important;
        }
        .mock-test-page .quick-btn-primary:hover {
          background: var(--blue) !important;
          box-shadow: 0 4px 16px rgba(59, 130, 246, 0.45) !important;
          transform: translateY(-1px) !important;
        }
        .mock-test-page .quick-btn-primary:active {
          transform: translateY(1px) !important;
        }
      `}</style>

      <div className="page">
        {/* Header */}
        <div className="top-hdr">
          <div className="hdr-left">
            <button
              type="button"
              onClick={onBack}
              className="back-btn"
            >
              <ArrowLeft className="h-3.5 w-3.5" /> Back to Prep + Mock
            </button>
          </div>

          <div className="hdr-center">
            <div className="portal-badge">Institute-style mock portal</div>
            <h1 className="page-title">Mock test library</h1>
          </div>

          <div className="hdr-right">
            {typeof monthlyAttemptsCount === "number" &&
              typeof mocksPerMonthLimit === "number" &&
              !isUnlimited(mocksPerMonthLimit) && (
              <div
                className="flex items-center gap-2 px-3 py-1.5 rounded-full border text-[11px] font-extrabold shrink-0 shadow-sm border-primary/20 bg-primary/5 text-primary"
              >
                <span className="w-1.5 h-1.5 rounded-full bg-primary animate-pulse" />
                <span>
                  Usage: {monthlyAttemptsCount} / {mocksPerMonthLimit} tests
                </span>
              </div>
            )}
            <button
              type="button"
              className="history-btn"
              onClick={() => setHistoryOpen(true)}
            >
              <History className="h-3.5 w-3.5" /> Show history
            </button>
          </div>
        </div>

        {/* Tabs */}
        <div className="tab-row">
          <div className="tab-bar">
            {visibleTabs.map((tab) => (
              <button
                key={tab.id}
                type="button"
                onClick={() => {
                  setLibraryCollectionTab(tab.id);
                  if (tab.id !== "mock") setMockLibraryCategory("all");
                }}
                className={cn(
                  "tab",
                  libraryCollectionTab === tab.id && "on",
                  showCbseMcqTabGuide &&
                    tab.id === "mcq" &&
                    "ring-2 ring-primary ring-offset-2 ring-offset-background animate-pulse"
                )}
                aria-current={
                  showCbseMcqTabGuide && tab.id === "mcq" ? "step" : undefined
                }
              >
                {tab.label}
              </button>
            ))}
          </div>
          <div className="tab-meta">
            <Clock className="h-3.5 w-3.5" /> Timer &nbsp;·&nbsp;
            <Flag className="h-3.5 w-3.5" /> Flagged review &nbsp;·&nbsp;
            Submit when ready
          </div>
        </div>

        <MockLibraryHistorySheet
          open={historyOpen}
          onOpenChange={setHistoryOpen}
          userId={user?.id ?? null}
          libraryCollectionTab={libraryCollectionTab}
        />

        {libraryCollectionTab === "quick" ? (
          <div className="quick-mock-container">
            <div className="quick-card space-y-6">
              <h2 className="font-display flex items-center gap-2 text-lg font-bold text-foreground">
                <Clock className="h-5 w-5 text-primary" />
                Quick mock (adaptive pool)
              </h2>
              <p className="text-sm text-muted-foreground">
                Same engine as before: mixed questions from your syllabus level, timed like exam day.
              </p>
              <div>
                <h3 className="mb-3 text-sm font-bold text-foreground">Duration</h3>
                <div className="flex flex-wrap gap-3">
                  {QUICK_DURATIONS.map((d) => (
                    <button
                      key={d}
                      type="button"
                      onClick={() => setDuration(d)}
                      className={cn(
                        "min-w-[100px] flex-1 rounded-xl border-2 px-4 py-3 text-sm font-bold transition-all",
                        duration === d
                          ? "border-primary bg-primary/10 text-primary"
                          : "border-border bg-muted/30 text-muted-foreground hover:border-primary/50"
                      )}
                    >
                      {d} min
                    </button>
                  ))}
                </div>
                <p className="mt-2 text-xs text-muted-foreground">
                  ~{Math.ceil(duration / 2.5)} questions · ~2–3 min per question
                </p>
              </div>
              <div>
                <h3 className="mb-3 flex items-center gap-2 text-sm font-bold text-foreground">
                  <BookOpen className="h-4 w-4 text-primary" />
                  Subject focus
                </h3>
                <div className="flex flex-wrap gap-3">
                  {subjects.map((subj) => (
                    <button
                      key={subj}
                      type="button"
                      onClick={() => setSelectedSubject(subj)}
                      className={cn(
                        "flex items-center gap-2 rounded-xl border-2 px-4 py-2 text-sm font-bold transition-all",
                        effectiveSubject === subj
                          ? "border-primary bg-primary/10 text-primary"
                          : "border-border bg-muted/30 text-muted-foreground hover:border-primary/50"
                      )}
                    >
                      <span>{subjectEmojis[subj]}</span>
                      <span>{SUBJECT_LABELS[subj]}</span>
                    </button>
                  ))}
                </div>
              </div>
              <div className="text-center sm:text-left">
                <button
                  type="button"
                  className="quick-btn-primary w-full sm:w-auto"
                  onClick={startQuickTest}
                >
                  <ClipboardList className="inline mr-2 h-5 w-5 align-text-bottom" />
                  Start mock test
                </button>
              </div>
            </div>
            <div className="space-y-4">
              <div className="quick-card border border-primary/20 bg-primary/5 p-5">
                <Target className="mb-2 h-8 w-8 text-primary" />
                <h4 className="mb-1 font-bold text-foreground">Stamina</h4>
                <p className="text-sm text-muted-foreground">
                  Long sits train focus for boards and entrances.
                </p>
              </div>
              <div className="quick-card border border-border p-5">
                <Lightbulb className="mb-2 h-8 w-8 text-primary" />
                <h4 className="mb-1 font-bold text-foreground">Strategy</h4>
                <p className="text-sm text-muted-foreground">
                  Flag hard items; review after submit.
                </p>
              </div>
            </div>
          </div>
        ) : libraryCollectionTab === "mcq" ? (
          <McqChapterBrowser />
        ) : (
          <div className="mt-8 space-y-6">
            <div className="filter-row">
              <div className="search-wrap">
                <Search className="h-3.5 w-3.5" />
                <input
                  type="text"
                  placeholder="Search by paper name or tag…"
                  value={librarySearch}
                  onChange={(e) => setLibrarySearch(e.target.value)}
                />
              </div>

              <select
                value={selectedYear}
                onChange={(e) => setSelectedYear(e.target.value)}
                aria-label="Filter by year"
              >
                <option value="all">All years</option>
                {Array.from({ length: 2024 - 2008 + 1 }, (_, i) => 2024 - i).map((yr) => (
                  <option key={yr} value={yr}>
                    {yr}
                  </option>
                ))}
              </select>

              <div className="divider-v"></div>
              <span className="exam-label">Exam</span>
              <div className="exam-pills">
                {EXAM_CHIPS.map((chip) => (
                  <button
                    key={chip.id}
                    type="button"
                    onClick={() => setLibraryExamFilter(chip.id)}
                    className={cn("ep", libraryExamFilter === chip.id && "on")}
                  >
                    {chip.label}
                  </button>
                ))}
              </div>
            </div>

            {libraryCollectionTab === "mock" ? (
              <div className="sub-tab-bar flex gap-2 overflow-x-auto pb-2">
                {(
                  [
                    { id: "all" as const, label: "All mock papers" },
                    { id: "ncert" as const, label: "NCERT Exemplar" },
                    { id: "chapter" as const, label: "Chapter-wise" },
                    { id: "full" as const, label: "Full syllabus" },
                    { id: "mock" as const, label: "Mock paper" },
                  ] satisfies { id: LibraryCategoryFilter; label: string }[]
                ).map((tab) => (
                  <button
                    key={tab.id}
                    type="button"
                    onClick={() => setMockLibraryCategory(tab.id)}
                    className={cn("ep", mockLibraryCategory === tab.id && "on")}
                  >
                    {tab.label}
                  </button>
                ))}
              </div>
            ) : null}

            <div className="divl"></div>
            <div className="showing">
              Showing{" "}
              <span className="font-semibold">
                {libraryCollectionTab === "past"
                  ? finalPastPapers.length
                  : finalMockPapers.length}
              </span>{" "}
              paper
              {(libraryCollectionTab === "past"
                ? finalPastPapers.length
                : finalMockPapers.length) === 1
                ? ""
                : "s"}{" "}
              in this view
              {catalogLoading ? " · loading…" : ""}.
            </div>

            {catalogError ? (
              <div className="edu-card rounded-2xl border border-destructive/30 bg-destructive/5 p-8 text-center text-sm text-destructive">
                {catalogError}
              </div>
            ) : catalogLoading ? (
              <div className="edu-card rounded-2xl border border-dashed border-border p-12 text-center text-sm text-muted-foreground">
                Loading mock papers…
              </div>
            ) : (libraryCollectionTab === "past"
                ? finalPastPapers.length
                : finalMockPapers.length) === 0 ? (
              <div className="edu-card rounded-2xl border border-dashed border-border p-12 text-center">
                <ListOrdered className="mx-auto mb-3 h-10 w-10 text-muted-foreground" />
                <p className="font-semibold text-foreground">
                  {(libraryCollectionTab === "past"
                    ? pastPapersByClassLevel.length
                    : mockPapersByClassLevel.length) === 0
                    ? "No papers published for your class yet"
                    : "No papers match your filters"}
                </p>
                <p className="mt-1 text-sm text-muted-foreground">
                  {(libraryCollectionTab === "past"
                    ? pastPapersByClassLevel.length
                    : mockPapersByClassLevel.length) === 0
                    ? "Ask your admin to publish mock papers or run the seed import."
                    : "Try another exam or clear the search."}
                </p>
              </div>
            ) : (
              <div className="grid">
                {(libraryCollectionTab === "past"
                  ? finalPastPapers
                  : finalMockPapers
                ).map((paper) => {
                  const paperYear = getPaperYear(paper.title);
                  const isFeatured = paperYear === 2024;
                  return (
                    <div
                      key={paper.id}
                      className={cn("card", isFeatured && "featured")}
                    >
                      <div className="card-meta">
                        <span className="cmeta-tag">
                          {libraryCollectionTab === "past"
                            ? "Past Paper"
                            : mockPaperTypeLabel((paper as MockPaper).type)}
                        </span>
                        <span className="standard">
                          &middot;{" "}
                          {paper.exam === "BITSAT" ||
                          paper.exam === "JEE Main" ||
                          paper.exam === "KCET"
                            ? "12th standard"
                            : `Class ${paper.classLevel}`}
                        </span>
                        {isFeatured ? (
                          <span className="streak-badge">
                            <Star className="h-2.5 w-2.5 fill-current" />
                            Full syllabus
                          </span>
                        ) : null}
                        {paper.exam === "KCET" &&
                          (paper.subjectsCovered?.length ?? 0) >= 4 && (
                            <span className="streak-badge">
                              Dual Stream (PCMB)
                            </span>
                          )}
                      </div>
                      <h3 className="card-title">
                        {paper.title}
                      </h3>
                      <div className="stats-row">
                        <div className="stat">
                          <ClipboardList className="h-4 w-4" />
                          <div className="stat-body">
                            <div className="stat-val">{paper.questionsCount}</div>
                            <div className="stat-lbl">Qs</div>
                          </div>
                        </div>
                        <div className="stat-sep"></div>
                        <div className="stat">
                          <Clock className="h-4 w-4" />
                          <div className="stat-body">
                            <div className="stat-val">{paper.durationMinutes}</div>
                            <div className="stat-lbl">Min</div>
                          </div>
                        </div>
                        <div className="stat-sep"></div>
                        <div className="stat">
                          <Award className="h-4 w-4" />
                          <div className="stat-body">
                            <div className="stat-val">{paper.totalMarks}</div>
                            <div className="stat-lbl">Marks</div>
                          </div>
                        </div>
                        <button
                          type="button"
                          className="play-btn"
                          aria-label={`Start ${paper.title} exam`}
                          onClick={() =>
                            openNtaInstructionsForPaper(
                              paper,
                              libraryCollectionTab === "past" ? "past" : "mock"
                            )
                          }
                        >
                          <Play className="h-4 w-4 fill-current text-white animate-pulse" />
                        </button>
                      </div>
                    </div>
                  );
                })}
              </div>
            )}
          </div>
        )}
      </div>
    </motion.div>
  );
}
