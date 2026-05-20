export function stripNullChars(value: string): string {
  return value.includes("\u0000") ? value.replace(/\u0000/g, "") : value;
}

export function sanitizeJsonForDb<T>(input: T): T {
  if (typeof input === "string") {
    return stripNullChars(input) as T;
  }

  if (Array.isArray(input)) {
    return input.map((item) => sanitizeJsonForDb(item)) as T;
  }

  if (input && typeof input === "object") {
    const out: Record<string, unknown> = {};
    for (const [key, value] of Object.entries(input as Record<string, unknown>)) {
      out[key] = sanitizeJsonForDb(value);
    }
    return out as T;
  }

  return input;
}
