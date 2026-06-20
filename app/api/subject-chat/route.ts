import { NextRequest, NextResponse } from "next/server";
import { getSarvamGyanModel } from "@/lib/sarvamGyanClient";
import { logAiUsage } from "@/lib/aiLogger";
import { getSupabaseAndUser } from "@/lib/auth/apiAuth";
import {
  appendUserAndAssistantMessages,
  buildSubjectChatContextKey,
  loadThreadMessages,
  type SubjectChatScope,
} from "@/lib/gyan/subjectChatMessages";
import { generateSubjectChatProfPiReply } from "@/lib/gyan/subjectChatProfPi";
import {
  resolveSubjectChatAccessForUser,
  resolveSubjectChatLanguage,
} from "@/lib/subscription/subjectChatLimits";

const VALID_SUBJECTS = new Set(["physics", "chemistry", "math"]);

/** Strip/sanitize a string field from user input to prevent prompt injection. */
function sanitizeField(value: unknown, maxLen = 200): string {
  if (typeof value !== "string") return "";
  return value
    .replace(/[<>\x00-\x1F\x7F]/g, " ")
    .trim()
    .slice(0, maxLen);
}

export async function POST(req: NextRequest) {
  try {
    const authCtx = await getSupabaseAndUser(req);
    if (!authCtx) {
      return NextResponse.json(
        {
          error: "Sign in to use Subject Chat.",
          code: "SUBJECT_CHAT_AUTH_REQUIRED",
        },
        { status: 401 }
      );
    }

    const { data: profile, error: profileError } = await authCtx.supabase
      .from("profiles")
      .select(
        "plan_tier, free_trial_activated, payment_card_details, subscription_started_at, time_travel_offset_ms, subject_chat_regional_language"
      )
      .eq("id", authCtx.user.id)
      .maybeSingle();

    if (profileError) {
      return NextResponse.json({ error: profileError.message }, { status: 500 });
    }

    const chatAccess = await resolveSubjectChatAccessForUser(
      authCtx.supabase,
      authCtx.user.id,
      profile
    );

    if (!chatAccess.canSend) {
      return NextResponse.json(
        {
          error: `Daily limit reached (${chatAccess.dailyLimit} questions per day on your plan). Upgrade for unlimited chat.`,
          code: "SUBJECT_CHAT_DAILY_LIMIT",
          dailyLimit: chatAccess.dailyLimit,
          usedToday: chatAccess.usedToday,
          remaining: 0,
          plan: chatAccess.plan,
        },
        { status: 429 }
      );
    }

    const body = await req.json();
    const rawMessage = body.message;
    const subjectRaw = typeof body.subject === "string" ? body.subject : "physics";
    const subject = VALID_SUBJECTS.has(subjectRaw)
      ? (subjectRaw as "physics" | "chemistry" | "math")
      : "physics";
    const topic = sanitizeField(body.topic, 200);
    const subtopic = sanitizeField(body.subtopic, 200);
    const gradeLevel = body.gradeLevel;
    const grade = typeof gradeLevel === "number" && [11, 12].includes(gradeLevel) ? gradeLevel : 11;
    const board = sanitizeField(body.board, 80);
    const unitSlug = sanitizeField(body.unitSlug, 120);
    const topicSlug = sanitizeField(body.topicSlug, 120);
    const levelSlug = sanitizeField(body.levelSlug, 80);
    const sectionSlug = sanitizeField(body.sectionSlug, 80);
    const unitLabel = sanitizeField(body.unitLabel, 200);
    const chapterTitle = sanitizeField(body.chapterTitle, 200);

    if (typeof rawMessage !== "string" || !rawMessage.trim()) {
      return NextResponse.json({ error: "message is required" }, { status: 400 });
    }
    const message = rawMessage.slice(0, 2000);

    if (!process.env.SARVAM_API_KEY?.trim()) {
      return NextResponse.json(
        { error: "API key not configured. Please add SARVAM_API_KEY to .env" },
        { status: 503 }
      );
    }

    const language = resolveSubjectChatLanguage(
      typeof body.language === "string" ? body.language : "en",
      chatAccess
    );

    const chatScope: SubjectChatScope = {
      subject,
      topic: topic.trim() ? topic : "general",
      subtopic: subtopic.trim() ? subtopic : undefined,
      gradeLevel: grade,
    };
    if (board) chatScope.board = board;
    if (unitSlug) chatScope.unitSlug = unitSlug;
    if (topicSlug) chatScope.topicSlug = topicSlug;
    if (levelSlug) chatScope.levelSlug = levelSlug;
    if (sectionSlug) chatScope.sectionSlug = sectionSlug;
    if (unitLabel) chatScope.unitLabel = unitLabel;
    if (chapterTitle) chatScope.chapterTitle = chapterTitle;
    const contextKey = buildSubjectChatContextKey(chatScope);

    const chatAccessFresh = await resolveSubjectChatAccessForUser(
      authCtx.supabase,
      authCtx.user.id,
      profile
    );
    if (!chatAccessFresh.canSend) {
      return NextResponse.json(
        {
          error: `Daily limit reached (${chatAccessFresh.dailyLimit} questions per day on your plan). Upgrade for unlimited chat.`,
          code: "SUBJECT_CHAT_DAILY_LIMIT",
          dailyLimit: chatAccessFresh.dailyLimit,
          usedToday: chatAccessFresh.usedToday,
          remaining: 0,
          plan: chatAccessFresh.plan,
        },
        { status: 429 }
      );
    }

    const fromDb = await loadThreadMessages(authCtx.supabase, {
      userId: authCtx.user.id,
      contextKey,
      limit: 40,
    });
    let recentHistory = fromDb.slice(-12).map((m) => ({
      role: m.role,
      content: m.content.slice(0, 1000),
    }));
    while (recentHistory.length > 0 && recentHistory[0].role !== "user") {
      recentHistory.shift();
    }

    const chapter = {
      subject,
      topic: topic.trim() ? topic : "general",
      subtopic: subtopic.trim() ? subtopic : undefined,
      gradeLevel: grade,
      board: board || undefined,
      unitSlug: unitSlug || undefined,
      topicSlug: topicSlug || undefined,
      levelSlug: levelSlug || undefined,
      sectionSlug: sectionSlug || undefined,
      unitLabel: unitLabel || undefined,
      chapterTitle: chapterTitle || undefined,
    };

    const generated = await generateSubjectChatProfPiReply({
      message,
      language,
      chapter,
      recentHistory,
      logLabel: contextKey,
    });

    if (!generated.ok) {
      console.error("[api/subject-chat] Prof-Pi generation failed:", generated.error);
      return NextResponse.json(
        { error: "AI service temporarily unavailable. Please try again." },
        { status: 502 }
      );
    }

    await logAiUsage({
      supabase: authCtx.supabase,
      userId: authCtx.user.id,
      actionType: "subject_chat_modal_retrieve",
      modelId: "modal-rag-retrieve",
      backend: "modal",
      metadata: {
        subject,
        gradeLevel: grade,
        topic,
        subtopic,
        ragChunkCount: generated.ragChunksRetrieved ?? 0,
        genericMode: generated.genericMode,
        contextKey,
      },
    });

    await logAiUsage({
      supabase: authCtx.supabase,
      userId: authCtx.user.id,
      actionType: "subject_chat_sarvam",
      modelId: getSarvamGyanModel(),
      backend: "sarvam",
      usage: generated.usage
        ? {
            promptTokenCount: generated.usage.prompt_tokens,
            candidatesTokenCount: generated.usage.completion_tokens,
            totalTokenCount: generated.usage.total_tokens,
          }
        : undefined,
      metadata: {
        subject,
        gradeLevel: grade,
        topic,
        subtopic,
        historyTurns: recentHistory.length,
        ragChunkCount: generated.ragChunksRetrieved ?? 0,
        contextKey,
        plan: chatAccessFresh.plan,
        language,
        genericMode: generated.genericMode,
      },
    });

    await logAiUsage({
      supabase: authCtx.supabase,
      userId: authCtx.user.id,
      actionType: "subject_chat_profpi_quality",
      modelId: getSarvamGyanModel(),
      backend: "sarvam",
      metadata: {
        contextKey,
        verifierRan: generated.quality.verifierRan,
        verifierOk: generated.quality.verifierOk,
        formulaCrossChecked: generated.quality.formulaCrossChecked,
        formulaMismatch: generated.quality.formulaMismatch,
        casVerified: generated.quality.casVerified,
        casMismatches: generated.quality.casMismatches,
        genericMode: generated.genericMode,
      },
    });

    const reply = generated.reply;

    const persist = await appendUserAndAssistantMessages(authCtx.supabase, {
      userId: authCtx.user.id,
      contextKey,
      userText: message,
      assistantText: reply,
    });
    if (!persist.ok) {
      console.warn("[api/subject-chat] failed to persist chat messages:", persist.error);
    }

    const remainingAfter = chatAccessFresh.unlimited
      ? null
      : Math.max(0, chatAccessFresh.dailyLimit - chatAccessFresh.usedToday - 1);

    return NextResponse.json({
      reply,
      language,
      quota: {
        usedToday: chatAccessFresh.usedToday + 1,
        remaining: remainingAfter,
        dailyLimit: chatAccessFresh.unlimited ? null : chatAccessFresh.dailyLimit,
        unlimited: chatAccessFresh.unlimited,
        multilingual: chatAccessFresh.multilingual,
        regionalLanguage: chatAccessFresh.regionalLanguage,
        canSend:
          chatAccessFresh.unlimited ||
          chatAccessFresh.usedToday + 1 < chatAccessFresh.dailyLimit,
      },
    });
  } catch (err) {
    console.error("Subject chat error:", err);
    return NextResponse.json({ error: "Something went wrong. Please try again." }, { status: 500 });
  }
}
