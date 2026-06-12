import { NextResponse } from "next/server";
import { isAdminUser } from "@/lib/admin/admin";
import { getSupabaseAndUser } from "@/lib/auth/apiAuth";
import {
  countSubtopicPreviews,
  hasDisplayableHubSection,
  isTopicHubRowViable,
} from "@/lib/curriculum/topicHubDisplay";
import type { TopicContentGateRow } from "@/lib/curriculum/subtopicCompleteness";
import { createAdminClient } from "@/integrations/supabase/server";
import type { DifficultyLevel } from "@/lib/slugs";

const LEVELS: DifficultyLevel[] = ["basics", "intermediate", "advanced"];

type TopicContentRow = {
  board: string;
  subject: string;
  class_level: number;
  topic: string;
  level: string;
  hub_scope: string;
  why_study: string | null;
  what_learn: string | null;
  real_world: string | null;
  subtopic_previews: unknown;
};

type LevelCoverage = {
  exists: boolean;
  hasOverviewProse: boolean;
  previewCount: number;
  gateViable: boolean;
};

type HubCoverageGroup = {
  board: string;
  subject: string;
  classLevel: number;
  topic: string;
  hubScope: string;
  levels: Record<DifficultyLevel, LevelCoverage>;
  missingGateLevels: DifficultyLevel[];
  anyRow: boolean;
  fullyGated: boolean;
};

function emptyLevelCoverage(): LevelCoverage {
  return {
    exists: false,
    hasOverviewProse: false,
    previewCount: 0,
    gateViable: false,
  };
}

function rowToGate(row: TopicContentRow): TopicContentGateRow {
  return {
    why_study: row.why_study,
    what_learn: row.what_learn,
    real_world: row.real_world,
    subtopic_previews: row.subtopic_previews,
  };
}

function levelCoverageFromRow(row: TopicContentRow | undefined): LevelCoverage {
  if (!row) return emptyLevelCoverage();
  const gate = rowToGate(row);
  return {
    exists: true,
    hasOverviewProse:
      hasDisplayableHubSection(row.why_study) ||
      hasDisplayableHubSection(row.what_learn) ||
      hasDisplayableHubSection(row.real_world),
    previewCount: countSubtopicPreviews(row.subtopic_previews),
    gateViable: isTopicHubRowViable(gate),
  };
}

export async function GET(request: Request) {
  try {
    const ctx = await getSupabaseAndUser(request);
    if (!ctx) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    if (!(await isAdminUser(ctx.supabase, ctx.user.id))) {
      return NextResponse.json({ error: "Forbidden" }, { status: 403 });
    }

    const admin = createAdminClient();
    if (!admin) {
      return NextResponse.json({ error: "SUPABASE_SERVICE_ROLE_KEY is not set" }, { status: 500 });
    }

    const url = new URL(request.url);
    const board = (url.searchParams.get("board") ?? "").trim();
    const subject = (url.searchParams.get("subject") ?? "").trim();
    const classLevelRaw = url.searchParams.get("classLevel");
    const hubScope = (url.searchParams.get("hubScope") ?? "").trim().toLowerCase();
    const topicSearch = (url.searchParams.get("topic") ?? "").trim().toLowerCase();
    const limit = Math.min(500, Math.max(1, Number(url.searchParams.get("limit") ?? "200")));

    let query = admin
      .from("topic_content")
      .select(
        "board, subject, class_level, topic, level, hub_scope, why_study, what_learn, real_world, subtopic_previews"
      )
      .order("updated_at", { ascending: false })
      .limit(5000);

    if (board) query = query.eq("board", board);
    if (subject) query = query.eq("subject", subject);
    if (classLevelRaw) {
      const classLevel = Number(classLevelRaw);
      if (!Number.isNaN(classLevel)) query = query.eq("class_level", classLevel);
    }
    if (hubScope === "topic" || hubScope === "chapter") {
      query = query.eq("hub_scope", hubScope);
    }

    const { data, error } = await query;
    if (error) {
      return NextResponse.json({ error: error.message }, { status: 500 });
    }

    const groupMap = new Map<string, HubCoverageGroup>();

    for (const raw of (data ?? []) as unknown as TopicContentRow[]) {
      const level = raw.level as DifficultyLevel;
      if (!LEVELS.includes(level)) continue;

      const key = [
        raw.board,
        raw.subject,
        raw.class_level,
        raw.hub_scope ?? "topic",
        raw.topic,
      ].join("\0");

      let group = groupMap.get(key);
      if (!group) {
        group = {
          board: raw.board,
          subject: raw.subject,
          classLevel: raw.class_level,
          topic: raw.topic,
          hubScope: raw.hub_scope ?? "topic",
          levels: {
            basics: emptyLevelCoverage(),
            intermediate: emptyLevelCoverage(),
            advanced: emptyLevelCoverage(),
          },
          missingGateLevels: [...LEVELS],
          anyRow: false,
          fullyGated: false,
        };
        groupMap.set(key, group);
      }

      group.levels[level] = levelCoverageFromRow(raw);
      group.anyRow = true;
    }

    let groups = Array.from(groupMap.values()).map((group) => {
      const missingGateLevels = LEVELS.filter((l) => !group.levels[l].gateViable);
      return {
        ...group,
        missingGateLevels,
        fullyGated: missingGateLevels.length === 0 && group.anyRow,
      };
    });

    if (topicSearch) {
      groups = groups.filter((g) => g.topic.toLowerCase().includes(topicSearch));
    }

    groups.sort((a, b) => {
      if (a.fullyGated !== b.fullyGated) return a.fullyGated ? 1 : -1;
      if (a.missingGateLevels.length !== b.missingGateLevels.length) {
        return b.missingGateLevels.length - a.missingGateLevels.length;
      }
      return a.topic.localeCompare(b.topic);
    });

    const sliced = groups.slice(0, limit);
    const summary = {
      totalGroups: groups.length,
      fullyGated: groups.filter((g) => g.fullyGated).length,
      partial: groups.filter((g) => g.anyRow && !g.fullyGated).length,
      returned: sliced.length,
    };

    return NextResponse.json({ groups: sliced, summary });
  } catch (e) {
    const message = e instanceof Error ? e.message : "Failed to load coverage";
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
