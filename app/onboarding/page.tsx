"use client";

import { useState, useEffect, Suspense } from "react";
import { motion } from "framer-motion";
import { useAuth } from "@/hooks/useAuth";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { ArrowRight, BookOpen, GraduationCap, Award, Globe, Lock, Sparkles } from "lucide-react";
import { useRouter, useSearchParams } from "next/navigation";
import { useToast } from "@/hooks/use-toast";

const teachingLevels = ["School", "UG", "PG", "Competitive", "International"];
const teachingLevelToNumber: Record<string, number> = { School: 1, UG: 2, PG: 3, Competitive: 4, International: 5 };
const examTags = ["JEE", "NEET", "GRE", "GMAT", "SAT", "TOEFL"];
const subjects = ["Physics", "Chemistry", "Math", "Biology"];
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
  const [classLevel, setClassLevel] = useState(11);
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
        (updates as Record<string, unknown>).class_level = classLevel;
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
    <div className="min-h-screen flex flex-col">
      <div className="absolute inset-0 gradient-hero opacity-95" />
      <div className="absolute inset-0">
        <div className="absolute top-20 left-10 w-72 h-72 bg-primary-foreground/5 rounded-full blur-3xl" />
      </div>

      <div className="relative flex-1 flex items-center justify-center p-6">
        {step === "role" && (
          <motion.div
            initial={{ opacity: 0, y: 30 }}
            animate={{ opacity: 1, y: 0 }}
            className="max-w-lg w-full"
          >
            <div className="text-center mb-8">
              <span className="text-5xl block mb-3">👋</span>
              <h1 className="text-3xl font-display text-primary-foreground">Who are you?</h1>
              <p className="text-primary-foreground/70 mt-2">
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
                  className={`bg-card rounded-3xl p-6 text-center border-2 transition-all hover:scale-105 hover:shadow-xl ${role === r ? "border-primary shadow-lg" : "border-border/50"}`}
                >
                  <span className="text-5xl block mb-3">{emoji}</span>
                  <h3 className="font-display text-xl text-foreground">{title}</h3>
                  <p className="text-sm text-muted-foreground mt-1">{desc}</p>
                </button>
              ))}
            </div>
          </motion.div>
        )}

        {step === "details" && role === "student" && (
          <motion.div
            initial={{ opacity: 0, y: 30 }}
            animate={{ opacity: 1, y: 0 }}
            className="bg-card rounded-3xl p-8 shadow-2xl w-full max-w-md border border-border/50"
          >
            <div className="text-center mb-6">
              <span className="text-4xl block mb-2">🎉</span>
              <h2 className="text-2xl font-display text-foreground">Join EduBlast!</h2>
              <p className="text-muted-foreground text-sm mt-1">Set up your learning profile</p>
            </div>
            <div className="space-y-5">
              <div>
                <label className="text-sm font-extrabold text-foreground mb-1.5 block">Your Name</label>
                <Input
                  value={name}
                  onChange={(e) => setName(e.target.value)}
                  className="rounded-xl h-12"
                  placeholder="Enter your name"
                />
              </div>
              <div>
                <label className="text-sm font-extrabold text-foreground mb-2 block">Class</label>
                <div className="grid grid-cols-2 gap-3">
                  {[
                    { value: 11, label: "Class 11th" },
                    { value: 12, label: "Class 12th" },
                  ].map(({ value, label }) => (
                    <button
                      key={value}
                      onClick={() => setClassLevel(value)}
                      className={`py-3 rounded-[12px] font-extrabold text-sm transition-all duration-200 ${classLevel === value ? "bg-primary text-primary-foreground shadow-md shadow-primary/20 scale-[1.02]" : "bg-muted/80 text-muted-foreground hover:bg-muted border border-transparent"}`}
                    >
                      {label}
                    </button>
                  ))}
                </div>
              </div>
              <div>
                <label className="text-sm font-extrabold text-foreground mb-2 block">Subject</label>
                <div className="py-3.5 px-4 rounded-[12px] bg-muted/50 border border-border/60 text-foreground font-semibold text-sm">
                  PCM — Physics, Chemistry, Math
                </div>
              </div>
              <div className="flex gap-3">
                <Button variant="outline" onClick={() => setStep("role")} className="rounded-xl">
                  Back
                </Button>
                <Button
                  onClick={handleComplete}
                  disabled={saving}
                  className="flex-1 rounded-xl edu-btn-primary h-12 text-base font-extrabold"
                >
                  {saving ? "Saving..." : "Start Learning! ✨"} <ArrowRight className="w-4 h-4 ml-1" />
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
            className="bg-card/95 backdrop-blur-sm rounded-3xl shadow-2xl w-full max-w-lg border border-border/60 max-h-[90vh] overflow-y-auto"
          >
            <div className="sticky top-0 z-10 bg-card/95 backdrop-blur-md border-b border-border/50 px-8 pt-8 pb-5 rounded-t-3xl">
              <div className="flex items-center justify-center gap-3 mb-1">
                <div className="w-12 h-12 rounded-2xl bg-primary/10 flex items-center justify-center">
                  <BookOpen className="w-6 h-6 text-primary" />
                </div>
                <h2 className="text-2xl font-display font-bold text-foreground">Teacher Profile</h2>
              </div>
              <p className="text-center text-sm text-muted-foreground">Set up your teaching profile so students can find you</p>
            </div>

            <div className="p-8 space-y-7">
              <div>
                <label className="text-sm font-bold text-foreground mb-2 block">Your Name</label>
                <Input
                  value={name}
                  onChange={(e) => setName(e.target.value)}
                  className="rounded-xl h-12 border-border/60 bg-muted/30 focus:bg-background"
                  placeholder="Enter your name"
                />
              </div>

              <div className="space-y-3">
                <div className="flex items-center gap-2">
                  <GraduationCap className="w-4 h-4 text-primary" />
                  <label className="text-sm font-bold text-foreground">Teaching Levels</label>
                </div>
                <div className="flex flex-wrap gap-2">
                  {teachingLevels.map((l) => (
                    <button
                      key={l}
                      type="button"
                      onClick={() => toggle(selectedLevels, l, setSelectedLevels)}
                      className={`px-4 py-2.5 rounded-full font-semibold text-sm transition-all duration-200 ${selectedLevels.includes(l) ? "bg-primary text-primary-foreground shadow-lg shadow-primary/25 scale-[1.02]" : "bg-muted/80 text-muted-foreground hover:bg-muted border border-transparent hover:border-border/60"}`}
                    >
                      {l}
                    </button>
                  ))}
                </div>
              </div>

              <div className="space-y-3">
                <div className="flex items-center gap-2">
                  <BookOpen className="w-4 h-4 text-primary" />
                  <label className="text-sm font-bold text-foreground">Subjects You Teach</label>
                </div>
                <div className="grid grid-cols-2 gap-2">
                  {subjects.map((s) => (
                    <button
                      key={s}
                      type="button"
                      onClick={() => toggle(teachingSubjects, s, setTeachingSubjects)}
                      className={`py-3 rounded-xl font-semibold text-sm transition-all duration-200 ${teachingSubjects.includes(s) ? "bg-primary text-primary-foreground shadow-lg shadow-primary/25" : "bg-muted/80 text-muted-foreground hover:bg-muted border border-transparent hover:border-border/60"}`}
                    >
                      {s}
                    </button>
                  ))}
                </div>
              </div>

              <div className="space-y-3">
                <div className="flex items-center gap-2">
                  <Award className="w-4 h-4 text-primary" />
                  <label className="text-sm font-bold text-foreground">Exam Specializations</label>
                </div>
                <div className="flex flex-wrap gap-2">
                  {examTags.map((e) => (
                    <button
                      key={e}
                      type="button"
                      onClick={() => toggle(selectedExams, e, setSelectedExams)}
                      className={`px-4 py-2.5 rounded-full font-semibold text-sm transition-all duration-200 ${selectedExams.includes(e) ? "bg-primary text-primary-foreground shadow-lg shadow-primary/25 scale-[1.02]" : "bg-muted/80 text-muted-foreground hover:bg-muted border border-transparent hover:border-border/60"}`}
                    >
                      {e}
                    </button>
                  ))}
                </div>
              </div>

              <div className="space-y-3">
                <label className="text-sm font-bold text-foreground block">Visibility</label>
                <div className="grid grid-cols-2 gap-3">
                  {visibilityOptions.map(({ value, label, desc, Icon }) => (
                    <button
                      key={value}
                      type="button"
                      onClick={() => setVisibility(value)}
                      className={`flex flex-col items-center gap-1.5 py-4 px-3 rounded-2xl font-semibold text-sm transition-all duration-200 ${visibility === value ? "bg-primary text-primary-foreground shadow-lg shadow-primary/25 ring-2 ring-primary ring-offset-2 ring-offset-card" : "bg-muted/80 text-muted-foreground hover:bg-muted border border-transparent hover:border-border/60"}`}
                    >
                      <Icon className="w-5 h-5" />
                      <span>{label}</span>
                      <span className={`text-xs font-normal ${visibility === value ? "opacity-90" : "opacity-70"}`}>{desc}</span>
                    </button>
                  ))}
                </div>
              </div>

              <div className="flex gap-3 pt-2">
                <Button variant="outline" onClick={() => setStep("role")} className="rounded-xl font-semibold shrink-0">
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
