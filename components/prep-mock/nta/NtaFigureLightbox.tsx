"use client";

import { useCallback, useEffect, useState, type MouseEvent } from "react";
import { createPortal } from "react-dom";

export function useNtaFigurePreview() {
  const [src, setSrc] = useState<string | null>(null);
  const [alt, setAlt] = useState("Figure");

  const onPreviewClick = useCallback((event: MouseEvent<HTMLElement>) => {
    const node = event.target;
    if (!(node instanceof HTMLImageElement)) return;
    if (!node.classList.contains("nta-mock-img")) return;
    event.preventDefault();
    event.stopPropagation();
    setSrc(node.currentSrc || node.src);
    setAlt(node.alt?.trim() || "Figure");
  }, []);

  const closePreview = useCallback(() => setSrc(null), []);

  useEffect(() => {
    if (!src) return;
    const onKey = (event: KeyboardEvent) => {
      if (event.key !== "Escape") return;
      event.preventDefault();
      event.stopPropagation();
      setSrc(null);
    };
    window.addEventListener("keydown", onKey, true);
    return () => window.removeEventListener("keydown", onKey, true);
  }, [src]);

  return { previewSrc: src, previewAlt: alt, onPreviewClick, closePreview };
}

export function NtaFigureLightbox({
  src,
  alt,
  onClose,
}: {
  src: string | null;
  alt: string;
  onClose: () => void;
}) {
  if (!src || typeof document === "undefined") return null;

  return createPortal(
    <div
      className="fixed inset-0 z-[260] flex items-center justify-center bg-slate-950/90 p-4 sm:p-8"
      role="dialog"
      aria-modal="true"
      aria-label="Enlarged figure"
      onClick={onClose}
    >
      <button
        type="button"
        onClick={onClose}
        className="absolute right-4 top-4 rounded-lg border border-slate-600 bg-slate-800 px-3.5 py-1.5 text-xs text-slate-200"
      >
        Close
      </button>
      {/* eslint-disable-next-line @next/next/no-img-element -- exam figure from storage */}
      <img
        src={src}
        alt={alt}
        className="nta-mock-img max-h-[85vh] max-w-[min(92vw,56rem)] rounded-xl object-contain shadow-2xl"
        onClick={(event) => event.stopPropagation()}
      />
    </div>,
    document.body
  );
}
