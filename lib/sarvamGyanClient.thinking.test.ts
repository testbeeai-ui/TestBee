import { describe, expect, it } from "vitest";
import {
  draftHasProfPiStructure,
  formatSarvamAssistantReply,
  looksLikeVerifierMetaReview,
  stripPhysicsNarration,
  stripSarvamThinking,
  stripUntaggedReasoning,
} from "@/lib/sarvamGyanClient";
import { draftLooksLikePhysicsRamble } from "@/lib/gyan/verify/profPiVerify";
import { getProfPiStructureContract } from "@/lib/gyanContentPolicy";

const THINK_OPEN = "<" + "think>";
const THINK_CLOSE = "</" + "think>";
const RT_OPEN = "<think>";
const RT_CLOSE = "</think>";

describe("stripSarvamThinking", () => {
  it("removes closed redacted_thinking blocks", () => {
    const raw = `${RT_OPEN}secret${RT_CLOSE}\n\n**Answer:** $42$`;
    expect(stripSarvamThinking(raw)).toBe("**Answer:** $42$");
  });

  it("removes closed think blocks", () => {
    const raw = `${THINK_OPEN}\nOkay let me work this out...\n${THINK_CLOSE}\n\nThe integral is $x \\sin^{-1} x$.`;
    expect(stripSarvamThinking(raw)).toBe("The integral is $x \\sin^{-1} x$.");
  });

  it("drops unclosed think when no answer marker is found", () => {
    const raw = `${THINK_OPEN}\nOnly internal reasoning with no close tag.`;
    expect(stripSarvamThinking(raw)).toBe("");
  });

  it("keeps student answer after unclosed think when a marker appears", () => {
    const raw = `${THINK_OPEN}\nLong internal reasoning here.\n\nPutting it all together, the first integral is $x \\sin^{-1} x - \\sqrt{1-x^2} + C$.`;
    expect(stripSarvamThinking(raw)).toContain("Putting it all together");
    expect(stripSarvamThinking(raw)).not.toMatch(/<think/i);
  });
});

describe("stripUntaggedReasoning", () => {
  it("removes Hmm/Wait prefix before a structured section", () => {
    const raw =
      "Hmm, the remaining integral is tricky. Wait, maybe substitution.\n\n**Formula:**\n\n$\\int \\sin^{-1}(x)\\,dx = x\\sin^{-1}x + \\sqrt{1-x^2} + C$";
    const out = stripUntaggedReasoning(raw);
    expect(out).toMatch(/^\*\*Formula:\*\*/);
    expect(out).not.toMatch(/Hmm/);
  });

  it("drops standalone reasoning lines", () => {
    const raw =
      "**Proof:**\n\n- Step 1: $u = \\sin^{-1} x$\n- Let me check the sign here.\n- Step 2: combine";
    const out = stripUntaggedReasoning(raw);
    expect(out).toContain("Step 1");
    expect(out).toContain("Step 2");
    expect(out).not.toMatch(/Let me check/);
  });

  it("formatSarvamAssistantReply applies untagged reasoning strip", () => {
    const raw =
      "Wait, I'll use parts.\n\n**Answer:** $x \\sin^{-1} x + \\sqrt{1-x^2} + C$";
    expect(formatSarvamAssistantReply(raw)).toBe("**Answer:** $x \\sin^{-1} x + \\sqrt{1-x^2} + C$");
  });
});

describe("verifier meta-review detection", () => {
  it("detects review-style verifier output", () => {
    const bad =
      "The key intuition and exam trap sections look okay. In the formula: $\\sin^{-1}x$ becomes $\\sin^{-1} x$.";
    expect(looksLikeVerifierMetaReview(bad)).toBe(true);
    expect(draftHasProfPiStructure(bad)).toBe(false);
  });

  it("accepts structured Prof-Pi layout", () => {
    const good = `**Formula:**

$\\int \\sin^{-1}(x)\\,dx = x\\sin^{-1}x + \\sqrt{1-x^2} + C$

**Proof (Integration by Parts):**
- Step 1: $u=\\sin^{-1}x$`;
    expect(looksLikeVerifierMetaReview(good)).toBe(false);
    expect(draftHasProfPiStructure(good)).toBe(true);
  });
});

describe("physics structure and narration", () => {
  it("uses physics-only structure contract", () => {
    expect(getProfPiStructureContract("physics")).toMatch(/\*\*.*Given:\*\*/);
    expect(getProfPiStructureContract("math")).toContain("**Formula:**");
    expect(getProfPiStructureContract("math")).not.toContain("**Given:**");
  });

  it("detects physics ramble drafts", () => {
    const wall =
      "Wait, that makes sense. Let me confirm the flux change. Alternatively, compute step by step. So plugging in the values we get EMF. ".repeat(
        4
      );
    expect(draftLooksLikePhysicsRamble(wall)).toBe(true);
  });

  it("stripPhysicsNarration removes scratch-work sentences", () => {
    const raw =
      "Wait, that makes sense. **Given:**\n- $N=500$\n\n**Formula:**\n$\\varepsilon = -N d\\Phi/dt$";
    expect(stripPhysicsNarration(raw)).toMatch(/^\*\*Given:\*\*/);
    expect(stripPhysicsNarration(raw)).not.toMatch(/Wait,/);
  });
});
