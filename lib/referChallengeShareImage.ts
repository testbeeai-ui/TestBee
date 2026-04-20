import { toBlob } from "html-to-image";

export async function renderShareCardToPng(element: HTMLElement): Promise<Blob> {
  const prev = {
    position: element.style.position,
    left: element.style.left,
    top: element.style.top,
    zIndex: element.style.zIndex,
    opacity: element.style.opacity,
    pointerEvents: element.style.pointerEvents,
    transform: element.style.transform,
  };

  // Keep the node inside viewport during capture. Extreme off-screen positions can produce blank exports.
  element.style.position = "fixed";
  element.style.left = "0";
  element.style.top = "0";
  element.style.zIndex = "2147483647";
  element.style.opacity = "1";
  element.style.pointerEvents = "none";
  element.style.transform = "none";

  if (typeof document !== "undefined" && "fonts" in document) {
    try {
      await document.fonts.ready;
    } catch {
      // ignore font readiness errors and continue
    }
  }

  let blob: Blob | null = null;
  try {
    blob = await toBlob(element, {
      pixelRatio: 2,
      cacheBust: true,
      backgroundColor: "#070714",
      canvasWidth: 768,
      canvasHeight: 768,
    });

    if (!blob) {
      blob = await toBlob(element, {
        pixelRatio: 2,
        cacheBust: true,
        backgroundColor: "#070714",
        width: 768,
        height: 768,
        style: {
          width: "768px",
          height: "768px",
        },
      });
    }
  } finally {
    element.style.position = prev.position;
    element.style.left = prev.left;
    element.style.top = prev.top;
    element.style.zIndex = prev.zIndex;
    element.style.opacity = prev.opacity;
    element.style.pointerEvents = prev.pointerEvents;
    element.style.transform = prev.transform;
  }

  if (!blob) {
    throw new Error("PNG generation failed");
  }

  return blob;
}

export function downloadBlobAsPng(blob: Blob, filename: string): void {
  const objectUrl = URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.href = objectUrl;
  a.download = filename;
  document.body.appendChild(a);
  a.click();
  document.body.removeChild(a);
  URL.revokeObjectURL(objectUrl);
}
