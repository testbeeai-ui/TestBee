"use client";

import { startTransition, useCallback, useEffect, useMemo, useState } from "react";
import type { User } from "@supabase/supabase-js";
import { useSearchParams } from "next/navigation";
import { supabase } from "@/integrations/supabase/client";
import { useToast } from "@/hooks/use-toast";
import type { Profile } from "@/hooks/useAuth";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Progress } from "@/components/ui/progress";
import {
  Select,
  SelectContent,
  SelectGroup,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import StudentProfileShell, { type StudentProfileSectionId } from "./StudentProfileShell";
import StudentSettingsHub from "./StudentSettingsHub";
import StudentSubscriptionHub from "./subscription/StudentSubscriptionHub";
import {
  StudentProfileAcademicPanel,
  StudentProfileAchievementsPanel,
  StudentProfileActivityPanel,
  StudentProfileEduFundPanel,
} from "./StudentProfileHubPanels";
import { getCitiesForState, INDIAN_STATES_AND_UTS } from "@/lib/profile/indiaGeo";
import {
  BOARD_OPTIONS,
  CATEGORY_OPTIONS,
  CLASS_YEAR_OPTIONS,
  GENDER_OPTIONS,
  STREAM_OPTIONS,
  classLabelToLevel,
  streamSelectionToProfileFields,
  toSelectItems,
} from "@/lib/profile/studentProfileOptions";
import { Building2 } from "lucide-react";
import { cn } from "@/lib/utils";
import { getClientApiAuthHeaders } from "@/lib/auth/clientApiAuth";
import { parseAcademicRecordExtras } from "@/lib/profile/academicRecordExtras";
import {
  computeStudentProfileCompletion,
  type CompletionBreakdown,
} from "@/lib/profile/studentProfileCompletionScore";
import { isStudentProfileBasicInfoComplete } from "@/lib/profile/studentProfileBasicInfo";
import { ProfileOnboardingTracker } from "@/components/profile/ProfileOnboardingTracker";
import { StudentProfilePhotoUpload } from "@/components/profile/StudentProfilePhotoUpload";
import {
  isProfileCompanionTrackingActive,
  markProfileCompanionBasicSaved,
  markProfileCompanionFormStarted,
  maybeMarkProfileOnboardingFromBasicInfo,
} from "@/lib/onboarding/profileCompanionOnboarding";

const fieldFocus =
  "focus-visible:border-emerald-500 focus-visible:ring-emerald-500/30 dark:focus-visible:border-emerald-500";

function splitNameFromProfile(profile: Profile): { first: string; last: string } {
  if (profile.first_name?.trim() || profile.last_name?.trim()) {
    return {
      first: profile.first_name?.trim() ?? "",
      last: profile.last_name?.trim() ?? "",
    };
  }
  const raw = profile.name?.trim() ?? "";
  if (!raw) return { first: "", last: "" };
  const parts = raw.split(/\s+/);
  if (parts.length === 1) return { first: parts[0], last: "" };
  return { first: parts[0]!, last: parts.slice(1).join(" ") };
}

function Req({ children }: { children: React.ReactNode }) {
  return (
    <>
      {children} <span className="text-red-500">*</span>
    </>
  );
}

const stateItems = INDIAN_STATES_AND_UTS.map((s) => ({ label: s, value: s }));

const PROFILE_SECTION_QUERY_VALUES: StudentProfileSectionId[] = [
  "personal",
  "academic",
  "achievements",
  "activity",
  "edufund",
  "sub-overview",
  "sub-plans",
  "sub-payment",
  "sub-checkout",
  "sub-history",
  "sub-cancel",
  "settings",
];

interface StudentProfilePersonalHubProps {
  profile: Profile;
  authUser: User;
  onProfileUpdated: () => Promise<void>;
}

export default function StudentProfilePersonalHub({
  profile,
  authUser,
  onProfileUpdated,
}: StudentProfilePersonalHubProps) {
  const { toast } = useToast();
  const searchParams = useSearchParams();
  const [section, setSection] = useState<StudentProfileSectionId>("personal");

  useEffect(() => {
    const raw = searchParams.get("section");
    if (!raw) return;
    if (!PROFILE_SECTION_QUERY_VALUES.includes(raw as StudentProfileSectionId)) return;
    startTransition(() => {
      setSection(raw as StudentProfileSectionId);
    });
  }, [searchParams]);

  const email = authUser.email ?? "";

  const [firstName, setFirstName] = useState("");
  const [lastName, setLastName] = useState("");
  const [stateVal, setStateVal] = useState<string | null>(null);
  const [cityVal, setCityVal] = useState<string | null>(null);
  const [phoneDigits, setPhoneDigits] = useState("");
  const [genderVal, setGenderVal] = useState<string | null>(null);
  const [categoryVal, setCategoryVal] = useState<string | null>(null);
  const [dobVal, setDobVal] = useState("");
  const [bioVal, setBioVal] = useState("");

  const [institutionName, setInstitutionName] = useState("");
  const [boardVal, setBoardVal] = useState<string | null>(null);
  const [classYearVal, setClassYearVal] = useState<string | null>(null);
  const [streamVal, setStreamVal] = useState<string | null>(null);

  const [savingPersonal, setSavingPersonal] = useState(false);
  const [savingInstitution, setSavingInstitution] = useState(false);
  const [editingPersonal, setEditingPersonal] = useState(false);
  const [editingInstitution, setEditingInstitution] = useState(false);

  const [completionPct, setCompletionPct] = useState<number | null>(null);
  const [completionSections, setCompletionSections] = useState<CompletionBreakdown | null>(null);
  const [completionStatus, setCompletionStatus] = useState<"idle" | "loading" | "ready" | "error">(
    "idle"
  );

  const loadCompletionScore = useCallback(async () => {
    if (!profile.id) {
      setCompletionPct(null);
      setCompletionSections(null);
      setCompletionStatus("idle");
      return;
    }
    setCompletionStatus((prev) => (prev === "ready" ? prev : "loading"));
    try {
      const headers = await getClientApiAuthHeaders();
      const [attendanceRes, academicsRes, achievementsRes] = await Promise.all([
        fetch("/api/user/profile-attendance-summary", { headers }),
        supabase
          .from("profile_academics")
          .select("exam, board, score, academic_year, marksheet_path")
          .eq("user_id", profile.id),
        supabase
          .from("profile_achievements")
          .select("name, level, year, result, marksheet_path")
          .eq("user_id", profile.id),
      ]);

      if (academicsRes.error) throw academicsRes.error;
      if (achievementsRes.error) throw achievementsRes.error;

      let attendance: {
        classroomsJoined: number;
        assignmentTasksDone: number;
        dailyDoseDualStreak: number;
        mocksAttempted: number;
        instacueDwellEventsThisWeek: number;
        studyMsTotal: number;
      } | null = null;
      if (attendanceRes.ok) {
        const json = (await attendanceRes.json()) as Record<string, unknown>;
        attendance = {
          classroomsJoined: Number(json.classroomsJoined) || 0,
          assignmentTasksDone: Number(json.assignmentTasksDone) || 0,
          dailyDoseDualStreak: Number(json.dailyDoseDualStreak) || 0,
          mocksAttempted: Number(json.mocksAttempted) || 0,
          instacueDwellEventsThisWeek: Number(json.instacueDwellEventsThisWeek) || 0,
          studyMsTotal: Number(json.studyMsTotal) || 0,
        };
      }

      const result = computeStudentProfileCompletion({
        profile,
        academics: academicsRes.data ?? [],
        academicExtras: parseAcademicRecordExtras(profile.academic_record_extras),
        achievements: achievementsRes.data ?? [],
        attendance,
      });
      setCompletionPct(result.overall);
      setCompletionSections(result.sections);
      setCompletionStatus("ready");
    } catch {
      setCompletionPct(null);
      setCompletionSections(null);
      setCompletionStatus("error");
    }
  }, [profile]);

  useEffect(() => {
    startTransition(() => {
      setCompletionPct(null);
      setCompletionSections(null);
      setCompletionStatus("idle");
      void loadCompletionScore();
    });
  }, [profile.id, loadCompletionScore]);

  useEffect(() => {
    if (profile.role !== "student") return;
    maybeMarkProfileOnboardingFromBasicInfo(
      isStudentProfileBasicInfoComplete(profile, authUser.email),
      profile,
      authUser.email
    );
  }, [profile, authUser.email]);

  useEffect(() => {
    if (isProfileCompanionTrackingActive() && section === "personal") {
      setEditingPersonal(true);
    }
  }, [section]);

  useEffect(() => {
    const onFocus = () => void loadCompletionScore();
    window.addEventListener("focus", onFocus);
    return () => window.removeEventListener("focus", onFocus);
  }, [loadCompletionScore]);

  const hydrate = useCallback(() => {
    const { first, last } = splitNameFromProfile(profile);
    setFirstName(first);
    setLastName(last);
    setStateVal(profile.state?.trim() ? profile.state : null);
    setCityVal(profile.city?.trim() ? profile.city : null);
    setPhoneDigits((profile.phone ?? "").replace(/\D/g, "").slice(0, 10));
    setGenderVal(profile.gender?.trim() ? profile.gender : null);
    setCategoryVal(profile.category?.trim() ? profile.category : null);
    setDobVal(profile.date_of_birth ? profile.date_of_birth.slice(0, 10) : "");
    setBioVal(profile.bio?.slice(0, 100) ?? "");
    setInstitutionName(profile.institution_name?.trim() ?? "");
    setBoardVal(profile.board?.trim() ? profile.board : null);
    setClassYearVal(profile.current_class_label?.trim() ? profile.current_class_label : null);
    const s = profile.stream?.trim() ?? "";
    if ((STREAM_OPTIONS as readonly string[]).includes(s)) {
      setStreamVal(s);
    } else {
      const combo = profile.subject_combo?.trim();
      if (combo === "PCMB") setStreamVal("PCMB");
      else if (combo === "PCB") setStreamVal("PCB");
      else if (combo === "Commerce") setStreamVal("Commerce");
      else if (combo === "Arts") setStreamVal("Arts / Humanities");
      else setStreamVal("PCM (Physics, Chemistry, Maths)");
    }
  }, [profile]);

  useEffect(() => {
    hydrate();
  }, [hydrate]);

  const cityItems = useMemo(() => {
    const cities = getCitiesForState(stateVal ?? "");
    return cities.map((c) => ({ label: c, value: c }));
  }, [stateVal]);

  const displayName = [firstName, lastName].filter(Boolean).join(" ").trim() || profile.name;
  const initials =
    (firstName[0] ?? profile.name[0] ?? "?").toUpperCase() +
    (lastName[0] ?? profile.name.split(/\s+/)[1]?.[0] ?? "").toUpperCase();

  const rdm = profile.rdm ?? 0;

  const savePersonal = async () => {
    const fn = firstName.trim();
    const ln = lastName.trim();
    if (!fn || !ln) {
      toast({ title: "First and last name required", variant: "destructive" });
      return;
    }
    if (!stateVal) {
      toast({ title: "State required", variant: "destructive" });
      return;
    }
    if (!cityVal) {
      toast({ title: "City / town required", variant: "destructive" });
      return;
    }
    const phone = phoneDigits.replace(/\D/g, "");
    if (phone.length !== 10) {
      toast({ title: "Enter a valid 10-digit mobile number", variant: "destructive" });
      return;
    }
    if (!genderVal) {
      toast({ title: "Gender required", variant: "destructive" });
      return;
    }
    if (!categoryVal) {
      toast({ title: "Category required", variant: "destructive" });
      return;
    }
    const bio = bioVal.slice(0, 100);
    const fullName = `${fn} ${ln}`.trim();

    setSavingPersonal(true);
    try {
      const { error } = await supabase
        .from("profiles")
        .update({
          first_name: fn,
          last_name: ln,
          name: fullName,
          state: stateVal,
          city: cityVal,
          phone,
          gender: genderVal,
          category: categoryVal,
          date_of_birth: dobVal.trim() ? dobVal : null,
          bio: bio || null,
        })
        .eq("id", profile.id);
      if (error) throw error;
      await onProfileUpdated();
      void loadCompletionScore();
      const savedProfile = {
        ...profile,
        first_name: fn,
        last_name: ln,
        state: stateVal,
        city: cityVal,
        phone,
        gender: genderVal,
        category: categoryVal,
      };
      if (isStudentProfileBasicInfoComplete(savedProfile, authUser.email)) {
        markProfileCompanionBasicSaved();
      }
      maybeMarkProfileOnboardingFromBasicInfo(
        isStudentProfileBasicInfoComplete(savedProfile, authUser.email),
        savedProfile,
        authUser.email
      );
      toast({ title: "Personal info saved" });
      setEditingPersonal(false);
    } catch (e: unknown) {
      toast({
        title: "Could not save",
        description: e instanceof Error ? e.message : "Unknown error",
        variant: "destructive",
      });
    } finally {
      setSavingPersonal(false);
    }
  };

  const saveInstitution = async () => {
    const school = institutionName.trim();
    if (!school) {
      toast({ title: "School / college name required", variant: "destructive" });
      return;
    }
    if (!boardVal) {
      toast({ title: "Board / university required", variant: "destructive" });
      return;
    }
    if (!classYearVal) {
      toast({ title: "Current class / year required", variant: "destructive" });
      return;
    }
    if (!streamVal) {
      toast({ title: "Stream required", variant: "destructive" });
      return;
    }

    const { stream, subject_combo } = streamSelectionToProfileFields(streamVal);
    const mappedLevel = classLabelToLevel(classYearVal);
    const class_level = mappedLevel ?? profile.class_level;

    setSavingInstitution(true);
    try {
      const { error } = await supabase
        .from("profiles")
        .update({
          institution_name: school,
          board: boardVal,
          current_class_label: classYearVal,
          stream,
          subject_combo,
          class_level,
        })
        .eq("id", profile.id);
      if (error) throw error;
      await onProfileUpdated();
      void loadCompletionScore();
      toast({ title: "Institution saved" });
      setEditingInstitution(false);
    } catch (e: unknown) {
      toast({
        title: "Could not save",
        description: e instanceof Error ? e.message : "Unknown error",
        variant: "destructive",
      });
    } finally {
      setSavingInstitution(false);
    }
  };

  const profileFormDraft = useMemo(
    () => ({
      firstName,
      lastName,
      stateVal,
      cityVal,
      phoneDigits,
      genderVal,
      categoryVal,
      accountEmail: email,
    }),
    [firstName, lastName, stateVal, cityVal, phoneDigits, genderVal, categoryVal, email]
  );

  return (
    <>
      <ProfileOnboardingTracker
        section={section}
        profile={profile}
        accountEmail={authUser.email}
        formDraft={profileFormDraft}
      />
      <StudentProfileShell
        displayName={displayName}
        roleLabel="Student"
        initials={initials}
        activeSection={section}
        onSectionChange={setSection}
        rdmDisplay={rdm}
      >
        {section === "academic" ? (
          <StudentProfileAcademicPanel profile={profile} onProfileUpdated={onProfileUpdated} />
        ) : section === "achievements" ? (
          <StudentProfileAchievementsPanel userId={profile.id} />
        ) : section === "activity" ? (
          <StudentProfileActivityPanel profile={profile} />
        ) : section === "edufund" ? (
          <StudentProfileEduFundPanel profile={profile} />
        ) : section === "sub-overview" ||
          section === "sub-plans" ||
          section === "sub-payment" ||
          section === "sub-checkout" ||
          section === "sub-history" ||
          section === "sub-cancel" ? (
          <StudentSubscriptionHub
            profile={profile}
            activeView={
              section.replace("sub-", "") as
                | "overview"
                | "plans"
                | "payment"
                | "checkout"
                | "history"
                | "cancel"
            }
            onSectionChange={setSection}
          />
        ) : section === "settings" ? (
          <StudentSettingsHub />
        ) : section === "personal" ? (
          <div className="w-full min-w-0 space-y-4 sm:space-y-5 lg:space-y-6">
            <div className="rounded-xl border border-border bg-card p-3 dark:border-white/10 dark:bg-[#0c1017] sm:rounded-2xl sm:p-4 md:p-5">
              <p className="mb-0.5 text-[10px] font-bold uppercase tracking-wide text-muted-foreground dark:text-slate-500">
                Profile completion score
              </p>
              <div className="mb-1.5 flex flex-wrap items-end justify-between gap-2 sm:mb-2">
                <p className="text-xl font-black tabular-nums text-emerald-400 sm:text-2xl">
                  {completionStatus === "ready" && completionPct !== null
                    ? `${completionPct}%`
                    : completionStatus === "error"
                      ? "—"
                      : "…"}
                </p>
              </div>
              <Progress
                value={completionStatus === "ready" && completionPct !== null ? completionPct : 0}
                className="h-2 rounded-full bg-muted sm:h-2.5 dark:bg-slate-800 [&>div]:bg-emerald-500"
              />
              {completionStatus === "ready" && completionSections ? (
                <div className="mt-2 grid grid-cols-2 gap-1 text-[10px] font-semibold text-muted-foreground dark:text-slate-400 sm:grid-cols-4">
                  <span>Personal {Math.round(completionSections.personal)}%</span>
                  <span>Academic {Math.round(completionSections.academic)}%</span>
                  <span>Achievements {Math.round(completionSections.achievements)}%</span>
                  <span>Activity {Math.round(completionSections.activity)}%</span>
                </div>
              ) : null}
              <p className="mt-1.5 text-xs text-muted-foreground sm:mt-2 sm:text-sm dark:text-slate-400">
                {completionStatus === "error"
                  ? "Could not load completion status — refresh or try again later."
                  : completionStatus === "loading" || completionStatus === "idle"
                    ? "Checking your profile sections…"
                    : "This combines required fields across personal info, academic record, achievements, and activity track record. Fill every section properly to reach 100%."}
              </p>
            </div>

            <StudentProfilePhotoUpload
              profileId={profile.id}
              avatarUrl={profile.avatar_url}
              initials={initials}
              onUpdated={onProfileUpdated}
            />

            <section className="w-full min-w-0 rounded-xl border border-border bg-card p-3 dark:border-white/10 dark:bg-[#0c1017] sm:rounded-2xl sm:p-4 md:p-5 lg:p-6">
              <div className="flex items-start justify-between gap-2">
                <div>
                  <h2 className="text-base font-black text-foreground sm:text-lg dark:text-white">
                    Basic information
                  </h2>
                  <p className="mt-0.5 text-[11px] text-muted-foreground sm:text-xs dark:text-slate-500">
                    Legal name fields should match your government ID.
                  </p>
                </div>
                {!editingPersonal ? (
                  <Button
                    type="button"
                    variant="outline"
                    onClick={() => {
                      markProfileCompanionFormStarted();
                      setEditingPersonal(true);
                    }}
                    className="rounded-lg px-3 py-2 text-xs font-bold sm:px-4 sm:py-2 sm:text-sm"
                  >
                    Edit
                  </Button>
                ) : null}
              </div>
              <div className="mt-3 grid grid-cols-1 gap-3 min-[600px]:grid-cols-2 sm:mt-4 sm:gap-4 lg:gap-x-6 2xl:gap-x-8">
                <div className="min-w-0">
                  <label className="mb-1 block text-[11px] font-semibold text-foreground sm:mb-1.5 sm:text-xs dark:text-slate-200">
                    <Req>First name</Req>
                  </label>
                  <p className="mb-1 text-[10px] text-muted-foreground dark:text-slate-500">
                    As per government ID
                  </p>
                  <Input
                    value={firstName}
                    onChange={(e) => setFirstName(e.target.value)}
                    className={cn(fieldFocus)}
                    autoComplete="given-name"
                    disabled={!editingPersonal}
                  />
                </div>
                <div className="min-w-0">
                  <label className="mb-1 block text-[11px] font-semibold text-foreground sm:mb-1.5 sm:text-xs dark:text-slate-200">
                    <Req>Last name</Req>
                  </label>
                  <p className="mb-1 text-[10px] text-muted-foreground dark:text-slate-500">
                    As per government ID
                  </p>
                  <Input
                    value={lastName}
                    onChange={(e) => setLastName(e.target.value)}
                    className={cn(fieldFocus)}
                    autoComplete="family-name"
                    disabled={!editingPersonal}
                  />
                </div>
                <div className="min-w-0">
                  <label className="mb-1 block text-[11px] font-semibold text-foreground sm:mb-1.5 sm:text-xs dark:text-slate-200">
                    <Req>State</Req>
                  </label>
                  <Select
                    items={stateItems}
                    value={stateVal}
                    onValueChange={(v) => {
                      setStateVal(v);
                      setCityVal(null);
                    }}
                    disabled={!editingPersonal}
                  >
                    <SelectTrigger className={cn("h-10 w-full min-w-0", fieldFocus)}>
                      <SelectValue placeholder="Select state" />
                    </SelectTrigger>
                    <SelectContent className="max-h-64">
                      <SelectGroup>
                        {stateItems.map((item) => (
                          <SelectItem key={item.value} value={item.value}>
                            {item.label}
                          </SelectItem>
                        ))}
                      </SelectGroup>
                    </SelectContent>
                  </Select>
                </div>
                <div className="min-w-0">
                  <label className="mb-1 block text-[11px] font-semibold text-foreground sm:mb-1.5 sm:text-xs dark:text-slate-200">
                    <Req>City / town</Req>
                  </label>
                  <Select
                    items={cityItems}
                    value={cityVal}
                    onValueChange={setCityVal}
                    disabled={!editingPersonal || !stateVal}
                  >
                    <SelectTrigger className={cn("h-10 w-full min-w-0", fieldFocus)}>
                      <SelectValue placeholder="Select city / town" />
                    </SelectTrigger>
                    <SelectContent className="max-h-64">
                      <SelectGroup>
                        {cityItems.map((item) => (
                          <SelectItem key={item.value} value={item.value}>
                            {item.label}
                          </SelectItem>
                        ))}
                      </SelectGroup>
                    </SelectContent>
                  </Select>
                </div>
                <div className="min-w-0">
                  <label className="mb-1 block text-[11px] font-semibold text-foreground sm:mb-1.5 sm:text-xs dark:text-slate-200">
                    <Req>Email address</Req>
                  </label>
                  <Input value={email} disabled className="opacity-80" />
                </div>
                <div className="min-w-0">
                  <label className="mb-1 block text-[11px] font-semibold text-foreground sm:mb-1.5 sm:text-xs dark:text-slate-200">
                    <Req>Mobile number</Req>
                  </label>
                  <div className="flex h-10 overflow-hidden rounded-md border border-input bg-background shadow-xs focus-within:ring-2 focus-within:ring-emerald-500/30">
                    <span className="inline-flex h-full shrink-0 items-center border-r border-input bg-muted px-2 text-xs font-semibold sm:px-3 sm:text-sm dark:bg-slate-800">
                      +91
                    </span>
                    <Input
                      value={phoneDigits}
                      onChange={(e) =>
                        setPhoneDigits(e.target.value.replace(/\D/g, "").slice(0, 10))
                      }
                      className={cn(
                        "h-full border-0 bg-transparent shadow-none ring-0 focus-visible:ring-0 focus-visible:border-0"
                      )}
                      inputMode="numeric"
                      autoComplete="tel-national"
                      placeholder="10-digit number"
                      disabled={!editingPersonal}
                    />
                  </div>
                </div>
                <div className="min-w-0">
                  <label className="mb-1 block text-[11px] font-semibold text-foreground sm:mb-1.5 sm:text-xs dark:text-slate-200">
                    Date of birth
                  </label>
                  <Input
                    type="date"
                    value={dobVal}
                    onChange={(e) => setDobVal(e.target.value)}
                    className={cn(fieldFocus)}
                    disabled={!editingPersonal}
                  />
                </div>
                <div className="min-w-0">
                  <label className="mb-1 block text-[11px] font-semibold text-foreground sm:mb-1.5 sm:text-xs dark:text-slate-200">
                    <Req>Gender</Req>
                  </label>
                  <Select
                    items={toSelectItems(GENDER_OPTIONS)}
                    value={genderVal}
                    onValueChange={setGenderVal}
                    disabled={!editingPersonal}
                  >
                    <SelectTrigger className={cn("h-10 w-full min-w-0", fieldFocus)}>
                      <SelectValue placeholder="Select" />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectGroup>
                        {GENDER_OPTIONS.map((g) => (
                          <SelectItem key={g} value={g}>
                            {g}
                          </SelectItem>
                        ))}
                      </SelectGroup>
                    </SelectContent>
                  </Select>
                </div>
                <div className="min-w-0">
                  <label className="mb-1 block text-[11px] font-semibold text-foreground sm:mb-1.5 sm:text-xs dark:text-slate-200">
                    <Req>Category</Req>
                  </label>
                  <Select
                    items={toSelectItems(CATEGORY_OPTIONS)}
                    value={categoryVal}
                    onValueChange={setCategoryVal}
                    disabled={!editingPersonal}
                  >
                    <SelectTrigger className={cn("h-10 w-full min-w-0", fieldFocus)}>
                      <SelectValue placeholder="Select" />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectGroup>
                        {CATEGORY_OPTIONS.map((c) => (
                          <SelectItem key={c} value={c}>
                            {c}
                          </SelectItem>
                        ))}
                      </SelectGroup>
                    </SelectContent>
                  </Select>
                </div>
                <div className="min-w-0 min-[600px]:col-span-2">
                  <label className="mb-1 block text-[11px] font-semibold text-foreground sm:mb-1.5 sm:text-xs dark:text-slate-200">
                    Short bio
                  </label>
                  <Textarea
                    value={bioVal}
                    onChange={(e) => setBioVal(e.target.value.slice(0, 100))}
                    maxLength={100}
                    rows={3}
                    placeholder="Up to 100 characters"
                    className={cn("min-h-20", fieldFocus)}
                    disabled={!editingPersonal}
                  />
                  <p className="mt-1 text-right text-[10px] text-muted-foreground">
                    {bioVal.length}/100
                  </p>
                </div>
              </div>
              {editingPersonal ? (
                <div className="mt-4 flex flex-wrap gap-2 sm:mt-6">
                  <Button
                    type="button"
                    variant="outline"
                    onClick={() => {
                      hydrate();
                      setEditingPersonal(false);
                    }}
                    className="rounded-lg px-3 py-2 text-xs font-bold sm:px-4 sm:py-2 sm:text-sm"
                  >
                    Cancel
                  </Button>
                  <Button
                    type="button"
                    onClick={() => void savePersonal()}
                    disabled={savingPersonal}
                    className="rounded-lg bg-emerald-600 px-3 py-2 text-xs font-bold text-white hover:bg-emerald-500 sm:px-4 sm:py-2 sm:text-sm"
                  >
                    {savingPersonal ? "Saving…" : "Save personal info"}
                  </Button>
                </div>
              ) : null}
            </section>

            <section className="w-full min-w-0 rounded-xl border border-border bg-card p-3 dark:border-white/10 dark:bg-[#0c1017] sm:rounded-2xl sm:p-4 md:p-5 lg:p-6">
              <div className="flex items-start justify-between gap-2">
                <h2 className="flex items-center gap-1.5 text-base font-black text-foreground sm:gap-2 sm:text-lg dark:text-white">
                  <Building2 className="h-4 w-4 shrink-0 text-emerald-400 sm:h-5 sm:w-5" />
                  Current institution
                </h2>
                {!editingInstitution ? (
                  <Button
                    type="button"
                    variant="outline"
                    onClick={() => setEditingInstitution(true)}
                    className="rounded-lg px-3 py-2 text-xs font-bold sm:px-4 sm:py-2 sm:text-sm"
                  >
                    Edit
                  </Button>
                ) : null}
              </div>
              <div className="mt-3 grid grid-cols-1 gap-3 min-[600px]:grid-cols-2 sm:mt-4 sm:gap-4 lg:gap-x-6 2xl:gap-x-8">
                <div className="min-w-0 min-[600px]:col-span-2">
                  <label className="mb-1 block text-[11px] font-semibold text-foreground sm:mb-1.5 sm:text-xs dark:text-slate-200">
                    <Req>School / college name</Req>
                  </label>
                  <Input
                    value={institutionName}
                    onChange={(e) => setInstitutionName(e.target.value)}
                    className={cn(fieldFocus)}
                    disabled={!editingInstitution}
                  />
                </div>
                <div className="min-w-0">
                  <label className="mb-1 block text-[11px] font-semibold text-foreground sm:mb-1.5 sm:text-xs dark:text-slate-200">
                    <Req>Board / university</Req>
                  </label>
                  <Select
                    items={toSelectItems(BOARD_OPTIONS)}
                    value={boardVal}
                    onValueChange={setBoardVal}
                    disabled={!editingInstitution}
                  >
                    <SelectTrigger className={cn("h-10 w-full min-w-0", fieldFocus)}>
                      <SelectValue placeholder="Select" />
                    </SelectTrigger>
                    <SelectContent className="max-h-64">
                      <SelectGroup>
                        {BOARD_OPTIONS.map((b) => (
                          <SelectItem key={b} value={b}>
                            {b}
                          </SelectItem>
                        ))}
                      </SelectGroup>
                    </SelectContent>
                  </Select>
                </div>
                <div className="min-w-0">
                  <label className="mb-1 block text-[11px] font-semibold text-foreground sm:mb-1.5 sm:text-xs dark:text-slate-200">
                    <Req>Current class / year</Req>
                  </label>
                  <Select
                    items={toSelectItems(CLASS_YEAR_OPTIONS)}
                    value={classYearVal}
                    onValueChange={setClassYearVal}
                    disabled={!editingInstitution}
                  >
                    <SelectTrigger className={cn("h-10 w-full min-w-0", fieldFocus)}>
                      <SelectValue placeholder="Select" />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectGroup>
                        {CLASS_YEAR_OPTIONS.map((c) => (
                          <SelectItem key={c} value={c}>
                            {c}
                          </SelectItem>
                        ))}
                      </SelectGroup>
                    </SelectContent>
                  </Select>
                </div>
                <div className="min-w-0">
                  <label className="mb-1 block text-[11px] font-semibold text-foreground sm:mb-1.5 sm:text-xs dark:text-slate-200">
                    <Req>Stream</Req>
                  </label>
                  <Select
                    items={toSelectItems(STREAM_OPTIONS)}
                    value={streamVal}
                    onValueChange={setStreamVal}
                    disabled={!editingInstitution}
                  >
                    <SelectTrigger className={cn("h-10 w-full min-w-0", fieldFocus)}>
                      <SelectValue placeholder="Select" />
                    </SelectTrigger>
                    <SelectContent className="max-h-64">
                      <SelectGroup>
                        {STREAM_OPTIONS.map((s) => (
                          <SelectItem key={s} value={s}>
                            {s}
                          </SelectItem>
                        ))}
                      </SelectGroup>
                    </SelectContent>
                  </Select>
                </div>
              </div>
              {editingInstitution ? (
                <div className="mt-4 flex flex-wrap gap-2 sm:mt-6">
                  <Button
                    type="button"
                    variant="outline"
                    onClick={() => {
                      hydrate();
                      setEditingInstitution(false);
                    }}
                    className="rounded-lg px-3 py-2 text-xs font-bold sm:px-4 sm:py-2 sm:text-sm"
                  >
                    Cancel
                  </Button>
                  <Button
                    type="button"
                    onClick={() => void saveInstitution()}
                    disabled={savingInstitution}
                    className="rounded-lg bg-emerald-600 px-3 py-2 text-xs font-bold text-white hover:bg-emerald-500 sm:px-4 sm:py-2 sm:text-sm"
                  >
                    {savingInstitution ? "Saving…" : "Save institution"}
                  </Button>
                </div>
              ) : null}
            </section>
          </div>
        ) : null}
      </StudentProfileShell>
    </>
  );
}
