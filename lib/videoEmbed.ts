/**
 * Normalize YouTube and Vimeo URLs to embeddable iframe URLs.
 * Returns null if the URL is not supported.
 */
export function getEmbedUrl(url: string): string | null {
  if (!url || typeof url !== 'string') return null;
  const trimmed = url.trim();
  if (!trimmed) return null;

  try {
    // YouTube: youtube.com/watch?v=ID, youtu.be/ID, youtube.com/embed/ID
    // rel=0 asks for same-channel related videos when possible (YouTube may still show "More videos")
    const ytMatch = trimmed.match(/(?:youtube\.com\/(?:watch\?v=|embed\/)|youtu\.be\/)([a-zA-Z0-9_-]{11})/);
    if (ytMatch) {
      const id = ytMatch[1];
      const params = new URLSearchParams({ rel: '0', modestbranding: '1' });
      return `https://www.youtube.com/embed/${id}?${params.toString()}`;
    }

    // Vimeo: vimeo.com/ID, player.vimeo.com/video/ID
    const vimeoMatch = trimmed.match(/(?:vimeo\.com\/|player\.vimeo\.com\/video\/)(\d+)/);
    if (vimeoMatch) return `https://player.vimeo.com/video/${vimeoMatch[1]}`;

    return null;
  } catch {
    return null;
  }
}
