"use client";

import { useCallback, useEffect, useState } from "react";
import { Check, Copy, Loader2, MessageSquareShare, Shield, UserPlus } from "lucide-react";
import { Dialog, DialogContent, DialogDescription, DialogTitle } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { BUDDY_MAX_ACTIVE } from "@/lib/buddy/buddyPrivacy";
import {
  buildBuddyInviteShareText,
  buildWaShareUrl,
  createBuddyInvite,
  type BuddyPendingInvite,
} from "@/lib/buddy/buddyClient";
import { useToast } from "@/hooks/use-toast";
import {
  markEarnBuddyCompanionLinkCopied,
  markEarnBuddyCompanionLinkShared,
} from "@/lib/onboarding/earnBuddyCompanionOnboarding";

type AddBuddyModalProps = {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  activeBuddyCount: number;
  pendingInvites: BuddyPendingInvite[];
  onInviteCreated: () => void;
};

function buddyJoinUrl(token: string): string {
  if (typeof window === "undefined") return `/buddy-join/${token}`;
  return `${window.location.origin}/buddy-join/${token}`;
}

export function AddBuddyModal({
  open,
  onOpenChange,
  activeBuddyCount,
  pendingInvites,
  onInviteCreated,
}: AddBuddyModalProps) {
  const { toast } = useToast();
  const [shareUrl, setShareUrl] = useState("");
  const [shareText, setShareText] = useState("");
  const [inviteToken, setInviteToken] = useState("");
  const [creating, setCreating] = useState(false);
  const [copied, setCopied] = useState(false);

  const atLimit = activeBuddyCount >= BUDDY_MAX_ACTIVE;
  const latestPending = pendingInvites.find((r) => r.status === "pending");

  useEffect(() => {
    if (!open) return;
    if (shareUrl) return;
    if (!latestPending) return;
    const url = buddyJoinUrl(latestPending.token);
    setShareUrl(url);
    setInviteToken(latestPending.token);
    setShareText(buildBuddyInviteShareText(url));
  }, [open, latestPending, shareUrl]);

  const ensureInvite = useCallback(async (): Promise<{
    shareUrl: string;
    shareText: string;
    token: string;
  } | null> => {
    if (shareUrl && shareText) {
      return { shareUrl, shareText, token: inviteToken };
    }
    if (atLimit) {
      toast({
        title: "Buddy limit reached",
        description: `You can have up to ${BUDDY_MAX_ACTIVE} active buddies.`,
        variant: "destructive",
      });
      return null;
    }
    setCreating(true);
    try {
      const result = await createBuddyInvite();
      setShareUrl(result.shareUrl);
      setShareText(result.waText);
      setInviteToken(result.invite.token);
      onInviteCreated();
      return {
        shareUrl: result.shareUrl,
        shareText: result.waText,
        token: result.invite.token,
      };
    } catch (err) {
      toast({
        title: "Couldn't create invite link",
        description: err instanceof Error ? err.message : "Try again",
        variant: "destructive",
      });
      return null;
    } finally {
      setCreating(false);
    }
  }, [atLimit, inviteToken, onInviteCreated, shareText, shareUrl, toast]);

  const handleWhatsApp = async () => {
    const invite = await ensureInvite();
    if (!invite) return;
    window.open(buildWaShareUrl("", invite.shareText), "_blank", "noopener,noreferrer");
    markEarnBuddyCompanionLinkShared();
  };

  const handleCopyLink = async () => {
    const invite = await ensureInvite();
    if (!invite) return;
    try {
      await navigator.clipboard.writeText(invite.shareUrl);
      setCopied(true);
      markEarnBuddyCompanionLinkCopied();
      toast({ title: "Buddy link copied" });
      setTimeout(() => setCopied(false), 1500);
    } catch {
      toast({
        title: "Couldn't copy",
        description: "Select the link below and copy manually.",
        variant: "destructive",
      });
    }
  };

  const handleCopyCode = async () => {
    const invite = await ensureInvite();
    if (!invite?.token) return;
    try {
      await navigator.clipboard.writeText(invite.token);
      toast({ title: "Invite code copied" });
    } catch {
      toast({ title: "Couldn't copy code", variant: "destructive" });
    }
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-h-[90vh] max-w-md overflow-y-auto border-[#2A3347] bg-[#161B25] text-[#E8EAF0]">
        <DialogTitle className="flex items-center gap-2 text-base font-medium">
          <UserPlus className="h-4 w-4 text-[#AFA9EC]" />
          Add a learning buddy
        </DialogTitle>
        <DialogDescription className="text-xs leading-relaxed text-[#9BA3B8]">
          Share your private invite link or code. They must accept before you see their activity. Up
          to {BUDDY_MAX_ACTIVE} active buddies ({activeBuddyCount}/{BUDDY_MAX_ACTIVE} now).
        </DialogDescription>

        <div className="space-y-3">
          {(shareUrl || latestPending) && !creating ? (
            <div className="space-y-2 rounded-md border border-[#2A3347] bg-[#1C2333] p-2.5">
              {inviteToken || latestPending?.token ? (
                <div>
                  <p className="text-[10px] font-medium uppercase tracking-wider text-[#5C6480]">
                    Invite code
                  </p>
                  <div className="mt-1 flex items-center gap-2">
                    <code className="min-w-0 flex-1 truncate rounded bg-[#0E1117] px-2 py-1.5 font-mono text-[11px] text-[#AFA9EC]">
                      {inviteToken || latestPending?.token}
                    </code>
                    <Button
                      type="button"
                      variant="outline"
                      size="sm"
                      className="h-7 shrink-0 border-[#334060] px-2 text-[10px]"
                      onClick={() => void handleCopyCode()}
                    >
                      Copy
                    </Button>
                  </div>
                  <p className="mt-1 text-[10px] text-[#5C6480]">
                    They can paste this code on the buddy join page if the link doesn&apos;t open.
                  </p>
                </div>
              ) : null}

              {shareUrl ? (
                <div>
                  <p className="text-[10px] font-medium uppercase tracking-wider text-[#5C6480]">
                    Invite link
                  </p>
                  <p className="mt-1 break-all text-[11px] leading-snug text-[#85B7EB]">
                    {shareUrl}
                  </p>
                </div>
              ) : null}
            </div>
          ) : creating ? (
            <p className="text-center text-xs text-[#5C6480]">Creating your invite link…</p>
          ) : (
            <Button
              type="button"
              variant="outline"
              className="w-full border-[#334060] bg-transparent text-xs text-[#9BA3B8]"
              onClick={() => void ensureInvite()}
              disabled={atLimit}
            >
              Generate invite link
            </Button>
          )}

          <div className="flex items-center gap-2 py-0.5">
            <span className="h-px flex-1 bg-[#2A3347]" />
            <span className="text-[10px] font-medium uppercase tracking-wider text-[#5C6480]">
              Or share another way
            </span>
            <span className="h-px flex-1 bg-[#2A3347]" />
          </div>

          <div className="flex gap-2">
            <Button
              type="button"
              variant="outline"
              className="h-9 flex-1 border-[#334060] bg-transparent text-xs text-[#E8EAF0] hover:bg-[#1C2333]"
              onClick={() => void handleCopyLink()}
              disabled={creating || (atLimit && !shareUrl && !latestPending)}
            >
              {copied ? (
                <Check className="mr-1.5 h-3.5 w-3.5 text-[#1D9E75]" />
              ) : (
                <Copy className="mr-1.5 h-3.5 w-3.5" />
              )}
              {copied ? "Copied" : "Copy link"}
            </Button>
            <Button
              type="button"
              className="h-9 flex-1 bg-[#1D9E75] text-xs font-medium text-[#0A2A20] hover:bg-[#0F6E56]"
              onClick={() => void handleWhatsApp()}
              disabled={creating || (atLimit && !shareUrl && !latestPending)}
            >
              {creating ? (
                <Loader2 className="mr-1.5 h-3.5 w-3.5 animate-spin" />
              ) : (
                <MessageSquareShare className="mr-1.5 h-3.5 w-3.5" />
              )}
              WhatsApp
            </Button>
          </div>

          <p className="text-[10px] leading-snug text-[#FAC775]/90">
            WhatsApp opens with your invite message and link on separate lines so they can tap to
            join.
          </p>

          <div className="rounded-md border border-[#2A2560] bg-[#171425] px-3 py-2.5">
            <p className="text-[11px] font-medium text-[#AFA9EC]">
              <Shield className="mr-1 inline h-3 w-3" />
              Consent and privacy
            </p>
            <p className="mt-1 text-[11px] leading-relaxed text-[#9BA3B8]">
              They must accept your invite. Each person chooses what to share. Either of you can
              unbuddy anytime.
            </p>
          </div>
        </div>

        <Button
          type="button"
          variant="outline"
          className="w-full border-[#334060] bg-transparent text-[#9BA3B8]"
          onClick={() => onOpenChange(false)}
        >
          Done
        </Button>
      </DialogContent>
    </Dialog>
  );
}
