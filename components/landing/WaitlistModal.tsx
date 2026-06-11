"use client";

import React, { useState, useEffect } from "react";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import {
  Rocket,
  Star,
  Bolt,
  School,
  Presentation,
  Heart,
  User,
  Info,
  Lock,
  Check,
  ChevronDown,
} from "lucide-react";
import { isValidEmail } from "@/lib/waitlist/email";
import { normalizeIndianMobile, sanitizeMobileInput } from "@/lib/waitlist/phone";
import { cn } from "@/lib/utils";

interface WaitlistModalProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
}

const INTERESTS_DATA: Record<string, string[]> = {
  student: [
    "Social learning feed (Magic Wall)",
    "Daily quiz and rewards (DailyDose + RDM)",
    "Mock tests and exam prep (Testbee)",
    "Doubt wall (Gyan++)",
    "EduFund financial grants",
    "Learning buddy and peer study",
  ],
  teacher: [
    "Exam creation and question tools",
    "Student analytics dashboard",
    "Gyan++ teaching wall",
    "Live and recorded classes",
    "AI Calendar and study planner",
    "EduFund programme for students",
  ],
  parent: [
    "Progress visibility dashboard",
    "Streak and activity monitoring",
    "EduFund grant eligibility",
    "Platform content safety",
    "Subscription value and plans",
    "Community and peer interactions",
  ],
  other: [
    "Platform concept and vision",
    "EduFund CSR / donation",
    "Partnership or integration",
    "Investment opportunity",
    "Content or media interest",
    "Research and education policy",
  ],
};

export default function WaitlistModal({ open, onOpenChange }: WaitlistModalProps) {
  const [role, setRole] = useState<string | null>(null);
  const [firstName, setFirstName] = useState("");
  const [lastName, setLastName] = useState("");
  const [email, setEmail] = useState("");
  const [phone, setPhone] = useState("");
  const [city, setCity] = useState("");
  const [state, setState] = useState("");
  const [emailTouched, setEmailTouched] = useState(false);
  const [phoneTouched, setPhoneTouched] = useState(false);

  // Role specific fields
  const [studentClass, setStudentClass] = useState("");
  const [school, setSchool] = useState("");
  const [exam, setExam] = useState("");
  const [coaching, setCoaching] = useState("");
  const [hours, setHours] = useState("");
  const [marks, setMarks] = useState("");

  const [subject, setSubject] = useState("");
  const [exp, setExp] = useState("");
  const [stucount, setStucount] = useState("");
  const [linkedin, setLinkedin] = useState("");

  const [childClass, setChildClass] = useState("");
  const [childExam, setChildExam] = useState("");

  const [org, setOrg] = useState("");
  const [orgRole, setOrgRole] = useState("");
  const [website, setWebsite] = useState("");

  // Common
  const [selectedInterests, setSelectedInterests] = useState<string[]>([]);
  const [whyJoin, setWhyJoin] = useState("");
  const [referral, setReferral] = useState("");
  const [refcode, setRefcode] = useState("");

  // Consents
  const [c1, setC1] = useState(false);
  const [c2, setC2] = useState(false);
  const [c3, setC3] = useState(false);

  const [submitted, setSubmitted] = useState(false);
  const [waitlistId, setWaitlistId] = useState("");
  const [progress, setProgress] = useState(4);

  // Clear states when dialog opens/closes
  useEffect(() => {
    if (open) {
      setRole(null);
      setFirstName("");
      setLastName("");
      setEmail("");
      setPhone("");
      setCity("");
      setState("");
      setStudentClass("");
      setSchool("");
      setExam("");
      setCoaching("");
      setHours("");
      setMarks("");
      setSubject("");
      setExp("");
      setStucount("");
      setLinkedin("");
      setChildClass("");
      setChildExam("");
      setOrg("");
      setOrgRole("");
      setWebsite("");
      setSelectedInterests([]);
      setWhyJoin("");
      setReferral("");
      setRefcode("");
      setC1(false);
      setC2(false);
      setC3(false);
      setEmailTouched(false);
      setPhoneTouched(false);
      setSubmitted(false);
      setWaitlistId("");
      setProgress(4);
    }
  }, [open]);

  // Calculate Progress
  useEffect(() => {
    if (!role) {
      setProgress(4);
      return;
    }
    let sc = 10;
    if (firstName.trim()) sc += 8;
    if (lastName.trim()) sc += 5;
    if (email.trim()) sc += 8;
    if (phone.trim()) sc += 8;
    if (city.trim()) sc += 5;
    if (state.trim()) sc += 5;
    if (selectedInterests.length > 0) sc += 7;
    if (whyJoin.trim()) sc += 10;
    if (referral) sc += 5;
    if (c1) sc += 10;
    if (c2) sc += 10;

    setProgress(Math.min(100, sc));
  }, [
    role,
    firstName,
    lastName,
    email,
    phone,
    city,
    state,
    selectedInterests,
    whyJoin,
    referral,
    c1,
    c2,
  ]);

  const handleInterestToggle = (item: string) => {
    if (selectedInterests.includes(item)) {
      setSelectedInterests(selectedInterests.filter((i) => i !== item));
    } else {
      setSelectedInterests([...selectedInterests, item]);
    }
  };

  const isEmailValid = isValidEmail(email);
  const phoneNormalized = normalizeIndianMobile(phone);
  const showPhoneError = phoneTouched && phone && !phoneNormalized.ok;
  const isFormValid =
    role &&
    firstName.trim() &&
    email.trim() &&
    isEmailValid &&
    phone.trim() &&
    phoneNormalized.ok &&
    c1 &&
    c2;

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!isFormValid) return;

    const generatedId = `EB-2026-${Math.floor(1000 + Math.random() * 9000)}`;
    setWaitlistId(generatedId);
    setSubmitted(true);
    setProgress(100);
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-h-[90vh] overflow-y-auto w-full max-w-2xl bg-[#0E1117] text-[#E8EAF0] border border-[#2A3347] rounded-2xl p-0 scrollbar-thin scrollbar-thumb-zinc-800 scrollbar-track-transparent">
        <DialogHeader className="sr-only">
          <DialogTitle>Join Waitlist</DialogTitle>
        </DialogHeader>

        {!submitted ? (
          <div className="flex flex-col">
            {/* Top Banner */}
            <div className="bg-[#1D9E75] p-3 text-center relative overflow-hidden flex items-center justify-center gap-3">
              <Rocket className="h-6 w-6 text-white/40 shrink-0" />
              <div className="text-left">
                <div className="text-sm font-semibold text-white leading-tight">
                  Act NOW! Join the waitlist &amp; qualify as a paid Ambassador
                </div>
                <div className="text-[11px] text-white/80 leading-normal">
                  Limited seats · early access · real rewards · India-wide launch coming soon
                </div>
              </div>
              <Star className="h-6 w-6 text-white/40 shrink-0 hidden sm:block" />
            </div>

            <div className="px-5 py-6 sm:px-6 space-y-6">
              {/* Hero */}
              <div className="text-center space-y-2">
                <div className="w-12 h-12 rounded-full bg-[#0A2A20] border border-[#1D9E75] flex items-center justify-center mx-auto">
                  <Bolt className="h-6 w-6 text-[#1D9E75]" />
                </div>
                <div className="inline-flex items-center gap-2 bg-[#281C08] border border-[#EF9F27]/30 rounded-full px-3 py-1 text-xs font-semibold text-[#FAC775]">
                  <span className="h-2 w-2 rounded-full bg-[#EF9F27] animate-pulse" />
                  Launching across India — sign up now
                </div>
                <h2 className="text-xl sm:text-2xl font-bold tracking-tight text-white leading-tight">
                  The social platform that makes
                  <br />
                  PCM students love studying
                </h2>
                <p className="text-xs text-[#9BA3B8] max-w-lg mx-auto leading-relaxed">
                  EduBlast is the education social media for PUC 1 and 2 students — learn by
                  scrolling, earn rewards, get real exam prep, and qualify for EduFund grants.
                </p>
              </div>

              {/* Ambassador Pathway */}
              <div className="space-y-3">
                <p className="text-[10px] font-bold text-[#1D9E75] uppercase tracking-wider text-center">
                  Ambassador Pathway
                </p>
                <div className="grid grid-cols-2 md:grid-cols-4 gap-0 border border-[#2A3347] bg-[#161B25] rounded-xl overflow-hidden">
                  {[
                    {
                      num: "01",
                      title: "Join waitlist",
                      desc: "Fill the full form — all fields required",
                      icon: <Bolt className="h-4 w-4 text-[#1D9E75]" />,
                      bg: "bg-[#0A2A20]",
                    },
                    {
                      num: "02",
                      title: "Verification",
                      desc: "5-minute mobile confirmation call",
                      icon: <Star className="h-4 w-4 text-[#EF9F27]" />,
                      bg: "bg-[#281C08]",
                    },
                    {
                      num: "03",
                      title: "Early preview",
                      desc: "Ambassadors test platform early",
                      icon: <Rocket className="h-4 w-4 text-[#7F77DD]" />,
                      bg: "bg-[#171425]",
                    },
                    {
                      num: "04",
                      title: "Paid role",
                      desc: "3 months active + interview",
                      icon: <Check className="h-4 w-4 text-[#639922]" />,
                      bg: "bg-[#131D08]",
                    },
                  ].map((x, idx) => {
                    let borderClass = "";
                    if (idx === 0) {
                      borderClass = "border-b md:border-b-0 border-r border-[#2A3347]/50";
                    } else if (idx === 1) {
                      borderClass = "border-b md:border-b-0 border-[#2A3347]/50 md:border-r";
                    } else if (idx === 2) {
                      borderClass = "border-r border-[#2A3347]/50";
                    }
                    return (
                      <div key={x.num} className={`p-3 text-center relative space-y-1 bg-[#161B25] ${borderClass}`}>
                        <span className="absolute top-2 right-2 text-[9px] text-[#5C6480] font-semibold">
                          {x.num}
                        </span>
                        <div className={`w-8 h-8 rounded-full ${x.bg} flex items-center justify-center mx-auto mb-1`}>
                          {x.icon}
                        </div>
                        <p className="text-[11px] font-bold text-white leading-tight">{x.title}</p>
                        <p className="text-[9px] text-[#5C6480] leading-snug">{x.desc}</p>
                      </div>
                    );
                  })}
                </div>
              </div>

              {/* Stats Card */}
              <div className="grid grid-cols-3 gap-2">
                {[
                  { num: "253", lbl: "on the waitlist", color: "text-[#1D9E75]" },
                  { num: "18", lbl: "ambassadors shortlisted", color: "text-[#EF9F27]" },
                  { num: "India-wide", lbl: "Phase 1 launch", color: "text-[#7F77DD]" },
                ].map((s) => (
                  <div key={s.lbl} className="bg-[#161B25] border border-[#2A3347] rounded-xl p-2.5 text-center">
                    <p className={`text-lg font-bold leading-none ${s.color}`}>{s.num}</p>
                    <p className="mt-1 text-[9px] text-[#5C6480] font-medium leading-none">{s.lbl}</p>
                  </div>
                ))}
              </div>

              {/* Form Section */}
              <form onSubmit={handleSubmit} className="space-y-5">
                {/* Progress bar */}
                <div className="space-y-1.5">
                  <div className="h-1 bg-[#2A3347] rounded-full overflow-hidden">
                    <div
                      className="h-full bg-[#1D9E75] transition-all duration-300"
                      style={{ width: `${progress}%` }}
                    />
                  </div>
                </div>

                {/* Role selection */}
                <div className="space-y-2">
                  <p className="text-xs font-semibold text-[#9BA3B8]">
                    I am a <span className="text-[#1D9E75]">*</span>
                  </p>
                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
                    {[
                      {
                        id: "student",
                        name: "Student",
                        desc: "PUC 1 or PUC 2 — learning & prep",
                        icon: <School className="h-5 w-5" />,
                        badge: "Student Ambassador option",
                      },
                      {
                        id: "teacher",
                        name: "Teacher / Tutor",
                        desc: "Teaching PUC PCM subjects",
                        icon: <Presentation className="h-5 w-5" />,
                        badge: "Teacher Ambassador option",
                      },
                      {
                        id: "parent",
                        name: "Parent / Guardian",
                        desc: "Supporting a PUC student",
                        icon: <Heart className="h-5 w-5" />,
                      },
                      {
                        id: "other",
                        name: "Other",
                        desc: "Donor, investor, institution, media",
                        icon: <User className="h-5 w-5" />,
                      },
                    ].map((item) => {
                      const sel = role === item.id;
                      return (
                        <div
                          key={item.id}
                          onClick={() => setRole(item.id)}
                          className={`border rounded-xl p-3 cursor-pointer flex flex-col justify-between gap-3 transition-colors ${
                            sel
                              ? "border-[#1D9E75] bg-[#0A2A20]"
                              : "border-[#2A3347] bg-[#1C2333] hover:bg-[#222A3A] hover:border-[#334060]"
                          }`}
                        >
                          <div className="flex items-center gap-3">
                            <div className={`w-9 h-9 rounded-full flex items-center justify-center shrink-0 ${sel ? "bg-[#0A2A20] text-[#1D9E75]" : "bg-[#222A3A] text-[#5C6480]"}`}>
                              {item.icon}
                            </div>
                            <div className="min-w-0">
                              <p className="text-xs font-semibold text-white leading-tight">{item.name}</p>
                              <p className="text-[10px] text-[#5C6480] leading-tight mt-0.5">{item.desc}</p>
                            </div>
                          </div>
                          {item.badge && (
                            <div>
                              <span className="inline-flex items-center gap-1 bg-[#171425] border border-[#7F77DD]/35 rounded-full px-2 py-0.5 text-[8.5px] font-semibold text-[#AFA9EC]">
                                <Star className="h-2.5 w-2.5 shrink-0" />
                                {item.badge}
                              </span>
                            </div>
                          )}
                        </div>
                      );
                    })}
                  </div>
                </div>

                {role && (
                  <div className="space-y-5 animate-in fade-in duration-200">
                    {/* PERSONAL DETAILS */}
                    <div className="bg-[#161B25] border border-[#2A3347] rounded-xl p-4 space-y-4">
                      <p className="text-[10px] font-bold text-[#1D9E75] uppercase tracking-wider flex items-center gap-2">
                        <User className="h-4 w-4 shrink-0" />
                        Personal details
                      </p>

                      <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                        <div className="space-y-1">
                          <label className="text-[11px] text-[#9BA3B8]">
                            First name<span className="text-[#1D9E75]">*</span>
                          </label>
                          <input
                            type="text"
                            placeholder="Arjun"
                            value={firstName}
                            onChange={(e) => setFirstName(e.target.value)}
                            className="w-full bg-[#1C2333] border border-[#2A3347] focus:border-[#1D9E75] rounded-lg px-3 py-1.5 text-xs text-white outline-none"
                            required
                          />
                        </div>
                        <div className="space-y-1">
                          <label className="text-[11px] text-[#9BA3B8]">
                            Last name<span className="text-[#1D9E75]">*</span>
                          </label>
                          <input
                            type="text"
                            placeholder="Sharma"
                            value={lastName}
                            onChange={(e) => setLastName(e.target.value)}
                            className="w-full bg-[#1C2333] border border-[#2A3347] focus:border-[#1D9E75] rounded-lg px-3 py-1.5 text-xs text-white outline-none"
                            required
                          />
                        </div>
                      </div>

                      {/* Contact Verification Callout */}
                      <div className="bg-[#281C08] border border-[#4a3010] rounded-lg p-2.5 flex items-start gap-2.5 text-[11px] text-[#FAC775] leading-relaxed">
                        <Info className="h-3.5 w-3.5 text-[#EF9F27] shrink-0 mt-0.5" />
                        <p>
                          Please provide accurate email and mobile information so we can reach you
                          for verification during ambassador selection. Incomplete details will
                          disqualify your application.
                        </p>
                      </div>

                      <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                        <div className="space-y-1">
                          <label className="text-[11px] text-[#9BA3B8]">
                            Email address<span className="text-[#1D9E75]">*</span>
                          </label>
                          <input
                            type="email"
                            placeholder="arjun@gmail.com"
                            value={email}
                            onChange={(e) => setEmail(e.target.value)}
                            onBlur={() => setEmailTouched(true)}
                            className={cn(
                              "w-full bg-[#1C2333] border rounded-lg px-3 py-1.5 text-xs text-white outline-none transition",
                              emailTouched && email && !isEmailValid
                                ? "border-rose-500/80 focus:border-rose-500 focus:shadow-[0_0_0_2px_rgba(244,63,94,0.15)]"
                                : "border-[#2A3347] focus:border-[#1D9E75]"
                            )}
                            required
                          />
                          {emailTouched && email && !isEmailValid ? (
                            <p className="mt-1 text-[11px] text-rose-400">
                              Invalid email address. Please enter a correct, trusted email (e.g., name@gmail.com).
                            </p>
                          ) : null}
                        </div>
                        <div className="space-y-1">
                          <label className="text-[11px] text-[#9BA3B8]">
                            Mobile number<span className="text-[#1D9E75]">*</span> <span className="text-[#5C6480]">(+91 Country code is default, Enter only 10 digits of your Mobile Number)</span>
                          </label>
                          <input
                            type="tel"
                            placeholder="9876543210"
                            value={phone}
                            onChange={(e) => setPhone(sanitizeMobileInput(e.target.value))}
                            onBlur={() => setPhoneTouched(true)}
                            className={cn(
                              "w-full bg-[#1C2333] border rounded-lg px-3 py-1.5 text-xs text-white outline-none transition",
                              showPhoneError
                                ? "border-rose-500/80 focus:border-rose-500 focus:shadow-[0_0_0_2px_rgba(244,63,94,0.15)]"
                                : "border-[#2A3347] focus:border-[#1D9E75]"
                            )}
                            required
                          />
                          {showPhoneError ? (
                            <p className="mt-1 text-[11px] text-rose-400">
                              {phoneNormalized.error || "Please enter a valid 10-digit mobile number."}
                            </p>
                          ) : null}
                        </div>
                      </div>

                      <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                        <div className="space-y-1">
                          <label className="text-[11px] text-[#9BA3B8]">
                            City<span className="text-[#1D9E75]">*</span>
                          </label>
                          <input
                            type="text"
                            placeholder="e.g. Bengaluru"
                            value={city}
                            onChange={(e) => setCity(e.target.value)}
                            className="w-full bg-[#1C2333] border border-[#2A3347] focus:border-[#1D9E75] rounded-lg px-3 py-1.5 text-xs text-white outline-none"
                            required
                          />
                        </div>
                        <div className="space-y-1">
                          <label className="text-[11px] text-[#9BA3B8]">
                            State<span className="text-[#1D9E75]">*</span>
                          </label>
                          <div className="relative">
                            <select
                              value={state}
                              onChange={(e) => setState(e.target.value)}
                              className="w-full bg-[#1C2333] border border-[#2A3347] focus:border-[#1D9E75] rounded-lg px-3 py-1.5 text-xs text-white outline-none appearance-none pr-8 cursor-pointer"
                              required
                            >
                              <option value="">Select state</option>
                              {[
                                "Andhra Pradesh",
                                "Bihar",
                                "Delhi",
                                "Gujarat",
                                "Karnataka",
                                "Kerala",
                                "Madhya Pradesh",
                                "Maharashtra",
                                "Rajasthan",
                                "Tamil Nadu",
                                "Telangana",
                                "Uttar Pradesh",
                                "West Bengal",
                                "Other",
                              ].map((st) => (
                                <option key={st} value={st}>
                                  {st}
                                </option>
                              ))}
                            </select>
                            <ChevronDown className="absolute right-2.5 top-2.5 h-3 w-3 text-[#9BA3B8] pointer-events-none" />
                          </div>
                        </div>
                      </div>
                    </div>

                    {/* ROLE SPECIFIC QUESTIONS */}
                    <div className="bg-[#161B25] border border-[#2A3347] rounded-xl p-4 space-y-4">
                      {role === "student" && (
                        <>
                          <p className="text-[10px] font-bold text-[#1D9E75] uppercase tracking-wider flex items-center gap-2">
                            <School className="h-4 w-4 shrink-0" />
                            Student details
                          </p>
                          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                            <div className="space-y-1">
                              <label className="text-[11px] text-[#9BA3B8]">
                                Class<span className="text-[#1D9E75]">*</span>
                              </label>
                              <select
                                value={studentClass}
                                onChange={(e) => setStudentClass(e.target.value)}
                                className="w-full bg-[#1C2333] border border-[#2A3347] focus:border-[#1D9E75] rounded-lg px-3 py-1.5 text-xs text-white outline-none cursor-pointer"
                                required
                              >
                                <option value="">Select</option>
                                <option>PUC 1 (Class 11)</option>
                                <option>PUC 2 (Class 12)</option>
                              </select>
                            </div>
                            <div className="space-y-1">
                              <label className="text-[11px] text-[#9BA3B8]">
                                School / college<span className="text-[#1D9E75]">*</span>
                              </label>
                              <input
                                type="text"
                                placeholder="Vidyashilp Academy"
                                value={school}
                                onChange={(e) => setSchool(e.target.value)}
                                className="w-full bg-[#1C2333] border border-[#2A3347] focus:border-[#1D9E75] rounded-lg px-3 py-1.5 text-xs text-white outline-none"
                                required
                              />
                            </div>
                          </div>
                          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                            <div className="space-y-1">
                              <label className="text-[11px] text-[#9BA3B8]">
                                Target exam<span className="text-[#1D9E75]">*</span>
                              </label>
                              <select
                                value={exam}
                                onChange={(e) => setExam(e.target.value)}
                                className="w-full bg-[#1C2333] border border-[#2A3347] focus:border-[#1D9E75] rounded-lg px-3 py-1.5 text-xs text-white outline-none cursor-pointer"
                                required
                              >
                                <option value="">Select</option>
                                <option>JEE Main / Advanced</option>
                                <option>KCET</option>
                                <option>CBSE Board</option>
                                <option>State Board</option>
                                <option>BITSAT</option>
                                <option>NEET</option>
                                <option>Other</option>
                              </select>
                            </div>
                            <div className="space-y-1">
                              <label className="text-[11px] text-[#9BA3B8]">Coaching / tutor</label>
                              <select
                                value={coaching}
                                onChange={(e) => setCoaching(e.target.value)}
                                className="w-full bg-[#1C2333] border border-[#2A3347] focus:border-[#1D9E75] rounded-lg px-3 py-1.5 text-xs text-white outline-none cursor-pointer"
                              >
                                <option value="">Select</option>
                                <option>Self-study only</option>
                                <option>Coaching class</option>
                                <option>Private tutor</option>
                                <option>Online EdTech platform</option>
                              </select>
                            </div>
                          </div>
                          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                            <div className="space-y-1">
                              <label className="text-[11px] text-[#9BA3B8]">
                                Study hours / week<span className="text-[#1D9E75]">*</span>
                              </label>
                              <select
                                value={hours}
                                onChange={(e) => setHours(e.target.value)}
                                className="w-full bg-[#1C2333] border border-[#2A3347] focus:border-[#1D9E75] rounded-lg px-3 py-1.5 text-xs text-white outline-none cursor-pointer"
                                required
                              >
                                <option value="">Select</option>
                                <option>Under 5 hrs</option>
                                <option>5 – 10 hrs</option>
                                <option>10 – 20 hrs</option>
                                <option>20 – 40 hrs</option>
                                <option>40+ hrs</option>
                              </select>
                            </div>
                            <div className="space-y-1">
                              <label className="text-[11px] text-[#9BA3B8]">Class 10 percentage</label>
                              <input
                                type="text"
                                placeholder="89%"
                                value={marks}
                                onChange={(e) => setMarks(e.target.value)}
                                className="w-full bg-[#1C2333] border border-[#2A3347] focus:border-[#1D9E75] rounded-lg px-3 py-1.5 text-xs text-white outline-none"
                              />
                            </div>
                          </div>
                        </>
                      )}

                      {role === "teacher" && (
                        <>
                          <p className="text-[10px] font-bold text-[#1D9E75] uppercase tracking-wider flex items-center gap-2">
                            <Presentation className="h-4 w-4 shrink-0" />
                            Teaching details
                          </p>
                          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                            <div className="space-y-1">
                              <label className="text-[11px] text-[#9BA3B8]">
                                Primary subject<span className="text-[#1D9E75]">*</span>
                              </label>
                              <select
                                value={subject}
                                onChange={(e) => setSubject(e.target.value)}
                                className="w-full bg-[#1C2333] border border-[#2A3347] focus:border-[#1D9E75] rounded-lg px-3 py-1.5 text-xs text-white outline-none cursor-pointer"
                                required
                              >
                                <option value="">Select</option>
                                <option>Physics</option>
                                <option>Chemistry</option>
                                <option>Mathematics</option>
                                <option>Biology</option>
                                <option>Multiple subjects</option>
                              </select>
                            </div>
                            <div className="space-y-1">
                              <label className="text-[11px] text-[#9BA3B8]">
                                Teaching experience<span className="text-[#1D9E75]">*</span>
                              </label>
                              <select
                                value={exp}
                                onChange={(e) => setExp(e.target.value)}
                                className="w-full bg-[#1C2333] border border-[#2A3347] focus:border-[#1D9E75] rounded-lg px-3 py-1.5 text-xs text-white outline-none cursor-pointer"
                                required
                              >
                                <option value="">Select</option>
                                <option>Under 2 years</option>
                                <option>2 – 5 years</option>
                                <option>5 – 10 years</option>
                                <option>10+ years</option>
                              </select>
                            </div>
                          </div>
                          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                            <div className="space-y-1">
                              <label className="text-[11px] text-[#9BA3B8]">
                                School / institution<span className="text-[#1D9E75]">*</span>
                              </label>
                              <input
                                type="text"
                                placeholder="Deeksha Centre"
                                value={school}
                                onChange={(e) => setSchool(e.target.value)}
                                className="w-full bg-[#1C2333] border border-[#2A3347] focus:border-[#1D9E75] rounded-lg px-3 py-1.5 text-xs text-white outline-none"
                                required
                              />
                            </div>
                            <div className="space-y-1">
                              <label className="text-[11px] text-[#9BA3B8]">Students taught / year</label>
                              <select
                                value={stucount}
                                onChange={(e) => setStucount(e.target.value)}
                                className="w-full bg-[#1C2333] border border-[#2A3347] focus:border-[#1D9E75] rounded-lg px-3 py-1.5 text-xs text-white outline-none cursor-pointer"
                              >
                                <option value="">Select</option>
                                <option>Under 30</option>
                                <option>30 – 100</option>
                                <option>100 – 300</option>
                                <option>300+</option>
                              </select>
                            </div>
                          </div>
                          <div className="space-y-1">
                            <label className="text-[11px] text-[#9BA3B8]">LinkedIn profile URL</label>
                            <input
                              type="url"
                              placeholder="https://linkedin.com/in/..."
                              value={linkedin}
                              onChange={(e) => setLinkedin(e.target.value)}
                              className="w-full bg-[#1C2333] border border-[#2A3347] focus:border-[#1D9E75] rounded-lg px-3 py-1.5 text-xs text-white outline-none"
                            />
                          </div>
                        </>
                      )}

                      {role === "parent" && (
                        <>
                          <p className="text-[10px] font-bold text-[#1D9E75] uppercase tracking-wider flex items-center gap-2">
                            <Heart className="h-4 w-4 shrink-0" />
                            About your child
                          </p>
                          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                            <div className="space-y-1">
                              <label className="text-[11px] text-[#9BA3B8]">
                                Child&apos;s class<span className="text-[#1D9E75]">*</span>
                              </label>
                              <select
                                value={childClass}
                                onChange={(e) => setChildClass(e.target.value)}
                                className="w-full bg-[#1C2333] border border-[#2A3347] focus:border-[#1D9E75] rounded-lg px-3 py-1.5 text-xs text-white outline-none cursor-pointer"
                                required
                              >
                                <option value="">Select</option>
                                <option>PUC 1 (Class 11)</option>
                                <option>PUC 2 (Class 12)</option>
                                <option>Both</option>
                              </select>
                            </div>
                            <div className="space-y-1">
                              <label className="text-[11px] text-[#9BA3B8]">Child&apos;s target exam</label>
                              <select
                                value={childExam}
                                onChange={(e) => setChildExam(e.target.value)}
                                className="w-full bg-[#1C2333] border border-[#2A3347] focus:border-[#1D9E75] rounded-lg px-3 py-1.5 text-xs text-white outline-none cursor-pointer"
                              >
                                <option value="">Select</option>
                                <option>JEE Main</option>
                                <option>KCET</option>
                                <option>NEET</option>
                                <option>State Board</option>
                                <option>CBSE Board</option>
                                <option>Other</option>
                              </select>
                            </div>
                          </div>
                        </>
                      )}

                      {role === "other" && (
                        <>
                          <p className="text-[10px] font-bold text-[#1D9E75] uppercase tracking-wider flex items-center gap-2">
                            <User className="h-4 w-4 shrink-0" />
                            About you
                          </p>
                          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                            <div className="space-y-1">
                              <label className="text-[11px] text-[#9BA3B8]">
                                Organisation<span className="text-[#1D9E75]">*</span>
                              </label>
                              <input
                                type="text"
                                placeholder="Acme Foundation"
                                value={org}
                                onChange={(e) => setOrg(e.target.value)}
                                className="w-full bg-[#1C2333] border border-[#2A3347] focus:border-[#1D9E75] rounded-lg px-3 py-1.5 text-xs text-white outline-none"
                                required
                              />
                            </div>
                            <div className="space-y-1">
                              <label className="text-[11px] text-[#9BA3B8]">Your role</label>
                              <input
                                type="text"
                                placeholder="CSR Manager"
                                value={orgRole}
                                onChange={(e) => setOrgRole(e.target.value)}
                                className="w-full bg-[#1C2333] border border-[#2A3347] focus:border-[#1D9E75] rounded-lg px-3 py-1.5 text-xs text-white outline-none"
                              />
                            </div>
                          </div>
                          <div className="space-y-1">
                            <label className="text-[11px] text-[#9BA3B8]">Website</label>
                            <input
                              type="url"
                              placeholder="https://..."
                              value={website}
                              onChange={(e) => setWebsite(e.target.value)}
                              className="w-full bg-[#1C2333] border border-[#2A3347] focus:border-[#1D9E75] rounded-lg px-3 py-1.5 text-xs text-white outline-none"
                            />
                          </div>
                        </>
                      )}
                    </div>

                    {/* AMBASSADOR INFO CALLOUT */}
                    {(role === "student" || role === "teacher") && (
                      <div className="bg-[#171425] border border-[#534AB7]/40 rounded-xl p-4 flex gap-3 text-xs leading-relaxed text-[#AFA9EC]">
                        <Star className="h-5 w-5 text-[#7F77DD] shrink-0 mt-0.5" />
                        <div className="space-y-1">
                          <p className="font-bold">
                            {role === "student" ? "Student" : "Teacher"} Ambassador — what it means
                          </p>
                          <p className="opacity-80">
                            {role === "student"
                              ? "As a Student Ambassador you get early access before public launch to test, learn, and shape the product. After the site goes live, maintain the defined daily activity level for 3 consecutive months, provide 5 confirmed referrals, and pass a 30-minute interview to qualify for a paid Student Ambassador role with EduBlast."
                              : "As a Teacher Ambassador you get early access to create exams, explore the Gyan++ wall, and provide structured feedback on the curriculum and question tools. After the site goes live, maintain the defined daily activity level for 3 consecutive months, provide 5 student referrals, and pass a 30-minute interview to qualify for a paid Teacher Ambassador role."}
                          </p>
                        </div>
                      </div>
                    )}

                    {/* INTERESTS */}
                    <div className="bg-[#161B25] border border-[#2A3347] rounded-xl p-4 space-y-3">
                      <p className="text-[10px] font-bold text-[#1D9E75] uppercase tracking-wider flex items-center gap-2">
                        <Heart className="h-4 w-4 shrink-0" />
                        Interests and motivation
                      </p>
                      <p className="text-xs text-[#9BA3B8]">
                        What interests you most about EduBlast?{" "}
                        <span className="text-[#5C6480]">(choose all that apply)</span>
                      </p>
                      <div className="flex flex-col gap-2">
                        {INTERESTS_DATA[role]?.map((item) => {
                          const checked = selectedInterests.includes(item);
                          return (
                            <div
                              key={item}
                              onClick={() => handleInterestToggle(item)}
                              className={`flex items-start gap-3 px-3.5 py-2.5 rounded-lg border cursor-pointer transition-colors ${
                                checked
                                  ? "border-[#1D9E75] bg-[#0A2A20]"
                                  : "border-[#2A3347] bg-[#1C2333] hover:bg-[#222A3A]"
                              }`}
                            >
                              <div
                                className={`w-4 h-4 rounded border flex items-center justify-center shrink-0 mt-0.5 ${
                                  checked
                                    ? "bg-[#1D9E75] border-[#1D9E75]"
                                    : "border-[#5C6480] bg-transparent"
                                }`}
                              >
                                {checked && <Check className="h-3 w-3 text-white" strokeWidth={3} />}
                              </div>
                              <p className={`text-xs ${checked ? "text-[#9FE1CB] font-medium" : "text-[#9BA3B8]"}`}>
                                {item}
                              </p>
                            </div>
                          );
                        })}
                      </div>

                      <div className="h-px bg-[#2A3347] my-3" />

                      <div className="space-y-1">
                        <label className="text-[11px] text-[#9BA3B8] font-medium">
                          Why do you want to join early?
                        </label>
                        <textarea
                          placeholder="Tell us what excites you about EduBlast..."
                          value={whyJoin}
                          onChange={(e) => setWhyJoin(e.target.value)}
                          className="w-full bg-[#1C2333] border border-[#2A3347] focus:border-[#1D9E75] rounded-lg px-3 py-2 text-xs text-white outline-none min-h-[80px]"
                        />
                      </div>
                    </div>

                    {/* REFERRAL INFORMATION */}
                    <div className="bg-[#161B25] border border-[#2A3347] rounded-xl p-4 space-y-4">
                      <p className="text-[10px] font-bold text-[#1D9E75] uppercase tracking-wider">
                        How did you hear about us?
                      </p>
                      <div className="relative">
                        <select
                          value={referral}
                          onChange={(e) => setReferral(e.target.value)}
                          className="w-full bg-[#1C2333] border border-[#2A3347] focus:border-[#1D9E75] rounded-lg px-3 py-1.5 text-xs text-white outline-none appearance-none pr-8 cursor-pointer"
                        >
                          <option value="">Select source</option>
                          {[
                            "Google Search",
                            "Facebook",
                            "Instagram",
                            "YouTube",
                            "Teacher Recommendation",
                            "Coaching Institute",
                            "Others",
                          ].map((src) => (
                            <option key={src} value={src}>
                              {src}
                            </option>
                          ))}
                        </select>
                        <ChevronDown className="absolute right-2.5 top-2.5 h-3 w-3 text-[#9BA3B8] pointer-events-none" />
                      </div>
                      <div className="space-y-1">
                        <label className="text-[11px] text-[#9BA3B8]">Referral code (if any)</label>
                        <input
                          type="text"
                          placeholder="Leave blank if none"
                          value={refcode}
                          onChange={(e) => setRefcode(e.target.value)}
                          className="w-full bg-[#1C2333] border border-[#2A3347] focus:border-[#1D9E75] rounded-lg px-3 py-1.5 text-xs text-white outline-none"
                        />
                      </div>
                    </div>

                    {/* CONSENTS */}
                    <div className="bg-[#161B25] border border-[#2A3347] rounded-xl p-4 space-y-3">
                      <p className="text-[10px] font-bold text-[#1D9E75] uppercase tracking-wider">
                        Consent
                      </p>
                      <div className="flex flex-col gap-2.5">
                        {[
                          {
                            id: "c1",
                            checked: c1,
                            onChange: () => setC1(!c1),
                            text: (
                              <>
                                I agree to be contacted by phone for waitlist verification and
                                ambassador selection.<span className="text-[#1D9E75]">*</span>
                              </>
                            ),
                          },
                          {
                            id: "c2",
                            checked: c2,
                            onChange: () => setC2(!c2),
                            text: (
                              <>
                                I confirm that the information I have provided is accurate and may
                                be verified by EduBlast.<span className="text-[#1D9E75]">*</span>
                              </>
                            ),
                          },
                          {
                            id: "c3",
                            checked: c3,
                            onChange: () => setC3(!c3),
                            text: (
                              <>
                                I agree to receive product updates, launch notifications, and
                                ambassador communications from EduBlast by email and SMS.
                              </>
                            ),
                          },
                        ].map((c) => (
                          <div
                            key={c.id}
                            onClick={c.onChange}
                            className={`flex items-start gap-3 px-3 py-2 rounded-lg border cursor-pointer transition-colors ${
                              c.checked
                                ? "border-[#1D9E75] bg-[#0A2A20]"
                                : "border-[#2A3347] bg-[#1C2333] hover:bg-[#222A3A]"
                            }`}
                          >
                            <div
                              className={`w-4 h-4 rounded border flex items-center justify-center shrink-0 mt-0.5 ${
                                c.checked
                                  ? "bg-[#1D9E75] border-[#1D9E75]"
                                  : "border-[#5C6480] bg-transparent"
                              }`}
                            >
                              {c.checked && <Check className="h-3 w-3 text-white" strokeWidth={3} />}
                            </div>
                            <p className={`text-xs ${c.checked ? "text-[#9FE1CB]" : "text-[#9BA3B8]"} leading-relaxed`}>
                              {c.text}
                            </p>
                          </div>
                        ))}
                      </div>
                    </div>

                    <button
                      type="submit"
                      disabled={!isFormValid}
                      className="w-full bg-[#1D9E75] hover:bg-[#0F6E56] disabled:bg-[#222A3A] disabled:text-[#5C6480] disabled:border-transparent text-white font-bold text-sm py-3 px-4 rounded-full flex items-center justify-center gap-2 cursor-pointer shadow-lg transition duration-200"
                    >
                      <Rocket className="h-4 w-4" />
                      Join the waitlist
                    </button>
                    <p className="text-[10px] text-[#5C6480] text-center flex items-center justify-center gap-1.5">
                      <Lock className="h-3.5 w-3.5 shrink-0" />
                      Your data is kept private and used only for waitlist management. No spam.
                    </p>
                  </div>
                )}
              </form>
            </div>
          </div>
        ) : (
          <div className="flex flex-col animate-in zoom-in-95 duration-200">
            {/* Success Banner */}
            <div className="bg-[#1D9E75] p-3 text-center relative overflow-hidden flex items-center justify-center gap-3">
              <Check className="h-6 w-6 text-white shrink-0" strokeWidth={3} />
              <div className="text-left">
                <div className="text-sm font-semibold text-white leading-tight">
                  You&apos;re on the waitlist!
                </div>
                <div className="text-[11px] text-white/80 leading-normal">
                  We will be in touch as we approach launch across India
                </div>
              </div>
            </div>

            <div className="px-5 py-8 sm:px-6 text-center space-y-6">
              <div className="w-16 h-16 rounded-full bg-[#0A2A20] border-2 border-[#1D9E75] flex items-center justify-center mx-auto shadow-md">
                <Check className="h-8 w-8 text-[#1D9E75]" strokeWidth={2.5} />
              </div>

              <div className="space-y-1.5">
                <h3 className="text-xl font-bold text-white">Application received</h3>
                <p className="text-xs text-[#9BA3B8] max-w-sm mx-auto leading-relaxed">
                  Thank you for joining the EduBlast waitlist. Your information has been recorded,
                  and we will reach out to verify your details.
                </p>
              </div>

              <div className="inline-flex items-center gap-2 bg-[#281C08] border border-[#EF9F27]/30 rounded-full px-4 py-1.5 text-xs font-semibold text-[#FAC775]">
                Waitlist ID: <span className="font-mono">{waitlistId}</span>
              </div>

              <div className="max-w-md mx-auto space-y-2 text-left">
                {[
                  {
                    icon: <Info className="h-4 w-4 text-[#EF9F27]" />,
                    bg: "bg-[#281C08] border-[#EF9F27]/15 text-[#9BA3B8]",
                    text: "We will call your registered mobile number to verify your details — keep an eye out for a call from the EduBlast team.",
                  },
                  {
                    icon: <Check className="h-4 w-4 text-[#1D9E75]" />,
                    bg: "bg-[#0A2A20] border-[#1D9E75]/15 text-[#9BA3B8]",
                    text: "A confirmation email is on its way. Check your spam folder if you do not see it within 10 minutes.",
                  },
                  {
                    icon: <Star className="h-4 w-4 text-[#7F77DD]" />,
                    bg: "bg-[#171425] border-[#7F77DD]/15 text-[#9BA3B8]",
                    text: "Share EduBlast with classmates or students across India. Each person you refer who joins the waitlist strengthens your ambassador application.",
                  },
                ].map((step, idx) => (
                  <div key={idx} className={`flex items-start gap-3 p-3 rounded-lg border ${step.bg} text-xs leading-relaxed`}>
                    <div className="shrink-0 mt-0.5">{step.icon}</div>
                    <p>{step.text}</p>
                  </div>
                ))}
              </div>

              {(role === "student" || role === "teacher") && (
                <div className="max-w-md mx-auto bg-[#171425] border border-[#534AB7]/30 rounded-xl p-4 text-left space-y-1">
                  <p className="text-xs font-bold text-[#AFA9EC]">
                    {role === "student" ? "Student" : "Teacher"} Ambassador pathway — what happens next
                  </p>
                  <p className="text-[11px] text-[#AFA9EC]/80 leading-relaxed">
                    Your application has been flagged for ambassador consideration. We will call
                    your registered mobile within 3 business days to verify your details. If selected,
                    you will receive an early access invitation before public launch. Keep your daily
                    activity high after launch — 3 months of consistent use, 5 referrals, and a
                    30-minute interview with the EduBlast team qualifies you for a paid Ambassador
                    position.
                  </p>
                </div>
              )}

              <button
                onClick={() => onOpenChange(false)}
                className="bg-[#1C2333] hover:bg-[#222A3A] text-white border border-[#2A3347] rounded-full px-6 py-2 text-xs font-semibold cursor-pointer transition"
              >
                Close Window
              </button>
            </div>
          </div>
        )}
      </DialogContent>
    </Dialog>
  );
}
