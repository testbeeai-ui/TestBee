import DOMPurify from "isomorphic-dompurify";

/** Sanitize HTML from mock question bank before dangerouslySetInnerHTML. */
export function sanitizeMockHtml(html: string): string {
  return DOMPurify.sanitize(html, {
    ADD_TAGS: ["img", "span", "sup", "sub", "br"],
    ADD_ATTR: ["src", "alt", "class", "style", "title"],
  });
}
