"use client";

import { useState, useEffect, useCallback, useRef } from "react";
import { useParams, useRouter } from "next/navigation";
import Link from "next/link";
import { motion } from "framer-motion";
import AppLayout from "@/components/AppLayout";
import { supabase } from "@/integrations/supabase/client";
import { ProtectedRoute } from "@/components/ProtectedRoute";
import { useAuth } from "@/hooks/useAuth";
import { useToast } from "@/hooks/use-toast";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogFooter,
  DialogDescription,
} from "@/components/ui/dialog";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import {
  ArrowLeft,
  ChevronUp,
  ChevronDown,
  MessageSquare,
  Check,
  Loader2,
  Flag,
  ClipboardCheck,
  MoreVertical,
  Pencil,
  Trash2,
  GraduationCap,
} from "lucide-react";
import DoubtMarkdown from "@/components/doubts/DoubtMarkdown";
import { ProfPiAvatar } from "@/components/doubts/ProfPiAvatar";
import { stripHtml, isAiTutorAnswer, getSubjectColor, DOUBT_FLAIRS } from "@/components/doubts/doubtTypes";
import { AiCurriculumSourceStrip, pickCurriculumNodeFromDoubt } from "@/components/doubts/AiCurriculumSourceStrip";
import { canonicalDoubtSubject } from "@/lib/doubtSubject";
import { PROF_PI_CONFIG } from "@/lib/gyanBotPersonas";
import { applyNormalizedPasteToField, normalizePastedMathForDoubt } from "@/lib/normalizePastedDoubtMath";
import { UserHoverCard } from "@/components/UserHoverCard";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";

type Doubt = {
  id: string;
  user_id: string;
  title: string;
  body: string;
  subject: string | null;
  upvotes: number;
  downvotes: number;
  is_resolved: boolean;
  created_at: string;
  profiles?: { name: string | null; avatar_url: string | null; role?: string | null } | null;
  gyan_curriculum_nodes?: {
    chapter_label: string;
    topic_label: string;
    subtopic_label: string | null;
  } | null;
};

type Answer = {
  id: string;
  doubt_id: string;
  user_id: string;
  body: string;
  upvotes: number;
  downvotes: number;
  is_accepted: boolean;
  hidden: boolean;
  created_at: string;
  profiles?: { name: string | null; avatar_url: string | null; role?: string | null } | null;
};

type VoteRow = { target_type: string; target_id: string; vote_type: number };

function answerAuthorDisplayName(a: Answer): string {
  return isAiTutorAnswer(a) ? PROF_PI_CONFIG.name : (a.profiles?.name ?? "Someone");
}

const REPORT_REASONS = [
  "ai_spam",
  "plagiarism",
  "off_topic",
  "incorrect_formula",
  "other",
] as const;

function reportReasonLabel(r: (typeof REPORT_REASONS)[number]): string {
  switch (r) {
    case "ai_spam":
      return "AI spam / low quality";
    case "plagiarism":
      return "Plagiarism";
    case "off_topic":
      return "Off topic";
    case "incorrect_formula":
      return "Incorrect formula or fact";
    case "other":
      return "Other";
    default:
      return r;
  }
}
export default function DoubtDetailPage() {
  const params = useParams();
  const router = useRouter();
  const id = params?.id as string;
  const { user, profile } = useAuth();
  const { toast } = useToast();
  const [doubt, setDoubt] = useState<Doubt | null>(null);
  const [answers, setAnswers] = useState<Answer[]>([]);
  const [myVotes, setMyVotes] = useState<VoteRow[]>([]);
  const [loading, setLoading] = useState(true);
  const [answerBody, setAnswerBody] = useState("");
  const [submitLoading, setSubmitLoading] = useState(false);
  const [votingId, setVotingId] = useState<string | null>(null);
  const [acceptingId, setAcceptingId] = useState<string | null>(null);
  const [reportAnswerId, setReportAnswerId] = useState<string | null>(null);
  const [reportReason, setReportReason] = useState<string>("ai_spam");
  const [reportSubmitting, setReportSubmitting] = useState(false);
  const [editDoubtOpen, setEditDoubtOpen] = useState(false);
  const [editDoubtTitle, setEditDoubtTitle] = useState("");
  const [editDoubtBody, setEditDoubtBody] = useState("");
  const [editDoubtSubject, setEditDoubtSubject] = useState("");
  const [editDoubtSaving, setEditDoubtSaving] = useState(false);
  const [deleteDoubtConfirmOpen, setDeleteDoubtConfirmOpen] = useState(false);
  const [deleteDoubtLoading, setDeleteDoubtLoading] = useState(false);
  const [editAnswerId, setEditAnswerId] = useState<string | null>(null);
  const [editAnswerBody, setEditAnswerBody] = useState("");
  const [editAnswerSaving, setEditAnswerSaving] = useState(false);
  const [deleteAnswerId, setDeleteAnswerId] = useState<string | null>(null);
  const [deleteAnswerLoading, setDeleteAnswerLoading] = useState(false);
  const [similarDoubts, setSimilarDoubts] = useState<{ id: string; title: string; similarity_score: number }[]>([]);
  const hashScrollDoneKey = useRef<string | null>(null);

  const getErrorMessage = (error: unknown, fallback: string) => {
    if (error && typeof error === "object" && "message" in error) {
      return String(error.message);
    }
    if (error instanceof Error) return error.message;
    return fallback;
  };

  const fetchDoubt = useCallback(async () => {
    if (!id) return;
    const { data, error } = await supabase
      .from("doubts")
      .select(
        "*, profiles!doubts_user_id_fkey(name, avatar_url, role), gyan_curriculum_nodes(chapter_label, topic_label, subtopic_label)",
      )
      .eq("id", id)
      .maybeSingle();
    if (error || !data) {
      setDoubt(null);
      return;
    }
    setDoubt(data as Doubt);
  }, [id]);

  const fetchAnswers = useCallback(async () => {
    if (!id) return;
    const { data, error } = await supabase
      .from("doubt_answers")
      .select("*, profiles!doubt_answers_user_id_fkey(name, avatar_url, role)")
      .eq("doubt_id", id)
      .eq("hidden", false)
      .order("is_accepted", { ascending: false })
      .order("upvotes", { ascending: false })
      .order("created_at", { ascending: true });
    if (error) {
      setAnswers([]);
      return;
    }
    setAnswers((data as Answer[]) || []);
  }, [id]);

  const fetchMyVotes = useCallback(async () => {
    if (!user?.id || !id) return;
    const answerIds = answers.map((a) => a.id);
    const votes: VoteRow[] = [];
    const { data: doubtVote } = await supabase
      .from("doubt_votes")
      .select("target_type, target_id, vote_type")
      .eq("user_id", user.id)
      .eq("target_type", "doubt")
      .eq("target_id", id)
      .maybeSingle();
    if (doubtVote) votes.push(doubtVote);
    if (answerIds.length > 0) {
      const { data: answerVotes } = await supabase
        .from("doubt_votes")
        .select("target_type, target_id, vote_type")
        .eq("user_id", user.id)
        .eq("target_type", "answer")
        .in("target_id", answerIds);
      if (answerVotes?.length) votes.push(...answerVotes);
    }
    setMyVotes(votes);
  }, [user, id, answers]);

  useEffect(() => {
    if (!id) return;
    queueMicrotask(() => {
      setLoading(true);
      Promise.all([fetchDoubt(), fetchAnswers()]).then(() => setLoading(false));
    });
  }, [id, fetchDoubt, fetchAnswers]);

  useEffect(() => {
    if (id) supabase.rpc("increment_doubt_views", { p_doubt_id: id }).then(() => { });
  }, [id]);

  useEffect(() => {
    if (!doubt?.title?.trim() || !id) {
      queueMicrotask(() => setSimilarDoubts([]));
      return;
    }
    supabase
      .rpc("search_doubt_duplicates", { p_title: doubt.title.trim() })
      .then(({ data }) => {
        const rows = (data || []) as { id: string; title: string; similarity_score: number }[];
        setSimilarDoubts(rows.filter((r) => r.id !== id));
      });
  }, [doubt?.id, doubt?.title, id]);

  useEffect(() => {
    queueMicrotask(() => {
      void fetchMyVotes();
    });
  }, [fetchMyVotes]);

  /** Deep-link from feed: #doubt-body, #doubt-answers, #answer-… */
  useEffect(() => {
    if (loading || !doubt?.id) return;
    const raw = typeof window !== "undefined" ? window.location.hash.replace(/^#/, "").trim() : "";
    if (!raw) return;
    const key = `${doubt.id}:${raw}`;
    const el = document.getElementById(raw);
    if (!el) return;
    if (hashScrollDoneKey.current === key) return;
    requestAnimationFrame(() => {
      el.scrollIntoView({ behavior: "smooth", block: "start" });
      hashScrollDoneKey.current = key;
    });
  }, [loading, doubt?.id, answers]);

  useEffect(() => {
    hashScrollDoneKey.current = null;
  }, [id]);

  const refetchAll = useCallback(() => {
    fetchDoubt();
    fetchAnswers();
    fetchMyVotes();
  }, [fetchDoubt, fetchAnswers, fetchMyVotes]);

  const getMyVote = (targetType: string, targetId: string): number => {
    const v = myVotes.find((x) => x.target_type === targetType && x.target_id === targetId);
    return v?.vote_type ?? 0;
  };

  const handleVote = async (targetType: "doubt" | "answer", targetId: string, voteType: 1 | -1) => {
    if (!user || !targetId || votingId) return;
    setVotingId(targetId);
    try {
      const { data, error } = await supabase.rpc("vote_on_doubt", {
        p_target_type: targetType,
        p_target_id: targetId,
        p_vote_type: voteType,
      });
      if (error) throw error;
      const res = data as { ok: boolean; upvotes?: number; downvotes?: number; error?: string };
      if (res?.ok) {
        refetchAll();
      } else {
        toast({ title: "Vote failed", description: res?.error ?? "Unable to process vote.", variant: "destructive" });
      }
    } catch (error: unknown) {
      toast({ title: "Vote failed", description: getErrorMessage(error, "Network error while voting."), variant: "destructive" });
    } finally {
      setVotingId(null);
    }
  };

  const handleAccept = async (answerId: string) => {
    if (!id || !user || !answerId || acceptingId) return;
    setAcceptingId(answerId);
    try {
      const { data, error } = await supabase.rpc("accept_doubt_answer", {
        p_doubt_id: id,
        p_answer_id: answerId,
        p_bonus_rdm: 10,
      });
      if (error) throw error;
      const res = data as { ok: boolean; rdm_paid?: number; error?: string };
      if (res?.ok) {
        toast({ title: "Answer accepted!" + (res.rdm_paid ? ` ${res.rdm_paid} RDM to the answerer.` : "") });
        refetchAll();
      } else {
        toast({ title: "Could not accept answer", description: res?.error ?? "Unable to accept this answer.", variant: "destructive" });
      }
    } catch (error: unknown) {
      toast({ title: "Could not accept answer", description: getErrorMessage(error, "Network error while accepting answer."), variant: "destructive" });
    } finally {
      setAcceptingId(null);
    }
  };

  const handlePostAnswer = async () => {
    if (!user?.id || !id || !answerBody.trim() || submitLoading) {
      toast({ title: "Write an answer", variant: "destructive" });
      return;
    }
    const body = answerBody.trim();
    setSubmitLoading(true);
    try {
      const { error } = await supabase.from("doubt_answers").insert({
        doubt_id: id,
        user_id: user.id,
        body,
      });
      if (error) throw error;
      toast({ title: "Answer posted!" });
      setAnswerBody("");
      refetchAll();
    } catch (error: unknown) {
      toast({ title: "Could not post answer", description: getErrorMessage(error, "Network error while posting answer."), variant: "destructive" });
    } finally {
      setSubmitLoading(false);
    }
  };

  const handleEditDoubtOpen = () => {
    if (!doubt) return;
    setEditDoubtTitle(doubt.title);
    setEditDoubtBody(doubt.body || "");
    setEditDoubtSubject(doubt.subject || "");
    setEditDoubtOpen(true);
  };

  const handleEditDoubtSave = async () => {
    if (!id || !editDoubtTitle.trim() || editDoubtSaving) {
      toast({ title: "Title required", variant: "destructive" });
      return;
    }
    const nt = normalizePastedMathForDoubt(editDoubtTitle.trim());
    const nb = normalizePastedMathForDoubt(editDoubtBody.trim());
    setEditDoubtTitle(nt);
    setEditDoubtBody(nb);
    setEditDoubtSaving(true);
    try {
      const { error } = await supabase
        .from("doubts")
        .update({
          title: nt,
          body: nb,
          subject: editDoubtSubject.trim() || null,
        })
        .eq("id", id);
      if (error) throw error;
      setEditDoubtOpen(false);
      toast({ title: "Question updated" });
      fetchDoubt();
    } catch (error: unknown) {
      toast({ title: "Could not update question", description: getErrorMessage(error, "Network error while updating question."), variant: "destructive" });
    } finally {
      setEditDoubtSaving(false);
    }
  };

  const handleDeleteDoubt = async () => {
    if (!id || deleteDoubtLoading) return;
    setDeleteDoubtLoading(true);
    try {
      const { error } = await supabase.from("doubts").delete().eq("id", id);
      if (error) throw error;
      setDeleteDoubtConfirmOpen(false);
      toast({ title: "Question deleted" });
      router.push("/doubts");
    } catch (error: unknown) {
      toast({ title: "Could not delete question", description: getErrorMessage(error, "Network error while deleting question."), variant: "destructive" });
    } finally {
      setDeleteDoubtLoading(false);
    }
  };

  const handleEditAnswerOpen = (a: Answer) => {
    setEditAnswerId(a.id);
    setEditAnswerBody(a.body);
  };

  const handleEditAnswerSave = async () => {
    if (!editAnswerId || !editAnswerBody.trim() || editAnswerSaving) return;
    setEditAnswerSaving(true);
    try {
      const { error } = await supabase.from("doubt_answers").update({ body: editAnswerBody.trim() }).eq("id", editAnswerId);
      if (error) throw error;
      setEditAnswerId(null);
      toast({ title: "Answer updated" });
      fetchAnswers();
    } catch (error: unknown) {
      toast({ title: "Could not update answer", description: getErrorMessage(error, "Network error while updating answer."), variant: "destructive" });
    } finally {
      setEditAnswerSaving(false);
    }
  };

  const handleDeleteAnswerConfirm = async () => {
    if (!deleteAnswerId || deleteAnswerLoading) return;
    setDeleteAnswerLoading(true);
    try {
      const { error } = await supabase.from("doubt_answers").delete().eq("id", deleteAnswerId);
      if (error) throw error;
      setDeleteAnswerId(null);
      toast({ title: "Answer deleted" });
      fetchAnswers();
    } catch (error: unknown) {
      toast({ title: "Could not delete answer", description: getErrorMessage(error, "Network error while deleting answer."), variant: "destructive" });
    } finally {
      setDeleteAnswerLoading(false);
    }
  };

  const handleReportOpen = (answerId: string) => {
    setReportAnswerId(answerId);
    setReportReason("ai_spam");
  };

  const handleReportSubmit = async () => {
    if (!user?.id || !reportAnswerId || reportSubmitting) return;
    setReportSubmitting(true);
    try {
      const { error } = await supabase.from("doubt_answer_reports").insert({
        answer_id: reportAnswerId,
        reporter_user_id: user.id,
        reason: reportReason,
      });
      if (error) throw error;
      setReportAnswerId(null);
      toast({ title: "Report received. Thank you." });
      refetchAll();
    } catch (error: unknown) {
      if (
        error &&
        typeof error === "object" &&
        "code" in error &&
        String(error.code) === "23505"
      ) {
        toast({ title: "You already reported this answer", variant: "destructive" });
      } else {
        toast({ title: "Report failed", description: getErrorMessage(error, "Network error while reporting answer."), variant: "destructive" });
      }
    } finally {
      setReportSubmitting(false);
    }
  };

  if (loading && !doubt) {
    return (
      <ProtectedRoute>
        <AppLayout>
          <div className="max-w-3xl mx-auto px-4 py-8 flex justify-center">
            <Loader2 className="w-8 h-8 animate-spin text-muted-foreground" />
          </div>
        </AppLayout>
      </ProtectedRoute>
    );
  }

  if (!doubt) {
    return (
      <ProtectedRoute>
        <AppLayout>
          <div className="max-w-3xl mx-auto px-4 py-8 text-center">
            <p className="text-muted-foreground">Question not found.</p>
            <Button variant="outline" className="rounded-xl mt-4" onClick={() => router.push("/doubts")}>
              Back to Gyan++
            </Button>
          </div>
        </AppLayout>
      </ProtectedRoute>
    );
  }

  const isAuthor = user?.id === doubt.user_id;
  const netDoubt = doubt.upvotes - doubt.downvotes;
  const subjectChip = canonicalDoubtSubject(doubt.subject) ?? doubt.subject?.trim() ?? null;
  const subjectForMock = subjectChip || "this topic";
  const curriculumNode = pickCurriculumNodeFromDoubt(doubt);
  const showCurriculumSource = Boolean(curriculumNode);
  const subjectTone = subjectChip ? getSubjectColor(subjectChip) : null;

  const aiAnswerList = answers.filter(isAiTutorAnswer);
  const teacherAnswerList = answers.filter((a) => a.profiles?.role === "teacher");
  const studentAnswerList = answers.filter((a) => a.profiles?.role !== "teacher" && !isAiTutorAnswer(a));
  const hasAiThreadLayout = aiAnswerList.length > 0;
  const showStudentReplyForm = Boolean(user && !(hasAiThreadLayout && profile?.role === "teacher"));
  const showTeacherReplyForm = Boolean(user && hasAiThreadLayout && profile?.role === "teacher");

  const renderAnswerCard = (a: Answer) => {
    const netAnswer = a.upvotes - a.downvotes;
    const myVote = getMyVote("answer", a.id);
    return (
      <motion.div
        key={a.id}
        id={`answer-${a.id}`}
        initial={{ opacity: 0, y: 8 }}
        animate={{ opacity: 1, y: 0 }}
        className={`edu-card p-5 rounded-2xl scroll-mt-24 ${a.is_accepted ? "border-edu-green/50 bg-edu-green/5" : ""}`}
      >
        <div className="flex gap-4">
          <div className="flex flex-col items-center shrink-0">
            <Button
              variant={myVote === 1 ? "default" : "outline"}
              size="icon"
              className="rounded-xl h-8 w-8"
              disabled={!!votingId}
              onClick={() => handleVote("answer", a.id, 1)}
            >
              {votingId === a.id ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : <ChevronUp className="w-3.5 h-3.5" />}
            </Button>
            <span className="font-bold text-sm my-0.5">{netAnswer}</span>
            <Button
              variant={myVote === -1 ? "default" : "outline"}
              size="icon"
              className="rounded-xl h-8 w-8"
              disabled={!!votingId}
              onClick={() => handleVote("answer", a.id, -1)}
            >
              <ChevronDown className="w-3.5 h-3.5" />
            </Button>
          </div>
          <div className="flex-1 min-w-0">
            {a.is_accepted && (
              <span className="inline-flex items-center gap-1 text-edu-green text-sm font-semibold mb-2">
                <Check className="w-4 h-4" /> Accepted answer
              </span>
            )}
            <div className="text-sm text-foreground">
              <DoubtMarkdown content={stripHtml(a.body)} />
            </div>
            {doubt.is_resolved && a.is_accepted && (
              <div className="mt-4 p-4 rounded-xl bg-primary/10 border border-primary/20">
                <p className="text-sm font-medium text-foreground mb-2 flex items-center gap-2">
                  <ClipboardCheck className="w-4 h-4 text-primary" />
                  Mastered this? Take a 15-minute mock test on {subjectForMock} to see where you stand.
                </p>
                <Button size="sm" className="rounded-xl" asChild>
                  <Link href={`/mock?subject=${encodeURIComponent(subjectForMock)}`}>Start Test</Link>
                </Button>
              </div>
            )}
            <div className="flex items-center justify-between mt-2 flex-wrap gap-2">
              <span className="flex items-center gap-2 text-xs text-muted-foreground">
                <UserHoverCard userId={a.user_id}>
                  <span className="flex items-center gap-2 cursor-pointer group">
                    {isAiTutorAnswer(a) ? (
                      <ProfPiAvatar size="sm" />
                    ) : (
                      <Avatar className="h-7 w-7 rounded-lg shrink-0">
                        <AvatarImage src={a.profiles?.avatar_url ?? undefined} />
                        <AvatarFallback className="rounded-lg text-xs">
                          {(a.profiles?.name ?? "?").slice(0, 2).toUpperCase()}
                        </AvatarFallback>
                      </Avatar>
                    )}
                    <span className="font-medium text-foreground group-hover:text-primary group-hover:underline">
                      {answerAuthorDisplayName(a)}
                    </span>
                  </span>
                </UserHoverCard>
                {" · "}
                {new Date(a.created_at).toLocaleString(undefined, { dateStyle: "short", timeStyle: "short" })}
              </span>
              <div className="flex items-center gap-1">
                {user && user.id === a.user_id && !a.is_accepted && !doubt.is_resolved && (
                  <DropdownMenu>
                    <DropdownMenuTrigger asChild>
                      <span className="inline-flex items-center justify-center rounded-xl h-8 w-8 text-muted-foreground hover:bg-accent hover:text-accent-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 cursor-pointer">
                        <MoreVertical className="w-3.5 h-3.5" />
                      </span>
                    </DropdownMenuTrigger>
                    <DropdownMenuContent align="end">
                      <DropdownMenuItem className="rounded-lg" onClick={() => handleEditAnswerOpen(a)}>
                        <Pencil className="w-4 h-4 mr-2" /> Edit
                      </DropdownMenuItem>
                      <DropdownMenuItem
                        className="rounded-lg text-destructive focus:text-destructive"
                        onClick={() => setDeleteAnswerId(a.id)}
                      >
                        <Trash2 className="w-4 h-4 mr-2" /> Delete
                      </DropdownMenuItem>
                    </DropdownMenuContent>
                  </DropdownMenu>
                )}
                {user && user.id !== a.user_id && (
                  <Button
                    size="sm"
                    variant="ghost"
                    className="rounded-xl h-8 w-8 p-0 text-muted-foreground hover:text-destructive"
                    onClick={() => handleReportOpen(a.id)}
                    title="Report"
                  >
                    <Flag className="w-3.5 h-3.5" />
                  </Button>
                )}
                {isAuthor && !doubt.is_resolved && !a.is_accepted && (
                  <Button
                    size="sm"
                    variant="outline"
                    className="rounded-xl"
                    disabled={!!acceptingId}
                    onClick={() => handleAccept(a.id)}
                  >
                    {acceptingId === a.id ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : null} Accept
                  </Button>
                )}
              </div>
            </div>
          </div>
        </div>
      </motion.div>
    );
  };

  return (
    <ProtectedRoute>
      <AppLayout>
        <div className="max-w-3xl mx-auto px-4 py-6">
          <Link href="/doubts" className="inline-flex items-center gap-1 text-sm text-muted-foreground hover:text-foreground mb-4">
            <ArrowLeft className="w-4 h-4" /> Back to Gyan++
          </Link>

          <div className="edu-card p-6 rounded-2xl">
            <div className="flex gap-4">
              <div className="flex flex-col items-center shrink-0">
                <Button
                  variant={getMyVote("doubt", doubt.id) === 1 ? "default" : "outline"}
                  size="icon"
                  className="rounded-xl h-9 w-9"
                  disabled={!!votingId}
                  onClick={() => handleVote("doubt", doubt.id, 1)}
                >
                  {votingId === doubt.id ? <Loader2 className="w-4 h-4 animate-spin" /> : <ChevronUp className="w-4 h-4" />}
                </Button>
                <span className="font-bold text-foreground my-1">{netDoubt}</span>
                <Button
                  variant={getMyVote("doubt", doubt.id) === -1 ? "default" : "outline"}
                  size="icon"
                  className="rounded-xl h-9 w-9"
                  disabled={!!votingId}
                  onClick={() => handleVote("doubt", doubt.id, -1)}
                >
                  <ChevronDown className="w-4 h-4" />
                </Button>
              </div>
              <div className="flex-1 min-w-0">
                <div className="flex items-start justify-between gap-2">
                  <div role="heading" aria-level={1} className="text-xl font-bold text-foreground min-w-0 flex-1">
                    {stripHtml(doubt.title).trim() ? (
                      <DoubtMarkdown
                        content={stripHtml(doubt.title)}
                        className="[&>p]:inline [&>p]:m-0 [&>p]:text-inherit [&>p]:font-bold [&>p]:text-xl"
                      />
                    ) : (
                      <span className="text-muted-foreground">Untitled</span>
                    )}
                  </div>
                  {isAuthor && !doubt.is_resolved && (
                    <DropdownMenu>
                      <DropdownMenuTrigger asChild>
                        <span className="inline-flex items-center justify-center rounded-xl h-8 w-8 shrink-0 text-muted-foreground hover:bg-accent hover:text-accent-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 cursor-pointer">
                          <MoreVertical className="w-4 h-4" />
                        </span>
                      </DropdownMenuTrigger>
                      <DropdownMenuContent align="end">
                        <DropdownMenuItem className="rounded-lg" onClick={handleEditDoubtOpen}>
                          <Pencil className="w-4 h-4 mr-2" /> Edit
                        </DropdownMenuItem>
                        <DropdownMenuItem
                          className="rounded-lg text-destructive focus:text-destructive"
                          onClick={() => setDeleteDoubtConfirmOpen(true)}
                        >
                          <Trash2 className="w-4 h-4 mr-2" /> Delete
                        </DropdownMenuItem>
                      </DropdownMenuContent>
                    </DropdownMenu>
                  )}
                </div>
                <div className="mt-2 flex min-w-0 flex-wrap items-center gap-x-2 gap-y-1.5">
                  {subjectChip ? (
                    <span
                      className={`edu-chip shrink-0 text-xs font-semibold ${subjectTone ? `${subjectTone.bg} ${subjectTone.text}` : "bg-primary/10 text-primary"}`}
                    >
                      {subjectChip}
                    </span>
                  ) : null}
                  {showCurriculumSource && curriculumNode ? (
                    <AiCurriculumSourceStrip
                      node={curriculumNode}
                      className="min-w-0 flex-1 basis-[min(100%,14rem)] sm:basis-auto sm:flex-initial"
                    />
                  ) : null}
                  {doubt.is_resolved && (
                    <span className="edu-chip shrink-0 bg-edu-green/10 text-edu-green text-xs">Resolved</span>
                  )}
                </div>
                <div id="doubt-body" className="mt-3 text-sm text-muted-foreground max-w-none scroll-mt-24">
                  {doubt.body ? (
                    <DoubtMarkdown content={stripHtml(doubt.body)} className="text-foreground/90" />
                  ) : (
                    <p>No additional details.</p>
                  )}
                </div>
                <p className="text-xs text-muted-foreground mt-3">
                  Asked {new Date(doubt.created_at).toLocaleString(undefined, { dateStyle: "medium", timeStyle: "short" })}
                </p>
              </div>
            </div>
          </div>

          <Dialog open={editDoubtOpen} onOpenChange={setEditDoubtOpen}>
            <DialogContent className="rounded-2xl max-w-lg">
              <DialogHeader>
                <DialogTitle>Edit question</DialogTitle>
                <DialogDescription>Update title, details, or subject. You cannot edit after an answer is accepted.</DialogDescription>
              </DialogHeader>
              <div className="space-y-4 py-2">
                <div>
                  <Label className="text-sm font-bold">Title</Label>
                  <Input
                    value={editDoubtTitle}
                    onChange={(e) => setEditDoubtTitle(e.target.value)}
                    onPaste={(e) => {
                      e.preventDefault();
                      const pasted = e.clipboardData.getData("text/plain");
                      const el = e.currentTarget;
                      const { value, caret } = applyNormalizedPasteToField(
                        editDoubtTitle,
                        el.selectionStart ?? 0,
                        el.selectionEnd ?? 0,
                        pasted,
                      );
                      setEditDoubtTitle(value);
                      queueMicrotask(() => el.setSelectionRange(caret, caret));
                    }}
                    placeholder="Question title"
                    className="rounded-xl mt-1"
                  />
                </div>
                <div>
                  <Label className="text-sm font-bold">Details (optional)</Label>
                  <textarea
                    value={editDoubtBody}
                    onChange={(e) => setEditDoubtBody(e.target.value)}
                    onPaste={(e) => {
                      e.preventDefault();
                      const pasted = e.clipboardData.getData("text/plain");
                      const el = e.currentTarget;
                      const { value, caret } = applyNormalizedPasteToField(
                        editDoubtBody,
                        el.selectionStart ?? 0,
                        el.selectionEnd ?? 0,
                        pasted,
                      );
                      setEditDoubtBody(value);
                      queueMicrotask(() => el.setSelectionRange(caret, caret));
                    }}
                    placeholder="Add more context..."
                    className="w-full min-h-[80px] rounded-xl border border-input bg-transparent px-3 py-2 text-sm mt-1 resize-y"
                    rows={3}
                  />
                </div>
                <div>
                  <Label className="text-sm font-bold">Subject</Label>
                  <div className="flex flex-wrap gap-2 mt-1">
                    {DOUBT_FLAIRS.map((flair) => (
                      <Button key={flair} type="button" variant={editDoubtSubject === flair ? "default" : "outline"} size="sm" className="rounded-xl" onClick={() => setEditDoubtSubject(flair)}>{flair}</Button>
                    ))}
                  </div>
                </div>
              </div>
              <DialogFooter>
                <Button variant="outline" className="rounded-xl" onClick={() => setEditDoubtOpen(false)}>Cancel</Button>
                <Button className="rounded-xl" onClick={handleEditDoubtSave} disabled={editDoubtSaving || !editDoubtTitle.trim()}>
                  {editDoubtSaving ? <Loader2 className="w-4 h-4 animate-spin" /> : null} Save
                </Button>
              </DialogFooter>
            </DialogContent>
          </Dialog>

          <Dialog open={deleteDoubtConfirmOpen} onOpenChange={setDeleteDoubtConfirmOpen}>
            <DialogContent className="rounded-2xl max-w-sm">
              <DialogHeader>
                <DialogTitle>Delete question?</DialogTitle>
                <DialogDescription>This cannot be undone. All answers will be removed.</DialogDescription>
              </DialogHeader>
              <DialogFooter>
                <Button variant="outline" className="rounded-xl" onClick={() => setDeleteDoubtConfirmOpen(false)}>Cancel</Button>
                <Button variant="destructive" className="rounded-xl" onClick={handleDeleteDoubt} disabled={deleteDoubtLoading}>
                  {deleteDoubtLoading ? <Loader2 className="w-4 h-4 animate-spin" /> : null} Delete
                </Button>
              </DialogFooter>
            </DialogContent>
          </Dialog>

          {similarDoubts.length > 0 && (
            <div className="mt-6 p-4 rounded-2xl border border-border bg-muted/30">
              <h3 className="font-display text-sm font-bold text-foreground mb-2">Similar questions</h3>
              <ul className="space-y-2">
                {similarDoubts.map((s) => (
                  <li key={s.id}>
                    <Link href={`/doubts/${s.id}`} className="text-sm text-primary hover:underline line-clamp-2 block py-0.5">
                      {s.title}
                    </Link>
                  </li>
                ))}
              </ul>
            </div>
          )}

          <h3 className="font-display text-lg font-bold mt-6 mb-2 flex items-center gap-2">
            <MessageSquare className="w-5 h-5" /> Answers ({answers.length})
          </h3>

          <div id="doubt-answers" className="space-y-4 scroll-mt-24">
            {hasAiThreadLayout ? (
              <>
                {aiAnswerList.map(renderAnswerCard)}
                <div
                  id="teacher-section"
                  className="rounded-2xl border border-emerald-500/30 overflow-hidden scroll-mt-24 bg-emerald-500/[0.03]"
                >
                  <div className="flex items-center justify-between px-4 sm:px-5 py-2 bg-emerald-500/10 border-b border-emerald-500/20">
                    <div className="flex items-center gap-2 min-w-0">
                      <GraduationCap className="w-4 h-4 text-emerald-600 shrink-0" />
                      <span className="text-xs font-bold text-emerald-700 dark:text-emerald-400 uppercase tracking-wide">
                        Teacher section
                      </span>
                      <span className="h-1.5 w-1.5 rounded-full bg-emerald-500 shrink-0" aria-hidden />
                    </div>
                  </div>
                  {teacherAnswerList.length === 0 ? (
                    <div className="px-4 sm:px-5 py-4">
                      <p className="text-sm text-muted-foreground">
                        No teacher note yet. When a teacher adds guidance here, it appears above student comments and stays
                        separate from the AI answer.
                      </p>
                    </div>
                  ) : (
                    <div className="space-y-4 p-4 sm:p-5 pt-4">
                      {teacherAnswerList.map(renderAnswerCard)}
                    </div>
                  )}
                  {showTeacherReplyForm && (
                    <div className="px-4 sm:px-5 pb-5 pt-0 border-t border-emerald-500/20 bg-emerald-500/5">
                      <h4 className="font-display text-sm font-bold text-foreground mt-4 mb-2 flex items-center gap-2">
                        <GraduationCap className="w-4 h-4 text-blue-500" /> Your teacher note
                      </h4>
                      <Label className="sr-only">Teacher note</Label>
                      <textarea
                        value={answerBody}
                        onChange={(e) => setAnswerBody(e.target.value)}
                        placeholder="Add exam tips, corrections, or context for students (posts in teacher section)."
                        className="w-full min-h-[100px] rounded-xl border border-input bg-transparent px-3 py-2 text-sm resize-y"
                        rows={4}
                      />
                      <Button
                        className="rounded-xl mt-3"
                        onClick={handlePostAnswer}
                        disabled={submitLoading || !answerBody.trim()}
                      >
                        {submitLoading ? <Loader2 className="w-4 h-4 animate-spin" /> : null} Post teacher note
                      </Button>
                    </div>
                  )}
                </div>
                {studentAnswerList.length > 0 && (
                  <div className="space-y-4">
                    <h4 className="text-xs font-bold text-muted-foreground uppercase tracking-wide px-0.5">
                      Student comments ({studentAnswerList.length})
                    </h4>
                    {studentAnswerList.map(renderAnswerCard)}
                  </div>
                )}
              </>
            ) : (
              answers.map(renderAnswerCard)
            )}
          </div>

          {showStudentReplyForm && (
            <div className="edu-card p-6 rounded-2xl mt-8">
              <h3 className="font-display font-bold mb-3">Your answer</h3>
              <Label className="sr-only">Write your answer</Label>
              <textarea
                value={answerBody}
                onChange={(e) => setAnswerBody(e.target.value)}
                placeholder="Explain the solution step by step. Earn RDM when your answer is accepted."
                className="w-full min-h-[120px] rounded-xl border border-input bg-transparent px-3 py-2 text-sm resize-y"
                rows={5}
              />
              <Button
                className="rounded-xl mt-3"
                onClick={handlePostAnswer}
                disabled={submitLoading || !answerBody.trim()}
              >
                {submitLoading ? <Loader2 className="w-4 h-4 animate-spin" /> : null} Post answer
              </Button>
            </div>
          )}

          <Dialog open={!!reportAnswerId} onOpenChange={(open) => !open && setReportAnswerId(null)}>
            <DialogContent className="rounded-2xl max-w-sm">
              <DialogHeader>
                <DialogTitle>Report answer</DialogTitle>
                <DialogDescription>Choose a reason. Your report is anonymous to the answerer.</DialogDescription>
              </DialogHeader>
              <div className="space-y-2 py-2">
                {REPORT_REASONS.map((r) => (
                  <label key={r} className="flex items-center gap-2 cursor-pointer">
                    <input type="radio" name="reportReason" value={r} checked={reportReason === r} onChange={() => setReportReason(r)} className="rounded-full" />
                    <span className="text-sm">{reportReasonLabel(r)}</span>
                  </label>
                ))}
              </div>
              <DialogFooter>
                <Button variant="outline" className="rounded-xl" onClick={() => setReportAnswerId(null)}>Cancel</Button>
                <Button className="rounded-xl" onClick={handleReportSubmit} disabled={reportSubmitting}>
                  {reportSubmitting ? <Loader2 className="w-4 h-4 animate-spin" /> : null} Submit report
                </Button>
              </DialogFooter>
            </DialogContent>
          </Dialog>

          <Dialog open={!!editAnswerId} onOpenChange={(open) => !open && setEditAnswerId(null)}>
            <DialogContent className="rounded-2xl max-w-lg">
              <DialogHeader>
                <DialogTitle>Edit answer</DialogTitle>
                <DialogDescription>You cannot edit after your answer is accepted.</DialogDescription>
              </DialogHeader>
              <div className="py-2">
                <Label className="sr-only">Answer</Label>
                <textarea
                  value={editAnswerBody}
                  onChange={(e) => setEditAnswerBody(e.target.value)}
                  placeholder="Your answer..."
                  className="w-full min-h-[120px] rounded-xl border border-input bg-transparent px-3 py-2 text-sm resize-y"
                  rows={5}
                />
              </div>
              <DialogFooter>
                <Button variant="outline" className="rounded-xl" onClick={() => setEditAnswerId(null)}>Cancel</Button>
                <Button className="rounded-xl" onClick={handleEditAnswerSave} disabled={editAnswerSaving || !editAnswerBody.trim()}>
                  {editAnswerSaving ? <Loader2 className="w-4 h-4 animate-spin" /> : null} Save
                </Button>
              </DialogFooter>
            </DialogContent>
          </Dialog>

          <Dialog open={!!deleteAnswerId} onOpenChange={(open) => !open && setDeleteAnswerId(null)}>
            <DialogContent className="rounded-2xl max-w-sm">
              <DialogHeader>
                <DialogTitle>Delete answer?</DialogTitle>
                <DialogDescription>This cannot be undone.</DialogDescription>
              </DialogHeader>
              <DialogFooter>
                <Button variant="outline" className="rounded-xl" onClick={() => setDeleteAnswerId(null)}>Cancel</Button>
                <Button variant="destructive" className="rounded-xl" onClick={handleDeleteAnswerConfirm} disabled={deleteAnswerLoading}>
                  {deleteAnswerLoading ? <Loader2 className="w-4 h-4 animate-spin" /> : null} Delete
                </Button>
              </DialogFooter>
            </DialogContent>
          </Dialog>
        </div>
      </AppLayout>
    </ProtectedRoute>
  );
}