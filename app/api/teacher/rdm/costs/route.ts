import { NextResponse } from "next/server";
import { createAdminClient } from "@/integrations/supabase/server";
import { requireAuthenticatedUser } from "@/lib/auth/securityGuards";
import {
  DEFAULT_TEACHER_RDM_COSTS,
  fetchTeacherRdmCosts,
} from "@/lib/teacherPortal/teacherRdmConfig";

export async function GET(request: Request) {
  const auth = await requireAuthenticatedUser(request);
  if ("response" in auth) return auth.response;

  const admin = createAdminClient();
  const costs = admin ? await fetchTeacherRdmCosts(admin) : DEFAULT_TEACHER_RDM_COSTS;

  return NextResponse.json({ ok: true, costs });
}
