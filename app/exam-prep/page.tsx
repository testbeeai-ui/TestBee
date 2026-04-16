"use client";

import { motion } from "framer-motion";
import Link from "next/link";
import AppLayout from "@/components/AppLayout";
import { ProtectedRoute } from "@/components/ProtectedRoute";
import {
  ClipboardList,
  School,
  BookMarked,
  Calendar,
  ChevronRight,
  Lock,
} from "lucide-react";

const cards = [
  {
    href: "/classrooms",
    icon: School,
    title: "Classes",
    description:
      "Teachers, Students, Mentors – Motivational, Soft Skills, How to Ace. See your RDM Score on your profile.",
    gradient: "from-blue-500 to-cyan-500",
    available: true,
  },
  {
    href: "/mock",
    icon: ClipboardList,
    title: "Mock Tests",
    description: "Timed mock tests to simulate exam conditions and track your performance.",
    gradient: "from-amber-500 to-orange-500",
    available: true,
  },
  {
    href: "/revision",
    icon: BookMarked,
    title: "Revision",
    description: "Spaced repetition with instructive questions and reasons – save cards and revise by topic.",
    gradient: "from-green-500 to-emerald-500",
    available: true,
  },
  {
    href: "/mock#calendar",
    icon: Calendar,
    title: "Calendar",
    description: "Prep + Mock calendar tracks class, revision, mock, and doubt activity by day.",
    gradient: "from-purple-500 to-violet-500",
    available: true,
  },
];

export default function ExamPrepPage() {
  return (
    <ProtectedRoute>
      <AppLayout>
        <motion.div
          initial={{ opacity: 0, y: 10 }}
          animate={{ opacity: 1, y: 0 }}
          className="max-w-4xl mx-auto"
        >
          <div className="edu-page-header">
            <h2 className="edu-page-title flex items-center gap-3">
              <div className="w-10 h-10 gradient-primary rounded-xl flex items-center justify-center">
                <ClipboardList className="w-5 h-5 text-primary-foreground" />
              </div>
              Exam Prep
            </h2>
            <p className="edu-page-desc">
              Classes, mocks, revision, and more to help you ace your exams
            </p>
          </div>

          <div className="grid sm:grid-cols-2 gap-4 mt-8">
            {cards.map((item, i) => {
              const Icon = item.icon;
              const content = (
                <div
                  className={`edu-card p-6 rounded-2xl text-left border border-border transition-all ${
                    item.available
                      ? "hover:shadow-[0_8px_30px_rgba(0,0,0,0.12)] hover:scale-[1.02] group cursor-pointer"
                      : "opacity-75 cursor-default"
                  }`}
                >
                  <div
                    className={`w-12 h-12 rounded-xl bg-gradient-to-br ${item.gradient} flex items-center justify-center mb-4 ${
                      item.available ? "group-hover:scale-110 transition-transform" : ""
                    }`}
                  >
                    <Icon className="w-6 h-6 text-white" />
                  </div>
                  <div className="flex items-center gap-2 mb-1">
                    <h3 className="font-extrabold text-lg text-foreground">
                      {item.title}
                    </h3>
                    {!item.available && (
                      <span className="edu-chip bg-muted text-muted-foreground text-[10px] font-bold flex items-center gap-1">
                        <Lock className="w-3 h-3" /> Optional / Coming soon
                      </span>
                    )}
                  </div>
                  <p className="text-sm text-muted-foreground mb-3">
                    {item.description}
                  </p>
                  {item.available ? (
                    <span className="inline-flex items-center gap-1 text-sm font-bold text-primary">
                      Open <ChevronRight className="w-4 h-4" />
                    </span>
                  ) : (
                    <span className="inline-flex items-center gap-1 text-sm font-bold text-muted-foreground">
                      Next phase
                    </span>
                  )}
                </div>
              );

              if (item.available) {
                return (
                  <Link key={item.href} href={item.href}>
                    {content}
                  </Link>
                );
              }
              return <div key={item.title}>{content}</div>;
            })}
          </div>
        </motion.div>
      </AppLayout>
    </ProtectedRoute>
  );
}
