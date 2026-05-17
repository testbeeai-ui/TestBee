import { fetchWithClientAuth } from "@/lib/clientApiAuth";
import {
  DEFAULT_TEACHER_RDM_COSTS,
  type TeacherRdmChargeAction,
  type TeacherRdmCosts,
} from "@/lib/teacherPortal/teacherRdmConfig";

export type { TeacherRdmChargeAction };

/** @deprecated Use `DEFAULT_TEACHER_RDM_COSTS` or live costs from `useTeacherRdmCosts()`. */
export const TEACHER_RDM_COSTS: Record<TeacherRdmChargeAction, number> = {
  create_classroom: DEFAULT_TEACHER_RDM_COSTS.create_classroom,
  create_section: DEFAULT_TEACHER_RDM_COSTS.create_section,
  create_assignment: DEFAULT_TEACHER_RDM_COSTS.create_assignment,
  schedule_session: DEFAULT_TEACHER_RDM_COSTS.schedule_session,
  generate_test: DEFAULT_TEACHER_RDM_COSTS.generate_test,
};

export class TeacherRdmInsufficientError extends Error {
  readonly action: TeacherRdmChargeAction;
  readonly amount: number;

  constructor(action: TeacherRdmChargeAction, amount: number) {
    super(`Insufficient RDM. This action costs ${amount} RDM.`);
    this.name = "TeacherRdmInsufficientError";
    this.action = action;
    this.amount = amount;
  }
}

type ChargeApiResponse = {
  ok?: boolean;
  rdm?: number;
  amount?: number;
  error?: string;
};

async function postTeacherRdm(
  path: "charge" | "refund",
  action: TeacherRdmChargeAction,
  fallbackAmount: number
): Promise<{ rdm: number | null; amount: number }> {
  const res = await fetchWithClientAuth(`/api/teacher/rdm/${path}`, {
    method: "POST",
    credentials: "include",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ action }),
  });
  const payload = (await res.json().catch(() => ({}))) as ChargeApiResponse;
  const amount =
    typeof payload.amount === "number" && Number.isFinite(payload.amount)
      ? payload.amount
      : fallbackAmount;
  if (!res.ok) {
    if (res.status === 402 || payload.error?.toLowerCase().includes("insufficient")) {
      throw new TeacherRdmInsufficientError(action, amount);
    }
    throw new Error(payload.error ?? `RDM ${path} failed (${res.status}).`);
  }
  return {
    rdm: typeof payload.rdm === "number" ? payload.rdm : null,
    amount,
  };
}

/** Deduct RDM for a whitelisted teacher action. Throws if balance is too low. */
export async function chargeTeacherRdm(
  action: TeacherRdmChargeAction,
  costs: Pick<TeacherRdmCosts, TeacherRdmChargeAction> = DEFAULT_TEACHER_RDM_COSTS
): Promise<number | null> {
  const { rdm } = await postTeacherRdm("charge", action, costs[action]);
  return rdm;
}

/** Refund RDM after a failed create (same amount as charge for that action). */
export async function refundTeacherRdm(
  action: TeacherRdmChargeAction,
  costs: Pick<TeacherRdmCosts, TeacherRdmChargeAction> = DEFAULT_TEACHER_RDM_COSTS
): Promise<number | null> {
  const { rdm } = await postTeacherRdm("refund", action, costs[action]);
  return rdm;
}

export function formatTeacherRdmCost(
  action: TeacherRdmChargeAction,
  costs: Pick<TeacherRdmCosts, TeacherRdmChargeAction> = DEFAULT_TEACHER_RDM_COSTS
): string {
  return `(-${costs[action]} RDM)`;
}
