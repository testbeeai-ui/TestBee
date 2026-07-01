import { DEFAULT_RDM_CONFIG } from "@/lib/rdm/rdmConfig";
import {
  DEFAULT_LIVE_CLASS_DELIVERY_RDM_CONFIG,
  type LiveClassDeliveryRdmConfig,
} from "@/lib/teacherPortal/liveClassDeliveryRdm";
import { DEFAULT_LIVE_CLASS_QUALITY_RDM_CONFIG } from "@/lib/teacherPortal/liveClassQualityRdm";
import {
  DEFAULT_TEACHER_RDM_COSTS,
  type TeacherRdmCosts,
} from "@/lib/teacherPortal/teacherRdmConfig";
import { TEACHER_PLAN_CONFIG_DEFAULTS } from "@/lib/teacherPortal/teacherPlan";
import type { WalletGuide, WalletGuideRow } from "@/lib/rdm/walletGuideTypes";

export type TeacherWalletGuide = WalletGuide;

export type TeacherWalletGuideInput = {
  costs?: TeacherRdmCosts;
  delivery?: LiveClassDeliveryRdmConfig;
  qualityBonusRdm?: number;
  referralTeacherSignup?: number;
  referralStudentSignup?: number;
  referralPaidBonus?: number;
  bulkInviteFlat?: number;
  bulkInviteMinStudents?: number;
  bulkPaidBonus?: number;
};

export function buildTeacherWalletGuide(
  input: TeacherWalletGuideInput = {}
): TeacherWalletGuide {
  const costs = input.costs ?? DEFAULT_TEACHER_RDM_COSTS;
  const delivery = input.delivery ?? DEFAULT_LIVE_CLASS_DELIVERY_RDM_CONFIG;
  const qualityBonus = input.qualityBonusRdm ?? DEFAULT_LIVE_CLASS_QUALITY_RDM_CONFIG.bonusRdm;
  const ref = DEFAULT_RDM_CONFIG;

  const earn: WalletGuideRow[] = [
    { label: "Gyan++ answer", value: `+${costs.gyan_teacher_answer}` },
    {
      label: "Schedule live lesson",
      value:
        delivery.perStudentRdm > 0
          ? `+${delivery.baseRdm} +${delivery.perStudentRdm}/student`
          : `+${delivery.baseRdm}`,
    },
    { label: "Lesson quality bonus", value: `+${qualityBonus}` },
    {
      label: "Refer a teacher",
      value: `+${input.referralTeacherSignup ?? ref.referral_teacher_signup_reward}`,
    },
    {
      label: "Refer a student",
      value: `+${input.referralStudentSignup ?? ref.referral_teacher_student_signup_reward}`,
    },
    {
      label: "Referral goes paid",
      value: `+${input.referralPaidBonus ?? ref.referral_teacher_paid_bonus}`,
    },
    {
      label: `Bulk invite (${input.bulkInviteMinStudents ?? ref.classroom_bulk_invite_min_students}+ students)`,
      value: `+${(input.bulkInviteFlat ?? ref.classroom_bulk_invite_flat_rdm).toLocaleString("en-IN")}`,
    },
    {
      label: "Invited student goes paid",
      value: `+${input.bulkPaidBonus ?? ref.classroom_batch_paid_bonus_rdm}`,
    },
  ];

  const plan = TEACHER_PLAN_CONFIG_DEFAULTS;
  const proLiveCap = plan.teacher_pro_live_classes_per_month;
  const proAssignCap = plan.teacher_pro_assignments_per_month;
  const spend: WalletGuideRow[] = [
    { label: "Create classroom", value: `−${costs.create_classroom}` },
    { label: "Add section", value: `−${costs.create_section}` },
  ];

  if (costs.create_assignment > 0) {
    spend.push({
      label: "Publish assignment",
      value: `−${costs.create_assignment}`,
    });
  }

  spend.push(
    {
      label: `Extra assignment (after ${proAssignCap}/mo on Pro)`,
      value: `−${plan.teacher_assignment_overage_rdm}/publish`,
    },
    { label: "Generate new MCQ test", value: `−${costs.generate_test}` },
    {
      label: "MCQ unlock · free student",
      value: `−${costs.subtopic_unlock_per_student}/each`,
    },
    { label: "Completion rewards", value: "15–50/student" },
    { label: "Recognize students", value: "Your choice" },
    {
      label: `Extra live lesson (after ${proLiveCap}/mo on Pro)`,
      value: `−${plan.teacher_live_class_overage_rdm}/booking`,
    }
  );

  const notes = [
    "Monthly included: Free 12 · Starter 24 · Pro 60 (assignments + live lessons). Free/Starter must upgrade at cap; Pro can continue with extra charges above.",
    "Pro: no flat publish fee in quota. MCQ test history reprints are free.",
    "Top up in Subscriptions — Razorpay (500 / 1,000 / 2,200 RDM).",
  ];

  return { earn, spend, notes };
}
