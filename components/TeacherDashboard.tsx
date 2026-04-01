"use client";

import { useEffect, useState } from "react";
import { motion } from "framer-motion";
import { useRouter } from "next/navigation";
import { useAuth } from "@/hooks/useAuth";
import { supabase } from "@/integrations/supabase/client";
import AppLayout from "@/components/AppLayout";
import {
  BookOpen,
  Plus,
  Video,
  Calendar,
  ArrowRight,
  School,
  Users,
  FileText,
} from "lucide-react";

interface Classroom {
  id: string;
  name: string;
  section: string | null;
  subject: string | null;
  type: string;
}

export default function TeacherDashboard() {
  const { user, profile } = useAuth();
  const router = useRouter();
  const [classrooms, setClassrooms] = useState<Classroom[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    if (!user || profile?.role !== "teacher") return;
    const fetchClassrooms = async () => {
      const { data } = await supabase
        .from("classrooms")
        .select("id, name, section, subject, type")
        .eq("teacher_id", user.id)
        .order("created_at", { ascending: false })
        .limit(3);
      setClassrooms((data as Classroom[]) || []);
      setLoading(false);
    };
    fetchClassrooms();
  }, [user, profile?.role]);

  const quickActions = [
    {
      label: "Create Classroom",
      desc: "New class on EduBlast",
      path: "/classrooms",
      emoji: "📚",
      gradient: "from-primary to-secondary",
    },
    {
      label: "Schedule Live",
      desc: "Schedule a live lecture",
      path: "/classrooms",
      emoji: "🎥",
      gradient: "from-blue-500 to-cyan-500",
    },
  ];

  return (
    <AppLayout>
      <div className="space-y-8">
        {/* Welcome banner */}
        <motion.div
          initial={{ opacity: 0, y: -20 }}
          animate={{ opacity: 1, y: 0 }}
          className="relative overflow-hidden rounded-3xl gradient-primary p-8 md:p-10 text-primary-foreground"
        >
          <div className="relative z-10">
            <p className="text-primary-foreground/70 text-sm font-bold mb-1">Teach on ESM</p>
            <h1 className="text-3xl md:text-4xl font-display mb-2">{profile?.name ?? user?.email}!</h1>
            <div className="flex flex-wrap items-center gap-3 mt-3">
              <span className="edu-chip bg-primary-foreground/20 text-primary-foreground">
                📖 Teacher
              </span>
              {profile?.subjects?.length ? (
                <span className="edu-chip bg-primary-foreground/20 text-primary-foreground">
                  {profile.subjects.join(", ")}
                </span>
              ) : null}
            </div>
          </div>
          <div className="absolute -right-8 -top-8 w-36 h-36 bg-primary-foreground/10 rounded-full blur-sm" />
          <div className="absolute -right-4 bottom--4 w-20 h-20 bg-primary-foreground/5 rounded-full" />
        </motion.div>

        {/* Weekly Plan (Flow 6 placeholder) */}
        <motion.div
          initial={{ opacity: 0, x: -20 }}
          animate={{ opacity: 1, x: 0 }}
          transition={{ delay: 0.1 }}
          className="edu-card p-6"
        >
          <div className="flex items-center gap-2.5 mb-5">
            <div className="w-9 h-9 bg-primary/10 rounded-xl flex items-center justify-center">
              <Calendar className="w-5 h-5 text-primary" />
            </div>
            <h2 className="text-xl font-display text-foreground">Weekly Plan</h2>
          </div>
          <div className="grid grid-cols-2 sm:grid-cols-4 gap-4">
            <div className="bg-muted/40 rounded-xl p-4 text-center">
              <p className="text-2xl font-extrabold text-foreground">—</p>
              <p className="text-xs text-muted-foreground font-bold mt-1">Live sessions</p>
            </div>
            <div className="bg-muted/40 rounded-xl p-4 text-center">
              <p className="text-2xl font-extrabold text-foreground">—</p>
              <p className="text-xs text-muted-foreground font-bold mt-1">Micro-lessons</p>
            </div>
            <div className="bg-muted/40 rounded-xl p-4 text-center">
              <p className="text-2xl font-extrabold text-foreground">—</p>
              <p className="text-xs text-muted-foreground font-bold mt-1">Practice challenges</p>
            </div>
            <div className="bg-muted/40 rounded-xl p-4 text-center">
              <p className="text-2xl font-extrabold text-foreground">—</p>
              <p className="text-xs text-muted-foreground font-bold mt-1">Weekly boss test</p>
            </div>
          </div>
          <p className="text-xs text-muted-foreground mt-4 font-bold">
            Weekly cycle and insights coming soon.
          </p>
        </motion.div>

        {/* My Classrooms + Quick Actions grid */}
        <div className="grid lg:grid-cols-3 gap-6">
          {/* My Classrooms quick list */}
          <motion.div
            initial={{ opacity: 0, x: -20 }}
            animate={{ opacity: 1, x: 0 }}
            transition={{ delay: 0.2 }}
            className="lg:col-span-2 edu-card p-6"
          >
            <div className="flex items-center justify-between mb-5">
              <div className="flex items-center gap-2.5">
                <div className="w-9 h-9 bg-primary/10 rounded-xl flex items-center justify-center">
                  <School className="w-5 h-5 text-primary" />
                </div>
                <h2 className="text-xl font-display text-foreground">My Classrooms</h2>
              </div>
              <button
                onClick={() => router.push("/classrooms")}
                className="text-sm font-extrabold text-primary hover:underline flex items-center gap-1"
              >
                View all <ArrowRight className="w-3.5 h-3.5" />
              </button>
            </div>
            {loading ? (
              <div className="space-y-3">
                {[1, 2, 3].map((i) => (
                  <div key={i} className="h-16 bg-muted/40 rounded-xl animate-pulse" />
                ))}
              </div>
            ) : classrooms.length === 0 ? (
              <div className="text-center py-10">
                <div className="w-14 h-14 bg-muted rounded-2xl flex items-center justify-center mx-auto mb-3">
                  <BookOpen className="w-7 h-7 text-muted-foreground/40" />
                </div>
                <p className="text-foreground font-bold text-sm">No classrooms yet</p>
                <p className="text-muted-foreground text-xs mt-1">
                  Create your first classroom to get started
                </p>
                <button
                  onClick={() => router.push("/classrooms")}
                  className="mt-4 rounded-xl edu-btn-primary px-5 py-2.5 text-sm font-extrabold"
                >
                  <Plus className="w-4 h-4 inline mr-1.5" /> New Classroom
                </button>
              </div>
            ) : (
              <div className="space-y-3">
                {classrooms.map((c, i) => (
                  <motion.button
                    key={c.id}
                    initial={{ opacity: 0, y: 10 }}
                    animate={{ opacity: 1, y: 0 }}
                    transition={{ delay: 0.2 + i * 0.05 }}
                    onClick={() => router.push(`/classroom/${c.id}`)}
                    className="w-full flex items-center gap-4 edu-card p-4 hover:border-primary/30 group text-left"
                  >
                    <div className="w-11 h-11 rounded-xl gradient-primary flex items-center justify-center text-primary-foreground text-lg shadow-md">
                      {c.type === "google_linked" ? "🔗" : "📚"}
                    </div>
                    <div className="flex-1 min-w-0">
                      <p className="font-extrabold text-sm text-foreground truncate">{c.name}</p>
                      <p className="text-xs text-muted-foreground">
                        {c.subject ?? "No subject"} · {c.type === "google_linked" ? "Google" : "ESM"}
                      </p>
                    </div>
                    <ArrowRight className="w-4 h-4 text-muted-foreground group-hover:text-primary shrink-0" />
                  </motion.button>
                ))}
              </div>
            )}
          </motion.div>

          {/* Quick Actions */}
          <motion.div
            initial={{ opacity: 0, x: 20 }}
            animate={{ opacity: 1, x: 0 }}
            transition={{ delay: 0.3 }}
            className="space-y-3"
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
      </div>
    </AppLayout>
  );
}
