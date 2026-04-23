"use client";

interface NtaSubmitModalProps {
  open: boolean;
  onCancel: () => void;
  onConfirm: () => void;
}

export function NtaSubmitModal({ open, onCancel, onConfirm }: NtaSubmitModalProps) {
  if (!open) return null;
  return (
    <div
      className="fixed inset-0 z-[220] flex items-center justify-center p-4"
      style={{ background: "rgba(0,0,0,0.65)" }}
      onClick={onCancel}
      role="dialog"
      aria-modal="true"
      aria-labelledby="nta-submit-title"
    >
      <div
        className="w-full max-w-sm rounded-lg border p-6 shadow-xl"
        style={{ background: "var(--nta-bg)", borderColor: "var(--nta-border)" }}
        onClick={(e) => e.stopPropagation()}
      >
        <h2
          id="nta-submit-title"
          className="text-lg font-bold"
          style={{ color: "var(--nta-text)" }}
        >
          Submit and see results?
        </h2>
        <p className="mt-2 text-sm" style={{ color: "var(--nta-muted)" }}>
          You can&apos;t change answers after submitting. Your score and time will be shown.
        </p>
        <div className="mt-6 flex justify-end gap-2">
          <button
            type="button"
            onClick={onCancel}
            className="rounded border px-4 py-2 text-sm font-bold"
            style={{ borderColor: "var(--nta-border)", color: "var(--nta-text)" }}
          >
            Cancel
          </button>
          <button
            type="button"
            onClick={onConfirm}
            className="rounded px-4 py-2 text-sm font-bold text-white"
            style={{ background: "var(--nta-green)" }}
          >
            Submit
          </button>
        </div>
      </div>
    </div>
  );
}
