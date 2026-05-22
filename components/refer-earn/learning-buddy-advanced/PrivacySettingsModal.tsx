"use client";

import { useEffect, useState } from "react";
import { Shield } from "lucide-react";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogTitle,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import {
  DEFAULT_BUDDY_PRIVACY,
  type BuddyPrivacyKey,
  type BuddyPrivacySettings,
} from "@/lib/buddy/buddyPrivacy";
import {
  fetchBuddyPrivacySettings,
  updateBuddyPrivacySettings,
} from "@/lib/buddy/buddyClient";
import { useToast } from "@/hooks/use-toast";

const TOGGLE_META: { key: BuddyPrivacyKey; title: string; description: string }[] = [
  {
    key: "share_streak",
    title: "Streak and login activity",
    description: "Your daily streak count, active days, and last login time",
  },
  {
    key: "share_rdm",
    title: "RDM balance and earnings",
    description: "Your current RDM total and daily earned amount",
  },
  {
    key: "share_mocks",
    title: "Mock test scores",
    description: "Your Testbee mock results and accuracy by subject",
  },
  {
    key: "share_gyan",
    title: "Gyan++ questions and answers",
    description: "Doubts you posted and answers you gave on the wall",
  },
  {
    key: "share_subtopics",
    title: "Subtopics completed",
    description: "Which chapters and subtopics you have marked complete",
  },
  {
    key: "share_play",
    title: "Play arena scores",
    description: "DailyDose, Quant Blitz and leaderboard rank in Play",
  },
  {
    key: "share_community",
    title: "Community wall posts",
    description: "Posts you make on the Magic Wall feed",
  },
  {
    key: "share_edufund",
    title: "EduFund tier and grant progress",
    description: "Your Sprout/Scholar/Champion tier status and grant eligibility",
  },
];

type PrivacySettingsModalProps = {
  open: boolean;
  onOpenChange: (open: boolean) => void;
};

export function PrivacySettingsModal({ open, onOpenChange }: PrivacySettingsModalProps) {
  const { toast } = useToast();
  const [settings, setSettings] = useState<BuddyPrivacySettings>({ ...DEFAULT_BUDDY_PRIVACY });
  const [loading, setLoading] = useState(false);
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    if (!open) return;
    setLoading(true);
    void fetchBuddyPrivacySettings()
      .then((res) => setSettings(res.settings))
      .catch(() => {
        toast({
          title: "Could not load settings",
          variant: "destructive",
        });
      })
      .finally(() => setLoading(false));
  }, [open, toast]);

  const handleSave = async () => {
    setSaving(true);
    try {
      const res = await updateBuddyPrivacySettings(settings);
      setSettings(res.settings);
      toast({ title: "Sharing settings saved" });
      onOpenChange(false);
    } catch (err) {
      toast({
        title: "Save failed",
        description: err instanceof Error ? err.message : "Try again",
        variant: "destructive",
      });
    } finally {
      setSaving(false);
    }
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="flex max-h-[min(90vh,640px)] max-w-md flex-col gap-0 overflow-hidden border-[#2A3347] bg-[#161B25] p-0 text-[#E8EAF0] sm:rounded-xl">
        <div className="shrink-0 space-y-1.5 px-5 pb-3 pt-5 pr-12">
          <DialogTitle className="flex items-center gap-2 text-base font-medium">
            <Shield className="h-4 w-4 text-[#AFA9EC]" />
            My sharing settings
          </DialogTitle>
          <DialogDescription className="text-xs text-[#9BA3B8]">
            Choose what your buddies can see about your activity. You can change these at any time.
          </DialogDescription>
        </div>

        <div className="min-h-0 flex-1 overflow-y-auto px-5">
          {loading ? (
            <p className="py-6 text-center text-xs text-[#5C6480]">Loading…</p>
          ) : (
            <div className="space-y-0 pb-2">
              {TOGGLE_META.map((row) => (
                <div
                  key={row.key}
                  className="flex items-center gap-2.5 border-b border-[#2A3347]/80 py-2.5 last:border-0"
                >
                  <div className="min-w-0 flex-1">
                    <p className="text-xs font-medium text-[#E8EAF0]">{row.title}</p>
                    <p className="mt-0.5 text-[11px] leading-snug text-[#9BA3B8]">
                      {row.description}
                    </p>
                  </div>
                  <button
                    type="button"
                    role="switch"
                    aria-checked={settings[row.key]}
                    onClick={() =>
                      setSettings((prev) => ({ ...prev, [row.key]: !prev[row.key] }))
                    }
                    className={[
                      "relative h-5 w-9 shrink-0 rounded-full border transition-colors",
                      settings[row.key]
                        ? "border-[#534AB7] bg-[#7F77DD]"
                        : "border-[#334060] bg-[#222A3A]",
                    ].join(" ")}
                  >
                    <span
                      className={[
                        "absolute top-0.5 h-3.5 w-3.5 rounded-full transition-all",
                        settings[row.key]
                          ? "left-[18px] bg-white"
                          : "left-0.5 bg-[#9BA3B8]",
                      ].join(" ")}
                    />
                  </button>
                </div>
              ))}
            </div>
          )}
        </div>

        <DialogFooter className="shrink-0 gap-2 border-t border-[#2A3347] bg-[#161B25] px-5 py-4 sm:flex-row sm:justify-stretch">
          <Button
            type="button"
            variant="outline"
            className="h-10 flex-1 border-[#334060] bg-[#1C2333] text-sm font-medium text-[#E8EAF0] hover:bg-[#222A3A]"
            onClick={() => onOpenChange(false)}
            disabled={saving}
          >
            Cancel
          </Button>
          <Button
            type="button"
            className="h-10 flex-1 bg-[#7F77DD] text-sm font-semibold text-white shadow-[0_0_0_1px_rgba(127,119,221,0.4)] hover:bg-[#534AB7] disabled:opacity-60"
            onClick={() => void handleSave()}
            disabled={saving || loading}
          >
            {saving ? "Saving…" : "Save settings"}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
