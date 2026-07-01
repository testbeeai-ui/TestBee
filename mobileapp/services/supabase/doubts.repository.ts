import type { DoubtRow } from "@/core/domain/doubts";
import { getSupabaseClient } from "./client";

const DOUBT_SELECT =
  "*, doubt_answers(id, body, upvotes, downvotes, is_accepted, created_at, user_id, profiles!doubt_answers_user_id_fkey(name, avatar_url, role)), profiles!doubts_user_id_fkey(name, avatar_url, role)";

export async function fetchDoubtsFeed(): Promise<DoubtRow[]> {
  const { data, error } = await getSupabaseClient()
    .from("doubts")
    .select(DOUBT_SELECT)
    .order("created_at", { ascending: false })
    .limit(80);

  if (error) throw error;
  return (data as DoubtRow[]) ?? [];
}

export async function fetchDoubtById(id: string): Promise<DoubtRow | null> {
  const { data, error } = await getSupabaseClient()
    .from("doubts")
    .select(DOUBT_SELECT)
    .eq("id", id)
    .maybeSingle();

  if (error) throw error;
  return (data as DoubtRow | null) ?? null;
}
