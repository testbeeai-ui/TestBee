export const EDUFUND_RDM_GATES = [
  { need: 5000, name: "Sprout", unlockInrAmount: 3000 },
  { need: 15000, name: "Scholar", unlockInrAmount: 12000 },
  { need: 40000, name: "Champion", unlockInrAmount: 50000 },
  { need: 80000, name: "Elite", unlockInrAmount: 100000 },
  { need: 150000, name: "MasterBlaster", unlockInrAmount: 200000 },
] as const;

export const EDUFUND_MIN_RDM_CREATE_PROPOSAL = EDUFUND_RDM_GATES[0].need;

export type ProposalCategory =
  | "Learning Device"
  | "Books & Materials"
  | "Lab Equipment"
  | "Course Fee";

export type EduFundProposal = {
  id: string;
  title: string;
  story: string;
  fullStory: string;
  category: ProposalCategory;
  goal: number;
  raised: number;
  supporters: number;
  postedDate: string;
};

/** Demo feed — matches web `DUMMY_PROPOSALS` until live proposals API ships. */
export const EDUFUND_DEMO_PROPOSALS: EduFundProposal[] = [
  {
    id: "1",
    title: "Need a laptop for JEE Advanced preparation",
    story:
      "I am preparing for JEE Advanced 2026. My current device crashes during online mock tests.",
    fullStory:
      "I am a Class 12 PCM student preparing for JEE Advanced 2026. A basic laptop would help me access study materials and practice tests consistently.",
    category: "Learning Device",
    goal: 25000,
    raised: 12500,
    supporters: 18,
    postedDate: "12 Feb 2026",
  },
  {
    id: "2",
    title: "Biology reference books for NEET preparation",
    story: "I need NCERT supplement books and a good biology reference for NEET.",
    fullStory:
      "I am a Class 12 PCB student aiming for NEET 2026. Quality reference books would help me master high-weightage biology topics.",
    category: "Books & Materials",
    goal: 4500,
    raised: 4320,
    supporters: 43,
    postedDate: "8 Feb 2026",
  },
  {
    id: "3",
    title: "Chemistry lab kit for practicals",
    story: "Our school lab sessions are limited. A home chemistry kit would help me practice titrations.",
    fullStory:
      "Practical chemistry is crucial for boards and competitive exams. A basic home lab kit would let me rehearse experiments safely.",
    category: "Lab Equipment",
    goal: 8000,
    raised: 2100,
    supporters: 11,
    postedDate: "1 Feb 2026",
  },
];

export function getEdufundNextGate(rdm: number) {
  const n = Math.max(0, Math.floor(rdm));
  return EDUFUND_RDM_GATES.find((g) => n < g.need) ?? null;
}

export function getEdufundRdmShortfallToNext(rdm: number): number {
  const next = getEdufundNextGate(rdm);
  if (!next) return 0;
  return Math.max(0, next.need - Math.max(0, Math.floor(rdm)));
}
