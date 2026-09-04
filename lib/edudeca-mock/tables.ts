import type { SupabaseClient } from "@supabase/supabase-js";

export type QueryResult = {
  data: unknown;
  error: { message: string } | null;
};

export type FilterBuilder = PromiseLike<QueryResult> & {
  select: (columns: string) => FilterBuilder;
  eq: (column: string, value: unknown) => FilterBuilder;
  maybeSingle: () => PromiseLike<QueryResult>;
  insert: (values: unknown) => FilterBuilder;
  update: (values: unknown) => FilterBuilder;
  upsert: (values: unknown, options?: { onConflict?: string }) => FilterBuilder;
};

export function fromPublicTable(supabase: SupabaseClient, table: string): FilterBuilder {
  return (supabase as unknown as { from: (name: string) => FilterBuilder }).from(table);
}

export function parseJsonOptions(raw: unknown): string[] {
  if (Array.isArray(raw)) return raw.map(String);
  if (typeof raw !== "string" || !raw.trim()) return [];
  try {
    const parsed: unknown = JSON.parse(raw);
    if (!Array.isArray(parsed)) return [];
    return parsed.map(String);
  } catch {
    return [];
  }
}
