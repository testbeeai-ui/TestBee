"use client";

import { useState, useEffect, useMemo } from "react";
import Link from "next/link";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { useToast } from "@/hooks/use-toast";
import { supabase } from "@/integrations/supabase/client";
import {
  FileText,
  Video,
  HelpCircle,
  ClipboardList,
  BarChart3,
  Megaphone,
  Calendar,
  Pencil,
  Loader2,
  MessageCircle,
  BookOpen,
} from "lucide-react";
import { format } from "date-fns";
import AssignmentTaskChecklist from "@/components/classroom/AssignmentTaskChecklist";
import {
  assignmentInstructionsFromContentJson,
  getGyanEngagementStudentViewModel,
} from "@/lib/classroom/gyanEngagementStudentUi";

export interface PostDetailData {
  id: string;
  type: string;
  title: string;
  description: string | null;
  tags: string[] | null;
  due_date: string | null;
  created_at: string;
  teacher_id: string;
  content_json?: { videoUrl?: string; tasks?: unknown } | Record<string, unknown> | null;
  profiles: { name: string } | null;
}

const typeConfig: Record<string, { icon: typeof FileText; emoji: string; color: string }> = {
  concept: { icon: FileText, emoji: "💡", color: "bg-blue-500/10 text-blue-600" },
  video: { icon: Video, emoji: "🎬", color: "bg-purple-500/10 text-purple-600" },
  quiz: { icon: HelpCircle, emoji: "❓", color: "bg-amber-500/10 text-amber-600" },
  assignment: { icon: ClipboardList, emoji: "📝", color: "bg-green-500/10 text-green-600" },
  mock: { icon: ClipboardList, emoji: "📋", color: "bg-emerald-500/10 text-emerald-700" },
  poll: { icon: BarChart3, emoji: "📊", color: "bg-pink-500/10 text-pink-600" },
  announcement: { icon: Megaphone, emoji: "📢", color: "bg-orange-500/10 text-orange-600" },
  "Concept Focus": { icon: FileText, emoji: "🎯", color: "bg-violet-500/10 text-violet-600" },
};

interface Props {
  post: PostDetailData | null;
  open: boolean;
  onClose: () => void;
  canEdit: boolean;
  onUpdated: () => void;
  /** When set, assignment/mock/quiz posts show the student task checklist */
  classroomId?: string | null;
}

export default function PostDetailModal({
  post,
  open,
  onClose,
  canEdit,
  onUpdated,
  classroomId,
}: Props) {
  const { toast } = useToast();
  const [editing, setEditing] = useState(false);
  const [saving, setSaving] = useState(false);
  const [title, setTitle] = useState("");
  const [description, setDescription] = useState("");
  const [tagsStr, setTagsStr] = useState("");
  const [dueDate, setDueDate] = useState("");

  useEffect(() => {
    if (!post) return;
    queueMicrotask(() => {
      setTitle(post.title);
      setDescription(post.description ?? "");
      setTagsStr((post.tags ?? []).join(", "));
      setDueDate(post.due_date ? new Date(post.due_date).toISOString().slice(0, 16) : "");
      setEditing(false);
    });
  }, [post]);

  const gyanStudent = useMemo(
    () =>
      post
        ? getGyanEngagementStudentViewModel(
            (post.content_json as import("@/integrations/supabase/types").Json) ?? null,
            post.type
          )
        : null,
    [post]
  );
  const assignmentInstructions = useMemo(
    () =>
      post
        ? assignmentInstructionsFromContentJson(
            (post.content_json as import("@/integrations/supabase/types").Json) ?? null
          )
        : "",
    [post]
  );

  if (!post) return null;

  const cfg = typeConfig[post.type] || typeConfig.announcement;
  const videoUrl = (post.content_json as { videoUrl?: string } | null)?.videoUrl;

  const isAssignmentLike =
    post.type === "assignment" ||
    post.type === "quiz" ||
    post.type === "mock" ||
    post.type === "Concept Focus";

  const handleSave = async () => {
    setSaving(true);
    const { error } = await supabase
      .from("posts")
      .update({
        title: title.trim(),
        description: description.trim() || null,
        tags: tagsStr.trim()
          ? tagsStr
              .split(",")
              .map((t) => t.trim())
              .filter(Boolean)
          : null,
        due_date: dueDate ? new Date(dueDate).toISOString() : null,
      })
      .eq("id", post.id)
      .eq("teacher_id", post.teacher_id);

    setSaving(false);
    if (error) {
      toast({ title: "Error", description: error.message, variant: "destructive" });
      return;
    }
    toast({ title: "Post updated" });
    setEditing(false);
    onUpdated();
  };

  return (
    <Dialog open={open} onOpenChange={(o) => !o && onClose()}>
      <DialogContent
        className={`max-h-[90vh] overflow-y-auto rounded-2xl ${
          gyanStudent ? "max-w-xl sm:max-w-2xl" : "max-w-lg"
        }`}
      >
        <DialogHeader>
          <DialogTitle className="sr-only">Post</DialogTitle>
        </DialogHeader>
        <div className="space-y-4">
          <div className="flex items-start gap-3">
            <div
              className={`w-10 h-10 rounded-xl flex items-center justify-center text-lg shrink-0 ${cfg.color}`}
            >
              {cfg.emoji}
            </div>
            <div className="flex-1 min-w-0">
              <span className="text-[10px] font-extrabold uppercase tracking-wider text-muted-foreground">
                {gyanStudent ? `${post.type} · Gyan++` : post.type}
              </span>
              {!editing ? (
                <>
                  <h2 className="font-extrabold text-foreground text-lg mt-0.5">{post.title}</h2>
                  {post.due_date && (
                    <p className="text-xs text-destructive flex items-center gap-1 mt-1">
                      <Calendar className="w-3 h-3" /> Due{" "}
                      {format(new Date(post.due_date), "MMM d, yyyy h:mm a")}
                    </p>
                  )}
                </>
              ) : (
                <div className="space-y-2 mt-2">
                  <label className="text-xs font-extrabold text-foreground block">Title</label>
                  <Input
                    value={title}
                    onChange={(e) => setTitle(e.target.value)}
                    className="rounded-xl"
                  />
                  <label className="text-xs font-extrabold text-foreground block">
                    Description
                  </label>
                  <Textarea
                    value={description}
                    onChange={(e) => setDescription(e.target.value)}
                    className="rounded-xl min-h-[100px]"
                  />
                  <label className="text-xs font-extrabold text-foreground block">
                    Tags (comma separated)
                  </label>
                  <Input
                    value={tagsStr}
                    onChange={(e) => setTagsStr(e.target.value)}
                    placeholder="e.g. chapter5, homework"
                    className="rounded-xl"
                  />
                  <label className="text-xs font-extrabold text-foreground block">
                    Due date (optional)
                  </label>
                  <Input
                    type="datetime-local"
                    value={dueDate}
                    onChange={(e) => setDueDate(e.target.value)}
                    className="rounded-xl"
                  />
                </div>
              )}
            </div>
            {canEdit && !editing && (
              <Button
                variant="outline"
                size="sm"
                className="rounded-xl shrink-0 gap-1"
                onClick={() => setEditing(true)}
              >
                <Pencil className="w-3.5 h-3.5" /> Edit
              </Button>
            )}
          </div>

          {!editing && (
            <>
              {gyanStudent ? (
                <div className="space-y-4 rounded-2xl border-2 border-violet-500/45 bg-gradient-to-b from-violet-500/15 to-background p-4 sm:p-5">
                  <div className="flex items-start gap-3">
                    <div className="flex h-11 w-11 shrink-0 items-center justify-center rounded-xl bg-violet-500/25 text-violet-100">
                      <MessageCircle className="h-6 w-6" aria-hidden />
                    </div>
                    <div className="min-w-0 flex-1 space-y-2">
                      <p className="text-xs font-extrabold uppercase tracking-wider text-violet-200">
                        What you do on Gyan++
                      </p>
                      <p className="text-base font-bold leading-snug text-foreground sm:text-lg">
                        {gyanStudent.taskLabel}
                      </p>
                      <p className="text-sm leading-relaxed text-muted-foreground">
                        Your teacher set this as a{" "}
                        <span className="font-semibold text-foreground">Gyan++</span> assignment.
                        Post a real doubt about the lesson so classmates and teachers can help.
                      </p>
                    </div>
                  </div>
                  <ol className="list-decimal space-y-2 pl-5 text-sm leading-relaxed text-foreground/95 sm:text-[15px]">
                    <li>
                      Tap <span className="font-semibold">Open Gyan++</span> below — we open the ask
                      screen for you.
                    </li>
                    <li>
                      Describe what you do not understand (topic, question, or where you got stuck).
                    </li>
                    <li>
                      Submit your doubt, then come back here and tick the task in the checklist when
                      you are done.
                    </li>
                  </ol>
                  {(gyanStudent.topicFocus || gyanStudent.subtopicHint) && (
                    <div className="rounded-xl border border-border/80 bg-muted/40 px-3 py-3 text-sm">
                      {gyanStudent.topicFocus ? (
                        <p>
                          <span className="font-semibold text-muted-foreground">
                            Lesson focus:{" "}
                          </span>
                          <span className="text-foreground">{gyanStudent.topicFocus}</span>
                        </p>
                      ) : null}
                      {gyanStudent.subtopicHint ? (
                        <p className={gyanStudent.topicFocus ? "mt-1.5" : ""}>
                          <span className="font-semibold text-muted-foreground">Subtopic: </span>
                          <span className="text-foreground">{gyanStudent.subtopicHint}</span>
                        </p>
                      ) : null}
                    </div>
                  )}
                  {gyanStudent.instructions ? (
                    <div className="rounded-xl border border-border bg-muted/30 p-3 sm:p-4">
                      <p className="text-[10px] font-extrabold uppercase tracking-wider text-muted-foreground">
                        Instructions from your teacher
                      </p>
                      <p className="mt-2 whitespace-pre-wrap text-sm leading-relaxed text-foreground">
                        {gyanStudent.instructions}
                      </p>
                    </div>
                  ) : null}
                  {gyanStudent.href.startsWith("/") ? (
                    <Button
                      asChild
                      className="h-12 w-full rounded-xl text-base font-bold shadow-lg shadow-violet-500/20"
                    >
                      <Link href={gyanStudent.href} onClick={() => onClose()}>
                        Open Gyan++
                      </Link>
                    </Button>
                  ) : (
                    <Button
                      asChild
                      className="h-12 w-full rounded-xl text-base font-bold shadow-lg shadow-violet-500/20"
                    >
                      <a href={gyanStudent.href} target="_blank" rel="noopener noreferrer">
                        Open Gyan++
                      </a>
                    </Button>
                  )}
                </div>
              ) : null}
              {isAssignmentLike && !gyanStudent ? (
                <div className="space-y-4 rounded-2xl border-2 border-primary/25 bg-gradient-to-b from-primary/8 to-background p-4 sm:p-5">
                  <div className="flex items-start gap-3">
                    <div className="flex h-11 w-11 shrink-0 items-center justify-center rounded-xl bg-primary/20 text-primary">
                      <BookOpen className="h-6 w-6" aria-hidden />
                    </div>
                    <div className="min-w-0 flex-1 space-y-1.5">
                      <p className="text-xs font-extrabold uppercase tracking-wider text-primary/80">
                        How to complete this assignment
                      </p>
                      <p className="text-sm leading-relaxed text-muted-foreground">
                        Your teacher assigned this{" "}
                        {post.type === "quiz"
                          ? "quiz"
                          : post.type === "mock"
                            ? "mock test"
                            : "assignment"}
                        . Follow the steps below. Your score is recorded automatically when you
                        finish.
                      </p>
                    </div>
                  </div>
                  <ol className="list-decimal space-y-2 pl-5 text-sm leading-relaxed text-foreground/95 sm:text-[15px]">
                    <li>
                      Tap{" "}
                      <span className="font-semibold">
                        Open{" "}
                        {post.type === "quiz"
                          ? "chapter quiz"
                          : post.type === "mock"
                            ? "mock test"
                            : "activity"}
                      </span>{" "}
                      in the task list below.
                    </li>
                    <li>Answer all questions. You can change answers before submitting.</li>
                    <li>Submit the quiz — your score will be saved automatically.</li>
                    <li>You can retry anytime to improve your score.</li>
                  </ol>
                  {assignmentInstructions ? (
                    <div className="rounded-xl border border-border/80 bg-muted/40 px-3 py-3 text-sm">
                      <p className="text-[10px] font-extrabold uppercase tracking-wider text-muted-foreground mb-1.5">
                        Teacher notes
                      </p>
                      <p className="whitespace-pre-wrap text-sm leading-relaxed text-foreground">
                        {assignmentInstructions}
                      </p>
                    </div>
                  ) : null}
                  {post.description?.trim() && (
                    <div className="rounded-xl border border-border/80 bg-muted/40 px-3 py-3 text-sm">
                      <p className="text-[10px] font-extrabold uppercase tracking-wider text-muted-foreground mb-1.5">
                        Details
                      </p>
                      <p className="whitespace-pre-wrap text-sm leading-relaxed text-foreground">
                        {post.description.trim()}
                      </p>
                    </div>
                  )}
                </div>
              ) : (
                <>
                  {post.description?.trim() && (
                    <div className="text-sm text-foreground whitespace-pre-wrap rounded-xl bg-muted/30 p-4">
                      {post.description.trim()}
                    </div>
                  )}
                  {assignmentInstructions ? (
                    <div className="rounded-xl border border-border bg-muted/25 p-4">
                      <p className="text-[10px] font-extrabold uppercase tracking-wider text-muted-foreground">
                        Instructions from your teacher
                      </p>
                      <p className="mt-2 whitespace-pre-wrap text-sm leading-relaxed text-foreground">
                        {assignmentInstructions}
                      </p>
                    </div>
                  ) : null}
                </>
              )}
              {videoUrl && (
                <div className="rounded-xl overflow-hidden bg-muted border border-border">
                  <a
                    href={videoUrl}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="text-sm text-primary font-bold hover:underline block p-3"
                  >
                    Watch video: {videoUrl}
                  </a>
                </div>
              )}
              {(post.tags ?? []).length > 0 && (
                <div className="flex flex-wrap gap-1">
                  {(post.tags ?? []).map((tag) => (
                    <span key={tag} className="edu-chip bg-muted text-muted-foreground text-xs">
                      {tag}
                    </span>
                  ))}
                </div>
              )}
              {classroomId &&
              (post.type === "assignment" || post.type === "quiz" || post.type === "mock") ? (
                <AssignmentTaskChecklist
                  classroomId={classroomId}
                  postId={post.id}
                  isTeacherView={canEdit}
                />
              ) : null}
              <p className="text-[11px] text-muted-foreground/80">
                {post.profiles?.name || "Teacher"} ·{" "}
                {format(new Date(post.created_at), "MMM d, yyyy h:mm a")}
              </p>
            </>
          )}

          {editing && (
            <div className="flex gap-2 pt-2">
              <Button variant="outline" className="rounded-xl" onClick={() => setEditing(false)}>
                Cancel
              </Button>
              <Button
                className="rounded-xl edu-btn-primary gap-2"
                disabled={saving || !title.trim()}
                onClick={handleSave}
              >
                {saving ? <Loader2 className="w-4 h-4 animate-spin" /> : null} Save changes
              </Button>
            </div>
          )}
        </div>
      </DialogContent>
    </Dialog>
  );
}
