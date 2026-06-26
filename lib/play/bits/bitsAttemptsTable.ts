import type { Json } from "@/integrations/supabase/types";

export const MAX_BITS_ATTEMPT_ROWS = 400;

/** True when normalized tables are not deployed yet (pre-migration). */
export function isOptionalStudentTableError(e: unknown): boolean {
  const msg = e instanceof Error ? e.message : String(e);
  return /does not exist|schema cache|Could not find the table/i.test(msg);
}

type SupabaseLike = {
  from: (table: string) => {
    select: (cols: string, opts?: { head?: boolean; count?: string }) => {
      eq: (col: string, val: string) => {
        eq: (col2: string, val2: string) => {
          maybeSingle: () => Promise<{
            data: { attempt?: unknown } | null;
            error: { message: string } | null;
          }>;
        };
        order: (
          col: string,
          opts: { ascending: boolean }
        ) => {
          limit: (n: number) => Promise<{
            data: { attempt_key: string }[] | null;
            error: { message: string } | null;
          }>;
        };
      };
    };
    upsert: (
      row: Record<string, unknown>,
      opts: { onConflict: string }
    ) => Promise<{ error: { message: string } | null }>;
    delete: () => unknown;
  };
};

export async function readBitsAttemptRow<T extends object>(
  supabase: unknown,
  userId: string,
  attemptKey: string
): Promise<T | null> {
  const client = supabase as SupabaseLike;
  const { data, error } = await client
    .from("student_bits_attempts")
    .select("attempt")
    .eq("user_id", userId)
    .eq("attempt_key", attemptKey)
    .maybeSingle();
  if (error) throw new Error(error.message);
  if (!data?.attempt || typeof data.attempt !== "object") return null;
  return data.attempt as T;
}

export async function upsertBitsAttemptRow(
  supabase: unknown,
  userId: string,
  attemptKey: string,
  attempt: Record<string, unknown>
): Promise<void> {
  const client = supabase as SupabaseLike;
  const submittedAt =
    typeof attempt.submittedAt === "string" ? attempt.submittedAt : new Date().toISOString();
  const { error } = await client.from("student_bits_attempts").upsert(
    {
      user_id: userId,
      attempt_key: attemptKey,
      attempt: attempt as unknown as Json,
      submitted_at: submittedAt,
    },
    { onConflict: "user_id,attempt_key" }
  );
  if (error) throw new Error(error.message);
  await trimBitsAttemptRows(client, userId);
}

export async function deleteBitsAttemptRow(
  supabase: unknown,
  userId: string,
  attemptKey: string
): Promise<void> {
  const client = supabase as {
    from: (table: string) => {
      delete: () => {
        eq: (col: string, val: string) => {
          eq: (col2: string, val2: string) => Promise<{ error: { message: string } | null }>;
        };
      };
    };
  };
  const { error } = await client
    .from("student_bits_attempts")
    .delete()
    .eq("user_id", userId)
    .eq("attempt_key", attemptKey);
  if (error) throw new Error(error.message);
}

/** Keep newest MAX_BITS_ATTEMPT_ROWS rows per user. */
async function trimBitsAttemptRows(supabase: SupabaseLike, userId: string): Promise<void> {
  const { data, error } = await supabase
    .from("student_bits_attempts")
    .select("attempt_key")
    .eq("user_id", userId)
    .order("submitted_at", { ascending: true })
    .limit(MAX_BITS_ATTEMPT_ROWS + 50);
  if (error || !data || data.length <= MAX_BITS_ATTEMPT_ROWS) return;
  const overflow = data.slice(0, data.length - MAX_BITS_ATTEMPT_ROWS).map((r) => r.attempt_key);
  if (overflow.length === 0) return;
  const delClient = supabase as {
    from: (table: string) => {
      delete: () => {
        eq: (col: string, val: string) => {
          in: (col2: string, vals: string[]) => Promise<{ error: { message: string } | null }>;
        };
      };
    };
  };
  const { error: delErr } = await delClient
    .from("student_bits_attempts")
    .delete()
    .eq("user_id", userId)
    .in("attempt_key", overflow);
  if (delErr) console.warn("[bitsAttemptsTable] trim failed", delErr.message);
}
