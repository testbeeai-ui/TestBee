import type { SupabaseClient } from "@supabase/supabase-js";

export type WaitlistRole = "student" | "teacher" | "parent" | "other";
export type WaitlistAdminStatus = "new" | "reviewed" | "resolved";

export type WaitlistSubmissionDbRow = {
  id: string;
  waitlist_id: string;
  role: WaitlistRole;
  first_name: string;
  last_name: string;
  email: string;
  phone: string;
  city: string;
  state: string;
  
  // Student specific
  student_class: string | null;
  school: string | null;
  exam: string | null;
  coaching: string | null;
  study_hours: string | null;
  grade10_marks: string | null;
  
  // Teacher specific
  primary_subject: string | null;
  experience: string | null;
  students_count: string | null;
  linkedin: string | null;
  
  // Parent specific
  child_class: string | null;
  child_exam: string | null;
  
  // Other specific
  organisation: string | null;
  organisation_role: string | null;
  website: string | null;
  
  // Common optional fields
  interests: string[];
  why_join: string | null;
  referral: string | null;
  refcode: string | null;
  
  // Consents
  consent_terms: boolean;
  consent_updates: boolean;
  
  // Admin triaging
  admin_status: WaitlistAdminStatus;
  admin_note: string | null;
  reviewed_at: string | null;
  reviewed_by: string | null;
  created_at: string;
};

// eslint-disable-next-line @typescript-eslint/no-explicit-any
export function waitlistSubmissionsTable(client: SupabaseClient) {
  return (client.from as (name: string) => ReturnType<SupabaseClient["from"]>)(
    "waitlist_submissions"
  );
}
