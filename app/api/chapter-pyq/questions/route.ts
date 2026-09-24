import { NextResponse } from "next/server";
import { unstable_cache } from "next/cache";
import { getSupabaseAndUser } from "@/lib/auth/apiAuth";
import { createAdminClient } from "@/integrations/supabase/server";
import { CHAPTER_PYQ_CACHE_VERSION } from "@/lib/chapter-pyq/cacheVersion";
import { fetchPyqRowsForCatalogChapter } from "@/lib/chapter-pyq/fetchPyqQuestionsServer";
import { mapPyqRowsToChapterPyqQuestions } from "@/lib/chapter-pyq/pyqQuestionMap";
import { isPyqSourcedCatalogSlug } from "@/lib/chapter-pyq/pdfChapterMap";
import { findChapter } from "@/lib/chapter-pyq/catalog";
import { isChapterPyqStudentVisible } from "@/lib/chapter-pyq/visibleChapters";

const CACHE_REVALIDATE_SEC = 3600;

export async function GET(request: Request) {
  try {
    const ctx = await getSupabaseAndUser(request);
    if (!ctx) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

    const url = new URL(request.url);
    const chapter = url.searchParams.get("chapter")?.trim() ?? "";
    const subject = url.searchParams.get("subject")?.trim() ?? "physics";
    const entry = findChapter(subject, chapter);
    if (!entry || !isChapterPyqStudentVisible(subject, chapter)) {
      return NextResponse.json({ error: "not_found" }, { status: 404 });
    }
    if (!isPyqSourcedCatalogSlug(chapter)) {
      return NextResponse.json({ catalogSlug: chapter, chapterName: entry.name, questions: [] });
    }

    const loadCached = unstable_cache(
      async () => {
        const supabase = createAdminClient();
        if (!supabase) throw new Error("Database configuration error");
        const rows = await fetchPyqRowsForCatalogChapter(supabase, chapter);
        return mapPyqRowsToChapterPyqQuestions(rows, entry.name);
      },
      [`chapter-pyq-questions-v${CHAPTER_PYQ_CACHE_VERSION}`, subject, chapter],
      { revalidate: CACHE_REVALIDATE_SEC, tags: [`chapter-pyq-${subject}-${chapter}`] }
    );

    return NextResponse.json(await loadCached(), {
      headers: { "Cache-Control": "private, no-store" },
    });
  } catch (e) {
    const message = e instanceof Error ? e.message : "Server error";
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
