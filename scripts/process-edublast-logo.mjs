/**
 * Removes flat dark backgrounds from the full EduBlast nav wordmark PNG
 * (charcoal ~#1A1D21 or black) and writes:
 *   - public/edublast-wordmark-transparent.png (white wordmark, for dark UI)
 *   - public/edublast-wordmark-light.png (dark gray wordmark, for light UI)
 *
 * Usage: node scripts/process-edublast-logo.mjs [input.png]
 */
import fs from "fs";
import os from "os";
import path from "path";
import { fileURLToPath } from "url";
import sharp from "sharp";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const repoRoot = path.join(__dirname, "..");
const outFile = path.join(repoRoot, "public", "edublast-wordmark-transparent.png");
const outLight = path.join(repoRoot, "public", "edublast-wordmark-light.png");

const CURSOR_ASSET_NAME =
  "c__Users_rentk_AppData_Roaming_Cursor_User_workspaceStorage_42b202b840abbc3e8621f2fea12251fd_images_357110b3-8c4a-457f-aac2-eccfeeb73684-5f9594a9-845d-4858-94ce-9b258b6b6dd0.png";

function defaultInputPath() {
  const fromCursor = path.join(
    os.homedir(),
    ".cursor/projects/c-Users-rentk-Desktop-Testbee/assets",
    CURSOR_ASSET_NAME,
  );
  if (fs.existsSync(fromCursor)) return fromCursor;
  const fallback = path.join(repoRoot, "public", "edublast-wordmark-source.png");
  return fallback;
}

function isBackgroundPixel(r, g, b) {
  const mx = Math.max(r, g, b);
  const mn = Math.min(r, g, b);
  const sat = mx < 1 ? 0 : (mx - mn) / mx;
  if (sat > 0.18) return false;
  const dChar = Math.hypot(r - 26, g - 29, b - 33);
  if (dChar < 30) return true;
  if (r < 18 && g < 18 && b < 18) return true;
  return false;
}

async function main() {
  const inputPath = process.argv[2] || defaultInputPath();

  if (!fs.existsSync(inputPath)) {
    console.error("Input not found:\n", inputPath);
    console.error(
      "Copy the reference wordmark to public/edublast-wordmark-source.png or pass a path.",
    );
    process.exit(1);
  }

  const { data, info } = await sharp(inputPath)
    .ensureAlpha()
    .raw()
    .toBuffer({ resolveWithObject: true });

  const w = info.width;
  const h = info.height;
  const ch = 4;
  const visited = new Uint8Array(w * h);
  const stack = [];

  const idx = (x, y) => y * w + x;
  const pushEdge = (x, y) => {
    const i = idx(x, y);
    if (visited[i]) return;
    const p = i * ch;
    const r = data[p];
    const g = data[p + 1];
    const b = data[p + 2];
    if (!isBackgroundPixel(r, g, b)) return;
    visited[i] = 1;
    stack.push(i);
  };

  for (let x = 0; x < w; x++) {
    pushEdge(x, 0);
    pushEdge(x, h - 1);
  }
  for (let y = 0; y < h; y++) {
    pushEdge(0, y);
    pushEdge(w - 1, y);
  }

  while (stack.length) {
    const cur = stack.pop();
    const x = cur % w;
    const y = (cur / w) | 0;
    const neighbors = [
      [x + 1, y],
      [x - 1, y],
      [x, y + 1],
      [x, y - 1],
    ];
    for (const [nx, ny] of neighbors) {
      if (nx < 0 || ny < 0 || nx >= w || ny >= h) continue;
      const ni = idx(nx, ny);
      if (visited[ni]) continue;
      const p = ni * ch;
      if (!isBackgroundPixel(data[p], data[p + 1], data[p + 2])) continue;
      visited[ni] = 1;
      stack.push(ni);
    }
  }

  for (let i = 0; i < w * h; i++) {
    if (visited[i]) {
      data[i * ch + 3] = 0;
    }
  }

  const rawForDark = Buffer.from(data);

  function lightModeCopy(buf) {
    const copy = Buffer.from(buf);
    for (let i = 0; i < w * h; i++) {
      const p = i * ch;
      if (copy[p + 3] < 25) continue;
      const r = copy[p];
      const g = copy[p + 1];
      const b = copy[p + 2];
      const mx = Math.max(r, g, b);
      const mn = Math.min(r, g, b);
      const sat = mx < 1 ? 0 : (mx - mn) / mx;
      if (r > 195 && g > 195 && b > 195 && sat < 0.14) {
        copy[p] = 28;
        copy[p + 1] = 30;
        copy[p + 2] = 34;
      }
    }
    return copy;
  }

  const rawLight = lightModeCopy(data);

  await sharp(rawForDark, { raw: { width: w, height: h, channels: 4 } })
    .png({ compressionLevel: 9, effort: 10 })
    .toFile(outFile);

  await sharp(rawLight, { raw: { width: w, height: h, channels: 4 } })
    .png({ compressionLevel: 9, effort: 10 })
    .toFile(outLight);

  console.log("Wrote", outFile);
  console.log("Wrote", outLight);
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
