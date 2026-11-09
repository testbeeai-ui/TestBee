import {
  getWaitlistReferrals,
  patchWaitlistSubmission,
} from "@/lib/waitlist/adminWaitlistDetail";

export async function PATCH(request: Request, context: { params: Promise<{ id: string }> }) {
  const { id } = await context.params;
  return patchWaitlistSubmission(request, id);
}

export async function GET(request: Request, context: { params: Promise<{ id: string }> }) {
  const { id } = await context.params;
  return getWaitlistReferrals(request, id);
}
