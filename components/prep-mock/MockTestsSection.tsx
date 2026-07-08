"use client";

import { useState, useEffect } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { ClipboardList, ArrowRight } from "lucide-react";
import type { PastPaper, Subject } from "@/types";
import { cn } from "@/lib/utils";
import { supabase } from "@/integrations/supabase/client";

interface MockTestsSectionProps {
  subjects: Subject[];
  onStartMock: (subject: Subject) => void;
  onViewAll: () => void;
  featuredPaper: PastPaper | null;
  featuredLoading?: boolean;
  onStartFeaturedPaper: () => void;
  showCbseMcqViewAllGuide?: boolean;
}

interface MockTestItem {
  id: string;
  badgeLabel: string;
  badgeClassName: string;
  title: string;
  details: string;
  tags: string[];
  subject: Subject | "physics";
  isFeatured?: boolean;
  slug?: string;
}

export default function MockTestsSection({
  subjects,
  onStartMock,
  onViewAll,
  onStartFeaturedPaper,
}: MockTestsSectionProps) {
  const router = useRouter();
  const [activeFilter, setActiveFilter] = useState("all");
  const [realPyqs, setRealPyqs] = useState<MockTestItem[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    (async () => {
      try {
        const { data, error } = await supabase
          .from("past_papers")
          .select("id, slug, title, exam_name, duration_minutes, question_count, total_marks, class_level, tags, created_at")
          .eq("paper_type", "pyq")
          .eq("published", true)
          .order("created_at", { ascending: false });

        if (error) throw error;

        const extractYear = (title: string): number => {
          const match = title.match(/\b(20\d{2}|19\d{2})\b/);
          return match ? parseInt(match[1], 10) : 0;
        };

        const sortedData = (data ?? []).sort((a, b) => {
          const yearA = extractYear(a.title);
          const yearB = extractYear(b.title);
          if (yearA !== yearB) {
            return yearB - yearA;
          }
          return new Date(b.created_at || 0).getTime() - new Date(a.created_at || 0).getTime();
        });

        const mapped: MockTestItem[] = sortedData.map((row, index) => {
          const exam = (row.exam_name ?? "").toLowerCase();
          let tag = "jee";
          let badgeLabel = `J${index + 1}`;
          let badgeClassName = "bg-sky-500";

          if (exam.includes("kcet")) {
            tag = "kcet";
            badgeLabel = `K${index + 1}`;
            badgeClassName = "bg-emerald-600";
          } else if (exam.includes("bitsat")) {
            tag = "bitsat";
            badgeLabel = `B${index + 1}`;
            badgeClassName = "bg-purple-600";
          }

          return {
            id: row.id,
            badgeLabel,
            badgeClassName,
            title: row.title,
            details: `${row.duration_minutes} mins · ${row.question_count} Qs · ${row.total_marks} marks · Class ${row.class_level} · PYQ`,
            tags: [tag],
            subject: "physics",
            isFeatured: true,
            slug: row.slug,
          };
        });

        setRealPyqs(mapped);
      } catch (err) {
        console.error("Error loading past papers:", err);
      } finally {
        setLoading(false);
      }
    })();
  }, []);

  const combinedMocks: MockTestItem[] = [
    ...realPyqs,
    {
      id: "chem-syllabus",
      badgeLabel: "C2",
      badgeClassName: "bg-purple-500",
      title: "Chemistry Full Syllabus Mock",
      details: "90 mins · 36 Qs · Adaptive difficulty",
      tags: ["kcet", "jee"],
      subject: "chemistry",
    },
    {
      id: "math-syllabus",
      badgeLabel: "M3",
      badgeClassName: "bg-orange-500",
      title: "Mathematics Full Syllabus Mock",
      details: "90 mins · 36 Qs · Adaptive difficulty",
      tags: ["kcet", "jee"],
      subject: "math",
    },
    {
      id: "phys-syllabus",
      badgeLabel: "P4",
      badgeClassName: "bg-blue-500",
      title: "Physics Full Syllabus Mock",
      details: "90 mins · 36 Qs · Adaptive difficulty",
      tags: ["kcet", "jee"],
      subject: "physics",
    },
  ];

  // Dynamic filter pills - only show if there is at least one mock matching it
  const filterPills = [
    { id: "all", label: "All" },
    { id: "jee", label: "JEE Main" },
    { id: "kcet", label: "KCET" },
    { id: "bitsat", label: "BITSAT" },
  ].filter(
    (pill) =>
      pill.id === "all" ||
      combinedMocks.some((m) => m.tags.includes(pill.id))
  );

  const filteredMocks = activeFilter === "all"
    ? combinedMocks
    : combinedMocks.filter((m) => m.tags.includes(activeFilter));

  const displayMocks = filteredMocks.slice(0, 5);

  const handleStart = (item: MockTestItem) => {
    if (item.isFeatured && item.slug) {
      router.push(`/mock-test?paper=${encodeURIComponent(item.slug)}`);
    } else {
      onStartMock(item.subject);
    }
  };

  return (
    <div className="rounded-xl border border-border/50 bg-card/30 p-4 space-y-4">
      {/* Header */}
      <div className="flex items-center justify-between">
        <h3 className="font-display font-bold text-foreground text-sm flex items-center gap-2">
          <ClipboardList className="w-4 h-4 text-primary" />
          Mock Tests
        </h3>
        <button
          type="button"
          onClick={onViewAll}
          className="text-xs font-bold text-blue-400 hover:underline flex items-center gap-1"
        >
          View all <ArrowRight className="w-3.5 h-3.5" />
        </button>
      </div>

      {/* Filter pills */}
      <div className="flex flex-wrap gap-1.5 pt-0.5">
        {filterPills.map((pill) => {
          const active = activeFilter === pill.id;
          return (
            <button
              key={pill.id}
              type="button"
              onClick={() => setActiveFilter(pill.id)}
              className={cn(
                "px-3 py-1 rounded-full text-xs font-bold transition-all border",
                active
                  ? "bg-primary text-primary-foreground border-primary"
                  : "bg-zinc-800/40 border-zinc-700/60 text-zinc-400 hover:text-zinc-200 hover:bg-zinc-800/80"
              )}
            >
              {pill.label}
            </button>
          );
        })}
      </div>

      {/* List of Mock Tests */}
      <div className="space-y-2">
        {displayMocks.map((item) => (
          <div
            key={item.id}
            className="flex items-center gap-3 p-3 rounded-xl border border-white/5 bg-[#111418]/60"
          >
            <div
              className={cn(
                "w-9 h-9 rounded-xl flex items-center justify-center shrink-0 text-white font-extrabold text-[12.5px] shadow-inner",
                item.badgeClassName
              )}
            >
              {item.badgeLabel}
            </div>
            <div className="flex-1 min-w-0">
              <p className="font-bold text-[12.5px] text-foreground truncate">{item.title}</p>
              <p className="text-[10.5px] text-muted-foreground truncate">{item.details}</p>
            </div>
            <button
              type="button"
              onClick={() => handleStart(item)}
              className="shrink-0 rounded-full border border-zinc-700/60 hover:border-zinc-500 bg-transparent px-3.5 py-1 text-[10.5px] font-bold text-zinc-300 hover:text-white transition-colors"
            >
              Start →
            </button>
          </div>
        ))}

        {displayMocks.length === 0 && (
          <div className="text-center py-6 text-xs text-muted-foreground">
            No mock tests match the selected filter.
          </div>
        )}
      </div>
    </div>
  );
}
