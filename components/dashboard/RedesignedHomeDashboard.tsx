"use client";

import { useEffect, useMemo, useState } from "react";
import Link from "next/link";
import { useRouter, useSearchParams } from "next/navigation";
import { useAuth } from "@/hooks/useAuth";
import { useSyncedUtcNowMs } from "@/hooks/useSyncedUtcNow";
import { useStudyStreakFromApi } from "@/hooks/useStudyStreakFromApi";
import { requestOpenSiteTourCarousel } from "@/lib/onboarding/openSiteTourCarousel";
import {
  getActiveStreakDayNumber,
  parseDailyStreakServerState,
} from "@/lib/onboarding/dailyChecklistTaskStorage";
import NotificationBell from "@/components/NotificationBell";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { CheckCircle2, Flame } from "lucide-react";
import { motion } from "framer-motion";
import styles from "./RedesignedHomeDashboard.module.css";

const TABLER_ICONS_HREF =
  "https://cdn.jsdelivr.net/npm/@tabler/icons-webfont@latest/dist/tabler-icons.min.css";

interface FeatureItem {
  i: string;
  t: string;
  s: string;
}

interface SubmenuData {
  icon: string;
  tag: string;
  title: string;
  sub: string;
  themeClass: string;
  chips: string[];
  col: {
    bg: string;
    bc: string;
    ic: string;
    tag: string;
    cta: string;
  };
  features: FeatureItem[];
}

const SUBMENU_DATA: Record<string, Record<string, SubmenuData>> = {
  info: {
    dashboard: {
      icon: "ti-layout-dashboard",
      tag: "Info",
      title: "My Dashboard",
      sub: "Your personal command centre - check in daily and see everything that matters at a glance.",
      themeClass: styles.tInfo,
      chips: ["Daily tracker", "Checklist", "Leaderboard", "Upcoming events"],
      col: { bg: "rgba(55,138,221,.12)", bc: "rgba(55,138,221,.3)", ic: "#85B7EB", tag: "#378ADD", cta: "#378ADD" },
      features: [
        { i: "ti-flame", t: "Daily activity tracker", s: "Heatmap of your last 7 days with streak bonuses and RDM deductions." },
        { i: "ti-brain", t: "Instacue single card", s: "One flashcard at a time with subject filter, Prev/Next and Know-It actions." },
        { i: "ti-checklist", t: "Today's checklist", s: "Five daily tasks. Complete all five to earn +100 RDM instantly." },
        { i: "ti-star", t: "Leaderboard", s: "Top 5 students by weekly RDM. See where you rank and who to beat." },
      ]
    },
    news: {
      icon: "ti-news",
      tag: "Info",
      title: "News and blogs",
      sub: "Curated dark-theme news briefs on NTA, JEE Main and KCET - updated daily.",
      themeClass: styles.tInfo,
      chips: ["JEE updates", "KCET news", "NTA alerts", "Study strategies"],
      col: { bg: "rgba(55,138,221,.12)", bc: "rgba(55,138,221,.3)", ic: "#85B7EB", tag: "#378ADD", cta: "#378ADD" },
      features: [
        { i: "ti-building", t: "NTA updates", s: "Policy changes, centre allocations, admit-card timelines and official notices." },
        { i: "ti-file-text", t: "JEE Main 2026 news", s: "New exam structure, negative marking changes and registration updates." },
        { i: "ti-writing", t: "Study strategy blogs", s: "7 toppers' secrets, time management and subject-wise score-boosting tips." },
        { i: "ti-bookmark", t: "Save and share", s: "Bookmark any article for later. Share to Community Feed to earn +2 RDM." },
      ]
    },
    progress: {
      icon: "ti-chart-bar",
      tag: "Info",
      title: "My Progress",
      sub: "Know your strengths, gaps and momentum across all three subjects.",
      themeClass: styles.tInfo,
      chips: ["Chapter accuracy", "Score trends", "Streak history", "Subject gaps"],
      col: { bg: "rgba(55,138,221,.12)", bc: "rgba(55,138,221,.3)", ic: "#85B7EB", tag: "#378ADD", cta: "#378ADD" },
      features: [
        { i: "ti-chart-line", t: "Score trend chart", s: "Week-by-week accuracy across Physics, Chemistry and Maths." },
        { i: "ti-book", t: "Chapter coverage map", s: "Visual map of which chapters you have covered, revised and mastered." },
        { i: "ti-clock", t: "Time distribution", s: "How you split study time across subjects - see imbalances at a glance." },
        { i: "ti-trending-up", t: "Longitudinal comparison", s: "Compare your daily micro-assessment scores against your mock test results." },
      ]
    },
  },
  prep: {
    learnhub: {
      icon: "ti-books",
      tag: "Prep",
      title: "LearnHub",
      sub: "Open any topic in Physics, Chemistry or Mathematics — lessons, practice and more.",
      themeClass: styles.tPrep,
      chips: ["Physics", "Chemistry", "Mathematics", "JEE · KCET · CBSE"],
      col: { bg: "rgba(29,158,117,.12)", bc: "rgba(29,158,117,.3)", ic: "#9FE1CB", tag: "#1D9E75", cta: "#1D9E75" },
      features: [
        { i: "ti-atom", t: "Physics", s: "Mechanics, Electrostatics, Optics, Thermodynamics, Waves and Modern Physics." },
        { i: "ti-flask", t: "Chemistry", s: "Organic, Inorganic, Physical Chemistry, Electrochemistry and Solutions." },
        { i: "ti-math", t: "Mathematics", s: "Calculus, Algebra, Geometry, Statistics and Probability." },
        { i: "ti-clock", t: "Coming soon", s: "Biology, Computer Science and Economics unlocking soon." },
      ]
    },
    classes: {
      icon: "ti-video",
      tag: "Prep",
      title: "Classes and Mock",
      sub: "Live webinars, recorded sessions and NTA-interface past-year mock papers.",
      themeClass: styles.tPrep,
      chips: ["Live classes", "Recorded library", "JEE mocks", "Past year papers"],
      col: { bg: "rgba(29,158,117,.12)", bc: "rgba(29,158,117,.3)", ic: "#9FE1CB", tag: "#1D9E75", cta: "#1D9E75" },
      features: [
        { i: "ti-school", t: "JEE Batch 101", s: "Live weekly sessions with Sankar. Past recordings available in library." },
        { i: "ti-writing", t: "NTA-interface mocks", s: "JEE Main and KCET past papers from 2008 to 2024. Adaptive difficulty." },
        { i: "ti-sparkles", t: "AI-optimised schedule", s: "Calendar auto-suggests which mock to take next based on your weak areas." },
        { i: "ti-chart-bar", t: "Instant insights", s: "Per-question time analysis and topic accuracy after every mock." },
      ]
    },
    gyan: {
      icon: "ti-help-circle",
      tag: "Prep",
      title: "Gyan++",
      sub: "AI-powered doubt clearing trained on CBSE, JEE Main and KCET content.",
      themeClass: styles.tPrep,
      chips: ["AI tutor", "Prof Pi", "Doubt wall", "Instant answers"],
      col: { bg: "rgba(29,158,117,.12)", bc: "rgba(29,158,117,.3)", ic: "#9FE1CB", tag: "#1D9E75", cta: "#1D9E75" },
      features: [
        { i: "ti-robot", t: "Prof Pi AI tutor", s: "Fine-tuned on the PCM curriculum. Answers doubts in under 2 seconds." },
        { i: "ti-message-circle", t: "Doubt wall", s: "Post any concept doubt publicly. Let the community weigh in too." },
        { i: "ti-coins", t: "+10 RDM for helping", s: "Answer a classmate's doubt correctly and earn bonus RDM." },
        { i: "ti-clock", t: "Available 24/7", s: "No more waiting for a teacher. Ask Prof Pi at midnight if needed." },
      ]
    },
    planner: {
      icon: "ti-calendar",
      tag: "Prep",
      title: "AI Study Planner",
      sub: "A personalised calendar that adapts as your progress and exam date changes.",
      themeClass: styles.tPrep,
      chips: ["Exam-date aware", "Chapter-gap analysis", "Auto-reschedule", "JEE · KCET"],
      col: { bg: "rgba(29,158,117,.12)", bc: "rgba(29,158,117,.3)", ic: "#9FE1CB", tag: "#1D9E75", cta: "#1D9E75" },
      features: [
        { i: "ti-target", t: "Exam-date aware", s: "Set your JEE Main or KCET date. Plan calculates backward from day one." },
        { i: "ti-chart-bar", t: "Gap analysis", s: "Identifies weak chapters and front-loads them into your next 14 days." },
        { i: "ti-refresh", t: "Auto-reschedule", s: "Miss a day? The plan rebuilds around your actual activity, not the ideal." },
        { i: "ti-bell", t: "Smart reminders", s: "DailyDose alarm at 7:30 AM, study reminder at 6 PM on weekdays." },
      ]
    },
  },
  fun: {
    dailydose: {
      icon: "ti-bolt",
      tag: "Fun",
      title: "DailyDose",
      sub: "Five PCM questions every morning. Build habit, earn RDM, protect your streak.",
      themeClass: styles.tFun,
      chips: ["5 questions daily", "+5 RDM per correct", "Streak builder", "Physics · Chem · Maths"],
      col: { bg: "rgba(127,119,221,.12)", bc: "rgba(127,119,221,.3)", ic: "#AFA9EC", tag: "#7F77DD", cta: "#7F77DD" },
      features: [
        { i: "ti-clock", t: "Under 3 minutes", s: "Five questions, no timer pressure. Perfect before breakfast or commute." },
        { i: "ti-coin", t: "+5 RDM per correct answer", s: "Answer all five correctly to pocket +25 RDM in one session." },
        { i: "ti-flame", t: "Streak protection", s: "Miss a day and lose 25 RDM. Hit 7 days straight and earn +100 bonus." },
        { i: "ti-atom", t: "Physics · Chemistry · Maths", s: "Always one question per subject, plus two mixed-format questions daily." },
      ]
    },
    funbrain: {
      icon: "ti-tournament",
      tag: "Fun",
      title: "Funbrain Challenges",
      sub: "Speed rounds, blitz games and live competitive events against fellow students.",
      themeClass: styles.tFun,
      chips: ["Speed rounds", "Live challenges", "+500 RDM prize pool", "Leaderboard"],
      col: { bg: "rgba(127,119,221,.12)", bc: "rgba(127,119,221,.3)", ic: "#AFA9EC", tag: "#7F77DD", cta: "#7F77DD" },
      features: [
        { i: "ti-player-play", t: "MentaMill Blitz", s: "10 questions, 90 seconds. Timer is the real opponent. Pass bar is 6/10." },
        { i: "ti-trophy", t: "Prize pool: +2,000 RDM", s: "Top 3 leaderboard positions split the weekly prize pool every Friday." },
        { i: "ti-live-view", t: "Live events", s: "Surprise blitz rounds go live at random. Notification fires when one starts." },
        { i: "ti-history", t: "Challenge history", s: "See every challenge you attempted - score, time, pass/fail and retry link." },
      ]
    },
    community: {
      icon: "ti-social",
      tag: "Fun",
      title: "Community Feed",
      sub: "India's only study social network - learn in public, score together.",
      themeClass: styles.tFun,
      chips: ["Post scores", "+5 RDM per post", "Save for revision", "4,287 students active"],
      col: { bg: "rgba(127,119,221,.12)", bc: "rgba(127,119,221,.3)", ic: "#AFA9EC", tag: "#7F77DD", cta: "#7F77DD" },
      features: [
        { i: "ti-message-circle", t: "Post scores and learnings", s: "Share wins, setbacks and doubts. Every post earns +5 RDM and helps others." },
        { i: "ti-chart-bar", t: "Score bar on every post", s: "Visual progress bar shows percentage at a glance - 80% teal, 0% red." },
        { i: "ti-bookmark", t: "Save for revision", s: "Bookmark any community post directly into your Revisions queue." },
        { i: "ti-trending-up", t: "Trending topics", s: "See what chapters 4,287 students are discussing right now." },
      ]
    },
    magic: {
      icon: "ti-wand",
      tag: "Fun",
      title: "Magic Wall",
      sub: "A social topic feed - scroll PCM concepts shared by the community.",
      themeClass: styles.tFun,
      chips: ["Topic feed", "PCM concepts", "Community-curated", "Save and share"],
      col: { bg: "rgba(127,119,221,.12)", bc: "rgba(127,119,221,.3)", ic: "#AFA9EC", tag: "#7F77DD", cta: "#7F77DD" },
      features: [
        { i: "ti-social", t: "Topic Feed", s: "Like a social feed but every card teaches you a concept. Swipe through PCM." },
        { i: "ti-filter", t: "Subject filter", s: "Switch between Physics, Chemistry and Maths feeds in one tap." },
        { i: "ti-coin", t: "+2 RDM per upvote received", s: "Post quality content and earn passive RDM as others engage." },
        { i: "ti-share", t: "Share outside EduBlast", s: "Share any magic-wall post to WhatsApp or Instagram to grow the community." },
      ]
    },
  },
  earn: {
    refer: {
      icon: "ti-share",
      tag: "Earn",
      title: "Earn and Learn",
      sub: "Invite friends - both of you earn +500 RDM the moment they complete DailyDose.",
      themeClass: styles.tEarn,
      chips: ["+500 RDM per referral", "No cap", "Unique link", "Instant credit"],
      col: { bg: "rgba(239,159,39,.12)", bc: "rgba(239,159,39,.3)", ic: "#FAC775", tag: "#EF9F27", cta: "#EF9F27" },
      features: [
        { i: "ti-link", t: "Unique referral link", s: "Copy your personal link and share it anywhere - WhatsApp, Instagram, email." },
        { i: "ti-coin", t: "+500 RDM each way", s: "You earn +500 when they sign up. They earn +500 when they complete Day 1." },
        { i: "ti-users", t: "No referral cap", s: "Refer 10 friends = +5,000 RDM. There is no ceiling." },
        { i: "ti-chart-bar", t: "Referral tracker", s: "See who joined via your link, when they activated and how much you earned." },
      ]
    },
    challenges: {
      icon: "ti-trophy",
      tag: "Earn",
      title: "Earn thru Challenges",
      sub: "Weekly blitz competitions with real RDM prize pools - compete and win.",
      themeClass: styles.tEarn,
      chips: ["Weekly prize pool", "+2,000 RDM top", "Leaderboard rank", "Live now"],
      col: { bg: "rgba(239,159,39,.12)", bc: "rgba(239,159,39,.3)", ic: "#FAC775", tag: "#EF9F27", cta: "#EF9F27" },
      features: [
        { i: "ti-player-play", t: "Weekly blitz format", s: "New challenge every Monday. Results and payouts every Friday." },
        { i: "ti-podium", t: "Top 3 prize structure", s: "1st: +1,000 · 2nd: +600 · 3rd: +400 RDM from each weekly pool." },
        { i: "ti-history", t: "History and retry", s: "Past challenge results stored. Retry any question set for practice, no RDM." },
        { i: "ti-bell", t: "Live-round notifications", s: "Push alert when a surprise live blitz goes active - never miss a round." },
      ]
    },
    edufund: {
      icon: "ti-heart",
      tag: "Earn",
      title: "Unlock Edufundz",
      sub: "Turn consistent verified learning into real money - Rs 3K to Rs 50K grants.",
      themeClass: styles.tEarn,
      chips: ["Rs 3K-Rs 50K grants", "Sprout grant", "Champion grant", "No income test"],
      col: { bg: "rgba(239,159,39,.12)", bc: "rgba(239,159,39,.3)", ic: "#FAC775", tag: "#EF9F27", cta: "#EF9F27" },
      features: [
        { i: "ti-seedling", t: "Sprout grant: Rs 3,000-Rs 10,000", s: "Starter tier. Reach 100% of daily activity target for 30 consecutive days." },
        { i: "ti-award", t: "Champion grant: Rs 10K-Rs 50K", s: "Advanced tier. Pro plan + 90-day verified streak + mock accuracy threshold." },
        { i: "ti-shield-check", t: "No income test, no collateral", s: "Eligibility is proven effort only. Your learning record is the application." },
        { i: "ti-users", t: "Donor network", s: "100% of donations go to students. Platform takes 0%. CSR and philanthropic." },
      ]
    },
    rewards: {
      icon: "ti-gift",
      tag: "Earn",
      title: "RDM Rewards",
      sub: "Redeem your RDM balance for real platform and real-world benefits.",
      themeClass: styles.tEarn,
      chips: ["Pro trial extension", "Platform credits", "Merchandise", "Scholarship draw"],
      col: { bg: "rgba(239,159,39,.12)", bc: "rgba(239,159,39,.3)", ic: "#FAC775", tag: "#EF9F27", cta: "#EF9F27" },
      features: [
        { i: "ti-package", t: "Pro trial extension", s: "Redeem RDM for additional Pro-plan days - keep premium features longer." },
        { i: "ti-coin", t: "Platform credits", s: "Convert RDM to subscription credits. Reduce your monthly bill." },
        { i: "ti-shirt", t: "EduBlast merchandise", s: "Limited-edition EduBlast merch drops available to high-RDM students." },
        { i: "ti-ticket", t: "Scholarship draw entries", s: "Each 1,000 RDM buys one entry into the monthly Rs 5,000 scholarship draw." },
      ]
    },
  },
};

export default function RedesignedHomeDashboard() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const { profile } = useAuth();
  const { streakDays } = useStudyStreakFromApi();
  const { nowMs } = useSyncedUtcNowMs({ tickMs: 30000 });

  const [activePage, setActivePage] = useState<string>(
    () => searchParams.get("page") || "home"
  );
  const [activeDetail, setActiveDetail] = useState<{ section: string; key: string } | null>(null);
  const [isChecklistOpen, setIsChecklistOpen] = useState(false);

  const [activeSection, setActiveSection] = useState(0);
  const sectionIds = ["hero", "features", "why", "cta"];

  // Sync activePage state with page query parameter and details
  useEffect(() => {
    const pageParam = searchParams.get("page") || "home";
    setActivePage(pageParam);
    const sectionParam = searchParams.get("section");
    const detailParam = searchParams.get("detail");
    if (sectionParam && detailParam) {
      setActiveDetail({ section: sectionParam, key: detailParam });
    } else {
      setActiveDetail(null);
    }
  }, [searchParams]);

  // Sync checklist open state with query parameter
  useEffect(() => {
    if (searchParams.get("open_checklist") === "1") {
      setIsChecklistOpen(true);
    }
  }, [searchParams]);

  // Listen for the global "open-habits-checklist" event
  useEffect(() => {
    const handleOpenChecklist = () => setIsChecklistOpen(true);
    window.addEventListener("open-habits-checklist", handleOpenChecklist);
    return () => window.removeEventListener("open-habits-checklist", handleOpenChecklist);
  }, []);

  // Scroll to top when activePage or activeDetail changes
  useEffect(() => {
    window.scrollTo({ top: 0 });
  }, [activePage, activeDetail]);

  // Inject Tabler Icons dynamically
  useEffect(() => {
    if (typeof document === "undefined") return;
    if (document.querySelector(`link[href="${TABLER_ICONS_HREF}"]`)) return;
    const link = document.createElement("link");
    link.rel = "stylesheet";
    link.href = TABLER_ICONS_HREF;
    document.head.appendChild(link);
  }, []);

  // Sync scroll indicator dots
  useEffect(() => {
    const handleScroll = () => {
      const y = window.scrollY || document.documentElement.scrollTop;
      let active = 0;
      sectionIds.forEach((id, idx) => {
        const el = document.getElementById(id);
        if (el && el.offsetTop - 120 <= y) {
          active = idx;
        }
      });
      setActiveSection(active);
    };

    window.addEventListener("scroll", handleScroll, { passive: true });
    return () => window.removeEventListener("scroll", handleScroll);
  }, []);

  const scrollTo = (id: string) => {
    const el = document.getElementById(id);
    if (el) {
      el.scrollIntoView({ behavior: "smooth" });
    }
  };

  const serverStreak = useMemo(
    () => parseDailyStreakServerState(profile?.free_trial_daily_streak),
    [profile?.free_trial_daily_streak]
  );

  const trialDayNumber = useMemo(() => {
    return getActiveStreakDayNumber({
      claimedAt: profile?.onboarding_reward_claimed_at,
      nowMs,
      userId: profile?.id,
      serverStreak,
    });
  }, [profile?.onboarding_reward_claimed_at, profile?.id, nowMs, serverStreak]);


  return (
    <div className={styles.container}>
      {/* QUICK DOT NAVIGATION */}
      {activePage === "home" && activeDetail === null && (
        <div className={styles.qnav}>
          {sectionIds.map((id, idx) => (
            <button
              key={id}
              className={`${styles.qd} ${activeSection === idx ? styles.on : ""}`}
              onClick={() => scrollTo(id)}
              aria-label={`Jump to ${id}`}
            />
          ))}
        </div>
      )}

      {activeDetail != null ? (
        <div className={styles.subpageContent}>
          <motion.div
            key={activeDetail.key}
            initial={{ opacity: 0, y: 12 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.3, ease: "easeOut" }}
          >
            <div className={styles.breadcrumb}>
              <span className={styles.bcLink} onClick={() => router.push("/home")}>Home</span>
              <i className="ti ti-chevron-right" aria-hidden="true"></i>
              <span className={styles.bcLink} onClick={() => router.push(`/home?page=${activeDetail.section}`)}>{activeDetail.section.charAt(0).toUpperCase() + activeDetail.section.slice(1)}</span>
              <i className="ti ti-chevron-right" aria-hidden="true"></i>
              <span style={{ color: "var(--t2)" }}>
                {SUBMENU_DATA[activeDetail.section]?.[activeDetail.key]?.title}
              </span>
            </div>

            <div className={styles.detailInner}>
              <button className={styles.backBtn} onClick={() => router.push(`/home?page=${activeDetail.section}`)}>
                <i className="ti ti-arrow-left" aria-hidden="true"></i>Back
              </button>
              
              {(() => {
                const d = SUBMENU_DATA[activeDetail.section]?.[activeDetail.key];
                if (!d) return null;
                return (
                  <>
                    <div className={styles.detailIcon} style={{ background: d.col.bg, borderColor: d.col.bc }}>
                      <i className={`ti ${d.icon}`} style={{ color: d.col.ic }} aria-hidden="true"></i>
                    </div>
                    <div className={styles.detailTag} style={{ color: d.col.tag }}>{d.tag}</div>
                    <h1 className={styles.detailH}>{d.title}</h1>
                    <p className={styles.detailSub}>{d.sub}</p>
                    
                    <div className={styles.detailFeatures}>
                      {d.features.map((f, i) => (
                        <div key={i} className={styles.df} style={{ borderColor: `${d.col.bc}33` }}>
                          <i className={`ti ${f.i}`} style={{ color: d.col.ic }} aria-hidden="true"></i>
                          <div>
                             <div className={styles.dfTitle}>{f.t}</div>
                             <div className={styles.dfSub}>{f.s}</div>
                          </div>
                        </div>
                      ))}
                    </div>

                    <button
                      className={styles.detailCta}
                      style={{ background: d.col.cta }}
                      onClick={() => {
                        if (activeDetail.key === "dashboard") {
                          router.push("/home?page=dashboard");
                        } else if (activeDetail.key === "progress") {
                          router.push("/performance");
                        } else if (activeDetail.key === "news") {
                          router.push("/news-blog");
                        } else if (activeDetail.key === "learnhub") {
                          router.push("/explore-1");
                        } else if (activeDetail.key === "classes") {
                          router.push("/mock");
                        } else if (activeDetail.key === "gyan") {
                          router.push("/doubts");
                        } else if (activeDetail.key === "planner") {
                          router.push("/explore-1");
                        } else if (activeDetail.key === "dailydose" || activeDetail.key === "funbrain") {
                          router.push("/play");
                        } else if (activeDetail.key === "community") {
                          router.push("/explore/community");
                        } else if (activeDetail.key === "magic") {
                          router.push("/magic-wall");
                        } else if (activeDetail.key === "refer" || activeDetail.key === "challenges") {
                          router.push("/refer-earn");
                        } else if (activeDetail.key === "edufund") {
                          router.push("/edufund?onboarding_edufund=1");
                        } else if (activeDetail.key === "rewards") {
                          window.dispatchEvent(new CustomEvent("open-rdm-wallet"));
                        }
                      }}
                    >
                      <i className="ti ti-player-play" aria-hidden="true"></i>Open now
                    </button>
                  </>
                );
              })()}
            </div>
          </motion.div>
        </div>
      ) : activePage !== "home" ? (
        <div className={styles.subpageContent}>
          <motion.div
            key={activePage}
            initial={{ opacity: 0, y: 12 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.3, ease: "easeOut" }}
          >
            {activePage === "info" && (
              <div className={styles.secBanner}>
                <div className={styles.secBannerEyebrow} style={{ background: "rgba(55,138,221,.1)", border: ".5px solid rgba(55,138,221,.25)", color: "var(--blue)" }}>
                  <i className="ti ti-layout-dashboard" aria-hidden="true"></i>Info section
                </div>
                <h1 className={styles.secBannerH1}>Stay on <span>Track.</span></h1>
                <p className={styles.secBannerDesc}>Observe where you are, check in daily, and see exactly how your learning is growing. Everything you need to stay aware and on course.</p>
              </div>
            )}

            {activePage === "prep" && (
              <div className={styles.secBanner}>
                <div className={styles.secBannerEyebrow} style={{ background: "rgba(29,158,117,.1)", border: ".5px solid rgba(29,158,117,.25)", color: "var(--teal)" }}>
                  <i className="ti ti-books" aria-hidden="true"></i>Prep section
                </div>
                <h1 className={styles.secBannerH1}>Ace <span>Your Exam.</span></h1>
                <p className={styles.secBannerDesc}>Study smarter with AI-powered tools - adaptive mocks, spaced flashcards, live classes, and a personalised calendar that keeps you always exam-ready.</p>
              </div>
            )}

            {activePage === "fun" && (
              <div className={styles.secBanner}>
                <div className={styles.secBannerEyebrow} style={{ background: "rgba(127,119,221,.1)", border: ".5px solid rgba(127,119,221,.25)", color: "var(--purple)" }}>
                  <i className="ti ti-confetti" aria-hidden="true"></i>Fun section
                </div>
                <h1 className={styles.secBannerH1}>Fun <span>while Learn.</span></h1>
                <p className={styles.secBannerDesc}>Games, social posts, daily speed rounds and a magic topic feed - because learning every day is easier when it actually feels good.</p>
              </div>
            )}

            {activePage === "earn" && (
              <div className={styles.secBanner}>
                <div className={styles.secBannerEyebrow} style={{ background: "rgba(239,159,39,.1)", border: ".5px solid rgba(239,159,39,.25)", color: "var(--amber)" }}>
                  <i className="ti ti-pig-money" aria-hidden="true"></i>Earn section
                </div>
                <h1 className={styles.secBannerH1}>Unburden <span>Your Parents.</span></h1>
                <p className={styles.secBannerDesc}>Every action you take on EduBlast earns RDM. Stack it, refer friends, win challenges and convert consistent learning into real financial support.</p>
              </div>
            )}

            <div style={{ marginTop: "20px" }}>
              {Object.entries(SUBMENU_DATA[activePage]).map(([key, data]) => (
                <div
                  key={key}
                  className={`${styles.optRow} ${data.themeClass}`}
                  onClick={() => {
                    if (key === "dashboard") {
                      router.push("/home?page=dashboard");
                    } else if (key === "progress") {
                      router.push("/performance");
                    } else if (key === "news") {
                      router.push("/news-blog");
                    } else if (key === "learnhub") {
                      router.push("/explore-1");
                    } else if (key === "classes") {
                      router.push("/mock");
                    } else if (key === "gyan") {
                      router.push("/doubts");
                    } else if (key === "planner") {
                      router.push("/explore-1");
                    } else if (key === "dailydose" || key === "funbrain") {
                      router.push("/play");
                    } else if (key === "community") {
                      router.push("/explore/community");
                    } else if (key === "magic") {
                      router.push("/magic-wall");
                    } else if (key === "refer" || key === "challenges") {
                      router.push("/refer-earn");
                    } else if (key === "edufund") {
                      router.push("/edufund?onboarding_edufund=1");
                    } else if (key === "rewards") {
                      window.dispatchEvent(new CustomEvent("open-rdm-wallet"));
                    }
                  }}
                >
                  <div className={styles.optIconBox}>
                    <i className={`ti ${data.icon}`} aria-hidden="true"></i>
                  </div>
                  <div className={styles.optBody}>
                    <div className={styles.optTag}>{data.tag}</div>
                    <div className={styles.optTitle}>{data.title}</div>
                    <div className={styles.optDesc}>{data.sub}</div>
                    <div className={styles.optChips}>
                      {data.chips.map((chip, idx) => (
                        <span key={idx} className={styles.chip}>{chip}</span>
                      ))}
                    </div>
                  </div>
                  <div className={styles.optArrow}>
                    <i className="ti ti-arrow-right" aria-hidden="true"></i>
                  </div>
                </div>
              ))}
            </div>
          </motion.div>
        </div>
      ) : (
        <>
          {/* HERO SECTION */}
          <section className={styles.hero} id="hero">
            <div className={styles.heroLeft}>
              <div className={styles.heroEyebrow}>
                <i className="ti ti-sparkles" aria-hidden="true"></i>
                AI-driven learning platform
              </div>
              <h1 className={styles.heroH1}>
                Learn Smarter.
                <br />
                Achieve Bigger. <span>Together.</span>
              </h1>
              <p className={styles.heroSub}>
                EduBlast is your all-in-one AI-driven learning and social learning platform. Plan better,
                study smarter, stay consistent, and grow with a community that pushes you forward.
              </p>
              <div className={styles.heroBtns}>
                <button className={styles.btnPrimary} onClick={() => router.push("/home?page=info")}>
                  <i className="ti ti-player-play" aria-hidden="true"></i>Start Now
                </button>
                <button className={styles.btnSecondary} onClick={() => router.push("/home?page=prep")}>
                  <i className="ti ti-books" aria-hidden="true"></i>Explore Prep
                </button>
                <button className={styles.btnGhost} onClick={() => scrollTo("why")}>
                  <i className="ti ti-coffee" aria-hidden="true"></i>Take a Break
                </button>
                <button className={styles.btnPurple} onClick={() => router.push("/home?page=fun")}>
                  <i className="ti ti-social" aria-hidden="true"></i>Explore Community
                </button>
                <button className={styles.btnAmber} onClick={() => router.push("/home?page=earn")}>
                  <i className="ti ti-coin" aria-hidden="true"></i>Earn Rewards
                </button>
                <button className={styles.btnPink} onClick={() => router.push("/home?page=earn&section=earn&detail=edufund")}>
                  <i className="ti ti-heart" aria-hidden="true"></i>Unlock Funds
                </button>
              </div>
            </div>
            <div className={styles.rdmCard}>
              <div className={styles.rdmCardTop}>
                <div className={styles.rdmCardTitle}>
                  <i className="ti ti-info-circle" aria-hidden="true"></i>Your RDM summary
                </div>
                <div className={styles.rdmIcon}>
                  <i className="ti ti-coin" aria-hidden="true"></i>
                </div>
              </div>
              <div className={styles.rdmBal}>
                {profile?.rdm ?? 0} <span>RDM</span>
              </div>
              <div className={styles.rdmSub}>Total balance</div>
              <div className={styles.rdmStats}>
                <div>
                  <div className={styles.rdmStatLbl}>Trial day</div>
                  <div className={styles.rdmStatVal}>{trialDayNumber} / 7</div>
                </div>
                <div>
                  <div className={styles.rdmStatLbl}>Streak</div>
                  <div className={styles.rdmStatVal}>{streakDays} {streakDays === 1 ? "day" : "days"}</div>
                </div>
                <div>
                  <div className={styles.rdmStatLbl}>Bonus</div>
                  <div className={`${styles.rdmStatVal} ${styles.amber}`}>+500</div>
                </div>
              </div>
              <div className={styles.rdmCta} onClick={() => setIsChecklistOpen(true)}>
                <div className={styles.rdmCtaLeft}>
                  <i className="ti ti-star" aria-hidden="true"></i>
                  <div>
                    <div className={styles.rdmCtaTitle}>Keep your streak alive!</div>
                    <div className={styles.rdmCtaSub}>Study daily to earn more RDM.</div>
                  </div>
                </div>
                <i className="ti ti-chevron-right" style={{ color: "var(--amber)", fontSize: "16px" }} aria-hidden="true"></i>
              </div>
            </div>
          </section>

          {/* FEATURES SECTION */}
          <section className={styles.section} id="features">
            <div className={styles.secEyebrow}>
              <i className="ti ti-layout-grid" aria-hidden="true"></i>Features list
            </div>
            <h2 className={styles.secH2}>Stay on Track. Ace Your Exam.</h2>
            <p className={styles.secSub}>
              Four focused sections - each designed around what students actually need to succeed.
            </p>
            <div className={styles.featuresGrid}>
              {/* INFO FEATURE CARD */}
              <div className={`${styles.featCard} ${styles.featInfo}`} onClick={() => router.push("/home?page=info")}>
                <div className={styles.featCardAccent}></div>
                <div className={styles.featIconBox}>
                  <i className="ti ti-layout-dashboard" aria-hidden="true"></i>
                </div>
                <div className={styles.featTagline}>Stay on Track</div>
                <div className={styles.featCardTitle}>INFO</div>
                <div className={styles.featCardDesc}>Observe. Check in. Stay on track.</div>
                <div className={styles.featList}>
                  <div className={styles.featItem}>
                    <i className="ti ti-layout-dashboard" aria-hidden="true"></i>My Dashboard
                  </div>
                  <div className={styles.featItem}>
                    <i className="ti ti-news" aria-hidden="true"></i>News &amp; Blogs
                  </div>
                  <div className={styles.featItem}>
                    <i className="ti ti-chart-bar" aria-hidden="true"></i>My Progress
                  </div>
                </div>
                <div className={styles.featCta}>
                  Explore Info <i className="ti ti-arrow-right" aria-hidden="true"></i>
                </div>
              </div>

              {/* PREP FEATURE CARD */}
              <div className={`${styles.featCard} ${styles.featPrep}`} onClick={() => router.push("/home?page=prep")}>
                <div className={styles.featCardAccent}></div>
                <div className={styles.featIconBox}>
                  <i className="ti ti-books" aria-hidden="true"></i>
                </div>
                <div className={styles.featTagline}>Ace Your Exam</div>
                <div className={styles.featCardTitle}>PREP</div>
                <div className={styles.featCardDesc}>Study smart. Practice more. Ace your exams.</div>
                <div className={styles.featList}>
                  <div className={styles.featItem}>
                    <i className="ti ti-books" aria-hidden="true"></i>LearnHub
                  </div>
                  <div className={styles.featItem}>
                    <i className="ti ti-video" aria-hidden="true"></i>Classes + Mock
                  </div>
                  <div className={styles.featItem}>
                    <i className="ti ti-help-circle" aria-hidden="true"></i>Gyan++
                  </div>
                  <div className={styles.featItem}>
                    <i className="ti ti-calendar" aria-hidden="true"></i>AI Study Planner
                  </div>
                </div>
                <div className={styles.featCta}>
                  Explore Prep <i className="ti ti-arrow-right" aria-hidden="true"></i>
                </div>
              </div>

              {/* FUN FEATURE CARD */}
              <div className={`${styles.featCard} ${styles.featFun}`} onClick={() => router.push("/home?page=fun")}>
                <div className={styles.featCardAccent}></div>
                <div className={styles.featIconBox}>
                  <i className="ti ti-confetti" aria-hidden="true"></i>
                </div>
                <div className={styles.featTagline}>Fun while Learn</div>
                <div className={styles.featCardTitle}>FUN</div>
                <div className={styles.featCardDesc}>Learn, play, engage. Together.</div>
                <div className={styles.featList}>
                  <div className={styles.featItem}>
                    <i className="ti ti-bolt" aria-hidden="true"></i>DailyDose
                  </div>
                  <div className={styles.featItem}>
                    <i className="ti ti-tournament" aria-hidden="true"></i>Funbrain
                  </div>
                  <div className={styles.featItem}>
                    <i className="ti ti-social" aria-hidden="true"></i>Community Feed
                  </div>
                  <div className={styles.featItem}>
                    <i className="ti ti-wand" aria-hidden="true"></i>Magic Wall
                  </div>
                </div>
                <div className={styles.featCta}>
                  Explore Fun <i className="ti ti-arrow-right" aria-hidden="true"></i>
                </div>
              </div>

              {/* EARN FEATURE CARD */}
              <div className={`${styles.featCard} ${styles.featEarn}`} onClick={() => router.push("/home?page=earn")}>
                <div className={styles.featCardAccent}></div>
                <div className={styles.featIconBox}>
                  <i className="ti ti-pig-money" aria-hidden="true"></i>
                </div>
                <div className={styles.featTagline}>Unburden Your Parents</div>
                <div className={styles.featCardTitle}>EARN</div>
                <div className={styles.featCardDesc}>Earn rewards. Unlock benefits.</div>
                <div className={styles.featList}>
                  <div className={styles.featItem}>
                    <i className="ti ti-share" aria-hidden="true"></i>Earn and Learn
                  </div>
                  <div className={styles.featItem}>
                    <i className="ti ti-trophy" aria-hidden="true"></i>Earn thru Challenges
                  </div>
                  <div className={styles.featItem}>
                    <i className="ti ti-heart" aria-hidden="true"></i>Unlock Edufundz
                  </div>
                  <div className={styles.featItem}>
                    <i className="ti ti-gift" aria-hidden="true"></i>RDM Rewards
                  </div>
                </div>
                <div className={styles.featCta}>
                  Explore Earn <i className="ti ti-arrow-right" aria-hidden="true"></i>
                </div>
              </div>
            </div>
          </section>

          {/* WHY SECTION */}
          <div className={styles.whySection} id="why">
            <div className={styles.secEyebrow}>
              <i className="ti ti-heart" aria-hidden="true"></i>Built for students
            </div>
            <h2 className={styles.secH2}>Why students love EduBlast</h2>
            <p className={styles.secSub} style={{ marginBottom: "36px" }}>
              Every feature designed around what actually helps you score more and stress less.
            </p>
            <div className={styles.whyGrid}>
              <div className={styles.whyCard}>
                <div className={styles.whyIcon} style={{ background: "rgba(127,119,221,.12)", border: ".5px solid rgba(127,119,221,.25)" }}>
                  <i className="ti ti-brain" style={{ color: "var(--purple)" }} aria-hidden="true"></i>
                </div>
                <div>
                  <div className={styles.whyTitle}>AI study planner</div>
                  <div className={styles.whyDesc}>
                    Personalised plans that adapt to your goals and progress. Never miss a revision window again.
                  </div>
                </div>
              </div>
              <div className={styles.whyCard}>
                <div className={styles.whyIcon} style={{ background: "rgba(29,158,117,.12)", border: ".5px solid rgba(29,158,117,.25)" }}>
                  <i className="ti ti-users" style={{ color: "var(--teal)" }} aria-hidden="true"></i>
                </div>
                <div>
                  <div className={styles.whyTitle}>Social learning</div>
                  <div className={styles.whyDesc}>
                    Learn together, discuss doubts, share notes, grow together. India's only study social network.
                  </div>
                </div>
              </div>
              <div className={styles.whyCard}>
                <div className={styles.whyIcon} style={{ background: "rgba(55,138,221,.12)", border: ".5px solid rgba(55,138,221,.25)" }}>
                  <i className="ti ti-writing" style={{ color: "var(--blue)" }} aria-hidden="true"></i>
                </div>
                <div>
                  <div className={styles.whyTitle}>Smart prep and mocks</div>
                  <div className={styles.whyDesc}>
                    Practice with AI-adaptive mocks, get instant insights and improve faster with every attempt.
                  </div>
                </div>
              </div>
              <div className={styles.whyCard}>
                <div className={styles.whyIcon} style={{ background: "rgba(239,159,39,.12)", border: ".5px solid rgba(239,159,39,.25)" }}>
                  <i className="ti ti-coin" style={{ color: "var(--amber)" }} aria-hidden="true"></i>
                </div>
                <div>
                  <div className={styles.whyTitle}>Rewards and RDM</div>
                  <div className={styles.whyDesc}>
                    Earn RDM for every action - DailyDose, streaks, posts and challenges. Unlock real benefits.
                  </div>
                </div>
              </div>
              <div className={styles.whyCard}>
                <div className={styles.whyIcon} style={{ background: "rgba(29,158,117,.12)", border: ".5px solid rgba(29,158,117,.25)" }}>
                  <i className="ti ti-calendar-check" style={{ color: "var(--teal)" }} aria-hidden="true"></i>
                </div>
                <div>
                  <div className={styles.whyTitle}>Daily habits</div>
                  <div className={styles.whyDesc}>
                    Build consistency with streaks, DailyDose and smart reminders. Small daily actions create big results.
                  </div>
                </div>
              </div>
              <div className={styles.whyCard}>
                <div className={styles.whyIcon} style={{ background: "rgba(212,83,126,.12)", border: ".5px solid rgba(212,83,126,.25)" }}>
                  <i className="ti ti-school" style={{ color: "var(--pink)" }} aria-hidden="true"></i>
                </div>
                <div>
                  <div className={styles.whyTitle}>Edufundz and scholarships</div>
                  <div className={styles.whyDesc}>
                    Access real money scholarships and Edufundz grants (Rs 3K-Rs 50K) earned through verified daily learning.
                  </div>
                </div>
              </div>
            </div>
          </div>

          {/* BOTTOM CTA SECTION */}
          <section className={styles.ctaSection} id="cta">
            <div className={styles.secEyebrow}>
              <i className="ti ti-rocket" aria-hidden="true"></i>Ready to go
            </div>
            <h2 className={styles.secH2}>Your next step</h2>
            <p className={styles.secSub} style={{ marginBottom: "32px" }}>
              New here? Take the 2-minute tour. Already hooked? Jump into the Community Feed.
            </p>
            <div className={styles.ctaGrid}>
              <div className={styles.ctaCard} onClick={() => requestOpenSiteTourCarousel()}>
                <div className={styles.ctaCardLeft}>
                  <h3>New here?</h3>
                  <p>
                    Take a quick tour and discover everything EduBlast has to offer - from InstaCues to
                    Edufundz grants in under 2 minutes.
                  </p>
                </div>
                <button className={styles.ctaBtnTour} onClick={() => requestOpenSiteTourCarousel()}>
                  <i className="ti ti-player-play" aria-hidden="true"></i>Take a tour
                </button>
              </div>
              <div className={styles.ctaCard} onClick={() => router.push("/explore/community")}>
                <div className={styles.ctaCardLeft}>
                  <h3>Join the EduBlast community</h3>
                  <p>Connect with students, share wins and setbacks, learn and grow together.</p>
                  <div className={styles.avatarStack}>
                    <div className={styles.avI} style={{ background: "var(--teal)" }}>
                      KR
                    </div>
                    <div className={styles.avI} style={{ background: "var(--blue)" }}>
                      AI
                    </div>
                    <div className={styles.avI} style={{ background: "var(--purple)" }}>
                      SR
                    </div>
                    <div className={styles.avI} style={{ background: "var(--amber)" }}>
                      MG
                    </div>
                    <span className={styles.avCount}>+2.4K students</span>
                  </div>
                </div>
                <button
                  type="button"
                  className={styles.ctaBtnJoin}
                  onClick={(e) => {
                    e.stopPropagation();
                    router.push("/explore/community");
                  }}
                >
                  <i className="ti ti-users" aria-hidden="true"></i>Join now
                </button>
              </div>
            </div>
          </section>
        </>
      )}

      {/* â”€â”€ FULL CHECKLIST DIALOG â”€â”€ */}
      <Dialog open={isChecklistOpen} onOpenChange={setIsChecklistOpen}>
        <DialogContent
          className={
            "flex w-full max-w-3xl flex-col gap-0 overflow-hidden border-border/70 bg-card p-0 shadow-2xl " +
            "ring-1 ring-black/5 dark:border-white/10 dark:bg-[#070b14] dark:ring-white/10 " +
            "max-h-[min(92dvh,56rem)] " +
            "max-sm:inset-x-0 max-sm:bottom-0 max-sm:left-0 max-sm:right-0 max-sm:top-auto " +
            "max-sm:max-h-[min(90dvh,56rem)] max-sm:w-full max-sm:translate-x-0 max-sm:translate-y-0 " +
            "max-sm:rounded-b-none max-sm:rounded-t-3xl max-sm:border-x-0 max-sm:border-b-0 " +
            "sm:left-1/2 sm:top-1/2 sm:w-[calc(100vw-1.5rem)] sm:-translate-x-1/2 sm:-translate-y-1/2 sm:rounded-2xl sm:border " +
            "pb-[max(0.75rem,env(safe-area-inset-bottom))]"
          }
        >
          <div className="shrink-0 border-b border-border/60 bg-gradient-to-b from-muted/50 to-transparent px-3.5 pb-3 pt-5 sm:px-6 sm:pb-5 sm:pt-7 dark:from-slate-900/90">
            <DialogHeader className="space-y-2.5 text-left sm:space-y-3">
              <div className="flex items-start gap-2.5 pr-11 sm:gap-3 sm:pr-12">
                <CheckCircle2
                  className="mt-0.5 h-5 w-5 shrink-0 text-emerald-500"
                  aria-hidden
                />
                <DialogTitle className="text-left text-[15px] font-bold leading-snug tracking-tight sm:text-lg">
                  Today&apos;s checklist
                </DialogTitle>
              </div>
              <div className="flex flex-col gap-2 sm:flex-row sm:items-center sm:gap-3" style={{ marginTop: "12px" }}>
                <button
                  type="button"
                  className="h-11 w-full min-h-[44px] flex items-center justify-center gap-2 rounded-full font-bold bg-primary text-primary-foreground sm:h-10 sm:w-fit sm:min-h-0 px-4 py-2 hover:opacity-90"
                  onClick={() => { setIsChecklistOpen(false); router.push("/play"); }}
                  style={{ background: "var(--teal)", color: "#fff" }}
                >
                  <Flame className="h-4 w-4 shrink-0" aria-hidden />
                  Start streak for today
                </button>
                <p className="text-[11px] leading-relaxed text-muted-foreground sm:text-xs">
                  Esc or the top-right close to exit.
                </p>
              </div>
            </DialogHeader>
          </div>

          <div className="min-h-0 flex-1 overflow-y-auto overscroll-y-contain px-3 py-2.5 sm:px-6 sm:py-4">
            <ul className="space-y-1.5 sm:space-y-2.5">
              {[
                {
                  id: "1",
                  text: "Do your Daily Routine - complete DailyDose (10 questions, academic, 5 mins) and complete Funbrain Forge (10 questions, non-academic, 5 minutes)",
                  done: true,
                },
                {
                  id: "2",
                  text: "At least 1 topic and 1 sub-topic per subject - Physics, Chemistry and Mathematics (a submitted topic quiz in each subject), & tap Mark as complete in Lessons/Progress after finishing all five steps there",
                  done: false,
                },
                {
                  id: "3",
                  text: "Gyan++: stay on the feed at least 5 minutes, save at least 1 doubt for revision, and upvote or comment on someone else's post today.",
                  done: true,
                },
                {
                  id: "4",
                  text: "Instacue: scroll through all 32 cards for your chapter (same checklist as Lessons / Progress; count resets each calendar day)",
                  done: false,
                },
                {
                  id: "5",
                  text: "Try your luck at the Challenge Yourself and win RDM",
                  done: false,
                },
              ].map((item) => (
                <li
                  key={item.id}
                  className={
                    "flex items-start gap-2.5 rounded-xl px-3 py-2.5 transition-colors sm:gap-3 sm:px-3.5 sm:py-3 " +
                    (item.done
                      ? "bg-emerald-500/5 dark:bg-emerald-500/[0.03]"
                      : "bg-background/60 dark:bg-slate-900/50")
                  }
                >
                  {item.done ? (
                    <CheckCircle2
                      className="mt-0.5 h-4 w-4 shrink-0 text-emerald-500"
                      aria-label="Done"
                    />
                  ) : (
                    <span
                      className="mt-0.5 inline-flex h-4 w-4 shrink-0 rounded border border-dashed border-muted-foreground/50"
                      aria-hidden
                    />
                  )}
                  <span className="min-w-0 flex-1 text-[13px] leading-relaxed text-foreground sm:text-sm sm:leading-normal">
                    <span className="font-bold">{item.id}.</span> {item.text}
                    {item.id === "3" ? (
                      <>
                        {" "}
                        <Link href="/doubts" className="font-bold text-primary hover:underline" onClick={() => setIsChecklistOpen(false)}>
                          Open Gyan++
                        </Link>
                      </>
                    ) : null}
                    {item.id === "5" ? (
                      <>
                        {" "}
                        <Link
                          href="/refer-earn"
                          className="font-bold text-primary hover:underline"
                          onClick={() => setIsChecklistOpen(false)}
                        >
                          Open Challenge Yourself
                        </Link>
                      </>
                    ) : null}
                  </span>
                </li>
              ))}
            </ul>
          </div>

          <div className="shrink-0 border-t border-border/60 bg-muted/25 px-3.5 py-2.5 sm:px-6 sm:py-3 dark:bg-slate-950/80">
            <p className="text-[11px] leading-relaxed text-muted-foreground sm:text-xs">
              <span className="font-semibold text-foreground">
                2 of 5 habits checked off today
              </span>
            </p>
          </div>
        </DialogContent>
      </Dialog>

{/* FOOTER */}
      <footer className={styles.footer}>
        <div className={styles.footerInner}>
          <span>(c) 2026 EduBlast - Learn thru Questions</span>
          <div className={styles.footerRight}>
            <Link href="/pricing">Pricing</Link>
            <Link href="/profile">Profile</Link>
            <Link href="/explore-1">LearnHub</Link>
            <Link href="/contact">Contact us</Link>
          </div>
        </div>
      </footer>
    </div>
  );
}


