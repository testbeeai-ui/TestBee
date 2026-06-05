"use client";

import { useCallback, useMemo, useState } from "react";
import Link from "next/link";
import {
  AlertCircle,
  BarChart3,
  BookOpen,
  Bolt,
  ChartLine,
  Check,
  Flame,
  Gauge,
  GraduationCap,
  Heart,
  HelpCircle,
  Lightbulb,
  Lock,
  MessageCircle,
  MessagesSquare,
  PenLine,
  Presentation,
  Send,
  Share2,
  Star,
  UserCircle,
  Video,
  Wand2,
  ClipboardList,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { useToast } from "@/hooks/use-toast";
import { cn } from "@/lib/utils";
import "./edublast-feedback.css";

type FeedbackRole = "student" | "teacher" | "parent";

type FeatureDef = { id: string; Icon: typeof Wand2; lbl: string };

type RoleData = {
  features: FeatureDef[];
  extraLabel: string;
  extraOptions: string[];
  specific: { id: string; lbl: string }[];
  tyTitle: string;
  tyMsg: string;
};

const STAR_LBLS = [
  "",
  "Not at all satisfied",
  "Below expectations",
  "Okay — could be better",
  "Good, glad I signed up",
  "Excellent — exactly what I needed",
];

const RATING_LBLS: Record<number, string> = {
  1: "Poor",
  2: "Needs work",
  3: "Acceptable",
  4: "Good",
  5: "Excellent",
};

const ISSUE_CHIP_LABELS = [
  "Bug / error message",
  "Slow or crashes",
  "Wrong content / answer",
  "Feature not working",
  "RDM not credited",
  "Login / account issue",
  "Other",
] as const;

const DATA: Record<FeedbackRole, RoleData> = {
  student: {
    features: [
      { id: "magic-wall", Icon: Wand2, lbl: "Magic Wall" },
      { id: "lessons", Icon: BookOpen, lbl: "Lessons" },
      { id: "mock", Icon: PenLine, lbl: "Prep + Mock" },
      { id: "gyan", Icon: HelpCircle, lbl: "Gyan++" },
      { id: "earnlearn", Icon: Bolt, lbl: "Earn & Learn" },
      { id: "edufund", Icon: Heart, lbl: "EduFund" },
    ],
    extraLabel: "Which exam are you preparing for?",
    extraOptions: [
      "JEE Main / Advanced",
      "KCET",
      "State Board (Karnataka)",
      "CBSE Board",
      "Other / not decided yet",
    ],
    specific: [
      { id: "content", lbl: "Quality of learning content" },
      { id: "difficulty", lbl: "Difficulty level of quizzes and mocks" },
      { id: "rdm", lbl: "RDM rewards and motivation" },
      { id: "community", lbl: "Community and peer interaction" },
    ],
    tyTitle: "Thank you for the feedback!",
    tyMsg:
      "Your response helps us make EduBlast the best study platform for every PUC student in Karnataka.",
  },
  teacher: {
    features: [
      { id: "create-exam", Icon: ClipboardList, lbl: "Create exam" },
      { id: "lessons", Icon: BookOpen, lbl: "Lessons library" },
      { id: "mock", Icon: PenLine, lbl: "Mock tests" },
      { id: "gyan", Icon: HelpCircle, lbl: "Gyan++ wall" },
      { id: "analytics", Icon: BarChart3, lbl: "Student analytics" },
      { id: "live", Icon: Video, lbl: "Live classes" },
    ],
    extraLabel: "How many students do you manage on EduBlast?",
    extraOptions: ["1 – 10", "11 – 30", "31 – 100", "100+"],
    specific: [
      { id: "tools", lbl: "Exam creation and question tools" },
      { id: "analytics", lbl: "Student performance analytics" },
      { id: "content", lbl: "Quality of curriculum content" },
      { id: "ease", lbl: "Ease of use for teachers" },
    ],
    tyTitle: "Appreciated, educator!",
    tyMsg:
      "Teachers shape everything here. Your feedback goes directly to our curriculum and product teams this week.",
  },
  parent: {
    features: [
      { id: "dashboard", Icon: Gauge, lbl: "Parent dashboard" },
      { id: "progress", Icon: ChartLine, lbl: "Progress reports" },
      { id: "streak", Icon: Flame, lbl: "Streak and activity" },
      { id: "edufund", Icon: Heart, lbl: "EduFund grants" },
      { id: "content", Icon: BookOpen, lbl: "Content quality" },
      { id: "support", Icon: MessagesSquare, lbl: "Support and help" },
    ],
    extraLabel: "Which class is your child in?",
    extraOptions: ["PUC 1 (Class 11)", "PUC 2 (Class 12)", "Both"],
    specific: [
      { id: "visibility", lbl: "Visibility into your child's progress" },
      { id: "value", lbl: "Value for the subscription cost" },
      { id: "safety", lbl: "Platform safety and moderation" },
      { id: "support", lbl: "Customer support responsiveness" },
    ],
    tyTitle: "Thank you for your feedback!",
    tyMsg:
      "Parent perspectives shape how we design the platform. We read every response and act on the most common themes.",
  },
};

function FeedbackFormBody({ onDone }: { onDone?: () => void }) {
  const { toast } = useToast();
  const [role, setRole] = useState<FeedbackRole | null>(null);
  const [overall, setOverall] = useState(0);
  const [features, setFeatures] = useState<string[]>([]);
  const [extraVal, setExtraVal] = useState<string | null>(null);
  const [ratings, setRatings] = useState<Record<string, number>>({});
  const [nps, setNps] = useState<number | null>(null);
  const [issueCategory, setIssueCategory] = useState<string | null>(null);
  const [issueText, setIssueText] = useState("");
  const [suggestion, setSuggestion] = useState("");
  const [view, setView] = useState<"form" | "thankyou">("form");
  const [submitting, setSubmitting] = useState(false);

  const roleData = role ? DATA[role] : null;

  const progressPct = useMemo(() => {
    if (!role) return 8;
    let sc = 15;
    if (overall) sc += 18;
    if (features.length) sc += 12;
    if (extraVal) sc += 8;
    const rd = Object.keys(ratings).length;
    const rt = DATA[role].specific.length;
    sc += Math.round((rd / rt) * 18);
    if (nps !== null) sc += 12;
    if (issueCategory || issueText.trim()) sc += 8;
    if (suggestion.trim()) sc += 9;
    return Math.min(100, sc);
  }, [role, overall, features, extraVal, ratings, nps, issueCategory, issueText, suggestion]);

  const canSubmit = Boolean(role && overall && features.length);

  const resetForm = useCallback(() => {
    setRole(null);
    setOverall(0);
    setFeatures([]);
    setExtraVal(null);
    setRatings({});
    setNps(null);
    setIssueCategory(null);
    setIssueText("");
    setSuggestion("");
    setView("form");
  }, []);

  const selectRole = (r: FeedbackRole) => {
    setRole(r);
    setFeatures([]);
    setExtraVal(null);
    setRatings({});
  };

  const toggleFeature = (id: string) => {
    setFeatures((prev) => {
      const i = prev.indexOf(id);
      if (i > -1) return prev.filter((x) => x !== id);
      if (prev.length < 3) return [...prev, id];
      return prev;
    });
  };

  const pickIssueCategory = (label: string) => {
    setIssueCategory((prev) => (prev === label ? null : label));
  };

  const doSubmit = async () => {
    if (!canSubmit || !role) return;
    setSubmitting(true);
    try {
      const res = await fetch("/api/platform-feedback", {
        method: "POST",
        credentials: "include",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          role,
          overall,
          features,
          extraVal,
          ratings,
          nps,
          issueCategory,
          issueText: issueText.trim(),
          suggestion: suggestion.trim(),
        }),
      });
      if (!res.ok) {
        const err = (await res.json().catch(() => ({}))) as { error?: string };
        throw new Error(
          err.error ?? `Could not submit feedback (HTTP ${res.status})`
        );
      }
      setView("thankyou");
    } catch (e) {
      console.error("[feedback] submit", e);
      toast({
        title: "Submission failed",
        description: e instanceof Error ? e.message : "Please try again.",
        variant: "destructive",
      });
    } finally {
      setSubmitting(false);
    }
  };

  if (view === "thankyou" && role && roleData) {
    return (
      <div className="eb-fb-root">
        <div className="eb-fb-wrap eb-fb-wrap--thankyou">
          <div className="eb-fb-thankyou">
            <div className="eb-fb-ty-card">
              <div className="eb-fb-ty-ico" aria-hidden>
                <Check strokeWidth={2.5} />
              </div>
              <p className="eb-fb-ty-kicker">Feedback received</p>
              <h3 className="eb-fb-ty-title">{roleData.tyTitle}</h3>
              <p className="eb-fb-ty-sub">{roleData.tyMsg}</p>
              <button
                type="button"
                className="eb-fb-ty-done"
                onClick={() => {
                  resetForm();
                  onDone?.();
                }}
              >
                Done
              </button>
            </div>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="eb-fb-root">
      <div className="eb-fb-wrap">
        <div className="eb-fb-form-head">
          <div className="eb-fb-brand-tag">
            <MessageCircle aria-hidden />
            EduBlast feedback
          </div>
          <div className="eb-fb-form-title">Share your experience</div>
          <div className="eb-fb-form-sub">
            Takes under 3 minutes. Your honest feedback shapes the platform every week.
          </div>
        </div>

        <div className="eb-fb-progress-bar">
          <div className="eb-fb-progress-fill" style={{ width: `${progressPct}%` }} />
        </div>

        <div className="eb-fb-section">
          <div className="eb-fb-field-label">
            <UserCircle style={{ width: 16, height: 16, color: "var(--teal)" }} aria-hidden />
            Who are you?
            <span className="eb-fb-req">required</span>
          </div>
          <div className="eb-fb-role-grid">
            {(
              [
                { id: "student" as const, Icon: GraduationCap, lbl: "Student", sub: "PUC 1 or 2" },
                { id: "teacher" as const, Icon: Presentation, lbl: "Teacher", sub: "or tutor" },
                { id: "parent" as const, Icon: Heart, lbl: "Parent", sub: "or guardian" },
              ] as const
            ).map((r) => (
              <button
                key={r.id}
                type="button"
                className={cn("eb-fb-role-card", role === r.id && "sel")}
                onClick={() => selectRole(r.id)}
              >
                <r.Icon className="eb-fb-rc-ico" style={{ width: 24, height: 24 }} aria-hidden />
                <div className="eb-fb-rc-lbl">{r.lbl}</div>
                <div className="eb-fb-rc-sub">{r.sub}</div>
              </button>
            ))}
          </div>
        </div>

        {role && roleData ? (
          <>
            <div className="eb-fb-divider" />

            <div className="eb-fb-section">
              <div className="eb-fb-section-heading">
                <Star aria-hidden />
                Overall experience
              </div>
              <div className="eb-fb-field-label">
                How satisfied are you with EduBlast overall?
                <span className="eb-fb-req">required</span>
              </div>
              <div className="eb-fb-star-row">
                {[1, 2, 3, 4, 5].map((v) => (
                  <button
                    key={v}
                    type="button"
                    className={cn("eb-fb-star", overall >= v && "on")}
                    aria-label={`${v} star${v > 1 ? "s" : ""}`}
                    onClick={() => setOverall(v)}
                  >
                    &#9733;
                  </button>
                ))}
                <span className={cn("eb-fb-star-lbl", overall > 0 && "rated")}>
                  {overall ? STAR_LBLS[overall] : "tap to rate"}
                </span>
              </div>
            </div>

            <div className="eb-fb-section">
              <div className="eb-fb-field-label">
                Which features do you use most?
                <span className="eb-fb-req">required</span>
                <span style={{ fontSize: 11, color: "var(--t3)", marginLeft: 4 }}>
                  (choose up to 3)
                </span>
              </div>
              <div className="eb-fb-tick-grid">
                {roleData.features.map((f) => (
                  <button
                    key={f.id}
                    type="button"
                    className={cn("eb-fb-tick-item", features.includes(f.id) && "sel")}
                    onClick={() => toggleFeature(f.id)}
                  >
                    <f.Icon aria-hidden />
                    {f.lbl}
                  </button>
                ))}
              </div>
            </div>

            <div className="eb-fb-section">
              <div
                className="eb-fb-field-label"
                style={{ fontWeight: 400, color: "var(--t2)", marginBottom: 6 }}
              >
                {roleData.extraLabel}
              </div>
              <div className="eb-fb-tick-grid">
                {roleData.extraOptions.map((o) => (
                  <button
                    key={o}
                    type="button"
                    className={cn("eb-fb-tick-item", extraVal === o && "sel")}
                    onClick={() => setExtraVal(o)}
                  >
                    <Check aria-hidden />
                    {o}
                  </button>
                ))}
              </div>
            </div>

            <div className="eb-fb-divider" />

            <div className="eb-fb-issue-section">
              <div className="eb-fb-section-heading" style={{ marginBottom: 6 }}>
                <AlertCircle aria-hidden />
                List issues (if any)
                <span className="eb-fb-issue-count">optional</span>
              </div>
              <div className="eb-fb-helper" style={{ marginBottom: 8 }}>
                Tell us about any bugs, broken features, content errors, or anything that
                frustrated you. Be as specific as possible — menu name, step, device, and what
                you expected to happen.
              </div>
              <div className="eb-fb-issue-chips">
                {ISSUE_CHIP_LABELS.map((label) => (
                  <button
                    key={label}
                    type="button"
                    className={cn("eb-fb-issue-chip", issueCategory === label && "on")}
                    aria-label={`${label} category`}
                    onClick={() => pickIssueCategory(label)}
                  >
                    {label}
                  </button>
                ))}
              </div>
              <textarea
                className="eb-fb-textarea"
                style={{ minHeight: 100 }}
                maxLength={1000}
                placeholder="e.g. Clicking 'Submit' on the CBSE MCQ quiz in Prep + Mock shows a blank white screen on my Android phone. Expected to see the score summary page. Happened twice on 28 May 2026..."
                value={issueText}
                onChange={(e) => setIssueText(e.target.value)}
              />
              <div
                style={{
                  display: "flex",
                  justifyContent: "space-between",
                  alignItems: "center",
                  marginTop: 5,
                }}
              >
                <span style={{ fontSize: 11, color: "var(--t3)" }}>
                  Leave blank if you have no issues to report
                </span>
                <span style={{ fontSize: 11, color: "var(--rl)" }}>
                  {1000 - issueText.length} chars remaining
                </span>
              </div>
            </div>

            <div className="eb-fb-divider" />
            <div className="eb-fb-section">
              <div className="eb-fb-section-heading">
                <BarChart3 aria-hidden />
                Specific ratings
              </div>
              {roleData.specific.map((r) => (
                <div key={r.id} className="eb-fb-specific-block">
                  <div className="eb-fb-specific-lbl">{r.lbl}</div>
                  <div className="eb-fb-rating-scale">
                    {[1, 2, 3, 4, 5].map((v) => (
                      <button
                        key={v}
                        type="button"
                        className={cn("eb-fb-rs-btn", (ratings[r.id] ?? 0) >= v && "on")}
                        aria-label={`${v} — ${RATING_LBLS[v]}`}
                        onClick={() =>
                          setRatings((prev) => ({
                            ...prev,
                            [r.id]: v,
                          }))
                        }
                      >
                        {v}
                      </button>
                    ))}
                  </div>
                </div>
              ))}
            </div>

            <div className="eb-fb-divider" />

            <div className="eb-fb-section">
              <div className="eb-fb-section-heading">
                <Share2 aria-hidden />
                Likelihood to recommend
              </div>
              <div
                className="eb-fb-field-label"
                style={{ fontWeight: 400, color: "var(--t2)", marginBottom: 8 }}
              >
                How likely are you to recommend EduBlast to someone you know?
              </div>
              <div className="eb-fb-nps-wrap">
                <div className="eb-fb-nps-row">
                  {Array.from({ length: 11 }, (_, i) => (
                    <button
                      key={i}
                      type="button"
                      className={cn("eb-fb-nps-btn", nps === i && "on")}
                      aria-label={
                        i === 0
                          ? "0 - Not at all likely"
                          : i === 10
                            ? "10 - Extremely likely"
                            : String(i)
                      }
                      onClick={() => setNps(i)}
                    >
                      {i}
                    </button>
                  ))}
                </div>
                <div className="eb-fb-nps-labels">
                  <span>Not likely at all</span>
                  <span>Extremely likely</span>
                </div>
              </div>
            </div>

            <div className="eb-fb-divider" />

            <div className="eb-fb-section">
              <div className="eb-fb-section-heading">
                <Lightbulb aria-hidden />
                Your suggestion
              </div>
              <div
                className="eb-fb-field-label"
                style={{ fontWeight: 400, color: "var(--t2)", marginBottom: 4 }}
              >
                What is the one thing we should improve or add?
              </div>
              <div className="eb-fb-helper">
                Be as specific as you like. One idea done well is more useful than ten vague
                wishes.
              </div>
              <textarea
                className="eb-fb-textarea"
                style={{ minHeight: 90 }}
                placeholder="e.g. I wish the Gyan++ doubt feed had a filter by chapter..."
                value={suggestion}
                onChange={(e) => setSuggestion(e.target.value)}
              />
            </div>

            <div className="eb-fb-submit-area">
              <div className="eb-fb-privacy-note">
                <Lock aria-hidden />
                Responses are anonymous and used only to improve EduBlast. No personal data is
                required.
              </div>
              <button
                type="button"
                className="eb-fb-submit-btn"
                disabled={!canSubmit || submitting}
                onClick={() => void doSubmit()}
              >
                <Send style={{ width: 14, height: 14 }} aria-hidden />
                {submitting ? "Submitting…" : "Submit feedback"}
              </button>
            </div>
          </>
        ) : null}
      </div>
    </div>
  );
}

/** Settings sidebar card + modal with investor feedback form. */
export default function EduBlastFeedbackForm() {
  const [open, setOpen] = useState(false);
  const [formKey, setFormKey] = useState(0);

  return (
    <>
      <div className="rounded-2xl border border-border bg-card p-4 dark:border-white/10 dark:bg-[#0d1118] 2xl:rounded-[1.125rem] 2xl:p-6">
        <div className="mb-0.5 flex items-center justify-between 2xl:mb-1">
          <h2 className="flex items-center gap-1.5 text-lg font-black text-foreground dark:text-white 2xl:gap-2 2xl:text-xl">
            <MessageCircle
              className="h-4 w-4 shrink-0 text-emerald-400 2xl:h-5 2xl:w-5"
              strokeWidth={2}
            />
            Feedback
          </h2>
          <span className="rounded-full bg-emerald-500/20 px-2 py-0.5 text-xs font-bold text-emerald-300">
            Survey
          </span>
        </div>
        <p className="text-sm text-muted-foreground dark:text-slate-400">
          Share your experience in under 3 minutes. Honest ratings and issue reports shape what we
          ship each week.
        </p>
        <Button
          type="button"
          variant="link"
          className="mt-2 h-auto p-0 text-[#1d9e75] hover:text-[#9fe1cb] 2xl:mt-3"
          onClick={() => setOpen(true)}
        >
          Open feedback form →
        </Button>
      </div>

      <Dialog
        open={open}
        onOpenChange={(next) => {
          setOpen(next);
          if (!next) setFormKey((k) => k + 1);
        }}
      >
        <DialogContent
          className="max-h-[92vh] max-w-[680px] overflow-y-auto border-[#2a3347] bg-[#0e1117] p-0 text-[#e8eaf0] sm:rounded-xl"
          overlayClassName="bg-black/85"
        >
          <DialogHeader className="sr-only">
            <DialogTitle>EduBlast feedback</DialogTitle>
          </DialogHeader>
          <FeedbackFormBody key={formKey} onDone={() => setOpen(false)} />
        </DialogContent>
      </Dialog>
    </>
  );
}

export function ContactUsSettingsCard({ fromPath }: { fromPath: string }) {
  const href = `/contact?from=${encodeURIComponent(fromPath)}`;

  return (
    <div className="rounded-2xl border border-border bg-card p-4 dark:border-white/10 dark:bg-[#0d1118] 2xl:rounded-[1.125rem] 2xl:p-6">
      <div className="mb-0.5 flex items-center justify-between 2xl:mb-1">
        <h2 className="flex items-center gap-1.5 text-lg font-black text-foreground dark:text-white 2xl:gap-2 2xl:text-xl">
          <MessageCircle
            className="h-4 w-4 shrink-0 text-emerald-400 2xl:h-5 2xl:w-5"
            strokeWidth={2}
          />
          Contact Us
        </h2>
        <span className="rounded-full bg-emerald-500/20 px-2 py-0.5 text-xs font-bold text-emerald-300">
          Help
        </span>
      </div>
      <p className="text-sm text-muted-foreground dark:text-slate-400">
        Report an issue, ask for partnerships, or share suggestions. We usually reply within
        24–48 hours.
      </p>
      <Button
        variant="link"
        className="mt-2 h-auto p-0 text-[#1d9e75] hover:text-[#9fe1cb] 2xl:mt-3"
        asChild
      >
        <Link href={href}>Open contact desk →</Link>
      </Button>
    </div>
  );
}
