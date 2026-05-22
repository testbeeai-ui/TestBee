/** Deep link to a Lessons community post (scrolls + highlights in feed). */
export function buddyCommunityPostHref(postId: string): string {
  return `/explore/community?focusPost=${encodeURIComponent(postId)}`;
}
