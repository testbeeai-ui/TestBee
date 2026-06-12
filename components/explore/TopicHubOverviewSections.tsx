"use client";

import TheoryContent from "@/components/TheoryContent";
import { hasDisplayableHubSection } from "@/lib/curriculum/topicHubDisplay";
import type { DifficultyLevel } from "@/lib/slugs";

function decodeAiEscapes(text: string): string {
  if (!text) return text;
  return text
    .replace(/\\r\\n/g, "\n")
    .replace(/\\n/g, "\n")
    .replace(/\\r/g, "\n")
    .replace(/\\t/g, "\t");
}

type SectionKey = "whyStudy" | "whatLearn" | "realWorld";

const SECTION_LABELS: Record<SectionKey, string> = {
  whyStudy: "Why study this topic?",
  whatLearn: "What you will learn",
  realWorld: "Real-world importance",
};

type Props = {
  loading: boolean;
  whyStudy: string;
  whatLearn: string;
  realWorld: string;
  topicContentExists: boolean;
  hasOverviewProse: boolean;
  hasSubtopicPreviews: boolean;
  missingGateLevels?: DifficultyLevel[];
  canEditTopicContent?: boolean;
};

function sectionValue(key: SectionKey, props: Props): string {
  if (key === "whyStudy") return props.whyStudy;
  if (key === "whatLearn") return props.whatLearn;
  return props.realWorld;
}

function emptySectionMessage(props: Props): string {
  if (!props.topicContentExists) {
    return "—";
  }
  if (props.hasSubtopicPreviews && !props.hasOverviewProse) {
    return "Subtopic previews are ready — overview sections are still being filled in.";
  }
  if (props.hasSubtopicPreviews) {
    return "This section is not filled yet. Check subtopic previews below or regenerate the hub.";
  }
  return "—";
}

export default function TopicHubOverviewSections(props: Props) {
  const keys: SectionKey[] = ["whyStudy", "whatLearn", "realWorld"];
  const showGateHint =
    props.canEditTopicContent &&
    (props.missingGateLevels?.length ?? 0) > 0 &&
    props.topicContentExists;

  return (
    <div className="space-y-4 text-sm text-muted-foreground leading-relaxed">
      {keys.map((key) => {
        const value = sectionValue(key, props);
        const hasText = hasDisplayableHubSection(value);
        return (
          <div key={key}>
            <h4 className="font-bold text-foreground text-sm mb-1">{SECTION_LABELS[key]}</h4>
            {props.loading ? (
              <p>Loading…</p>
            ) : hasText ? (
              <div className="theory-content">
                <TheoryContent theory={decodeAiEscapes(value)} />
              </div>
            ) : (
              <p>{emptySectionMessage(props)}</p>
            )}
          </div>
        );
      })}
      {showGateHint ? (
        <p className="text-[11px] font-semibold text-amber-700 dark:text-amber-300">
          Subtopic AI needs viable hub rows for: {props.missingGateLevels!.join(", ")}.
        </p>
      ) : null}
    </div>
  );
}
