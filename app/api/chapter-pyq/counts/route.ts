import { NextResponse } from "next/server";
import { unstable_cache } from "next/cache";
import { getSupabaseAndUser } from "@/lib/auth/apiAuth";
import { createAdminClient } from "@/integrations/supabase/server";
import { CHAPTER_PYQ_CACHE_VERSION } from "@/lib/chapter-pyq/cacheVersion";
import { chaptersForSubject } from "@/lib/chapter-pyq/catalog";
import { fetchPyqPublishableCounts } from "@/lib/chapter-pyq/fetchPyqQuestionsServer";
import { isChapterPyqStudentVisible } from "@/lib/chapter-pyq/visibleChapters";

const CACHE_REVALIDATE_SEC = 3600;

export async function GET(request: Request) {
  try {
    const ctx = await getSupabaseAndUser(request);
    if (!ctx) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

    const loadCached = unstable_cache(
      async () => {
        const supabase = createAdminClient();
        if (!supabase) throw new Error("Database configuration error");
        return fetchPyqPublishableCounts(supabase);
      },
      [`chapter-pyq-counts-v${CHAPTER_PYQ_CACHE_VERSION}`],
      { revalidate: CACHE_REVALIDATE_SEC, tags: ["chapter-pyq-counts"] }
    );

    const raw = await loadCached();
    const hiddenMath = new Set(
      chaptersForSubject("math")
        .filter((c) => !isChapterPyqStudentVisible("math", c.slug))
        .map((c) => c.slug),
    );
    const counts: Record<string, number> = {};
    for (const [slug, n] of Object.entries(raw)) {
      if (hiddenMath.has(slug)) continue;
      counts[slug] = n;
    }

    return NextResponse.json(
      { counts },
      { headers: { "Cache-Control": "private, max-age=60, stale-while-revalidate=3600" } },
    );
  } catch (e) {
    const message = e instanceof Error ? e.message : "Server error";
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
