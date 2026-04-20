"use client";

interface NtaProceedWarningDialogProps {
  open: boolean;
  onOk: () => void;
}

export function NtaProceedWarningDialog({ open, onOk }: NtaProceedWarningDialogProps) {
  if (!open) return null;
  return (
    <div
      className="fixed inset-0 z-[200] flex items-center justify-center p-4"
      style={{ background: "rgba(0,0,0,0.45)" }}
      role="alertdialog"
      aria-modal="true"
      aria-labelledby="nta-warn-title"
    >
      <div
        className="w-full max-w-md rounded-lg px-8 py-8 text-center shadow-xl"
        style={{
          background: "var(--nta-bg)",
          border: "1px solid var(--nta-border)",
          boxShadow: "0 8px 32px rgba(0,0,0,0.2)",
        }}
      >
        <div className="mx-auto mb-4 flex h-16 w-16 items-center justify-center rounded-full border-4 border-orange-400">
          <span className="text-3xl font-bold text-orange-500">!</span>
        </div>
        <h2 id="nta-warn-title" className="text-lg font-bold" style={{ color: "var(--nta-text)" }}>
          Warning!
        </h2>
        <p className="mt-3 text-sm leading-relaxed" style={{ color: "var(--nta-muted)" }}>
          Please accept terms and conditions before proceeding.
        </p>
        <button
          type="button"
          onClick={onOk}
          className="mt-8 min-w-[100px] rounded px-8 py-2 text-sm font-bold uppercase text-white transition-opacity hover:opacity-90"
          style={{ background: "var(--nta-blue)" }}
        >
          OK
        </button>
      </div>
    </div>
  );
}
