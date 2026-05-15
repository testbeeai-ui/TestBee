import type { HtmlPlainSource, Post } from "./types";

export function formatKeyDateEndBadge(isoDate: string): string {
  if (!isoDate.trim()) return "-";
  const d = new Date(`${isoDate}T12:00:00`);
  if (Number.isNaN(d.getTime())) return "-";
  return d.toLocaleDateString("en-IN", { month: "short", day: "numeric" });
}

/** Short line beside the link in Key dates lists; legacy posts may only have `body`. */
export function keyDatesFeedBlurb(post: Post): string {
  const s = post.summary.trim();
  const b = post.body.trim();
  return s || b;
}

export function formatLinkHostDisplay(url: string): string {
  const trimmed = url.trim();
  if (!trimmed) return "";
  try {
    const withProto = /^https?:\/\//i.test(trimmed) ? trimmed : `https://${trimmed}`;
    const u = new URL(withProto);
    return u.hostname.replace(/^www\./, "");
  } catch {
    return trimmed.length > 48 ? `${trimmed.slice(0, 45)}...` : trimmed;
  }
}

export function extractHtmlMeta(html: string): { headline: string; summary: string } {
  try {
    const parser = new DOMParser();
    const doc = parser.parseFromString(html, "text/html");
    const headline =
      doc.querySelector(".hero-title")?.textContent?.trim() ||
      doc.querySelector("h1")?.textContent?.trim() ||
      doc.querySelector("title")?.textContent?.trim() ||
      "";
    const summary =
      doc.querySelector(".story-text")?.textContent?.trim() ||
      Array.from(doc.querySelectorAll("p"))
        .map((p) => p.textContent?.trim() || "")
        .find((t) => t.length > 80) ||
      "";
    return { headline, summary };
  } catch {
    return { headline: "", summary: "" };
  }
}

/** Plain excerpt for cards — never inject full HTML in the feed. */
export function stripHtmlToPlain(html: string, maxLen: number): string {
  const t = html
    .replace(/<script[\s\S]*?>[\s\S]*?<\/script>/gi, " ")
    .replace(/<style[\s\S]*?>[\s\S]*?<\/style>/gi, " ")
    .replace(/<[^>]+>/g, " ")
    .replace(/\s+/g, " ")
    .trim();
  if (!t) return "";
  if (t.length <= maxLen) return t;
  const cut = t.slice(0, maxLen);
  const lastSpace = cut.lastIndexOf(" ");
  return `${(lastSpace > 48 ? cut.slice(0, lastSpace) : cut).trim()}…`;
}

/** Summary from Write text only (never parsed from uploaded HTML). */
export function textFieldsSummary(post: Post): string {
  return post.summary.trim();
}

/** One-line copy for list / hero cards — Write text summary, then body excerpt; not HTML meta. */
export function feedCardBlurb(post: Post): string {
  const sum = textFieldsSummary(post);
  if (sum) return sum;
  const b = post.body.trim();
  return b ? stripHtmlToPlain(b, 280) : "";
}

export function decodeBasicHtmlEntities(text: string): string {
  return text
    .replace(/&nbsp;/gi, " ")
    .replace(/&amp;/gi, "&")
    .replace(/&lt;/gi, "<")
    .replace(/&gt;/gi, ">")
    .replace(/&quot;/gi, '"')
    .replace(/&#39;/g, "'")
    .replace(/&#x27;/gi, "'")
    .replace(/&#(\d+);/g, (_, n) => {
      const code = Number(n);
      return Number.isFinite(code) && code > 0 && code < 0x110000 ? String.fromCharCode(code) : _;
    })
    .replace(/&#x([0-9a-f]+);/gi, (_, h) => {
      const code = parseInt(h, 16);
      return Number.isFinite(code) && code > 0 && code < 0x110000 ? String.fromCharCode(code) : _;
    });
}

/** Full article as plain text (legacy fallback when DOMParser is unavailable / SSR). */
export function stripHtmlToPlainDocument(html: string): string {
  const raw = html
    .replace(/<script[\s\S]*?>[\s\S]*?<\/script>/gi, "\n")
    .replace(/<style[\s\S]*?>[\s\S]*?<\/style>/gi, "\n")
    .replace(/<br\s*\/?>/gi, "\n")
    .replace(
      /<\/(p|div|section|article|header|footer|main|h[1-6]|li|tr|blockquote|ul|ol)>/gi,
      "\n\n"
    )
    .replace(/<[^>]+>/g, " ");
  return decodeBasicHtmlEntities(raw)
    .replace(/\r\n/g, "\n")
    .replace(/[ \t]+\n/g, "\n")
    .replace(/\n[ \t]+/g, "\n")
    .replace(/[ \t]{2,}/g, " ")
    .replace(/\n{3,}/g, "\n\n")
    .trim();
}

const SEO_ALLOWED_TAGS = new Set([
  "h1",
  "h2",
  "h3",
  "h4",
  "h5",
  "h6",
  "p",
  "br",
  "hr",
  "ul",
  "ol",
  "li",
  "a",
  "strong",
  "b",
  "em",
  "i",
  "u",
  "mark",
  "small",
  "sub",
  "sup",
  "blockquote",
  "cite",
  "q",
  "code",
  "pre",
  "figure",
  "figcaption",
  "img",
  "table",
  "thead",
  "tbody",
  "tfoot",
  "tr",
  "th",
  "td",
  "caption",
  "section",
  "article",
  "header",
  "footer",
  "main",
  "aside",
  "div",
  "span",
  "time",
]);
const SEO_REMOVED_TAGS = new Set([
  "script",
  "style",
  "iframe",
  "object",
  "embed",
  "noscript",
  "link",
  "meta",
  "form",
  "input",
  "button",
  "select",
  "textarea",
  "svg",
  "canvas",
  "video",
  "audio",
  "source",
  "track",
  "nav",
]);

export function htmlToSeoSafeDocument(html: string): string {
  if (typeof window === "undefined" || typeof DOMParser === "undefined") {
    const text = stripHtmlToPlainDocument(html);
    return text
      .split(/\n{2,}/)
      .map((p) => `<p>${p.replace(/</g, "&lt;").replace(/>/g, "&gt;")}</p>`)
      .join("");
  }

  try {
    const doc = new DOMParser().parseFromString(html, "text/html");

    SEO_REMOVED_TAGS.forEach((tag) => {
      doc.querySelectorAll(tag).forEach((el) => el.remove());
    });

    [
      ".topbar",
      ".navbar",
      ".action-bar",
      ".related-grid",
      ".related-title",
      ".site-footer",
      ".page-footer",
    ].forEach((sel) => doc.querySelectorAll(sel).forEach((el) => el.remove()));

    const walker = doc.createTreeWalker(doc.body, NodeFilter.SHOW_ELEMENT);
    const toUnwrap: Element[] = [];
    let node: Node | null = walker.nextNode();
    while (node) {
      const el = node as Element;
      const tag = el.tagName.toLowerCase();
      if (!SEO_ALLOWED_TAGS.has(tag)) {
        toUnwrap.push(el);
      } else {
        for (const attr of Array.from(el.attributes)) {
          const keep =
            (tag === "a" && (attr.name === "href" || attr.name === "title")) ||
            (tag === "img" &&
              (attr.name === "src" || attr.name === "alt" || attr.name === "title")) ||
            (tag === "time" && attr.name === "datetime") ||
            attr.name === "lang";
          if (!keep) el.removeAttribute(attr.name);
        }
        if (tag === "a") {
          const href = el.getAttribute("href") || "";
          if (/^\s*javascript:/i.test(href)) {
            el.removeAttribute("href");
          } else if (/^https?:\/\//i.test(href)) {
            el.setAttribute("rel", "nofollow noopener");
            el.setAttribute("target", "_blank");
          }
        }
        if (tag === "img") {
          const src = el.getAttribute("src") || "";
          if (!/^https?:\/\//i.test(src) && !src.startsWith("/") && !src.startsWith("data:")) {
            el.remove();
          } else {
            el.setAttribute("loading", "lazy");
            el.setAttribute("decoding", "async");
          }
        }
      }
      node = walker.nextNode();
    }

    for (const el of toUnwrap) {
      const parent = el.parentNode;
      if (!parent) continue;
      while (el.firstChild) parent.insertBefore(el.firstChild, el);
      parent.removeChild(el);
    }

    return (doc.body?.innerHTML || "").trim();
  } catch {
    return stripHtmlToPlainDocument(html);
  }
}

export function articleJsonLd(opts: {
  headline: string;
  summary: string;
  author: string;
  publishDate: string;
  createdAt: string;
  image: string;
}): string {
  const safe = (s: string) => s.replace(/</g, "\\u003c").replace(/>/g, "\\u003e");
  const data = {
    "@context": "https://schema.org",
    "@type": "BlogPosting",
    headline: opts.headline || undefined,
    description: opts.summary || undefined,
    datePublished: opts.publishDate || opts.createdAt || undefined,
    dateModified: opts.createdAt || opts.publishDate || undefined,
    author: opts.author ? { "@type": "Person", name: opts.author } : undefined,
    image: opts.image || undefined,
  };
  return safe(JSON.stringify(data));
}

export function postToPlainSource(post: Post): HtmlPlainSource {
  return {
    title: post.title,
    summary: post.summary,
    body: post.body,
    rawHtml: post.rawHtml,
    author: post.author,
    publishDate: post.publishDate,
    createdAt: post.createdAt,
    heroImageUrl: post.heroImageUrl,
  };
}
