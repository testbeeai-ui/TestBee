/** Replace {{key}} placeholders in email HTML (values must be pre-escaped when needed). */
export function applyEmailTemplate(
  template: string,
  values: Record<string, string>
): string {
  return template.replace(/\{\{(\w+)\}\}/g, (match, key: string) => {
    const value = values[key];
    return value !== undefined ? value : match;
  });
}

/** Escape HTML characters to prevent XSS injection. */
export function escapeHtml(value: string): string {
  return value
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&#39;");
}
