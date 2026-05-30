"use client";

import { useState, useEffect } from "react";
import { useRouter } from "next/navigation";
import { useTheme } from "next-themes";
import { Button } from "@/components/ui/button";
import { Switch } from "@/components/ui/switch";
import { useAuth } from "@/hooks/useAuth";
import { supabase } from "@/integrations/supabase/client";
import { useToast } from "@/hooks/use-toast";
import { cn } from "@/lib/utils";
import { computeOffsetForTrialDay } from "@/lib/onboarding/dailyChecklistTaskStorage";
import { dispatchTimeTravelOffsetChanged } from "@/lib/dev/timeTravel";
import { clearDailyStreakChecklistSuppress } from "@/lib/onboarding/dailyStreakClient";
import {
  Heart,
  LogOut,
  MessageSquare,
  Monitor,
  Moon,
  Sun,
  Clock,
  Calendar,
  Zap,
  Sparkles,
} from "lucide-react";

/** Account hub: Settings (left) + EduFund Eligibility & Contact cards (right), matching desktop reference layout. */
export default function StudentSettingsHub() {
  const router = useRouter();
  const { signOut, profile, refreshProfile } = useAuth();
  const { theme, setTheme } = useTheme();
  const { toast } = useToast();
  const [dailyReminders, setDailyReminders] = useState(true);
  const [examAlerts, setExamAlerts] = useState(false);
  const [loggingOut, setLoggingOut] = useState(false);

  // Time-travel simulator states
  const [globalActive, setGlobalActive] = useState(false);
  const [loadingAccess, setLoadingAccess] = useState(true);
  const [customDatetime, setCustomDatetime] = useState("");

  const currentOffset = profile?.time_travel_offset_ms ?? 0;
  const isTimeTravelActive = currentOffset > 0;

  useEffect(() => {
    const checkGlobalAccess = async () => {
      try {
        const { data } = await supabase
          .from("rdm_config")
          .select("value")
          .eq("key", "global_time_travel_enabled")
          .maybeSingle();
        setGlobalActive(data ? Number(data.value) === 1 : false);
      } catch (e) {
        console.error("[settings] checkGlobalAccess", e);
      } finally {
        setLoadingAccess(false);
      }
    };
    void checkGlobalAccess();
  }, []);

  // Initialize datetime input based on simulated time
  useEffect(() => {
    const simulatedDate = new Date(Date.now() + currentOffset);
    const yyyy = simulatedDate.getFullYear();
    const mm = String(simulatedDate.getMonth() + 1).padStart(2, "0");
    const dd = String(simulatedDate.getDate()).padStart(2, "0");
    const hh = String(simulatedDate.getHours()).padStart(2, "0");
    const min = String(simulatedDate.getMinutes()).padStart(2, "0");
    setCustomDatetime(`${yyyy}-${mm}-${dd}T${hh}:${min}`);
  }, [currentOffset]);

  const allowed = globalActive || Boolean(profile?.time_travel_enabled);

  const handleUpdateOffset = async (
    offsetMs: number,
    label: string,
    options?: { clearStreakSuppress?: boolean }
  ) => {
    if (!profile?.id) return;
    try {
      const { error } = await (supabase as any)
        .from("profiles")
        .update({ time_travel_offset_ms: offsetMs })
        .eq("id", profile.id);

      if (error) throw error;

      if (options?.clearStreakSuppress) {
        clearDailyStreakChecklistSuppress(profile.id);
      }

      await refreshProfile();
      dispatchTimeTravelOffsetChanged(offsetMs, {
        clearStreakSuppress: options?.clearStreakSuppress,
      });

      toast({
        title: "Time Shift Successful 🕒",
        description: `Successfully shifted to ${label}. All systems simulated!`,
        duration: 4000,
      });
    } catch (e) {
      console.error("[settings] time travel update", e);
      toast({
        title: "Time Shift Failed",
        description: "Could not apply developer time travel.",
        variant: "destructive",
      });
    }
  };

  const handleCustomShift = () => {
    if (!customDatetime) return;
    const targetMs = new Date(customDatetime).getTime();
    if (Number.isNaN(targetMs)) return;
    const realNow = Date.now();
    const offsetMs = Math.max(0, targetMs - realNow);
    void handleUpdateOffset(offsetMs, new Date(targetMs).toLocaleString());
  };

  const handleLogout = async () => {
    setLoggingOut(true);
    try {
      await signOut();
    } catch (e) {
      console.error("[settings] signOut", e);
      router.replace("/");
      router.refresh();
    } finally {
      setLoggingOut(false);
    }
  };

  return (
    <div className="mx-auto w-full max-w-6xl">
      <div className="rounded-2xl border border-border bg-card/50 p-4 dark:border-white/10 dark:bg-[#070b14]/80 md:p-5 2xl:rounded-3xl 2xl:p-7">
        <p className="mb-4 text-xs font-bold uppercase tracking-wider text-muted-foreground dark:text-slate-500 2xl:mb-5">
          Account
        </p>

        <div className="flex flex-col gap-4 lg:flex-row lg:items-stretch lg:gap-6 2xl:gap-8">
          {/* Left: Settings (primary column) */}
          <div className="min-w-0 flex-1 rounded-2xl border border-border bg-card p-4 dark:border-white/10 dark:bg-[#0d1118] md:p-5 2xl:rounded-[1.125rem] 2xl:p-6">
            <h1 className="mb-0.5 text-lg font-black text-foreground dark:text-white 2xl:mb-1 2xl:text-xl">
              Settings
            </h1>
            <p className="mb-4 text-xs text-muted-foreground dark:text-slate-400 2xl:mb-5 2xl:text-sm">
              Appearance & notifications
            </p>
            <div className="space-y-4 2xl:space-y-5">
              <div>
                <p className="text-[10px] font-semibold uppercase tracking-wide text-muted-foreground dark:text-slate-500 2xl:text-xs">
                  Appearance
                </p>
                <div className="mt-2 flex flex-wrap gap-2">
                  {[
                    { value: "light", label: "Light", icon: Sun },
                    { value: "dark", label: "Dark", icon: Moon },
                    { value: "system", label: "System", icon: Monitor },
                  ].map((opt) => (
                    <button
                      key={opt.value}
                      type="button"
                      onClick={() => setTheme(opt.value)}
                      className={`inline-flex items-center gap-1.5 rounded-xl px-3 py-2 text-sm font-bold transition 2xl:px-3.5 2xl:py-2.5 ${
                        (theme ?? "system") === opt.value
                          ? "bg-[#7c3aed] text-white shadow-md shadow-violet-600/25"
                          : "bg-muted text-muted-foreground hover:bg-muted/80 dark:bg-slate-900 dark:text-slate-300 dark:hover:bg-slate-800"
                      }`}
                    >
                      <opt.icon className="h-3.5 w-3.5 2xl:h-4 2xl:w-4" />
                      {opt.label}
                    </button>
                  ))}
                </div>
              </div>
              <div className="space-y-3 2xl:space-y-3">
                <div className="flex items-center justify-between gap-3 rounded-xl border border-border bg-muted/30 px-3 py-2.5 dark:border-white/10 dark:bg-slate-900/70 2xl:px-4 2xl:py-3">
                  <div className="min-w-0">
                    <p className="font-semibold text-foreground dark:text-slate-100">
                      Daily reminders
                    </p>
                    <p className="text-xs text-muted-foreground dark:text-slate-400">
                      Get nudged to study every day
                    </p>
                  </div>
                  <Switch checked={dailyReminders} onCheckedChange={setDailyReminders} />
                </div>
                <div className="flex items-center justify-between gap-3 rounded-xl border border-border bg-muted/30 px-3 py-2.5 dark:border-white/10 dark:bg-slate-900/70 2xl:px-4 2xl:py-3">
                  <div className="min-w-0">
                    <p className="font-semibold text-foreground dark:text-slate-100">Exam alerts</p>
                    <p className="text-xs text-muted-foreground dark:text-slate-400">
                      Deadlines for JEE, CBSE & more
                    </p>
                  </div>
                  <Switch checked={examAlerts} onCheckedChange={setExamAlerts} />
                </div>
              </div>

              {/* Developer Time-travel Simulator Card */}
              {allowed && (
                <div className="border-t border-border pt-4 dark:border-white/10 2xl:pt-5 animate-in fade-in duration-300">
                  <p className="text-[10px] font-semibold uppercase tracking-wide text-muted-foreground dark:text-slate-500 2xl:text-xs">
                    Developer Mode
                  </p>

                  <div className="mt-2 rounded-xl border border-violet-500/25 bg-gradient-to-br from-violet-500/5 via-transparent to-transparent p-4 dark:border-violet-500/20 dark:bg-slate-900/40">
                    <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4 border-b border-border pb-3 dark:border-white/5">
                      <div className="min-w-0">
                        <p className="font-semibold text-foreground dark:text-slate-100 flex items-center gap-1.5">
                          <Clock className="h-4 w-4 text-violet-400 animate-pulse" />
                          Time-travel Simulator
                        </p>
                        <p className="text-xs text-muted-foreground dark:text-slate-400">
                          Simulate future daily habit resets and trial timer progression.
                        </p>
                      </div>
                      <div className="flex items-center gap-2">
                        <span
                          className={cn(
                            "text-[9px] font-black tracking-wider uppercase",
                            isTimeTravelActive ? "text-violet-400 animate-pulse" : "text-slate-500"
                          )}
                        >
                          {isTimeTravelActive ? "Active Simulation" : "Real Time"}
                        </span>
                        <Switch
                          checked={isTimeTravelActive}
                          onCheckedChange={(checked) => {
                            if (!checked) {
                              void handleUpdateOffset(0, "Real Time");
                            } else {
                              void handleUpdateOffset(
                                computeOffsetForTrialDay(profile?.onboarding_reward_claimed_at, 2),
                                "Day 2 checklist",
                                { clearStreakSuppress: true }
                              );
                            }
                          }}
                        />
                      </div>
                    </div>

                    <div className="mt-4 space-y-4">
                      <div>
                        <p className="text-[10px] font-bold text-slate-400 uppercase tracking-wide">
                          Fast presets:
                        </p>
                        <div className="mt-2 flex flex-wrap gap-2">
                          {[
                            { label: "Real Time", trialDay: 0 },
                            { label: "Day 2 checklist", trialDay: 2 },
                            { label: "Day 3 checklist", trialDay: 3 },
                            { label: "Day 8 checklist", trialDay: 8 },
                            { label: "Day 14 (trial end)", trialDay: 14 },
                          ].map((preset) => {
                            const offset =
                              preset.trialDay === 0
                                ? 0
                                : preset.trialDay <= 10
                                  ? computeOffsetForTrialDay(
                                      profile?.onboarding_reward_claimed_at,
                                      preset.trialDay
                                    )
                                  : computeOffsetForTrialDay(
                                      profile?.onboarding_reward_claimed_at,
                                      10
                                    ) +
                                    (preset.trialDay - 10) * 24 * 60 * 60 * 1000;
                            return (
                              <button
                                key={preset.label}
                                type="button"
                                onClick={() =>
                                  void handleUpdateOffset(offset, preset.label, {
                                    clearStreakSuppress: preset.trialDay >= 2,
                                  })
                                }
                                className={`inline-flex items-center gap-1 rounded-xl px-2.5 py-1.5 text-xs font-bold transition ${
                                  currentOffset === offset
                                    ? "bg-[#7c3aed] text-white shadow-md shadow-violet-600/25"
                                    : "bg-muted text-muted-foreground hover:bg-muted/80 dark:bg-slate-950 dark:text-slate-400 dark:hover:bg-slate-800"
                                }`}
                              >
                                {preset.trialDay === 0 ? (
                                  <Zap className="h-3 w-3" />
                                ) : (
                                  <Sparkles className="h-3 w-3" />
                                )}
                                {preset.label}
                              </button>
                            );
                          })}
                        </div>
                      </div>

                      <div className="flex flex-col sm:flex-row sm:items-end gap-3 pt-2 border-t border-border/50 dark:border-white/5">
                        <div className="flex-1">
                          <label className="text-[10px] font-bold text-slate-400 uppercase tracking-wide block mb-1.5">
                            Custom target date & time:
                          </label>
                          <input
                            type="datetime-local"
                            value={customDatetime}
                            onChange={(e) => setCustomDatetime(e.target.value)}
                            className="w-full bg-slate-950 border border-border/50 dark:border-white/5 rounded-xl px-3 py-2 text-xs text-white focus:outline-none focus:border-violet-500 font-mono h-9"
                          />
                        </div>
                        <Button
                          type="button"
                          onClick={handleCustomShift}
                          className="h-9 rounded-xl bg-violet-600 text-xs font-bold text-white hover:bg-violet-500 shadow-md shadow-violet-600/20"
                        >
                          <Calendar className="mr-1.5 h-3.5 w-3.5" />
                          Apply Time-travel
                        </Button>
                      </div>
                    </div>
                  </div>
                </div>
              )}

              <div className="border-t border-border pt-4 dark:border-white/10 2xl:pt-5">
                <p className="text-[10px] font-semibold uppercase tracking-wide text-muted-foreground dark:text-slate-500 2xl:text-xs">
                  Account
                </p>
                <div className="mt-2 flex flex-col gap-2 rounded-xl border border-border bg-muted/30 px-3 py-2.5 dark:border-white/10 dark:bg-slate-900/70 sm:flex-row sm:items-center sm:justify-between 2xl:px-4 2xl:py-3">
                  <div className="min-w-0">
                    <p className="font-semibold text-foreground dark:text-slate-100">Log out</p>
                    <p className="text-xs text-muted-foreground dark:text-slate-400">
                      Sign out of your account on this device
                    </p>
                  </div>
                  <Button
                    type="button"
                    variant="outline"
                    disabled={loggingOut}
                    className="shrink-0 border-rose-400/35 bg-rose-500/10 text-rose-200 hover:bg-rose-500/20 hover:text-rose-100 dark:border-rose-400/25"
                    onClick={() => void handleLogout()}
                  >
                    <LogOut className="mr-2 h-4 w-4" />
                    {loggingOut ? "Signing out…" : "Log out"}
                  </Button>
                </div>
              </div>
            </div>
          </div>

          {/* Right: EduFund + Contact stacked */}
          <div className="flex w-full shrink-0 flex-col gap-3 lg:w-[min(100%,20rem)] xl:w-[22rem] 2xl:w-96 2xl:gap-4">
            <div className="rounded-2xl border border-border bg-card p-4 dark:border-white/10 dark:bg-[#0d1118] 2xl:rounded-[1.125rem] 2xl:p-6">
              <div className="mb-0.5 flex items-center justify-between 2xl:mb-1">
                <h2 className="flex items-center gap-1.5 text-lg font-black text-foreground dark:text-white 2xl:gap-2 2xl:text-xl">
                  <Heart
                    className="h-4 w-4 shrink-0 text-rose-400 2xl:h-5 2xl:w-5"
                    strokeWidth={2}
                  />
                  EduFund Eligibility
                </h2>
                <span className="rounded-full bg-rose-500/20 px-2 py-0.5 text-xs font-bold text-rose-300">
                  New
                </span>
              </div>
              <p className="text-sm text-muted-foreground dark:text-slate-400">
                Scholarships & funding opportunities matched to your profile.
              </p>
              <Button
                variant="link"
                className="mt-2 h-auto p-0 text-[#a78bfa] hover:text-violet-200 2xl:mt-3"
                onClick={() => router.push("/edufund")}
              >
                Explore funding →
              </Button>
            </div>

            <div className="rounded-2xl border border-cyan-400/25 bg-gradient-to-br from-cyan-500/10 via-transparent to-violet-500/10 p-4 dark:border-cyan-300/20 dark:bg-[radial-gradient(circle_at_top_right,rgba(45,212,191,0.16),transparent_55%),radial-gradient(circle_at_bottom_left,rgba(139,92,246,0.14),transparent_55%),rgba(13,17,24,0.96)] 2xl:rounded-[1.125rem] 2xl:p-6">
              <div className="mb-0.5 flex items-center justify-between 2xl:mb-1">
                <h2 className="flex items-center gap-1.5 text-lg font-black text-foreground dark:text-white 2xl:gap-2 2xl:text-xl">
                  <MessageSquare
                    className="h-4 w-4 shrink-0 text-[#2dd4bf] 2xl:h-5 2xl:w-5"
                    strokeWidth={2}
                  />
                  Contact Us
                </h2>
                <span className="rounded-full bg-cyan-500/20 px-2 py-0.5 text-xs font-bold text-cyan-200">
                  Help
                </span>
              </div>
              <p className="text-sm text-muted-foreground dark:text-slate-300/90">
                Report an issue, ask for partnerships, or share suggestions. We usually reply within
                24–48 hours.
              </p>
              <Button
                variant="link"
                className="mt-2 h-auto p-0 text-[#2dd4bf] hover:text-cyan-200 2xl:mt-3"
                onClick={() => router.push("/contact?from=/profile")}
              >
                Open contact desk →
              </Button>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
