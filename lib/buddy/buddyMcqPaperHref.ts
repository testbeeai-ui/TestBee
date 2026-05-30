/** Deep link for buddy mock / CBSE chapter rows — opens the same paper tab the student used. */
export function buddyMcqPaperHref(
  paper:
    | {
        slug?: string | null;
        paper_type?: string | null;
        chapter_id?: string | null;
      }
    | null
    | undefined
): string {
  if (!paper) return "/mock-test";
  const slug = paper.slug?.trim() ?? "";
  const paperType = (paper.paper_type ?? "").toLowerCase();
  const isChapter = paperType === "chapter" || paperType === "ncert" || Boolean(paper.chapter_id);
  if (isChapter) {
    const q = new URLSearchParams({ tab: "mcq" });
    if (slug) q.set("paper", slug);
    return `/mock-test?${q.toString()}`;
  }
  if (slug) return `/mock-test?paper=${encodeURIComponent(slug)}`;
  return "/mock-test";
}
