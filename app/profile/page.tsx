"use client";

import { motion } from "framer-motion";
import { useRouter } from "next/navigation";
import AppLayout from "@/components/AppLayout";
import { useAuth } from "@/hooks/useAuth";
import { useUserStore } from "@/store/useUserStore";
import { Button } from "@/components/ui/button";
import { User, LogOut, BookOpen, Trophy, Coins, Target } from "lucide-react";
import { Progress } from "@/components/ui/progress";
import { ProtectedRoute } from "@/components/ProtectedRoute";
import TeacherProfile from "@/components/TeacherProfile";
import ThemeSwitcher from "@/components/ThemeSwitcher";
import { CreditsSection } from "@/components/CreditsSection";
import ProfileAcademicsAchievements from "@/components/ProfileAcademicsAchievements";

export default function Profile() {
  const { user: authUser, profile, signOut, signInWithGoogle } = useAuth();
  const storeUser = useUserStore((s) => s.user);
  const storeLogout = useUserStore((s) => s.logout);
  const allResults = useUserStore((s) => s.allResults);
  const router = useRouter();

  if (profile?.role === "teacher") {
    return <TeacherProfile />;
  }

  if (!profile) return null;

  const displayName = profile.name || authUser?.email?.split("@")[0] || "Student";
  const classLevel = profile.class_level ?? storeUser?.classLevel ?? "—";
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
        <div className="max-w-3xl mx-auto space-y-6">
          <motion.div
            initial={{ opacity: 0, y: -10 }}
            animate={{ opacity: 1, y: 0 }}
            className="edu-card p-8 flex flex-col sm:flex-row items-center gap-6"
          >
            <div className="w-20 h-20 gradient-primary rounded-2xl flex items-center justify-center shrink-0 shadow-lg">
              <User className="w-10 h-10 text-primary-foreground" />
            </div>
            <div className="text-center sm:text-left flex-1">
              <h2 className="text-2xl font-display text-foreground">{displayName}</h2>
              <div className="flex flex-wrap items-center gap-2 mt-2 justify-center sm:justify-start">
                <span className="edu-chip bg-primary/10 text-primary">Class {classLevel}</span>
                <span className="edu-chip bg-edu-green/10 text-edu-green">{subjectCombo}</span>
              </div>
              <div className="mt-4">
                {profile.google_connected ? (
                  <p className="text-sm font-bold text-edu-green flex items-center gap-1.5">
                    <span className="w-2 h-2 rounded-full bg-edu-green" />
                    Connected to Google
                  </p>
                ) : (
                  <Button
                    variant="outline"
                    size="sm"
                    onClick={() => signInWithGoogle()}
                    className="rounded-xl font-bold mt-1 gap-2"
                  >
                    <svg className="w-4 h-4" viewBox="0 0 24 24">
                      <path fill="#4285F4" d="M22.56 12.25c0-.78-.07-1.53-.2-2.25H12v4.26h5.92c-.26 1.37-1.04 2.53-2.21 3.31v2.77h3.57c2.08-1.92 3.28-4.74 3.28-8.09z" />
                      <path fill="#34A853" d="M12 23c2.97 0 5.46-.98 7.28-2.66l-3.57-2.77c-.98.66-2.23 1.06-3.71 1.06-2.86 0-5.29-1.93-6.16-4.53H2.18v2.84C3.99 20.53 7.7 23 12 23z" />
                      <path fill="#FBBC05" d="M5.84 14.09c-.22-.66-.35-1.36-.35-2.09s.13-1.43.35-2.09V7.07H2.18C1.43 8.55 1 10.22 1 12s.43 3.45 1.18 4.93l2.85-2.22.81-.62z" />
                      <path fill="#EA4335" d="M12 5.38c1.62 0 3.06.56 4.21 1.64l3.15-3.15C17.45 2.09 14.97 1 12 1 7.7 1 3.99 3.47 2.18 7.07l3.66 2.84c.87-2.6 3.3-4.53 6.16-4.53z" />
                    </svg>
                    Connect Google
                  </Button>
                )}
              </div>
            </div>
            <div className="flex gap-2">
              <Button
                variant="outline"
                onClick={() => router.push("/pricing")}
                className="rounded-xl font-extrabold"
              >
                <Coins className="w-4 h-4 mr-2" /> Top Up
              </Button>
              <Button
                variant="outline"
                className="rounded-xl font-extrabold text-destructive hover:text-destructive hover:bg-destructive/10"
                onClick={handleLogout}
              >
                <LogOut className="w-4 h-4 mr-2" /> Log Out
              </Button>
            </div>
          </motion.div>

          <motion.div
            initial={{ opacity: 0, y: 10 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: 0.05 }}
          >
            <CreditsSection rdmBalance={rdm} userHandle={displayName} />
          </motion.div>

          <div className="grid grid-cols-2 sm:grid-cols-4 gap-4">
            {[
              { icon: Coins, label: "RDM Balance", value: rdm, color: "text-edu-orange", bg: "bg-edu-orange/10" },
              { icon: Trophy, label: "Accuracy", value: `${accuracy}%`, color: "text-edu-yellow", bg: "bg-edu-yellow/10" },
              { icon: BookOpen, label: "Answered", value: allResults.length, color: "text-edu-blue", bg: "bg-edu-blue/10" },
              { icon: Target, label: "Saved", value: savedCount, color: "text-edu-green", bg: "bg-edu-green/10" },
            ].map((stat, i) => (
              <motion.div
                key={stat.label}
                initial={{ opacity: 0, y: 10 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ delay: i * 0.08 }}
                className="edu-stat-card"
              >
                <div className={`w-11 h-11 ${stat.bg} rounded-xl flex items-center justify-center mx-auto mb-3`}>
                  <stat.icon className={`w-5 h-5 ${stat.color}`} />
                </div>
                <span className="text-2xl font-extrabold text-foreground block">{stat.value}</span>
                <span className="text-xs text-muted-foreground font-bold">{stat.label}</span>
              </motion.div>
            ))}
          </div>

          <ProfileAcademicsAchievements userId={profile.id} />

          <motion.div
            initial={{ opacity: 0, y: 10 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: 0.3 }}
            className="edu-card p-6"
          >
            <h3 className="font-display text-lg text-foreground mb-4">Performance</h3>
            <div className="space-y-3">
              <Progress value={accuracy} className="h-4 rounded-full" />
              <div className="flex items-center justify-between text-sm">
                <span className="font-extrabold text-edu-green flex items-center gap-1">✓ {totalCorrect} Correct</span>
                <span className="font-extrabold text-destructive flex items-center gap-1">✗ {totalWrong} Wrong</span>
                <span className="font-extrabold text-foreground">{accuracy}% Accuracy</span>
              </div>
            </div>
          </motion.div>

          <motion.div
            initial={{ opacity: 0, y: 10 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: 0.28 }}
            className="edu-card p-6"
          >
            <h3 className="font-display text-lg text-foreground mb-4">Settings</h3>
            <ThemeSwitcher />
          </motion.div>
        </div>
      </AppLayout>
    </ProtectedRoute>
  );
}
