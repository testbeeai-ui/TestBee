"use client";

import Link from "next/link";
import { useState } from "react";
import { motion } from "framer-motion";
import { useRouter } from "next/navigation";
import AppLayout from "@/components/AppLayout";
import { useAuth } from "@/hooks/useAuth";
import { useUserStore } from "@/store/useUserStore";
import { Button } from "@/components/ui/button";
import { Switch } from "@/components/ui/switch";
import { useTheme } from "next-themes";
import {
  User,
  LogOut,
  BookOpen,
  Trophy,
  Coins,
  Target,
  Bookmark,
  CheckCircle2,
  Activity,
  Heart,
  Sun,
  Moon,
  Monitor,
} from "lucide-react";
import { Progress } from "@/components/ui/progress";
import { ProtectedRoute } from "@/components/ProtectedRoute";
import TeacherProfile from "@/components/TeacherProfile";
import ProfileAcademicsAchievements from "@/components/ProfileAcademicsAchievements";
import { targetExamLabel } from "@/lib/targetExam";

export default function Profile() {
  const { user: authUser, profile, signOut, signInWithGoogle } = useAuth();
  const storeUser = useUserStore((s) => s.user);
  const storeLogout = useUserStore((s) => s.logout);
  const allResults = useUserStore((s) => s.allResults);
  const router = useRouter();
  const { theme, setTheme } = useTheme();
  const [dailyReminders, setDailyReminders] = useState(true);
  const [examAlerts, setExamAlerts] = useState(false);

  if (profile?.role === "teacher") {
    return <TeacherProfile />;
  }

  if (!profile) return null;

  const displayName = profile.name || authUser?.email?.split("@")[0] || "Student";
  const examLabel = targetExamLabel(profile.target_exam);
  const classLevelDisplay =
    profile.class_level != null
      ? `Class ${profile.class_level}`
      : "Classes 11 & 12";
  const subjectCombo = profile.subject_combo || storeUser?.subjectCombo || "—";

  const totalCorrect = allResults.filter((r) => r.isCorrect).length;
  const totalWrong = allResults.filter((r) => !r.isCorrect).length;
  const accuracy = allResults.length > 0 ? Math.round((totalCorrect / allResults.length) * 100) : 0;

  const rdm = profile?.rdm ?? storeUser?.rdm ?? 0;
  const savedCount = storeUser?.savedQuestions?.length ?? 0;

  const handleLogout = async () => {
    await signOut();
    storeLogout();
    router.push("/");
  };

  return (
    <ProtectedRoute>
      <AppLayout>
        <div className="mx-auto w-full max-w-6xl">
          <motion.div
            initial={{ opacity: 0, y: -10 }}
            animate={{ opacity: 1, y: 0 }}
            className="rounded-3xl border border-border bg-card p-5 md:p-7 text-foreground shadow-lg dark:border-white/10 dark:bg-[#070b14] dark:text-slate-100 dark:shadow-[0_24px_60px_rgba(2,8,23,0.65)]"
          >
            <div className="space-y-5">
              <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
                <div className="flex items-start gap-4">
                  <div className="flex h-14 w-14 items-center justify-center rounded-full bg-gradient-to-br from-violet-500 to-blue-500 text-xl font-black text-white shadow-lg shadow-violet-500/30">
                    {(displayName?.[0] ?? "S").toUpperCase()}
                  </div>
                  <div>
                    <h2 className="text-2xl font-black leading-tight text-foreground dark:text-white">{displayName}</h2>
                    <div className="mt-1 flex flex-wrap items-center gap-2 text-sm text-muted-foreground dark:text-slate-400">
                      <span>{classLevelDisplay}</span>
                      {examLabel ? <span>· {examLabel}</span> : null}
                      <span>· {subjectCombo}</span>
                      {profile.google_connected ? <span>· Connected to Google</span> : null}
                    </div>
                  </div>
                </div>
                <Button
                  variant="outline"
                  onClick={() => router.push(`/user/${profile.id}`)}
                  className="rounded-xl border-violet-300/60 bg-violet-50 px-4 text-foreground hover:bg-violet-100 dark:border-violet-400/30 dark:bg-violet-500/10 dark:text-violet-100 dark:hover:bg-violet-500/20 dark:hover:text-white"
                >
                  <Bookmark className="mr-2 h-4 w-4" /> View public profile
                </Button>
              </div>
              <div className="grid grid-cols-2 gap-3 md:grid-cols-4">
                {[
                  {
                    icon: Coins,
                    iconColor: "text-amber-400",
                    border: "border-amber-400/30",
                    label: "RDM Balance",
                    value: rdm,
                  },
                  {
                    icon: CheckCircle2,
                    iconColor: "text-emerald-400",
                    border: "border-emerald-400/30",
                    label: "Accuracy",
                    value: `${accuracy}%`,
                  },
                  {
                    icon: BookOpen,
                    iconColor: "text-sky-400",
                    border: "border-sky-400/30",
                    label: "Answered",
                    value: allResults.length,
                  },
                  {
                    icon: Bookmark,
                    iconColor: "text-violet-400",
                    border: "border-violet-400/30",
                    label: "Saved",
                    value: savedCount,
                  },
                ].map((stat) => (
                  <div
                    key={stat.label}
                    className={`rounded-2xl border ${stat.border} bg-muted/40 px-4 py-3 text-center dark:bg-slate-900/60`}
                  >
                    <stat.icon className={`mx-auto mb-2 h-4 w-4 ${stat.iconColor}`} />
                    <p className="text-4xl font-black leading-none text-foreground dark:text-white">{stat.value}</p>
                    <p className="mt-1 text-sm font-semibold text-muted-foreground dark:text-slate-400">{stat.label}</p>
                  </div>
                ))}
              </div>
            </div>
          </motion.div>

          <div className="mt-6 space-y-4">
            <ProfileAcademicsAchievements userId={profile.id} />

            <motion.div
              initial={{ opacity: 0, y: 10 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ delay: 0.3 }}
              className="rounded-2xl border border-border bg-card p-5 dark:border-white/10 dark:bg-slate-950/80"
            >
              <div className="mb-3 flex items-center justify-between">
                <h3 className="flex items-center gap-2 text-xl font-black text-foreground dark:text-white">
                  <Activity className="h-5 w-5 text-emerald-400" /> Performance
                </h3>
                <span className="text-sm font-semibold text-muted-foreground dark:text-slate-400">All time</span>
              </div>
              <Progress value={accuracy} className="h-3 rounded-full bg-muted dark:bg-slate-800" />
              <div className="mt-3 flex flex-wrap items-center justify-between gap-2 text-sm">
                <span className="font-extrabold text-emerald-400">✓ {totalCorrect} Correct</span>
                <span className="font-extrabold text-rose-400">✗ {totalWrong} Wrong</span>
                <span className="font-extrabold text-foreground dark:text-slate-200">{accuracy}% Accuracy</span>
              </div>
              <div className="mt-4 grid grid-cols-1 gap-3 md:grid-cols-3">
                <div className="rounded-xl border border-emerald-400/20 bg-muted/40 p-3 dark:bg-slate-900/70">
                  <p className="text-xs uppercase tracking-wide text-muted-foreground dark:text-slate-400">Correct</p>
                  <p className="text-3xl font-black text-emerald-400">{totalCorrect}</p>
                </div>
                <div className="rounded-xl border border-rose-400/20 bg-muted/40 p-3 dark:bg-slate-900/70">
                  <p className="text-xs uppercase tracking-wide text-muted-foreground dark:text-slate-400">Wrong</p>
                  <p className="text-3xl font-black text-rose-400">{totalWrong}</p>
                </div>
                <div className="rounded-xl border border-border bg-muted/40 p-3 dark:border-slate-700 dark:bg-slate-900/70">
                  <p className="text-xs uppercase tracking-wide text-muted-foreground dark:text-slate-400">Skipped</p>
                  <p className="text-3xl font-black text-foreground dark:text-white">0</p>
                </div>
              </div>
            </motion.div>

            <div className="grid grid-cols-1 gap-4 lg:grid-cols-2">
              <div className="rounded-2xl border border-border bg-card p-5 dark:border-white/10 dark:bg-slate-950/80">
                <h3 className="mb-1 text-xl font-black text-foreground dark:text-white">Settings</h3>
                <p className="mb-4 text-sm text-muted-foreground dark:text-slate-400">Appearance & notifications</p>
                <div className="space-y-4">
                  <div>
                    <p className="text-xs font-semibold uppercase tracking-wide text-muted-foreground dark:text-slate-400">Appearance</p>
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
                          className={`inline-flex items-center gap-1.5 rounded-xl px-3 py-2 text-sm font-bold transition ${
                            (theme ?? "system") === opt.value
                              ? "bg-violet-500 text-white"
                              : "bg-muted text-muted-foreground hover:bg-muted/80 dark:bg-slate-900 dark:text-slate-300 dark:hover:bg-slate-800"
                          }`}
                        >
                          <opt.icon className="h-3.5 w-3.5" />
                          {opt.label}
                        </button>
                      ))}
                    </div>
                  </div>
                  <div className="space-y-3">
                    <div className="flex items-center justify-between rounded-xl border border-border bg-muted/30 px-3 py-2.5 dark:border-white/10 dark:bg-slate-900/70">
                      <div>
                        <p className="font-semibold text-foreground dark:text-slate-100">Daily reminders</p>
                        <p className="text-xs text-muted-foreground dark:text-slate-400">Get nudged to study every day</p>
                      </div>
                      <Switch checked={dailyReminders} onCheckedChange={setDailyReminders} />
                    </div>
                    <div className="flex items-center justify-between rounded-xl border border-border bg-muted/30 px-3 py-2.5 dark:border-white/10 dark:bg-slate-900/70">
                      <div>
                        <p className="font-semibold text-foreground dark:text-slate-100">Exam alerts</p>
                        <p className="text-xs text-muted-foreground dark:text-slate-400">Deadlines for JEE, CBSE & more</p>
                      </div>
                      <Switch checked={examAlerts} onCheckedChange={setExamAlerts} />
                    </div>
                  </div>
                </div>
              </div>
              <div className="space-y-4">
                <div className="rounded-2xl border border-border bg-card p-5 dark:border-white/10 dark:bg-slate-950/80">
                  <div className="mb-1 flex items-center justify-between">
                    <h3 className="flex items-center gap-2 text-xl font-black text-foreground dark:text-white">
                      <Heart className="h-5 w-5 text-rose-400" /> EduFund
                    </h3>
                    <span className="rounded-full bg-rose-500/20 px-2 py-0.5 text-xs font-bold text-rose-300">New</span>
                  </div>
                  <p className="text-sm text-muted-foreground dark:text-slate-400">Scholarships & funding opportunities matched to your profile.</p>
                  <Button
                    variant="link"
                    className="mt-2 h-auto p-0 text-violet-300 hover:text-violet-200"
                    onClick={() => router.push("/funding")}
                  >
                    Explore funding →
                  </Button>
                </div>
              </div>
            </div>
            <div className="flex flex-wrap gap-2 pt-2">
              {!profile.google_connected ? (
                <Button
                  variant="outline"
                  size="sm"
                  onClick={() => signInWithGoogle()}
                    className="rounded-xl border-border bg-muted text-foreground hover:bg-muted/80 dark:border-white/20 dark:bg-slate-900 dark:text-slate-100 dark:hover:bg-slate-800"
                >
                  Connect Google
                </Button>
              ) : null}
              <Button
                variant="outline"
                onClick={() => router.push("/pricing")}
                className="rounded-xl border-border bg-muted text-foreground hover:bg-muted/80 dark:border-white/20 dark:bg-slate-900 dark:text-slate-100 dark:hover:bg-slate-800"
              >
                <Coins className="mr-2 h-4 w-4" /> Top Up
              </Button>
              <Button
                variant="outline"
                className="rounded-xl border-rose-400/30 bg-rose-500/10 text-rose-300 hover:bg-rose-500/20 hover:text-rose-200"
                onClick={handleLogout}
              >
                <LogOut className="mr-2 h-4 w-4" /> Log Out
              </Button>
            </div>
          </div>
        </div>
      </AppLayout>
    </ProtectedRoute>
  );
}
