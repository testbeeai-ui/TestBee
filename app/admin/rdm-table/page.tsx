"use client";

import Link from "next/link";
import { useCallback, useEffect, useLayoutEffect, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Coins, Save } from "lucide-react";
import {
  TEACHER_RDM_ADMIN_CHARGE_KEYS,
  TEACHER_RDM_ADMIN_GROWTH_KEYS,
  TEACHER_RDM_ADMIN_META,
  TEACHER_RDM_ADMIN_REWARD_KEYS,
} from "@/lib/teacherPortal/teacherRdmConfig";

type RdmConfigRow = {
  key: string;
  value: number;
  description: string | null;
  updated_at: string;
};

const GROUPS = [
  {
    title: "Earn & Learn (Referrals)",
    keys: [
      "referral_referrer_reward",
      "referral_referee_welcome",
      "referral_weekly_bonus_threshold",
      "referral_weekly_bonus_rdm",
    ],
  },
  {
    title: "Challenge limits",
    keys: ["refer_challenge_daily_rdm_cap"],
  },
  {
    title: "RDM redemption (marketing copy)",
    keys: [
      "redeem_practice_packs_from_rdm",
      "redeem_mock_tests_from_rdm",
      "redeem_analytics_pro_from_rdm",
      "redeem_edufund_entry_from_rdm",
    ],
  },
  {
    title: "MentaMill Blitz (Non-Academic)",
    keys: ["challenge_5_win", "challenge_5_share"],
  },
  {
    title: "FunBrain Quiz (Non-Academic)",
    keys: ["challenge_10_win", "challenge_10_share"],
  },
  {
    title: "Earn & Learn · 20Q challenge (Academic)",
    keys: ["challenge_20_win", "challenge_20_share"],
  },
  {
    title: "Earn & Learn · 50Q challenge (Academic)",
    keys: ["challenge_50_win", "challenge_50_share"],
  },
];

type ConfigGroup = (typeof GROUPS)[number];

function isQuizRewardsGroup(group: ConfigGroup): boolean {
  return group.keys.length > 0 && group.keys.every((k) => k.startsWith("challenge_"));
}

const REFERRAL_GROUPS = GROUPS.filter((g) => !isQuizRewardsGroup(g));
const QUIZ_GROUPS = GROUPS.filter(isQuizRewardsGroup);

/** Shown in admin; `play_dailydose_min_questions_for_rdm` stays in DB / code defaults only. */
const PLAY_HUB_KEYS = [
  "play_dailydose_academic_rdm",
  "play_dailydose_funbrain_rdm",
  "play_dual_streak_7_rdm",
  "play_dual_streak_30_rdm",
  "study_streak_bonus_days",
  "study_streak_bonus_rdm",
] as const;

const FREE_TRIAL_KEYS = [
  "free_trial_welcome_rdm",
  "free_trial_checklist_reward_rdm",
  "free_trial_daily_streak_reward_rdm",
  "free_trial_inactive_penalty_rdm",
] as const;

const PLAN_INACTIVE_PENALTY_KEYS = [
  "free_trial_inactive_penalty_rdm",
  "free_inactive_penalty_rdm",
  "starter_inactive_penalty_rdm",
  "pro_inactive_penalty_rdm",
] as const;

const FREE_TRIAL_META: Record<(typeof FREE_TRIAL_KEYS)[number], { title: string; hint: string }> = {
  free_trial_welcome_rdm: {
    title: "Free trial welcome bonus",
    hint: "Welcome bonus RDM credited immediately to the student upon activating the 14-day free trial.",
  },
  free_trial_checklist_reward_rdm: {
    title: "Checklist completion reward",
    hint: "RDM paid when a student completes all 10 onboarding tasks and claims.",
  },
  free_trial_daily_streak_reward_rdm: {
    title: "Daily streak reward (Day 2–10)",
    hint: "RDM paid when a student completes all 6 daily checklist tasks for the current trial day (claim_free_trial_daily_streak_reward).",
  },
  free_trial_inactive_penalty_rdm: {
    title: "Free trial inactive penalty",
    hint: "RDM deducted from a free-trial user when they spend less than 30 minutes on-site during a trial day.",
  },
};

const PLAN_INACTIVE_PENALTY_META: Record<
  (typeof PLAN_INACTIVE_PENALTY_KEYS)[number],
  { title: string; hint: string }
> = {
  free_trial_inactive_penalty_rdm: {
    title: "Free trial inactive penalty",
    hint: "RDM deducted from a free-trial user when they spend less than 30 minutes on-site during a trial day.",
  },
  free_inactive_penalty_rdm: {
    title: "Free plan inactive penalty",
    hint: "RDM deducted from a free plan user when they spend less than 30 minutes on-site during a calendar day.",
  },
  starter_inactive_penalty_rdm: {
    title: "Starter inactive penalty",
    hint: "RDM deducted from a Starter plan user when they spend less than 30 minutes on-site during a calendar day.",
  },
  pro_inactive_penalty_rdm: {
    title: "Pro inactive penalty",
    hint: "RDM deducted from a Pro plan user when they spend less than 30 minutes on-site during a calendar day.",
  },
};

const PLAY_HUB_META: Record<
  (typeof PLAY_HUB_KEYS)[number],
  { title: string; unit: "RDM" | "week" | "days"; hint?: string }
> = {
  play_dailydose_academic_rdm: {
    title: "Play hub · DailyDose academic (full run, IST) RDM",
    unit: "RDM",
  },
  play_dailydose_funbrain_rdm: {
    title: "Play hub · DailyDose funbrain (full run, IST) RDM",
    unit: "RDM",
  },
  play_dual_streak_7_rdm: {
    title: "Play hub · Dual-domain DailyDose streak every 7 days RDM",
    unit: "RDM",
  },
  play_dual_streak_30_rdm: {
    title: "Play hub · Dual-domain DailyDose streak every 30 days RDM",
    unit: "RDM",
  },
  study_streak_bonus_days: {
    title: "Dashboard · Study streak bonus days label",
    unit: "days",
    hint: "UI badge copy only (does not trigger wallet payout by itself).",
  },
  study_streak_bonus_rdm: {
    title: "Dashboard · Study streak bonus amount label",
    unit: "RDM",
    hint: "UI badge copy only (does not trigger wallet payout by itself).",
  },
};

const SUBTOPIC_RDM_KEYS = [
  "subtopic_quiz_advanced_rdm",
  "subtopic_numerals_pack_rdm",
  "quiz_community_share_rdm",
  "numerals_community_share_rdm",
] as const;

/** Admin labels + claim RPCs — keeps UI aligned with lesson “Post & earn” even if DB `description` differs. */
const SUBTOPIC_RDM_META: Record<
  (typeof SUBTOPIC_RDM_KEYS)[number],
  { title: string; claimRpc: string; hint?: string }
> = {
  subtopic_quiz_advanced_rdm: {
    title: "Subtopic - Advanced quiz (3-set, ≥60%) daily RDM",
    claimRpc: "claim_topic_quiz_advanced_daily_rdm",
    hint: "Awarded once per IST day when the advanced 3-set quiz meets the score threshold.",
  },
  subtopic_numerals_pack_rdm: {
    title: "Subtopic - Numerals pack complete (≥60%) daily RDM",
    claimRpc: "claim_numerals_pack_complete_daily_rdm",
    hint: "Awarded once per IST day when the numerals pack meets the score threshold.",
  },
  quiz_community_share_rdm: {
    title: "Lessons - Quiz result share bonus RDM (once per set per subtopic)",
    claimRpc: "claim_quiz_community_share_rdm",
    hint: "After posting a quiz result to Lessons; one claim per quiz set number per subtopic.",
  },
  numerals_community_share_rdm: {
    title: "Lessons - Numerals result share bonus RDM (once per numeral per subtopic)",
    claimRpc: "claim_numerals_community_share_rdm",
    hint: "After posting a numerals result to Lessons; one claim per formula index per subtopic.",
  },
};

const SUBTOPIC_RDM_SUBSECTIONS: {
  heading: string;
  subheadingKeys: readonly (typeof SUBTOPIC_RDM_KEYS)[number][];
}[] = [
  {
    heading: "Daily completion",
    subheadingKeys: ["subtopic_quiz_advanced_rdm", "subtopic_numerals_pack_rdm"],
  },
  {
    heading: "Community share (Post & earn)",
    subheadingKeys: ["quiz_community_share_rdm", "numerals_community_share_rdm"],
  },
];

const GYAN_RDM_KEYS = [
  "gyan_post_rdm",
  "gyan_comment_rdm",
  "gyan_upvote_rdm",
  "gyan_save_rdm",
] as const;

function TeacherRdmGroupBlock({
  configs,
  drafts,
  onDraftChange,
}: {
  configs: Record<string, RdmConfigRow>;
  drafts: Record<string, string>;
  onDraftChange: (key: string, value: string) => void;
}) {
  function renderCard(key: string) {
    const row = configs[key];
    const meta = TEACHER_RDM_ADMIN_META[key];
    if (!row || !meta) {
      return (
        <div
          key={key}
          className="rounded-lg border border-dashed p-3 text-sm text-muted-foreground"
        >
          Missing row <span className="font-mono">{key}</span> — apply migration{" "}
          <span className="font-mono">20260517140000_teacher_portal_rdm_config</span>
          {key === "gyan_teacher_answer_rdm" ? (
            <>
              {" "}
              or <span className="font-mono">20260522120000_gyan_rdm_config_values</span>
            </>
          ) : null}
          .
        </div>
      );
    }
    const isReward = meta.kind === "reward";
    return (
      <div key={key} className="flex flex-col gap-1.5 rounded-lg border bg-muted/10 p-3">
        <div className="flex flex-wrap items-center gap-2">
          <label className="text-sm font-medium text-foreground">{meta.title}</label>
          <span
            className={`rounded-full border px-2 py-0.5 text-[10px] font-semibold uppercase tracking-wide ${
              isReward
                ? "border-emerald-400/30 bg-emerald-500/10 text-emerald-300"
                : "border-rose-400/30 bg-rose-500/10 text-rose-300"
            }`}
          >
            {isReward ? "Reward (+RDM)" : "Charge (−RDM)"}
          </span>
        </div>
        <div className="space-y-0.5 font-mono text-[11px] text-muted-foreground">
          <div>
            Config key: <span className="text-foreground/90">{key}</span>
          </div>
          <div>Teacher UI: {meta.teacherSurface}</div>
          {meta.serverPath ? <div>Server: {meta.serverPath}</div> : null}
        </div>
        <div className="flex items-center gap-2">
          <Input
            type="number"
            value={drafts[key] || ""}
            onChange={(e) => onDraftChange(key, e.target.value)}
            className="bg-background font-mono"
          />
          <span className="shrink-0 text-sm font-semibold text-amber-400">{meta.unit ?? "RDM"}</span>
        </div>
        <div className="mt-1 text-[10px] text-muted-foreground">
          Last updated: {new Date(row.updated_at).toLocaleString()}
        </div>
      </div>
    );
  }

  return (
    <div className="scroll-mt-20 rounded-xl border bg-card overflow-hidden">
      <div className="border-b bg-muted/40 px-4 py-3">
        <h2 className="text-lg font-semibold">Teachers (portal charges &amp; rewards)</h2>
        <p className="mt-1 text-xs text-muted-foreground">
              Live-linked to the teacher portal: classroom, section, assignment, schedule, test
          generation, Gyan++ teacher rewards, and section schedule class delivery (base + per-student, capped).
          After{" "}
          <span className="font-semibold">Save Changes</span>, amounts apply on the next teacher
          action (wallet labels refresh when the teacher refocuses the tab).
        </p>
      </div>
      <div className="space-y-8 p-4">
        <div className="space-y-3">
          <h3 className="text-sm font-semibold text-foreground">
            Charges (deduct from teacher wallet)
          </h3>
          <div className="grid gap-4 md:grid-cols-2">
            {TEACHER_RDM_ADMIN_CHARGE_KEYS.map((k) => renderCard(k))}
          </div>
        </div>
        <div className="space-y-3">
          <h3 className="text-sm font-semibold text-foreground">
            Rewards (credit to teacher wallet)
          </h3>
          <div className="grid gap-4 md:grid-cols-2">
            {TEACHER_RDM_ADMIN_REWARD_KEYS.map((k) => renderCard(k))}
          </div>
        </div>
        <div className="space-y-3">
          <h3 className="text-sm font-semibold text-foreground">
            Growth rewards (referrals &amp; bulk invite)
          </h3>
          <p className="text-[11px] text-muted-foreground">
            Reward amounts plus their qualifying thresholds and paid-conversion windows. Window
            values are in days and minimum-batch values are student counts (not RDM).
          </p>
          <div className="grid gap-4 md:grid-cols-2">
            {TEACHER_RDM_ADMIN_GROWTH_KEYS.map((k) => renderCard(k))}
          </div>
        </div>
      </div>
    </div>
  );
}

const MOCK_TEST_RDM_KEYS = ["mock_community_share_rdm", "mock_score_bonus_rdm"] as const;

const CBSE_MCQ_RDM_KEYS = [
  "cbse_mcq_community_share_rdm",
  "cbse_mcq_min_accuracy_pct",
  "cbse_mcq_win_rdm",
] as const;

function SubtopicRdmGroupBlock({
  configs,
  drafts,
  onDraftChange,
}: {
  configs: Record<string, RdmConfigRow>;
  drafts: Record<string, string>;
  onDraftChange: (key: string, value: string) => void;
}) {
  function renderCard(key: (typeof SUBTOPIC_RDM_KEYS)[number]) {
    const row = configs[key];
    const meta = SUBTOPIC_RDM_META[key];
    if (!row) {
      return (
        <div
          key={key}
          className="rounded-lg border border-dashed p-3 text-sm text-muted-foreground"
        >
          Missing row <span className="font-mono">{key}</span> — apply migration{" "}
          <span className="font-mono">20260521120000_subtopic_rdm_config</span> or{" "}
          <span className="font-mono">20260524120000_quiz_numerals_share_rdm</span>.
        </div>
      );
    }
    return (
      <div key={key} className="flex flex-col gap-1.5 rounded-lg border bg-muted/10 p-3">
        <label className="text-sm font-medium text-foreground">{meta.title}</label>
        <div className="space-y-0.5 font-mono text-[11px] text-muted-foreground">
          <div>
            Config key: <span className="text-foreground/90">{key}</span>
          </div>
          <div>
            Server claim: <span className="text-sky-400/90">{meta.claimRpc}</span>
          </div>
        </div>
        {meta.hint ? (
          <p className="text-[11px] leading-snug text-muted-foreground">{meta.hint}</p>
        ) : null}
        <div className="flex items-center gap-2">
          <Input
            type="number"
            value={drafts[key] || ""}
            onChange={(e) => onDraftChange(key, e.target.value)}
            className="bg-background font-mono"
          />
          <span className="shrink-0 text-sm font-semibold text-amber-400">RDM</span>
        </div>
        <div className="mt-1 text-[10px] text-muted-foreground">
          Last updated: {new Date(row.updated_at).toLocaleString()}
        </div>
      </div>
    );
  }

  return (
    <div className="scroll-mt-20 rounded-xl border bg-card overflow-hidden">
      <div className="border-b bg-muted/40 px-4 py-3">
        <h2 className="text-lg font-semibold">Subtopic - Lessons (Quiz &amp; Numerals)</h2>
        <p className="mt-1 text-xs text-muted-foreground">
          <span className="font-semibold text-foreground/90">Config keys</span> in{" "}
          <span className="font-mono">rdm_config</span> drive amounts;{" "}
          <span className="font-semibold text-foreground/90">claims</span> are enforced by the RPCs
          below (not by the client).
        </p>
        <ul className="mt-2 list-inside list-disc text-[11px] text-muted-foreground space-y-0.5">
          <li>
            Daily:{" "}
            <span className="font-mono text-sky-400/90">claim_topic_quiz_advanced_daily_rdm</span>,{" "}
            <span className="font-mono text-sky-400/90">
              claim_numerals_pack_complete_daily_rdm
            </span>
          </li>
          <li>
            Post &amp; earn / share:{" "}
            <span className="font-mono text-sky-400/90">claim_quiz_community_share_rdm</span>,{" "}
            <span className="font-mono text-sky-400/90">claim_numerals_community_share_rdm</span>
          </li>
        </ul>
      </div>
      <div className="p-4 space-y-8">
        {SUBTOPIC_RDM_SUBSECTIONS.map((section) => (
          <div key={section.heading} className="space-y-3">
            <div>
              <h3 className="text-sm font-semibold text-foreground">{section.heading}</h3>
              <p className="mt-0.5 text-[11px] text-muted-foreground">
                {section.heading.startsWith("Community")
                  ? "Bonus RDM when learners share results to the Lessons community (dedupe rules on the server)."
                  : "Milestone RDM for completing quiz / numerals targets (daily window on the server)."}
              </p>
            </div>
            <div className="grid gap-4 md:grid-cols-2">
              {section.subheadingKeys.map((k) => renderCard(k))}
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}

function GyanRdmGroupBlock({
  configs,
  drafts,
  onDraftChange,
}: {
  configs: Record<string, RdmConfigRow>;
  drafts: Record<string, string>;
  onDraftChange: (key: string, value: string) => void;
}) {
  return (
    <div className="scroll-mt-20 rounded-xl border bg-card overflow-hidden">
      <div className="border-b bg-muted/40 px-4 py-3">
        <h2 className="text-lg font-semibold">Gyan ++ (Q&A Wall)</h2>
        <p className="mt-1 text-xs text-muted-foreground">
          Controls user-facing Gyan++ rewards (post, comment, first upvote milestone, and save) and
          wallet payouts via server-side functions/triggers.
        </p>
      </div>
      <div className="p-4">
        <div className="grid gap-4 md:grid-cols-2">
          {GYAN_RDM_KEYS.map((key) => {
            const row = configs[key];
            if (!row) {
              return (
                <div
                  key={key}
                  className="rounded-lg border border-dashed p-3 text-sm text-muted-foreground"
                >
                  Missing row <span className="font-mono">{key}</span> — apply migration{" "}
                  <span className="font-mono">20260522120000_gyan_rdm_config_values</span>.
                </div>
              );
            }
            return (
              <div key={key} className="flex flex-col gap-1.5 rounded-lg border bg-muted/10 p-3">
                <label className="text-sm font-medium text-foreground">
                  {row.description || key}
                </label>
                <div className="mb-1 font-mono text-xs text-muted-foreground">{key}</div>
                <div className="flex items-center gap-2">
                  <Input
                    type="number"
                    value={drafts[key] || ""}
                    onChange={(e) => onDraftChange(key, e.target.value)}
                    className="bg-background font-mono"
                  />
                  <span className="shrink-0 text-sm font-semibold text-amber-400">RDM</span>
                </div>
                <div className="mt-1 text-[10px] text-muted-foreground">
                  Last updated: {new Date(row.updated_at).toLocaleString()}
                </div>
              </div>
            );
          })}
        </div>
      </div>
    </div>
  );
}

function CbseMcqRdmGroupBlock({
  configs,
  drafts,
  onDraftChange,
}: {
  configs: Record<string, RdmConfigRow>;
  drafts: Record<string, string>;
  onDraftChange: (key: string, value: string) => void;
}) {
  return (
    <div className="scroll-mt-20 rounded-xl border bg-card overflow-hidden">
      <div className="border-b bg-muted/40 px-4 py-3">
        <h2 className="text-lg font-semibold">CBSE MCQ&apos;s (chapter quiz)</h2>
        <p className="mt-1 text-xs text-muted-foreground">
          Two rewards only (separate from mock test): win RDM when accuracy ≥ minimum % (
          <span className="font-mono">claim_cbse_mcq_chapter_score_rdm</span>), plus community share
          (<span className="font-mono">claim_cbse_mcq_community_share_rdm</span>).
        </p>
      </div>
      <div className="p-4">
        <div className="grid gap-4">
          {CBSE_MCQ_RDM_KEYS.map((key) => {
            const row = configs[key];
            if (!row) {
              return (
                <div
                  key={key}
                  className="rounded-lg border border-dashed p-3 text-sm text-muted-foreground"
                >
                  Missing row <span className="font-mono">{key}</span> — apply migration{" "}
                  <span className="font-mono">20260621140000_cbse_mcq_rdm</span>.
                </div>
              );
            }
            const suffix = key === "cbse_mcq_min_accuracy_pct" ? "%" : "RDM";
            return (
              <div key={key} className="flex flex-col gap-1.5 rounded-lg border bg-muted/10 p-3">
                <label className="text-sm font-medium text-foreground">
                  {row.description || key}
                </label>
                <div className="mb-1 font-mono text-xs text-muted-foreground">{key}</div>
                <div className="flex items-center gap-2">
                  <Input
                    type="number"
                    value={drafts[key] || ""}
                    onChange={(e) => onDraftChange(key, e.target.value)}
                    className="bg-background font-mono"
                  />
                  <span className="shrink-0 text-sm font-semibold text-amber-400">{suffix}</span>
                </div>
                <div className="mt-1 text-[10px] text-muted-foreground">
                  Last updated: {new Date(row.updated_at).toLocaleString()}
                </div>
              </div>
            );
          })}
        </div>
      </div>
    </div>
  );
}

function MockTestRdmGroupBlock({
  configs,
  drafts,
  onDraftChange,
}: {
  configs: Record<string, RdmConfigRow>;
  drafts: Record<string, string>;
  onDraftChange: (key: string, value: string) => void;
}) {
  return (
    <div className="scroll-mt-20 rounded-xl border bg-card overflow-hidden">
      <div className="border-b bg-muted/40 px-4 py-3">
        <h2 className="text-lg font-semibold">Mock test (Share bonus)</h2>
        <p className="mt-1 text-xs text-muted-foreground">
          Controls verified mock result community-share bonus consumed by{" "}
          <span className="font-mono">claim_mock_community_share_rdm</span> and credited to wallet
          via <span className="font-mono">add_rdm</span>; plus catalog test completion score bonus
          (≥60%) from <span className="font-mono">claim_mock_rdm_bonus</span>.
        </p>
      </div>
      <div className="p-4">
        <div className="grid gap-4">
          {MOCK_TEST_RDM_KEYS.map((key) => {
            const row = configs[key];
            if (!row) {
              return (
                <div
                  key={key}
                  className="rounded-lg border border-dashed p-3 text-sm text-muted-foreground"
                >
                  Missing row <span className="font-mono">{key}</span> — apply migration{" "}
                  <span className="font-mono">20260523120000_mock_share_rdm_config</span>
                  {", "}
                  <span className="font-mono">20260523123000_mock_score_bonus_rdm_config</span>.
                </div>
              );
            }
            return (
              <div key={key} className="flex flex-col gap-1.5 rounded-lg border bg-muted/10 p-3">
                <label className="text-sm font-medium text-foreground">
                  {row.description || key}
                </label>
                <div className="mb-1 font-mono text-xs text-muted-foreground">{key}</div>
                <div className="flex items-center gap-2">
                  <Input
                    type="number"
                    value={drafts[key] || ""}
                    onChange={(e) => onDraftChange(key, e.target.value)}
                    className="bg-background font-mono"
                  />
                  <span className="shrink-0 text-sm font-semibold text-amber-400">RDM</span>
                </div>
                <div className="mt-1 text-[10px] text-muted-foreground">
                  Last updated: {new Date(row.updated_at).toLocaleString()}
                </div>
              </div>
            );
          })}
        </div>
      </div>
    </div>
  );
}

function FreeTrialRdmGroupBlock({
  configs,
  drafts,
  onDraftChange,
}: {
  configs: Record<string, RdmConfigRow>;
  drafts: Record<string, string>;
  onDraftChange: (key: string, value: string) => void;
}) {
  return (
    <div className="scroll-mt-20 rounded-xl border bg-card overflow-hidden">
      <div className="border-b bg-muted/40 px-4 py-3">
        <h2 className="text-lg font-semibold">Free trial · onboarding rewards</h2>
        <p className="mt-1 text-xs text-muted-foreground">
          Controls copy in the trial activation wizard and checklist claim payouts (
          <span className="font-mono">claim_free_trial_checklist_reward</span>,{" "}
          <span className="font-mono">claim_free_trial_daily_streak_reward</span>).
        </p>
      </div>
      <div className="p-4">
        <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-3">
          {FREE_TRIAL_KEYS.map((key) => {
            const row = configs[key];
            const meta = FREE_TRIAL_META[key];
            if (!row) {
              return (
                <div
                  key={key}
                  className="rounded-lg border border-dashed p-3 text-sm text-muted-foreground"
                >
                  Missing row <span className="font-mono">{key}</span> — apply migration{" "}
                  <span className="font-mono">
                    {key === "free_trial_daily_streak_reward_rdm"
                      ? "20260530180000_free_trial_daily_streak"
                      : "20260629120000_free_trial_onboarding_rdm"}
                  </span>
                  .
                </div>
              );
            }
            return (
              <div key={key} className="flex flex-col gap-1.5 rounded-lg border bg-muted/10 p-3">
                <label className="text-sm font-medium text-foreground">{meta.title}</label>
                <div className="mb-1 font-mono text-xs text-muted-foreground">{key}</div>
                <p className="text-[11px] leading-snug text-muted-foreground">{meta.hint}</p>
                <div className="flex items-center gap-2">
                  <Input
                    type="number"
                    value={drafts[key] || ""}
                    onChange={(e) => onDraftChange(key, e.target.value)}
                    className="bg-background font-mono"
                  />
                  <span className="shrink-0 text-sm font-semibold text-amber-400">RDM</span>
                </div>
                <div className="mt-1 text-[10px] text-muted-foreground">
                  Last updated: {new Date(row.updated_at).toLocaleString()}
                </div>
              </div>
            );
          })}
        </div>
      </div>
    </div>
  );
}

function PlanInactivePenaltyGroupBlock({
  configs,
  drafts,
  onDraftChange,
}: {
  configs: Record<string, RdmConfigRow>;
  drafts: Record<string, string>;
  onDraftChange: (key: string, value: string) => void;
}) {
  return (
    <div className="scroll-mt-20 rounded-xl border bg-card overflow-hidden">
      <div className="border-b bg-muted/40 px-4 py-3">
        <h2 className="text-lg font-semibold">Inactive day penalties (by plan)</h2>
        <p className="mt-1 text-xs text-muted-foreground">
          Separate values per plan tier. Deducted when on-site foreground time is under 30 minutes for
          a completed calendar day (<span className="font-mono">reconcile_inactive_day_penalties</span>
          ). Set <span className="font-mono">0</span> to disable for a tier.
        </p>
      </div>
      <div className="p-4">
        <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-4">
          {PLAN_INACTIVE_PENALTY_KEYS.map((key) => {
            const row = configs[key];
            const meta = PLAN_INACTIVE_PENALTY_META[key];
            if (!row) {
              return (
                <div
                  key={key}
                  className="rounded-lg border border-dashed p-3 text-sm text-muted-foreground"
                >
                  Missing row <span className="font-mono">{key}</span> — apply migration{" "}
                  <span className="font-mono">20260801120200_tier_inactive_penalty_rdm</span>.
                </div>
              );
            }
            return (
              <div key={key} className="flex flex-col gap-1.5 rounded-lg border bg-muted/10 p-3">
                <label className="text-sm font-medium text-foreground">{meta.title}</label>
                <div className="mb-1 font-mono text-xs text-muted-foreground">{key}</div>
                <p className="text-[11px] leading-snug text-muted-foreground">{meta.hint}</p>
                <div className="flex items-center gap-2">
                  <Input
                    type="number"
                    value={drafts[key] || ""}
                    onChange={(e) => onDraftChange(key, e.target.value)}
                    className="bg-background font-mono"
                  />
                  <span className="shrink-0 text-sm font-semibold text-amber-400">RDM</span>
                </div>
                <div className="mt-1 text-[10px] text-muted-foreground">
                  Last updated: {new Date(row.updated_at).toLocaleString()}
                </div>
              </div>
            );
          })}
        </div>
      </div>
    </div>
  );
}

function PlayHubGroupBlock({
  configs,
  drafts,
  onDraftChange,
}: {
  configs: Record<string, RdmConfigRow>;
  drafts: Record<string, string>;
  onDraftChange: (key: string, value: string) => void;
}) {
  return (
    <div className="scroll-mt-20 rounded-xl border bg-card overflow-hidden">
      <div className="border-b bg-muted/40 px-4 py-3">
        <h2 className="text-lg font-semibold">Play hub · DailyDose &amp; dual-domain streak</h2>
        <p className="mt-1 text-xs text-muted-foreground">
          These values are read by <span className="font-mono">submit_daily_gauntlet</span>{" "}
          (DailyDose RDM per domain and dual-domain streak milestones at 7 and 30 days).
        </p>
      </div>
      <div className="p-4">
        <div className="grid gap-4 md:grid-cols-2">
          {PLAY_HUB_KEYS.map((key) => {
            const row = configs[key];
            const meta = PLAY_HUB_META[key];
            if (!row) {
              return (
                <div
                  key={key}
                  className="rounded-lg border border-dashed p-3 text-sm text-muted-foreground"
                >
                  Missing row <span className="font-mono">{key}</span> — apply migration{" "}
                  <span className="font-mono">20260520120000_play_hub_rdm_config</span>
                  {", "}
                  <span className="font-mono">20260508143000_study_streak_bonus_badge_config</span>.
                </div>
              );
            }
            return (
              <div key={key} className="flex flex-col gap-1.5 rounded-lg border bg-muted/10 p-3">
                <label className="text-sm font-medium text-foreground">
                  {meta?.title ?? row.description ?? key}
                </label>
                <div className="mb-1 font-mono text-xs text-muted-foreground">{key}</div>
                {meta?.hint ? (
                  <p className="text-[11px] leading-snug text-muted-foreground">{meta.hint}</p>
                ) : null}
                <div className="flex items-center gap-2">
                  <Input
                    type="number"
                    value={drafts[key] || ""}
                    onChange={(e) => onDraftChange(key, e.target.value)}
                    className="bg-background font-mono"
                  />
                  <span className="shrink-0 text-sm font-semibold text-amber-400">
                    {meta?.unit === "week" ? "week" : "RDM"}
                  </span>
                </div>
                <div className="mt-1 text-[10px] text-muted-foreground">
                  Last updated: {new Date(row.updated_at).toLocaleString()}
                </div>
              </div>
            );
          })}
        </div>
      </div>
    </div>
  );
}

function valueSuffix(key: string): string {
  if (key === "referral_weekly_bonus_threshold") return "count";
  return "RDM";
}

function RdmGroupBlock({
  group,
  configs,
  drafts,
  onDraftChange,
}: {
  group: ConfigGroup;
  configs: Record<string, RdmConfigRow>;
  drafts: Record<string, string>;
  onDraftChange: (key: string, value: string) => void;
}) {
  const groupKeys = group.keys.filter((k) => configs[k]);
  if (groupKeys.length === 0) return null;

  return (
    <div className="scroll-mt-20 rounded-xl border bg-card overflow-hidden">
      <div className="bg-muted/40 px-4 py-3 border-b">
        <h2 className="font-semibold text-lg">{group.title}</h2>
      </div>
      <div className="p-4">
        <div className="grid gap-4 md:grid-cols-2">
          {groupKeys.map((key) => {
            const row = configs[key];
            const suffix = valueSuffix(key);
            return (
              <div key={key} className="flex flex-col gap-1.5 p-3 rounded-lg border bg-muted/10">
                <label className="text-sm font-medium text-foreground">
                  {row.description || key}
                </label>
                <div className="text-xs text-muted-foreground font-mono mb-1">{key}</div>
                <div className="flex items-center gap-2">
                  <Input
                    type="number"
                    value={drafts[key] || ""}
                    onChange={(e) => onDraftChange(key, e.target.value)}
                    className="font-mono bg-background"
                  />
                  <span className="text-sm font-semibold text-amber-400 shrink-0">
                    {suffix === "count" ? "referrals" : "RDM"}
                  </span>
                </div>
                <div className="text-[10px] text-muted-foreground mt-1">
                  Last updated: {new Date(row.updated_at).toLocaleString()}
                </div>
              </div>
            );
          })}
        </div>
      </div>
    </div>
  );
}

const navPillBase =
  "inline-flex items-center rounded-full border px-3.5 py-1.5 text-sm transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-amber-500/50 focus-visible:ring-offset-2 focus-visible:ring-offset-background";
const navPillPrimary =
  "border-amber-500/40 bg-amber-500/15 font-semibold text-amber-400 hover:bg-amber-500/25";
const navPillInactive =
  "border-border/50 bg-transparent text-muted-foreground hover:bg-muted/60 hover:text-foreground";

type RdmTableTab = "learn" | "play" | "subtopic" | "gyan" | "teachers" | "free_trial";

function readInitialRdmTab(): RdmTableTab {
  if (typeof window === "undefined") return "learn";
  const sp = new URLSearchParams(window.location.search);
  if (sp.get("tab") === "play") return "play";
  if (sp.get("tab") === "subtopic") return "subtopic";
  if (sp.get("tab") === "gyan") return "gyan";
  if (sp.get("tab") === "teachers") return "teachers";
  if (sp.get("tab") === "free-trial") return "free_trial";
  if (window.location.hash === "#rdm-play-hub") return "play";
  return "learn";
}

export default function RdmTablePage() {
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState("");
  const [success, setSuccess] = useState("");
  const [configs, setConfigs] = useState<Record<string, RdmConfigRow>>({});
  const [drafts, setDrafts] = useState<Record<string, string>>({});
  const [activeTab, setActiveTab] = useState<RdmTableTab>("learn");

  useLayoutEffect(() => {
    setActiveTab(readInitialRdmTab());
    if (window.location.hash === "#rdm-play-hub") {
      window.history.replaceState(null, "", `${window.location.pathname}?tab=play`);
    }
  }, []);

  const selectTab = useCallback((tab: RdmTableTab) => {
    setActiveTab(tab);
    if (typeof window === "undefined") return;
    const path = window.location.pathname;
    const next =
      tab === "play"
        ? `${path}?tab=play`
        : tab === "subtopic"
          ? `${path}?tab=subtopic`
          : tab === "gyan"
            ? `${path}?tab=gyan`
            : tab === "teachers"
              ? `${path}?tab=teachers`
              : tab === "free_trial"
                ? `${path}?tab=free-trial`
                : path;
    window.history.replaceState(null, "", next);
  }, []);

  useEffect(() => {
    async function load() {
      setLoading(true);
      const { data, error: err } = await supabase.from("rdm_config").select("*");
      if (err) {
        setError(err.message);
      } else if (data) {
        const conf: Record<string, RdmConfigRow> = {};
        const drf: Record<string, string> = {};
        for (const row of data) {
          conf[row.key] = row as RdmConfigRow;
          drf[row.key] = String(row.value);
        }
        setConfigs(conf);
        setDrafts(drf);
      }
      setLoading(false);
    }
    void load();
  }, []);

  const handleSave = async () => {
    setSaving(true);
    setError("");
    setSuccess("");

    try {
      const updates = Object.entries(drafts).map(([key, valStr]) => {
        const val = parseInt(valStr, 10);
        if (isNaN(val)) throw new Error(`Invalid number for ${key}`);
        return { key, value: val };
      });

      for (const update of updates) {
        const { error: updErr } = await supabase
          .from("rdm_config")
          .update({ value: update.value })
          .eq("key", update.key);
        if (updErr) throw updErr;
      }

      setSuccess("Successfully updated RDM values!");

      const { data } = await supabase.from("rdm_config").select("*");
      if (data) {
        const conf: Record<string, RdmConfigRow> = {};
        const drf: Record<string, string> = {};
        for (const row of data) {
          conf[row.key] = row as RdmConfigRow;
          drf[row.key] = String(row.value);
        }
        setConfigs(conf);
        setDrafts(drf);
      }
    } catch (e) {
      setError(e instanceof Error ? e.message : "Failed to save");
    } finally {
      setSaving(false);
      setTimeout(() => setSuccess(""), 3000);
    }
  };

  const onDraftChange = (key: string, value: string) => {
    setDrafts((prev) => ({ ...prev, [key]: value }));
  };

  if (loading) {
    return <main className="p-6">Loading RDM Table...</main>;
  }

  return (
    <main className="p-6 space-y-6 max-w-5xl">
      <div className="flex flex-col gap-3 md:flex-row md:items-center md:justify-between border-b pb-4">
        <div>
          <h1 className="text-2xl font-bold flex items-center gap-2">
            <Coins className="h-6 w-6 text-amber-400" />
            RDM Table (Rewards Configuration)
          </h1>
          <p className="text-sm text-muted-foreground mt-1">
            Manage all RDM payouts globally. Changes here reflect instantly across the platform
            without redeployment.
          </p>
        </div>
        <Button
          onClick={handleSave}
          disabled={saving}
          className="min-w-32 bg-amber-500 hover:bg-amber-600 text-black font-semibold"
        >
          {saving ? (
            "Saving..."
          ) : (
            <>
              <Save className="h-4 w-4 mr-2" /> Save Changes
            </>
          )}
        </Button>
      </div>

      {error && (
        <div className="p-3 bg-destructive/10 text-destructive rounded-md border border-destructive/20">
          {error}
        </div>
      )}
      {success && (
        <div className="p-3 bg-emerald-500/10 text-emerald-500 rounded-md border border-emerald-500/20">
          {success}
        </div>
      )}

      <nav
        role="tablist"
        aria-label="RDM configuration sections"
        className="flex flex-wrap items-center gap-2 rounded-xl border bg-card/60 px-3 py-2.5 shadow-sm"
      >
        <span className="mr-1 hidden text-xs font-medium uppercase tracking-wide text-muted-foreground sm:inline">
          Section
        </span>
        <button
          type="button"
          role="tab"
          aria-selected={activeTab === "learn"}
          id="rdm-tab-learn"
          className={`${navPillBase} ${activeTab === "learn" ? navPillPrimary : navPillInactive}`}
          onClick={() => selectTab("learn")}
        >
          Learn &amp; earn
        </button>
        <button
          type="button"
          role="tab"
          aria-selected={activeTab === "play"}
          id="rdm-tab-play"
          className={`${navPillBase} ${activeTab === "play" ? navPillPrimary : navPillInactive}`}
          onClick={() => selectTab("play")}
        >
          Play hub
        </button>
        <button
          type="button"
          role="tab"
          aria-selected={activeTab === "subtopic"}
          id="rdm-tab-subtopic"
          className={`${navPillBase} ${activeTab === "subtopic" ? navPillPrimary : navPillInactive}`}
          onClick={() => selectTab("subtopic")}
        >
          Subtopic
        </button>
        <button
          type="button"
          role="tab"
          aria-selected={activeTab === "gyan"}
          id="rdm-tab-gyan"
          className={`${navPillBase} ${activeTab === "gyan" ? navPillPrimary : navPillInactive}`}
          onClick={() => selectTab("gyan")}
        >
          Gyan ++
        </button>
        <button
          type="button"
          role="tab"
          aria-selected={activeTab === "free_trial"}
          id="rdm-tab-free-trial"
          className={`${navPillBase} ${activeTab === "free_trial" ? navPillPrimary : navPillInactive}`}
          onClick={() => selectTab("free_trial")}
        >
          Free trial
        </button>
        <button
          type="button"
          role="tab"
          aria-selected={activeTab === "teachers"}
          id="rdm-tab-teachers"
          className={`${navPillBase} ${activeTab === "teachers" ? navPillPrimary : navPillInactive}`}
          onClick={() => selectTab("teachers")}
        >
          Teachers
        </button>
      </nav>

      <div
        role="tabpanel"
        aria-labelledby="rdm-tab-learn"
        hidden={activeTab !== "learn"}
        className="space-y-6"
      >
        <div className="rounded-lg border border-amber-500/20 bg-amber-500/5 px-4 py-3">
          <p className="text-sm font-semibold text-foreground">Learn &amp; earn</p>
          <p className="text-xs text-muted-foreground mt-1">
            Referral rewards, weekly referral bonuses, the daily cap on refer challenge claims,
            redemption “from RDM” marketing numbers, and Earn &amp; Learn MCQ win/share amounts
            (MentaMill Blitz, FunBrain, 20Q, 50Q).
          </p>
        </div>

        {REFERRAL_GROUPS.map((group) => (
          <RdmGroupBlock
            key={group.title}
            group={group}
            configs={configs}
            drafts={drafts}
            onDraftChange={onDraftChange}
          />
        ))}

        <div className="space-y-6 border-t border-border/60 pt-8">
          {QUIZ_GROUPS.map((group) => (
            <RdmGroupBlock
              key={group.title}
              group={group}
              configs={configs}
              drafts={drafts}
              onDraftChange={onDraftChange}
            />
          ))}
        </div>

        <div className="rounded-lg border border-dashed border-border/50 bg-muted/10 px-4 py-6 text-center">
          <p className="text-xs font-medium text-muted-foreground">
            More RDM sections (e.g. other programs) can be added here as you roll them out.
          </p>
        </div>
      </div>

      <div
        role="tabpanel"
        aria-labelledby="rdm-tab-play"
        hidden={activeTab !== "play"}
        className="space-y-4"
      >
        <div className="rounded-lg border border-violet-500/25 bg-violet-500/5 px-4 py-3">
          <p className="text-sm font-semibold text-foreground">Play hub</p>
          <p className="mt-1 text-xs text-muted-foreground">
            DailyDose RDM (academic and funbrain full runs) and dual-domain streak milestones (7-
            and 30-day). Use <span className="font-semibold">Save Changes</span> at the top to
            persist values.
          </p>
          <p className="mt-1 text-xs text-muted-foreground">
            Also includes the Student Dashboard{" "}
            <span className="font-semibold">Study streak bonus</span> badge copy (week number + RDM
            label).
          </p>
        </div>
        <PlayHubGroupBlock configs={configs} drafts={drafts} onDraftChange={onDraftChange} />
      </div>

      <div
        role="tabpanel"
        aria-labelledby="rdm-tab-gyan"
        hidden={activeTab !== "gyan"}
        className="space-y-4"
      >
        <div className="rounded-lg border border-fuchsia-500/25 bg-fuchsia-500/5 px-4 py-3">
          <p className="text-sm font-semibold text-foreground">Gyan ++</p>
          <p className="mt-1 text-xs text-muted-foreground">
            Gyan++ wall rewards, <span className="font-semibold text-foreground/90">Mock test</span>{" "}
            (past papers / catalog), and{" "}
            <span className="font-semibold text-foreground/90">CBSE MCQ&apos;s</span> chapter quiz —
            each with its own config keys and claim RPCs. Use{" "}
            <span className="font-semibold">Save Changes</span> at the top to persist values.
          </p>
        </div>
        <div className="grid gap-4 lg:grid-cols-2">
          <GyanRdmGroupBlock configs={configs} drafts={drafts} onDraftChange={onDraftChange} />
          <MockTestRdmGroupBlock configs={configs} drafts={drafts} onDraftChange={onDraftChange} />
        </div>
        <CbseMcqRdmGroupBlock configs={configs} drafts={drafts} onDraftChange={onDraftChange} />
      </div>

      <div
        role="tabpanel"
        aria-labelledby="rdm-tab-subtopic"
        hidden={activeTab !== "subtopic"}
        className="space-y-4"
      >
        <div className="rounded-lg border border-sky-500/25 bg-sky-500/5 px-4 py-3">
          <p className="text-sm font-semibold text-foreground">Subtopic (Lessons)</p>
          <p className="mt-1 text-xs text-muted-foreground">
            Lesson-page rewards: daily quiz/numerals completion and{" "}
            <span className="font-semibold text-foreground/90">Post &amp; earn</span> share bonuses
            (quiz per set, numerals per formula). Use{" "}
            <span className="font-semibold">Save Changes</span> at the top to persist values.
          </p>
        </div>
        <SubtopicRdmGroupBlock configs={configs} drafts={drafts} onDraftChange={onDraftChange} />
      </div>

      <div
        role="tabpanel"
        aria-labelledby="rdm-tab-free-trial"
        hidden={activeTab !== "free_trial"}
        className="space-y-4"
      >
        <div className="rounded-lg border border-teal-500/25 bg-teal-500/5 px-4 py-3">
          <p className="text-sm font-semibold text-foreground">Free trial</p>
          <p className="mt-1 text-xs text-muted-foreground">
            Day 1 checklist reward (10 site-tour tasks) and Day 2–10 daily streak reward (6 tasks
            per day). Trial wizard welcome-bonus copy uses the Day 1 amount. Changes apply on the
            next student claim.
          </p>
        </div>
        <div className="rounded-lg border border-primary/30 bg-primary/5 px-4 py-3 flex items-center gap-3">
          <div className="flex h-8 w-8 shrink-0 items-center justify-center rounded-full bg-primary/15">
            <span className="text-primary text-sm">→</span>
          </div>
          <div className="min-w-0 flex-1">
            <p className="text-sm font-semibold text-foreground">
              Full free trial configuration has moved to Subscriptions
            </p>
            <p className="mt-0.5 text-xs text-muted-foreground">
              Magic Wall topic limits, onboarding rewards, and more are now managed in the dedicated{" "}
              <Link
                href="/admin/subscriptions"
                className="font-semibold text-primary hover:underline"
              >
                Subscriptions → Free Trial
              </Link>{" "}
              page. You can still edit the checklist reward here.
            </p>
          </div>
        </div>
        <FreeTrialRdmGroupBlock configs={configs} drafts={drafts} onDraftChange={onDraftChange} />
        <PlanInactivePenaltyGroupBlock configs={configs} drafts={drafts} onDraftChange={onDraftChange} />
      </div>

      <div
        role="tabpanel"
        aria-labelledby="rdm-tab-teachers"
        hidden={activeTab !== "teachers"}
        className="space-y-4"
      >
        <div className="rounded-lg border border-orange-500/25 bg-orange-500/5 px-4 py-3">
          <p className="text-sm font-semibold text-foreground">Teachers (portal)</p>
          <p className="mt-1 text-xs text-muted-foreground">
            Same live connection as the teacher portal: My Classroom (class + sections), Create
            assignment, Schedule live class, Generate test, Gyan++ teacher rewards, and{" "}
            <span className="font-semibold">section schedule class delivery</span> (base + per-student bonus,
            capped). Edit amounts below and click <span className="font-semibold">Save Changes</span>{" "}
            — the next charge or reward uses the new value; button labels refresh when teachers
            refocus the portal tab.
          </p>
        </div>
        <TeacherRdmGroupBlock configs={configs} drafts={drafts} onDraftChange={onDraftChange} />
      </div>
    </main>
  );
}
