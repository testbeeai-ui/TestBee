"use client";

export const dynamic = "force-dynamic";

import { Suspense, useMemo, useState } from "react";
import Link from "next/link";
import AppLayout from "@/components/AppLayout";
import { useAuth } from "@/hooks/useAuth";
import { useSearchParams } from "next/navigation";
import {
  AlertTriangle,
  Check,
  Clock3,
  Mail,
  MapPin,
  MessageSquare,
  Phone,
  Star,
} from "lucide-react";
import LandingNavbar from "@/components/landing/LandingNavbar";
import { INVESTOR_NAV_LINKS } from "@/components/landing/landing-constants";

type ContactCategory = "sales" | "issue" | "comment" | null;

type FollowUp = "yes" | "no" | "";

type ContactFormState = {
  name: string;
  email: string;
  phone: string;
  role: string;

  salesType: string;
  salesOrg: string;
  salesCount: string;
  salesCity: string;
  salesMsg: string;

  issueMenu: string;
  issueClass: string;
  issueSubject: string;
  issuePlatform: string;
  issueDesc: string;
  issueSteps: string;

  commType: string;
  commFeature: string;
  commClass: string;
  commSubject: string;
  commMsg: string;
  followUp: FollowUp;
};

const INITIAL_FORM: ContactFormState = {
  name: "",
  email: "",
  phone: "",
  role: "",
  salesType: "",
  salesOrg: "",
  salesCount: "",
  salesCity: "",
  salesMsg: "",
  issueMenu: "",
  issueClass: "",
  issueSubject: "",
  issuePlatform: "",
  issueDesc: "",
  issueSteps: "",
  commType: "",
  commFeature: "",
  commClass: "",
  commSubject: "",
  commMsg: "",
  followUp: "",
};

export default function ContactPage() {
  const { user, profile, loading } = useAuth();
  const isInAppShell = !loading && !!user && !!profile?.onboarding_complete;

  if (isInAppShell) {
    return (
      <AppLayout>
        <Suspense fallback={<ContactPageFallback />}>
          <ContactPageBody showLandingNav={false} />
        </Suspense>
      </AppLayout>
    );
  }

  return (
    <Suspense fallback={<ContactPageFallback />}>
      <ContactPageBody showLandingNav={true} />
    </Suspense>
  );
}

function ContactPageFallback() {
  return <div className="min-h-screen bg-[#0a0a14]" />;
}

function ContactPageBody({ showLandingNav }: { showLandingNav: boolean }) {
  const searchParams = useSearchParams();
  const [cat, setCat] = useState<ContactCategory>(null);
  const [form, setForm] = useState<ContactFormState>(INITIAL_FORM);
  const [severity, setSeverity] = useState("");
  const [priority, setPriority] = useState("");
  const [submitted, setSubmitted] = useState(false);
  const [ticketId, setTicketId] = useState("");

  const progress = useMemo(() => {
    if (!cat) return 12;
    let p = 22;
    if (form.name.trim()) p += 13;
    if (form.email.trim()) p += 13;
    if (form.role) p += 8;

    if (cat === "sales") {
      if (form.salesType) p += 17;
      if (form.salesMsg.trim().length > 20) p += 27;
    } else if (cat === "issue") {
      if (form.issueMenu) p += 12;
      if (form.issueDesc.trim().length > 20) p += 14;
      if (severity) p += 11;
    } else if (cat === "comment") {
      if (form.commType) p += 10;
      if (form.commFeature) p += 10;
      if (form.commMsg.trim().length > 20) p += 14;
    }

    return Math.min(p, 100);
  }, [cat, form, severity]);

  const showPlatformField =
    form.issueMenu.includes("slowly") ||
    form.issueMenu.includes("loading") ||
    form.issueMenu.includes("playing") ||
    form.issueMenu.includes("App");

  const update = <K extends keyof ContactFormState>(key: K, value: ContactFormState[K]) => {
    setForm((prev) => ({ ...prev, [key]: value }));
  };

  const resetForm = () => {
    setCat(null);
    setForm(INITIAL_FORM);
    setSeverity("");
    setPriority("");
    setSubmitted(false);
    setTicketId("");
  };

  const submit = () => {
    if (!cat || !form.name.trim() || !form.email.trim() || !form.role) return;
    if (cat === "sales" && (!form.salesType || form.salesMsg.trim().length < 20)) return;
    if (cat === "issue" && (!form.issueMenu || !severity || form.issueDesc.trim().length < 20)) return;
    if (cat === "comment" && (!form.commType || !form.commFeature || form.commMsg.trim().length < 20))
      return;

    setTicketId(`EB-2026-${Math.floor(Math.random() * 9000 + 1000)}`);
    setSubmitted(true);
  };

  const successCopy = (() => {
    if (cat === "sales") {
      return {
        title: "Partnership enquiry received",
        desc: "Our business team will review your details and respond within 2 business days. Please save your ticket ID for reference.",
      };
    }
    if (cat === "issue") {
      return {
        title: "Issue report submitted",
        desc: "Our technical team will investigate and update you within 24 hours. Please save your ticket ID for follow-up.",
      };
    }
    return {
      title: "Feedback recorded — thank you",
      desc: "Every piece of feedback helps make EduBlast better for 38,000 students. We will follow up if you requested it.",
    };
  })();

  const submitTheme =
    cat === "issue"
      ? "bg-[#e8553a] hover:bg-[#b03020] text-white"
      : cat === "comment"
        ? "bg-[#7c6bff] hover:bg-[#4035c0] text-white"
        : "bg-[#0fba8a] hover:bg-[#0a8a64] text-[#041a12]";

  const topLineColor =
    cat === "issue" ? "#e8553a" : cat === "comment" ? "#7c6bff" : "#0fba8a";
  const topLineWidth = cat ? "100%" : `${progress}%`;
  const fromParam = searchParams.get("from");

  const safeFromPath =
    !showLandingNav && fromParam && fromParam.startsWith("/") && !fromParam.startsWith("//")
      ? fromParam
      : "/home";

  const inAppFromLabel = (() => {
    if (safeFromPath === "/home") return "Dashboard";
    if (safeFromPath === "/magic-wall") return "Magic Wall";
    if (safeFromPath === "/explore-1") return "Lessons";
    if (safeFromPath === "/mock") return "Prep + Mock";
    if (safeFromPath === "/doubts") return "Gyan++";
    if (safeFromPath === "/edufund") return "EduFund";
    if (safeFromPath === "/refer-earn") return "Refer & Earn";
    if (safeFromPath === "/profile") return "Profile";
    return "Back";
  })();

  return (
    <div className={`${showLandingNav ? "min-h-screen" : ""} bg-[#0a0a14] text-[#f0f0fa]`}>
      {showLandingNav ? <LandingNavbar variant="dark" navLinks={INVESTOR_NAV_LINKS} /> : null}

      <div className={`mx-auto max-w-[1100px] ${showLandingNav ? "p-4 md:p-6" : "pt-2 pb-4"}`}>
        <div className="overflow-hidden rounded-2xl border border-white/10 bg-[#0f0f1c]">
          <div className="flex items-center gap-2 border-b border-white/10 bg-[#0a0a14] px-5 py-2.5 text-xs">
            {showLandingNav ? (
              <Link href="/" className="text-white/40 transition-colors hover:text-white/80">
                Home
              </Link>
            ) : (
              <Link href={safeFromPath} className="text-white/40 transition-colors hover:text-white/80">
                {inAppFromLabel}
              </Link>
            )}
            <span className="text-white/30">›</span>
            <span className="font-medium text-[#0fba8a]">Contact us</span>
          </div>

          <div className="grid md:grid-cols-[268px_1fr]">
            <aside className="border-r border-white/10 bg-[#0a0a14] p-4 md:p-5">
              <p className="mb-4 text-[10.5px] uppercase tracking-[0.1em] text-white/20">Ways to reach us</p>

              <div className="mb-2 rounded-xl border border-white/10 bg-[#161627] p-3">
                <div className="mb-2 inline-flex h-8 w-8 items-center justify-center rounded-lg bg-[#0fba8a]/10">
                  <Mail className="h-4 w-4 text-[#0fba8a]" />
                </div>
                <p className="text-[11px] text-white/35">Email us</p>
                <a className="text-sm text-[#0fba8a] hover:underline" href="mailto:support@edublast.in">
                  support@edublast.in
                </a>
              </div>

              <div className="mb-2 rounded-xl border border-white/10 bg-[#161627] p-3">
                <div className="mb-2 inline-flex h-8 w-8 items-center justify-center rounded-lg bg-[#f5a623]/10">
                  <Clock3 className="h-4 w-4 text-[#f5a623]" />
                </div>
                <p className="text-[11px] text-white/35">Business hours</p>
                <p className="text-sm text-white">Mon–Sat · 9 am–7 pm IST</p>
              </div>

              <div className="mb-4 rounded-xl border border-white/10 bg-[#161627] p-3">
                <div className="mb-2 inline-flex h-8 w-8 items-center justify-center rounded-lg bg-[#7c6bff]/10">
                  <MessageSquare className="h-4 w-4 text-[#7c6bff]" />
                </div>
                <p className="text-[11px] text-white/35">Partnership enquiries</p>
                <a className="text-sm text-[#0fba8a] hover:underline" href="mailto:lsn@eyemagnett.in">
                  lsn@eyemagnett.in
                </a>
              </div>

              <div className="mb-4 border-t border-white/10" />

              <div className="mb-4 flex items-center gap-2 rounded-lg border border-[#0fba8a]/25 bg-[#0fba8a]/10 px-3 py-2 text-xs text-[#0fba8a]">
                <span className="h-1.5 w-1.5 rounded-full bg-[#0fba8a]" />
                Typical reply within <strong>24 hours</strong>
              </div>

              <div className="mb-4 border-t border-white/10" />
              <p className="mb-2 text-[10.5px] uppercase tracking-[0.1em] text-white/20">Office</p>
              <div className="mb-2 flex items-start gap-2 text-sm text-white/50">
                <MapPin className="mt-0.5 h-4 w-4" />
                <p>
                  Bengaluru, Karnataka
                  <br />
                  India — 560001
                </p>
              </div>
              <div className="flex items-center gap-2 text-sm text-white/50">
                <Phone className="h-4 w-4" />
                +91 78423 69939
              </div>
              <p className="mt-4 text-xs leading-relaxed text-white/35">
                For institutional or bulk-enrolment partnerships, use the{" "}
                <span className="text-[#0fba8a]">Sales or Partner</span> category. Our business team responds within 2
                business days.
              </p>
            </aside>

            <main className="bg-[#0f0f1c] p-5 md:p-7">
              <div className="mb-6 h-[2px] rounded bg-white/10">
                <div
                  className="h-full rounded transition-all"
                  style={{ width: topLineWidth, backgroundColor: topLineColor }}
                />
              </div>

              {!submitted ? (
                <>
                  <h1 className="text-3xl font-semibold">How can we help you?</h1>
                  <p className="mt-2 mb-5 max-w-3xl text-sm leading-relaxed text-white/60">
                    Choose a category, fill in the relevant details, and hit send. Every query is reviewed by our team
                    and routed to the right person.
                  </p>

                  <p className="mb-2 text-[10.5px] uppercase tracking-[0.09em] text-white/20">
                    Enquiry type <span className="text-[#e8553a]">*</span>
                  </p>
                  <div className="mb-6 grid gap-2 sm:grid-cols-3">
                    <button
                      type="button"
                      onClick={() => setCat("sales")}
                      className={`rounded-xl border p-3 text-center transition ${cat === "sales" ? "border-[#0fba8a]/45 bg-[#0fba8a]/10" : "border-white/10 bg-[#161627] hover:border-white/20"}`}
                    >
                      <div className="mx-auto mb-2 flex h-9 w-9 items-center justify-center rounded-lg bg-[#0fba8a]/10">
                        <Star className="h-4 w-4 text-[#0fba8a]" />
                      </div>
                      <p className="text-sm font-medium">Sales or partner</p>
                      <p className="mt-1 text-xs text-white/35">Bulk enrolments, coaching partnerships, B2B, institutional tie-ups</p>
                    </button>
                    <button
                      type="button"
                      onClick={() => setCat("issue")}
                      className={`rounded-xl border p-3 text-center transition ${cat === "issue" ? "border-[#e8553a]/45 bg-[#e8553a]/10" : "border-white/10 bg-[#161627] hover:border-white/20"}`}
                    >
                      <div className="mx-auto mb-2 flex h-9 w-9 items-center justify-center rounded-lg bg-[#e8553a]/10">
                        <AlertTriangle className="h-4 w-4 text-[#e8553a]" />
                      </div>
                      <p className="text-sm font-medium">Issue faced</p>
                      <p className="mt-1 text-xs text-white/35">Bug, login problem, payment error, content mistake, or feature not working</p>
                    </button>
                    <button
                      type="button"
                      onClick={() => setCat("comment")}
                      className={`rounded-xl border p-3 text-center transition ${cat === "comment" ? "border-[#7c6bff]/45 bg-[#7c6bff]/10" : "border-white/10 bg-[#161627] hover:border-white/20"}`}
                    >
                      <div className="mx-auto mb-2 flex h-9 w-9 items-center justify-center rounded-lg bg-[#7c6bff]/10">
                        <MessageSquare className="h-4 w-4 text-[#7c6bff]" />
                      </div>
                      <p className="text-sm font-medium">Comment or suggestion</p>
                      <p className="mt-1 text-xs text-white/35">Feedback, feature request, content gap, improvement idea, or compliment</p>
                    </button>
                  </div>

                  {cat && (
                    <>
                      <p className="mb-3 text-[10.5px] uppercase tracking-[0.09em] text-white/20">Your details</p>
                      <div className="mb-3 grid gap-3 sm:grid-cols-2">
                        <Field label="Full name" required>
                          <Input value={form.name} onChange={(v) => update("name", v)} placeholder="e.g. Priya Mehta" />
                        </Field>
                        <Field label="Email address" required>
                          <Input value={form.email} onChange={(v) => update("email", v)} placeholder="you@example.com" />
                        </Field>
                      </div>
                      <div className="mb-4 grid gap-3 sm:grid-cols-2">
                        <Field label="Phone number">
                          <Input value={form.phone} onChange={(v) => update("phone", v)} placeholder="+91 98765 43210" />
                        </Field>
                        <Field label="Your role" required>
                          <Select value={form.role} onChange={(v) => update("role", v)}>
                            <option value="">— Select your role —</option>
                            <option>Student — PUC 1</option>
                            <option>Student — PUC 2</option>
                            <option>Teacher / Educator</option>
                            <option>Parent / Guardian</option>
                            <option>Coaching Centre / Partner</option>
                            <option>Other</option>
                          </Select>
                        </Field>
                      </div>
                    </>
                  )}

                  {cat === "sales" && (
                    <div className="mb-4 rounded-2xl border border-white/10 bg-[#0a0a14] p-4">
                      <SectionHeader
                        title="Sales and partnership details"
                        icon={<Star className="h-4 w-4 text-[#0fba8a]" />}
                        pillText="Business enquiry"
                        pillClass="bg-[#0fba8a]/10 text-[#0fba8a]"
                      />

                      <Field label="Type of partnership" required>
                        <Select value={form.salesType} onChange={(v) => update("salesType", v)}>
                          <option value="">— Select type —</option>
                          <option>Bulk student enrolment (coaching centre)</option>
                          <option>School or college tie-up</option>
                          <option>Teacher onboarding and ambassador programme</option>
                          <option>White-label EduBlast for your institute</option>
                          <option>Content partnership or guest educator</option>
                          <option>Corporate CSR or sponsorship</option>
                          <option>Investor or funding enquiry</option>
                          <option>Media and press</option>
                          <option>Other</option>
                        </Select>
                      </Field>

                      <div className="mt-3 grid gap-3 sm:grid-cols-2">
                        <Field label="Organisation / Institute name">
                          <Input value={form.salesOrg} onChange={(v) => update("salesOrg", v)} placeholder="e.g. Brilliant Coaching Centre" />
                        </Field>
                        <Field label="Approximate student count">
                          <Select value={form.salesCount} onChange={(v) => update("salesCount", v)}>
                            <option value="">— Select range —</option>
                            <option>1–25 students</option>
                            <option>26–100 students</option>
                            <option>101–500 students</option>
                            <option>500+ students</option>
                            <option>Not applicable</option>
                          </Select>
                        </Field>
                      </div>

                      <Field label="City / Location">
                        <Select value={form.salesCity} onChange={(v) => update("salesCity", v)}>
                          <option value="">— Select city —</option>
                          <option>Bengaluru</option>
                          <option>Mysuru</option>
                          <option>Mangaluru</option>
                          <option>Hubli-Dharwad</option>
                          <option>Belagavi</option>
                          <option>Shivamogga</option>
                          <option>Tumakuru</option>
                          <option>Other Karnataka city</option>
                          <option>Outside Karnataka</option>
                        </Select>
                      </Field>

                      <Field label="Message" required>
                        <Textarea
                          value={form.salesMsg}
                          onChange={(v) => update("salesMsg", v)}
                          placeholder="Tell us about your requirements, timelines, and how you would like to work together..."
                        />
                        <Count value={form.salesMsg} max={400} />
                      </Field>
                    </div>
                  )}

                  {cat === "issue" && (
                    <div className="mb-4 rounded-2xl border border-white/10 bg-[#0a0a14] p-4">
                      <SectionHeader
                        title="Issue details"
                        icon={<AlertTriangle className="h-4 w-4 text-[#e8553a]" />}
                        pillText="Report a problem"
                        pillClass="bg-[#e8553a]/10 text-[#e8553a]"
                      />

                      <Field label="Which section of EduBlast has the issue?" required>
                        <Select value={form.issueMenu} onChange={(v) => update("issueMenu", v)}>
                          <option value="">— Select a section —</option>
                          <optgroup label="Learning features">
                            <option>Gyan++ — AI Q&A wall (Magic Wall)</option>
                            <option>Testbee — Adaptive mock tests</option>
                            <option>Instacue — Spaced revision cards</option>
                            <option>MentaMill — Quant speed drill</option>
                            <option>DailyDose — Daily 5 questions</option>
                            <option>Play Arena — Academic or Funbrain</option>
                          </optgroup>
                          <optgroup label="Account and access">
                            <option>Login or signup problem</option>
                            <option>Password reset not working</option>
                            <option>Account details or profile</option>
                            <option>Notifications or alerts</option>
                          </optgroup>
                          <optgroup label="Payments and subscriptions">
                            <option>Payment failed or double charged</option>
                            <option>Subscription not activated</option>
                            <option>Refund request</option>
                          </optgroup>
                          <optgroup label="RDM and EduFund">
                            <option>RDM not credited after action</option>
                            <option>EduFund tier not unlocking</option>
                            <option>Referral RDM not received</option>
                          </optgroup>
                          <optgroup label="Content issues">
                            <option>Wrong answer or explanation in Q&amp;A</option>
                            <option>Incorrect mock question content</option>
                            <option>Study material error or missing content</option>
                          </optgroup>
                          <optgroup label="Performance">
                            <option>App running slowly or crashing</option>
                            <option>Page not loading</option>
                            <option>Video not playing</option>
                          </optgroup>
                          <option>Something else</option>
                        </Select>
                      </Field>

                      <div className="mt-3 grid gap-3 sm:grid-cols-2">
                        <Field label="Class / PUC level">
                          <Select value={form.issueClass} onChange={(v) => update("issueClass", v)}>
                            <option value="">— Select —</option>
                            <option>PUC 1 (Class 11)</option>
                            <option>PUC 2 (Class 12)</option>
                            <option>Not applicable</option>
                          </Select>
                        </Field>
                        <Field label="Subject (if applicable)">
                          <Select value={form.issueSubject} onChange={(v) => update("issueSubject", v)}>
                            <option value="">— Select subject —</option>
                            <option>Physics</option>
                            <option>Chemistry</option>
                            <option>Mathematics</option>
                            <option>All subjects</option>
                            <option>Not subject-specific</option>
                          </Select>
                        </Field>
                      </div>

                      {showPlatformField && (
                        <Field label="Platform / Device">
                          <Select value={form.issuePlatform} onChange={(v) => update("issuePlatform", v)}>
                            <option value="">— Select —</option>
                            <option>Android app</option>
                            <option>iOS app</option>
                            <option>Website (Chrome)</option>
                            <option>Website (Safari)</option>
                            <option>Website (other browser)</option>
                          </Select>
                        </Field>
                      )}

                      <Field label="Severity" required>
                        <div className="flex flex-wrap gap-2">
                          {[
                            "Minor — slight inconvenience",
                            "Moderate — affects my study",
                            "Severe — cannot use EduBlast",
                          ].map((x) => (
                            <button
                              key={x}
                              type="button"
                              onClick={() => setSeverity(x)}
                              className={`rounded-full border px-3 py-1.5 text-xs transition ${severity === x ? "border-[#e8553a]/50 bg-[#e8553a]/10 text-[#f09383]" : "border-white/10 bg-[#161627] text-white/60 hover:border-white/20 hover:text-white"}`}
                            >
                              {x}
                            </button>
                          ))}
                        </div>
                      </Field>

                      <Field label="Describe the issue" required>
                        <Textarea
                          value={form.issueDesc}
                          onChange={(v) => update("issueDesc", v)}
                          placeholder="What happened? What did you expect to see? Any error messages you noticed..."
                        />
                        <Count value={form.issueDesc} max={600} />
                      </Field>

                      <Field label="Steps to reproduce (optional)">
                        <Textarea
                          value={form.issueSteps}
                          onChange={(v) => update("issueSteps", v)}
                          rows={3}
                          placeholder={"1. I opened the Testbee mock section\n2. I clicked Start mock\n3. The page went blank..."}
                        />
                      </Field>
                    </div>
                  )}

                  {cat === "comment" && (
                    <div className="mb-4 rounded-2xl border border-white/10 bg-[#0a0a14] p-4">
                      <SectionHeader
                        title="Feedback details"
                        icon={<MessageSquare className="h-4 w-4 text-[#7c6bff]" />}
                        pillText="Feedback & ideas"
                        pillClass="bg-[#7c6bff]/10 text-[#7c6bff]"
                      />

                      <Field label="Type of feedback" required>
                        <Select value={form.commType} onChange={(v) => update("commType", v)}>
                          <option value="">— Select type —</option>
                          <option>Feature request — I want EduBlast to add something</option>
                          <option>Content gap — topic or subject not covered</option>
                          <option>UI / UX improvement — something is confusing or hard to use</option>
                          <option>Positive feedback — something that worked really well</option>
                          <option>Curriculum feedback — mock or question quality</option>
                          <option>RDM or EduFund suggestion</option>
                          <option>Teacher or mentor experience feedback</option>
                          <option>General idea or improvement</option>
                        </Select>
                      </Field>

                      <Field label="Which EduBlast feature does this relate to?" required>
                        <Select value={form.commFeature} onChange={(v) => update("commFeature", v)}>
                          <option value="">— Select a section —</option>
                          <optgroup label="Learning features">
                            <option>Gyan++ — Magic Wall (AI Q&amp;A)</option>
                            <option>Testbee — Adaptive mocks</option>
                            <option>Instacue — Spaced revision</option>
                            <option>MentaMill — Quant speed drill</option>
                            <option>DailyDose — Daily 5 questions</option>
                            <option>Play Arena — Academic or Funbrain</option>
                            <option>Live classes</option>
                          </optgroup>
                          <optgroup label="Platform">
                            <option>Home / Feed / Leaderboard</option>
                            <option>Profile and dashboard</option>
                            <option>RDM earning and tracking</option>
                            <option>EduFund grants section</option>
                            <option>Notifications</option>
                            <option>Mobile app experience</option>
                          </optgroup>
                          <option>EduBlast overall / general</option>
                          <option>Not feature-specific</option>
                        </Select>
                      </Field>

                      <div className="mt-3 grid gap-3 sm:grid-cols-2">
                        <Field label="Class / PUC level">
                          <Select value={form.commClass} onChange={(v) => update("commClass", v)}>
                            <option value="">— Select —</option>
                            <option>PUC 1 (Class 11)</option>
                            <option>PUC 2 (Class 12)</option>
                            <option>Not applicable</option>
                          </Select>
                        </Field>
                        <Field label="Subject (if applicable)">
                          <Select value={form.commSubject} onChange={(v) => update("commSubject", v)}>
                            <option value="">— Select subject —</option>
                            <option>Physics</option>
                            <option>Chemistry</option>
                            <option>Mathematics</option>
                            <option>All subjects</option>
                            <option>Not subject-specific</option>
                          </Select>
                        </Field>
                      </div>

                      <Field label="Priority for you">
                        <div className="flex flex-wrap gap-2">
                          {["Nice to have", "Would improve my experience", "Essential — please add this"].map((x) => (
                            <button
                              key={x}
                              type="button"
                              onClick={() => setPriority(x)}
                              className={`rounded-full border px-3 py-1.5 text-xs transition ${priority === x ? "border-[#7c6bff]/50 bg-[#7c6bff]/10 text-[#b4aaff]" : "border-white/10 bg-[#161627] text-white/60 hover:border-white/20 hover:text-white"}`}
                            >
                              {x}
                            </button>
                          ))}
                        </div>
                      </Field>

                      <Field label="Your comment or suggestion" required>
                        <Textarea
                          value={form.commMsg}
                          onChange={(v) => update("commMsg", v)}
                          rows={5}
                          placeholder="Describe your idea, feedback, or suggestion in as much detail as you like. The more context you give, the better we can act on it..."
                        />
                        <Count value={form.commMsg} max={800} />
                      </Field>

                      <Field label="Would you like us to follow up?">
                        <div className="flex flex-wrap gap-4 text-sm text-white/70">
                          <label className="flex items-center gap-2">
                            <input
                              type="radio"
                              checked={form.followUp === "yes"}
                              onChange={() => update("followUp", "yes")}
                            />
                            Yes, please reply to my email
                          </label>
                          <label className="flex items-center gap-2">
                            <input type="radio" checked={form.followUp === "no"} onChange={() => update("followUp", "no")} />
                            No follow-up needed
                          </label>
                        </div>
                      </Field>
                    </div>
                  )}

                  {cat && (
                    <div className="mt-2 flex flex-wrap items-center justify-between gap-4 border-t border-white/10 pt-4">
                      <p className="max-w-xs text-xs leading-relaxed text-white/25">
                        By submitting this form you agree to our privacy policy. We will never share your details with
                        third parties.
                      </p>
                      <div className="flex items-center gap-2">
                        <button
                          type="button"
                          className="rounded-full border border-white/20 px-5 py-2 text-sm text-white/70 transition hover:border-white/35 hover:text-white"
                          onClick={resetForm}
                        >
                          Clear form
                        </button>
                        <button
                          type="button"
                          className={`inline-flex items-center gap-2 rounded-full px-5 py-2 text-sm font-medium transition hover:-translate-y-0.5 ${submitTheme}`}
                          onClick={submit}
                        >
                          Send message
                        </button>
                      </div>
                    </div>
                  )}
                </>
              ) : (
                <div className="py-8 text-center md:py-14">
                  <div className="mx-auto mb-4 flex h-14 w-14 items-center justify-center rounded-full border border-[#0fba8a]/35 bg-[#0fba8a]/10">
                    <Check className="h-6 w-6 text-[#0fba8a]" />
                  </div>
                  <h2 className="text-2xl font-semibold">{successCopy.title}</h2>
                  <p className="mx-auto mt-2 max-w-md text-sm leading-relaxed text-white/60">{successCopy.desc}</p>
                  <div className="mx-auto mt-5 inline-flex items-center gap-2 rounded-lg border border-white/15 bg-[#0a0a14] px-3 py-2 text-sm text-white/70">
                    Ticket ID: <span className="font-medium text-[#0fba8a]">{ticketId}</span>
                  </div>
                  <div className="mt-6 flex flex-wrap justify-center gap-2">
                    <button
                      type="button"
                      className="rounded-full bg-[#0fba8a] px-5 py-2 text-sm font-medium text-[#041a12] transition hover:bg-[#0a8a64]"
                      onClick={resetForm}
                    >
                      Submit another query
                    </button>
                    <Link
                      href="/"
                      className="rounded-full border border-white/20 px-5 py-2 text-sm text-white/70 transition hover:border-white/35 hover:text-white"
                    >
                      Back to EduBlast ↗
                    </Link>
                  </div>
                </div>
              )}
            </main>
          </div>
        </div>
      </div>
    </div>
  );
}

function SectionHeader({
  title,
  icon,
  pillText,
  pillClass,
}: {
  title: string;
  icon: React.ReactNode;
  pillText: string;
  pillClass: string;
}) {
  return (
    <div className="mb-4 flex items-center gap-2">
      {icon}
      <span className="text-xs uppercase tracking-[0.08em] text-white/45">{title}</span>
      <span className={`rounded px-2 py-0.5 text-[10px] font-medium ${pillClass}`}>{pillText}</span>
    </div>
  );
}

function Field({
  label,
  required,
  children,
}: {
  label: string;
  required?: boolean;
  children: React.ReactNode;
}) {
  return (
    <div className="mt-3">
      <label className="mb-1.5 block text-sm text-white/75">
        {label} {required ? <span className="text-[#e8553a]">*</span> : null}
      </label>
      {children}
    </div>
  );
}

function Input({
  value,
  onChange,
  placeholder,
}: {
  value: string;
  onChange: (v: string) => void;
  placeholder: string;
}) {
  return (
    <input
      className="w-full rounded-lg border border-white/15 bg-[#0a0a14] px-3 py-2 text-sm text-white outline-none transition focus:border-[#0fba8a] focus:ring-2 focus:ring-[#0fba8a]/20"
      value={value}
      onChange={(e) => onChange(e.target.value)}
      placeholder={placeholder}
    />
  );
}

function Select({
  value,
  onChange,
  children,
}: {
  value: string;
  onChange: (v: string) => void;
  children: React.ReactNode;
}) {
  return (
    <select
      className="w-full rounded-lg border border-white/15 bg-[#0a0a14] px-3 py-2 text-sm text-white outline-none transition focus:border-[#0fba8a] focus:ring-2 focus:ring-[#0fba8a]/20"
      value={value}
      onChange={(e) => onChange(e.target.value)}
    >
      {children}
    </select>
  );
}

function Textarea({
  value,
  onChange,
  placeholder,
  rows = 4,
}: {
  value: string;
  onChange: (v: string) => void;
  placeholder: string;
  rows?: number;
}) {
  return (
    <textarea
      rows={rows}
      className="w-full rounded-lg border border-white/15 bg-[#0a0a14] px-3 py-2 text-sm text-white outline-none transition focus:border-[#0fba8a] focus:ring-2 focus:ring-[#0fba8a]/20"
      value={value}
      onChange={(e) => onChange(e.target.value)}
      placeholder={placeholder}
    />
  );
}

function Count({ value, max }: { value: string; max: number }) {
  const warn = value.length > max * 0.88;
  return (
    <p className={`mt-1 text-right text-xs ${warn ? "text-[#e8553a]" : "text-white/25"}`}>
      {value.length} / {max}
    </p>
  );
}

