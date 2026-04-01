import { NextResponse } from "next/server";
import { getSupabaseAndUser } from "@/lib/apiAuth";
import { isAdminUser } from "@/lib/admin";

type QueryParams = {
  board: string;
  subject: string;
  classLevel: number;
  topic: string;
  level: string;
  hubScope: "topic" | "chapter";
};

type UpsertBody = {
  board: string;
  subject: string;
  classLevel: number;
  topic: string;
  level: string;
  hubScope: "topic" | "chapter";
  whyStudy: string;
  whatLearn: string;
  realWorld: string;
  subtopicPreviews: { subtopicName: string; preview: string }[];
};

function normalizeSubtopicPreviews(value: unknown): { subtopicName: string; preview: string }[] {
  if (!Array.isArray(value)) return [];
  const rows = value
    .map((item) => {
      if (!item || typeof item !== "object") return null;
      const row = item as Record<string, unknown>;
      const subtopicName = String(
        row.subtopicName ?? row.subtopic_name ?? ""
      ).trim();
      const preview = typeof row.preview === "string" ? row.preview.trim() : "";
      if (!subtopicName || !preview) return null;
      return { subtopicName, preview };
    })
    .filter(
      (item): item is { subtopicName: string; preview: string } => Boolean(item)
    );
  return rows.slice(0, 80);
}

function parseQuery(url: string): QueryParams | null {
  const search = new URL(url).searchParams;
  const board = search.get("board")?.trim() ?? "";
  const subject = search.get("subject")?.trim() ?? "";
  const classLevelRaw = Number(search.get("classLevel"));
  const topic = search.get("topic")?.trim() ?? "";
  const level = search.get("level")?.trim() ?? "";
  const hubRaw = (search.get("hubScope") ?? "topic").trim().toLowerCase();
  const hubScope: "topic" | "chapter" = hubRaw === "chapter" ? "chapter" : "topic";
  if (!board || !subject || !topic || !level || Number.isNaN(classLevelRaw)) {
    return null;
  }
  return { board, subject, classLevel: classLevelRaw, topic, level, hubScope };
}

/** Narrow fluent client for topic_content when Supabase generics don’t infer this table. */
type TopicContentSelectBuilder = {
  eq: (column: string, value: string | number) => TopicContentSelectBuilder;
  maybeSingle: () => Promise<{
    data: {
      why_study?: string | null;
      what_learn?: string | null;
      real_world?: string | null;
      subtopic_previews?: unknown;
    } | null;
    error: { message: string } | null;
  }>;
};

type TopicContentTableClient = {
  select: (columns: string) => TopicContentSelectBuilder;
  upsert: (
    values: Record<string, unknown>,
    options?: Record<string, unknown>
  ) => Promise<{ error: { message: string } | null }>;
};

function parseBody(body: unknown): UpsertBody | null {
  if (!body || typeof body !== "object") return null;
  const b = body as Record<string, unknown>;
  const board = String(b.board ?? "").trim();
  const subject = String(b.subject ?? "").trim();
  const classLevel = Number(b.classLevel);
  const topic = String(b.topic ?? "").trim();
  const level = String(b.level ?? "").trim();
  const hubRaw = String(b.hubScope ?? "topic").trim().toLowerCase();
  const hubScope: "topic" | "chapter" = hubRaw === "chapter" ? "chapter" : "topic";
  const whyStudy = typeof b.whyStudy === "string" ? b.whyStudy : "";
  const whatLearn = typeof b.whatLearn === "string" ? b.whatLearn : "";
  const realWorld = typeof b.realWorld === "string" ? b.realWorld : "";
  const subtopicPreviews = normalizeSubtopicPreviews(b.subtopicPreviews ?? b.subtopic_previews);
  if (!board || !subject || !topic || !level || Number.isNaN(classLevel)) return null;
  return {
    board,
    subject,
    classLevel,
    topic,
    level,
    hubScope,
    whyStudy,
    whatLearn,
    realWorld,
    subtopicPreviews,
  };
}

export async function GET(request: Request) {
  try {
    const ctx = await getSupabaseAndUser(request);
    if (!ctx) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }
    const params = parseQuery(request.url);
    if (!params) {
      return NextResponse.json({ error: "Missing required query params" }, { status: 400 });
    }
    const url = new URL(request.url);
    const includeLatestRun =
      url.searchParams.get("includeLatestRun") === "1" ||
      url.searchParams.get("includeLatestRun") === "true";

    const { supabase, user } = ctx;
    const canEdit = await isAdminUser(supabase, user.id);
    const topicContentTable = supabase.from("topic_content") as unknown as TopicContentTableClient;
    const { data, error } = await topicContentTable
      .select("why_study, what_learn, real_world, subtopic_previews")
      .eq("board", params.board)
      .eq("subject", params.subject)
      .eq("class_level", params.classLevel)
      .eq("topic", params.topic)
      .eq("level", params.level)
      .eq("hub_scope", params.hubScope)
      .maybeSingle();

    if (error) {
      // If the migration is not yet applied, still return canEdit so admins can see the agent button.
      const maybeMissingRelation =
        typeof error.message === "string" &&
        (error.message.includes("relation") || error.message.includes("topic_content"));
      if (maybeMissingRelation) {
        return NextResponse.json({
          whyStudy: "",
          whatLearn: "",
          realWorld: "",
          subtopicPreviews: [],
          exists: false,
          canEdit,
          lastRun: null,
        });
      }
      return NextResponse.json({ error: error.message }, { status: 500 });
    }

    let lastRun: {
      runType: string;
      ragChunkCount: number;
      modelId: string;
      createdAt: string;
    } | null = null;

    if (includeLatestRun && canEdit) {
      const { data: runs, error: runErr } = await supabase
        .from("topic_content_runs")
        .select("run_type, rag_chunk_count, model_id, created_at")
        .eq("board", params.board)
        .eq("subject", params.subject)
        .eq("class_level", params.classLevel)
        .eq("topic", params.topic)
        .eq("level", params.level)
        .eq("hub_scope", params.hubScope)
        .order("created_at", { ascending: false })
        .limit(1);

      const runMissing =
        runErr &&
        typeof runErr.message === "string" &&
        (runErr.message.includes("relation") || runErr.message.includes("topic_content_runs"));
      if (runErr && !runMissing) {
        console.error("topic_content_runs fetch", runErr);
      }
      const row = runs?.[0];
      if (!runErr && row) {
        lastRun = {
          runType: String(row.run_type ?? ""),
          ragChunkCount: typeof row.rag_chunk_count === "number" ? row.rag_chunk_count : 0,
          modelId: String(row.model_id ?? ""),
          createdAt: String(row.created_at ?? ""),
        };
      }
    }

    return NextResponse.json({
      whyStudy: data?.why_study ?? "",
      whatLearn: data?.what_learn ?? "",
      realWorld: data?.real_world ?? "",
      subtopicPreviews: normalizeSubtopicPreviews(data?.subtopic_previews),
      exists: !!data,
      canEdit,
      ...(includeLatestRun ? { lastRun } : {}),
    });
  } catch (e) {
    console.error("topic-content GET error", e);
    return NextResponse.json({ error: "Server error" }, { status: 500 });
  }
}

export async function POST(request: Request) {
  try {
    const ctx = await getSupabaseAndUser(request);
    if (!ctx) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }
    const { supabase, user } = ctx;
    const canEdit = await isAdminUser(supabase, user.id);
    if (!canEdit) {
      return NextResponse.json({ error: "Forbidden" }, { status: 403 });
    }
    const topicContentTable = supabase.from("topic_content") as unknown as TopicContentTableClient;

    const parsed = parseBody(await request.json());
    if (!parsed) {
      return NextResponse.json({ error: "Missing required fields" }, { status: 400 });
    }

    const { error } = await topicContentTable.upsert(
      {
        board: parsed.board,
        subject: parsed.subject,
        class_level: parsed.classLevel,
        topic: parsed.topic,
        level: parsed.level,
        hub_scope: parsed.hubScope,
        why_study: parsed.whyStudy,
        what_learn: parsed.whatLearn,
        real_world: parsed.realWorld,
        subtopic_previews: parsed.subtopicPreviews.map((row) => ({
          subtopic_name: row.subtopicName,
          preview: row.preview,
        })),
        updated_by: user.id,
        updated_at: new Date().toISOString(),
      },
      { onConflict: "board,subject,class_level,topic,level,hub_scope" }
    );
    if (error) {
      return NextResponse.json({ error: error.message }, { status: 500 });
    }
    return NextResponse.json({ ok: true });
  } catch (e) {
    console.error("topic-content POST error", e);
    return NextResponse.json({ error: "Server error" }, { status: 500 });
  }
}
