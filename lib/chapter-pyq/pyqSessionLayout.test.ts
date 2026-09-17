import { describe, expect, it } from "vitest";
import {
  PYQ_EXAM_SESSION_OVERLAY_CLASS,
  PYQ_RESULT_SESSION_OVERLAY_CLASS,
} from "./pyqSessionLayout";

describe("pyq session overlay", () => {
  it("keeps the exam on a full-viewport stacking overlay", () => {
    expect(PYQ_EXAM_SESSION_OVERLAY_CLASS).toMatch(/\bfixed\b/);
    expect(PYQ_EXAM_SESSION_OVERLAY_CLASS).toMatch(/\binset-0\b/);
    expect(PYQ_EXAM_SESSION_OVERLAY_CLASS).toContain("z-[200]");
  });

  it("keeps finished results on a scrollable full-viewport overlay", () => {
    expect(PYQ_RESULT_SESSION_OVERLAY_CLASS).toMatch(/\bfixed\b/);
    expect(PYQ_RESULT_SESSION_OVERLAY_CLASS).toMatch(/\binset-0\b/);
    expect(PYQ_RESULT_SESSION_OVERLAY_CLASS).toContain("z-[200]");
    expect(PYQ_RESULT_SESSION_OVERLAY_CLASS).toMatch(/\boverflow-y-auto\b/);
    expect(PYQ_RESULT_SESSION_OVERLAY_CLASS).toMatch(/\bbg-background\b/);
  });
});
