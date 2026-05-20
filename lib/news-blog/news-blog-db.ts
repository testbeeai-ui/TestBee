export type Post = {
  id: string;
  portal: "news" | "blog";
  section: string;
  exam: string;
  title: string;
  summary: string;
  body: string;
  author: string;
  role: string;
  examDate: string;
  sourceLink: string;
  heroImageUrl: string;
  inlineImageUrl: string;
  heroImageCaption: string;
  inlineImageCaption: string;
  /** Last 180/60/3d (`blast`) only: `180` | `60` | `3`; otherwise empty. */
  revisionPlan: string;
  /** `feed` | `hero` | `sidebar` — controls main feed hero placement. */
  featured: string;
  /** Comma-separated SEO keywords from the editor's Keywords field. */
  tags: string;
  /** ISO date string for scheduled publishing */
  publishDate: string;
  /** Rendering mode for the post body */
  contentFormat: "text" | "html";
  /** Full uploaded HTML payload when contentFormat is html */
  rawHtml: string;
  createdAt: string;
};

export type ReferenceLink = {
  id: string;
  postId?: string;
  label: string;
  url: string;
};

export async function getAllPosts(): Promise<Post[]> {
  const res = await fetch("/api/news-blog-posts", { cache: "no-store" });
  if (!res.ok) return [];
  const data = (await res.json()) as { posts?: Post[] };
  return data.posts ?? [];
}

export async function addPost(post: Post): Promise<void> {
  const res = await fetch("/api/news-blog-posts", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    // Same camelCase shape as `updatePost` and `NewsBlogPostRow` on the API route.
    body: JSON.stringify({
      id: post.id,
      portal: post.portal,
      section: post.section,
      exam: post.exam,
      title: post.title,
      summary: post.summary,
      body: post.body,
      author: post.author,
      role: post.role,
      examDate: post.examDate,
      sourceLink: post.sourceLink,
      heroImageUrl: post.heroImageUrl,
      inlineImageUrl: post.inlineImageUrl,
      heroImageCaption: post.heroImageCaption,
      inlineImageCaption: post.inlineImageCaption,
      revisionPlan: post.revisionPlan,
      featured: post.featured,
      tags: post.tags,
      publishDate: post.publishDate,
      contentFormat: post.contentFormat,
      rawHtml: post.rawHtml,
      createdAt: post.createdAt,
    }),
  });

  if (!res.ok) {
    const raw = await res.text().catch(() => "");
    let detail = res.statusText;
    const trimmed = raw.trim();
    if (trimmed) {
      try {
        const j = JSON.parse(trimmed) as { error?: string; message?: string };
        detail = j.error || j.message || trimmed.slice(0, 500);
      } catch {
        detail = trimmed.slice(0, 500) || detail;
      }
    }
    throw new Error(`Failed to create post: ${detail}`);
  }
}

export async function updatePost(post: Post): Promise<void> {
  const res = await fetch("/api/news-blog-posts", {
    method: "PUT",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(post),
  });
  if (!res.ok) {
    throw new Error("Failed to update post");
  }
}

export async function deletePost(id: string): Promise<void> {
  const res = await fetch(`/api/news-blog-posts?id=${encodeURIComponent(id)}`, {
    method: "DELETE",
  });
  if (!res.ok) {
    throw new Error("Failed to delete post");
  }
}

export async function addReference(_ref: ReferenceLink, _postId: string): Promise<void> {
  return;
}

export async function getReferences(_postId: string): Promise<ReferenceLink[]> {
  return [];
}

export async function clearAllPosts(): Promise<void> {
  const posts = await getAllPosts();
  await Promise.all(posts.map((p) => deletePost(p.id)));
}
