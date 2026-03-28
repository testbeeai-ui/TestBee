import { NextResponse } from "next/server";
import { getSupabaseAndUser } from "@/lib/apiAuth";
import { isAdminUser } from "@/lib/admin";
import { normalizeSubjectKey, normalizeSubtopicContentKey } from "@/lib/subtopicContentKeys";

type QueryParams = {
  board: string;
  subject: string;
  classLevel: number;
  topic: string;
  subtopicName: string;
  level: string;
};

function parseQuery(url: string): QueryParams | null {
  const search = new URL(url).searchParams;
  const board = normalizeSubtopicContentKey(search.get("board") ?? "");
  const subject = normalizeSubjectKey(search.get("subject") ?? "");
  const classLevelRaw = Number(search.get("classLevel"));
  const topic = normalizeSubtopicContentKey(search.get("topic") ?? "");
  const subtopicName = normalizeSubtopicContentKey(search.get("subtopicName") ?? "");
  const level = normalizeSubtopicContentKey(search.get("level") ?? "");
  if (!board || !subject || !topic || !subtopicName || !level || Number.isNaN(classLevelRaw)) {
    return null;
  }
  return { board, subject, classLevel: classLevelRaw, topic, subtopicName, level };
}

function normalizeReferences(raw: unknown): { type: string; title: string; url: string; description?: string }[] {
  if (!Array.isArray(raw)) return [];
  const out: { type: string; title: string; url: string; description?: string }[] = [];
  for (const item of raw) {
    if (!item || typeof item !== "object") continue;
    const o = item as Record<string, unknown>;
    const type = o.type === "video" || o.type === "reading" ? o.type : null;
    const title = typeof o.title === "string" ? o.title.trim() : "";
    const url = typeof o.url === "string" ? o.url.trim() : "";
    if (!type || !title || !url) continue;
    const description = typeof o.description === "string" ? o.description.trim() : undefined;
    out.push(description ? { type, title, url, description } : { type, title, url });
  }
  return out;
}

function legacySanitizeForLookup(value: string): string {
  // Legacy generator builds replaced "<" / ">" with spaces before persisting.
  // Keep fallback lookup for already-saved rows.
  return value.replace(/[<>\x00-\x1F\x7F]/g, " ").replace(/\s+/g, " ").trim();
}

function looseCollisionKey(value: string): string {
  return value.toLowerCase().replace(/[^a-z0-9]+/g, " ").replace(/\s+/g, " ").trim();
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
    const { supabase, user } = ctx;
    const baseQuery = supabase
      .from("subtopic_content")
      .select("theory, reading_references, did_you_know, instacue_cards, bits_questions, practice_formulas")
      .eq("board", params.board)
      .eq("subject", params.subject)
      .eq("class_level", params.classLevel)
      .eq("topic", params.topic)
      .eq("subtopic_name", params.subtopicName)
      .eq("level", params.level);

    let { data, error } = await baseQuery.maybeSingle();
    if (!error && !data) {
      const legacyTopic = legacySanitizeForLookup(params.topic);
      const legacySubtopic = legacySanitizeForLookup(params.subtopicName);
      if (legacyTopic !== params.topic || legacySubtopic !== params.subtopicName) {
        const fallback = await supabase
          .from("subtopic_content")
          .select("theory, reading_references, did_you_know, instacue_cards, bits_questions, practice_formulas")
          .eq("board", params.board)
          .eq("subject", params.subject)
          .eq("class_level", params.classLevel)
          .eq("topic", legacyTopic)
          .eq("subtopic_name", legacySubtopic)
          .eq("level", params.level)
          .maybeSingle();
        data = fallback.data;
        error = fallback.error;
        // Self-heal legacy key rows: copy found row into canonical key so future reads are stable.
        if (!fallback.error && fallback.data) {
          const { error: healError } = await supabase.from("subtopic_content").upsert(
            {
              board: params.board,
              subject: params.subject,
              class_level: params.classLevel,
              topic: params.topic,
              subtopic_name: params.subtopicName,
              level: params.level,
              theory: fallback.data.theory ?? "",
              reading_references: Array.isArray(fallback.data.reading_references)
                ? fallback.data.reading_references
                : [],
              did_you_know: fallback.data.did_you_know ?? "",
              instacue_cards: Array.isArray(fallback.data.instacue_cards)
                ? fallback.data.instacue_cards
                : [],
              bits_questions: Array.isArray(fallback.data.bits_questions)
                ? fallback.data.bits_questions
                : [],
              practice_formulas: Array.isArray(fallback.data.practice_formulas)
                ? fallback.data.practice_formulas
                : [],
              updated_by: user.id,
              updated_at: new Date().toISOString(),
            },
            { onConflict: "board,subject,class_level,topic,subtopic_name,level" }
          );
          if (healError) {
            console.warn("legacy key self-heal upsert failed", healError);
          }
        }
      }
    }
    if (!error && !data) {
      // Final collision fallback: search sibling rows and pick the closest key match.
      const candidates = await supabase
        .from("subtopic_content")
        .select("topic, subtopic_name, updated_at, theory, reading_references, did_you_know, instacue_cards, bits_questions, practice_formulas")
        .eq("board", params.board)
        .eq("subject", params.subject)
        .eq("class_level", params.classLevel)
        .eq("level", params.level)
        .order("updated_at", { ascending: false })
        .limit(200);
      if (!candidates.error && Array.isArray(candidates.data) && candidates.data.length > 0) {
        const targetTopic = looseCollisionKey(params.topic);
        const targetSubtopic = looseCollisionKey(params.subtopicName);
        const match = candidates.data.find((row) => {
          const rowTopic = looseCollisionKey(String(row.topic ?? ""));
          const rowSub = looseCollisionKey(String(row.subtopic_name ?? ""));
          return rowTopic === targetTopic && rowSub === targetSubtopic;
        });
        if (match) {
          data = {
            theory: match.theory,
            reading_references: match.reading_references,
            did_you_know: match.did_you_know,
            instacue_cards: match.instacue_cards,
            bits_questions: match.bits_questions,
            practice_formulas: match.practice_formulas,
          };
          const { error: healError } = await supabase.from("subtopic_content").upsert(
            {
              board: params.board,
              subject: params.subject,
              class_level: params.classLevel,
              topic: params.topic,
              subtopic_name: params.subtopicName,
              level: params.level,
              theory: match.theory ?? "",
              reading_references: Array.isArray(match.reading_references) ? match.reading_references : [],
              did_you_know: match.did_you_know ?? "",
              instacue_cards: Array.isArray(match.instacue_cards) ? match.instacue_cards : [],
              bits_questions: Array.isArray(match.bits_questions) ? match.bits_questions : [],
              practice_formulas: Array.isArray(match.practice_formulas) ? match.practice_formulas : [],
              updated_by: user.id,
              updated_at: new Date().toISOString(),
            },
            { onConflict: "board,subject,class_level,topic,subtopic_name,level" }
          );
          if (healError) {
            console.warn("collision self-heal upsert failed", healError);
          }
        }
      }
    }
    if (error) {
      return NextResponse.json({ error: error.message }, { status: 500 });
    }
    const canEdit = await isAdminUser(supabase, user.id);
    const refs = normalizeReferences(data?.reading_references);
    return NextResponse.json({
      theory: data?.theory ?? "",
      references: refs,
      didYouKnow: data?.did_you_know ?? "",
      instacueCards: Array.isArray(data?.instacue_cards) ? data.instacue_cards : [],
      bitsQuestions: Array.isArray(data?.bits_questions) ? data.bits_questions : [],
      practiceFormulas: Array.isArray(data?.practice_formulas) ? data.practice_formulas : [],
      exists: !!data,
      canEdit,
    });
  } catch (e) {
    console.error("subtopic-content GET error", e);
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

    const body = await request.json();
    const board = normalizeSubtopicContentKey(body?.board);
    const subject = normalizeSubjectKey(body?.subject);
    const classLevel = Number(body?.classLevel);
    const topic = normalizeSubtopicContentKey(body?.topic);
    const subtopicName = normalizeSubtopicContentKey(body?.subtopicName);
    const level = normalizeSubtopicContentKey(body?.level);
    const theory = typeof body?.theory === "string" ? body.theory : "";
    const didYouKnow = typeof body?.didYouKnow === "string" ? body.didYouKnow : "";
    const refsBody = body?.references;
    const references = normalizeReferences(refsBody);

    if (!board || !subject || !topic || !subtopicName || !level || Number.isNaN(classLevel)) {
      return NextResponse.json({ error: "Missing required fields" }, { status: 400 });
    }

    const { error } = await supabase.from("subtopic_content").upsert(
      {
        board,
        subject,
        class_level: classLevel,
        topic,
        subtopic_name: subtopicName,
        level,
        theory,
        reading_references: references,
        did_you_know: didYouKnow,
        updated_by: user.id,
        updated_at: new Date().toISOString(),
      },
      {
        onConflict: "board,subject,class_level,topic,subtopic_name,level",
      }
    );

    if (error) {
      return NextResponse.json({ error: error.message }, { status: 500 });
    }
    return NextResponse.json({ ok: true });
  } catch (e) {
    console.error("subtopic-content POST error", e);
    return NextResponse.json({ error: "Server error" }, { status: 500 });
  }
}
