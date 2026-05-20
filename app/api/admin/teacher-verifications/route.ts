import { NextResponse } from "next/server";
import { getSupabaseAndUser } from "@/lib/auth/apiAuth";
import { isAdminUser } from "@/lib/admin/admin";
import { createAdminClient } from "@/integrations/supabase/server";
import type { TeacherVerificationStatus } from "@/lib/teacherPortal/types";

type TeacherVerificationRow = {
  teacher_id: string;
  location: string | null;
  qualification: string | null;
  experience: string | null;
  email: string | null;
  phone: string | null;
  aadhar_photo_url: string | null;
  aadhar_share_link: string | null;
  institute_certificate_photo_url: string | null;
  institute_certificate_share_link: string | null;
  verification_status: TeacherVerificationStatus;
  admin_notes: string | null;
  submitted_at: string | null;
  reviewed_at: string | null;
  approved_at: string | null;
  rejected_at: string | null;
  updated_at: string;
};

type ProfileSummaryRow = {
  id: string;
  name: string | null;
  subjects: string[] | null;
  exam_tags: string[] | null;
  avatar_url: string | null;
};

const ALLOWED_STATUSES: TeacherVerificationStatus[] = [
  "unverified",
  "pending",
  "approved",
  "rejected",
];

function toStoragePath(raw: string | null): string | null {
  const value = (raw ?? "").trim();
  const prefix = "storage://teacher-verification-docs/";
  if (!value.startsWith(prefix)) return null;
  return value.slice(prefix.length);
}

async function resolveDocUrl(
  admin: ReturnType<typeof createAdminClient>,
  raw: string | null
): Promise<string | null> {
  const value = (raw ?? "").trim();
  if (!value) return null;
  if (value.startsWith("http://") || value.startsWith("https://")) return value;
  const path = toStoragePath(value);
  if (!path || !admin) return value;
  const { data } = await admin.storage.from("teacher-verification-docs").createSignedUrl(path, 300);
  return data?.signedUrl ?? value;
}

export async function GET(request: Request) {
  try {
    const ctx = await getSupabaseAndUser(request);
    if (!ctx) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    if (!(await isAdminUser(ctx.supabase, ctx.user.id))) {
      return NextResponse.json({ error: "Forbidden" }, { status: 403 });
    }

    const admin = createAdminClient();
    if (!admin) {
      return NextResponse.json({ error: "SUPABASE_SERVICE_ROLE_KEY is not set" }, { status: 500 });
    }

    const url = new URL(request.url);
    const statusFilterRaw = (url.searchParams.get("status") ?? "").trim().toLowerCase();
    const statusFilter = ALLOWED_STATUSES.includes(statusFilterRaw as TeacherVerificationStatus)
      ? (statusFilterRaw as TeacherVerificationStatus)
      : null;

    const adminAny = admin as unknown as {
      from: (table: string) => {
        select: (columns: string) => {
          order: (
            column: string,
            options: { ascending: boolean }
          ) => Promise<{ data: TeacherVerificationRow[] | null; error: { message: string } | null }>;
        };
      };
    };
    const { data, error } = await adminAny
      .from("teacher_profile_details")
      .select(
        "teacher_id, location, qualification, experience, email, phone, aadhar_photo_url, aadhar_share_link, institute_certificate_photo_url, institute_certificate_share_link, verification_status, admin_notes, submitted_at, reviewed_at, approved_at, rejected_at, updated_at"
      )
      .order("updated_at", { ascending: false });
    if (error) return NextResponse.json({ error: error.message }, { status: 500 });

    const allRows = data ?? [];
    const rows = statusFilter
      ? allRows.filter((row) => row.verification_status === statusFilter)
      : allRows;
    const teacherIds = [...new Set(rows.map((row) => row.teacher_id))];
    const { data: profiles, error: profileErr } = await admin
      .from("profiles")
      .select("id, name, subjects, exam_tags, avatar_url")
      .in("id", teacherIds);
    if (profileErr) return NextResponse.json({ error: profileErr.message }, { status: 500 });
    const profileMap = new Map((profiles ?? []).map((p) => [p.id, p as ProfileSummaryRow]));

    const teachers = await Promise.all(
      rows.map(async (row) => {
        const p = profileMap.get(row.teacher_id);
        return {
          teacherId: row.teacher_id,
          name: p?.name ?? "Teacher",
          avatarUrl: p?.avatar_url ?? null,
          subjects: p?.subjects ?? [],
          examTags: p?.exam_tags ?? [],
          location: row.location,
          qualification: row.qualification,
          experience: row.experience,
          email: row.email,
          phone: row.phone,
          verificationStatus: row.verification_status,
          adminNotes: row.admin_notes,
          submittedAt: row.submitted_at,
          reviewedAt: row.reviewed_at,
          approvedAt: row.approved_at,
          rejectedAt: row.rejected_at,
          updatedAt: row.updated_at,
          docs: {
            aadharPhotoUrl: row.aadhar_photo_url,
            aadharPhotoLink: await resolveDocUrl(admin, row.aadhar_photo_url),
            aadharShareLink: row.aadhar_share_link,
            instituteCertificatePhotoUrl: row.institute_certificate_photo_url,
            instituteCertificatePhotoLink: await resolveDocUrl(admin, row.institute_certificate_photo_url),
            instituteCertificateShareLink: row.institute_certificate_share_link,
          },
        };
      })
    );

    return NextResponse.json({ teachers });
  } catch (e) {
    const message = e instanceof Error ? e.message : "Server error";
    return NextResponse.json({ error: message }, { status: 500 });
  }
}

export async function PATCH(request: Request) {
  try {
    const ctx = await getSupabaseAndUser(request);
    if (!ctx) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    if (!(await isAdminUser(ctx.supabase, ctx.user.id))) {
      return NextResponse.json({ error: "Forbidden" }, { status: 403 });
    }

    const admin = createAdminClient();
    if (!admin) {
      return NextResponse.json({ error: "SUPABASE_SERVICE_ROLE_KEY is not set" }, { status: 500 });
    }

    const body = (await request.json()) as {
      teacherId?: string;
      status?: TeacherVerificationStatus;
      adminNotes?: string | null;
    };

    const teacherId = (body.teacherId ?? "").trim();
    const status = body.status;
    if (!teacherId) return NextResponse.json({ error: "teacherId is required" }, { status: 400 });
    if (!status || !ALLOWED_STATUSES.includes(status)) {
      return NextResponse.json({ error: "Invalid status" }, { status: 400 });
    }
    const notes = (body.adminNotes ?? "").trim();
    if (status === "rejected" && !notes) {
      return NextResponse.json(
        { error: "Please add verification notes before requesting resubmission" },
        { status: 400 }
      );
    }

    const now = new Date().toISOString();
    const patch: Record<string, unknown> = {
      verification_status: status,
      admin_notes: notes || null,
      reviewed_at: now,
    };
    if (status === "approved") {
      patch.approved_at = now;
      patch.rejected_at = null;
    } else if (status === "rejected") {
      patch.rejected_at = now;
      patch.approved_at = null;
    }

    const adminAny = admin as unknown as {
      from: (table: string) => {
        update: (
          values: Record<string, unknown>
        ) => { eq: (column: string, value: string) => Promise<{ error: { message: string } | null }> };
      };
    };
    const { error } = await adminAny
      .from("teacher_profile_details")
      .update(patch)
      .eq("teacher_id", teacherId);
    if (error) return NextResponse.json({ error: error.message }, { status: 500 });

    return NextResponse.json({ ok: true });
  } catch (e) {
    const message = e instanceof Error ? e.message : "Server error";
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
