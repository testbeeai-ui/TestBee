"use client";

import { useState, useEffect } from "react";
import { motion } from "framer-motion";
import { useRouter } from "next/navigation";
import { useAuth } from "@/hooks/useAuth";
import { supabase } from "@/integrations/supabase/client";
import AppLayout from "@/components/AppLayout";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { User, LogOut, Coins, Pencil, Check, X } from "lucide-react";
import { useToast } from "@/hooks/use-toast";
import { ProtectedRoute } from "@/components/ProtectedRoute";
import ThemeSwitcher from "@/components/ThemeSwitcher";

const teachingLevels = ["School", "UG", "PG", "Competitive", "International"];
const examTags = ["JEE", "NEET", "GRE", "GMAT", "SAT", "TOEFL"];
const subjects = ["Physics", "Chemistry", "Math", "Biology"];
const visibilityOptions = [
  { value: "public", label: "Public" },
  { value: "invite_only", label: "Invite-only" },
];

function toggle(arr: string[] | null, val: string, setter: (v: string[]) => void) {
  const list = arr ?? [];
  setter(list.includes(val) ? list.filter((x) => x !== val) : [...list, val]);
}

export default function TeacherProfile() {
  const { user, profile, signInWithGoogle, refreshProfile } = useAuth();
  const router = useRouter();
  const { toast } = useToast();
  const [editing, setEditing] = useState(false);
  const [saving, setSaving] = useState(false);
  const [name, setName] = useState(profile?.name ?? "");
  const [teachingLevelsSel, setTeachingLevelsSel] = useState<string[]>(
    (profile?.teaching_levels as unknown as string[]) ?? []
  );
  const [subjectsSel, setSubjectsSel] = useState<string[]>(profile?.subjects ?? []);
  const [examTagsSel, setExamTagsSel] = useState<string[]>(profile?.exam_tags ?? []);
  const [visibility, setVisibility] = useState(profile?.visibility ?? "public");

  useEffect(() => {
    if (!profile) return;
    setName(profile.name ?? "");
    setTeachingLevelsSel((profile.teaching_levels as unknown as string[]) ?? []);
    setSubjectsSel(profile.subjects ?? []);
    setExamTagsSel(profile.exam_tags ?? []);
    setVisibility(profile.visibility ?? "public");
  }, [profile?.id, profile?.name, profile?.teaching_levels, profile?.subjects, profile?.exam_tags, profile?.visibility]);

  if (!user || !profile) return null;

  const handleSave = async () => {
    setSaving(true);
    const { error } = await supabase
      .from("profiles")
      .update({
        name: name.trim() || profile.name,
        teaching_levels: (teachingLevelsSel.length ? teachingLevelsSel : null) as unknown as number[] | null,
        subjects: subjectsSel.length ? subjectsSel : null,
        exam_tags: examTagsSel.length ? examTagsSel : null,
        visibility,
      })
      .eq("id", user.id);
    if (error) {
      toast({ title: "Error", description: error.message, variant: "destructive" });
    } else {
      await refreshProfile();
      setEditing(false);
      toast({ title: "Profile updated" });
    }
    setSaving(false);
  };

  const handleCancelEdit = () => {
    setName(profile.name ?? "");
    setTeachingLevelsSel((profile?.teaching_levels as unknown as string[]) ?? []);
    setSubjectsSel(profile?.subjects ?? []);
    setExamTagsSel(profile?.exam_tags ?? []);
    setVisibility(profile?.visibility ?? "public");
    setEditing(false);
  };

  return (
    <ProtectedRoute>
      <AppLayout>
        <div className="max-w-3xl mx-auto space-y-6">
          {/* Header: Avatar, Name, Google status */}
          <motion.div
            initial={{ opacity: 0, y: -10 }}
            animate={{ opacity: 1, y: 0 }}
            className="edu-card p-8 flex flex-col sm:flex-row items-center gap-6"
          >
            <div className="w-20 h-20 gradient-primary rounded-2xl flex items-center justify-center shrink-0 shadow-lg">
              <User className="w-10 h-10 text-primary-foreground" />
            </div>
            <div className="text-center sm:text-left flex-1">
              <h2 className="text-2xl font-display text-foreground">{profile.name || user.email}</h2>
              <span className="edu-chip bg-primary/10 text-primary mt-2 inline-block">Teacher</span>
              {/* Google Connect Status (Flow 1.2) */}
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
                onClick={async () => {
                  const { error } = await supabase.auth.signOut();
                  if (!error) router.push("/");
                }}
              >
                <LogOut className="w-4 h-4 mr-2" /> Log Out
              </Button>
            </div>
          </motion.div>

          {/* Professional Details (Flow 1.3) */}
          <motion.div
            initial={{ opacity: 0, y: 10 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: 0.1 }}
            className="edu-card p-6"
          >
            <div className="flex items-center justify-between mb-5">
              <h3 className="font-display text-lg text-foreground">Professional details</h3>
              {!editing ? (
                <Button variant="outline" size="sm" onClick={() => setEditing(true)} className="rounded-xl gap-1.5">
                  <Pencil className="w-3.5 h-3.5" /> Edit
                </Button>
              ) : (
                <div className="flex gap-2">
                  <Button variant="outline" size="sm" onClick={handleCancelEdit} className="rounded-xl">
                    <X className="w-3.5 h-3.5" />
                  </Button>
                  <Button size="sm" onClick={handleSave} disabled={saving} className="rounded-xl gap-1.5">
                    <Check className="w-3.5 h-3.5" /> {saving ? "Saving..." : "Save"}
                  </Button>
                </div>
              )}
            </div>

            {editing ? (
              <div className="space-y-5">
                <div>
                  <label className="text-sm font-extrabold text-foreground mb-1.5 block">Name</label>
                  <Input value={name} onChange={(e) => setName(e.target.value)} className="rounded-xl h-11" />
                </div>
                <div>
                  <label className="text-sm font-extrabold text-foreground mb-2 block">Teaching levels</label>
                  <div className="flex flex-wrap gap-2">
                    {teachingLevels.map((l) => (
                      <button
                        key={l}
                        onClick={() => toggle(teachingLevelsSel, l, setTeachingLevelsSel)}
                        className={`px-3 py-2 rounded-xl font-bold text-sm transition-all ${teachingLevelsSel.includes(l) ? "bg-primary text-primary-foreground shadow-md" : "bg-muted text-muted-foreground hover:bg-muted/80"}`}
                      >
                        {l}
                      </button>
                    ))}
                  </div>
                </div>
                <div>
                  <label className="text-sm font-extrabold text-foreground mb-2 block">Subjects</label>
                  <div className="flex flex-wrap gap-2">
                    {subjects.map((s) => (
                      <button
                        key={s}
                        onClick={() => toggle(subjectsSel, s, setSubjectsSel)}
                        className={`px-3 py-2 rounded-xl font-bold text-sm transition-all ${subjectsSel.includes(s) ? "bg-primary text-primary-foreground shadow-md" : "bg-muted text-muted-foreground hover:bg-muted/80"}`}
                      >
                        {s}
                      </button>
                    ))}
                  </div>
                </div>
                <div>
                  <label className="text-sm font-extrabold text-foreground mb-2 block">Exam tags</label>
                  <div className="flex flex-wrap gap-2">
                    {examTags.map((e) => (
                      <button
                        key={e}
                        onClick={() => toggle(examTagsSel, e, setExamTagsSel)}
                        className={`px-3 py-2 rounded-xl font-bold text-sm transition-all ${examTagsSel.includes(e) ? "bg-accent text-accent-foreground shadow-md" : "bg-muted text-muted-foreground hover:bg-muted/80"}`}
                      >
                        {e}
                      </button>
                    ))}
                  </div>
                </div>
                <div>
                  <label className="text-sm font-extrabold text-foreground mb-2 block">Visibility</label>
                  <div className="flex gap-2">
                    {visibilityOptions.map((v) => (
                      <button
                        key={v.value}
                        onClick={() => setVisibility(v.value)}
                        className={`px-4 py-2 rounded-xl font-bold text-sm transition-all ${visibility === v.value ? "bg-primary text-primary-foreground shadow-md" : "bg-muted text-muted-foreground hover:bg-muted/80"}`}
                      >
                        {v.label}
                      </button>
                    ))}
                  </div>
                </div>
              </div>
            ) : (
              <div className="space-y-4 text-sm">
                <div>
                  <span className="text-muted-foreground font-bold">Teaching levels:</span>{" "}
                  {(profile.teaching_levels as unknown as string[])?.length
                    ? (profile.teaching_levels as unknown as string[]).join(", ")
                    : "—"}
                </div>
                <div>
                  <span className="text-muted-foreground font-bold">Subjects:</span>{" "}
                  {profile.subjects?.length ? profile.subjects.join(", ") : "—"}
                </div>
                <div>
                  <span className="text-muted-foreground font-bold">Exam tags:</span>{" "}
                  {profile.exam_tags?.length ? profile.exam_tags.join(", ") : "—"}
                </div>
                <div>
                  <span className="text-muted-foreground font-bold">Visibility:</span>{" "}
                  {profile.visibility === "invite_only" ? "Invite-only" : "Public"}
                </div>
              </div>
            )}
          </motion.div>

          <motion.div
            initial={{ opacity: 0, y: 10 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: 0.15 }}
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
