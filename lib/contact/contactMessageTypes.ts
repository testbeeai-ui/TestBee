export type ContactCategory = "sales" | "issue" | "comment";

export type ContactAdminStatus = "new" | "reviewed" | "resolved";

export type ContactMessageRow = {
  id: string;
  ticket_id: string;
  user_id: string | null;
  category: ContactCategory;
  name: string;
  email: string;
  phone: string | null;
  role: string;
  payload: Record<string, unknown>;
  admin_status: ContactAdminStatus;
  admin_note: string | null;
  reviewed_at: string | null;
  reviewed_by: string | null;
  created_at: string;
};

export type ContactMessagesOverview = {
  total: number;
  newCount: number;
  last7Days: number;
  byCategory: { category: ContactCategory; count: number }[];
};

export const CONTACT_CATEGORY_LABELS: Record<ContactCategory, string> = {
  sales: "Sales or partner",
  issue: "Issue faced",
  comment: "Comment or suggestion",
};
