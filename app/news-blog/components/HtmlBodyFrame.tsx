"use client";

import { useCallback, useEffect, useRef } from "react";

const EMBED_BASE_STYLE = `<style id="edublast-embed-base">
  html, body {
    height: auto !important;
    min-height: 0 !important;
    max-height: none !important;
    overflow: visible !important;
  }
  body { margin: 0; }
  body, body * {
    min-height: 0 !important;
  }
</style>`;

/** Ensure uploaded HTML can grow with content inside the iframe. */
export function prepareHtmlForEmbed(html: string): string {
  const trimmed = html.trim();
  if (!trimmed) return trimmed;
  if (/<head[\s>]/i.test(trimmed)) {
    return trimmed.replace(/<head([^>]*)>/i, `<head$1>${EMBED_BASE_STYLE}`);
  }
  if (/<html[\s>]/i.test(trimmed)) {
    return trimmed.replace(/<html([^>]*)>/i, `<html$1><head>${EMBED_BASE_STYLE}</head>`);
  }
  return `${EMBED_BASE_STYLE}${trimmed}`;
}

function measureEmbedHeight(doc: Document): number {
  const body = doc.body;
  const root = doc.documentElement;
  if (!body) return 0;

  let lastBottom = 0;
  const children = Array.from(body.children);
  for (let i = children.length - 1; i >= 0; i--) {
    const el = children[i] as HTMLElement;
    const rect = el.getBoundingClientRect();
    if (rect.height > 0) {
      lastBottom = rect.bottom;
      break;
    }
  }

  return Math.max(lastBottom, body.scrollHeight, root.scrollHeight);
}

function prepareDocForMeasure(doc: Document) {
  const body = doc.body;
  const root = doc.documentElement;
  if (!body) return;
  try {
    root.style.overflow = "visible";
    body.style.overflow = "visible";
    root.style.height = "auto";
    body.style.height = "auto";
  } catch {
    /* locked document */
  }
}

export function HtmlBodyFrame({
  html,
  title,
  minHeight: minHeightFloor = 120,
}: {
  html: string;
  title: string;
  minHeight?: number;
}) {
  const ref = useRef<HTMLIFrameElement | null>(null);
  const lastHeightRef = useRef(0);
  const debounceRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const allowShrinkRef = useRef(false);
  const srcDoc = prepareHtmlForEmbed(html);

  const applyHeight = useCallback(
    (measured: number, opts?: { allowShrink?: boolean }) => {
      const frame = ref.current;
      if (!frame) return;

      const h = Math.max(minHeightFloor, Math.ceil(measured));
      const last = lastHeightRef.current;
      const allowShrink = opts?.allowShrink ?? allowShrinkRef.current;

      if (last > 0 && h < last && !allowShrink) return;
      if (last > 0 && Math.abs(h - last) < 6) return;

      lastHeightRef.current = h;
      frame.style.minHeight = "0";
      frame.style.height = `${h}px`;
    },
    [minHeightFloor]
  );

  const measure = useCallback(
    (opts?: { allowShrink?: boolean }) => {
      const frame = ref.current;
      const doc = frame?.contentWindow?.document;
      if (!frame || !doc?.body) return;

      prepareDocForMeasure(doc);
      applyHeight(measureEmbedHeight(doc), opts);
    },
    [applyHeight]
  );

  const scheduleMeasure = useCallback(
    (opts?: { allowShrink?: boolean; delayMs?: number }) => {
      if (debounceRef.current) clearTimeout(debounceRef.current);
      debounceRef.current = setTimeout(() => {
        debounceRef.current = null;
        measure(opts);
      }, opts?.delayMs ?? 80);
    },
    [measure]
  );

  useEffect(() => {
    const frame = ref.current;
    if (!frame) return;

    lastHeightRef.current = 0;
    allowShrinkRef.current = false;

    const onLoad = () => {
      measure();

      const doc = frame.contentWindow?.document;
      if (!doc?.body) return;

      const ro =
        typeof ResizeObserver !== "undefined" ? new ResizeObserver(() => scheduleMeasure()) : null;
      ro?.observe(doc.body);

      const settleTimer = window.setTimeout(() => {
        allowShrinkRef.current = true;
        measure({ allowShrink: true });
      }, 3500);

      (frame as HTMLIFrameElement & { __edublastCleanup?: () => void }).__edublastCleanup = () => {
        ro?.disconnect();
        window.clearTimeout(settleTimer);
      };
    };

    frame.addEventListener("load", onLoad);
    if (frame.contentDocument?.readyState === "complete") onLoad();

    const fallbackTimer = window.setTimeout(() => measure(), 400);

    return () => {
      if (debounceRef.current) clearTimeout(debounceRef.current);
      window.clearTimeout(fallbackTimer);
      frame.removeEventListener("load", onLoad);
      const cleanup = (frame as HTMLIFrameElement & { __edublastCleanup?: () => void })
        .__edublastCleanup;
      cleanup?.();
    };
  }, [measure, scheduleMeasure, srcDoc]);

  return (
    <iframe
      ref={ref}
      title={title || "HTML post"}
      srcDoc={srcDoc}
      className="block w-full bg-[#101a2a]"
      style={{ border: "none", minHeight: minHeightFloor, display: "block" }}
      scrolling="no"
      sandbox="allow-scripts allow-same-origin"
    />
  );
}
