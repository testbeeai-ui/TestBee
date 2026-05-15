import { NextRequest, NextResponse } from "next/server";
import {
  deleteNewsBlogPost,
  insertNewsBlogPost,
  listNewsBlogPosts,
  updateNewsBlogPost,
  type NewsBlogPostRow,
} from "@/lib/news-blog/supabase";
import { createClient } from "@/integrations/supabase/server";
import { isAdminUser } from "@/lib/admin";
import { isValidBlogSectionId } from "@/lib/news-blog-sections";

export const runtime = "nodejs";

async function verifyAdmin(): Promise<
  { authorized: true } | { authorized: false; error: NextResponse }
> {
  const supabase = await createClient();
  const {
    data: { user },
    error: userErr,
  } = await supabase.auth.getUser();

  if (userErr || !user?.id) {
    return {
      authorized: false,
      error: NextResponse.json({ error: "Unauthorized" }, { status: 401 }),
    };
  }

  const admin = await isAdminUser(supabase, user.id);
  if (!admin) {
    return {
      authorized: false,
      error: NextResponse.json({ error: "Forbidden - Admin access required" }, { status: 403 }),
    };
  }

  return { authorized: true };
}

export async function GET() {
  try {
    const posts = await listNewsBlogPosts();
    return NextResponse.json({ posts });
  } catch (error) {
    return NextResponse.json({ error: "Failed to list posts" }, { status: 500 });
  }
}

export async function POST(req: NextRequest) {
  let adminCheck: Awaited<ReturnType<typeof verifyAdmin>>;
  try {
    adminCheck = await verifyAdmin();
  } catch (error) {
    console.error("[news-blog] POST verifyAdmin:", error);
    const message = error instanceof Error ? error.message : "Auth check failed";
    return NextResponse.json({ error: message }, { status: 500 });
  }
  if (!adminCheck.authorized) return adminCheck.error;

  try {
    let body: Partial<NewsBlogPostRow>;
    try {
      body = (await req.json()) as Partial<NewsBlogPostRow>;
    } catch {
      return NextResponse.json({ error: "Invalid JSON body" }, { status: 400 });
    }
    const id = body.id != null ? String(body.id).trim() : "";
    const portal = body.portal;
    const sectionRaw = body.section != null ? String(body.section) : "";
    const section =
      portal === "blog" && sectionRaw === "bmind" ? "bmattitude" : sectionRaw;
    const exam = body.exam != null ? String(body.exam) : "";
    const title = body.title != null ? String(body.title).trim() : "";
    const createdAt =
      body.createdAt != null ? String(body.createdAt).trim() : new Date().toISOString();
    const publishDate =
      body.publishDate != null ? String(body.publishDate).trim() : new Date().toISOString();

    if (
      !id ||
      (portal !== "news" && portal !== "blog") ||
      !section ||
      !exam ||
      !title ||
      !createdAt
    ) {
      return NextResponse.json({ error: "Missing required post fields" }, { status: 400 });
    }

    if (portal === "blog" && !isValidBlogSectionId(section)) {
      return NextResponse.json({ error: "Invalid blog section" }, { status: 400 });
    }

    const summary = String(body.summary ?? "").trim();
    const bodyText = String(body.body ?? "");
    const author = String(body.author ?? "").trim();
    const revisionPlan = String(body.revisionPlan ?? "").trim();
    const rawFeatured = String(body.featured ?? "feed").trim();
    const featured =
      rawFeatured === "hero" || rawFeatured === "sidebar" || rawFeatured === "feed"
        ? (rawFeatured as "feed" | "hero" | "sidebar")
        : "feed";

    if (section === "ndates") {
      if (!summary) {
        return NextResponse.json(
          { error: "Key dates posts require a non-empty summary" },
          { status: 400 }
        );
      }
    } else {
      if (!summary || !bodyText.trim() || !author) {
        return NextResponse.json(
          { error: "Posts require author, summary, and body" },
          { status: 400 }
        );
      }
      if (section === "blast") {
        if (revisionPlan !== "180" && revisionPlan !== "60" && revisionPlan !== "3") {
          return NextResponse.json(
            { error: "Last 180/60/3d posts require a plan (180, 60, or 3 days)" },
            { status: 400 }
          );
        }
      }
    }

    await insertNewsBlogPost({
      id,
      portal,
      section,
      exam,
      title,
      summary,
      body: bodyText,
      author: section === "ndates" ? "" : author,
      role: String(body.role ?? ""),
      examDate: String(body.examDate ?? ""),
      sourceLink: String(body.sourceLink ?? ""),
      heroImageUrl: String(body.heroImageUrl ?? ""),
      inlineImageUrl: String(body.inlineImageUrl ?? ""),
      heroImageCaption: String(body.heroImageCaption ?? ""),
      inlineImageCaption: String(body.inlineImageCaption ?? ""),
      revisionPlan: section === "blast" ? revisionPlan : "",
      featured,
      tags: String(body.tags ?? "").trim(),
      publishDate,
      contentFormat: body.contentFormat === "html" ? "html" : "text",
      rawHtml: String(body.rawHtml ?? ""),
      createdAt,
      updatedAt: new Date().toISOString(),
    });

    return NextResponse.json({ ok: true });
  } catch (error) {
    console.error("[news-blog] POST error:", error);
    const message =
      error instanceof Error
        ? error.message
        : typeof error === "string"
          ? error
          : "Failed to create post";
    return NextResponse.json({ error: message }, { status: 500 });
  }
}

export async function PUT(req: NextRequest) {
  const adminCheck = await verifyAdmin();
  if (!adminCheck.authorized) return adminCheck.error;

  try {
    const body = (await req.json()) as Partial<NewsBlogPostRow>;
    const id = body.id != null ? String(body.id).trim() : "";
    const portal = body.portal;
    const sectionRaw = body.section != null ? String(body.section) : "";
    const section =
      portal === "blog" && sectionRaw === "bmind" ? "bmattitude" : sectionRaw;
    const exam = body.exam != null ? String(body.exam) : "";
    const title = body.title != null ? String(body.title).trim() : "";
    const createdAt =
      body.createdAt != null ? String(body.createdAt).trim() : new Date().toISOString();
    const publishDate =
      body.publishDate != null ? String(body.publishDate).trim() : new Date().toISOString();

    if (
      !id ||
      (portal !== "news" && portal !== "blog") ||
      !section ||
      !exam ||
      !title ||
      !createdAt
    ) {
      return NextResponse.json({ error: "Missing required post fields" }, { status: 400 });
    }

    if (portal === "blog" && !isValidBlogSectionId(section)) {
      return NextResponse.json({ error: "Invalid blog section" }, { status: 400 });
    }

    const summary = String(body.summary ?? "").trim();
    const bodyText = String(body.body ?? "");
    const author = String(body.author ?? "").trim();
    const revisionPlan = String(body.revisionPlan ?? "").trim();
    const rawFeatured = String(body.featured ?? "feed").trim();
    const featured =
      rawFeatured === "hero" || rawFeatured === "sidebar" || rawFeatured === "feed"
        ? (rawFeatured as "feed" | "hero" | "sidebar")
        : "feed";

    if (section === "ndates") {
      if (!summary) {
        return NextResponse.json(
          { error: "Key dates posts require a non-empty summary" },
          { status: 400 }
        );
      }
    } else {
      if (!summary || !bodyText.trim() || !author) {
        return NextResponse.json(
          { error: "Posts require author, summary, and body" },
          { status: 400 }
        );
      }
      if (section === "blast") {
        if (revisionPlan !== "180" && revisionPlan !== "60" && revisionPlan !== "3") {
          return NextResponse.json(
            { error: "Last 180/60/3d posts require a plan (180, 60, or 3 days)" },
            { status: 400 }
          );
        }
      }
    }

    const row: NewsBlogPostRow = {
      id,
      portal,
      section,
      exam,
      title,
      summary,
      body: bodyText,
      author: section === "ndates" ? "" : author,
      role: String(body.role ?? ""),
      examDate: String(body.examDate ?? ""),
      sourceLink: String(body.sourceLink ?? ""),
      heroImageUrl: String(body.heroImageUrl ?? ""),
      inlineImageUrl: String(body.inlineImageUrl ?? ""),
      heroImageCaption: String(body.heroImageCaption ?? ""),
      inlineImageCaption: String(body.inlineImageCaption ?? ""),
      revisionPlan: section === "blast" ? revisionPlan : "",
      featured,
      tags: String(body.tags ?? "").trim(),
      publishDate,
      contentFormat: body.contentFormat === "html" ? "html" : "text",
      rawHtml: String(body.rawHtml ?? ""),
      createdAt,
      updatedAt: new Date().toISOString(),
    };

    await updateNewsBlogPost(row);

    return NextResponse.json({ ok: true });
  } catch (error) {
    console.error("[news-blog] PUT error:", error);
    return NextResponse.json({ error: "Failed to update post" }, { status: 500 });
  }
}

export async function DELETE(req: NextRequest) {
  const adminCheck = await verifyAdmin();
  if (!adminCheck.authorized) return adminCheck.error;

  try {
    const id = req.nextUrl.searchParams.get("id");
    if (!id) {
      return NextResponse.json({ error: "id is required" }, { status: 400 });
    }
    await deleteNewsBlogPost(id);
    return NextResponse.json({ ok: true });
  } catch (error) {
    console.error("[news-blog] DELETE error:", error);
    return NextResponse.json({ error: "Failed to delete post" }, { status: 500 });
  }
}
