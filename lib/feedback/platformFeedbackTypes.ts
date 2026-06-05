export type FeedbackRole = "student" | "teacher" | "parent";

export type FeedbackAdminStatus = "new" | "reviewed" | "resolved";

export type PlatformFeedbackRow = {
  id: string;
  created_at: string;
  user_id: string | null;
  user_email: string | null;
  user_display_name: string | null;
  source: string;
  role: FeedbackRole;
  overall_rating: number;
  features: string[];
  extra_value: string | null;
  specific_ratings: Record<string, number>;
  nps: number | null;
  issue_category: string | null;
  issue_text: string;
  suggestion: string;
  admin_status: FeedbackAdminStatus;
  admin_note: string | null;
  reviewed_at: string | null;
  reviewed_by: string | null;
  profile_name: string | null;
  profile_role: string | null;
};

export type PlatformFeedbackOverview = {
  total: number;
  newCount: number;
  withIssues: number;
  last7Days: number;
  byRole: { role: string; count: number }[];
};
