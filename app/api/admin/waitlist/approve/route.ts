import { approveWaitlistSubmission } from "@/lib/waitlist/adminWaitlistDetail";

export async function POST(request: Request) {
  return approveWaitlistSubmission(request);
}
