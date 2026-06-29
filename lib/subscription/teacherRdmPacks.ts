export type TeacherRdmPackId = "pack_500" | "pack_1000" | "pack_2200";

export type TeacherRdmPack = {
  id: TeacherRdmPackId;
  rdm: number;
  priceInr: number;
  amountPaise: number;
  recommended?: boolean;
};

/** Teacher RDM top-up packs — synced with Razorpay create-order (`purpose: rdm_pack`). */
export const TEACHER_RDM_PACKS: TeacherRdmPack[] = [
  { id: "pack_500", rdm: 500, priceInr: 300, amountPaise: 30_000 },
  { id: "pack_1000", rdm: 1000, priceInr: 500, amountPaise: 50_000, recommended: true },
  { id: "pack_2200", rdm: 2200, priceInr: 1000, amountPaise: 100_000 },
];

export function teacherRdmPackById(packId: string): TeacherRdmPack | null {
  return TEACHER_RDM_PACKS.find((p) => p.id === packId) ?? null;
}

export function teacherRdmPackAmountPaise(packId: string): number | null {
  return teacherRdmPackById(packId)?.amountPaise ?? null;
}
