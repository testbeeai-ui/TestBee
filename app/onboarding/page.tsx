"use client";

import { useState, useEffect, Suspense, useRef } from "react";
import { motion } from "framer-motion";
import { useAuth } from "@/hooks/useAuth";
import { supabase } from "@/integrations/supabase/client";
import Image from "next/image";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import {
  ArrowRight,
  BookOpen,
  GraduationCap,
  Award,
  Globe,
  Lock,
  Sparkles,
  Check,
} from "lucide-react";
import { TARGET_EXAM_OPTIONS, type TargetExamKey } from "@/lib/profile/targetExam";
import {
  TEACHER_EXAM_TAGS,
  TEACHER_TEACHING_LEVELS,
  encodeTeachingLevelLabels,
  decodeTeachingLevelNumbers,
} from "@/lib/profile/profileTeacherOptions";
import Link from "next/link";
import { useRouter, useSearchParams } from "next/navigation";
import { readPendingDeepLink, clearPendingDeepLink } from "@/lib/auth/safeNextPath";
import { TEACHER_PORTAL_CLASSROOMS_URL } from "@/lib/teacherPortal/routes";
import { useToast } from "@/hooks/use-toast";
import {
  clearPendingReferralRef,
  resolvePendingReferralRef,
} from "@/lib/rdm/referral/referralClient";
import { StudentProfileSetupCard } from "@/components/onboarding/StudentProfileSetupCard";
import { OnboardingTermsAcceptance } from "@/components/legal/OnboardingTermsAcceptance";
import { track } from "@/lib/analytics/track";
import { cn } from "@/lib/utils";

const EDUBLAST_LOGO_SRC = "/images/logo-2.png";

function OnboardingLoadingLogo() {
  return (
    <Image
      src={EDUBLAST_LOGO_SRC}
      alt="EduBlast"
      width={170}
      height={48}
      priority
      draggable={false}
      className="h-11 w-auto animate-pulse opacity-95"
    />
  );
}

const subjects = ["Physics", "Chemistry", "Math"];
const visibilityOptions = [
  { value: "public", label: "Public", desc: "Anyone can find you", Icon: Globe },
  { value: "invite_only", label: "Invite-only", desc: "Only via link/code", Icon: Lock },
];

export default function Onboarding() {
  return (
    <Suspense
      fallback={
        <div className="min-h-screen flex items-center justify-center bg-background">
          <OnboardingLoadingLogo />
        </div>
      }
    >
      <OnboardingContent />
    </Suspense>
  );
}

function OnboardingContent() {
  const { user, profile, loading, refreshProfile, signOut } = useAuth();
  const router = useRouter();
  const searchParams = useSearchParams();
  const { toast } = useToast();

  const signOutAndReturnToLogin = async () => {
    await signOut("/auth?mode=signin");
  };

  const [role, setRole] = useState<"student" | "teacher" | null>(null);
  const [step, setStep] = useState<"role" | "details">("role");
  const [name, setName] = useState(profile?.name || "");
  const [studentClassLevel, setStudentClassLevel] = useState<11 | 12>(
    profile?.class_level === 12 ? 12 : 11
  );
  const [studentTargetExams, setStudentTargetExams] = useState<TargetExamKey[]>(["cbse"]);
  const [subjectCombo, setSubjectCombo] = useState("PCM");
  const [teachingSubjects, setTeachingSubjects] = useState<string[]>([]);
  const [selectedLevels, setSelectedLevels] = useState<string[]>([]);
  const [selectedExams, setSelectedExams] = useState<string[]>([]);
  const [visibility, setVisibility] = useState("public");
  const [saving, setSaving] = useState(false);
  const [termsAccepted, setTermsAccepted] = useState(false);
  const [profileTimeout, setProfileTimeout] = useState(false);
  const teacherFormHydratedFor = useRef<string | null>(null);

  useEffect(() => {
    const uid = user?.id;
    if (!uid) {
      teacherFormHydratedFor.current = null;
      return;
    }
    if (profile?.role !== "teacher") return;
    if (teacherFormHydratedFor.current === uid) return;
    const hasRemoteData =
      (profile.subjects?.length ?? 0) > 0 ||
      (profile.teaching_levels?.length ?? 0) > 0 ||
      (profile.exam_tags?.length ?? 0) > 0;
    if (!hasRemoteData) return;
    teacherFormHydratedFor.current = uid;
    if (profile.name?.trim()) setName(profile.name.trim());
    if (Array.isArray(profile.subjects) && profile.subjects.length) {
      setTeachingSubjects([...profile.subjects]);
    }
    setSelectedLevels(decodeTeachingLevelNumbers(profile.teaching_levels));
    if (Array.isArray(profile.exam_tags) && profile.exam_tags.length) {
      setSelectedExams([...profile.exam_tags]);
    }
    const v = profile.visibility;
    if (v === "public" || v === "invite_only") setVisibility(v);
  }, [user?.id, profile]);

  useEffect(() => {
    if (user && !profile?.onboarding_complete) {
      track("onboarding_started");
    }
  }, [user, profile?.onboarding_complete]);

  useEffect(() => {
    if (loading) return;
    if (!user) router.replace("/auth");
    else if (profile?.onboarding_complete) {
      const pending = readPendingDeepLink();
      const dest =
        pending ?? (profile?.role === "teacher" ? TEACHER_PORTAL_CLASSROOMS_URL : "/home");
      clearPendingDeepLink();
      router.replace(dest);
    }
  }, [user, profile?.onboarding_complete, profile?.role, loading, router]);

  useEffect(() => {
    if (user && profile === null && !profileTimeout) {
      const t = setTimeout(() => setProfileTimeout(true), 2500);
      return () => clearTimeout(t);
    }
  }, [user, profile, profileTimeout]);

  useEffect(() => {
    const requestedRole = searchParams.get("role");
    const fromUrl = requestedRole === "student" || requestedRole === "teacher";
    const fromProfile = profile?.role === "student" || profile?.role === "teacher";
    if (role) return;
    if (fromUrl) {
      setRole(requestedRole as "student" | "teacher");
      setStep("details");
      track("onboarding_role_selected", { role: requestedRole });
      return;
    }
    if (fromProfile) {
      setRole(profile!.role as "student" | "teacher");
      setStep("details");
      track("onboarding_role_selected", { role: profile!.role });
    }
    if (profileTimeout && !role) {
      // Use URL param or sessionStorage fallback instead of hardcoded student
      const urlRole = searchParams.get("role");
      let fallbackRole: "student" | "teacher" = "student";
      if (urlRole === "teacher" || urlRole === "student") {
        fallbackRole = urlRole;
      } else {
        try {
          const stored = sessionStorage.getItem("auth_intended_role");
          if (stored === "teacher" || stored === "student") fallbackRole = stored;
        } catch (_) {}
      }
      setRole(fallbackRole);
      setStep("details");
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [searchParams, profile?.role, role, profileTimeout]);

  useEffect(() => {
    if (profile?.class_level === 11 || profile?.class_level === 12) {
      setStudentClassLevel(profile.class_level);
    }
    const te = profile?.target_exam as TargetExamKey | null | undefined;
    if (te && TARGET_EXAM_OPTIONS.some((o) => o.key === te)) {
      setStudentTargetExams((prev) => {
        const merged = Array.from(new Set(["cbse", ...prev, te])) as TargetExamKey[];
        return merged;
      });
    }
  }, [profile?.class_level, profile?.target_exam]);

  if (loading)
    return (
      <div className="min-h-screen flex items-center justify-center bg-background">
        <OnboardingLoadingLogo />
      </div>
    );
  if (!user) return null;
  if (profile?.onboarding_complete) return null;
  if (user && profile === null && !profileTimeout)
    return (
      <div className="min-h-screen flex flex-col items-center justify-center bg-background">
        <OnboardingLoadingLogo />
        <p className="mt-3 text-sm text-muted-foreground">Loading your profile…</p>
      </div>
    );

  const toggle = (arr: string[], val: string, setter: (v: string[]) => void) =>
    setter(arr.includes(val) ? arr.filter((x) => x !== val) : [...arr, val]);

  const toggleStudentExam = (exam: TargetExamKey, locked = false) => {
    if (locked) return;
    setStudentTargetExams((prev) => {
      const next = prev.includes(exam) ? prev.filter((x) => x !== exam) : [...prev, exam];
      if (!next.includes("cbse")) next.unshift("cbse");
      return next as TargetExamKey[];
    });
  };

  const handleComplete = async () => {
    if (!termsAccepted) return;
    setSaving(true);
    try {
      const updates: Record<string, unknown> = {
        name: name.trim() || (role === "teacher" ? "Teacher" : "Student"),
        role: role!,
        onboarding_complete: true,
        visibility,
      };

      if (role === "student") {
        const primaryTargetExam: TargetExamKey = studentTargetExams.includes("jee_advance")
          ? "jee_advance"
          : studentTargetExams.includes("jee_mains")
            ? "jee_mains"
            : studentTargetExams.includes("kcet")
              ? "kcet"
              : studentTargetExams.includes("other")
                ? "other"
                : "cbse";
        (updates as Record<string, unknown>).class_level = studentClassLevel;
        (updates as Record<string, unknown>).target_exam = primaryTargetExam;
        (updates as Record<string, unknown>).exam_tags = studentTargetExams;
        (updates as Record<string, unknown>).subject_combo = subjectCombo;
        (updates as Record<string, unknown>).stream = "science";
      } else {
        (updates as Record<string, unknown>).subjects = teachingSubjects.length
          ? teachingSubjects
          : null;
        (updates as Record<string, unknown>).teaching_levels = selectedLevels.length
          ? encodeTeachingLevelLabels(selectedLevels)
          : null;
        (updates as Record<string, unknown>).exam_tags = selectedExams.length
          ? selectedExams
          : null;
      }

      const payload = { id: user.id, ...updates };
      const { error: profileError } = await supabase
        .from("profiles")
        .upsert(payload, { onConflict: "id" });
      if (profileError) {
        toast({
          title: "Could not save profile",
          description: profileError.message,
          variant: "destructive",
        });
        return;
      }

      if (role === "teacher") {
        await supabase.from("user_roles").upsert({ user_id: user.id, role: "teacher" });
        // Role is already stored on profiles.role; user_roles sync is best-effort (RLS may block until policy is added).
      }

      await refreshProfile();

      const pendingRef = resolvePendingReferralRef(readPendingDeepLink());
      if (pendingRef) {
        try {
          const res = await fetch("/api/referral/complete", {
            method: "POST",
            credentials: "include",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({ ref: pendingRef }),
          });
          if (res.ok) {
            await refreshProfile();
          }
        } finally {
          clearPendingReferralRef();
        }
      }

      try {
        await fetch("/api/user/classroom-invites/link", {
          method: "POST",
          credentials: "include",
        });
      } catch {
        // Non-fatal: email match at payment still awards batch bonus.
      }

      track("onboarding_completed", {
        role,
        classLevel: role === "student" ? studentClassLevel : undefined,
        targetExams: role === "student" ? studentTargetExams : undefined,
        subjects: role === "teacher" ? teachingSubjects : undefined,
      });
      import("canvas-confetti").then((c) =>
        c.default({ particleCount: 150, spread: 80, origin: { y: 0.6 } })
      );
      const pending = readPendingDeepLink();
      const dest = pending ?? (role === "teacher" ? TEACHER_PORTAL_CLASSROOMS_URL : "/home");
      clearPendingDeepLink();
      router.replace(dest);
    } finally {
      setSaving(false);
    }
  };

  const isStudentProfileStep = step === "details" && role === "student";

  return (
    <div
      className={cn(
        "flex min-h-screen flex-col",
        isStudentProfileStep ? "bg-[#0E1117]" : "auth-glass-page"
      )}
    >
      <div
        className={cn(
          "relative flex min-h-0 flex-1 justify-center px-4 py-6 sm:px-6",
          isStudentProfileStep ? "items-start pt-8" : "items-start sm:items-center sm:py-8"
        )}
      >
        {step === "role" && (
          <motion.div
            initial={{ opacity: 0, y: 30 }}
            animate={{ opacity: 1, y: 0 }}
            className="max-w-lg w-full"
          >
            <div className="text-center mb-8">
              <span className="text-5xl block mb-3">👋</span>
              <h1 className="text-3xl font-display text-white">Who are you?</h1>
              <p className="text-zinc-300 mt-2">Choose your role to personalize your experience</p>
            </div>
            <div className="grid grid-cols-2 gap-4">
              {[
                {
                  r: "student" as const,
                  emoji: "🎓",
                  title: "Student",
                  desc: "Learn, practice & conquer exams",
                },
                {
                  r: "teacher" as const,
                  emoji: "📖",
                  title: "Teacher",
                  desc: "Create classrooms & teach",
                },
              ].map(({ r, emoji, title, desc }) => (
                <button
                  key={r}
                  onClick={() => {
                    setRole(r);
                    setStep("details");
                  }}
                  className={`auth-glass-card rounded-3xl p-6 text-center border transition-all hover:scale-[1.015] ${role === r ? "border-primary/70 shadow-[0_20px_40px_-20px_rgba(59,130,246,0.5)]" : "border-white/10"}`}
                >
                  <span className="text-5xl block mb-3">{emoji}</span>
                  <h3 className="font-display text-xl text-white">{title}</h3>
                  <p className="text-sm text-zinc-300 mt-1">{desc}</p>
                </button>
              ))}
            </div>
            <div className="mt-8 space-y-3 border-t border-white/10 pt-6 text-center">
              <p className="text-xs text-zinc-500">Wrong account or need a break?</p>
              <div className="flex flex-col justify-center gap-2 sm:flex-row sm:flex-wrap">
                <Button variant="ghost" size="sm" className="text-zinc-300" asChild>
                  <Link href="/">EduBlast home</Link>
                </Button>
                <Button variant="outline" size="sm" className="auth-glass-outline-btn" asChild>
                  <Link href="/auth?mode=signin">Sign-in page</Link>
                </Button>
                <Button
                  type="button"
                  variant="outline"
                  size="sm"
                  className="border-destructive/40 text-destructive hover:bg-destructive/10"
                  onClick={() => void signOutAndReturnToLogin()}
                >
                  Sign out
                </Button>
              </div>
            </div>
          </motion.div>
        )}

        {step === "details" && role === "student" && (
          <motion.div
            initial={{ opacity: 0, y: 30 }}
            animate={{ opacity: 1, y: 0 }}
            className="w-full flex justify-center"
          >
            <StudentProfileSetupCard
              name={name}
              onNameChange={setName}
              classLevel={studentClassLevel}
              onClassLevelChange={setStudentClassLevel}
              targetExams={studentTargetExams}
              onToggleExam={toggleStudentExam}
              termsAccepted={termsAccepted}
              onTermsAcceptedChange={setTermsAccepted}
              saving={saving}
              onBack={() => {
                setTermsAccepted(false);
                setStep("role");
              }}
              onContinue={() => void handleComplete()}
              onSignOut={() => void signOutAndReturnToLogin()}
            />
          </motion.div>
        )}

        {step === "details" && role === "teacher" && (
          <motion.div
            initial={{ opacity: 0, y: 24 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.3 }}
            className="auth-glass-card w-full max-w-lg rounded-2xl border border-white/10 sm:max-w-2xl lg:max-w-4xl xl:max-w-[56rem]"
          >
            {/* Booklet masthead — single band, no inner scroll */}
            <div className="rounded-t-2xl border-b border-white/10 bg-[#121726]/90 px-4 py-3 backdrop-blur-sm sm:px-5 sm:py-3.5">
              <div className="flex items-center gap-3">
                <div className="flex h-9 w-9 shrink-0 items-center justify-center rounded-xl bg-primary/15 sm:h-10 sm:w-10">
                  <BookOpen className="h-4 w-4 text-primary sm:h-[18px] sm:w-[18px]" />
                </div>
                <div className="min-w-0 flex-1">
                  <h2 className="font-display text-base font-bold tracking-tight text-white sm:text-lg">
                    Teacher Profile
                  </h2>
                  <p className="truncate text-[11px] leading-tight text-zinc-400 sm:text-xs sm:whitespace-normal sm:leading-snug">
                    EduBlast · one screen — who you teach, what you teach, how students find you
                  </p>
                </div>
              </div>
            </div>

            <div className="p-4 sm:p-5 lg:p-6">
              {/* Two-page spread: left = identity & scope, right = exams & discovery */}
              <div className="grid gap-5 lg:grid-cols-2 lg:gap-0 lg:divide-x lg:divide-white/10">
                <div className="space-y-4 lg:pr-6 lg:pt-0.5">
                  <div>
                    <label className="mb-1 block text-xs font-bold uppercase tracking-wide text-zinc-500">
                      Your name
                    </label>
                    <Input
                      value={name}
                      onChange={(e) => setName(e.target.value)}
                      className="auth-glass-input h-10 rounded-lg text-sm text-white sm:h-10"
                      placeholder="Enter your name"
                    />
                  </div>

                  <div className="space-y-2">
                    <div className="flex items-center gap-1.5">
                      <GraduationCap className="h-3.5 w-3.5 shrink-0 text-primary" />
                      <span className="text-xs font-bold uppercase tracking-wide text-zinc-500">
                        Teaching level
                      </span>
                    </div>
                    <p className="text-[11px] leading-snug text-zinc-500">
                      School (K–12) vs college / PUC — pick one or both.
                    </p>
                    <div className="grid grid-cols-2 gap-2">
                      {TEACHER_TEACHING_LEVELS.map((l) => (
                        <button
                          key={l}
                          type="button"
                          onClick={() => toggle(selectedLevels, l, setSelectedLevels)}
                          className={`min-h-10 rounded-xl border px-2 py-2 text-sm font-semibold transition-colors ${
                            selectedLevels.includes(l)
                              ? "border-primary/50 bg-primary text-primary-foreground shadow-md shadow-primary/20"
                              : "border-white/12 bg-white/[0.05] text-zinc-300 hover:bg-white/[0.08]"
                          }`}
                        >
                          {l}
                        </button>
                      ))}
                    </div>
                  </div>

                  <div className="space-y-2">
                    <div className="flex items-center gap-1.5">
                      <BookOpen className="h-3.5 w-3.5 shrink-0 text-primary" />
                      <span className="text-xs font-bold uppercase tracking-wide text-zinc-500">
                        Subjects you teach
                      </span>
                    </div>
                    <div className="grid grid-cols-3 gap-2">
                      {subjects.map((s) => (
                        <button
                          key={s}
                          type="button"
                          onClick={() => toggle(teachingSubjects, s, setTeachingSubjects)}
                          className={`min-h-10 rounded-xl border py-2 text-center text-xs font-semibold transition-colors sm:text-sm ${
                            teachingSubjects.includes(s)
                              ? "border-primary/50 bg-primary text-primary-foreground shadow-md shadow-primary/20"
                              : "border-white/12 bg-white/[0.05] text-zinc-300 hover:bg-white/[0.08]"
                          }`}
                        >
                          {s}
                        </button>
                      ))}
                    </div>
                  </div>
                </div>

                <div className="space-y-4 border-t border-white/10 pt-5 lg:border-t-0 lg:pt-0.5 lg:pl-6">
                  <div className="space-y-2">
                    <div className="flex items-center gap-1.5">
                      <Award className="h-3.5 w-3.5 shrink-0 text-primary" />
                      <span className="text-xs font-bold uppercase tracking-wide text-zinc-500">
                        Exam specializations
                      </span>
                    </div>
                    <p className="text-[11px] leading-snug text-zinc-500">
                      Select all that apply — shown on your public profile.
                    </p>
                    <div className="grid grid-cols-2 gap-1.5 sm:grid-cols-3 lg:grid-cols-5">
                      {TEACHER_EXAM_TAGS.map((e) => (
                        <button
                          key={e}
                          type="button"
                          onClick={() => toggle(selectedExams, e, setSelectedExams)}
                          className={`min-h-9 rounded-lg border px-2 py-1.5 text-center text-[11px] font-semibold leading-tight transition-colors sm:min-h-10 sm:text-xs ${
                            selectedExams.includes(e)
                              ? "border-primary/50 bg-primary text-primary-foreground shadow-md shadow-primary/20"
                              : "border-white/12 bg-white/[0.05] text-zinc-300 hover:bg-white/[0.08]"
                          }`}
                        >
                          {e}
                        </button>
                      ))}
                    </div>
                  </div>

                  <div className="space-y-2">
                    <span className="text-xs font-bold uppercase tracking-wide text-zinc-500">
                      Visibility
                    </span>
                    <div className="grid grid-cols-2 gap-2">
                      {visibilityOptions.map(({ value, label, desc, Icon }) => (
                        <button
                          key={value}
                          type="button"
                          onClick={() => setVisibility(value)}
                          className={`flex flex-col items-center gap-1 rounded-xl border px-2 py-2.5 text-center text-xs font-semibold transition-colors ${
                            visibility === value
                              ? "border-primary/50 bg-primary text-primary-foreground shadow-md shadow-primary/20 ring-1 ring-primary/60 ring-offset-1 ring-offset-[#0c1020]"
                              : "border-white/12 bg-white/[0.05] text-zinc-300 hover:bg-white/[0.08]"
                          }`}
                        >
                          <Icon className="h-4 w-4" />
                          <span>{label}</span>
                          <span
                            className={`line-clamp-2 text-[10px] font-normal leading-tight ${
                              visibility === value ? "text-primary-foreground/90" : "text-zinc-500"
                            }`}
                          >
                            {desc}
                          </span>
                        </button>
                      ))}
                    </div>
                  </div>
                </div>
              </div>

              <OnboardingTermsAcceptance
                className="mt-5 lg:mt-6"
                accepted={termsAccepted}
                onAcceptedChange={setTermsAccepted}
                action={
                  <div className="flex flex-col-reverse gap-2 sm:flex-row sm:items-center sm:justify-end sm:gap-3">
                    <Button
                      variant="outline"
                      onClick={() => {
                        setTermsAccepted(false);
                        setStep("role");
                      }}
                      className="auth-glass-outline-btn h-10 shrink-0 rounded-lg px-5 text-sm font-semibold sm:w-auto"
                    >
                      Back
                    </Button>
                    <Button
                      onClick={handleComplete}
                      disabled={saving}
                      className="h-10 flex-1 gap-2 rounded-lg bg-gradient-to-r from-primary to-primary/90 text-sm font-bold shadow-md shadow-primary/20 hover:from-primary/95 hover:to-primary/85 sm:min-w-[220px] sm:text-base"
                    >
                      <Sparkles className="h-3.5 w-3.5 sm:h-4 sm:w-4" />
                      {saving ? "Saving..." : "Create Profile!"}
                      <ArrowRight className="ml-0.5 h-3.5 w-3.5 sm:h-4 sm:w-4" />
                    </Button>
                  </div>
                }
              />
              <p className="mt-3 flex flex-wrap justify-center gap-x-3 gap-y-1 text-center text-[11px] text-zinc-500">
                <Link href="/" className="underline-offset-2 hover:text-zinc-300 hover:underline">
                  Exit to home
                </Link>
                <span className="text-zinc-600">·</span>
                <button
                  type="button"
                  className="underline-offset-2 hover:text-zinc-300 hover:underline"
                  onClick={() => void signOutAndReturnToLogin()}
                >
                  Sign out
                </button>
              </p>
            </div>
          </motion.div>
        )}
      </div>
    </div>
  );
}
