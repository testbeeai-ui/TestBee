/** Community posts created from `/mock` result sharing carry a catalog slug for deep links. */

export function getMockPaperSlugFromCommunityPost(
  sourceType: string | null | undefined,
  sourcePayload: unknown
): string | null {
  if (sourceType !== "mock_test" && sourceType !== "past_paper_result") return null;
  if (!sourcePayload || typeof sourcePayload !== "object") return null;
  const slug = (sourcePayload as { paperSlug?: unknown }).paperSlug;
  if (typeof slug !== "string") return null;
  const t = slug.trim();
  return t.length > 0 ? t : null;
}

export function hrefForMockPaperCommunityShare(slug: string): string {
  return `/mock?paper=${encodeURIComponent(slug)}`;
}
