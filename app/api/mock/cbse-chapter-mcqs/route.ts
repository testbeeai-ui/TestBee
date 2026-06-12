import { NextResponse } from "next/server";
import { unstable_cache } from "next/cache";
import { getSupabaseAndUser } from "@/lib/auth/apiAuth";
import { fetchCbseChapterMcqsServer } from "@/lib/mock/fetchCbseChapterMcqsServer";
import { createAdminClient } from "@/integrations/supabase/server";

const CACHE_REVALIDATE_SEC = 3600;

export async function GET(request: Request) {
  try {
    const ctx = await getSupabaseAndUser(request);
    if (!ctx) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

    const url = new URL(request.url);
    const chapterId = url.searchParams.get("chapterId")?.trim() ?? "";
    const classLevelRaw = Number(url.searchParams.get("classLevel"));
    if (!chapterId) {
      return NextResponse.json({ error: "chapterId required" }, { status: 400 });
    }
    if (classLevelRaw !== 11 && classLevelRaw !== 12) {
      return NextResponse.json({ error: "classLevel must be 11 or 12" }, { status: 400 });
    }
    const classLevel = classLevelRaw as 11 | 12;

    const loadCached = unstable_cache(
      async () => {
        const supabase = createAdminClient() ?? ctx.supabase;
        return fetchCbseChapterMcqsServer(supabase, chapterId, classLevel);
      },
      ["cbse-chapter-mcqs", chapterId, String(classLevel)],
      { revalidate: CACHE_REVALIDATE_SEC, tags: [`cbse-mcq-${chapterId}`] }
    );

    const bundle = await loadCached();
    if (!bundle) {
      return NextResponse.json({ error: "not_found" }, { status: 404 });
    }

    return NextResponse.json(bundle, {
      headers: {
        "Cache-Control": "private, max-age=300, stale-while-revalidate=3600",
      },
    });
  } catch (e) {
    const message = e instanceof Error ? e.message : "Server error";
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
