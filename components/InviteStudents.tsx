import { useCallback, useMemo, useState } from "react";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import { useToast } from "@/hooks/use-toast";
import { Copy, Loader2, Link2, Users } from "lucide-react";
import { parseBulkInviteEmails } from "@/lib/classroom/parseBulkInviteEmails";
import { DEFAULT_RDM_CONFIG } from "@/lib/rdm/rdmConfig";

interface Props {
  classroomId: string;
  joinCode: string;
}

type BulkInviteResponse = {
  ok?: boolean;
  error?: string;
  invitedCount?: number;
  skipped?: number;
  flatRewardRdm?: number;
};

const InviteStudents = ({ classroomId, joinCode }: Props) => {
  const { toast } = useToast();
  const [bulkText, setBulkText] = useState("");
  const [submitting, setSubmitting] = useState(false);
  const [lastResult, setLastResult] = useState<BulkInviteResponse | null>(null);

  const minStudents = DEFAULT_RDM_CONFIG.classroom_bulk_invite_min_students;
  const flatRdm = DEFAULT_RDM_CONFIG.classroom_bulk_invite_flat_rdm;
  const paidBonusRdm = DEFAULT_RDM_CONFIG.classroom_batch_paid_bonus_rdm;
  const paidWindowDays = DEFAULT_RDM_CONFIG.classroom_batch_paid_window_days;

  const joinLink = useMemo(() => {
    if (typeof window === "undefined") return "";
    const code = (joinCode ?? "").trim();
    const u = new URL(`${window.location.origin}/join`);
    if (code) u.searchParams.set("code", code);
    return u.toString();
  }, [joinCode]);

  const submitBulkInvite = useCallback(async () => {
    const emails = parseBulkInviteEmails(bulkText);
    if (emails.length === 0) {
      toast({ title: "Add at least one valid email", variant: "destructive" });
      return;
    }

    setSubmitting(true);
    setLastResult(null);
    try {
      const res = await fetch(`/api/teacher/classroom/${classroomId}/bulk-invite`, {
        method: "POST",
        credentials: "include",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ emails }),
      });
      const data = (await res.json().catch(() => ({}))) as BulkInviteResponse & {
        invitedCount?: number;
        flatRewardRdm?: number;
        emailsSent?: number | null;
        emailsSkippedAlreadyJoined?: number | null;
        emailsQueued?: boolean;
      };

      if (!res.ok || !data.ok) {
        toast({
          title: "Bulk invite failed",
          description: data.error ?? "Try again",
          variant: "destructive",
        });
        return;
      }

      setLastResult(data);
      const flat = data.flatRewardRdm ?? 0;
      const sent = data.emailsSent;
      const skippedJoined = data.emailsSkippedAlreadyJoined ?? 0;
      const emailNote =
        sent != null
          ? sent > 0
            ? `Invitation email sent to ${sent} student${sent === 1 ? "" : "s"}.`
            : skippedJoined > 0
              ? "No emails sent — those students already joined."
              : undefined
          : data.emailsQueued
            ? "Invitation emails are being sent."
            : undefined;
      toast({
        title:
          flat > 0
            ? `Added ${data.invitedCount ?? 0} students — +${flat.toLocaleString("en-IN")} RDM!`
            : `Added ${data.invitedCount ?? 0} students`,
        description: [
          emailNote,
          flat > 0
            ? `+${paidBonusRdm} RDM per student who subscribes within ${paidWindowDays} days.`
            : `Add ${minStudents}+ new emails for +${flatRdm.toLocaleString("en-IN")} RDM flat.`,
        ]
          .filter(Boolean)
          .join(" "),
      });
      setBulkText("");
    } finally {
      setSubmitting(false);
    }
  }, [bulkText, classroomId, flatRdm, minStudents, paidBonusRdm, paidWindowDays, toast]);

  return (
    <div className="space-y-6">
      {/* Method 1: Share link */}
      <div>
        <h4 className="text-sm font-extrabold text-foreground mb-2 flex items-center gap-1.5">
          <Link2 className="w-4 h-4 text-primary" /> Share Join Link
        </h4>
        <p className="text-xs text-muted-foreground mb-2">
          Students will be asked to sign in, then they can send a join request. You approve it from
          the teacher portal.
        </p>
        <div className="flex gap-2">
          <Input readOnly value={joinLink} className="rounded-xl text-xs" />
          <Button
            variant="outline"
            className="rounded-xl gap-1"
            onClick={() => {
              navigator.clipboard.writeText(joinLink);
              toast({ title: "Link copied!" });
            }}
          >
            <Copy className="w-3.5 h-3.5" /> Copy
          </Button>
        </div>
      </div>

      {/* Method 2: Join code */}
      <div>
        <h4 className="text-sm font-extrabold text-foreground mb-2">Join Code</h4>
        <button
          type="button"
          onClick={() => {
            navigator.clipboard.writeText(joinCode);
            toast({ title: "Code copied!" });
          }}
          className="bg-muted/50 px-4 py-2.5 rounded-xl font-mono text-lg font-extrabold tracking-widest text-foreground flex items-center gap-2 hover:bg-muted transition-colors"
        >
          <Copy className="w-4 h-4 text-muted-foreground" /> {joinCode}
        </button>
      </div>

      {/* Method 3: Bulk email invite */}
      <div>
        <h4 className="text-sm font-extrabold text-foreground mb-2 flex items-center gap-1.5">
          <Users className="w-4 h-4 text-primary" /> Bulk invite (email list)
        </h4>
        <p className="text-xs text-muted-foreground mb-2">
          Paste student emails in one batch. New students get an invitation email with your join link
          (already-joined students are skipped). First {minStudents}+ new invites earn +
          {flatRdm.toLocaleString("en-IN")} RDM flat; +{paidBonusRdm} RDM per student who subscribes
          within {paidWindowDays} days.
        </p>
        <Textarea
          value={bulkText}
          onChange={(e) => setBulkText(e.target.value)}
          placeholder={"student1@school.com, student2@school.com\nOr one email per line"}
          className="min-h-[100px] rounded-xl text-xs font-mono"
          disabled={submitting}
        />
        <Button
          type="button"
          className="mt-2 rounded-xl"
          disabled={submitting || !bulkText.trim()}
          onClick={() => void submitBulkInvite()}
        >
          {submitting ? (
            <>
              <Loader2 className="mr-2 h-4 w-4 animate-spin" />
              Adding…
            </>
          ) : (
            "Add students"
          )}
        </Button>
        {lastResult?.ok ? (
          <p className="mt-2 text-xs text-emerald-600 dark:text-emerald-400">
            Imported {lastResult.invitedCount ?? 0} new emails
            {(lastResult.skipped ?? 0) > 0 ? ` (${lastResult.skipped} skipped as duplicates/invalid)` : ""}
            {(lastResult.flatRewardRdm ?? 0) > 0
              ? ` — +${(lastResult.flatRewardRdm ?? 0).toLocaleString("en-IN")} RDM earned`
              : ""}
            .
          </p>
        ) : null}
      </div>
    </div>
  );
};

export default InviteStudents;
