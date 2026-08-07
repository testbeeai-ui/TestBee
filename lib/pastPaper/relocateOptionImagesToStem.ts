/**
 * Option splitters often leave figures (esp. data: URIs after (A)–(D)) inside
 * the last option. Move those images onto the stem so the exam UI shows them.
 * Do NOT move when:
 * - more than one option carries a figure (multi-image MCQ), or
 * - removing the image would leave that option empty (image-only choice D).
 */

function collectImgTags(html: string): string[] {
  return [...html.matchAll(/<img\b[^>]*\/?>/gi)].map((m) => m[0]!);
}

export function relocateOptionImagesToStem(
  stemHtml: string,
  options: string[]
): { stemHtml: string; options: string[] } {
  const withImgs = options
    .map((o, i) => ({ i, imgs: collectImgTags(o), raw: o }))
    .filter((x) => x.imgs.length > 0);
  if (withImgs.length === 0) return { stemHtml, options };

  // Spill pattern: only one option (usually D) carries figure(s).
  // Multi-option image MCQs (including all-data-URI choices) must keep figures.
  const singleSpill = withImgs.length === 1;
  if (!singleSpill) return { stemHtml, options };

  // Image-only choice (e.g. (A)(B)(C) text + (D) = figure): keep the image
  // in the option — do not empty it by relocating to the stem.
  const wouldEmptyChoice = withImgs.some((x) => {
    const without = x.raw
      .replace(/<img\b[^>]*\/?>/gi, "")
      .replace(/<[^>]+>/g, " ")
      .replace(/&nbsp;/gi, " ")
      .replace(/\s+/g, " ")
      .trim();
    return without.length === 0;
  });
  if (wouldEmptyChoice) return { stemHtml, options };

  const moved: string[] = [];
  const nextOptions = options.map((o) => {
    const imgs = collectImgTags(o);
    if (imgs.length === 0) return o;
    for (const img of imgs) moved.push(img);
    return o
      .replace(/<img\b[^>]*\/?>/gi, "")
      .replace(/\s+/g, " ")
      .trim();
  });
  return {
    stemHtml: `${stemHtml}\n${moved.join("\n")}`.trim(),
    options: nextOptions,
  };
}
