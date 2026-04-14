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
            className="rounded-2xl border border-border bg-card p-4 text-foreground shadow-lg md:p-5 2xl:rounded-3xl 2xl:p-7 dark:border-white/10 dark:bg-[#070b14] dark:text-slate-100 dark:shadow-[0_24px_60px_rgba(2,8,23,0.65)]"
          >
            <div className="space-y-4 2xl:space-y-5">
              <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between 2xl:gap-4">
                <div className="flex items-start gap-3 2xl:gap-4">
                  <div className="flex h-12 w-12 shrink-0 items-center justify-center rounded-full bg-gradient-to-br from-violet-500 to-blue-500 text-lg font-black text-white shadow-lg shadow-violet-500/30 2xl:h-14 2xl:w-14 2xl:text-xl">
                    {(displayName?.[0] ?? "S").toUpperCase()}
                  </div>
                  <div>
                    <h2 className="text-xl font-black leading-tight text-foreground dark:text-white 2xl:text-2xl">{displayName}</h2>
                    <div className="mt-1 flex flex-wrap items-center gap-1.5 text-xs text-muted-foreground dark:text-slate-400 2xl:gap-2 2xl:text-sm">
                      <span>{classLevelDisplay}</span>
                      {examLabel ? <span>· {examLabel}</span> : null}
                      <span>· {subjectCombo}</span>
                      {profile.google_connected ? <span>· Connected to Google</span> : null}
                    </div>
                  </div>
                </div>
                <Button
                  variant="outline"
                  size="sm"
                  onClick={() => router.push(`/user/${profile.id}`)}
                  className="rounded-lg border-violet-300/60 bg-violet-50 px-3 text-foreground hover:bg-violet-100 dark:border-violet-400/30 dark:bg-violet-500/10 dark:text-violet-100 dark:hover:bg-violet-500/20 dark:hover:text-white 2xl:rounded-xl 2xl:px-4"
                >
                  <Bookmark className="mr-1.5 h-3.5 w-3.5 2xl:mr-2 2xl:h-4 2xl:w-4" /> View public profile
                </Button>
              </div>
              <div className="grid grid-cols-2 gap-2 md:grid-cols-4 2xl:gap-3">
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
                    className={`rounded-xl border ${stat.border} bg-muted/40 px-3 py-2.5 text-center dark:bg-slate-900/60 2xl:rounded-2xl 2xl:px-4 2xl:py-3`}
                  >
                    <stat.icon className={`mx-auto mb-1 h-3.5 w-3.5 ${stat.iconColor} 2xl:mb-2 2xl:h-4 2xl:w-4`} />
                    <p className="text-2xl font-black leading-none text-foreground dark:text-white 2xl:text-3xl">{stat.value}</p>
                    <p className="mt-0.5 text-xs font-semibold text-muted-foreground dark:text-slate-400 2xl:mt-1 2xl:text-sm">{stat.label}</p>
                  </div>
                ))}
              </div>
            </div>
          </motion.div>

          <div className="mt-4 space-y-3 2xl:mt-6 2xl:space-y-4">
            <ProfileAcademicsAchievements userId={profile.id} />

            <motion.div
              initial={{ opacity: 0, y: 10 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ delay: 0.3 }}
              className="rounded-2xl border border-border bg-card p-4 dark:border-white/10 dark:bg-slate-950/80 2xl:p-5"
            >
              <div className="mb-2 flex items-center justify-between 2xl:mb-3">
                <h3 className="flex items-center gap-1.5 text-lg font-black text-foreground dark:text-white 2xl:gap-2 2xl:text-xl">
                  <Activity className="h-4 w-4 shrink-0 text-emerald-400 2xl:h-5 2xl:w-5" /> Performance
                </h3>
                <span className="text-sm font-semibold text-muted-foreground dark:text-slate-400">All time</span>
              </div>
              <Progress value={accuracy} className="h-3 rounded-full bg-muted dark:bg-slate-800" />
              <div className="mt-3 flex flex-wrap items-center justify-between gap-2 text-sm">
                <span className="font-extrabold text-emerald-400">✓ {totalCorrect} Correct</span>
                <span className="font-extrabold text-rose-400">✗ {totalWrong} Wrong</span>
                <span className="font-extrabold text-foreground dark:text-slate-200">{accuracy}% Accuracy</span>
              </div>
              <div className="mt-3 grid grid-cols-1 gap-2 md:grid-cols-3 2xl:mt-4 2xl:gap-3">
                <div className="rounded-lg border border-emerald-400/20 bg-muted/40 p-2.5 dark:bg-slate-900/70 2xl:rounded-xl 2xl:p-3">
                  <p className="text-[10px] uppercase tracking-wide text-muted-foreground dark:text-slate-400 2xl:text-xs">Correct</p>
                  <p className="text-2xl font-black text-emerald-400 2xl:text-3xl">{totalCorrect}</p>
                </div>
                <div className="rounded-lg border border-rose-400/20 bg-muted/40 p-2.5 dark:bg-slate-900/70 2xl:rounded-xl 2xl:p-3">
                  <p className="text-[10px] uppercase tracking-wide text-muted-foreground dark:text-slate-400 2xl:text-xs">Wrong</p>
                  <p className="text-2xl font-black text-rose-400 2xl:text-3xl">{totalWrong}</p>
                </div>
                <div className="rounded-lg border border-border bg-muted/40 p-2.5 dark:border-slate-700 dark:bg-slate-900/70 2xl:rounded-xl 2xl:p-3">
                  <p className="text-[10px] uppercase tracking-wide text-muted-foreground dark:text-slate-400 2xl:text-xs">Skipped</p>
                  <p className="text-2xl font-black text-foreground dark:text-white 2xl:text-3xl">0</p>
                </div>
              </div>
            </motion.div>

            <div className="grid grid-cols-1 gap-3 lg:grid-cols-2 2xl:gap-4">
              <div className="rounded-2xl border border-border bg-card p-4 dark:border-white/10 dark:bg-slate-950/80 2xl:p-5">
                <h3 className="mb-0.5 text-lg font-black text-foreground dark:text-white 2xl:mb-1 2xl:text-xl">Settings</h3>
                <p className="mb-3 text-xs text-muted-foreground dark:text-slate-400 2xl:mb-4 2xl:text-sm">Appearance & notifications</p>
                <div className="space-y-3 2xl:space-y-4">
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
              <div className="space-y-3 2xl:space-y-4">
                <div className="rounded-2xl border border-border bg-card p-4 dark:border-white/10 dark:bg-slate-950/80 2xl:p-5">
                  <div className="mb-0.5 flex items-center justify-between 2xl:mb-1">
                    <h3 className="flex items-center gap-1.5 text-lg font-black text-foreground dark:text-white 2xl:gap-2 2xl:text-xl">
                      <Heart className="h-4 w-4 shrink-0 text-rose-400 2xl:h-5 2xl:w-5" /> EduFund
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
