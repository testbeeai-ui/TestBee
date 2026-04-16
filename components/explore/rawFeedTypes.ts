export type RawKind = "post" | "doubt" | "instacue";

export interface RawPostRow {
  id: string;
  user_id: string;
  kind: RawKind;
  title: string | null;
  content: string;
  tags: string[] | null;
  subject: string | null;
  chapter_ref: string | null;
  board_ref?: string | null;
  grade_ref?: string | null;
  unit_ref?: string | null;
  topic_ref?: string | null;
  subtopic_ref?: string | null;
  source_type?: string | null;
  source_payload?: { level?: string | null } | null;
  boost_count: number;
  upvote_count: number;
  downvote_count: number;
  comment_count: number;
  created_at: string;
  profiles: { name: string | null; avatar_url: string | null } | null;
}
