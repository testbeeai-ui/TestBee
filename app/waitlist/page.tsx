"use client";

import React, { useState, useEffect, Suspense, useRef } from "react";
import Link from "next/link";
import Image from "next/image";
import { useSearchParams } from "next/navigation";
import { cn } from "@/lib/utils";
import { QuickWaitlistForm } from "@/components/waitlist/QuickWaitlistForm";
import { AmbassadorSidePanel } from "@/components/waitlist/AmbassadorSidePanel";
import { AmbassadorApplicationModal } from "@/components/waitlist/AmbassadorApplicationModal";
import { WAITLIST_INTERESTS } from "@/components/waitlist/waitlist-constants";
import { formatApiError } from "@/lib/waitlist/formatApiError";
import { normalizeIndianMobile } from "@/lib/waitlist/phone";
import {
  Rocket,
  Star,
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
  Mail,
} from "lucide-react";

function WaitlistContent() {
  const searchParams = useSearchParams();
  const [role, setRole] = useState<string | null>("student");
  const step2Ref = useRef<HTMLDivElement>(null);
  const [ambassadorModalOpen, setAmbassadorModalOpen] = useState(false);
  const pendingRoleRef = useRef<string | null>(null);

  const [step1Complete, setStep1Complete] = useState(false);
  const [ambassadorSubmitted, setAmbassadorSubmitted] = useState(false);
  const [waitlistId, setWaitlistId] = useState("");
  const [quickEmail, setQuickEmail] = useState("");
  const [quickPhone, setQuickPhone] = useState("");
  const [dynamicJoinedCount, setDynamicJoinedCount] = useState(247);

  useEffect(() => {
    const r = searchParams.get("role");
    if (r && ["student", "teacher", "parent", "other"].includes(r)) {
      pendingRoleRef.current = r;
      setRole(r);
    }
  }, [searchParams]);

  useEffect(() => {
    fetch("/api/waitlist")
      .then((res) => res.json())
      .then((data) => {
        if (data.ok && data.nextId) {
          const num = parseInt(data.nextId.replace("EB-2026-", ""), 10);
          if (!isNaN(num)) {
            setDynamicJoinedCount(num + 30);
          }
        }
      })
      .catch((err) => console.error("[WaitlistPage] Failed to fetch stats:", err));
  }, []);

  const [firstName, setFirstName] = useState("");
  const [lastName, setLastName] = useState("");
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
    if (!role || !step1Complete) {
      setProgress(4);
      return;
    }
    let sc = 10;
    if (firstName.trim()) sc += 8;
    if (lastName.trim()) sc += 5;
    if (quickEmail.trim()) sc += 8;
    if (quickPhone.trim()) sc += 8;
    if (city.trim()) sc += 5;
    if (state.trim()) sc += 5;
    if (selectedInterests.length > 0) sc += 7;
    if (whyJoin.trim()) sc += 10;
    if (referral) sc += 5;
    if (c1) sc += 10;
    if (c2) sc += 10;

    setProgress(Math.min(100, sc));
  }, [
    step1Complete,
    role,
    firstName,
    lastName,
    quickEmail,
    quickPhone,
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
    step1Complete &&
    role &&
    firstName.trim() &&
    lastName.trim() &&
    quickEmail.trim() &&
    normalizeIndianMobile(quickPhone).ok &&
    city.trim() &&
    state.trim() &&
    c1 &&
    c2;

  const handleStep1Success = (id: string) => {
    setWaitlistId(id);
    setStep1Complete(true);
    const num = parseInt(id.replace("EB-2026-", ""), 10);
    if (!isNaN(num)) {
      setDynamicJoinedCount(num + 31);
    }
    const nextRole = pendingRoleRef.current ?? "student";
    setRole(nextRole);
    setTimeout(() => {
      step2Ref.current?.scrollIntoView({ behavior: "smooth", block: "start" });
    }, 300);
  };

  const focusStep1Email = () => {
    document.getElementById("wl-email")?.focus();
    step2Ref.current?.scrollIntoView({ behavior: "smooth", block: "start" });
  };

  const handleRegisterAmbassador = () => {
    if (!role) return;
    setAmbassadorModalOpen(true);
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!isFormValid) return;
    setSubmitting(true);
    setSubmitError("");

    const mobile = normalizeIndianMobile(quickPhone);
    if (!mobile.ok) {
      setSubmitError(mobile.error);
      return;
    }

    try {
      const res = await fetch("/api/waitlist", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          signupTier: "ambassador",
          waitlistId,
          role,
          firstName,
          lastName,
          email: quickEmail,
          phone: mobile.phone,
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
        throw new Error(
          formatApiError(data.error, "Failed to submit. Please try again.")
        );
      }

      setWaitlistId(data.waitlistId);
      setAmbassadorModalOpen(false);
      setAmbassadorSubmitted(true);
      setProgress(100);
      window.scrollTo({ top: 0, behavior: "smooth" });
    } catch (err: unknown) {
      setSubmitError(
        err instanceof Error
          ? err.message
          : "Failed to submit application. Please check your network connection."
      );
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <div className="min-h-screen bg-[#0D1117] pb-8 text-[13px] text-[#E8EAF0] font-sans selection:bg-[#1D9E75]/30 sm:pb-12">
      {!ambassadorSubmitted && (
        <div className="flex flex-col gap-2 bg-[#1D9E75] px-4 py-[11px] sm:flex-row sm:items-center sm:gap-2.5 sm:px-12">
          <Rocket className="hidden h-[18px] w-[18px] shrink-0 text-white/70 sm:block" />
          <div className="min-w-0 flex-1">
            <div className="text-sm font-medium leading-snug text-white">
              Act NOW! Join the waitlist &amp; qualify as a paid Ambassador
            </div>
            <div className="mt-px text-xs text-white/80">
              Limited seats · early access · real rewards · India-wide launch coming soon
            </div>
          </div>
          <button
            type="button"
            onClick={focusStep1Email}
            className="shrink-0 self-start rounded-full border-0 bg-white px-[18px] py-[7px] text-xs font-medium text-[#0F6E56] transition-colors hover:bg-[#9FE1CB] sm:ml-auto sm:self-center"
          >
            Claim my spot
          </button>
        </div>
      )}

      <div id="main-view" className="animate-in fade-in duration-200">
          <div className="grid grid-cols-[1fr_auto_1fr] items-center border-b border-[#2A3347]/50 px-4 py-3.5 sm:px-12">
            <Link href="/" className="justify-self-start">
              <Image
                src="/images/logo-2.png"
                alt="EduBlast Logo"
                width={160}
                height={36}
                priority
                draggable={false}
                className="h-8 w-auto sm:h-9"
              />
            </Link>
            <div className="hidden justify-self-center sm:inline-flex sm:items-center sm:gap-1.5 sm:rounded-full sm:border sm:border-[#EF9F27] sm:bg-[#281C08] sm:px-3.5 sm:py-1 sm:text-[11px] sm:font-medium sm:text-[#FAC775]">
              <span className="h-1.5 w-1.5 animate-pulse rounded-full bg-[#EF9F27]" />
              <span className="hidden md:inline">Launching across India — sign up now</span>
              <span className="md:hidden">Launching across India</span>
            </div>
            <Link
              href="/"
              className="inline-flex items-center gap-1.5 justify-self-end text-xs text-[#5C6480] transition hover:text-[#9BA3B8]"
            >
              <ArrowLeft className="h-3.5 w-3.5" />
              <span className="hidden sm:inline">Back to menu</span>
              <span className="sm:hidden">Back</span>
            </Link>
          </div>

          <div className="flex justify-center px-4 pb-3 sm:hidden">
            <div className="inline-flex items-center gap-1.5 rounded-full border border-[#EF9F27] bg-[#281C08] px-3.5 py-1 text-[11px] font-medium text-[#FAC775]">
              <span className="h-1.5 w-1.5 animate-pulse rounded-full bg-[#EF9F27]" />
              Launching across India — sign up now
            </div>
          </div>

          <div className="px-4 sm:px-12">
            <div className="hero flex flex-col items-center px-2 pb-3 pt-6 text-center sm:px-4 sm:pb-4 sm:pt-6">
              <h1 className="mb-1.5 text-xl font-medium leading-snug text-white sm:mb-2 sm:text-2xl">
                The social platform that makes
                <br />
                PCM students love studying
              </h1>
              <p className="max-w-[500px] text-[13px] leading-relaxed text-[#9BA3B8]">
                EduBlast is the education social media for PUC 1 and 2 students — learn by
                scrolling, earn rewards, get real exam prep, and qualify for EduFund grants.
              </p>
            </div>

            <div
              ref={step2Ref}
              className="cols-wrap mb-6 grid grid-cols-1 items-start gap-4 md:grid-cols-2 md:pb-8"
            >
              <QuickWaitlistForm
                email={quickEmail}
                phone={quickPhone}
                onEmailChange={setQuickEmail}
                onPhoneChange={setQuickPhone}
                onSuccess={handleStep1Success}
                completed={step1Complete}
                emailInputId="wl-email"
                waitlistJoined={dynamicJoinedCount}
                waitlistId={waitlistId}
              />
              <AmbassadorSidePanel
                step1Complete={step1Complete}
                role={role}
                onRoleChange={handleRoleChange}
                onRegisterClick={handleRegisterAmbassador}
                onFocusStep1={focusStep1Email}
                completed={ambassadorSubmitted}
                waitlistId={waitlistId}
                waitlistJoined={dynamicJoinedCount}
              />
            </div>

            <AmbassadorApplicationModal
              open={ambassadorModalOpen && !!role && step1Complete}
              onOpenChange={setAmbassadorModalOpen}
              role={role}
              progress={progress}
            >
              {role && (
                <form id="ambassador" onSubmit={handleSubmit} className="space-y-4">

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
                        <span className="text-xs text-[#9BA3B8]">Email address</span>
                        <div className="w-full bg-[#1C2333]/60 border border-[#2A3347] rounded-lg px-3 py-2 text-sm text-[#9BA3B8]">
                          {quickEmail}
                        </div>
                      </div>
                      <div className="flex flex-col gap-1">
                        <span className="text-xs text-[#9BA3B8]">Mobile number</span>
                        <div className="w-full bg-[#1C2333]/60 border border-[#2A3347] rounded-lg px-3 py-2 text-sm text-[#9BA3B8]">
                          {quickPhone}
                        </div>
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
                      {WAITLIST_INTERESTS[role]?.map((item) => {
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
                        Why do you want to join early?
                      </span>
                      <textarea
                        placeholder="Tell us what excites you about EduBlast and what you hope to contribute as an early tester or ambassador..."
                        value={whyJoin}
                        onChange={(e) => setWhyJoin(e.target.value)}
                        className="w-full bg-[#1C2333] border border-[#2A3347] focus:border-[#1D9E75] rounded-lg px-3 py-2.5 text-xs text-white outline-none min-h-[80px] transition"
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
                    Apply for Ambassador
                  </button>
                  <p className="text-[11px] text-[#5C6480] text-center flex items-center justify-center gap-1.5">
                    <Lock className="h-3.5 w-3.5 shrink-0" />
                    Your data is kept private and used only for waitlist management. No spam.
                  </p>
                </form>
              )}
            </AmbassadorApplicationModal>
          </div>
        </div>
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
