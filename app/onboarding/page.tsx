"use client";

import { useState, useEffect, Suspense } from "react";
import { motion } from "framer-motion";
import { useAuth } from "@/hooks/useAuth";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { ArrowRight, BookOpen, GraduationCap, Award, Globe, Lock, Sparkles, Check, UserCircle2 } from "lucide-react";
import { TARGET_EXAM_OPTIONS, type TargetExamKey } from "@/lib/targetExam";
import { useRouter, useSearchParams } from "next/navigation";
import { useToast } from "@/hooks/use-toast";

const teachingLevels = ["School", "UG", "PG", "Competitive", "International"];
const teachingLevelToNumber: Record<string, number> = { School: 1, UG: 2, PG: 3, Competitive: 4, International: 5 };
const examTags = ["JEE", "NEET", "GRE", "GMAT", "SAT", "TOEFL"];
const subjects = ["Physics", "Chemistry", "Math", "Biology"];
const studentExamTargets: { key: TargetExamKey; label: string; tag?: string; locked?: boolean }[] = [
  { key: "cbse", label: "CBSE Board", locked: true },
  { key: "jee_mains", label: "JEE Main", tag: "NTA" },
  { key: "jee_advance", label: "JEE Advanced", tag: "IIT" },
  { key: "other", label: "Other" },
];
const mandatoryStudentSubjects = [
  { key: "physics", label: "Physics", subtitle: "Mechanics, electrostatics, optics" },
  { key: "chemistry", label: "Chemistry", subtitle: "Organic, inorganic & physical" },
  { key: "math", label: "Mathematics", subtitle: "Calculus, algebra, geometry" },
];
const comingSoonStudentSubjects = [
  { key: "biology", label: "Biology", subtitle: "Botany & zoology" },
  { key: "other", label: "Other", subtitle: "Specify when available" },
];
const visibilityOptions = [
  { value: "public", label: "Public", desc: "Anyone can find you", Icon: Globe },
  { value: "invite_only", label: "Invite-only", desc: "Only via link/code", Icon: Lock },
];

export default function Onboarding() {
  return (
    <Suspense fallback={<div className="min-h-screen flex items-center justify-center bg-background"><span className="text-4xl animate-pulse">🎯</span></div>}>
      <OnboardingContent />
    </Suspense>
  );
}

function OnboardingContent() {
  const { user, profile, loading, refreshProfile } = useAuth();
  const router = useRouter();
  const searchParams = useSearchParams();
  const { toast } = useToast();
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
  const [profileTimeout, setProfileTimeout] = useState(false);

  useEffect(() => {
    if (loading) return;
    if (!user) router.replace("/auth");
    else if (profile?.onboarding_complete) router.replace("/home");
  }, [user, profile?.onboarding_complete, loading, router]);

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
      return;
    }
    if (fromProfile) {
      setRole(profile!.role as "student" | "teacher");
      setStep("details");
    }
    if (profileTimeout && !role) {
      setRole("student");
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
        <span className="text-4xl animate-pulse">🎯</span>
      </div>
    );
  if (!user) return null;
  if (profile?.onboarding_complete) return null;
  if (user && profile === null && !profileTimeout)
    return (
      <div className="min-h-screen flex items-center justify-center bg-background">
        <span className="text-4xl animate-pulse">🎯</span>
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
    setSaving(true);
    try {
      const updates: Record<string, unknown> = {
        name: name.trim() || (role === "teacher" ? "Teacher" : "Student"),
        role: role!,
        onboarding_complete: true,
        visibility,
      };

      if (role === "student") {
        const primaryTargetExam: TargetExamKey =
          studentTargetExams.includes("jee_advance")
            ? "jee_advance"
            : studentTargetExams.includes("jee_mains")
              ? "jee_mains"
              : studentTargetExams.includes("other")
                ? "other"
                : "cbse";
        (updates as Record<string, unknown>).class_level = studentClassLevel;
        (updates as Record<string, unknown>).target_exam = primaryTargetExam;
        (updates as Record<string, unknown>).exam_tags = studentTargetExams;
        (updates as Record<string, unknown>).subject_combo = subjectCombo;
        (updates as Record<string, unknown>).stream = "science";
      } else {
        (updates as Record<string, unknown>).subjects = teachingSubjects.length ? teachingSubjects : null;
        (updates as Record<string, unknown>).teaching_levels = selectedLevels.length
          ? selectedLevels.map((l) => teachingLevelToNumber[l] ?? 0).filter(Boolean)
          : null;
        (updates as Record<string, unknown>).exam_tags = selectedExams.length ? selectedExams : null;
      }

      const payload = { id: user.id, ...updates };
      const { error: profileError } = await supabase.from("profiles").upsert(payload, { onConflict: "id" });
      if (profileError) {
        toast({ title: "Could not save profile", description: profileError.message, variant: "destructive" });
        return;
      }

      if (role === "teacher") {
        await supabase.from("user_roles").upsert({ user_id: user.id, role: "teacher" });
        // Role is already stored on profiles.role; user_roles sync is best-effort (RLS may block until policy is added).
      }

      await refreshProfile();

      import("canvas-confetti").then((c) =>
        c.default({ particleCount: 150, spread: 80, origin: { y: 0.6 } })
      );
      router.replace("/home");
    } finally {
      setSaving(false);
    }
  };

  return (
    <div className="auth-glass-page flex min-h-screen flex-col">
      <div className="relative flex-1 flex items-center justify-center p-6">
        {step === "role" && (
          <motion.div
            initial={{ opacity: 0, y: 30 }}
            animate={{ opacity: 1, y: 0 }}
            className="max-w-lg w-full"
          >
            <div className="text-center mb-8">
              <span className="text-5xl block mb-3">👋</span>
              <h1 className="text-3xl font-display text-white">Who are you?</h1>
              <p className="text-zinc-300 mt-2">
                Choose your role to personalize your experience
              </p>
            </div>
            <div className="grid grid-cols-2 gap-4">
              {[
                { r: "student" as const, emoji: "🎓", title: "Student", desc: "Learn, practice & conquer exams" },
                { r: "teacher" as const, emoji: "📖", title: "Teacher", desc: "Create classrooms & teach" },
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
          </motion.div>
        )}

        {step === "details" && role === "student" && (
          <motion.div
            initial={{ opacity: 0, y: 30 }}
            animate={{ opacity: 1, y: 0 }}
            className="auth-glass-card rounded-3xl p-6 sm:p-7 w-full max-w-6xl border border-white/12"
          >
            <div className="mb-6">
              <div className="mb-4 grid grid-cols-2 gap-2">
                <div className="h-1.5 rounded-full bg-primary/80" />
                <div className="h-1.5 rounded-full bg-primary/35" />
              </div>
              <div className="flex items-start gap-3">
                <div className="rounded-xl bg-primary/16 p-2.5 text-primary shadow-[0_0_0_1px_rgba(255,255,255,0.05)]">
                  <UserCircle2 className="h-5 w-5" />
                </div>
                <div>
                  <h2 className="text-[2rem] sm:text-[2.15rem] font-extrabold leading-tight text-white">Set up your profile</h2>
                  <p className="text-sm sm:text-[15px] text-zinc-200 mt-1">
                    Personalises learning and verifies you for scholarships, awards & rewards
                  </p>
                </div>
              </div>
            </div>
            <div className="space-y-6">
              <div>
                <label className="text-sm font-extrabold text-white mb-1.5 block">Full name</label>
                <p className="text-sm text-zinc-200/95 mb-2">As per govt ID (Aadhaar / PAN)</p>
                <Input
                  value={name}
                  onChange={(e) => setName(e.target.value)}
                  className="auth-glass-input rounded-xl h-12 text-base font-semibold text-white placeholder:text-zinc-500"
                  placeholder="e.g. Sanjana Lakshmi"
                />
              </div>

              <div className="grid grid-cols-1 gap-6 lg:grid-cols-2">
                <div>
                  <label className="text-sm font-extrabold text-white mb-2 block">Class</label>
                  <div className="grid grid-cols-2 gap-3">
                    {([
                      { value: 11 as const, label: "11", subtitle: "First year" },
                      { value: 12 as const, label: "12", subtitle: "Second year" },
                    ]).map((cl) => (
                      <button
                        key={cl.value}
                        type="button"
                        onClick={() => setStudentClassLevel(cl.value)}
                        className={`rounded-2xl border px-4 py-3 text-left transition-all duration-200 ${
                          studentClassLevel === cl.value
                            ? "border-primary/75 bg-primary/16 shadow-[0_0_0_1px_rgba(59,130,246,0.26)]"
                            : "border-white/14 bg-white/[0.025] hover:bg-white/[0.05]"
                        }`}
                      >
                        <div className="text-4xl font-black leading-none text-white">{cl.label}</div>
                        <div className="mt-1 text-sm font-semibold text-zinc-200">{cl.subtitle}</div>
                      </button>
                    ))}
                  </div>
                </div>

                <div>
                  <label className="text-sm font-extrabold text-white mb-2 block">Exam targets — multi-select</label>
                  <div className="grid grid-cols-2 gap-3">
                    {studentExamTargets.map((exam) => {
                      const active = studentTargetExams.includes(exam.key);
                      return (
                        <button
                          key={exam.key}
                          type="button"
                          onClick={() => toggleStudentExam(exam.key, exam.locked)}
                          className={`rounded-2xl border px-4 py-3 text-left transition-all duration-200 ${
                            active ? "border-primary/75 bg-primary/16 shadow-[0_0_0_1px_rgba(59,130,246,0.24)]" : "border-white/14 bg-white/[0.025] hover:bg-white/[0.05]"
                          } ${exam.locked ? "cursor-default" : ""}`}
                        >
                          <div className="flex items-center justify-between gap-3">
                            <div className="flex items-center gap-2">
                              <span
                                className={`inline-flex h-7 w-7 items-center justify-center rounded-md border ${
                                  active
                                    ? "border-primary bg-primary text-primary-foreground"
                                    : "border-white/15 bg-black/40"
                                }`}
                              >
                                {active ? <Check className="h-4 w-4" /> : null}
                              </span>
                              <span className="text-lg leading-tight font-extrabold text-white tracking-tight">{exam.label}</span>
                            </div>
                          </div>
                        </button>
                      );
                    })}
                  </div>
                </div>
              </div>

              <div>
                <label className="text-sm font-extrabold text-white mb-2 block">Subjects — pick what you study</label>
                <div className="grid grid-cols-1 gap-3 lg:grid-cols-2">
                  <div className="space-y-3">
                    {mandatoryStudentSubjects.map((item) => (
                      <div
                        key={item.key}
                        className="group relative overflow-hidden rounded-2xl border border-emerald-100/85 bg-gradient-to-r from-[#f1fffa] via-[#ebfff7] to-[#e4fbf3] px-4 py-3 shadow-[0_10px_24px_-18px_rgba(16,185,129,0.45)] transition-all duration-200 hover:-translate-y-0.5 hover:shadow-[0_18px_34px_-20px_rgba(16,185,129,0.55)]"
                      >
                        <div className="pointer-events-none absolute right-0 top-0 h-16 w-24 bg-gradient-to-bl from-emerald-200/35 to-transparent opacity-80" />
                        <div className="relative flex items-center gap-3">
                          <span className="inline-flex h-7 w-7 shrink-0 items-center justify-center rounded-md bg-emerald-500 text-white shadow-[0_4px_10px_-6px_rgba(5,150,105,0.8)]">
                            <Check className="h-4 w-4" />
                          </span>
                          <div className="min-w-0">
                            <p className="truncate text-[2rem] font-black leading-none tracking-tight text-zinc-900">
                              {item.label}
                            </p>
                            <p className="mt-0.5 truncate text-sm font-medium text-zinc-500">{item.subtitle}</p>
                          </div>
                          <span className="ml-auto hidden rounded-full border border-emerald-300/80 bg-emerald-100/80 px-2 py-0.5 text-[10px] font-bold uppercase tracking-[0.08em] text-emerald-700 sm:inline-flex">
                            Core
                          </span>
                        </div>
                      </div>
                    ))}
                  </div>
                  <div className="space-y-3">
                    {comingSoonStudentSubjects.map((item) => (
                      <div
                        key={item.key}
                        className="rounded-2xl border border-white/14 bg-white/[0.025] px-4 py-3 opacity-70"
                      >
                        <div className="flex items-start justify-between gap-3">
                          <div>
                            <p className="text-[2.1rem] font-black text-zinc-200 leading-none">{item.label}</p>
                            <p className="mt-0.5 text-sm text-zinc-400">{item.subtitle}</p>
                          </div>
                          <span className="text-sm font-bold text-zinc-500">Soon</span>
                        </div>
                      </div>
                    ))}
                    <p className="px-1 text-sm text-zinc-300">
                      Specify other subject
                      <br />
                      <span className="font-semibold text-base text-zinc-200">Unlocks soon…</span>
                    </p>
                  </div>
                </div>
              </div>

              <div className="flex gap-3 pt-3">
                <Button variant="outline" onClick={() => setStep("role")} className="auth-glass-outline-btn rounded-xl min-w-24">
                  Back
                </Button>
                <Button
                  onClick={handleComplete}
                  disabled={saving}
                  className="flex-1 rounded-xl edu-btn-primary h-12 text-base font-extrabold"
                >
                  {saving ? "Saving..." : "Continue"} <ArrowRight className="w-4 h-4 ml-1" />
                </Button>
              </div>
            </div>
          </motion.div>
        )}

        {step === "details" && role === "teacher" && (
          <motion.div
            initial={{ opacity: 0, y: 24 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.3 }}
            className="auth-glass-card rounded-3xl w-full max-w-lg border border-white/10 max-h-[90vh] overflow-y-auto"
          >
            <div className="sticky top-0 z-10 rounded-t-3xl border-b border-white/10 bg-[#121726]/95 px-8 pt-8 pb-5 backdrop-blur-md">
              <div className="flex items-center justify-center gap-3 mb-1">
                <div className="w-12 h-12 rounded-2xl bg-primary/15 flex items-center justify-center">
                  <BookOpen className="w-6 h-6 text-primary" />
                </div>
                <h2 className="text-2xl font-display font-bold text-white">Teacher Profile</h2>
              </div>
              <p className="text-center text-sm text-zinc-300">Set up your teaching profile so students can find you</p>
            </div>

            <div className="p-8 space-y-7">
              <div>
                <label className="text-sm font-bold text-white mb-2 block">Your Name</label>
                <Input
                  value={name}
                  onChange={(e) => setName(e.target.value)}
                  className="auth-glass-input rounded-xl h-12 text-white"
                  placeholder="Enter your name"
                />
              </div>

              <div className="space-y-3">
                <div className="flex items-center gap-2">
                  <GraduationCap className="w-4 h-4 text-primary" />
                  <label className="text-sm font-bold text-white">Teaching Levels</label>
                </div>
                <div className="flex flex-wrap gap-2">
                  {teachingLevels.map((l) => (
                    <button
                      key={l}
                      type="button"
                      onClick={() => toggle(selectedLevels, l, setSelectedLevels)}
                      className={`px-4 py-2.5 rounded-full font-semibold text-sm transition-all duration-200 ${selectedLevels.includes(l) ? "bg-primary text-primary-foreground shadow-lg shadow-primary/25 scale-[1.02]" : "bg-white/[0.05] text-zinc-300 hover:bg-white/[0.08] border border-white/12"}`}
                    >
                      {l}
                    </button>
                  ))}
                </div>
              </div>

              <div className="space-y-3">
                <div className="flex items-center gap-2">
                  <BookOpen className="w-4 h-4 text-primary" />
                  <label className="text-sm font-bold text-white">Subjects You Teach</label>
                </div>
                <div className="grid grid-cols-2 gap-2">
                  {subjects.map((s) => (
                    <button
                      key={s}
                      type="button"
                      onClick={() => toggle(teachingSubjects, s, setTeachingSubjects)}
                      className={`py-3 rounded-xl font-semibold text-sm transition-all duration-200 ${teachingSubjects.includes(s) ? "bg-primary text-primary-foreground shadow-lg shadow-primary/25" : "bg-white/[0.05] text-zinc-300 hover:bg-white/[0.08] border border-white/12"}`}
                    >
                      {s}
                    </button>
                  ))}
                </div>
              </div>

              <div className="space-y-3">
                <div className="flex items-center gap-2">
                  <Award className="w-4 h-4 text-primary" />
                  <label className="text-sm font-bold text-white">Exam Specializations</label>
                </div>
                <div className="flex flex-wrap gap-2">
                  {examTags.map((e) => (
                    <button
                      key={e}
                      type="button"
                      onClick={() => toggle(selectedExams, e, setSelectedExams)}
                      className={`px-4 py-2.5 rounded-full font-semibold text-sm transition-all duration-200 ${selectedExams.includes(e) ? "bg-primary text-primary-foreground shadow-lg shadow-primary/25 scale-[1.02]" : "bg-white/[0.05] text-zinc-300 hover:bg-white/[0.08] border border-white/12"}`}
                    >
                      {e}
                    </button>
                  ))}
                </div>
              </div>

              <div className="space-y-3">
                <label className="text-sm font-bold text-white block">Visibility</label>
                <div className="grid grid-cols-2 gap-3">
                  {visibilityOptions.map(({ value, label, desc, Icon }) => (
                    <button
                      key={value}
                      type="button"
                      onClick={() => setVisibility(value)}
                      className={`flex flex-col items-center gap-1.5 py-4 px-3 rounded-2xl font-semibold text-sm transition-all duration-200 ${visibility === value ? "bg-primary text-primary-foreground shadow-lg shadow-primary/25 ring-2 ring-primary ring-offset-2 ring-offset-[#121726]" : "bg-white/[0.05] text-zinc-300 hover:bg-white/[0.08] border border-white/12"}`}
                    >
                      <Icon className="w-5 h-5" />
                      <span>{label}</span>
                      <span className={`text-xs font-normal ${visibility === value ? "opacity-90" : "opacity-70"}`}>{desc}</span>
                    </button>
                  ))}
                </div>
              </div>

              <div className="flex gap-3 pt-2">
                <Button variant="outline" onClick={() => setStep("role")} className="auth-glass-outline-btn rounded-xl font-semibold shrink-0">
                  Back
                </Button>
                <Button
                  onClick={handleComplete}
                  disabled={saving}
                  className="flex-1 rounded-xl h-12 text-base font-bold bg-gradient-to-r from-primary to-primary/90 hover:from-primary/95 hover:to-primary/85 shadow-lg shadow-primary/20 gap-2"
                >
                  <Sparkles className="w-4 h-4" />
                  {saving ? "Saving..." : "Create Profile!"}
                  <ArrowRight className="w-4 h-4 ml-0.5" />
                </Button>
              </div>
            </div>
          </motion.div>
        )}
      </div>
    </div>
  );
}
