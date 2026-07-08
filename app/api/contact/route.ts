import { NextResponse } from "next/server";
import { getSupabaseAndUser } from "@/lib/auth/apiAuth";
import { createAdminClient } from "@/integrations/supabase/server";
import { buildContactUsAutoReplyEmail } from "@/lib/email/contactUsAutoReplyTemplate";
import { isEmailConfigured, sendEmail } from "@/lib/email/emailService";
import type { ContactCategory } from "@/lib/contact/contactMessageTypes";

const EMAIL_RE = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

function isCategory(v: unknown): v is ContactCategory {
  return v === "sales" || v === "issue" || v === "comment";
}

function generateTicketId(): string {
  const year = new Date().getFullYear();
  const n = Math.floor(1000 + Math.random() * 9000);
  return `EB-${year}-${n}`;
}

function asTrimmedString(v: unknown, max = 500): string {
  if (typeof v !== "string") return "";
  return v.trim().slice(0, max);
}

function validatePayload(category: ContactCategory, payload: Record<string, unknown>): string | null {
  if (category === "sales") {
    if (!asTrimmedString(payload.salesType)) return "Partnership type is required.";
    if (asTrimmedString(payload.salesMsg).length < 20) return "Message must be at least 20 characters.";
  }
  if (category === "issue") {
    if (!asTrimmedString(payload.issueMenu)) return "Issue section is required.";
    if (!asTrimmedString(payload.severity)) return "Severity is required.";
    if (asTrimmedString(payload.issueDesc).length < 20) return "Issue description must be at least 20 characters.";
  }
  if (category === "comment") {
    if (!asTrimmedString(payload.commType)) return "Feedback type is required.";
    if (!asTrimmedString(payload.commFeature)) return "Feature selection is required.";
    if (asTrimmedString(payload.commMsg).length < 20) return "Comment must be at least 20 characters.";
  }
  return null;
}

/** POST /api/contact — public Contact Us form submission. */
export async function POST(request: Request) {
  try {
    let body: Record<string, unknown>;
    try {
      body = (await request.json()) as Record<string, unknown>;
    } catch {
      return NextResponse.json({ error: "Invalid JSON" }, { status: 400 });
    }

    const category = body.category;
    if (!isCategory(category)) {
      return NextResponse.json({ error: "Invalid category" }, { status: 400 });
    }

    const name = asTrimmedString(body.name, 120);
    const email = asTrimmedString(body.email, 200).toLowerCase();
    const phone = asTrimmedString(body.phone, 40) || null;
    const role = asTrimmedString(body.role, 120);
    const payload =
      body.payload && typeof body.payload === "object" && !Array.isArray(body.payload)
        ? (body.payload as Record<string, unknown>)
        : {};

    if (name.length < 2) return NextResponse.json({ error: "Name is required." }, { status: 400 });
    if (!EMAIL_RE.test(email)) return NextResponse.json({ error: "Valid email is required." }, { status: 400 });
    if (!role) return NextResponse.json({ error: "Role is required." }, { status: 400 });

    const payloadError = validatePayload(category, payload);
    if (payloadError) return NextResponse.json({ error: payloadError }, { status: 400 });

    const admin = createAdminClient();
    if (!admin) {
      return NextResponse.json({ error: "Server configuration error" }, { status: 500 });
    }

    const ctx = await getSupabaseAndUser(request);
    const userId = ctx?.user?.id ?? null;

    let ticketId = generateTicketId();
    for (let attempt = 0; attempt < 5; attempt++) {
      const { data, error } = await admin
        .from("contact_messages" as never)
        .insert({
          ticket_id: ticketId,
          user_id: userId,
          category,
          name,
          email,
          phone,
          role,
          payload,
          admin_status: "new",
        } as never)
        .select("id, ticket_id")
        .single();

      if (!error && data) {
        const row = data as { id: string; ticket_id: string };
        const emailPayload = buildContactUsAutoReplyEmail({
          category,
          name,
          ticketId: row.ticket_id,
          email,
        });

        if (isEmailConfigured()) {
          void sendEmail({
            to: email,
            subject: emailPayload.subject,
            html: emailPayload.html,
            text: emailPayload.text,
          }).then((sendResult) => {
            if (!sendResult.success) {
              console.warn("[api/contact] Auto-reply email failed:", sendResult.error);
            }
          });
        } else {
          console.warn("[api/contact] Email not configured — skipping auto-reply.");
        }

        return NextResponse.json({
          ok: true,
          id: row.id,
          ticketId: row.ticket_id,
        });
      }

      if (error?.code === "23505") {
        ticketId = generateTicketId();
        continue;
      }

      return NextResponse.json({ error: error?.message ?? "Could not save submission" }, { status: 500 });
    }

    return NextResponse.json({ error: "Could not generate ticket ID" }, { status: 500 });
  } catch (e) {
    console.error("[api/contact] POST", e);
    return NextResponse.json({ error: "Server error" }, { status: 500 });
  }
}
