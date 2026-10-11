import { NextResponse } from "next/server";
import type { SupabaseClient } from "@supabase/supabase-js";
import { getSupabaseAndUser } from "@/lib/auth/apiAuth";
import { isAdminUser } from "@/lib/admin/admin";
import { createAdminClient } from "@/integrations/supabase/server";
import {
  isNamedLinkDestination,
  isNamedLinkSubject,
  namedLinkHref,
  namedSlugError,
  normalizeNamedSlug,
  type NamedLinkDestination,
} from "@/lib/named-links/slug";

type LookupRow = {
  id: string | null;
  email: string;
  name: string | null;
  role: string | null;
  source: string | null;
};

type NamedLinkInsert = {
  slug: string;
  user_id: string | null;
  email: string;
  display_name: string | null;
  destination: NamedLinkDestination;
  subject: string | null;
  created_by: string;
};

function serviceDb(admin: NonNullable<ReturnType<typeof createAdminClient>>) {
  return admin as unknown as SupabaseClient;
}

async function requireAdmin(request: Request) {
  const ctx = await getSupabaseAndUser(request);
  if (!ctx) return { error: NextResponse.json({ error: "Unauthorized" }, { status: 401 }) };
  if (!(await isAdminUser(ctx.supabase, ctx.user.id))) {
    return { error: NextResponse.json({ error: "Forbidden" }, { status: 403 }) };
  }
  const admin = createAdminClient();
  if (!admin) {
    return {
      error: NextResponse.json({ error: "SUPABASE_SERVICE_ROLE_KEY is not set" }, { status: 500 }),
    };
  }
  return { ctx, admin: serviceDb(admin) };
}

export async function GET(request: Request) {
  const auth = await requireAdmin(request);
  if ("error" in auth) return auth.error;

  const { data, error } = await auth.admin
    .from("named_page_links")
    .select("id, slug, email, display_name, destination, subject, created_at")
    .order("created_at", { ascending: false });

  if (error) return NextResponse.json({ error: error.message }, { status: 500 });
  return NextResponse.json({ links: data ?? [] });
}

export async function POST(request: Request) {
  const auth = await requireAdmin(request);
  if ("error" in auth) return auth.error;

  let body: {
    slug?: string;
    userId?: string;
    email?: string;
    destination?: string;
    subject?: string | null;
  };
  try {
    body = (await request.json()) as typeof body;
  } catch {
    return NextResponse.json({ error: "Invalid request." }, { status: 400 });
  }

  const slug = normalizeNamedSlug(body.slug ?? "");
  const slugProblem = namedSlugError(slug);
  if (slugProblem) return NextResponse.json({ error: slugProblem }, { status: 400 });

  const destination = (body.destination ?? "").trim();
  if (!isNamedLinkDestination(destination)) {
    return NextResponse.json({ error: "Choose Learn Hub or Chapter PYQ." }, { status: 400 });
  }

  const subject = isNamedLinkSubject(body.subject) ? body.subject : null;
  if (!subject || !namedLinkHref(destination, subject)) {
    return NextResponse.json({ error: "Choose a subject." }, { status: 400 });
  }

  const email = (body.email ?? "").trim().toLowerCase();
  const userId = (body.userId ?? "").trim();
  if (!email) {
    return NextResponse.json({ error: "Check an email and select it." }, { status: 400 });
  }

  const lookup = await auth.admin.rpc("lookup_users_by_email", { p_query: email });
  if (lookup.error) return NextResponse.json({ error: lookup.error.message }, { status: 500 });
  const match = ((lookup.data ?? []) as LookupRow[]).find(
    (row) => row.email === email && (row.id ?? "") === userId
  );
  if (!match) {
    return NextResponse.json({ error: "That email is not on the approved list." }, { status: 400 });
  }

  const row: NamedLinkInsert = {
    slug,
    user_id: match.id,
    email,
    display_name: match.name,
    destination,
    subject,
    created_by: auth.ctx.user.id,
  };

  const { data, error } = await auth.admin
    .from("named_page_links")
    .insert(row)
    .select("id, slug, email, display_name, destination, subject, created_at")
    .single();

  if (error) {
    if (error.code === "23505") {
      return NextResponse.json({ error: "That name is already in use." }, { status: 409 });
    }
    return NextResponse.json({ error: error.message }, { status: 500 });
  }

  return NextResponse.json({ link: data });
}
