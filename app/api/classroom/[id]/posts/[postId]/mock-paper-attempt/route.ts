import { NextResponse } from "next/server";
import {
  createAdminClient,
  createClient,
  createClientWithToken,
} from "@/integrations/supabase/server";

type MockQuestionRow = {
  id: string;
  sort_order: number;
  question_html: string;
  solution_html: string | null;
  correct_letter: string;
  options_json: unknown;
};

type AttemptRow = {
  answers_json?: unknown;
  score?: number;
  total?: number;
  submitted_at?: string;
};

type GenericQueryResult<T> = {
  data: T | null;
  error: { code?: string; message?: string } | null;
};

type GenericFrom = {
  from: (table: string) => {
    select: (columns: string) => {
      eq: (
        column: string,
        value: string
      ) => {
        eq: (
          column: string,
          value: string
        ) => {
          maybeSingle: () => Promise<GenericQueryResult<AttemptRow>>;
        };
      };
      in?: never;
    };
  };
};

async function getAuthedUser(request: Request) {
  const tokenFromHeader = request.headers.get("Authorization")?.replace(/^Bearer\s+/i, "") ?? null;
  let user: { id: string } | null = null;
  let cookieClient: Awaited<ReturnType<typeof createClient>> | null = null;
  if (tokenFromHeader) {
    const supabaseWithToken = createClientWithToken(tokenFromHeader);
    const {
      data: { user: u },
    } = await supabaseWithToken.auth.getUser();
    user = u ?? null;
  }
  if (!user) {
    cookieClient = await createClient();
    user = (await cookieClient.auth.getUser()).data?.user ?? null;
  }
  const admin = createAdminClient();
  const authedClient =
    admin ??
    (tokenFromHeader
      ? createClientWithToken(tokenFromHeader)
      : (cookieClient ?? (await createClient())));
  return { user, authedClient };
}

function letterToIndex(letter: string): number {
  const L = (letter ?? "").trim().toUpperCase();
  const i = L.charCodeAt(0) - 65;
  return i >= 0 && i <= 3 ? i : 0;
}

function normalizeAnswers(input: unknown, expectedCount: number): number[] {
  const out = new Array<number>(expectedCount).fill(-1);
  if (!Array.isArray(input)) return out;
  for (let i = 0; i < Math.min(input.length, expectedCount); i += 1) {
    const v = input[i];
    out[i] = typeof v === "number" && Number.isInteger(v) ? v : -1;
  }
  return out;
}

function decodeHtmlEntities(s: string): string {
  return String(s ?? "")
    .replace(/&nbsp;/gi, " ")
    .replace(/&minus;/gi, "\u2212")
    .replace(/&times;/gi, "\u00D7")
    .replace(/&middot;/gi, "\u00B7")
    .replace(/&hellip;/gi, "…")
    .replace(/&lt;/gi, "<")
    .replace(/&gt;/gi, ">")
    .replace(/&amp;/gi, "&");
}

function htmlToMarkdownWithLatex(input: string): string {
  let s = decodeHtmlEntities(input);

  // Preserve math spans as inline KaTeX using $...$
  // Examples:
  // <span class="math-tex"> \frac{13}{36} </span> -> $\frac{13}{36}$
  // <span class="math-tex">$\\text{...}$</span> -> $\\text{...}$
  s = s.replace(
    /<span[^>]*class=["'][^"']*\bmath-tex\b[^"']*["'][^>]*>([\s\S]*?)<\/span>/gi,
    (_m, inner: string) => {
      const cleaned = decodeHtmlEntities(inner)
        .replace(/<[^>]+>/g, " ")
        .replace(/\s+/g, " ")
        .trim()
        .replace(/^\$+/, "")
        .replace(/\$+$/, "");
      return cleaned ? `$${cleaned}$` : "";
    }
  );

  // Basic HTML -> markdown-ish line structure
  s = s
    .replace(/<br\s*\/?>/gi, "\n")
    .replace(/<\/p>/gi, "\n\n")
    .replace(/<p[^>]*>/gi, "")
    .replace(/<\/(strong|b)>/gi, "**")
    .replace(/<(strong|b)[^>]*>/gi, "**")
    .replace(/<\/(em|i)>/gi, "*")
    .replace(/<(em|i)[^>]*>/gi, "*");

  // Strip the rest of tags
  s = s.replace(/<[^>]+>/g, " ");

  // Cleanup whitespace
  s = s
    .replace(/[ \t]+\n/g, "\n")
    .replace(/\n{3,}/g, "\n\n")
    .replace(/[ \t]{2,}/g, " ")
    .trim();

  return s;
}

function parseMockPaperRef(contentJson: unknown): { id: string; title?: string } | null {
  if (!contentJson || typeof contentJson !== "object" || Array.isArray(contentJson)) return null;
  const raw = (contentJson as Record<string, unknown>).mockPaper;
  if (!raw || typeof raw !== "object" || Array.isArray(raw)) return null;
  const r = raw as Record<string, unknown>;
  const id = typeof r.id === "string" ? r.id : "";
  if (!id.trim()) return null;
  const title = typeof r.title === "string" ? r.title : undefined;
  return { id: id.trim(), title };
}

export async function GET(
  request: Request,
  { params }: { params: Promise<{ id: string; postId: string }> }
) {
  const { id: classroomId, postId } = await params;
  if (!classroomId || !postId) {
    return NextResponse.json({ error: "classroom id and post id required" }, { status: 400 });
  }

  const { user, authedClient } = await getAuthedUser(request);
  if (!user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const { data: post, error: postErr } = await authedClient
    .from("posts")
    .select("id, classroom_id, teacher_id, title, content_json")
    .eq("id", postId)
    .maybeSingle();

  if (postErr || !post) return NextResponse.json({ error: "Post not found" }, { status: 404 });
  if (post.classroom_id !== classroomId) {
    return NextResponse.json({ error: "Post does not belong to this classroom" }, { status: 400 });
  }
  if (post.teacher_id !== user.id) {
    return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  }

  const mockPaper = parseMockPaperRef(post.content_json);
  if (!mockPaper) {
    return NextResponse.json(
      { error: "No mock paper found for this assignment." },
      { status: 404 }
    );
  }

  const url = new URL(request.url);
  const reviewAs = url.searchParams.get("reviewAs")?.trim() ?? "";
  if (!reviewAs) {
    return NextResponse.json({ error: "reviewAs required" }, { status: 400 });
  }

  const { data: member } = await authedClient
    .from("classroom_members")
    .select("user_id")
    .eq("classroom_id", classroomId)
    .eq("user_id", reviewAs)
    .maybeSingle();
  if (!member) return NextResponse.json({ error: "Forbidden" }, { status: 403 });

  const { data: questionRows, error: qErr } = await authedClient
    .from("mock_questions")
    .select("id, sort_order, question_html, solution_html, correct_letter, options_json")
    .eq("paper_id", mockPaper.id)
    .order("sort_order", { ascending: true });

  if (qErr) return NextResponse.json({ error: qErr.message }, { status: 500 });

  const rows = (questionRows ?? []) as MockQuestionRow[];
  if (rows.length === 0) {
    return NextResponse.json({ error: "Mock paper has no questions." }, { status: 404 });
  }

  const questions = rows.map((r) => {
    const opts = Array.isArray(r.options_json)
      ? (r.options_json as unknown[]).map((o) => (typeof o === "string" ? o : String(o)))
      : [];
    const padded = [...opts];
    while (padded.length < 4) padded.push("");
    return {
      id: String(r.id),
      question: htmlToMarkdownWithLatex(typeof r.question_html === "string" ? r.question_html : ""),
      options: padded.slice(0, 4).map((o) => htmlToMarkdownWithLatex(o)),
      correctAnswerIndex: letterToIndex(r.correct_letter),
    };
  });

  const genericClient = authedClient as unknown as GenericFrom;
  const { data: attempt, error: attemptErr } = await genericClient
    .from("classroom_generated_test_attempts")
    .select("answers_json, score, total, submitted_at")
    .eq("post_id", postId)
    .eq("user_id", reviewAs)
    .maybeSingle();

  if (attemptErr) {
    return NextResponse.json({ error: attemptErr.message }, { status: 500 });
  }

  const normalizedAnswers = normalizeAnswers(attempt?.answers_json ?? null, questions.length);
  const score = Number(attempt?.score ?? 0);
  const total = Number(attempt?.total ?? questions.length);
  const submittedAt = typeof attempt?.submitted_at === "string" ? attempt.submitted_at : null;

  return NextResponse.json({
    testTitle: post.title || mockPaper.title || "Mock paper",
    questions,
    attempt: attempt
      ? {
          answers: normalizedAnswers,
          score,
          total,
          submittedAt,
        }
      : null,
  });
}
