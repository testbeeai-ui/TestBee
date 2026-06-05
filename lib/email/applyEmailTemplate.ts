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
