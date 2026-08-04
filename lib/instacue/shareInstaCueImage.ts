import { toBlob } from "html-to-image";
import html2canvas from "html2canvas";
import { downloadBlobAsPng } from "@/lib/rdm/referral/referChallengeShareImage";
import { buildWhatsAppShareUrl } from "@/lib/rdm/referral/referChallengeShareUrls";

export const INSTACUE_SHARE_WIDTH = 1080;
/** Match investor WhatsApp template aspect (~9:16). */
export const INSTACUE_SHARE_HEIGHT = 1920;

export const INSTACUE_WHATSAPP_CAPTION =
  "Share with your study group. Learn faster with InstaCue — www.edublast.in";

type DisabledSheet = { el: HTMLLinkElement; media: string };

/**
 * Cross-origin stylesheets (Tabler CDN, some font CDNs) throw SecurityError on
 * `cssRules` when libraries walk document.styleSheets. Mute them for capture.
 */
function muteCrossOriginStylesheets(): DisabledSheet[] {
  const muted: DisabledSheet[] = [];
  if (typeof document === "undefined" || typeof window === "undefined") return muted;

  const origin = window.location.origin;
  document.querySelectorAll('link[rel="stylesheet"]').forEach((node) => {
    const el = node as HTMLLinkElement;
    let hrefOrigin = "";
    try {
      hrefOrigin = new URL(el.href, origin).origin;
    } catch {
      return;
    }
    if (hrefOrigin && hrefOrigin !== origin) {
      muted.push({ el, media: el.media || "all" });
      el.media = "not all";
    }
  });
  return muted;
}

function restoreStylesheets(muted: DisabledSheet[]) {
  muted.forEach(({ el, media }) => {
    el.media = media;
  });
}

async function captureWithHtml2Canvas(element: HTMLElement): Promise<Blob | null> {
  const canvas = await html2canvas(element, {
    backgroundColor: "#05070c",
    scale: 2,
    width: INSTACUE_SHARE_WIDTH,
    height: INSTACUE_SHARE_HEIGHT,
    windowWidth: INSTACUE_SHARE_WIDTH,
    windowHeight: INSTACUE_SHARE_HEIGHT,
    useCORS: true,
    allowTaint: false,
    logging: false,
    foreignObjectRendering: false,
    // Ignore nodes that pull remote CSS / fonts into the clone.
    ignoreElements: (el) => {
      const tag = el.tagName?.toLowerCase();
      if (tag === "link" || tag === "style") {
        const href = (el as HTMLLinkElement).href || "";
        if (href && !href.startsWith(window.location.origin) && !href.startsWith("data:")) {
          return true;
        }
      }
      return false;
    },
  });

  return new Promise((resolve) => {
    canvas.toBlob((blob) => resolve(blob), "image/png", 1);
  });
}

async function captureWithHtmlToImage(element: HTMLElement): Promise<Blob | null> {
  return toBlob(element, {
    pixelRatio: 2,
    cacheBust: true,
    backgroundColor: "#05070c",
    width: INSTACUE_SHARE_WIDTH,
    height: INSTACUE_SHARE_HEIGHT,
    fontEmbedCSS: "",
    style: {
      width: `${INSTACUE_SHARE_WIDTH}px`,
      height: `${INSTACUE_SHARE_HEIGHT}px`,
      transform: "none",
    },
  });
}

/** Park the share art far off-screen so capture never flashes over the UI. */
const OFFSCREEN_LEFT = "-14000px";

export async function renderInstaCueShareToPng(element: HTMLElement): Promise<Blob> {
  const prev = {
    position: element.style.position,
    left: element.style.left,
    top: element.style.top,
    right: element.style.right,
    bottom: element.style.bottom,
    zIndex: element.style.zIndex,
    opacity: element.style.opacity,
    pointerEvents: element.style.pointerEvents,
    transform: element.style.transform,
    visibility: element.style.visibility,
  };

  element.style.position = "fixed";
  element.style.left = OFFSCREEN_LEFT;
  element.style.top = "0";
  element.style.right = "auto";
  element.style.bottom = "auto";
  element.style.zIndex = "-1";
  element.style.opacity = "1";
  element.style.visibility = "visible";
  element.style.pointerEvents = "none";
  element.style.transform = "none";

  if (typeof document !== "undefined" && "fonts" in document) {
    try {
      await document.fonts.ready;
    } catch {
      // continue
    }
  }

  await new Promise<void>((resolve) => {
    requestAnimationFrame(() => requestAnimationFrame(() => resolve()));
  });
  await new Promise((r) => setTimeout(r, 160));

  const muted = muteCrossOriginStylesheets();
  let blob: Blob | null = null;
  try {
    // Prefer html2canvas — more reliable against cross-origin cssRules SecurityError.
    try {
      blob = await captureWithHtml2Canvas(element);
    } catch {
      blob = null;
    }
    if (!blob) {
      try {
        blob = await captureWithHtmlToImage(element);
      } catch {
        blob = null;
      }
    }
  } finally {
    restoreStylesheets(muted);
    element.style.position = prev.position;
    element.style.left = prev.left;
    element.style.top = prev.top;
    element.style.right = prev.right;
    element.style.bottom = prev.bottom;
    element.style.zIndex = prev.zIndex;
    element.style.opacity = prev.opacity;
    element.style.pointerEvents = prev.pointerEvents;
    element.style.transform = prev.transform;
    element.style.visibility = prev.visibility;
  }

  if (!blob) {
    throw new Error("InstaCue share image failed");
  }
  return blob;
}

export type InstaCueShareAction = "whatsapp" | "download" | "copy" | "native";

export function downloadInstaCuePng(blob: Blob, filename = "edublast-instacue.png"): void {
  downloadBlobAsPng(blob, filename);
}

export async function copyInstaCuePngToClipboard(blob: Blob): Promise<void> {
  if (typeof navigator === "undefined" || !navigator.clipboard?.write) {
    throw new Error("Clipboard image copy is not supported here.");
  }
  if (typeof ClipboardItem === "undefined") {
    throw new Error("Clipboard image copy is not supported here.");
  }
  const pngBlob =
    blob.type === "image/png" ? blob : new Blob([await blob.arrayBuffer()], { type: "image/png" });
  await navigator.clipboard.write([new ClipboardItem({ "image/png": pngBlob })]);
}

export function canCopyInstaCuePng(): boolean {
  return (
    typeof navigator !== "undefined" &&
    typeof navigator.clipboard?.write === "function" &&
    typeof ClipboardItem !== "undefined"
  );
}

/**
 * Download PNG + open WhatsApp with caption.
 * WhatsApp Web cannot receive a local file attachment automatically.
 */
export function shareInstaCuePngViaWhatsAppWeb(
  blob: Blob,
  opts?: { filename?: string; caption?: string }
): void {
  const filename = opts?.filename ?? "edublast-instacue.png";
  const caption = opts?.caption ?? INSTACUE_WHATSAPP_CAPTION;
  downloadInstaCuePng(blob, filename);
  if (typeof window !== "undefined") {
    window.open(buildWhatsAppShareUrl(caption), "_blank", "noopener,noreferrer");
  }
}

/** True on phones/tablets where the OS share sheet is the MNC-standard path. */
export function prefersNativeFileShare(): boolean {
  if (typeof navigator === "undefined" || typeof navigator.share !== "function") return false;
  const ua = navigator.userAgent || "";
  const mobile = /Android|iPhone|iPad|iPod|Mobile/i.test(ua);
  if (!mobile) return false;
  try {
    const probe = new File([new Uint8Array([137, 80, 78, 71])], "probe.png", { type: "image/png" });
    return !navigator.canShare || navigator.canShare({ files: [probe] });
  } catch {
    return false;
  }
}

/** One-tap native share sheet (iOS/Android) — same pattern Spotify / Instagram use. */
export async function shareInstaCuePngNative(
  blob: Blob,
  opts?: { filename?: string; title?: string; text?: string }
): Promise<void> {
  const filename = opts?.filename ?? "edublast-instacue.png";
  const title = opts?.title ?? "InstaCue · Edublast";
  const text = opts?.text ?? INSTACUE_WHATSAPP_CAPTION;
  const file = new File([blob], filename, { type: "image/png" });

  if (typeof navigator === "undefined" || typeof navigator.share !== "function") {
    throw new Error("Native share is not available.");
  }
  const payload: ShareData = { files: [file], title, text };
  if (navigator.canShare && !navigator.canShare(payload)) {
    throw new Error("Native file share is not available.");
  }
  await navigator.share(payload);
}

export function instaCueShareFontSize(raw: string, kind: "question" | "answer"): number {
  const len = (raw ?? "").replace(/\s+/g, " ").trim().length;
  if (kind === "question") {
    if (len > 220) return 28;
    if (len > 160) return 32;
    if (len > 110) return 38;
    if (len > 70) return 44;
    return 50;
  }
  if (len > 650) return 22;
  if (len > 450) return 26;
  if (len > 300) return 30;
  if (len > 180) return 34;
  if (len > 100) return 38;
  return 42;
}
