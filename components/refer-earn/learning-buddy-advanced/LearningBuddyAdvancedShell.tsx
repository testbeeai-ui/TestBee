"use client";

import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import Link from "next/link";
import {
  ArrowLeft,
  Copy,
  Flame,
  Loader2,
  Plus,
  Search,
  Shield,
  Sparkles,
  Trash2,
  UserPlus,
  Users,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { cn } from "@/lib/utils";
import { useToast } from "@/hooks/use-toast";
import { useAuth } from "@/hooks/useAuth";
import { LEARNING_BUDDY_REFER_TAB_URL } from "@/lib/buddy/learningBuddyRoutes";
import {
  fetchBuddyState,
  revokeBuddyInvite,
  withBuddyRdm,
  type BuddyPendingInvite,
  type BuddyProfile,
} from "@/lib/buddy/buddyClient";
import { maybeMarkEarnBuddyOnboardingFromBuddyActivation } from "@/lib/subscription/freeTrialClient";
import { markEarnBuddyCompanionLinkCopied } from "@/lib/onboarding/earnBuddyCompanionOnboarding";
import { BuddyDetailPanel } from "@/components/refer-earn/learning-buddy-advanced/BuddyDetailPanel";
import { PrivacySettingsModal } from "@/components/refer-earn/learning-buddy-advanced/PrivacySettingsModal";
import { AddBuddyModal } from "@/components/refer-earn/learning-buddy-advanced/AddBuddyModal";
import {
  BUDDY_AVA_GRADIENTS,
  lbAdvancedMesh,
  lbAdvancedRoster,
  lbAdvancedShell,
  lbAdvancedTopbar,
} from "@/components/refer-earn/learning-buddy-advanced/learningBuddyAdvancedStyles";

function buddyInitial(name: string | null): string {
  if (!name?.trim()) return "?";
  const parts = name.trim().split(/\s+/);
  if (parts.length >= 2) return (parts[0]![0]! + parts[1]![0]!).toUpperCase();
  return parts[0]!.charAt(0).toUpperCase();
}

function avaStyleForIndex(i: number): string {
  return BUDDY_AVA_GRADIENTS[i % BUDDY_AVA_GRADIENTS.length]!;
}

type LearningBuddyAdvancedShellProps = {
  className?: string;
};

function selectedBuddyStorageKey(userId: string): string {
  return `lb_advanced_selected_${userId}`;
}

export function LearningBuddyAdvancedShell({ className }: LearningBuddyAdvancedShellProps) {
  const { toast } = useToast();
  const { user } = useAuth();
  const [loading, setLoading] = useState(true);
  const [buddies, setBuddies] = useState<BuddyProfile[]>([]);
  const [pendingInvites, setPendingInvites] = useState<BuddyPendingInvite[]>([]);
  const [maxBuddies, setMaxBuddies] = useState(0);
  const [buddiesLimit, setBuddiesLimit] = useState(0);
  const [buddiesUnlimited, setBuddiesUnlimited] = useState(false);
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const [search, setSearch] = useState("");
  const [privacyOpen, setPrivacyOpen] = useState(false);
  const [addOpen, setAddOpen] = useState(false);
  const [revoking, setRevoking] = useState<string | null>(null);
  const loadGenRef = useRef(0);

  const loadState = useCallback(async () => {
    const gen = ++loadGenRef.current;
    const loadForUserId = user?.id ?? null;
    setLoading(true);
    try {
      const res = await fetchBuddyState();
      if (gen !== loadGenRef.current || loadForUserId !== user?.id) return;
      const joined = Boolean(res.hasInvitedBuddyJoined ?? res.hasBuddyInviteActivated);
      maybeMarkEarnBuddyOnboardingFromBuddyActivation(joined);
      const list = res.buddies.map(withBuddyRdm);
      setBuddies(list);
      setPendingInvites(res.pendingInvites);
      setMaxBuddies(res.maxBuddies);
      setBuddiesLimit(typeof res.buddiesLimit === "number" ? res.buddiesLimit : res.maxBuddies);
      setBuddiesUnlimited(Boolean(res.buddiesUnlimited));
      const userId = user?.id;
      let stored: string | null = null;
      if (userId && typeof window !== "undefined") {
        try {
          stored = sessionStorage.getItem(selectedBuddyStorageKey(userId));
        } catch {
          stored = null;
        }
      }
      setSelectedId((prev) => {
        const candidate = stored ?? prev;
        if (candidate && list.some((b) => b.id === candidate)) return candidate;
        return list[0]?.id ?? null;
      });
    } catch (err) {
      if (gen !== loadGenRef.current) return;
      toast({
        title: "Couldn't load buddies",
        description: err instanceof Error ? err.message : "Try again",
        variant: "destructive",
      });
    } finally {
      if (gen === loadGenRef.current) setLoading(false);
    }
  }, [toast, user?.id]);

  useEffect(() => {
    loadGenRef.current += 1;
    if (!user?.id) {
      setBuddies([]);
      setPendingInvites([]);
      setSelectedId(null);
      setLoading(false);
      return;
    }
    setBuddies([]);
    setPendingInvites([]);
    setSelectedId(null);
    void loadState();
  }, [loadState, user?.id]);

  useEffect(() => {
    if (!user?.id || !selectedId) return;
    try {
      sessionStorage.setItem(selectedBuddyStorageKey(user.id), selectedId);
    } catch {
      /* ignore */
    }
  }, [user?.id, selectedId]);

  const filteredBuddies = useMemo(() => {
    const q = search.trim().toLowerCase();
    if (!q) return buddies;
    return buddies.filter((b) => (b.name ?? "").toLowerCase().includes(q));
  }, [buddies, search]);

  const selectedBuddy = useMemo(
    () => buddies.find((b) => b.id === selectedId) ?? null,
    [buddies, selectedId]
  );

  const pendingList = useMemo(
    () => pendingInvites.filter((r) => r.status === "pending").slice(0, 5),
    [pendingInvites]
  );

  const handleUnbuddy = () => {
    void loadState();
  };

  const handleRevokeInvite = async (token: string) => {
    setRevoking(token);
    try {
      await revokeBuddyInvite(token);
      toast({ title: "Invite revoked" });
      await loadState();
    } catch (err) {
      toast({
        title: "Revoke failed",
        description: err instanceof Error ? err.message : "Try again",
        variant: "destructive",
      });
    } finally {
      setRevoking(null);
    }
  };

  const copyPendingLink = (token: string) => {
    const url =
      typeof window !== "undefined"
        ? `${window.location.origin}/buddy-join/${token}`
        : `/buddy-join/${token}`;
    void navigator.clipboard.writeText(url).then(
      () => {
        toast({ title: "Link copied" });
        markEarnBuddyCompanionLinkCopied();
      },
      () =>
        toast({
          title: "Couldn't copy",
          variant: "destructive",
        })
    );
  };

  return (
    <div className={cn(lbAdvancedShell, className)}>
      <div className={lbAdvancedMesh} aria-hidden />
      <div className={lbAdvancedTopbar}>
        <Button
          type="button"
          variant="ghost"
          size="icon"
          asChild
          aria-label="Back to Learning Buddy"
          className="h-9 w-9 shrink-0 rounded-full border border-white/10 bg-white/[0.04] text-slate-300 hover:border-violet-400/40 hover:bg-violet-500/10 hover:text-violet-100"
        >
          <Link href={LEARNING_BUDDY_REFER_TAB_URL}>
            <ArrowLeft className="h-4 w-4" />
          </Link>
        </Button>

        <span className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl bg-gradient-to-br from-violet-500/50 via-fuchsia-500/35 to-cyan-400/30 shadow-lg shadow-violet-900/30 ring-1 ring-white/15">
          <Sparkles className="h-5 w-5 text-violet-50" />
        </span>
        <div className="min-w-0 flex-1">
          <p className="bg-gradient-to-r from-violet-100 via-fuchsia-100 to-cyan-100 bg-clip-text text-base font-semibold text-transparent sm:text-[17px]">
            Learning buddy
          </p>
          <p className="text-[11px] font-medium tracking-[0.12em] text-violet-300/80 uppercase">
            Advanced · study together
          </p>
        </div>

        <div className="ml-auto flex flex-wrap items-center gap-2">
          <Button
            type="button"
            variant="outline"
            size="sm"
            className="h-8 rounded-full border-white/12 bg-white/[0.04] text-xs text-slate-300 hover:border-violet-400/35 hover:bg-violet-500/10"
            onClick={() => setPrivacyOpen(true)}
          >
            <Shield className="mr-1 h-3.5 w-3.5 text-violet-300" />
            <span className="hidden sm:inline">My sharing settings</span>
            <span className="sm:hidden">Privacy</span>
          </Button>
          <Button
            type="button"
            size="sm"
            className="h-8 rounded-full bg-gradient-to-r from-violet-600 to-fuchsia-600 text-xs font-semibold text-white shadow-md shadow-violet-900/40 hover:from-violet-500 hover:to-fuchsia-500"
            onClick={() => setAddOpen(true)}
          >
            <Plus className="mr-1 h-3.5 w-3.5" />
            Add buddy
          </Button>
        </div>
      </div>

      <div className="relative z-10 grid min-h-[min(72vh,680px)] grid-cols-1 md:grid-cols-[252px_minmax(0,1fr)]">
        <aside className={lbAdvancedRoster}>
          <div className="flex items-center justify-between border-b border-white/[0.06] px-3.5 py-3">
            <span className="text-[10px] font-bold uppercase tracking-[0.14em] text-slate-500">
              My buddies
            </span>
            <span className="rounded-full bg-violet-500/15 px-2.5 py-0.5 text-[11px] font-semibold text-violet-200 ring-1 ring-violet-400/25">
              {buddies.length} active
            </span>
          </div>

          <div className="border-b border-white/[0.06] px-3 py-2.5">
            <div className="relative">
              <Search className="pointer-events-none absolute left-3 top-1/2 h-3.5 w-3.5 -translate-y-1/2 text-slate-500" />
              <Input
                value={search}
                onChange={(e) => setSearch(e.target.value)}
                placeholder="Search buddies…"
                className="h-9 rounded-lg border-white/10 bg-black/25 pl-9 text-xs text-slate-100 placeholder:text-slate-500 focus-visible:ring-violet-500/40"
              />
            </div>
          </div>

          <div className="min-h-0 flex-1 space-y-1 overflow-y-auto px-2 py-2">
            {loading ? (
              <div className="flex items-center justify-center py-12">
                <Loader2 className="h-6 w-6 animate-spin text-violet-400" />
              </div>
            ) : filteredBuddies.length === 0 ? (
              <p className="rounded-lg border border-dashed border-white/10 bg-white/[0.02] px-3 py-8 text-center text-xs leading-relaxed text-slate-500">
                {buddies.length === 0
                  ? "No buddies yet — invite someone below."
                  : "No buddies match your search."}
              </p>
            ) : (
              filteredBuddies.map((buddy, idx) => {
                const active = buddy.id === selectedId;
                const b = withBuddyRdm(buddy);
                return (
                  <button
                    key={buddy.id}
                    type="button"
                    onClick={() => setSelectedId(buddy.id)}
                    className={cn(
                      "flex w-full items-center gap-2.5 rounded-xl border px-2.5 py-2.5 text-left transition-all duration-200",
                      active
                        ? "border-violet-400/40 bg-gradient-to-r from-violet-500/15 via-fuchsia-500/10 to-transparent shadow-[inset_0_1px_0_rgba(255,255,255,0.06)] ring-1 ring-violet-400/20"
                        : "border-transparent bg-white/[0.02] hover:border-white/10 hover:bg-white/[0.05]"
                    )}
                  >
                    <span
                      className={cn(
                        "relative flex h-10 w-10 shrink-0 items-center justify-center rounded-full text-[13px] font-semibold shadow-inner",
                        avaStyleForIndex(idx)
                      )}
                    >
                      {buddyInitial(b.name)}
                    </span>
                    <div className="min-w-0 flex-1">
                      <p
                        className={cn(
                          "truncate text-xs",
                          active ? "font-semibold text-white" : "font-medium text-slate-300"
                        )}
                      >
                        {b.name ?? "Study buddy"}
                      </p>
                      <p className="mt-0.5 flex items-center gap-1 truncate text-[11px] text-slate-500">
                        {b.classLevel ? (
                          <>
                            <Flame className="h-3 w-3 shrink-0 text-emerald-400" />
                            Class {b.classLevel}
                          </>
                        ) : (
                          "Study buddy"
                        )}
                      </p>
                    </div>
                    <span className="shrink-0 rounded-full bg-violet-500/20 px-2 py-0.5 text-[10px] font-semibold text-violet-200 ring-1 ring-violet-400/20">
                      {b.rdm.toLocaleString("en-IN")}
                    </span>
                  </button>
                );
              })
            )}

            {pendingList.length > 0 ? (
              <div className="mt-2 space-y-1.5 px-0.5">
                <p className="px-1 text-[10px] font-bold uppercase tracking-[0.12em] text-amber-500/80">
                  Pending invites
                </p>
                {pendingList.map((inv) => (
                  <div
                    key={inv.id}
                    className="flex items-center gap-2 rounded-xl border border-amber-500/20 bg-gradient-to-r from-amber-500/10 to-transparent px-2.5 py-2"
                  >
                    <span className="flex h-9 w-9 shrink-0 items-center justify-center rounded-full bg-amber-500/20 ring-1 ring-amber-400/30">
                      <UserPlus className="h-4 w-4 text-amber-300" />
                    </span>
                    <div className="min-w-0 flex-1">
                      <p className="truncate text-xs font-medium text-slate-200">Invite sent</p>
                      <span className="mt-0.5 inline-block rounded-full bg-amber-500/15 px-1.5 py-0.5 text-[10px] font-medium text-amber-200">
                        Awaiting accept
                      </span>
                    </div>
                    <div className="flex shrink-0 gap-0.5">
                      <Button
                        type="button"
                        variant="ghost"
                        size="icon"
                        className="h-7 w-7 text-slate-400 hover:text-violet-200"
                        aria-label="Copy invite link"
                        onClick={() => copyPendingLink(inv.token)}
                      >
                        <Copy className="h-3.5 w-3.5" />
                      </Button>
                      <Button
                        type="button"
                        variant="ghost"
                        size="icon"
                        className="h-7 w-7 text-slate-400 hover:text-rose-300"
                        aria-label="Revoke invite"
                        disabled={revoking === inv.token}
                        onClick={() => void handleRevokeInvite(inv.token)}
                      >
                        {revoking === inv.token ? (
                          <Loader2 className="h-3.5 w-3.5 animate-spin" />
                        ) : (
                          <Trash2 className="h-3.5 w-3.5" />
                        )}
                      </Button>
                    </div>
                  </div>
                ))}
              </div>
            ) : null}
          </div>

          <div className="mt-auto border-t border-white/[0.06] p-3">
            <Button
              type="button"
              size="sm"
              className="h-10 w-full rounded-xl bg-gradient-to-r from-violet-600 to-fuchsia-600 text-xs font-semibold text-white shadow-lg shadow-violet-950/50 hover:from-violet-500 hover:to-fuchsia-500"
              onClick={() => setAddOpen(true)}
            >
              <UserPlus className="mr-1.5 h-4 w-4" />
              Invite a buddy
            </Button>
            <p className="mt-1.5 text-center text-[10px] text-slate-500">Link · WhatsApp</p>
          </div>
        </aside>

        <section className="relative flex min-h-[320px] min-w-0 flex-col">
          <div
            className="pointer-events-none absolute inset-0 bg-[radial-gradient(ellipse_70%_50%_at_80%_20%,rgba(127,119,221,0.08),transparent)]"
            aria-hidden
          />
          {selectedBuddy ? (
            <BuddyDetailPanel
              key={selectedBuddy.id}
              buddy={selectedBuddy}
              onUnbuddy={handleUnbuddy}
            />
          ) : (
            <div className="relative flex flex-1 flex-col items-center justify-center px-6 py-14 text-center">
              <span className="mb-4 flex h-16 w-16 items-center justify-center rounded-2xl bg-gradient-to-br from-violet-500/25 to-fuchsia-500/15 ring-1 ring-violet-400/25">
                <Users className="h-8 w-8 text-violet-300/70" />
              </span>
              <p className="text-base font-semibold text-slate-100">
                {loading ? "Loading buddies…" : "Select a buddy"}
              </p>
              <p className="mt-2 max-w-sm text-sm leading-relaxed text-slate-500">
                {buddies.length === 0
                  ? "Add a learning buddy to see streaks, mocks, Gyan++, Play Arena, and more — live."
                  : "Pick someone from the roster to open their activity dashboard."}
              </p>
              {buddies.length === 0 && !loading ? (
                <Button
                  type="button"
                  className="mt-6 rounded-full bg-gradient-to-r from-violet-600 to-fuchsia-600 px-6 font-semibold text-white shadow-lg shadow-violet-900/40 hover:from-violet-500 hover:to-fuchsia-500"
                  onClick={() => setAddOpen(true)}
                >
                  <Plus className="mr-1.5 h-4 w-4" />
                  Add your first buddy
                </Button>
              ) : null}
            </div>
          )}
        </section>
      </div>

      <PrivacySettingsModal open={privacyOpen} onOpenChange={setPrivacyOpen} />
      <AddBuddyModal
        open={addOpen}
        onOpenChange={setAddOpen}
        activeBuddyCount={buddies.length}
        maxBuddies={maxBuddies}
        buddiesLimit={buddiesLimit}
        buddiesUnlimited={buddiesUnlimited}
        pendingInvites={pendingInvites}
        onInviteCreated={() => void loadState()}
      />
    </div>
  );
}
