"use client";

import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Textarea } from "@/components/ui/textarea";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { useToast } from "@/hooks/use-toast";
import { Copy, Loader2, CheckCircle2, Sparkles, ChevronDown, Mail } from "lucide-react";
import { motion, AnimatePresence } from "framer-motion";
import { parseBulkInviteEmails } from "@/lib/classroom/parseBulkInviteEmails";
import { DEFAULT_RDM_CONFIG } from "@/lib/rdm/rdmConfig";
import { cn } from "@/lib/utils";

export interface BulkInviteClassroom {
  id: string;
  name: string;
  joinCode: string;
  studentCount?: number;
}

interface Props {
  classrooms: BulkInviteClassroom[];
  open: boolean;
  onOpenChange: (open: boolean) => void;
}

type InviteStatus = {
  invitedCount: number;
  joinedCount: number;
  subscribedCount: number;
  rdmEarned: number;
  recipients: { email: string; joined: boolean; subscribed: boolean }[];
};

const minStudents = DEFAULT_RDM_CONFIG.classroom_bulk_invite_min_students;
const flatRdm = DEFAULT_RDM_CONFIG.classroom_bulk_invite_flat_rdm;
const paidBonusRdm = DEFAULT_RDM_CONFIG.classroom_batch_paid_bonus_rdm;
const paidWindowDays = DEFAULT_RDM_CONFIG.classroom_batch_paid_window_days;
const RESEND_SENT_MS = 3500;

function classroomLabel(c: BulkInviteClassroom): string {
  return `${c.name}${c.studentCount != null ? ` (${c.studentCount} students)` : ""}`;
}

function ClassroomPicker({
  classrooms,
  classroomId,
  onChange,
}: {
  classrooms: BulkInviteClassroom[];
  classroomId: string;
  onChange: (id: string) => void;
}) {
  const [menuOpen, setMenuOpen] = useState(false);
  const selected = classrooms.find((c) => c.id === classroomId);

  return (
    <div className="relative">
      <button
        type="button"
        aria-expanded={menuOpen}
        onClick={() => setMenuOpen((v) => !v)}
        className="flex w-full items-center justify-between gap-2 rounded-lg border border-white/15 bg-[#0f1329] px-3 py-2.5 text-left text-sm text-slate-100 hover:border-violet-400/40"
      >
        <span className="truncate">{selected ? classroomLabel(selected) : "Choose classroom"}</span>
        <ChevronDown
          className={cn("h-4 w-4 shrink-0 text-slate-400 transition-transform", menuOpen && "rotate-180")}
        />
      </button>
      {menuOpen ? (
        <>
          <button
            type="button"
            aria-label="Close classroom list"
            className="fixed inset-0 z-40 cursor-default"
            onClick={() => setMenuOpen(false)}
          />
          <ul className="absolute z-50 mt-1 max-h-48 w-full overflow-y-auto rounded-lg border border-white/15 bg-[#0f1329] py-1 shadow-xl">
            {classrooms.map((c) => (
              <li key={c.id}>
                <button
                  type="button"
                  onClick={() => {
                    onChange(c.id);
                    setMenuOpen(false);
                  }}
                  className={cn(
                    "w-full px-3 py-2 text-left text-sm text-slate-200 hover:bg-violet-500/20",
                    c.id === classroomId && "bg-violet-500/15 font-semibold text-violet-100",
                  )}
                >
                  {classroomLabel(c)}
                </button>
              </li>
            ))}
          </ul>
        </>
      ) : null}
    </div>
  );
}

export default function ClassroomBulkInviteModal({ classrooms, open, onOpenChange }: Props) {
  const { toast } = useToast();
  const [classroomId, setClassroomId] = useState("");
  const [bulkText, setBulkText] = useState("");
  const [submitting, setSubmitting] = useState(false);
  const [status, setStatus] = useState<InviteStatus | null>(null);
  const [statusLoading, setStatusLoading] = useState(false);
  const [resendingEmail, setResendingEmail] = useState<string | null>(null);
  const [removingEmail, setRemovingEmail] = useState<string | null>(null);
  const [sentEmail, setSentEmail] = useState<string | null>(null);
  const sentTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  useEffect(() => {
    return () => {
      if (sentTimerRef.current) clearTimeout(sentTimerRef.current);
    };
  }, []);

  const loadStatus = useCallback(async (id: string) => {
    if (!id) return;
    setStatusLoading(true);
    try {
      const res = await fetch(`/api/teacher/classroom/${id}/invite-status`, {
        credentials: "include",
      });
      const data = (await res.json().catch(() => null)) as (InviteStatus & { ok?: boolean }) | null;
      setStatus(data?.ok ? data : null);
    } finally {
      setStatusLoading(false);
    }
  }, []);

  useEffect(() => {
    if (classrooms.length === 0) return;
    setClassroomId((prev) =>
      prev && classrooms.some((c) => c.id === prev) ? prev : classrooms[0].id,
    );
  }, [classrooms]);

  const selected = useMemo(
    () => classrooms.find((c) => c.id === classroomId) ?? null,
    [classrooms, classroomId],
  );

  const joinLink = useMemo(() => {
    if (typeof window === "undefined" || !selected?.joinCode?.trim()) return "";
    const u = new URL(`${window.location.origin}/join`);
    u.searchParams.set("code", selected.joinCode.trim());
    return u.toString();
  }, [selected]);

  useEffect(() => {
    if (!open) {
      setBulkText("");
      return;
    }
    if (!classroomId) return;
    void loadStatus(classroomId);
  }, [open, classroomId, loadStatus]);

  const submitBulkInvite = useCallback(async () => {
    if (!selected) return;
    const emails = parseBulkInviteEmails(bulkText);
    if (emails.length === 0) {
      toast({ title: "Add at least one valid email", variant: "destructive" });
      return;
    }
    setSubmitting(true);
    try {
      const res = await fetch(`/api/teacher/classroom/${selected.id}/bulk-invite`, {
        method: "POST",
        credentials: "include",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ emails }),
      });
      const data = (await res.json().catch(() => ({}))) as {
        ok?: boolean;
        error?: string;
        invitedCount?: number;
        flatRewardRdm?: number;
        emailsSent?: number | null;
        emailsSkippedAlreadyJoined?: number | null;
        emailsQueued?: boolean;
      };
      if (!res.ok || !data.ok) {
        toast({
          title: "Could not add students",
          description: data.error ?? "Try again",
          variant: "destructive",
        });
        return;
      }
      const flat = data.flatRewardRdm ?? 0;
      const sent = data.emailsSent;
      const skippedJoined = data.emailsSkippedAlreadyJoined ?? 0;
      const emailNote =
        sent != null
          ? sent > 0
            ? `Invitation email sent to ${sent} student${sent === 1 ? "" : "s"}.`
            : skippedJoined > 0
              ? "No emails sent — those students already joined this class."
              : "No invitation emails sent."
          : data.emailsQueued
            ? "Invitation emails are being sent in the background."
            : undefined;
      toast({
        title:
          flat > 0
            ? `Added ${data.invitedCount ?? 0} students — +${flat.toLocaleString("en-IN")} RDM`
            : `Added ${data.invitedCount ?? 0} students`,
        description: [emailNote, flat > 0 ? `+${paidBonusRdm} RDM per student who subscribes within ${paidWindowDays} days.` : `Add ${minStudents}+ emails total for +${flatRdm.toLocaleString("en-IN")} RDM.`]
          .filter(Boolean)
          .join(" "),
      });
      setBulkText("");
      await loadStatus(selected.id);
    } finally {
      setSubmitting(false);
    }
  }, [bulkText, selected, loadStatus, toast]);

  const removeInvite = useCallback(
    async (email: string) => {
      if (!selected) return;
      setRemovingEmail(email);
      try {
        const res = await fetch(`/api/teacher/classroom/${selected.id}/bulk-invite/remove`, {
          method: "POST",
          credentials: "include",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ email }),
        });
        const data = (await res.json().catch(() => ({}))) as { ok?: boolean; error?: string };
        if (!res.ok || !data.ok) {
          toast({
            title: "Could not remove",
            description: data.error ?? "Try again",
            variant: "destructive",
          });
          return;
        }
        toast({ title: "Removed", description: "You can add this email again to resend." });
        if (sentEmail === email) setSentEmail(null);
        await loadStatus(selected.id);
      } finally {
        setRemovingEmail(null);
      }
    },
    [selected, loadStatus, toast, sentEmail],
  );

  const resendInvite = useCallback(
    async (email: string) => {
      if (!selected) return;
      setResendingEmail(email);
      setSentEmail(null);
      if (sentTimerRef.current) clearTimeout(sentTimerRef.current);
      try {
        const res = await fetch(`/api/teacher/classroom/${selected.id}/bulk-invite/resend`, {
          method: "POST",
          credentials: "include",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ email }),
        });
        const data = (await res.json().catch(() => ({}))) as { ok?: boolean; error?: string };
        if (!res.ok || !data.ok) {
          toast({
            title: "Could not resend",
            description: data.error ?? "Try again",
            variant: "destructive",
          });
          return;
        }
        setSentEmail(email);
        sentTimerRef.current = setTimeout(() => {
          setSentEmail((current) => (current === email ? null : current));
        }, RESEND_SENT_MS);
        toast({
          title: "Invitation sent",
          description: `Email resent to ${email}. Ask them to check inbox and spam.`,
        });
      } finally {
        setResendingEmail(null);
      }
    },
    [selected, toast],
  );

  const copyJoinLink = useCallback(() => {
    if (!joinLink) return;
    void navigator.clipboard.writeText(joinLink);
    toast({ title: "Join link copied" });
  }, [joinLink, toast]);

  const invited = status?.invitedCount ?? 0;
  const joined = status?.joinedCount ?? 0;
  const subscribed = status?.subscribedCount ?? 0;
  const rdmEarned = status?.rdmEarned ?? 0;
  const canSubmit = bulkText.trim().length > 0 && !submitting;

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="w-[96vw] max-w-lg max-h-[90vh] overflow-y-auto rounded-2xl border border-white/15 bg-[#12162a] p-0 text-slate-100">
        <DialogHeader className="border-b border-white/10 px-5 py-4">
          <DialogTitle className="font-serif text-xl sm:text-2xl">Invite your class</DialogTitle>
          <p className="text-sm text-slate-400">
            Add your class roster for rewards and tracking. New students receive an invitation email
            with your join link (already-joined students are skipped). {minStudents}+ students →
            +{flatRdm.toLocaleString("en-IN")} RDM; +{paidBonusRdm} each who subscribes within{" "}
            {paidWindowDays} days.
          </p>
        </DialogHeader>

        {!selected ? (
          <div className="px-5 py-6 text-sm text-slate-300">
            Create a classroom first, then come back here.
          </div>
        ) : (
          <div className="space-y-4 px-5 py-4">
            <div>
              <label className="mb-1 block text-xs font-medium text-slate-400">Classroom</label>
              {classrooms.length > 1 ? (
                <ClassroomPicker
                  classrooms={classrooms}
                  classroomId={classroomId}
                  onChange={setClassroomId}
                />
              ) : (
                <p className="text-sm font-semibold text-white">{selected.name}</p>
              )}
            </div>

            <div className="rounded-lg border border-white/10 bg-black/20 px-3 py-2.5 text-xs text-slate-300">
              {statusLoading ? (
                <span className="inline-flex items-center gap-1.5">
                  <Loader2 className="h-3 w-3 animate-spin" /> Loading…
                </span>
              ) : (
                <>
                  <span className="font-semibold text-white">{invited}</span> invited ·{" "}
                  <span className="font-semibold text-emerald-300">{joined}</span> joined ·{" "}
                  <span className="font-semibold text-amber-300">{subscribed}</span> subscribed ·{" "}
                  <span className="font-semibold text-violet-200">
                    {rdmEarned.toLocaleString("en-IN")}
                  </span>{" "}
                  RDM earned
                  {invited < minStudents ? (
                    <span className="mt-1 block text-slate-500">
                      {minStudents - invited} more emails to unlock +{flatRdm.toLocaleString("en-IN")}{" "}
                      RDM
                    </span>
                  ) : null}
                </>
              )}
            </div>

            <div>
              <label className="mb-1.5 block text-sm font-semibold">Student emails</label>
              <Textarea
                value={bulkText}
                onChange={(e) => setBulkText(e.target.value)}
                placeholder="student1@school.com, student2@school.com — or one per line"
                className="min-h-[88px] rounded-lg text-sm"
                disabled={submitting}
              />
              <Button
                type="button"
                className="mt-2 w-full rounded-lg"
                disabled={!canSubmit}
                onClick={() => void submitBulkInvite()}
              >
                {submitting ? (
                  <>
                    <Loader2 className="mr-2 h-4 w-4 animate-spin" /> Adding…
                  </>
                ) : (
                  "Add students"
                )}
              </Button>
            </div>

            <div>
              <label className="mb-1.5 block text-sm font-semibold">Join link</label>
              <div className="flex gap-2">
                <Input readOnly value={joinLink} className="rounded-lg text-xs" />
                <Button
                  type="button"
                  variant="outline"
                  size="sm"
                  className="shrink-0 rounded-lg border-white/15"
                  onClick={copyJoinLink}
                >
                  <Copy className="h-3.5 w-3.5" />
                </Button>
              </div>
              <p className="mt-1.5 text-xs text-slate-500">
                Also sent in the invitation email. Students must sign up with the same email you added
                above.
              </p>
            </div>

            {status && status.recipients.length > 0 ? (
              <div>
                <label className="mb-1.5 block text-sm font-semibold">Who joined</label>
                <ul className="max-h-40 space-y-1 overflow-y-auto rounded-lg border border-white/10 bg-black/20 p-2">
                  {status.recipients.map((r) => {
                    const isSending = resendingEmail === r.email;
                    const isRemoving = removingEmail === r.email;
                    const justSent = sentEmail === r.email;
                    const rowBusy = isSending || isRemoving;

                    return (
                    <li
                      key={r.email}
                      className={cn(
                        "flex items-center justify-between gap-2 rounded px-1 py-1 text-xs transition-colors",
                        justSent && "bg-emerald-500/10",
                      )}
                    >
                      <span className="min-w-0 truncate text-slate-300">{r.email}</span>
                      <div className="flex shrink-0 items-center gap-1.5">
                        {r.subscribed ? (
                          <span className="inline-flex items-center gap-0.5 text-amber-300">
                            <Sparkles className="h-3 w-3" /> Subscribed
                          </span>
                        ) : r.joined ? (
                          <span className="inline-flex items-center gap-0.5 text-emerald-300">
                            <CheckCircle2 className="h-3 w-3" /> Joined
                          </span>
                        ) : (
                          <>
                            <AnimatePresence mode="wait">
                              {justSent ? (
                                <motion.span
                                  key="sent"
                                  initial={{ opacity: 0, scale: 0.85, x: 6 }}
                                  animate={{ opacity: 1, scale: 1, x: 0 }}
                                  exit={{ opacity: 0, scale: 0.95 }}
                                  transition={{ type: "spring", stiffness: 420, damping: 26 }}
                                  className="inline-flex items-center gap-1 rounded-full bg-emerald-500/20 px-2 py-0.5 text-[10px] font-bold text-emerald-300"
                                >
                                  <Mail className="h-3 w-3" />
                                  Sent!
                                </motion.span>
                              ) : isSending ? (
                                <motion.span
                                  key="sending"
                                  initial={{ opacity: 0 }}
                                  animate={{ opacity: 1 }}
                                  exit={{ opacity: 0 }}
                                  className="inline-flex items-center gap-1 rounded-full bg-violet-500/15 px-2 py-0.5 text-[10px] font-semibold text-violet-200"
                                >
                                  <Loader2 className="h-3 w-3 animate-spin" />
                                  Sending…
                                </motion.span>
                              ) : (
                                <motion.span
                                  key="invited"
                                  initial={{ opacity: 0 }}
                                  animate={{ opacity: 1 }}
                                  exit={{ opacity: 0 }}
                                  className="text-slate-500"
                                >
                                  Invited
                                </motion.span>
                              )}
                            </AnimatePresence>
                            {!justSent && !isSending ? (
                              <>
                                <button
                                  type="button"
                                  disabled={rowBusy}
                                  className="inline-flex items-center gap-0.5 rounded px-1.5 py-0.5 text-[10px] font-semibold text-violet-300 transition-colors hover:bg-violet-500/15 disabled:opacity-40"
                                  onClick={() => void resendInvite(r.email)}
                                >
                                  <Mail className="h-3 w-3" />
                                  Resend
                                </button>
                                <button
                                  type="button"
                                  disabled={rowBusy}
                                  className="rounded px-1.5 py-0.5 text-[10px] font-semibold text-red-300 transition-colors hover:bg-red-500/10 disabled:opacity-40"
                                  onClick={() => void removeInvite(r.email)}
                                >
                                  {isRemoving ? (
                                    <span className="inline-flex items-center gap-0.5">
                                      <Loader2 className="h-3 w-3 animate-spin" />
                                      Removing…
                                    </span>
                                  ) : (
                                    "Remove"
                                  )}
                                </button>
                              </>
                            ) : null}
                          </>
                        )}
                      </div>
                    </li>
                    );
                  })}
                </ul>
              </div>
            ) : null}
          </div>
        )}
      </DialogContent>
    </Dialog>
  );
}
