"use client";

import { useCallback, useEffect, useLayoutEffect, useMemo, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Switch } from "@/components/ui/switch";
import {
  CreditCard,
  Gem,
  Save,
  Sparkles,
  Zap,
  LayoutGrid,
  BookOpen,
  Users,
  Coins,
  Flame,
  Settings,
  Hourglass,
  type LucideIcon,
} from "lucide-react";
import {
  LESSONS_CHAPTER_LIMIT_RDM_DESCRIPTION,
  SUBSCRIPTION_CONFIG_DEFAULTS,
  SUBSCRIPTION_CONFIG_KEYS,
  type SubscriptionPlanKey,
} from "@/lib/subscription/subscriptionConfig";
import { cn } from "@/lib/utils";

type RdmConfigRow = {
  key: string;
  value: number;
  description: string | null;
  updated_at: string;
};

type SubscriptionTab = SubscriptionPlanKey | "settings";

type TimeTravelStudent = {
  id: string;
  email: string | null;
  name: string | null;
  plan_tier: string;
  subscription_started_at: string | null;
  time_travel_enabled: boolean;
};

const TABS: { key: SubscriptionTab; label: string; icon: LucideIcon }[] = [
  { key: "free_trial", label: "Free Trial", icon: Sparkles },
  { key: "free", label: "Free", icon: CreditCard },
  { key: "starter", label: "Starter", icon: Zap },
  { key: "pro", label: "Pro", icon: Gem },
  { key: "settings", label: "Settings", icon: Settings },
];

const FIELD_LABELS: Record<string, { title: string; hint: string; unit: string }> = {
  magic_wall_max_active_topics: {
    title: "Magic Wall active topics",
    hint: "How many topics can stay active in basket at one time.",
    unit: "topics",
  },
  magic_wall_monthly_attempts: {
    title: "Magic Wall monthly attempts",
    hint:
      "How many new topic picks per user billing month (rolling from account signup date, not calendar month). Carried-over basket topics still count toward the active cap. Use -1 for unlimited.",
    unit: "attempts",
  },
  gyan_doubts_per_day: {
    title: "Gyan++ doubts per day (IST)",
    hint:
      "Max new doubt posts per IST calendar day on /doubts (Ask a doubt). Answers/comments not counted. Over limit → blocked with upgrade prompt. Separate from gyan_post_rdm (first-ASK bonus). Use -1 for unlimited.",
    unit: "posts/day",
  },
  subject_chat_messages_per_day: {
    title: "Subject chat-bot messages per day",
    hint: "Subject chat-bot (chapter/topic tutor) user messages per IST day. Use -1 for unlimited.",
    unit: "per day",
  },
  subject_chat_multilingual: {
    title: "Subject chat-bot multilingual",
    hint: "Subject chat-bot languages: 0 = English only. Investor rule: only Pro should be 1 (multilingual). Free/Starter/Trial = 0.",
    unit: "flag",
  },
  lessons_chapter_limit: {
    title: "Lessons chapters per subject",
    hint: LESSONS_CHAPTER_LIMIT_RDM_DESCRIPTION,
    unit: "chapters/subject",
  },
  instacue_card_limit: {
    title: "InstaCue saved cards limit",
    hint:
      "Max cards a student can save to Revision Bank (bookmark from Lessons InstaCue or create custom). Not the 32-card study deck on a topic. Over limit → save blocked with upgrade prompt. Use -1 for unlimited.",
    unit: "saved cards",
  },
  saved_bit_limit: {
    title: "Quiz bits save limit",
    hint:
      "Max quiz questions saved from Topic Quiz to Revision (Saved tab). Separate from InstaCue. Over limit → save blocked with upgrade prompt. Use -1 for unlimited.",
    unit: "saved questions",
  },
  saved_formula_limit: {
    title: "Numerals formulas save limit",
    hint:
      "Max formula practice sets saved from Numerals to Revision. Separate from quiz bits and InstaCue. Over limit → save blocked with upgrade prompt. Use -1 for unlimited.",
    unit: "saved formulas",
  },
  saved_question_limit: {
    title: "Saved questions limit (Mock / PYQ)",
    hint:
      "Max questions bookmarked from Mock tests and past papers to Revision → Saved Questions tab. Counts unique questions (not sources). Over limit → save blocked with upgrade prompt. Use -1 for unlimited.",
    unit: "saved questions",
  },
  mocks_per_month: {
    title: "Mocks per month",
    hint: "Mock test attempts allowed per month. Use -1 for unlimited.",
    unit: "attempts",
  },
  daily_dose_questions_per_day: {
    title: "DailyDose questions per day",
    hint: "Questions allowed per day. Use -1 for unlimited.",
    unit: "questions",
  },
  buddies_limit: {
    title: "Learning buddies limit",
    hint:
      "Max active learning buddy connections (invite + accept) at one time. Typical values: 0 (off), 1–6, or -1 for unlimited.",
    unit: "buddies",
  },
  rdm_multiplier_pct: {
    title: "RDM multiplier %",
    hint: "100 = 1x, 150 = 1.5x, 200 = 2x.",
    unit: "%",
  },
  // Dynamic loyalty multiplier fields
  free_trial_rdm_multiplier_pct: {
    title: "Free Trial multiplier %",
    hint: "Applied to all RDM during the 28-day trial period. Default = 25 (0.25×).",
    unit: "%",
  },
  rdm_multiplier_months_1_3_pct: {
    title: "RDM Multiplier — Months 1–3 (ramp-in)",
    hint: "Starter ramp-in phase: first 3 months of subscription. Default = 50 (0.50×).",
    unit: "%",
  },
  rdm_multiplier_months_4_plus_pct: {
    title: "RDM Multiplier — Month 4 onwards",
    hint: "Starter full rate from month 4+. Default = 100 (1.00×).",
    unit: "%",
  },
  rdm_multiplier_months_1_5_pct: {
    title: "RDM Multiplier — Months 1–5 (full rate)",
    hint: "Pro full rate from day 1 through month 5. Default = 100 (1.00×).",
    unit: "%",
  },
  rdm_multiplier_months_6_11_pct: {
    title: "RDM Multiplier — Months 6–11 (loyalty bonus)",
    hint: "Pro 6-month continuous loyalty bonus. Default = 150 (1.50×).",
    unit: "%",
  },
  rdm_multiplier_months_12_plus_pct: {
    title: "RDM Multiplier — Month 12+ (year loyalty bonus)",
    hint: "Pro 12-month year-long loyalty bonus. Default = 200 (2.00×).",
    unit: "%",
  },
  free_trial_welcome_rdm: {
    title: "Free trial welcome bonus",
    hint: "RDM welcome bonus copy displayed to the student in the free trial activation wizard welcome screen.",
    unit: "RDM",
  },
  free_trial_checklist_reward_rdm: {
    title: "Free trial checklist reward (Day 1)",
    hint: "RDM paid after all 10 site-tour onboarding tasks are completed and claimed.",
    unit: "RDM",
  },
  free_trial_daily_streak_reward_rdm: {
    title: "Daily streak reward (Day 2–10)",
    hint: "RDM paid when a student completes all 6 daily checklist tasks for the current trial day.",
    unit: "RDM",
  },
  free_trial_duration_days: {
    title: "Free trial base duration",
    hint: "Investor rule: how many days the free trial lasts for a new user by default. The streak extension is added on top of this when the user keeps consecutive active days. Default = 14.",
    unit: "days",
  },
  free_trial_streak_extension_days: {
    title: "Streak extension bonus",
    hint: "Investor rule: extra days added to the trial when the user completes the required streak. 14 base + 14 extension = 28 day second round. Default = 14.",
    unit: "days",
  },
  free_trial_streak_days_required: {
    title: "Streak days required for extension",
    hint: "Investor rule: consecutive active days the user must complete during the base trial to unlock the streak extension. Default = 14 (full base window).",
    unit: "days",
  },
  free_plan_max_months: {
    title: "Free plan cap",
    hint: "Investor rule: maximum calendar months a user may stay on the Free plan (3 mocks/month) before mocks are soft-blocked. Default = 2 (≈ 6 mocks/year).",
    unit: "months",
  },
  free_trial_inactive_penalty_rdm: {
    title: "Free trial inactive penalty",
    hint: "RDM deducted from a free-trial user when they spend less than 30 minutes on-site during a trial day. Set 0 to disable.",
    unit: "RDM",
  },
  free_inactive_penalty_rdm: {
    title: "Free plan inactive penalty",
    hint: "RDM deducted from a free plan user when they spend less than 30 minutes on-site during a calendar day. Set 0 to disable.",
    unit: "RDM",
  },
  starter_inactive_penalty_rdm: {
    title: "Starter inactive penalty",
    hint: "RDM deducted from a Starter plan user when they spend less than 30 minutes on-site during a calendar day. Set 0 to disable.",
    unit: "RDM",
  },
  pro_inactive_penalty_rdm: {
    title: "Pro inactive penalty",
    hint: "RDM deducted from a Pro plan user when they spend less than 30 minutes on-site during a calendar day. Set 0 to disable.",
    unit: "RDM",
  },
  inactive_penalty_rdm: {
    title: "Inactive day penalty",
    hint: "RDM deducted when the student spends less than 30 minutes on-site during a calendar day. Set 0 to disable for this plan.",
    unit: "RDM",
  },
};

interface CategoryGroup {
  id: string;
  title: string;
  icon: typeof LayoutGrid;
  keys: string[];
  blurb?: string;
}

const CATEGORIES: CategoryGroup[] = [
  {
    id: "dashboard",
    title: "Dashboard & Social",
    icon: LayoutGrid,
    keys: [
      "magic_wall_max_active_topics",
      "magic_wall_monthly_attempts",
      "gyan_doubts_per_day",
      "subject_chat_messages_per_day",
      "subject_chat_multilingual",
    ],
  },
  {
    id: "lessons",
    title: "Lessons & Revision",
    icon: BookOpen,
    blurb:
      "Chapter limit is per subject (Phy / Chem / Math) on /explore-1 — not per month. Mocks below are the monthly quota.",
    keys: [
      "lessons_chapter_limit",
      "instacue_card_limit",
      "saved_bit_limit",
      "saved_formula_limit",
      "saved_question_limit",
    ],
  },
  {
    id: "prep",
    title: "Prep & Mock Tests",
    icon: Flame,
    keys: ["mocks_per_month", "daily_dose_questions_per_day"],
  },
  {
    id: "community",
    title: "Social & Community",
    icon: Users,
    keys: ["buddies_limit"],
  },
  {
    id: "rewards",
    title: "Reward & Multipliers",
    icon: Coins,
    keys: [
      "rdm_multiplier_pct",
      "free_trial_rdm_multiplier_pct",
      "rdm_multiplier_months_1_3_pct",
      "rdm_multiplier_months_4_plus_pct",
      "rdm_multiplier_months_1_5_pct",
      "rdm_multiplier_months_6_11_pct",
      "rdm_multiplier_months_12_plus_pct",
      "free_trial_welcome_rdm",
      "free_trial_checklist_reward_rdm",
      "free_trial_daily_streak_reward_rdm",
      "inactive_penalty_rdm",
    ],
  },
  {
    id: "trial_caps",
    title: "Trial & Free Plan Caps (Investor Rule)",
    icon: Hourglass,
    keys: [
      "duration_days",
      "streak_extension_days",
      "streak_days_required",
      "plan_max_months",
    ],
  },
];

function readInitialTab(): SubscriptionTab {
  if (typeof window === "undefined") return "free_trial";
  const sp = new URLSearchParams(window.location.search);
  const tab = (sp.get("tab") || "").trim().toLowerCase();
  if (tab === "free" || tab === "starter" || tab === "pro" || tab === "settings") return tab;
  return "free_trial";
}

function extractSuffix(key: string, plan: SubscriptionPlanKey): string | null {
  const prefix = `${plan}_`;
  if (!key.startsWith(prefix)) return null;
  return key.slice(prefix.length);
}

export default function SubscriptionsPage() {
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState("");
  const [success, setSuccess] = useState("");
  const [configs, setConfigs] = useState<Record<string, RdmConfigRow>>({});
  const [drafts, setDrafts] = useState<Record<string, string>>({});
  const [activeTab, setActiveTab] = useState<SubscriptionTab>("free_trial");

  // Student developer permission states
  const [students, setStudents] = useState<TimeTravelStudent[]>([]);
  const [studentsLoading, setStudentsLoading] = useState(false);
  const [studentSearchQuery, setStudentSearchQuery] = useState("");
  const [overrideSaving, setOverrideSaving] = useState<Record<string, boolean>>({});
  const [overrideError, setOverrideError] = useState<Record<string, string>>({});
  const [overrideDrafts, setOverrideDrafts] = useState<Record<string, { plan: string; startedAt: string }>>({});

  useLayoutEffect(() => {
    setActiveTab(readInitialTab());
  }, []);

  const loadConfigs = useCallback(async () => {
    setLoading(true);
    setError("");
    const { data, error: err } = await supabase.from("rdm_config").select("*");
    if (err) {
      setError(err.message);
      setLoading(false);
      return;
    }
    const conf: Record<string, RdmConfigRow> = {};
    const drf: Record<string, string> = {};
    for (const row of data ?? []) {
      conf[row.key] = row as RdmConfigRow;
      drf[row.key] = String(row.value);
    }
    for (const k of SUBSCRIPTION_CONFIG_KEYS) {
      if (drf[k] === undefined) drf[k] = String(SUBSCRIPTION_CONFIG_DEFAULTS[k]);
    }
    if (drf["global_time_travel_enabled"] === undefined) {
      drf["global_time_travel_enabled"] = "0";
    }
    setConfigs(conf);
    setDrafts(drf);
    setLoading(false);
  }, []);

  const loadStudents = useCallback(async () => {
    if (activeTab !== "settings") return;
    setStudentsLoading(true);
    try {
      const res = await fetch("/api/admin/time-travel-access");
      if (res.ok) {
        const data = await res.json();
        setStudents(data.students ?? []);
      }
    } catch (e) {
      console.error(e);
    } finally {
      setStudentsLoading(false);
    }
  }, [activeTab]);

  useEffect(() => {
    void loadConfigs();
  }, [loadConfigs]);

  useEffect(() => {
    void loadStudents();
  }, [loadStudents]);

  const selectTab = useCallback((tab: SubscriptionTab) => {
    setActiveTab(tab);
    if (typeof window === "undefined") return;
    window.history.replaceState(null, "", `${window.location.pathname}?tab=${tab}`);
  }, []);

  // Filter keys for this plan
  const tabKeys = useMemo(() => {
    if (activeTab === "settings") {
      return ["global_time_travel_enabled"];
    }
    const rows = new Set<string>();
    for (const key of SUBSCRIPTION_CONFIG_KEYS) {
      if (extractSuffix(key, activeTab) !== null) rows.add(key);
    }
    if (activeTab === "free_trial") {
      rows.add("free_trial_welcome_rdm");
      rows.add("free_trial_checklist_reward_rdm");
      rows.add("free_trial_daily_streak_reward_rdm");
      rows.add("free_trial_rdm_multiplier_pct");
    }
    if (activeTab === "starter") {
      rows.add("starter_rdm_multiplier_months_1_3_pct");
      rows.add("starter_rdm_multiplier_months_4_plus_pct");
    }
    if (activeTab === "pro") {
      rows.add("pro_rdm_multiplier_months_1_5_pct");
      rows.add("pro_rdm_multiplier_months_6_11_pct");
      rows.add("pro_rdm_multiplier_months_12_plus_pct");
    }
    return Array.from(rows);
  }, [activeTab]);

  const handleSave = async () => {
    setSaving(true);
    setError("");
    setSuccess("");
    try {
      for (const key of tabKeys) {
        const raw = drafts[key];
        if (raw === undefined) continue;
        const value = parseInt(raw, 10);
        if (Number.isNaN(value)) throw new Error(`Invalid number for ${key}`);
        const description = key.endsWith("_lessons_chapter_limit")
          ? LESSONS_CHAPTER_LIMIT_RDM_DESCRIPTION
          : (configs[key]?.description ??
            `Subscription setting ${key} (admin configurable).`);
        const { error: updateErr } = await supabase.from("rdm_config").upsert(
          {
            key,
            value,
            description,
          },
          { onConflict: "key" }
        );
        if (updateErr) throw updateErr;
      }
      setSuccess("Subscription settings updated.");
      await loadConfigs();
    } catch (e) {
      setError(e instanceof Error ? e.message : "Save failed");
    } finally {
      setSaving(false);
      setTimeout(() => setSuccess(""), 2500);
    }
  };

  const handleToggleStudentAccess = async (studentId: string, currentVal: boolean) => {
    // Optimistic UI update
    setStudents((prev) =>
      prev.map((s) => (s.id === studentId ? { ...s, time_travel_enabled: !currentVal } : s))
    );
    try {
      const res = await fetch("/api/admin/time-travel-access", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ userId: studentId, enabled: !currentVal }),
      });
      if (!res.ok) {
        throw new Error("Failed to toggle access");
      }
    } catch {
      // Revert if API call fails
      setStudents((prev) =>
        prev.map((s) => (s.id === studentId ? { ...s, time_travel_enabled: currentVal } : s))
      );
    }
  };

  const filteredStudents = useMemo(() => {
    return students.filter((st) => {
      const hay = [st.name ?? "", st.email ?? "", st.plan_tier ?? ""].join(" ").toLowerCase();
      return hay.includes(studentSearchQuery.toLowerCase());
    });
  }, [students, studentSearchQuery]);

  if (loading) return <main className="p-6">Loading Subscriptions...</main>;

  return (
    <main className="mx-auto max-w-5xl space-y-6 p-6">
      <header className="flex flex-col gap-3 border-b pb-4 md:flex-row md:items-center md:justify-between">
        <div>
          <h1 className="flex items-center gap-2 text-2xl font-bold">
            <CreditCard className="h-6 w-6 text-primary" />
            Subscriptions
          </h1>
          <p className="mt-1 text-sm text-muted-foreground">
            Configure Free Trial, Free, Starter, and Pro limits. Changes apply on next user action.
          </p>
        </div>
        <Button
          onClick={handleSave}
          disabled={saving}
          className="min-w-32 bg-primary font-semibold text-primary-foreground hover:bg-primary/90"
        >
          {saving ? (
            "Saving..."
          ) : (
            <>
              <Save className="mr-2 h-4 w-4" />
              Save Changes
            </>
          )}
        </Button>
      </header>

      {error ? (
        <div className="rounded-md border border-destructive/20 bg-destructive/10 p-3 text-destructive animate-in fade-in duration-200">
          {error}
        </div>
      ) : null}
      {success ? (
        <div className="rounded-md border border-emerald-500/20 bg-emerald-500/10 p-3 text-emerald-500 animate-in fade-in duration-200">
          {success}
        </div>
      ) : null}

      {/* Elegant Nav Pills */}
      <nav
        role="tablist"
        aria-label="Subscription plan tiers"
        className="flex flex-wrap items-center gap-2 rounded-xl border bg-card/60 px-3 py-2.5 shadow-sm"
      >
        <span className="mr-2 hidden text-xs font-semibold uppercase tracking-wider text-muted-foreground sm:inline">
          Plan Tier
        </span>
        {TABS.map((tab) => {
          const Icon = tab.icon;
          const isActive = activeTab === tab.key;
          return (
            <button
              key={tab.key}
              type="button"
              role="tab"
              aria-selected={isActive}
              onClick={() => selectTab(tab.key)}
              className={cn(
                "inline-flex items-center gap-1.5 rounded-full border px-4 py-2 text-xs font-bold transition-all duration-200",
                isActive
                  ? "border-primary/45 bg-primary/10 font-bold text-primary shadow-sm"
                  : "border-border/50 text-slate-400 hover:bg-muted/60 hover:text-foreground"
              )}
            >
              <Icon className="h-3.5 w-3.5" />
              {tab.label}
            </button>
          );
        })}
      </nav>

      {activeTab === "settings" ? (
        <section className="space-y-6 animate-in fade-in duration-300">
          {/* Global Dev Settings Card */}
          <article className="rounded-2xl border border-white/5 bg-card/50 p-5 shadow-sm backdrop-blur-sm transition-all duration-300 hover:border-white/10">
            <div className="flex items-center gap-2 border-b pb-3 mb-4 border-white/5">
              <span className="flex h-7 w-7 items-center justify-center rounded-lg bg-primary/10 text-primary border border-primary/20">
                <Settings className="h-4 w-4" />
              </span>
              <h2 className="text-sm font-bold tracking-tight text-white">
                Global Developer Settings
              </h2>
            </div>

            <div className="rounded-xl border border-white/5 bg-slate-950/20 p-5 hover:bg-slate-950/45 transition-all duration-200">
              <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
                <div className="space-y-1">
                  <h3 className="text-sm font-bold text-slate-200">
                    Enable Time-travel Mode Globally
                  </h3>
                  <p className="text-xs leading-relaxed text-slate-400">
                    When active, all students will see and can configure Time-travel developer
                    simulation mode in their profile settings. If disabled, only explicitly allowed
                    students below will have access.
                  </p>
                </div>
                <div className="flex items-center gap-3">
                  <span
                    className={cn(
                      "text-xs font-bold font-mono tracking-wider",
                      drafts["global_time_travel_enabled"] === "1"
                        ? "text-primary"
                        : "text-slate-500"
                    )}
                  >
                    {drafts["global_time_travel_enabled"] === "1" ? "ENABLED" : "DISABLED"}
                  </span>
                  <Switch
                    checked={drafts["global_time_travel_enabled"] === "1"}
                    onCheckedChange={(checked) => {
                      setDrafts((prev) => ({
                        ...prev,
                        global_time_travel_enabled: checked ? "1" : "0",
                      }));
                    }}
                  />
                </div>
              </div>
            </div>
          </article>

          {/* Individual Students List Card */}
          <article className="rounded-2xl border border-white/5 bg-card/50 p-5 shadow-sm backdrop-blur-sm transition-all duration-300 hover:border-white/10">
            <div className="flex items-center justify-between border-b pb-3 mb-4 border-white/5 flex-wrap gap-3">
              <div className="flex items-center gap-2">
                <span className="flex h-7 w-7 items-center justify-center rounded-lg bg-emerald-500/10 text-emerald-400 border border-emerald-500/20">
                  <Users className="h-4 w-4" />
                </span>
                <h2 className="text-sm font-bold tracking-tight text-white">
                  Allowed Student Developers
                </h2>
              </div>
              <div className="w-full sm:w-64">
                <Input
                  type="text"
                  placeholder="Search students..."
                  value={studentSearchQuery}
                  onChange={(e) => setStudentSearchQuery(e.target.value)}
                  className="bg-[#0c1017] border-white/5 text-xs text-white focus:border-primary/50 focus:ring-0 h-9"
                />
              </div>
            </div>

            {studentsLoading ? (
              <div className="text-xs text-slate-500 py-8 text-center">Loading students...</div>
            ) : filteredStudents.length === 0 ? (
              <div className="text-xs text-slate-500 py-8 text-center">
                {studentSearchQuery ? "No matching students found." : "No students found."}
              </div>
            ) : (
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                {filteredStudents.map((st) => {
                  const draft = overrideDrafts[st.id] ?? {
                    plan: st.plan_tier || "free",
                    startedAt: st.subscription_started_at
                      ? st.subscription_started_at.slice(0, 10)
                      : "",
                  };
                  const isSaving = overrideSaving[st.id];
                  const err = overrideError[st.id];

                  const applyOverride = async () => {
                    setOverrideSaving((p) => ({ ...p, [st.id]: true }));
                    setOverrideError((p) => ({ ...p, [st.id]: "" }));
                    try {
                      const body: Record<string, unknown> = {
                        userId: st.id,
                        plan: draft.plan,
                      };
                      if (draft.plan === "starter" || draft.plan === "pro") {
                        body.subscription_started_at = draft.startedAt || null;
                      }
                      const res = await fetch("/api/admin/subscription-override", {
                        method: "POST",
                        headers: { "Content-Type": "application/json" },
                        body: JSON.stringify(body),
                      });
                      const json = await res.json();
                      if (!res.ok) throw new Error(json.error || "Failed");
                      // Optimistically update local row
                      setStudents((prev) =>
                        prev.map((s) =>
                          s.id === st.id
                            ? {
                                ...s,
                                plan_tier: draft.plan,
                                subscription_started_at: draft.startedAt || null,
                              }
                            : s
                        )
                      );
                    } catch (e) {
                      setOverrideError((p) => ({
                        ...p,
                        [st.id]: e instanceof Error ? e.message : "Error",
                      }));
                    } finally {
                      setOverrideSaving((p) => ({ ...p, [st.id]: false }));
                    }
                  };

                  return (
                    <div
                      key={st.id}
                      className="rounded-xl border border-white/5 bg-slate-950/20 p-4 hover:bg-slate-950/45 hover:border-white/10 transition-all duration-200 space-y-3"
                    >
                      {/* Header row */}
                      <div className="flex items-center justify-between gap-4">
                        <div className="min-w-0">
                          <h4 className="text-xs font-bold text-slate-200 truncate">
                            {st.name || "Unnamed Student"}
                          </h4>
                          <p className="text-[10px] text-slate-500 truncate mt-0.5">{st.email}</p>
                        </div>
                        {/* Time-travel toggle */}
                        <div className="flex items-center gap-2 shrink-0">
                          <span
                            className={cn(
                              "text-[9px] font-bold font-mono tracking-wider",
                              st.time_travel_enabled ? "text-emerald-400" : "text-slate-500"
                            )}
                          >
                            {st.time_travel_enabled ? "ALLOWED" : "BLOCKED"}
                          </span>
                          <Switch
                            checked={st.time_travel_enabled}
                            onCheckedChange={() =>
                              handleToggleStudentAccess(st.id, st.time_travel_enabled)
                            }
                          />
                        </div>
                      </div>

                      {/* Plan override */}
                      <div className="grid grid-cols-2 gap-2">
                        <div>
                          <label className="text-[10px] text-slate-400 mb-1 block font-semibold">Plan tier</label>
                          <select
                            value={draft.plan}
                            onChange={(e) =>
                              setOverrideDrafts((p) => ({
                                ...p,
                                [st.id]: { ...draft, plan: e.target.value },
                              }))
                            }
                            className="w-full bg-[#0c1017] border border-white/5 text-xs text-white rounded-lg px-2 h-8 focus:outline-none focus:border-primary/50"
                          >
                            <option value="free">free</option>
                            <option value="free_trial">free_trial</option>
                            <option value="starter">starter</option>
                            <option value="pro">pro</option>
                          </select>
                        </div>
                        {(draft.plan === "starter" || draft.plan === "pro") && (
                          <div>
                            <label className="text-[10px] text-slate-400 mb-1 block font-semibold">
                              Sub start date
                            </label>
                            <input
                              type="date"
                              value={draft.startedAt}
                              onChange={(e) =>
                                setOverrideDrafts((p) => ({
                                  ...p,
                                  [st.id]: { ...draft, startedAt: e.target.value },
                                }))
                              }
                              className="w-full bg-[#0c1017] border border-white/5 text-xs text-white rounded-lg px-2 h-8 focus:outline-none focus:border-primary/50"
                            />
                          </div>
                        )}
                      </div>

                      {/* Multiplier preview */}
                      {(draft.plan === "starter" || draft.plan === "pro") && (
                        <p className="text-[10px] text-slate-500 leading-snug">
                          {draft.plan === "starter"
                            ? "Months 1–3 = 0.50× → Month 4+ = 1.00×"
                            : "Months 1–5 = 1.00× → Months 6–11 = 1.50× → Month 12+ = 2.00×"}
                        </p>
                      )}
                      {draft.plan === "free_trial" && (
                        <p className="text-[10px] text-slate-500">Flat 0.25× during trial period</p>
                      )}

                      {err && <p className="text-[10px] text-red-400">{err}</p>}

                      <button
                        onClick={applyOverride}
                        disabled={isSaving}
                        className="w-full h-7 rounded-lg bg-primary/10 border border-primary/20 text-primary text-[10px] font-bold tracking-wide hover:bg-primary/20 transition-colors disabled:opacity-50"
                      >
                        {isSaving ? "Saving…" : "Save Override"}
                      </button>
                    </div>
                  );
                })}
              </div>
            )}

          </article>
        </section>
      ) : (
        /* Organized Category Cards */
        <section className="space-y-6 animate-in fade-in duration-300">
          {CATEGORIES.map((cat) => {
            // Find matching keys belonging to this category & active tier
            const catKeys = cat.keys
              .map((suf) => {
                if (
                  suf === "free_trial_welcome_rdm" ||
                  suf === "free_trial_checklist_reward_rdm" ||
                  suf === "free_trial_daily_streak_reward_rdm"
                ) {
                  return activeTab === "free_trial" ? suf : null;
                }
                const candidate = `${activeTab}_${suf}`;
                return tabKeys.includes(candidate) ? candidate : null;
              })
              .filter(Boolean) as string[];

            // Skip empty categories (e.g. Free Trial checklist reward on non-trial tabs)
            if (catKeys.length === 0) return null;

            const CatIcon = cat.icon;

            return (
              <article
                key={cat.id}
                className="rounded-2xl border border-white/5 bg-card/50 p-5 shadow-sm backdrop-blur-sm transition-all duration-300 hover:border-white/10 hover:shadow-md"
              >
                {/* Category Header */}
                <div className="flex items-center gap-2 border-b pb-3 mb-4 border-white/5">
                  <span className="flex h-7 w-7 items-center justify-center rounded-lg bg-primary/10 text-primary border border-primary/20">
                    <CatIcon className="h-4 w-4" />
                  </span>
                  <div>
                    <h2 className="text-sm font-bold tracking-tight text-white">{cat.title}</h2>
                    {cat.blurb ? (
                      <p className="mt-1 text-[11px] leading-relaxed text-slate-400">{cat.blurb}</p>
                    ) : null}
                  </div>
                </div>

                {/* Grid block for category settings */}
                <div className="grid grid-cols-1 md:grid-cols-2 gap-5">
                  {catKeys.map((key) => {
                    const suffix = extractSuffix(key, activeTab as SubscriptionPlanKey);
                    const isSpecialFullKey =
                      key === "free_trial_checklist_reward_rdm" ||
                      key === "free_trial_daily_streak_reward_rdm" ||
                      key === "free_trial_rdm_multiplier_pct" ||
                      key === "free_trial_welcome_rdm" ||
                      key === "starter_rdm_multiplier_months_1_3_pct" ||
                      key === "starter_rdm_multiplier_months_4_plus_pct" ||
                      key === "pro_rdm_multiplier_months_1_5_pct" ||
                      key === "pro_rdm_multiplier_months_6_11_pct" ||
                      key === "pro_rdm_multiplier_months_12_plus_pct";
                    const labelKey = isSpecialFullKey ? key : (suffix ?? key);
                    const meta = (FIELD_LABELS[key] ?? FIELD_LABELS[labelKey]) ?? {
                      title: key,
                      hint: "Subscription setting",
                      unit: "",
                    };
                    const row = configs[key];

                    return (
                      <div
                        key={key}
                        className="rounded-xl border border-white/5 bg-slate-950/20 p-4 transition-all duration-200 hover:bg-slate-950/45 hover:border-white/10 flex flex-col justify-between"
                      >
                        <div>
                          <div className="flex justify-between items-start gap-2">
                            <label className="text-xs font-black tracking-tight text-slate-200">
                              {meta.title}
                            </label>
                          </div>
                          <div className="mt-0.5 font-mono text-[9px] text-slate-500 uppercase select-all">
                            {key}
                          </div>
                          <p className="mt-1 text-[11px] leading-relaxed text-slate-400">
                            {meta.hint}
                          </p>
                        </div>

                        <div className="mt-4.5">
                          <div className="flex items-center gap-2">
                            <Input
                              type="number"
                              value={drafts[key] ?? ""}
                              onChange={(e) =>
                                setDrafts((prev) => ({
                                  ...prev,
                                  [key]: e.target.value,
                                }))
                              }
                              className="bg-[#0c1017] border-white/5 text-xs text-white focus:border-primary/50 focus:ring-0 font-mono h-9"
                            />
                            {meta.unit ? (
                              <span className="shrink-0 text-[11px] font-bold text-slate-400 bg-white/5 border border-white/5 rounded-lg px-2.5 py-1.5 min-w-[3.5rem] text-center">
                                {meta.unit}
                              </span>
                            ) : null}
                          </div>
                          <div className="mt-2 text-[9px] font-medium text-slate-500 text-right">
                            Last updated:{" "}
                            {row ? new Date(row.updated_at).toLocaleString() : "Not set yet"}
                          </div>
                        </div>
                      </div>
                    );
                  })}
                </div>
              </article>
            );
          })}
        </section>
      )}
    </main>
  );
}
