"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import { Check, Copy, Loader2, Mail, MessageSquareShare, Trash2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { cn } from "@/lib/utils";
import { useToast } from "@/hooks/use-toast";
import {
  buildBuddyInviteMailto,
  buildBuddyInviteShareText,
  buildWaShareUrl,
  createBuddyInvite,
  isBuddyInviteEmail,
  revokeBuddyInvite,
  type BuddyPendingInvite,
} from "@/lib/buddy/buddyClient";

type LearningBuddyEmptyStateProps = {
  pendingInvites: BuddyPendingInvite[];
  onChange: () => void;
  className?: string;
};

function formatRelative(iso: string): string {
  const ts = Date.parse(iso);
  if (Number.isNaN(ts)) return "";
  const diff = Date.now() - ts;
  const minutes = Math.round(diff / 60_000);
  if (minutes < 1) return "just now";
  if (minutes < 60) return `${minutes}m ago`;
  const hours = Math.round(minutes / 60);
  if (hours < 24) return `${hours}h ago`;
  const days = Math.round(hours / 24);
  return `${days}d ago`;
}

export function LearningBuddyEmptyState({
  pendingInvites,
  onChange,
  className,
}: LearningBuddyEmptyStateProps) {
  const { toast } = useToast();
  const [email, setEmail] = useState("");
  const [shareUrl, setShareUrl] = useState<string>("");
  const [shareText, setShareText] = useState<string>("");
  const [creating, setCreating] = useState(false);
  const [copied, setCopied] = useState(false);
  const [revoking, setRevoking] = useState<string | null>(null);

  const emailValid = isBuddyInviteEmail(email);

  const ensureInvite = useCallback(async (): Promise<{ shareUrl: string; shareText: string } | null> => {
    if (shareUrl && shareText) return { shareUrl, shareText };
    setCreating(true);
    try {
      const result = await createBuddyInvite();
      setShareUrl(result.shareUrl);
      setShareText(result.waText);
      onChange();
      return { shareUrl: result.shareUrl, shareText: result.waText };
    } catch (error) {
      const message =
        error instanceof Error ? error.message : "Couldn't create your buddy link.";
      toast({ title: "Couldn't generate link", description: message, variant: "destructive" });
      return null;
    } finally {
      setCreating(false);
    }
  }, [onChange, shareText, shareUrl, toast]);

  useEffect(() => {
    if (pendingInvites.length === 0) return;
    if (shareUrl) return;
    const latest = pendingInvites[0];
    if (typeof window !== "undefined") {
      const origin = window.location.origin;
      const url = `${origin}/buddy-join/${latest.token}`;
      setShareUrl(url);
      setShareText(buildBuddyInviteShareText(url));
    }
  }, [pendingInvites, shareUrl]);

  const handleSendEmail = async () => {
    if (!emailValid) {
      toast({
        title: "Enter a valid email",
        description: "Add your buddy's email address to send the invite.",
        variant: "destructive",
      });
      return;
    }
    const invite = await ensureInvite();
    if (!invite) return;
    const mailto = buildBuddyInviteMailto(email, invite.shareText);
    if (typeof window !== "undefined") {
      window.location.href = mailto;
    }
  };

  const handleWhatsApp = async () => {
    const invite = await ensureInvite();
    if (!invite) return;
    const target = buildWaShareUrl("", invite.shareText);
    if (typeof window !== "undefined") {
      window.open(target, "_blank", "noopener,noreferrer");
    }
  };

  const handleCopy = async () => {
    const invite = await ensureInvite();
    if (!invite) return;
    try {
      await navigator.clipboard.writeText(invite.shareUrl);
      setCopied(true);
      toast({ title: "Buddy link copied" });
      setTimeout(() => setCopied(false), 1500);
    } catch {
      toast({
        title: "Couldn't copy",
        description: "Long-press the link to copy manually.",
        variant: "destructive",
      });
    }
  };

  const handleRevoke = async (token: string) => {
    setRevoking(token);
    try {
      await revokeBuddyInvite(token);
      toast({ title: "Invite revoked" });
      onChange();
    } catch (error) {
      const message = error instanceof Error ? error.message : "Couldn't revoke this invite.";
      toast({ title: "Revoke failed", description: message, variant: "destructive" });
    } finally {
      setRevoking(null);
    }
  };

  const pendingList = useMemo(
    () => pendingInvites.filter((row) => row.status === "pending").slice(0, 5),
    [pendingInvites]
  );

  return (
    <div className={cn("flex flex-col gap-3", className)}>
      <div className="rounded-[10px] border border-cyan-500/25 bg-gradient-to-br from-cyan-500/[0.08] via-fuchsia-500/[0.05] to-transparent px-3.5 py-3">
        <h3 className="text-[14px] font-bold text-white leading-tight">
          Get a study buddy. Both of you grow faster.
        </h3>
        <p className="mt-1 text-[11.5px] leading-snug text-slate-400">
          Send a private invite by email, or share your buddy link another way. You&apos;ll both
          see each other&apos;s progress.
        </p>
      </div>

      <div className="rounded-[10px] border border-white/10 bg-white/[0.025] p-3 space-y-2.5">
        <div className="space-y-1">
          <label
            htmlFor="buddy-invite-email"
            className="text-[10px] font-bold uppercase tracking-[0.12em] text-slate-400"
          >
            Buddy&apos;s email address <span className="text-cyan-400 font-bold ml-1">(Coming soon)</span>
          </label>
          <Input
            id="buddy-invite-email"
            type="email"
            autoComplete="email"
            value={email}
            onChange={(e) => setEmail(e.target.value)}
            placeholder="Email invite coming soon"
            disabled
            className="h-9 rounded-lg border-white/10 bg-black/30 text-[13px] opacity-50 cursor-not-allowed"
          />
          <p className="text-[10px] text-slate-500">
            Opens your email app with the invite message ready — you send it from your inbox.
          </p>
        </div>

        <Button
          type="button"
          onClick={handleSendEmail}
          disabled
          className="h-9 w-full rounded-lg bg-cyan-500 px-3 text-[12.5px] font-bold text-cyan-950 hover:bg-cyan-400 disabled:opacity-50"
        >
          {creating ? (
            <Loader2 className="mr-1.5 h-3.5 w-3.5 animate-spin" />
          ) : (
            <Mail className="mr-1.5 h-3.5 w-3.5" />
          )}
          Send email invite (Coming soon)
        </Button>

        {shareUrl ? (
          <div className="rounded-md border border-white/10 bg-black/30 px-2.5 py-1.5 text-[11px] text-slate-300 break-all">
            {shareUrl}
          </div>
        ) : null}

        <div className="flex items-center gap-2 py-0.5">
          <span className="h-px flex-1 bg-white/10" />
          <span className="text-[10px] font-semibold uppercase tracking-[0.1em] text-slate-500">
            Or share another way
          </span>
          <span className="h-px flex-1 bg-white/10" />
        </div>

        <div className="flex flex-col gap-2 sm:flex-row">
          <Button
            type="button"
            variant="outline"
            onClick={handleCopy}
            disabled={creating}
            className="h-9 flex-1 rounded-lg border-white/15 bg-white/[0.04] px-3 text-[12.5px] font-semibold text-slate-200 hover:bg-white/[0.08]"
          >
            {copied ? (
              <Check className="mr-1.5 h-3.5 w-3.5 text-emerald-400" />
            ) : (
              <Copy className="mr-1.5 h-3.5 w-3.5" />
            )}
            {copied ? "Copied" : "Copy link"}
          </Button>
          <Button
            type="button"
            variant="outline"
            onClick={handleWhatsApp}
            disabled={creating}
            className="h-9 flex-1 rounded-lg border-emerald-500/35 bg-emerald-500/[0.08] px-3 text-[12.5px] font-semibold text-emerald-100 hover:bg-emerald-500/15"
          >
            {creating ? (
              <Loader2 className="mr-1.5 h-3.5 w-3.5 animate-spin" />
            ) : (
              <MessageSquareShare className="mr-1.5 h-3.5 w-3.5" />
            )}
            WhatsApp
          </Button>
        </div>

        <p className="text-[11px] leading-snug text-amber-300/80">
          If they&apos;re new to EduBlast, you also earn referral RDM after they finish onboarding.
        </p>
      </div>

      {pendingList.length > 0 ? (
        <div className="rounded-[10px] border border-white/10 bg-white/[0.02] px-3 py-2.5">
          <p className="mb-1.5 flex items-center gap-2 text-[10px] font-bold uppercase tracking-[0.12em] text-slate-400">
            <span>Pending invites</span>
            <span className="h-px flex-1 bg-gradient-to-r from-white/15 to-transparent" />
          </p>
          <ul className="space-y-1.5">
            {pendingList.map((row) => (
              <li
                key={row.token}
                className="flex items-center justify-between gap-2 rounded-md border border-white/[0.06] bg-black/20 px-2.5 py-1.5"
              >
                <div className="min-w-0 flex-1">
                  <p className="truncate text-[12px] font-mono text-slate-200">
                    {row.token.slice(0, 6)}…{row.token.slice(-4)}
                  </p>
                  <p className="text-[10px] text-slate-500">
                    Created {formatRelative(row.createdAt)} · expires{" "}
                    {new Date(row.expiresAt).toLocaleDateString()}
                  </p>
                </div>
                <Button
                  type="button"
                  variant="ghost"
                  size="sm"
                  onClick={() => void handleRevoke(row.token)}
                  disabled={revoking === row.token}
                  className="h-7 rounded-md px-2 text-[11px] font-semibold text-rose-300 hover:bg-rose-500/15 hover:text-rose-200"
                >
                  {revoking === row.token ? (
                    <Loader2 className="h-3.5 w-3.5 animate-spin" />
                  ) : (
                    <Trash2 className="h-3.5 w-3.5" />
                  )}
                  <span className="ml-1 hidden sm:inline">Revoke</span>
                </Button>
              </li>
            ))}
          </ul>
        </div>
      ) : null}
    </div>
  );
}
