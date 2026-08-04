"use client";

import { forwardRef } from "react";
import TheoryContent from "@/components/TheoryContent";
import {
  INSTACUE_SHARE_HEIGHT,
  INSTACUE_SHARE_WIDTH,
  instaCueShareFontSize,
} from "@/lib/instacue/shareInstaCueImage";

function normalizeCardMath(raw: string): string {
  return (raw ?? "")
    .replace(/\\\\\(/g, "\\(")
    .replace(/\\\\\)/g, "\\)")
    .replace(/\\\\\[/g, "\\[")
    .replace(/\\\\\]/g, "\\]");
}

type Props = {
  question: string;
  answer: string;
};

/**
 * Off-screen WhatsApp / social share canvas.
 * Visual language matches the Edublast InstaCue investor template
 * (dark + cyan, Q then A, brand footer).
 */
const InstaCueShareCanvas = forwardRef<HTMLDivElement, Props>(function InstaCueShareCanvas(
  { question, answer },
  ref
) {
  const q = normalizeCardMath(question);
  const a = normalizeCardMath(answer);
  const qSize = Math.max(54, Math.min(instaCueShareFontSize(q, "question") * 1.55, 68));
  const aSize = Math.max(40, Math.min(instaCueShareFontSize(a, "answer") * 1.45, 52));
  const scopeId = "instacue-share-canvas";

  return (
    <div
      ref={ref}
      id={scopeId}
      aria-hidden
      style={{
        width: INSTACUE_SHARE_WIDTH,
        height: INSTACUE_SHARE_HEIGHT,
        background: "#000000",
        color: "#ffffff",
        fontFamily: "Inter, Poppins, Segoe UI, system-ui, -apple-system, sans-serif",
        position: "relative",
        overflow: "hidden",
        boxSizing: "border-box",
        padding: "72px 64px 64px",
        display: "flex",
        flexDirection: "column",
      }}
    >
      <style>{`
        #${scopeId} .share-q.theory-content-readable,
        #${scopeId} .share-q.theory-content-readable p {
          font-size: ${qSize}px !important;
          line-height: 1.35 !important;
          color: #fff !important;
          text-align: center !important;
          margin: 0 !important;
          font-family: Inter, Poppins, Segoe UI, sans-serif !important;
          font-weight: 700 !important;
        }
        #${scopeId} .share-a.theory-content-readable,
        #${scopeId} .share-a.theory-content-readable p {
          font-size: ${aSize}px !important;
          line-height: 1.45 !important;
          color: #fff !important;
          text-align: left !important;
          margin: 0 !important;
          font-family: Inter, Poppins, Segoe UI, sans-serif !important;
          font-weight: 500 !important;
        }
        #${scopeId} .katex,
        #${scopeId} .katex-display {
          color: #fff !important;
        }
      `}</style>
      {/* Decorative cyan streaks */}
      <div
        style={{
          position: "absolute",
          inset: 0,
          pointerEvents: "none",
          backgroundImage:
            "radial-gradient(circle, rgba(25,227,218,0.35) 1.2px, transparent 1.4px)",
          backgroundSize: "18px 18px",
          backgroundPosition: "left bottom",
          maskImage:
            "radial-gradient(ellipse 45% 35% at 8% 92%, #000 20%, transparent 70%), radial-gradient(ellipse 35% 28% at 92% 8%, #000 10%, transparent 65%)",
          WebkitMaskImage:
            "radial-gradient(ellipse 45% 35% at 8% 92%, #000 20%, transparent 70%), radial-gradient(ellipse 35% 28% at 92% 8%, #000 10%, transparent 65%)",
          opacity: 0.55,
        }}
      />
      {/* Header */}
      <div
        style={{
          display: "flex",
          alignItems: "center",
          justifyContent: "space-between",
          marginBottom: 48,
          position: "relative",
          zIndex: 1,
        }}
      >
        {/* eslint-disable-next-line @next/next/no-img-element */}
        <img
          src="/images/logo-2.png"
          alt=""
          width={340}
          height={80}
          style={{ width: 340, height: "auto", display: "block" }}
        />
        <div style={{ fontSize: 48, fontWeight: 700, letterSpacing: "-0.02em" }}>
          Insta<span style={{ color: "#19E3DA" }}>Cue</span>
        </div>
      </div>

      {/* Question card */}
      <div
        style={{
          position: "relative",
          zIndex: 1,
          flex: "0 1 auto",
          minHeight: 500,
          maxHeight: 620,
          borderRadius: 16,
          padding: "36px 40px",
          marginBottom: 76,
          background: "linear-gradient(160deg, rgba(18,24,36,0.94) 0%, rgba(10,14,22,0.98) 100%)",
          border: "1.5px solid rgba(25,227,218,0.75)",
          boxShadow:
            "0 0 16px rgba(25,227,218,0.25), inset 0 1px 0 rgba(255,255,255,0.06)",
          display: "flex",
          flexDirection: "column",
          overflow: "hidden",
        }}
      >
        <div
          style={{
            alignSelf: "flex-start",
            display: "inline-flex",
            alignItems: "center",
            gap: 10,
            padding: "10px 18px",
            borderRadius: 999,
            border: "1.5px solid rgba(25,227,218,0.55)",
            color: "#19E3DA",
            fontSize: 22,
            fontWeight: 700,
            marginBottom: 28,
            background: "rgba(25,227,218,0.08)",
          }}
        >
          <span style={{ fontSize: 24, lineHeight: 1 }}>?</span>
          InstaCue Quick Doubt
        </div>
        <div
          style={{
            flex: 1,
            minHeight: 0,
            display: "flex",
            alignItems: "center",
            justifyContent: "center",
            textAlign: "center",
            overflow: "hidden",
            width: "100%",
          }}
        >
          <TheoryContent
            theory={q}
            className="share-q !m-0 !max-w-full !space-y-2 !text-center !text-white"
          />
        </div>
      </div>

      {/* Answer card */}
      <div
        style={{
          position: "relative",
          zIndex: 1,
          flex: "1 1 auto",
          minHeight: 540,
          borderRadius: 16,
          padding: "36px 40px",
          background: "linear-gradient(160deg, rgba(18,24,36,0.94) 0%, rgba(10,14,22,0.98) 100%)",
          border: "1.5px solid rgba(25,227,218,0.75)",
          boxShadow:
            "0 0 16px rgba(25,227,218,0.25), inset 0 1px 0 rgba(255,255,255,0.06)",
          display: "flex",
          flexDirection: "column",
          overflow: "hidden",
        }}
      >
        <div
          style={{
            alignSelf: "flex-start",
            display: "inline-flex",
            alignItems: "center",
            gap: 10,
            padding: "10px 18px",
            borderRadius: 999,
            border: "1.5px solid rgba(25,227,218,0.55)",
            color: "#19E3DA",
            fontSize: 22,
            fontWeight: 700,
            marginBottom: 24,
            background: "rgba(25,227,218,0.08)",
          }}
        >
          <span style={{ fontSize: 22, lineHeight: 1 }}>✓</span>
          Answer
        </div>
        <div
          style={{
            flex: 1,
            minHeight: 0,
            overflow: "hidden",
            display: "flex",
            flexDirection: "column",
            alignItems: a.length < 120 ? "center" : "flex-start",
            justifyContent: "center",
            width: "100%",
            textAlign: a.length < 120 ? "center" : "left",
          }}
        >
          <TheoryContent
            theory={a}
            className={`share-a !m-0 !max-w-full !space-y-3 !text-white ${
              a.length < 120
                ? "!text-center !font-bold !text-2xl"
                : "!text-left !font-medium"
            }`}
          />
        </div>
      </div>

      {/* Footer */}
      <div
        style={{
          position: "relative",
          zIndex: 1,
          marginTop: "auto",
          paddingTop: 64,
          display: "flex",
          flexDirection: "column",
          alignItems: "center",
          gap: 22,
        }}
      >
        <div
          style={{
            display: "flex",
            alignItems: "center",
            gap: 16,
            color: "#e8eef5",
            fontSize: 26,
            fontWeight: 600,
          }}
        >
          <span
            style={{
              width: 52,
              height: 52,
              borderRadius: "50%",
              border: "2px solid rgba(25,227,218,0.7)",
              display: "inline-flex",
              alignItems: "center",
              justifyContent: "center",
              color: "#19E3DA",
              fontSize: 26,
              flexShrink: 0,
            }}
          >
            👥
          </span>
          <span>Share with your study group. Learn faster with InstaCue.</span>
        </div>
        <div style={{ fontSize: 24, fontWeight: 600, color: "#ffffff", letterSpacing: "0.25em" }}>
          www.edublast.in
        </div>
      </div>
    </div>
  );
});

export default InstaCueShareCanvas;
