import { describe, expect, it } from "vitest";
import { relocateOptionImagesToStem } from "./relocateOptionImagesToStem";

describe("relocateOptionImagesToStem", () => {
  it("keeps data: URI figures on every option that still has text (multi-image MCQ)", () => {
    const stem = "<p>Which figure matches?</p>";
    const options = [
      'A text <img src="data:image/png;base64,AAA">',
      'B text <img src="data:image/png;base64,BBB">',
      'C text <img src="data:image/png;base64,CCC">',
      'D text <img src="data:image/png;base64,DDD">',
    ];

    const result = relocateOptionImagesToStem(stem, options);

    expect(result.stemHtml).toBe(stem);
    expect(result.options).toEqual(options);
  });

  it("moves a single spilled figure from one option onto the stem", () => {
    const stem = "<p>Find the correct graph.</p>";
    const options = [
      "Option A",
      "Option B",
      "Option C",
      'Option D <img src="data:image/png;base64,SPILL">',
    ];

    const result = relocateOptionImagesToStem(stem, options);

    expect(result.stemHtml).toContain('src="data:image/png;base64,SPILL"');
    expect(result.options[3]).toBe("Option D");
    expect(result.options[3]).not.toContain("<img");
  });

  it("does not empty an image-only choice by relocating to the stem", () => {
    const stem = "<p>Pick the matching figure.</p>";
    const options = [
      "Text A",
      "Text B",
      "Text C",
      '<img src="data:image/png;base64,ONLY">',
    ];

    const result = relocateOptionImagesToStem(stem, options);

    expect(result.stemHtml).toBe(stem);
    expect(result.options[3]).toContain("<img");
  });

  it("does not relocate when multiple options use http(s) figure URLs", () => {
    const stem = "<p>Match the diagram.</p>";
    const options = [
      'A <img src="https://cdn.example/a.png">',
      'B <img src="https://cdn.example/b.png">',
      "C text",
      "D text",
    ];

    const result = relocateOptionImagesToStem(stem, options);

    expect(result.stemHtml).toBe(stem);
    expect(result.options).toEqual(options);
  });
});
