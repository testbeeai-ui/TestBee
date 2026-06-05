import type { SupabaseClient } from "@supabase/supabase-js";
import type { FeedbackAdminStatus, FeedbackRole } from "@/lib/feedback/platformFeedbackTypes";

/** Row shape from `platform_feedback_submissions` (not yet in generated Supabase types). */
export type FeedbackSubmissionDbRow = {
  id: string;
  created_at: string;
  user_id: string | null;
  user_email: string | null;
  user_display_name: string | null;
  source: string;
  role: FeedbackRole;
  overall_rating: number;
  features: unknown;
  extra_value: string | null;
  specific_ratings: unknown;
  nps: number | null;
  issue_category: string | null;
  issue_text: string;
  suggestion: string;
  admin_status: FeedbackAdminStatus;
  admin_note: string | null;
  reviewed_at: string | null;
  reviewed_by: string | null;
};

// eslint-disable-next-line @typescript-eslint/no-explicit-any
export function feedbackSubmissionsTable(client: SupabaseClient) {
  return (client.from as (name: string) => ReturnType<SupabaseClient["from"]>)(
    "platform_feedback_submissions"
  );
}
