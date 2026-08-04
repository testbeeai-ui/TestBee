import {
  INSTACUE_SHARE_HEIGHT,
  INSTACUE_SHARE_WIDTH,
  instaCueShareFontSize,
} from "@/lib/instacue/shareInstaCueImage";

const CYAN = "#19E3DA";
const WHITE = "#ffffff";
/** Public site wordmark — logo-2 image from public. */
const LOGO_SRC = "/images/logo-2.png";
const LOGO_ALT_SRC = "/edublast-wordmark-light.png";
const BODY = 'Inter, Poppins, "Segoe UI", system-ui, -apple-system, sans-serif';
const UI = 'Inter, Poppins, "Segoe UI", system-ui, -apple-system, sans-serif';

function convertSuperscript(s: string): string {
  const superMap: Record<string, string> = {
    "0": "⁰", "1": "¹", "2": "²", "3": "³", "4": "⁴",
    "5": "⁵", "6": "⁶", "7": "⁷", "8": "⁸", "9": "⁹",
    "+": "⁺", "-": "⁻", "=": "⁼", "(": "⁽", ")": "⁾",
    "n": "ⁿ", "i": "ⁱ", "x": "ˣ", "a": "ᵃ", "b": "ᵇ"
  };
  return s.split("").map((c) => superMap[c] ?? c).join("");
}

function convertSubscript(s: string): string {
  const subMap: Record<string, string> = {
    "0": "₀", "1": "₁", "2": "₂", "3": "₃", "4": "₄",
    "5": "₅", "6": "₆", "7": "₇", "8": "₈", "9": "₉",
    "+": "₊", "-": "₋", "=": "₌", "(": "₍", ")": "₎",
    "a": "ₐ", "b": "♭", "x": "ₓ"
  };
  return s.split("").map((c) => subMap[c] ?? c).join("");
}

function plainShareText(raw: string): string {
  if (!raw) return "";
  let out = raw.trim();

  // First convert escaped set braces \{ \} and parens \( \) BEFORE stripping backslashes
  out = out
    .replace(/\\\{/g, "{")
    .replace(/\\\}/g, "}")
    .replace(/\\\\\(/g, "(")
    .replace(/\\\\\)/g, ")")
    .replace(/\\\\\[[\s\S]*?\\\\\]/g, (m) => m.replace(/^\\+\[|\\+\]$/g, ""))
    .replace(/\\\(/g, "")
    .replace(/\\\)/g, "")
    .replace(/\\\[/g, "")
    .replace(/\\\]/g, "")
    .replace(/\$\$([\s\S]*?)\$\$/g, "$1")
    .replace(/\$([^$]+)\$/g, "$1");

  // Format KaTeX expressions and math operators
  out = out
    .replace(/\\int_\{([^}]+)\}\^\{([^}]+)\}/g, (m, a, b) => `∫${convertSubscript(a)}${convertSuperscript(b)} `)
    .replace(/\\int_([a-zA-Z0-9]+)\^([a-zA-Z0-9]+)/g, (m, a, b) => `∫${convertSubscript(a)}${convertSuperscript(b)} `)
    .replace(/\\int/g, "∫")
    .replace(/\^\{([^}]+)\}/g, (m, p) => convertSuperscript(p))
    .replace(/\^([0-9a-zA-Z+-]+)/g, (m, p) => convertSuperscript(p))
    .replace(/_\{([^}]+)\}/g, (m, p) => convertSubscript(p))
    .replace(/_([0-9a-zA-Z+-]+)/g, (m, p) => convertSubscript(p))
    .replace(/\\frac\{([^}]+)\}\{([^}]+)\}/g, "($1) / ($2)")
    .replace(/\\times/g, "×")
    .replace(/\\cdot/g, "·")
    .replace(/\\approx/g, "≈")
    .replace(/\\neq/g, "≠")
    .replace(/\\leq/g, "≤")
    .replace(/\\geq/g, "≥")
    .replace(/\\notin/g, "∉")
    .replace(/\\in/g, "∈")
    .replace(/\\subset/g, "⊂")
    .replace(/\\rightarrow|\\to/g, "→")
    .replace(/\\vec\{([^}]+)\}/g, "$1⃗")
    .replace(/\\hat\{([^}]+)\}/g, "$1̂")
    .replace(/\\text\{([^}]+)\}/g, "$1")
    .replace(/\\mathrm\{([^}]+)\}/g, "$1")
    .replace(/\\left|\\right/g, "");

  // Clean bold and italic markdown asterisks
  out = out.replace(/\*\*([^*]+)\*\*/g, "$1");
  out = out.replace(/\*([^*]+)\*/g, "$1");

  // Remove leftover isolated command backslashes while keeping set braces intact
  out = out.replace(/\\([a-zA-Z]+)/g, "$1");
  out = out.replace(/\\/g, "");
  out = out.replace(/\s*,/g, ",");
  out = out.replace(/\s+/g, " ");

  return out.trim();
}

function wrapLines(
  ctx: CanvasRenderingContext2D,
  text: string,
  maxWidth: number,
  maxLines: number
): string[] {
  const words = text.split(/\s+/).filter(Boolean);
  const lines: string[] = [];
  let current = "";

  for (const word of words) {
    const next = current ? `${current} ${word}` : word;
    if (ctx.measureText(next).width <= maxWidth) {
      current = next;
      continue;
    }
    if (current) lines.push(current);
    current = word;
    if (lines.length >= maxLines - 1) break;
  }
  if (lines.length < maxLines && current) lines.push(current);

  if (words.length && lines.length === maxLines) {
    let last = lines[maxLines - 1] ?? "";
    while (last.length > 1 && ctx.measureText(`${last}…`).width > maxWidth) {
      last = last.slice(0, -1);
    }
    lines[maxLines - 1] = `${last}…`;
  }
  return lines;
}

function roundRectPath(
  ctx: CanvasRenderingContext2D,
  x: number,
  y: number,
  w: number,
  h: number,
  r: number
) {
  const radius = Math.min(r, w / 2, h / 2);
  ctx.beginPath();
  ctx.moveTo(x + radius, y);
  ctx.arcTo(x + w, y, x + w, y + h, radius);
  ctx.arcTo(x + w, y + h, x, y + h, radius);
  ctx.arcTo(x, y + h, x, y, radius);
  ctx.arcTo(x, y, x + w, y, radius);
  ctx.closePath();
}

async function loadImage(src: string): Promise<HTMLImageElement | null> {
  if (typeof window === "undefined") return null;
  return new Promise((resolve) => {
    const img = new Image();
    img.onload = () => resolve(img);
    img.onerror = () => resolve(null);
    img.src = src;
  });
}

function drawDotCluster(
  ctx: CanvasRenderingContext2D,
  ox: number,
  oy: number,
  cols: number,
  rows: number,
  step: number,
  fade: "tr" | "bl"
) {
  ctx.fillStyle = CYAN;
  for (let row = 0; row < rows; row++) {
    for (let col = 0; col < cols; col++) {
      const t =
        fade === "tr"
          ? 1 - Math.max(col / cols, (rows - 1 - row) / rows)
          : 1 - Math.max(col / cols, row / rows);
      if (t <= 0.08) continue;
      ctx.globalAlpha = t * 0.5;
      ctx.beginPath();
      ctx.arc(ox + col * step, oy + row * step, 2, 0, Math.PI * 2);
      ctx.fill();
    }
  }
  ctx.globalAlpha = 1;
}

/** Black canvas + template accents (exact fit on 1080×1920). */
function paintBackground(
  ctx: CanvasRenderingContext2D,
  W: number,
  H: number,
  template: HTMLImageElement | null
) {
  ctx.fillStyle = "#000000";
  ctx.fillRect(0, 0, W, H);

  if (template && template.naturalWidth > 0) {
    // Exact canvas fill — same aspect as investor template
    ctx.drawImage(template, 0, 0, W, H);
  } else {
    const g1 = ctx.createRadialGradient(W * 0.82, H * 0.06, 10, W * 0.82, H * 0.06, 380);
    g1.addColorStop(0, "rgba(25,227,218,0.16)");
    g1.addColorStop(1, "rgba(25,227,218,0)");
    ctx.fillStyle = g1;
    ctx.fillRect(0, 0, W, H);
    const g2 = ctx.createRadialGradient(W * 0.12, H * 0.94, 10, W * 0.12, H * 0.94, 340);
    g2.addColorStop(0, "rgba(25,227,218,0.12)");
    g2.addColorStop(1, "rgba(25,227,218,0)");
    ctx.fillStyle = g2;
    ctx.fillRect(0, 0, W, H);
    ctx.save();
    ctx.strokeStyle = "rgba(25,227,218,0.5)";
    ctx.lineWidth = 2.5;
    ctx.shadowColor = "rgba(25,227,218,0.65)";
    ctx.shadowBlur = 12;
    ctx.beginPath();
    ctx.ellipse(W * 1.05, H * 0.02, W * 0.42, H * 0.22, 0.35, 0.9, 2.3);
    ctx.stroke();
    ctx.beginPath();
    ctx.ellipse(W * -0.05, H * 0.98, W * 0.42, H * 0.22, 0.35, 3.7, 5.3);
    ctx.stroke();
    ctx.restore();
    drawDotCluster(ctx, W - 200, 40, 9, 7, 14, "tr");
    drawDotCluster(ctx, 36, H - 200, 10, 8, 14, "bl");
  }
}

/** Always paint logos on top — crisp, no double ghost from template. */
function drawHeaderLogos(
  ctx: CanvasRenderingContext2D,
  W: number,
  logo: HTMLImageElement | null
) {
  const padX = 64;
  const topY = 52;
  const logoH = 96;
  const headerH = topY + logoH + 20;

  // Clean header strip so template wordmarks don't ghost under ours
  ctx.fillStyle = "#000000";
  ctx.fillRect(0, 0, W, headerH);
  const glow = ctx.createRadialGradient(W * 0.88, 10, 5, W * 0.88, 10, 280);
  glow.addColorStop(0, "rgba(25,227,218,0.14)");
  glow.addColorStop(1, "rgba(25,227,218,0)");
  ctx.fillStyle = glow;
  ctx.fillRect(0, 0, W, headerH);
  drawDotCluster(ctx, W - 180, 28, 8, 5, 13, "tr");

  if (logo && logo.naturalWidth > 0) {
    const drawH = logoH;
    const drawW = Math.min((logo.naturalWidth / logo.naturalHeight) * drawH, 480);
    ctx.drawImage(logo, padX, topY, drawW, drawH);
  } else {
    ctx.fillStyle = WHITE;
    ctx.font = `700 52px ${UI}`;
    ctx.textAlign = "left";
    ctx.textBaseline = "middle";
    ctx.fillText("edublast", padX, topY + logoH / 2);
  }

  ctx.textAlign = "right";
  ctx.textBaseline = "middle";
  ctx.font = `700 52px ${UI}`;
  const cue = "Cue";
  const insta = "Insta";
  const cueW = ctx.measureText(cue).width;
  ctx.fillStyle = CYAN;
  ctx.fillText(cue, W - padX, topY + logoH / 2);
  ctx.fillStyle = WHITE;
  ctx.fillText(insta, W - padX - cueW, topY + logoH / 2);
}

function drawGlassCard(
  ctx: CanvasRenderingContext2D,
  x: number,
  y: number,
  w: number,
  h: number,
  r: number
) {
  roundRectPath(ctx, x, y, w, h, r);
  const glass = ctx.createLinearGradient(x, y, x + w, y + h);
  glass.addColorStop(0, "rgba(14, 20, 30, 0.94)");
  glass.addColorStop(0.5, "rgba(10, 14, 22, 0.96)");
  glass.addColorStop(1, "rgba(6, 10, 16, 0.98)");
  ctx.fillStyle = glass;
  ctx.fill();

  ctx.save();
  roundRectPath(ctx, x, y, w, h, r);
  ctx.clip();
  const sheen = ctx.createLinearGradient(x, y, x, y + h * 0.35);
  sheen.addColorStop(0, "rgba(255,255,255,0.06)");
  sheen.addColorStop(1, "rgba(255,255,255,0)");
  ctx.fillStyle = sheen;
  ctx.fillRect(x, y, w, h * 0.35);
  ctx.restore();

  ctx.save();
  ctx.shadowColor = "rgba(25,227,218,0.5)";
  ctx.shadowBlur = 12;
  ctx.strokeStyle = "rgba(25,227,218,0.85)";
  ctx.lineWidth = 1.8;
  roundRectPath(ctx, x, y, w, h, r);
  ctx.stroke();
  ctx.restore();

  // Subtle corner flares matching investor template
  const flare = (cx: number, cy: number, s: number) => {
    const g = ctx.createRadialGradient(cx, cy, 0, cx, cy, 50);
    g.addColorStop(0, `rgba(25,227,218,${s})`);
    g.addColorStop(1, "rgba(25,227,218,0)");
    ctx.fillStyle = g;
    ctx.fillRect(cx - 50, cy - 50, 100, 100);
  };
  flare(x + w - 2, y + 2, 0.45);
  flare(x + 2, y + h - 2, 0.38);
}

function drawLabelBadge(
  ctx: CanvasRenderingContext2D,
  x: number,
  y: number,
  kind: "question" | "answer"
) {
  const label = kind === "question" ? "InstaCue Quick Doubt" : "Answer";
  const fontSize = 22;
  ctx.font = `600 ${fontSize}px ${UI}`;
  const textW = ctx.measureText(label).width;
  const iconR = 14;
  const gap = 10;
  const padX = 14;
  const padY = 9;
  const w = padX + iconR * 2 + gap + textW + padX;
  const h = iconR * 2 + padY * 2;

  roundRectPath(ctx, x, y, w, h, h / 2);
  ctx.fillStyle = "rgba(0,0,0,0.35)";
  ctx.fill();
  ctx.strokeStyle = "rgba(25,227,218,0.85)";
  ctx.lineWidth = 1.5;
  ctx.stroke();

  const iconCx = x + padX + iconR;
  const iconCy = y + h / 2;

  ctx.beginPath();
  ctx.arc(iconCx, iconCy, iconR, 0, Math.PI * 2);
  ctx.strokeStyle = CYAN;
  ctx.lineWidth = 1.8;
  ctx.stroke();

  if (kind === "question") {
    ctx.fillStyle = CYAN;
    ctx.font = `700 15px ${UI}`;
    ctx.textAlign = "center";
    ctx.textBaseline = "middle";
    ctx.fillText("?", iconCx, iconCy + 1);
  } else {
    ctx.strokeStyle = CYAN;
    ctx.lineWidth = 2.3;
    ctx.lineCap = "round";
    ctx.lineJoin = "round";
    ctx.beginPath();
    ctx.moveTo(iconCx - 5, iconCy + 0.5);
    ctx.lineTo(iconCx - 1, iconCy + 5);
    ctx.lineTo(iconCx + 7, iconCy - 5);
    ctx.stroke();
  }

  ctx.fillStyle = CYAN;
  ctx.font = `600 ${fontSize}px ${UI}`;
  ctx.textAlign = "left";
  ctx.textBaseline = "middle";
  ctx.fillText(label, x + padX + iconR * 2 + gap, iconCy);
}

function drawPeopleIcon(ctx: CanvasRenderingContext2D, cx: number, cy: number, r: number) {
  ctx.beginPath();
  ctx.arc(cx, cy, r, 0, Math.PI * 2);
  ctx.strokeStyle = CYAN;
  ctx.lineWidth = 2.2;
  ctx.stroke();

  ctx.fillStyle = CYAN;
  const drawPerson = (px: number, py: number, headR: number, bodyW: number, bodyH: number) => {
    ctx.beginPath();
    ctx.arc(px, py - bodyH * 0.35, headR, 0, Math.PI * 2);
    ctx.fill();
    ctx.beginPath();
    ctx.moveTo(px - bodyW, py + bodyH * 0.55);
    ctx.quadraticCurveTo(px - bodyW * 0.85, py - bodyH * 0.05, px, py - bodyH * 0.05);
    ctx.quadraticCurveTo(px + bodyW * 0.85, py - bodyH * 0.05, px + bodyW, py + bodyH * 0.55);
    ctx.closePath();
    ctx.fill();
  };
  drawPerson(cx - 11, cy + 2, 3.8, 5.5, 14);
  drawPerson(cx + 11, cy + 2, 3.8, 5.5, 14);
  drawPerson(cx, cy + 1, 4.8, 7, 16);
}

function drawFooter(
  ctx: CanvasRenderingContext2D,
  W: number,
  H: number,
  centerY: number
) {
  const iconR = 26;
  const line1 = "Share with your study group.";
  const line2Prefix = "Learn faster with ";
  const line2Insta = "Insta";
  const line2Cue = "Cue.";

  ctx.font = `500 23px ${UI}`;
  const line1W = ctx.measureText(line1).width;
  const line2W =
    ctx.measureText(line2Prefix).width +
    ctx.measureText(line2Insta).width +
    ctx.measureText(line2Cue).width;
  const textBlockW = Math.max(line1W, line2W);
  const dividerGap = 18;
  const iconGap = 16;
  const blockW = iconR * 2 + iconGap + 2 + dividerGap + textBlockW;
  const left = (W - blockW) / 2;

  drawPeopleIcon(ctx, left + iconR, centerY, iconR);

  const divX = left + iconR * 2 + iconGap;
  ctx.strokeStyle = "rgba(25,227,218,0.75)";
  ctx.lineWidth = 1.75;
  ctx.beginPath();
  ctx.moveTo(divX, centerY - 18);
  ctx.lineTo(divX, centerY + 18);
  ctx.stroke();

  const textX = divX + dividerGap;
  ctx.textAlign = "left";
  ctx.textBaseline = "middle";
  ctx.fillStyle = WHITE;
  ctx.font = `500 23px ${UI}`;
  ctx.fillText(line1, textX, centerY - 12);
  ctx.fillText(line2Prefix, textX, centerY + 14);
  let tx = textX + ctx.measureText(line2Prefix).width;
  ctx.fillStyle = WHITE;
  ctx.fillText(line2Insta, tx, centerY + 14);
  tx += ctx.measureText(line2Insta).width;
  ctx.fillStyle = CYAN;
  ctx.fillText(line2Cue, tx, centerY + 14);

  // Clear template URL strip, then paint ours clean
  ctx.fillStyle = "#000000";
  ctx.fillRect(0, H - 90, W, 90);
  const botGlow = ctx.createRadialGradient(W * 0.15, H - 40, 5, W * 0.15, H - 40, 220);
  botGlow.addColorStop(0, "rgba(25,227,218,0.1)");
  botGlow.addColorStop(1, "rgba(25,227,218,0)");
  ctx.fillStyle = botGlow;
  ctx.fillRect(0, H - 90, W, 90);

  ctx.textAlign = "center";
  ctx.textBaseline = "middle";
  ctx.fillStyle = WHITE;
  ctx.font = `600 22px ${UI}`;
  const url = "www.edublast.in";
  const chars = url.split("");
  const spacing = 6;
  let total = 0;
  for (const ch of chars) total += ctx.measureText(ch).width + spacing;
  total -= spacing;
  let ux = W / 2 - total / 2;
  for (const ch of chars) {
    ctx.fillText(ch, ux, H - 48);
    ux += ctx.measureText(ch).width + spacing;
  }
}

/**
 * Paint WhatsApp share card matching investor template:
 * logos always on top, glass Q/A, people CTA, URL.
 */
export async function renderInstaCueShareCardPng(input: {
  question: string;
  answer: string;
}): Promise<Blob> {
  const W = INSTACUE_SHARE_WIDTH;
  const H = INSTACUE_SHARE_HEIGHT;
  const canvas = document.createElement("canvas");
  canvas.width = W;
  canvas.height = H;
  const ctx = canvas.getContext("2d");
  if (!ctx) throw new Error("Canvas unavailable");

  const q = plainShareText(input.question);
  const a = plainShareText(input.answer);
  const qSize = Math.max(54, Math.min(instaCueShareFontSize(q, "question") * 1.55, 68));
  const aSize = Math.max(40, Math.min(instaCueShareFontSize(a, "answer") * 1.45, 52));

  const [logoPrimary, logoAlt] = await Promise.all([
    loadImage(LOGO_SRC),
    loadImage(LOGO_ALT_SRC),
  ]);
  const logo =
    logoPrimary && logoPrimary.naturalWidth > 0
      ? logoPrimary
      : logoAlt && logoAlt.naturalWidth > 0
        ? logoAlt
        : null;

  // Paint pure vector background (no template image artifacts/ghosts)
  paintBackground(ctx, W, H, null);
  drawHeaderLogos(ctx, W, logo);

  // Investor 9:16 layout — logos → gap → Q → gap → A → CTA → URL
  const padX = 80;
  const cardW = W - padX * 2;
  const cardPadX = 48;
  const cardPadTop = 36;
  const cardPadBot = 44;
  const textMaxW = cardW - cardPadX * 2;
  const gapBetween = 76;
  const badgeH = 50;
  const badgeToText = 28;
  const cardRadius = 16;
  const ctaBlockH = 70;
  const ctaGap = 56;
  const urlReserve = 85;

  // Match investor: roomy gap under header, cards sit in mid band
  const bandTop = 195;
  const bandBottom = H - urlReserve - 20;
  const bandH = bandBottom - bandTop;

  ctx.font = `700 ${qSize}px ${BODY}`;
  const qLines = wrapLines(ctx, q || "InstaCue question", textMaxW, 5);
  const qLineH = qSize * 1.36;
  const qTextH = qLines.length * qLineH;

  ctx.font = `400 ${aSize}px ${BODY}`;
  const aLines = wrapLines(ctx, a || "InstaCue answer", textMaxW, 8);
  const aLineH = aSize * 1.44;
  const aTextH = aLines.length * aLineH;

  const qContentH = cardPadTop + badgeH + badgeToText + qTextH + cardPadBot;
  const aContentH = cardPadTop + badgeH + badgeToText + aTextH + cardPadBot;
  // Proud square glass cards with generous 76px redline gap
  const qMin = 500;
  const aMin = 500;
  let qH = Math.max(qMin, qContentH);
  let aH = Math.max(aMin, aContentH);

  const stackH = qH + gapBetween + aH + ctaGap + ctaBlockH;
  if (stackH > bandH) {
    const scale = bandH / stackH;
    qH = Math.floor(qH * scale);
    aH = Math.floor(aH * scale);
  }

  const finalStackH = qH + gapBetween + aH + ctaGap + ctaBlockH;
  let y = bandTop + Math.max(0, (bandH - finalStackH) * 0.32);

  drawGlassCard(ctx, padX, y, cardW, qH, cardRadius);
  drawLabelBadge(ctx, padX + cardPadX, y + cardPadTop, "question");
  ctx.fillStyle = WHITE;
  ctx.font = `700 ${qSize}px ${BODY}`;
  ctx.textAlign = "center";
  ctx.textBaseline = "top";
  const qAreaTop = y + cardPadTop + badgeH + badgeToText;
  const qAreaH = qH - cardPadTop - badgeH - badgeToText - cardPadBot;
  let qY = qAreaTop + Math.max(0, (qAreaH - qTextH) / 2);
  for (const line of qLines) {
    ctx.fillText(line, padX + cardW / 2, qY);
    qY += qLineH;
  }

  y += qH + gapBetween;

  const isShortFormulaAnswer = aLines.length <= 2;
  const aWeight = isShortFormulaAnswer ? "700" : "500";
  const effectiveASize = isShortFormulaAnswer ? Math.floor(aSize * 1.25) : aSize;
  const effectiveALineH = effectiveASize * 1.42;

  ctx.font = `${aWeight} ${effectiveASize}px ${BODY}`;
  const aLinesFinal = wrapLines(ctx, a || "InstaCue answer", textMaxW, 8);
  const aEffectiveTextH = aLinesFinal.length * effectiveALineH;

  drawGlassCard(ctx, padX, y, cardW, aH, cardRadius);
  drawLabelBadge(ctx, padX + cardPadX, y + cardPadTop, "answer");
  ctx.fillStyle = WHITE;
  ctx.font = `${aWeight} ${effectiveASize}px ${BODY}`;
  ctx.textAlign = isShortFormulaAnswer ? "center" : "left";
  ctx.textBaseline = "top";
  const aAreaTop = y + cardPadTop + badgeH + badgeToText;
  const aAreaH = aH - cardPadTop - badgeH - badgeToText - cardPadBot;
  let aY = aAreaTop + Math.max(0, (aAreaH - aEffectiveTextH) / 2);
  const aX = isShortFormulaAnswer ? padX + cardW / 2 : padX + cardPadX;
  for (const line of aLinesFinal) {
    ctx.fillText(line, aX, aY);
    aY += effectiveALineH;
  }

  const ctaY = y + aH + ctaGap + ctaBlockH / 2;
  drawFooter(ctx, W, H, ctaY);

  const blob = await new Promise<Blob | null>((resolve) => {
    canvas.toBlob((b) => resolve(b), "image/png", 1);
  });
  if (!blob) throw new Error("PNG encode failed");
  return blob;
}
