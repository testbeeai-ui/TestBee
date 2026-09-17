import { describe, expect, it } from "vitest";
import {
  NTA_EXAM_ACTION_BAR_CLASS,
  NTA_EXAM_AVATAR_CLASS,
  NTA_EXAM_FOOTER_DOCK_CLASS,
  NTA_EXAM_HEADER_CLASS,
  NTA_EXAM_NAV_FOOTER_CLASS,
  NTA_EXAM_PALETTE_ASIDE_CLASS,
  NTA_EXAM_TIMER_CLASS,
  ntaChromeAvoidsTallBox,
  ntaChromeAvoidsTallPadding,
} from "./ntaExamChrome";

describe("NTA exam chrome compactness", () => {
  it("keeps the top bar from growing padding at larger breakpoints", () => {
    expect(ntaChromeAvoidsTallPadding(NTA_EXAM_HEADER_CLASS)).toBe(true);
  });

  it("keeps the avatar from ballooning with the viewport", () => {
    expect(ntaChromeAvoidsTallBox(NTA_EXAM_AVATAR_CLASS)).toBe(true);
  });

  it("pins action and nav bars outside the question scroll", () => {
    expect(NTA_EXAM_ACTION_BAR_CLASS).toMatch(/\bshrink-0\b/);
    expect(NTA_EXAM_NAV_FOOTER_CLASS).toMatch(/\bshrink-0\b/);
    expect(ntaChromeAvoidsTallPadding(NTA_EXAM_ACTION_BAR_CLASS)).toBe(true);
    expect(ntaChromeAvoidsTallPadding(NTA_EXAM_NAV_FOOTER_CLASS)).toBe(true);
  });

  it("makes the remaining-time chip large enough to notice", () => {
    expect(NTA_EXAM_TIMER_CLASS).toMatch(/\btext-(?:lg|xl|2xl)\b/);
    expect(NTA_EXAM_TIMER_CLASS).toMatch(/\bfont-(?:bold|black)\b/);
  });

  it("keeps the question palette from growing at xl/2xl", () => {
    expect(NTA_EXAM_PALETTE_ASIDE_CLASS).not.toMatch(/(?:xl|2xl):(?:w-|min-w-|max-w-)/);
  });

  it("docks the footer below the question with space under the buttons", () => {
    expect(NTA_EXAM_FOOTER_DOCK_CLASS).toMatch(/\bshrink-0\b/);
    expect(NTA_EXAM_FOOTER_DOCK_CLASS).toMatch(/\bpb-(?:2\.5|3|4)\b/);
  });
});
