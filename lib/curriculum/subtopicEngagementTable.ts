import type { SubtopicEngagementSnapshot } from "@/lib/curriculum/subtopicEngagementService";

/** True when normalized tables are not deployed yet (pre-migration). */
export function isOptionalStudentTableError(e: unknown): boolean {
  const msg = e instanceof Error ? e.message : String(e);
  return /does not exist|schema cache|Could not find the table/i.test(msg);
}

type SupabaseLike = {
  from: (table: string) => {
    select: (cols: string) => {
      eq: (col: string, val: string) => {
        eq: (col2: string, val2: string) => {
          maybeSingle: () => Promise<{
            data: { snapshot?: unknown } | null;
            error: { message: string } | null;
          }>;
        };
      };
    };
    upsert: (
      row: Record<string, unknown>,
      opts: { onConflict: string }
    ) => Promise<{ error: { message: string } | null }>;
  };
};

export async function readSubtopicEngagementRow(
  supabase: unknown,
  userId: string,
  storageKey: string
): Promise<SubtopicEngagementSnapshot | null> {
  const client = supabase as SupabaseLike;
  const { data, error } = await client
    .from("student_subtopic_engagement")
    .select("snapshot")
    .eq("user_id", userId)
    .eq("storage_key", storageKey)
    .maybeSingle();
  if (error) throw new Error(error.message);
  if (!data?.snapshot || typeof data.snapshot !== "object") return null;
  return data.snapshot as SubtopicEngagementSnapshot;
}

export async function upsertSubtopicEngagementRow(
  supabase: unknown,
  userId: string,
  storageKey: string,
  snapshot: SubtopicEngagementSnapshot
): Promise<void> {
  const client = supabase as SupabaseLike;
  const { error } = await client.from("student_subtopic_engagement").upsert(
    {
      user_id: userId,
      storage_key: storageKey,
      snapshot,
      updated_at: snapshot.updatedAt || new Date().toISOString(),
    },
    { onConflict: "user_id,storage_key" }
  );
  if (error) throw new Error(error.message);
}
