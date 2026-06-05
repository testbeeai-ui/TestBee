"use client";

import React, { useState, useEffect, Suspense, useRef } from "react";
import Link from "next/link";
import { useSearchParams } from "next/navigation";
import { cn } from "@/lib/utils";
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
  ArrowLeft,
  Phone,
  Trophy,
  ListTodo,
  Mail,
} from "lucide-react";

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

function WaitlistContent() {
  const searchParams = useSearchParams();
  const [role, setRole] = useState<string | null>(null);
  const formWrapRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const r = searchParams.get("role");
    if (r && ["student", "teacher", "parent", "other"].includes(r)) {
      setRole(r);
    }
  }, [searchParams]);

  const [firstName, setFirstName] = useState("");
  const [lastName, setLastName] = useState("");
  const [email, setEmail] = useState("");
  const [phone, setPhone] = useState("");
  const [city, setCity] = useState("");
  const [state, setState] = useState("");

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
  const [submitting, setSubmitting] = useState(false);
  const [submitError, setSubmitError] = useState("");

  // Reset role-specific selections when role changes
  const handleRoleChange = (newRole: string) => {
    setRole(newRole);
    setSelectedInterests([]);
    // Reset inputs
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
  };

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

  const isFormValid =
    role &&
    firstName.trim() &&
    lastName.trim() &&
    email.trim() &&
    phone.trim() &&
    city.trim() &&
    state.trim() &&
    whyJoin.trim() &&
    c1 &&
    c2;

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!isFormValid) return;
    setSubmitting(true);
    setSubmitError("");

    try {
      const res = await fetch("/api/waitlist", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          role,
          firstName,
          lastName,
          email,
          phone,
          city,
          state,
          studentClass,
          school,
          exam,
          coaching,
          hours,
          marks,
          subject,
          exp,
          stucount,
          linkedin,
          childClass,
          childExam,
          org,
          orgRole,
          website,
          selectedInterests,
          whyJoin,
          referral,
          refcode,
          c1,
          c2,
        }),
      });

      const data = await res.json();
      if (!res.ok) {
        throw new Error(data.error || "Failed to submit. Please try again.");
      }

      setWaitlistId(data.waitlistId);
      setSubmitted(true);
      setProgress(100);
      window.scrollTo({ top: 0, behavior: "smooth" });
    } catch (err: any) {
      setSubmitError(err.message || "Failed to join waitlist. Please check your network connection.");
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <div className="min-h-screen bg-[#0E1117] text-[#E8EAF0] pb-12 font-sans selection:bg-[#1D9E75]/30">
      
      {/* Top Header Section */}
      <div className="max-w-[680px] mx-auto px-4 pt-4 pb-0 flex flex-col sm:flex-row sm:items-start justify-between gap-4">
        <div className="flex flex-col items-start gap-1">
          <Link href="/">
            <img
              src="/images/logo-2.png"
              alt="EduBlast Logo"
              className="h-11 w-auto"
              draggable={false}
            />
          </Link>
          <Link
            href="/"
            className="inline-flex items-center gap-2 text-xs text-[#9BA3B8] hover:text-white transition"
          >
            <ArrowLeft className="h-4 w-4" />
            Back to menu
          </Link>
        </div>

        {!submitted && (
          <div className="bg-[#1D9E75] text-white px-5 py-3.5 rounded-xl w-full sm:max-w-[460px] text-left shadow-md flex flex-col gap-1 sm:self-stretch justify-center">
            <div className="text-[13px] sm:text-sm font-bold leading-snug">
              Act NOW! Join the waitlist &amp; qualify as a paid Ambassador
            </div>
            <div className="text-[11px] sm:text-xs text-white/90 leading-normal">
              Limited seats · early access · real rewards · India-wide launch coming soon
            </div>
          </div>
        )}
      </div>

      {!submitted ? (
        <div id="main-view" className="animate-in fade-in duration-200">
          
          <div className="max-w-[680px] mx-auto px-4 mt-0">

            {/* HERO */}
            <div className="text-center flex flex-col items-center pt-4 pb-6 px-4">
              <div className="inline-flex items-center gap-1.5 bg-[#281C08] border border-[#EF9F27] rounded-full px-3.5 py-1 text-xs font-medium text-[#FAC775] mb-4">
                <span className="h-1.5 w-1.5 rounded-full bg-[#EF9F27] animate-pulse" />
                Launching across India — sign up now
              </div>
              <h1 className="text-2xl sm:text-[26px] font-medium text-white mb-2 leading-snug">
                The social platform that makes
                <br />
                PCM students love studying
              </h1>
              <p className="text-sm text-[#9BA3B8] max-w-[480px] mx-auto leading-relaxed">
                EduBlast is the education social media for PUC 1 and 2 students — learn by scrolling, earn rewards, get real exam prep, and qualify for EduFund grants. Join the waitlist today.
              </p>
            </div>

            {/* AMBASSADOR PATHWAY */}
            <div className="px-4 mb-6">
              <div className="text-[11px] font-medium text-[#1D9E75] uppercase tracking-wider mb-3 text-center">
                Ambassador pathway
              </div>
              <div className="flex flex-col sm:flex-row border border-[#2A3347] bg-[#161B25] rounded-2xl overflow-hidden shadow-md">
                {[
                  {
                    num: "01",
                    title: "Join waitlist",
                    desc: "Fill the full form — all fields required for ambassador consideration",
                    icon: <ListTodo className="h-[16px] w-[16px] text-[#1D9E75]" />,
                    bg: "bg-[#0A2A20]",
                  },
                  {
                    num: "02",
                    title: "Phone verification",
                    desc: "We call verified applicants for a 5-minute confirmation chat",
                    icon: <Phone className="h-[16px] w-[16px] text-[#EF9F27]" />,
                    bg: "bg-[#281C08]",
                  },
                  {
                    num: "03",
                    title: "Early preview",
                    desc: "Ambassadors get access before public launch for testing",
                    icon: <Star className="h-[16px] w-[16px] text-[#7F77DD]" />,
                    bg: "bg-[#171425]",
                  },
                  {
                    num: "04",
                    title: "Qualify for paid role",
                    desc: "3 months active + 5 referrals + 30-min interview",
                    icon: <Trophy className="h-[16px] w-[16px] text-[#639922]" />,
                    bg: "bg-[#131D08]",
                  },
                ].map((step, idx) => (
                  <div
                    key={step.num}
                    className={cn(
                      "flex-1 p-3.5 text-center relative border-b sm:border-b-0 sm:border-r border-[#2A3347]",
                      idx === 3 && "border-r-0 border-b-0"
                    )}
                  >
                    <div className="absolute top-1.5 right-2 text-[9px] font-semibold text-[#5C6480] font-mono">
                      {step.num}
                    </div>
                    <div className={cn("w-8 h-8 rounded-full flex items-center justify-center mx-auto mb-1.5", step.bg)}>
                      {step.icon}
                    </div>
                    <p className="text-[11px] font-semibold text-white mb-0.5">{step.title}</p>
                    <p className="text-[10px] text-[#5C6480] leading-snug">{step.desc}</p>
                  </div>
                ))}
              </div>
            </div>

            {/* STATS */}
            <div className="px-4 mb-6">
              <div className="grid grid-cols-3 gap-2">
                {[
                  { num: "247", lbl: "on the waitlist", color: "text-[#1D9E75]" },
                  { num: "18", lbl: "ambassadors selected", color: "text-[#EF9F27]" },
                  { num: "India-wide", lbl: "Phase 1 launch", color: "text-[#7F77DD]" },
                ].map((s) => (
                  <div key={s.lbl} className="bg-[#161B25] border border-[#2A3347] rounded-xl p-3 text-center shadow-sm">
                    <p className={cn("text-[21px] font-medium mb-0.5", s.color)}>{s.num}</p>
                    <p className="text-[11px] text-[#5C6480] leading-none">{s.lbl}</p>
                  </div>
                ))}
              </div>
            </div>

            {/* FORM CONTAINER */}
            <div ref={formWrapRef} id="form-wrap" className="px-4">
              
              {/* Progress bar */}
              <div className="h-[3px] bg-[#2A3347] rounded-full overflow-hidden mb-5">
                <div
                  className="h-full bg-[#1D9E75] transition-all duration-300"
                  style={{ width: `${progress}%` }}
                />
              </div>

              {/* Role selector */}
              <div className="text-[12px] font-semibold text-[#9BA3B8] mb-2.5">
                I am a <span className="text-[#1D9E75]">*</span>
              </div>
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-2.5 mb-6">
                {[
                  {
                    id: "student",
                    name: "Student",
                    desc: "PUC 1 or PUC 2 — learning and exam prep",
                    icon: <School className="h-[19px] w-[19px] text-[#5C6480]" />,
                    badge: "Student Ambassador opportunity",
                  },
                  {
                    id: "teacher",
                    name: "Teacher / Tutor",
                    desc: "Teaching PUC Physics, Chemistry or Maths",
                    icon: <Presentation className="h-[19px] w-[19px] text-[#5C6480]" />,
                    badge: "Teacher Ambassador opportunity",
                  },
                  {
                    id: "parent",
                    name: "Parent / Guardian",
                    desc: "Supporting a PUC student at home",
                    icon: <Heart className="h-[19px] w-[19px] text-[#5C6480]" />,
                  },
                  {
                    id: "other",
                    name: "Other",
                    desc: "Donor, investor, institution, media",
                    icon: <User className="h-[19px] w-[19px] text-[#5C6480]" />,
                  },
                ].map((item) => {
                  const sel = role === item.id;
                  return (
                    <div
                      key={item.id}
                      onClick={() => handleRoleChange(item.id)}
                      className={cn(
                        "bg-[#1C2333] border border-[#2A3347] rounded-2xl p-3.5 cursor-pointer flex flex-col gap-1.5 transition-all duration-150 hover:bg-[#222A3A] hover:border-[#334060]",
                        sel && "border-[#1D9E75] bg-[#0A2A20] hover:bg-[#0A2A20] hover:border-[#1D9E75]"
                      )}
                    >
                      <div className="flex items-center gap-2.5">
                        <div className={cn(
                          "w-9 h-9 rounded-full bg-[#222A3A] flex items-center justify-center shrink-0",
                          sel && "bg-[#0A2A20]"
                        )}>
                          {React.cloneElement(item.icon, {
                            className: cn("h-[19px] w-[19px] text-[#5C6480]", sel && "text-[#1D9E75]")
                          })}
                        </div>
                        <div className="min-w-0">
                          <p className="text-sm font-semibold text-white leading-tight">{item.name}</p>
                          <p className="text-xs text-[#5C6480] leading-snug mt-0.5">{item.desc}</p>
                        </div>
                      </div>
                      {item.badge && (
                        <div>
                          <span className="inline-flex items-center gap-1 bg-[#171425] border border-[#7F77DD] rounded-full px-2.5 py-0.5 text-[10px] font-medium text-[#AFA9EC]">
                            <Star className="h-2.5 w-2.5 text-[#AFA9EC] fill-current" />
                            {item.badge}
                          </span>
                        </div>
                      )}
                    </div>
                  );
                })}
              </div>

              {role && (
                <form onSubmit={handleSubmit} className="space-y-4">
                  
                  {/* PERSONAL DETAILS CARD */}
                  <div className="bg-[#161B25] border border-[#2A3347] rounded-2xl p-5 space-y-4 shadow-sm">
                    <div className="text-[11px] font-medium text-[#1D9E75] uppercase tracking-wider mb-3 flex items-center gap-1.5">
                      <User className="h-4 w-4" />
                      Personal details
                    </div>
                    
                    <div className="grid grid-cols-2 gap-2.5">
                      <div className="flex flex-col gap-1">
                        <span className="text-xs text-[#9BA3B8]">
                          First name<span className="text-[#1D9E75]">*</span>
                        </span>
                        <input
                          type="text"
                          placeholder="Arjun"
                          value={firstName}
                          onChange={(e) => setFirstName(e.target.value)}
                          className="w-full bg-[#1C2333] border border-[#2A3347] focus:border-[#1D9E75] rounded-lg px-3 py-2 text-sm text-white outline-none transition"
                          required
                        />
                      </div>
                      <div className="flex flex-col gap-1">
                        <span className="text-xs text-[#9BA3B8]">
                          Last name<span className="text-[#1D9E75]">*</span>
                        </span>
                        <input
                          type="text"
                          placeholder="Sharma"
                          value={lastName}
                          onChange={(e) => setLastName(e.target.value)}
                          className="w-full bg-[#1C2333] border border-[#2A3347] focus:border-[#1D9E75] rounded-lg px-3 py-2 text-sm text-white outline-none transition"
                          required
                        />
                      </div>
                    </div>

                    {/* CONTACT NOTE */}
                    <div className="flex items-start gap-2 p-2.5 bg-[#281C08] border border-[#4a3010] rounded-lg text-xs text-[#FAC775] leading-relaxed shadow-sm">
                      <Info className="h-4 w-4 text-[#EF9F27] shrink-0 mt-0.5" />
                      <span>
                        Please provide accurate email and mobile information so we can reach you for verification during ambassador selection. Incomplete or incorrect contact details will disqualify your application.
                      </span>
                    </div>

                    <div className="grid grid-cols-2 gap-2.5">
                      <div className="flex flex-col gap-1">
                        <span className="text-xs text-[#9BA3B8]">
                          Email address<span className="text-[#1D9E75]">*</span>
                        </span>
                        <input
                          type="email"
                          placeholder="arjun@gmail.com"
                          value={email}
                          onChange={(e) => setEmail(e.target.value)}
                          className="w-full bg-[#1C2333] border border-[#2A3347] focus:border-[#1D9E75] rounded-lg px-3 py-2 text-sm text-white outline-none transition"
                          required
                        />
                      </div>
                      <div className="flex flex-col gap-1">
                        <span className="text-xs text-[#9BA3B8]">
                          Mobile number<span className="text-[#1D9E75]">*</span>
                        </span>
                        <input
                          type="tel"
                          placeholder="+91 98XXX XXXXX"
                          value={phone}
                          onChange={(e) => setPhone(e.target.value)}
                          className="w-full bg-[#1C2333] border border-[#2A3347] focus:border-[#1D9E75] rounded-lg px-3 py-2 text-sm text-white outline-none transition"
                          required
                        />
                      </div>
                    </div>

                    <div className="grid grid-cols-2 gap-2.5">
                      <div className="flex flex-col gap-1">
                        <span className="text-xs text-[#9BA3B8]">
                          City<span className="text-[#1D9E75]">*</span>
                        </span>
                        <input
                          type="text"
                          placeholder="e.g. Bengaluru, Mumbai"
                          value={city}
                          onChange={(e) => setCity(e.target.value)}
                          className="w-full bg-[#1C2333] border border-[#2A3347] focus:border-[#1D9E75] rounded-lg px-3 py-2 text-sm text-white outline-none transition"
                          required
                        />
                      </div>
                      <div className="flex flex-col gap-1">
                        <span className="text-xs text-[#9BA3B8]">
                          State<span className="text-[#1D9E75]">*</span>
                        </span>
                        <div className="relative">
                          <select
                            value={state}
                            onChange={(e) => setState(e.target.value)}
                            className="w-full bg-[#1C2333] border border-[#2A3347] focus:border-[#1D9E75] rounded-lg px-3 py-2 text-sm text-white outline-none appearance-none pr-8 cursor-pointer transition"
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
                          <ChevronDown className="absolute right-2.5 top-3.5 h-3 w-3 text-[#9BA3B8] pointer-events-none" />
                        </div>
                      </div>
                    </div>
                  </div>

                  {/* ROLE-SPECIFIC CARD */}
                  <div className="bg-[#161B25] border border-[#2A3347] rounded-2xl p-5 space-y-4 shadow-sm">
                    {role === "student" && (
                      <>
                        <div className="text-[11px] font-medium text-[#1D9E75] uppercase tracking-wider mb-3 flex items-center gap-1.5">
                          <School className="h-4 w-4" />
                          Student details
                        </div>
                        <div className="grid grid-cols-2 gap-2.5">
                          <div className="flex flex-col gap-1">
                            <span className="text-xs text-[#9BA3B8]">
                              Class<span className="text-[#1D9E75]">*</span>
                            </span>
                            <div className="relative">
                              <select
                                value={studentClass}
                                onChange={(e) => setStudentClass(e.target.value)}
                                className="w-full bg-[#1C2333] border border-[#2A3347] focus:border-[#1D9E75] rounded-lg px-3 py-2 text-sm text-white outline-none appearance-none pr-8 cursor-pointer"
                                required
                              >
                                <option value="">Select</option>
                                <option>PUC 1 (Class 11)</option>
                                <option>PUC 2 (Class 12)</option>
                              </select>
                              <ChevronDown className="absolute right-2.5 top-3.5 h-3 w-3 text-[#9BA3B8] pointer-events-none" />
                            </div>
                          </div>
                          <div className="flex flex-col gap-1">
                            <span className="text-xs text-[#9BA3B8]">
                              School / college<span className="text-[#1D9E75]">*</span>
                            </span>
                            <input
                              type="text"
                              placeholder="e.g. Vidyashilp Academy"
                              value={school}
                              onChange={(e) => setSchool(e.target.value)}
                              className="w-full bg-[#1C2333] border border-[#2A3347] focus:border-[#1D9E75] rounded-lg px-3 py-2 text-sm text-white outline-none transition"
                              required
                            />
                          </div>
                        </div>

                        <div className="grid grid-cols-2 gap-2.5">
                          <div className="flex flex-col gap-1">
                            <span className="text-xs text-[#9BA3B8]">
                              Target exam<span className="text-[#1D9E75]">*</span>
                            </span>
                            <div className="relative">
                              <select
                                value={exam}
                                onChange={(e) => setExam(e.target.value)}
                                className="w-full bg-[#1C2333] border border-[#2A3347] focus:border-[#1D9E75] rounded-lg px-3 py-2 text-sm text-white outline-none appearance-none pr-8 cursor-pointer"
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
                              <ChevronDown className="absolute right-2.5 top-3.5 h-3 w-3 text-[#9BA3B8] pointer-events-none" />
                            </div>
                          </div>
                          <div className="flex flex-col gap-1">
                            <span className="text-xs text-[#9BA3B8]">Coaching / tutor</span>
                            <div className="relative">
                              <select
                                value={coaching}
                                onChange={(e) => setCoaching(e.target.value)}
                                className="w-full bg-[#1C2333] border border-[#2A3347] focus:border-[#1D9E75] rounded-lg px-3 py-2 text-sm text-white outline-none appearance-none pr-8 cursor-pointer"
                              >
                                <option value="">Select</option>
                                <option>Self-study only</option>
                                <option>Coaching class</option>
                                <option>Private tutor</option>
                                <option>Online EdTech platform</option>
                              </select>
                              <ChevronDown className="absolute right-2.5 top-3.5 h-3 w-3 text-[#9BA3B8] pointer-events-none" />
                            </div>
                          </div>
                        </div>

                        <div className="grid grid-cols-2 gap-2.5">
                          <div className="flex flex-col gap-1">
                            <span className="text-xs text-[#9BA3B8]">
                              Study hours / week<span className="text-[#1D9E75]">*</span>
                            </span>
                            <div className="relative">
                              <select
                                value={hours}
                                onChange={(e) => setHours(e.target.value)}
                                className="w-full bg-[#1C2333] border border-[#2A3347] focus:border-[#1D9E75] rounded-lg px-3 py-2 text-sm text-white outline-none appearance-none pr-8 cursor-pointer"
                                required
                              >
                                <option value="">Select</option>
                                <option>Under 5 hrs</option>
                                <option>5 – 10 hrs</option>
                                <option>10 – 20 hrs</option>
                                <option>20 – 40 hrs</option>
                                <option>40+ hrs</option>
                              </select>
                              <ChevronDown className="absolute right-2.5 top-3.5 h-3 w-3 text-[#9BA3B8] pointer-events-none" />
                            </div>
                          </div>
                          <div className="flex flex-col gap-1">
                            <span className="text-xs text-[#9BA3B8]">Class 10 percentage</span>
                            <input
                              type="text"
                              placeholder="e.g. 89%"
                              value={marks}
                              onChange={(e) => setMarks(e.target.value)}
                              className="w-full bg-[#1C2333] border border-[#2A3347] focus:border-[#1D9E75] rounded-lg px-3 py-2 text-sm text-white outline-none transition"
                            />
                          </div>
                        </div>
                      </>
                    )}

                    {role === "teacher" && (
                      <>
                        <div className="text-[11px] font-medium text-[#1D9E75] uppercase tracking-wider mb-3 flex items-center gap-1.5">
                          <Presentation className="h-4 w-4" />
                          Teaching details
                        </div>
                        <div className="grid grid-cols-2 gap-2.5">
                          <div className="flex flex-col gap-1">
                            <span className="text-xs text-[#9BA3B8]">
                              Primary subject<span className="text-[#1D9E75]">*</span>
                            </span>
                            <div className="relative">
                              <select
                                value={subject}
                                onChange={(e) => setSubject(e.target.value)}
                                className="w-full bg-[#1C2333] border border-[#2A3347] focus:border-[#1D9E75] rounded-lg px-3 py-2 text-sm text-white outline-none appearance-none pr-8 cursor-pointer"
                                required
                              >
                                <option value="">Select</option>
                                <option>Physics</option>
                                <option>Chemistry</option>
                                <option>Mathematics</option>
                                <option>Biology</option>
                                <option>Multiple subjects</option>
                              </select>
                              <ChevronDown className="absolute right-2.5 top-3.5 h-3 w-3 text-[#9BA3B8] pointer-events-none" />
                            </div>
                          </div>
                          <div className="flex flex-col gap-1">
                            <span className="text-xs text-[#9BA3B8]">
                              Teaching experience<span className="text-[#1D9E75]">*</span>
                            </span>
                            <div className="relative">
                              <select
                                value={exp}
                                onChange={(e) => setExp(e.target.value)}
                                className="w-full bg-[#1C2333] border border-[#2A3347] focus:border-[#1D9E75] rounded-lg px-3 py-2 text-sm text-white outline-none appearance-none pr-8 cursor-pointer"
                                required
                              >
                                <option value="">Select</option>
                                <option>Under 2 years</option>
                                <option>2 – 5 years</option>
                                <option>5 – 10 years</option>
                                <option>10+ years</option>
                              </select>
                              <ChevronDown className="absolute right-2.5 top-3.5 h-3 w-3 text-[#9BA3B8] pointer-events-none" />
                            </div>
                          </div>
                        </div>

                        <div className="grid grid-cols-2 gap-2.5">
                          <div className="flex flex-col gap-1">
                            <span className="text-xs text-[#9BA3B8]">
                              School / institution<span className="text-[#1D9E75]">*</span>
                            </span>
                            <input
                              type="text"
                              placeholder="e.g. Deeksha Centre"
                              value={school}
                              onChange={(e) => setSchool(e.target.value)}
                              className="w-full bg-[#1C2333] border border-[#2A3347] focus:border-[#1D9E75] rounded-lg px-3 py-2 text-sm text-white outline-none transition"
                              required
                            />
                          </div>
                          <div className="flex flex-col gap-1">
                            <span className="text-xs text-[#9BA3B8]">Students taught / year</span>
                            <div className="relative">
                              <select
                                value={stucount}
                                onChange={(e) => setStucount(e.target.value)}
                                className="w-full bg-[#1C2333] border border-[#2A3347] focus:border-[#1D9E75] rounded-lg px-3 py-2 text-sm text-white outline-none appearance-none pr-8 cursor-pointer"
                              >
                                <option value="">Select</option>
                                <option>Under 30</option>
                                <option>30 – 100</option>
                                <option>100 – 300</option>
                                <option>300+</option>
                              </select>
                              <ChevronDown className="absolute right-2.5 top-3.5 h-3 w-3 text-[#9BA3B8] pointer-events-none" />
                            </div>
                          </div>
                        </div>

                        <div className="flex flex-col gap-1">
                          <span className="text-xs text-[#9BA3B8]">LinkedIn or professional profile URL</span>
                          <input
                            type="url"
                            placeholder="https://linkedin.com/in/..."
                            value={linkedin}
                            onChange={(e) => setLinkedin(e.target.value)}
                            className="w-full bg-[#1C2333] border border-[#2A3347] focus:border-[#1D9E75] rounded-lg px-3 py-2 text-sm text-white outline-none transition"
                          />
                        </div>
                      </>
                    )}

                    {role === "parent" && (
                      <>
                        <div className="text-[11px] font-medium text-[#1D9E75] uppercase tracking-wider mb-3 flex items-center gap-1.5">
                          <Heart className="h-4 w-4" />
                          About your child
                        </div>
                        <div className="grid grid-cols-2 gap-2.5">
                          <div className="flex flex-col gap-1">
                            <span className="text-xs text-[#9BA3B8]">
                              Child's class<span className="text-[#1D9E75]">*</span>
                            </span>
                            <div className="relative">
                              <select
                                value={childClass}
                                onChange={(e) => setChildClass(e.target.value)}
                                className="w-full bg-[#1C2333] border border-[#2A3347] focus:border-[#1D9E75] rounded-lg px-3 py-2 text-sm text-white outline-none appearance-none pr-8 cursor-pointer"
                                required
                              >
                                <option value="">Select</option>
                                <option>PUC 1 (Class 11)</option>
                                <option>PUC 2 (Class 12)</option>
                                <option>Both</option>
                              </select>
                              <ChevronDown className="absolute right-2.5 top-3.5 h-3 w-3 text-[#9BA3B8] pointer-events-none" />
                            </div>
                          </div>
                          <div className="flex flex-col gap-1">
                            <span className="text-xs text-[#9BA3B8]">Child's target exam</span>
                            <div className="relative">
                              <select
                                value={childExam}
                                onChange={(e) => setChildExam(e.target.value)}
                                className="w-full bg-[#1C2333] border border-[#2A3347] focus:border-[#1D9E75] rounded-lg px-3 py-2 text-sm text-white outline-none appearance-none pr-8 cursor-pointer"
                              >
                                <option value="">Select</option>
                                <option>JEE Main</option>
                                <option>KCET</option>
                                <option>NEET</option>
                                <option>State Board</option>
                                <option>CBSE Board</option>
                                <option>Other</option>
                              </select>
                              <ChevronDown className="absolute right-2.5 top-3.5 h-3 w-3 text-[#9BA3B8] pointer-events-none" />
                            </div>
                          </div>
                        </div>
                      </>
                    )}

                    {role === "other" && (
                      <>
                        <div className="text-[11px] font-medium text-[#1D9E75] uppercase tracking-wider mb-3 flex items-center gap-1.5">
                          <User className="h-4 w-4" />
                          About you
                        </div>
                        <div className="grid grid-cols-2 gap-2.5">
                          <div className="flex flex-col gap-1">
                            <span className="text-xs text-[#9BA3B8]">
                              Organisation<span className="text-[#1D9E75]">*</span>
                            </span>
                            <input
                              type="text"
                              placeholder="e.g. Acme Foundation"
                              value={org}
                              onChange={(e) => setOrg(e.target.value)}
                              className="w-full bg-[#1C2333] border border-[#2A3347] focus:border-[#1D9E75] rounded-lg px-3 py-2 text-sm text-white outline-none transition"
                              required
                            />
                          </div>
                          <div className="flex flex-col gap-1">
                            <span className="text-xs text-[#9BA3B8]">Your role</span>
                            <input
                              type="text"
                              placeholder="e.g. CSR Manager"
                              value={orgRole}
                              onChange={(e) => setOrgRole(e.target.value)}
                              className="w-full bg-[#1C2333] border border-[#2A3347] focus:border-[#1D9E75] rounded-lg px-3 py-2 text-sm text-white outline-none transition"
                            />
                          </div>
                        </div>
                        <div className="flex flex-col gap-1">
                          <span className="text-xs text-[#9BA3B8]">Website</span>
                          <input
                            type="url"
                            placeholder="https://..."
                            value={website}
                            onChange={(e) => setWebsite(e.target.value)}
                            className="w-full bg-[#1C2333] border border-[#2A3347] focus:border-[#1D9E75] rounded-lg px-3 py-2 text-sm text-white outline-none transition"
                          />
                        </div>
                      </>
                    )}
                  </div>

                  {/* AMBASSADOR INFO CALLOUT */}
                  {(role === "student" || role === "teacher") && (
                    <div className="bg-[#171425] border border-[#534AB7] rounded-xl p-3.5 flex gap-3 text-xs leading-relaxed text-[#AFA9EC] shadow-sm">
                      <Star className="h-5 w-5 text-[#7F77DD] shrink-0 mt-0.5 fill-current" />
                      <div className="space-y-0.5">
                        <p className="font-semibold text-[13px] text-[#AFA9EC]">
                          {role === "student" ? "Student" : "Teacher"} Ambassador — what it means
                        </p>
                        <p className="opacity-80 text-xs leading-relaxed">
                          {role === "student"
                            ? "As a Student Ambassador you get early access before public launch to test, learn, and shape the product. After the site goes live, maintain the defined daily activity level for 3 consecutive months, provide 5 confirmed referrals, and pass a 30-minute interview to qualify for a paid Student Ambassador role with EduBlast."
                            : "As a Teacher Ambassador you get early access to create exams, explore the Gyan++ wall, and provide structured feedback on the curriculum and question tools. After the site goes live, maintain the defined daily activity level for 3 consecutive months, provide 5 student referrals, and pass a 30-minute interview to qualify for a paid Teacher Ambassador role."}
                        </p>
                      </div>
                    </div>
                  )}

                  {/* INTERESTS & MOTIVATION CARD */}
                  <div className="bg-[#161B25] border border-[#2A3347] rounded-2xl p-5 space-y-4 shadow-sm">
                    <div className="text-[11px] font-medium text-[#1D9E75] uppercase tracking-wider mb-3 flex items-center gap-1.5">
                      <Heart className="h-4 w-4" />
                      Interests and motivation
                    </div>
                    <p className="text-xs text-[#9BA3B8]">
                      What interests you most about EduBlast? <span className="text-[#5C6480]">(choose all that apply)</span>
                    </p>
                    <div className="flex flex-col gap-1.5">
                      {INTERESTS_DATA[role]?.map((item) => {
                        const checked = selectedInterests.includes(item);
                        return (
                          <div
                            key={item}
                            onClick={() => handleInterestToggle(item)}
                            className={cn(
                              "flex items-start gap-3 px-3.5 py-2.5 rounded-lg border cursor-pointer transition-colors bg-[#1C2333] border-[#2A3347] hover:border-[#334060]",
                              checked && "border-[#1D9E75] bg-[#0A2A20]"
                            )}
                          >
                            <div className={cn(
                              "w-4.5 h-4.5 rounded border flex items-center justify-center shrink-0 mt-0.5 border-[#2D384D] bg-transparent",
                              checked && "bg-[#1D9E75] border-[#1D9E75]"
                            )}>
                              {checked && <Check className="h-3 w-3 text-white" strokeWidth={3} />}
                            </div>
                            <p className={cn("text-xs text-[#9BA3B8] leading-tight", checked && "text-[#9FE1CB] font-medium")}>
                              {item}
                            </p>
                          </div>
                        );
                      })}
                    </div>

                    <div className="h-[0.5px] bg-[#2A3347] my-3" />

                    <div className="flex flex-col gap-1.5">
                      <span className="text-xs text-[#9BA3B8] font-medium">
                        Why do you want to join early?<span className="text-[#1D9E75]">*</span>
                      </span>
                      <textarea
                        placeholder="Tell us what excites you about EduBlast and what you hope to contribute as an early tester or ambassador..."
                        value={whyJoin}
                        onChange={(e) => setWhyJoin(e.target.value)}
                        className="w-full bg-[#1C2333] border border-[#2A3347] focus:border-[#1D9E75] rounded-lg px-3 py-2.5 text-xs text-white outline-none min-h-[80px] transition"
                        required
                      />
                    </div>
                  </div>

                  {/* HOW DID YOU HEAR CARD */}
                  <div className="bg-[#161B25] border border-[#2A3347] rounded-2xl p-5 space-y-4 shadow-sm">
                    <div className="text-[11px] font-medium text-[#1D9E75] uppercase tracking-wider mb-1 flex items-center gap-1.5">
                      <Rocket className="h-4 w-4" />
                      How did you hear about us?
                    </div>
                    <div className="relative">
                      <select
                        value={referral}
                        onChange={(e) => setReferral(e.target.value)}
                        className="w-full bg-[#1C2333] border border-[#2A3347] focus:border-[#1D9E75] rounded-lg px-3 py-2 text-sm text-white outline-none appearance-none pr-8 cursor-pointer"
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
                      <ChevronDown className="absolute right-2.5 top-3.5 h-3 w-3 text-[#9BA3B8] pointer-events-none" />
                    </div>
                    <div className="flex flex-col gap-1">
                      <span className="text-xs text-[#9BA3B8]">Referral code (if any)</span>
                      <input
                        type="text"
                        placeholder="Leave blank if none"
                        value={refcode}
                        onChange={(e) => setRefcode(e.target.value)}
                        className="w-full bg-[#1C2333] border border-[#2A3347] focus:border-[#1D9E75] rounded-lg px-3 py-2 text-sm text-white outline-none transition"
                      />
                    </div>
                  </div>

                  {/* CONSENTS CARD */}
                  <div className="bg-[#161B25] border border-[#2A3347] rounded-2xl p-5 space-y-4 shadow-sm">
                    <div className="text-[11px] font-medium text-[#1D9E75] uppercase tracking-wider mb-1 flex items-center gap-1.5">
                      <Lock className="h-4 w-4" />
                      Consent
                    </div>
                    <div className="flex flex-col gap-2">
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
                          className={cn(
                            "flex items-start gap-3 px-3.5 py-2.5 rounded-lg border cursor-pointer transition-colors bg-[#1C2333] border-[#2A3347] hover:border-[#334060]",
                            c.checked && "border-[#1D9E75] bg-[#0A2A20]"
                          )}
                        >
                          <div className={cn(
                            "w-4.5 h-4.5 rounded border flex items-center justify-center shrink-0 mt-0.5 border-[#2D384D] bg-transparent",
                            c.checked && "bg-[#1D9E75] border-[#1D9E75]"
                          )}>
                            {c.checked && <Check className="h-3 w-3 text-white" strokeWidth={3} />}
                          </div>
                          <p className={cn("text-xs leading-relaxed text-[#9BA3B8]", c.checked && "text-[#9FE1CB]")}>
                            {c.text}
                          </p>
                        </div>
                      ))}
                    </div>
                  </div>

                  {submitError && (
                    <p className="text-xs text-rose-400 bg-rose-950/20 border border-rose-900/30 rounded-lg p-3 text-center">
                      {submitError}
                    </p>
                  )}

                  <button
                    type="submit"
                    disabled={!isFormValid || submitting}
                    className="w-full bg-[#1D9E75] hover:bg-[#0F6E56] disabled:bg-[#222A3A] disabled:text-[#5C6480] disabled:border-[#2A3347] text-white font-medium text-sm py-3 px-4 rounded-full flex items-center justify-center gap-2 cursor-pointer transition-colors"
                  >
                    <Rocket className="h-4 w-4 shrink-0" />
                    Join the waitlist
                  </button>
                  <p className="text-[11px] text-[#5C6480] text-center flex items-center justify-center gap-1.5">
                    <Lock className="h-3.5 w-3.5 shrink-0" />
                    Your data is kept private and used only for waitlist management. No spam.
                  </p>
                </form>
              )}
            </div>
          </div>
        </div>
      ) : (
        <div id="ty-view" className="animate-in zoom-in-95 duration-200">
          
          {/* ── SUCCESS BANNER ── */}
          <div className="bg-[#1D9E75] overflow-hidden relative mb-0">
            <div className="flex items-center justify-center gap-3 px-5 py-3.5 relative z-10 max-w-4xl mx-auto">
              <Check className="h-7 w-7 text-white shrink-0" strokeWidth={2.5} />
              <div className="text-center">
                <div className="text-base sm:text-[20px] font-medium text-white leading-tight tracking-tight mb-0.5">
                  You're on the waitlist!
                </div>
                <div className="text-xs sm:text-[13px] text-white/80 leading-normal">
                  We will be in touch as we approach launch across India
                </div>
              </div>
            </div>
          </div>

          <div className="max-w-[680px] mx-auto px-4 mt-6">
            <div className="text-center py-12">
              <div className="w-[72px] h-[72px] rounded-full bg-[#0A2A20] border-2 border-[#1D9E75] flex items-center justify-center mx-auto mb-4 shadow-sm">
                <Check className="h-8 w-8 text-[#1D9E75]" strokeWidth={2.5} />
              </div>
              <h2 className="text-[22px] font-medium text-white mb-2" id="ty-title">Application received</h2>
              <p className="text-sm text-[#9BA3B8] max-w-[420px] mx-auto mb-6 leading-relaxed" id="ty-sub">
                Thank you for joining the EduBlast waitlist. Your information has been recorded and we will reach out to verify your details.
              </p>
              
              <div className="inline-flex items-center gap-1.5 bg-[#281C08] border border-[#EF9F27] rounded-full px-4 py-1.5 text-sm font-medium text-[#FAC775] mb-6 shadow-sm">
                Waitlist ID: <span id="ty-ref" className="font-mono">EB-2026-{waitlistId.replace("EB-2026-", "")}</span>
              </div>

              <div className="flex flex-col gap-2 max-w-[420px] mx-auto text-left mb-6">
                <div className="flex items-start gap-2.5 p-2.5 bg-[#161B25] border border-[#2A3347] rounded-lg text-xs leading-relaxed text-[#9BA3B8]">
                  <Phone className="h-[16px] w-[16px] text-[#EF9F27] shrink-0 mt-0.5" />
                  <span>We will call your registered mobile number to verify your details — keep an eye out for a call from the EduBlast team.</span>
                </div>
                <div className="flex items-start gap-2.5 p-2.5 bg-[#161B25] border border-[#2A3347] rounded-lg text-xs leading-relaxed text-[#9BA3B8]">
                  <Mail className="h-[16px] w-[16px] text-[#1D9E75] shrink-0 mt-0.5" />
                  <span>A confirmation email is on its way. Check your spam folder if you do not see it within 10 minutes.</span>
                </div>
                <div className="flex items-start gap-2.5 p-2.5 bg-[#161B25] border border-[#2A3347] rounded-lg text-xs leading-relaxed text-[#9BA3B8]">
                  <User className="h-[16px] w-[16px] text-[#85B7EB] shrink-0 mt-0.5" />
                  <span>Share EduBlast with classmates or students across India. Each person you refer who joins the waitlist strengthens your ambassador application.</span>
                </div>
              </div>

              {(role === "student" || role === "teacher") && (
                <div className="bg-[#171425] border border-[#534AB7] rounded-xl p-3.5 max-w-[420px] mx-auto text-left space-y-1 mb-6 shadow-sm">
                  <p className="text-[13px] font-semibold text-[#AFA9EC]" id="ty-amb-title">
                    {(role === "student" ? "Student" : "Teacher")} Ambassador pathway — what happens next
                  </p>
                  <p className="text-xs text-[#AFA9EC]/80 leading-relaxed" id="ty-amb-sub">
                    Your application has been flagged for ambassador consideration. We will call your registered mobile within 3 business days to verify your details. If selected, you will receive an early access invitation before public launch. Keep your daily activity high after launch — 3 months of consistent use, 5 referrals, and a 30-minute interview with the EduBlast team qualifies you for a paid Ambassador position.
                  </p>
                </div>
              )}

              <Link
                href="/"
                className="inline-flex items-center gap-2 bg-[#1C2333] hover:bg-[#222A3A] text-white border border-[#2A3347] rounded-full px-6 py-2 text-xs font-semibold cursor-pointer transition shadow-md"
              >
                <ArrowLeft className="h-4 w-4" />
                Back to Home
              </Link>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

export default function WaitlistPage() {
  return (
    <Suspense fallback={
      <div className="min-h-screen bg-[#0E1117] text-[#E8EAF0] flex items-center justify-center font-sans">
        <div className="animate-pulse flex flex-col items-center gap-3">
          <div className="w-10 h-10 rounded-full bg-[#1D9E75]/20 border border-[#1D9E75] flex items-center justify-center">
            <span className="text-[#1D9E75] font-bold">E</span>
          </div>
          <span className="text-xs text-[#9BA3B8]">Loading waitlist...</span>
        </div>
      </div>
    }>
      <WaitlistContent />
    </Suspense>
  );
}
