"use client";

import { useMemo } from "react";
import { motion } from "framer-motion";
import { useRouter } from "next/navigation";
import { useAuth } from "@/hooks/useAuth";
import { useUserStore } from "@/store/useUserStore";
import { questions } from "@/data/questions";
import AppLayout from "@/components/AppLayout";
import { useStreakTimer } from "@/hooks/useStreakTimer";
import { Progress } from "@/components/ui/progress";
import TeacherDashboard from "@/components/TeacherDashboard";
import {
  Target,
  TrendingUp,
  CheckCircle2,
  XCircle,
  Coins,
  AlertTriangle,
  Zap,
  ArrowRight,
  BookOpen,
  BookMarked,
} from "lucide-react";
import { Subject } from "@/types";
import { ProtectedRoute } from "@/components/ProtectedRoute";

const subjectEmojis: Record<Subject, string> = {
  physics: "⚡",
  chemistry: "🧪",
  math: "📐",
  biology: "🧬",
};

const subjectGradients: Record<Subject, string> = {
  physics: "from-blue-500 to-cyan-400",
  chemistry: "from-purple-500 to-violet-400",
  math: "from-orange-500 to-amber-400",
  biology: "from-green-500 to-emerald-400",
};

export default function HomePage() {
  const { profile } = useAuth();
  const user = useUserStore((s) => s.user);
  const allResults = useUserStore((s) => s.allResults);
  const router = useRouter();
  const streakTimer = useStreakTimer();

  if (profile?.role === "teacher") {
    return (
      <ProtectedRoute>
        <TeacherDashboard />
      </ProtectedRoute>
    );
  }

  const subjects: Subject[] = useMemo(() => {
    if (!user) return ["physics", "chemistry", "math"];
    return user.subjectCombo === "PCMB"
      ? ["physics", "chemistry", "math", "biology"]
      : ["physics", "chemistry", "math"];
  }, [user]);

  const subjectStats = useMemo(() => {
    return subjects.map((subject) => {
      const subjectQIds = questions.filter((q) => q.subject === subject).map((q) => q.id);
      const subjectResults = allResults.filter((r) => subjectQIds.includes(r.questionId));
      const total = subjectResults.length;
      const correct = subjectResults.filter((r) => r.isCorrect).length;
      const accuracy = total > 0 ? Math.round((correct / total) * 100) : 0;
      return { subject, total, correct, wrong: total - correct, accuracy };
    });
  }, [subjects, allResults]);

  const totalAnswered = allResults.length;
  const totalCorrect = allResults.filter((r) => r.isCorrect).length;
  const overallAccuracy =
    totalAnswered > 0 ? Math.round((totalCorrect / totalAnswered) * 100) : 0;

  const weakestSubject = useMemo(() => {
    const attempted = subjectStats.filter((s) => s.total > 0);
    if (attempted.length === 0) return null;
    return attempted.reduce((min, s) => (s.accuracy < min.accuracy ? s : min));
  }, [subjectStats]);

  const recentActivity = useMemo(() => {
    return allResults
      .slice(-5)
      .reverse()
      .map((r) => {
        const q = questions.find((q) => q.id === r.questionId);
        return { ...r, question: q };
      });
  }, [allResults]);

  const quickActions = [
    { label: "Question Gun", desc: "Fire 5 random questions", path: "/play", gradient: "from-orange-500 to-red-500", emoji: "🔥" },
    { label: "Explore Topics", desc: "Browse by subject & topic", path: "/explore", gradient: "from-blue-500 to-cyan-500", emoji: "🧭" },
    { label: "Revision Bank", desc: "Review saved questions", path: "/revision", gradient: "from-green-500 to-emerald-500", emoji: "📚" },
    { label: "Premium Plans", desc: "Unlock more features", path: "/pricing", gradient: "from-purple-500 to-pink-500", emoji: "👑" },
  ];

  const statCards = [
    { icon: Target, label: "Questions Done", value: totalAnswered, color: "text-edu-blue", bg: "bg-edu-blue/10" },
    { icon: TrendingUp, label: "Accuracy", value: `${overallAccuracy}%`, color: "text-edu-green", bg: "bg-edu-green/10" },
    { icon: Coins, label: "RDM Balance", value: profile?.rdm ?? user?.rdm ?? 0, color: "text-edu-orange", bg: "bg-edu-orange/10" },
    { icon: BookMarked, label: "Saved", value: user?.savedQuestions.length ?? 0, color: "text-edu-purple", bg: "bg-edu-purple/10" },
  ];

  return (
    <ProtectedRoute>
      <AppLayout streakTimer={streakTimer}>
        <div className="space-y-8">
          <motion.div
            initial={{ opacity: 0, y: -20 }}
            animate={{ opacity: 1, y: 0 }}
            className="relative overflow-hidden rounded-3xl gradient-primary p-8 md:p-10 text-primary-foreground"
          >
            <div className="relative z-10">
              <p className="text-primary-foreground/70 text-sm font-bold mb-1">Welcome back 👋</p>
              <h1 className="text-3xl md:text-4xl font-display mb-2">{user?.name}!</h1>
              <div className="flex flex-wrap items-center gap-3 mt-3">
                <span className="edu-chip bg-primary-foreground/20 text-primary-foreground">🎓 Class {user?.classLevel}</span>
                <span className="edu-chip bg-primary-foreground/20 text-primary-foreground">📚 {user?.subjectCombo}</span>
                <span className="edu-chip bg-primary-foreground/20 text-primary-foreground">
                  🔬 {user?.stream.charAt(0).toUpperCase()}
                  {user?.stream.slice(1)}
                </span>
              </div>
            </div>
            <div className="absolute -right-8 -top-8 w-36 h-36 bg-primary-foreground/10 rounded-full blur-sm" />
            <div className="absolute -right-4 bottom--4 w-20 h-20 bg-primary-foreground/5 rounded-full" />
            <div className="absolute left-1/2 -bottom-6 w-32 h-32 bg-primary-foreground/5 rounded-full" />
          </motion.div>

          <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
            {statCards.map((stat, i) => (
              <motion.div
                key={stat.label}
                initial={{ opacity: 0, y: 20 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ delay: i * 0.08 }}
                className="edu-stat-card"
              >
                <div className={`w-11 h-11 ${stat.bg} rounded-xl flex items-center justify-center mx-auto mb-3`}>
                  <stat.icon className={`w-5 h-5 ${stat.color}`} />
                </div>
                <div className="text-2xl font-extrabold text-foreground">{stat.value}</div>
                <div className="text-xs text-muted-foreground mt-1 font-bold">{stat.label}</div>
              </motion.div>
            ))}
          </div>

          <div className="grid lg:grid-cols-5 gap-6">
            <motion.div
              initial={{ opacity: 0, x: -20 }}
              animate={{ opacity: 1, x: 0 }}
              transition={{ delay: 0.2 }}
              className="lg:col-span-3 edu-card p-6"
            >
              <div className="flex items-center gap-2.5 mb-6">
                <div className="w-9 h-9 bg-primary/10 rounded-xl flex items-center justify-center">
                  <BookOpen className="w-5 h-5 text-primary" />
                </div>
                <h2 className="text-xl font-display text-foreground">Subject Performance</h2>
              </div>

              {totalAnswered === 0 ? (
                <div className="text-center py-12 text-muted-foreground">
                  <div className="w-16 h-16 bg-muted rounded-2xl flex items-center justify-center mx-auto mb-4">
                    <Target className="w-8 h-8 opacity-40" />
                  </div>
                  <p className="font-bold text-foreground">No questions answered yet</p>
                  <p className="text-sm mt-1">Fire the Question Gun to start tracking!</p>
                </div>
              ) : (
                <div className="space-y-5">
                  {subjectStats.map((stat) => (
                    <div key={stat.subject} className="space-y-2">
                      <div className="flex items-center justify-between">
                        <div className="flex items-center gap-2.5">
                          <div
                            className={`w-8 h-8 rounded-lg bg-gradient-to-br ${subjectGradients[stat.subject]} flex items-center justify-center text-sm`}
                          >
                            {subjectEmojis[stat.subject]}
                          </div>
                          <span className="font-extrabold text-sm text-foreground capitalize">{stat.subject}</span>
                        </div>
                        <div className="flex items-center gap-3 text-xs font-bold">
                          <span className="flex items-center gap-1 text-edu-green">
                            <CheckCircle2 className="w-3.5 h-3.5" /> {stat.correct}
                          </span>
                          <span className="flex items-center gap-1 text-destructive">
                            <XCircle className="w-3.5 h-3.5" /> {stat.wrong}
                          </span>
                          <span className="text-foreground bg-muted px-2 py-0.5 rounded-full">{stat.accuracy}%</span>
                        </div>
                      </div>
                      <Progress value={stat.total > 0 ? stat.accuracy : 0} className="h-3 rounded-full" />
                    </div>
                  ))}
                  {weakestSubject && weakestSubject.accuracy < 70 && (
                    <motion.div
                      initial={{ opacity: 0 }}
                      animate={{ opacity: 1 }}
                      className="mt-5 flex items-start gap-3 bg-edu-orange/10 border border-edu-orange/20 rounded-2xl p-4"
                    >
                      <div className="w-9 h-9 bg-edu-orange/15 rounded-xl flex items-center justify-center shrink-0">
                        <AlertTriangle className="w-5 h-5 text-edu-orange" />
                      </div>
                      <div>
                        <p className="font-extrabold text-sm text-foreground">
                          Focus on {weakestSubject.subject.charAt(0).toUpperCase() + weakestSubject.subject.slice(1)}
                        </p>
                        <p className="text-xs text-muted-foreground mt-0.5">
                          Accuracy at {weakestSubject.accuracy}% — practice more to improve!
                        </p>
                        <button
                          onClick={() => router.push("/explore")}
                          className="text-xs text-primary font-extrabold mt-2 flex items-center gap-1 hover:underline"
                        >
                          Practice now <ArrowRight className="w-3 h-3" />
                        </button>
                      </div>
                    </motion.div>
                  )}
                </div>
              )}
            </motion.div>

            <motion.div
              initial={{ opacity: 0, x: 20 }}
              animate={{ opacity: 1, x: 0 }}
              transition={{ delay: 0.3 }}
              className="lg:col-span-2 space-y-3"
            >
              <h2 className="text-xl font-display text-foreground mb-4">Quick Actions</h2>
              {quickActions.map((action, i) => (
                <motion.button
                  key={action.label}
                  initial={{ opacity: 0, y: 10 }}
                  animate={{ opacity: 1, y: 0 }}
                  transition={{ delay: 0.3 + i * 0.08 }}
                  onClick={() => router.push(action.path)}
                  className="w-full flex items-center gap-4 edu-card p-4 hover:border-primary/30 group text-left"
                >
                  <div
                    className={`w-12 h-12 rounded-xl bg-gradient-to-br ${action.gradient} flex items-center justify-center text-white text-xl shrink-0 shadow-md group-hover:scale-105 transition-transform`}
                  >
                    {action.emoji}
                  </div>
                  <div className="flex-1 min-w-0">
                    <div className="font-extrabold text-sm text-foreground">{action.label}</div>
                    <div className="text-xs text-muted-foreground">{action.desc}</div>
                  </div>
                  <ArrowRight className="w-4 h-4 text-muted-foreground group-hover:text-primary group-hover:translate-x-0.5 transition-all shrink-0" />
                </motion.button>
              ))}
            </motion.div>
          </div>

          {recentActivity.length > 0 && (
            <motion.div
              initial={{ opacity: 0, y: 20 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ delay: 0.4 }}
              className="edu-card p-6"
            >
              <div className="flex items-center gap-2.5 mb-5">
                <div className="w-9 h-9 bg-edu-blue/10 rounded-xl flex items-center justify-center">
                  <Zap className="w-5 h-5 text-edu-blue" />
                </div>
                <h2 className="text-xl font-display text-foreground">Recent Activity</h2>
              </div>
              <div className="grid gap-3 md:grid-cols-2 lg:grid-cols-3">
                {recentActivity.map((activity, i) => (
                  <div
                    key={`${activity.questionId}-${i}`}
                    className="flex items-center gap-3 bg-muted/40 rounded-xl p-3.5 hover:bg-muted/60 transition-colors"
                  >
                    <div
                      className={`w-9 h-9 rounded-xl flex items-center justify-center shrink-0 ${
                        activity.isCorrect ? "bg-edu-green/15 text-edu-green" : "bg-destructive/15 text-destructive"
                      }`}
                    >
                      {activity.isCorrect ? <CheckCircle2 className="w-4 h-4" /> : <XCircle className="w-4 h-4" />}
                    </div>
                    <div className="min-w-0 flex-1">
                      <p className="text-xs font-extrabold text-foreground truncate">
                        {activity.question?.topic ?? "Unknown"}
                      </p>
                      <p className="text-[11px] text-muted-foreground capitalize font-bold">
                        {activity.question?.subject}
                      </p>
                    </div>
                  </div>
                ))}
              </div>
            </motion.div>
          )}
        </div>
      </AppLayout>
    </ProtectedRoute>
  );
}
