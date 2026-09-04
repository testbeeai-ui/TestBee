export type OtherMockExamId = "jee-main" | "comedk" | "bitsat" | "kcet";
export type OtherExamCollection = "mock" | "past";

export const OTHER_MOCKS_CTA_LABEL = "Explore other mocks";
export const OTHER_MOCKS_DIALOG_TITLE = "Also preparing for other exams?";
export const OTHER_MOCKS_CONTINUE_LABEL = "Continue EduDeca Test";

export function otherExamLibraryHref(id: OtherMockExamId, collection: OtherExamCollection): string {
  return `/mock-test?tab=${collection}&exam=${id}`;
}

export const OTHER_MOCK_EXAMS: ReadonlyArray<{
  id: OtherMockExamId;
  title: string;
  meta: string;
  collection: OtherExamCollection;
  href: string;
}> = [
  {
    id: "jee-main",
    title: "JEE Main Mock Test",
    meta: "PCM · 10 Qs · 15 min",
    collection: "mock",
    href: otherExamLibraryHref("jee-main", "mock"),
  },
  {
    id: "comedk",
    title: "COMEDK Mock Papers",
    meta: "PCM · Mock papers",
    collection: "mock",
    href: otherExamLibraryHref("comedk", "mock"),
  },
  {
    id: "bitsat",
    title: "BITSAT Past Papers",
    meta: "PCM + English + LR · 10 Qs",
    collection: "past",
    href: otherExamLibraryHref("bitsat", "past"),
  },
  {
    id: "kcet",
    title: "KCET Past Papers",
    meta: "PCM · 10 Qs · 15 min",
    collection: "past",
    href: otherExamLibraryHref("kcet", "past"),
  },
];
