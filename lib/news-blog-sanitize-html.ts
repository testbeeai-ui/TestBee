/**
 * Strips standalone article chrome (topbar, related reads, action bar, site footer,
 * hero byline with editorial/date/read-time/views) from uploaded HTML for News/Blog
 * iframe posts. Safe to call only in the browser.
 */
export function sanitizeNewsBlogUploadedHtml(html: string): string {
  const trimmed = html.trim();
  if (!trimmed) return html;

  if (typeof window === "undefined" || typeof DOMParser === "undefined") {
    return html;
  }

  try {
    const doc = new DOMParser().parseFromString(trimmed, "text/html");

    const selectors = [
      ".topbar",
      ".hero-byline",
      "nav.navbar",
      ".navbar",
      ".global-nav",
      ".related-title",
      ".related-grid",
      ".rel-card",
      ".action-bar",
      "footer",
      ".footer",
      ".site-footer",
      ".page-footer",
    ];

    for (const sel of selectors) {
      doc.querySelectorAll(sel).forEach((el) => el.remove());
    }

    const commentPattern = /\b(RELATED|ACTION\s*BAR|TOPBAR|NAVBAR)\b/i;
    const roots: Node[] = [];
    if (doc.documentElement) roots.push(doc.documentElement);
    else if (doc.body) roots.push(doc.body);

    for (const root of roots) {
      const tw = doc.createTreeWalker(root, NodeFilter.SHOW_COMMENT);
      const comments: Comment[] = [];
      let n: Node | null = tw.nextNode();
      while (n) {
        if (n.nodeType === Node.COMMENT_NODE && commentPattern.test((n as Comment).data)) {
          comments.push(n as Comment);
        }
        n = tw.nextNode();
      }
      comments.forEach((c) => c.remove());
    }

    const htmlEl = doc.querySelector("html");
    if (htmlEl) {
      return htmlEl.outerHTML;
    }
    if (doc.body) {
      return doc.body.innerHTML;
    }
    return trimmed;
  } catch {
    return html;
  }
}
