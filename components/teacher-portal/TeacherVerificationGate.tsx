"use client";

import type { TeacherVerificationStatus } from "@/lib/teacherPortal/types";

type TeacherVerificationGateProps = {
  status: TeacherVerificationStatus;
  adminNotes: string | null;
  onGoToProfile: () => void;
  onRefresh: () => void;
  actionLabel?: string | null;
  mode?: "fullscreen" | "modal";
  onClose?: () => void;
};

function assertNever(x: never): never {
  throw new Error(`Unhandled verification status: ${String(x)}`);
}

export default function TeacherVerificationGate({
  status,
  adminNotes,
  onGoToProfile,
  onRefresh,
  actionLabel = null,
  mode = "fullscreen",
  onClose,
}: TeacherVerificationGateProps) {
  if (status === "approved") return null;

  let title = "";
  let subtitle = "";
  let showAdminNotes = false;
  switch (status) {
    case "unverified":
      title = "Complete teacher verification to continue";
      subtitle =
        "Fill all required identity fields and upload documents from Profile. Your access unlocks after verification approval.";
      break;
    case "pending":
      title = "Verification submitted";
      subtitle =
        "Your details are under review. The teacher portal unlocks automatically after verification approval.";
      break;
    case "rejected":
      title = "Verification needs correction";
      subtitle = "Update the requested details/documents and submit again from Profile.";
      showAdminNotes = true;
      break;
    default:
      assertNever(status);
  }

  return (
    <div
      className={`fixed inset-0 z-[1200] flex items-center justify-center px-4 pointer-events-auto ${
        mode === "fullscreen" ? "bg-[#07070f]/95" : "bg-[#07070f]/70 backdrop-blur-[1px]"
      }`}
    >
      <div className="relative z-[1201] w-full max-w-2xl rounded-2xl border border-white/15 bg-[#15162b] p-6 text-slate-100 shadow-2xl pointer-events-auto">
        <h2 className="text-2xl font-semibold">{title}</h2>
        <p className="mt-3 text-sm text-slate-300">{subtitle}</p>
        {actionLabel ? (
          <p className="mt-2 text-xs text-slate-400">
            Blocked action: <span className="font-semibold text-slate-200">{actionLabel}</span>
          </p>
        ) : null}

        {showAdminNotes ? (
          <div className="mt-4 rounded-xl border border-amber-400/40 bg-amber-500/10 p-3 text-sm text-amber-100">
            <p className="font-semibold">Verification notes</p>
            <p className="mt-1 whitespace-pre-wrap">
              {(adminNotes ?? "").trim() || "Please recheck your submitted details and documents."}
            </p>
          </div>
        ) : null}

        <div className="mt-6 flex flex-wrap gap-2">
          {(status === "unverified" || status === "rejected") && (
            <button
              type="button"
              onClick={onGoToProfile}
              className="rounded-full bg-emerald-500 px-4 py-2 text-sm font-semibold text-black hover:bg-emerald-400"
            >
              Open profile and submit
            </button>
          )}
          <button
            type="button"
            onClick={onRefresh}
            className="rounded-full border border-white/20 px-4 py-2 text-sm text-slate-200 hover:bg-white/10"
          >
            Refresh status
          </button>
          {mode === "modal" ? (
            <button
              type="button"
              onClick={onClose}
              className="rounded-full border border-white/20 px-4 py-2 text-sm text-slate-300 hover:bg-white/5"
            >
              Not now
            </button>
          ) : null}
        </div>
      </div>
    </div>
  );
}
