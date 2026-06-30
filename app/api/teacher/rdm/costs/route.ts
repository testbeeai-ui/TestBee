import { NextResponse } from "next/server";
import { createAdminClient } from "@/integrations/supabase/server";
import { requireAuthenticatedUser } from "@/lib/auth/securityGuards";
import { DEFAULT_LIVE_CLASS_DELIVERY_RDM_CONFIG } from "@/lib/teacherPortal/liveClassDeliveryRdm";
import {
  clearTeacherRdmConfigCache,
  DEFAULT_TEACHER_RDM_COSTS,
  fetchLiveClassDeliveryRdmConfig,
  fetchTeacherRdmCosts,
} from "@/lib/teacherPortal/teacherRdmConfig";

export async function GET(request: Request) {
  const auth = await requireAuthenticatedUser(request);
  if ("response" in auth) return auth.response;

  const admin = createAdminClient();
  if (!admin) {
    return NextResponse.json({
      ok: true,
      costs: DEFAULT_TEACHER_RDM_COSTS,
      liveClassDelivery: DEFAULT_LIVE_CLASS_DELIVERY_RDM_CONFIG,
    });
  }

  // Always read fresh admin values when the teacher portal refreshes costs (tab focus / mount).
  clearTeacherRdmConfigCache();
  const [costs, liveClassDelivery] = await Promise.all([
    fetchTeacherRdmCosts(admin, { bypassCache: true }),
    fetchLiveClassDeliveryRdmConfig(admin, { bypassCache: true }),
  ]);

  return NextResponse.json({ ok: true, costs, liveClassDelivery });
}
