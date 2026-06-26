/** Site tour carousel content — ported from edublast_tour_carousel.html */

export type SnapshotRowBadge = "bt" | "ba" | "bb" | "bp" | null;

export type SiteTourSnapshotRow = {
  i: string;
  c: string;
  t: string;
  b: SnapshotRowBadge;
};

export type SiteTourSubFeature = {
  id: string;
  lbl: string;
  ico: string;
  c: string;
  rdm: number;
  tip: string;
  ey: string;
  ti: string;
  de: string;
  rows: SiteTourSnapshotRow[];
};

export type SiteTourMenu = {
  id: string;
  lbl: string;
  ico: string;
  c: string;
  bg: string;
  bd: string;
  desc: string;
  subs: SiteTourSubFeature[];
};

export type SiteTourFlatStep = {
  mid: string;
  sid: string;
  rdm: number;
};

export const SITE_TOUR_CAROUSEL_DURATION_MS = 5000;

export const SITE_TOUR_CAROUSEL_MENUS: SiteTourMenu[] = [
  {
    "id": "db",
    "lbl": "Dashboard",
    "ico": "ti-layout-dashboard",
    "c": "#378ADD",
    "bg": "#0D1E30",
    "bd": "#378ADD",
    "desc": "Your home base — every key metric at a glance",
    "subs": [
      {
        "id": "db1",
        "lbl": "Streak",
        "ico": "ti-flame",
        "c": "#EF9F27",
        "rdm": 2,
        "tip": "Miss a day = –50 RDM",
        "ey": "Dashboard · Streak",
        "ti": "Daily streak tracking",
        "de": "Your study streak increments every Active Day. 5-day earns +50 RDM, 7-day +100 RDM, 90-day +500 RDM. Missing a day deducts 50 RDM on trial.",
        "rows": [
          {
            "i": "ti-flame",
            "c": "#EF9F27",
            "t": "7-day streak active — +100 RDM bonus",
            "b": "ba"
          },
          {
            "i": "ti-calendar",
            "c": "#378ADD",
            "t": "30-day activity heatmap in Dashboard",
            "b": "bb"
          },
          {
            "i": "ti-alert-triangle",
            "c": "#E24B4A",
            "t": "–50 RDM on inactive trial day",
            "b": null
          }
        ]
      },
      {
        "id": "db2",
        "lbl": "Accuracy",
        "ico": "ti-chart-bar",
        "c": "#7F77DD",
        "rdm": 2,
        "tip": "Chapter accuracy flyout",
        "ey": "Dashboard · Accuracy",
        "ti": "Subject accuracy by chapter",
        "de": "Tracks marked-completed subtopics per chapter. % complete shown with colour bar. Chapters under 10% trigger a Needs Attention callout.",
        "rows": [
          {
            "i": "ti-chart-bar",
            "c": "#7F77DD",
            "t": "Chemistry — Electrochemistry at 3%",
            "b": "bp"
          },
          {
            "i": "ti-alert-circle",
            "c": "#E24B4A",
            "t": "3 chapters flagged below 10%",
            "b": null
          },
          {
            "i": "ti-check",
            "c": "#1D9E75",
            "t": "Click icon in greeting row to open flyout",
            "b": "bt"
          }
        ]
      },
      {
        "id": "db3",
        "lbl": "Checklist",
        "ico": "ti-checklist",
        "c": "#1D9E75",
        "rdm": 2,
        "tip": "5 tasks = 50 RDM/day",
        "ey": "Dashboard · Checklist",
        "ti": "Today's daily checklist",
        "de": "5 tasks earn 50 RDM: DailyDose (10), Gyan++ (5), Magic Wall (5), Mentamill (10), Lessons (20). Complete all 5 before midnight.",
        "rows": [
          {
            "i": "ti-bolt",
            "c": "#EF9F27",
            "t": "DailyDose — 5 questions (+10 RDM)",
            "b": "ba"
          },
          {
            "i": "ti-social",
            "c": "#D4537E",
            "t": "Magic Wall upvote (+5 RDM)",
            "b": null
          },
          {
            "i": "ti-circle-check",
            "c": "#1D9E75",
            "t": "3 of 5 done — 30 RDM earned",
            "b": "bt"
          }
        ]
      },
      {
        "id": "db4",
        "lbl": "Events",
        "ico": "ti-calendar",
        "c": "#85B7EB",
        "rdm": 1,
        "tip": "Mocks + live classes",
        "ey": "Dashboard · Events",
        "ti": "Upcoming mocks and classes",
        "de": "Right sidebar shows next 3 Testbee mocks and scheduled classes. One-click Start Now launches any paper in NTA-style interface.",
        "rows": [
          {
            "i": "ti-writing",
            "c": "#378ADD",
            "t": "JEE Main Mock Paper 2 — 180 min",
            "b": "bb"
          },
          {
            "i": "ti-star",
            "c": "#7F77DD",
            "t": "Physics 9.3 Elastic Moduli — Advanced",
            "b": "bp"
          }
        ]
      },
      {
        "id": "db5",
        "lbl": "Feed",
        "ico": "ti-social",
        "c": "#D4537E",
        "rdm": 1,
        "tip": "Filter · upvote · thread",
        "ey": "Dashboard · Feed",
        "ti": "Community feed on dashboard",
        "de": "Latest posts from your network. Filter by All, Physics, Chemistry or Math. Upvote, save for revision, or open Thread.",
        "rows": [
          {
            "i": "ti-social",
            "c": "#D4537E",
            "t": "Community feed — latest posts",
            "b": null
          },
          {
            "i": "ti-arrow-up",
            "c": "#1D9E75",
            "t": "Upvote earns +2 RDM for the poster",
            "b": "bt"
          }
        ]
      },
      {
        "id": "db6",
        "lbl": "Memory Recall",
        "ico": "ti-brain",
        "c": "#AFA9EC",
        "rdm": 1,
        "tip": "2×6 Instacue flip grid",
        "ey": "Dashboard · Memory Recall",
        "ti": "Instacue memory recall grid",
        "de": "Cards due tomorrow in a 2×6 flip-card grid. Black cards, subject outline colours. Tap to flip — question front, answer back.",
        "rows": [
          {
            "i": "ti-cards",
            "c": "#AFA9EC",
            "t": "2×6 flip grid — subject outline colour",
            "b": "bp"
          },
          {
            "i": "ti-refresh",
            "c": "#1D9E75",
            "t": "Tap to flip: question → answer",
            "b": "bt"
          },
          {
            "i": "ti-flag",
            "c": "#EF9F27",
            "t": "Unsure → revision list",
            "b": "ba"
          }
        ]
      },
      {
        "id": "db7",
        "lbl": "Weak Areas",
        "ico": "ti-target",
        "c": "#EF9F27",
        "rdm": 1,
        "tip": "Flags chapters <10%",
        "ey": "Dashboard · Performance",
        "ti": "Performance and weak area flags",
        "de": "Click Subject Accuracy icon in greeting row to see all chapters by completion. Chapters below 10% flagged with direct links to start targeted mock.",
        "rows": [
          {
            "i": "ti-target",
            "c": "#EF9F27",
            "t": "Subject Accuracy flyout — click icon",
            "b": "ba"
          },
          {
            "i": "ti-alert-circle",
            "c": "#E24B4A",
            "t": "Weak area: Integrals at 4%",
            "b": null
          },
          {
            "i": "ti-writing",
            "c": "#7F77DD",
            "t": "Start targeted mock in one tap",
            "b": "bp"
          }
        ]
      }
    ]
  },
  {
    "id": "mw",
    "lbl": "Magic Wall",
    "ico": "ti-wand",
    "c": "#7F77DD",
    "bg": "#171425",
    "bd": "#7F77DD",
    "desc": "Social learning feed — scroll, engage, earn",
    "subs": [
      {
        "id": "mw1",
        "lbl": "Topics",
        "ico": "ti-filter",
        "c": "#AFA9EC",
        "rdm": 3,
        "tip": "Filter by subject",
        "ey": "Magic Wall · Filter",
        "ti": "Filter by topic and subject",
        "de": "Filter pills (All, Physics, Chemistry, Math) focus your feed. Posts are tagged with subject and chapter so you only see relevant content.",
        "rows": [
          {
            "i": "ti-filter",
            "c": "#AFA9EC",
            "t": "Filter pills: All / Physics / Chemistry / Math",
            "b": "bp"
          },
          {
            "i": "ti-tag",
            "c": "#1D9E75",
            "t": "Every post tagged with subject + chapter",
            "b": "bt"
          }
        ]
      },
      {
        "id": "mw2",
        "lbl": "Save",
        "ico": "ti-bookmark",
        "c": "#EF9F27",
        "rdm": 3,
        "tip": "+3 RDM per save",
        "ey": "Magic Wall · Save",
        "ti": "Save posts for revision",
        "de": "Tap Save for revision on any post (+3 RDM). Saved posts appear in Profile > Saved and can be converted to Instacue flashcards.",
        "rows": [
          {
            "i": "ti-bookmark",
            "c": "#EF9F27",
            "t": "Save for revision — +3 RDM",
            "b": "ba"
          },
          {
            "i": "ti-cards",
            "c": "#7F77DD",
            "t": "Convert saved post to Instacue card",
            "b": "bp"
          }
        ]
      },
      {
        "id": "mw3",
        "lbl": "Read / Revise",
        "ico": "ti-eye",
        "c": "#85B7EB",
        "rdm": 4,
        "tip": "Full post + thread",
        "ey": "Magic Wall · Read",
        "ti": "Read and engage with posts",
        "de": "Open any post for full content, comments and upvotes. Thread view shows complete discussion. Upvote helpful posts — +2 RDM to poster.",
        "rows": [
          {
            "i": "ti-eye",
            "c": "#85B7EB",
            "t": "Full content + comment thread",
            "b": "bb"
          },
          {
            "i": "ti-arrow-up",
            "c": "#1D9E75",
            "t": "Upvote → +2 RDM to poster",
            "b": "bt"
          }
        ]
      }
    ]
  },
  {
    "id": "le",
    "lbl": "Lessons",
    "ico": "ti-books",
    "c": "#1D9E75",
    "bg": "#0A2A20",
    "bd": "#1D9E75",
    "desc": "Full NCERT curriculum — chapter → topic → sub-topic",
    "subs": [
      {
        "id": "le1",
        "lbl": "Physics",
        "ico": "ti-atom",
        "c": "#85B7EB",
        "rdm": 2,
        "tip": "12 chapters, NCERT",
        "ey": "Lessons · Physics",
        "ti": "Physics — full curriculum",
        "de": "Complete Physics curriculum: mechanics, electrostatics, optics, thermodynamics, waves, modern physics. Class 11 & 12, aligned to CBSE, JEE and KCET.",
        "rows": [
          {
            "i": "ti-atom",
            "c": "#85B7EB",
            "t": "12 chapters · 80+ topics",
            "b": "bb"
          },
          {
            "i": "ti-star",
            "c": "#EF9F27",
            "t": "Electrostatics: 10–15% JEE Main",
            "b": "ba"
          }
        ]
      },
      {
        "id": "le2",
        "lbl": "Chemistry",
        "ico": "ti-flask",
        "c": "#9FE1CB",
        "rdm": 2,
        "tip": "Organic, inorganic, physical",
        "ey": "Lessons · Chemistry",
        "ti": "Chemistry — full curriculum",
        "de": "Organic, inorganic and physical chemistry. Class 11 & 12. Solutions chapter: 12 topics, 37 sub-topics with exam weightage shown.",
        "rows": [
          {
            "i": "ti-flask",
            "c": "#9FE1CB",
            "t": "Solutions: 12 topics, 37 sub-topics",
            "b": "bt"
          },
          {
            "i": "ti-chart-bar",
            "c": "#EF9F27",
            "t": "Electrochemistry: 5–8% CBSE Board",
            "b": "ba"
          }
        ]
      },
      {
        "id": "le3",
        "lbl": "Mathematics",
        "ico": "ti-math",
        "c": "#AFA9EC",
        "rdm": 2,
        "tip": "Calculus, algebra, geometry",
        "ey": "Lessons · Maths",
        "ti": "Mathematics — full curriculum",
        "de": "Calculus, algebra, geometry, statistics and probability. Full JEE Main, KCET and CBSE alignment with weightage per chapter.",
        "rows": [
          {
            "i": "ti-math",
            "c": "#AFA9EC",
            "t": "Integrals: 9 sub-topics, Class 12",
            "b": "bp"
          },
          {
            "i": "ti-star",
            "c": "#378ADD",
            "t": "Calculus: 15–20% JEE Main",
            "b": "bb"
          }
        ]
      },
      {
        "id": "le4",
        "lbl": "Sub-topics",
        "ico": "ti-list-tree",
        "c": "#1D9E75",
        "rdm": 4,
        "tip": "Quiz · Numerals · Instacue · Concepts",
        "ey": "Lessons · Sub-topics",
        "ti": "Topics, sub-topics and action icons",
        "de": "Each topic expands into sub-topics. At sub-topic level: Quiz (5 MCQs), Numerals, Instacue (flashcard), Concepts (theory + formulae). Icons at sub-topic level only.",
        "rows": [
          {
            "i": "ti-pencil",
            "c": "#1D9E75",
            "t": "Quiz — 5 adaptive MCQs",
            "b": "bt"
          },
          {
            "i": "ti-calculator",
            "c": "#378ADD",
            "t": "Numerals — JEE numerical input",
            "b": "bb"
          },
          {
            "i": "ti-cards",
            "c": "#D4537E",
            "t": "Instacue — create flashcard",
            "b": null
          },
          {
            "i": "ti-book",
            "c": "#EF9F27",
            "t": "Concepts — theory + formulae",
            "b": "ba"
          }
        ]
      }
    ]
  },
  {
    "id": "pm",
    "lbl": "Prep + Mock",
    "ico": "ti-writing",
    "c": "#E24B4A",
    "bg": "#1F0E0E",
    "bd": "#E24B4A",
    "desc": "Full-length mocks, AI calendar and revision wall",
    "subs": [
      {
        "id": "pm1",
        "lbl": "Classes",
        "ico": "ti-video",
        "c": "#F09595",
        "rdm": 2,
        "tip": "4 live/month on Pro",
        "ey": "Prep + Mock · Classes",
        "ti": "Live and recorded classes",
        "de": "4 live classes per month on Pro. Unlimited recorded library, chapter-tagged so you can watch exactly what you need before a mock.",
        "rows": [
          {
            "i": "ti-video",
            "c": "#F09595",
            "t": "4 live classes per month on Pro",
            "b": null
          },
          {
            "i": "ti-player-play",
            "c": "#1D9E75",
            "t": "Recorded library — unlimited access",
            "b": "bt"
          }
        ]
      },
      {
        "id": "pm2",
        "lbl": "Mock tests",
        "ico": "ti-writing",
        "c": "#E24B4A",
        "rdm": 3,
        "tip": "NTA · 2024–2008",
        "ey": "Prep + Mock · Tests",
        "ti": "Mock, past papers and more",
        "de": "Full-length JEE Main, KCET and CBSE mocks in NTA interface — timer, palette, flag for review, auto-submit. KCET past papers 2024→2008.",
        "rows": [
          {
            "i": "ti-writing",
            "c": "#E24B4A",
            "t": "JEE Main — 90 Q, 180 min",
            "b": null
          },
          {
            "i": "ti-history",
            "c": "#EF9F27",
            "t": "KCET past papers: 2024→2008",
            "b": "ba"
          },
          {
            "i": "ti-player-play",
            "c": "#1D9E75",
            "t": "Play button starts paper instantly",
            "b": "bt"
          }
        ]
      },
      {
        "id": "pm3",
        "lbl": "AI Calendar",
        "ico": "ti-calendar",
        "c": "#85B7EB",
        "rdm": 3,
        "tip": "Personalised study plan",
        "ey": "Prep + Mock · Calendar",
        "ti": "AI preparation calendar",
        "de": "Personalised study plan based on exam date, chapter coverage, weak topics and hours available. Auto-updates as performance improves.",
        "rows": [
          {
            "i": "ti-sparkles",
            "c": "#7F77DD",
            "t": "Plan auto-updates with mock scores",
            "b": "bp"
          },
          {
            "i": "ti-calendar",
            "c": "#85B7EB",
            "t": "~280 days to JEE — day-by-day",
            "b": "bb"
          }
        ]
      },
      {
        "id": "pm4",
        "lbl": "Revision Wall",
        "ico": "ti-refresh",
        "c": "#9FE1CB",
        "rdm": 2,
        "tip": "Saved + Unsure cards",
        "ey": "Prep + Mock · Revision",
        "ti": "Revision wall",
        "de": "All saved posts, bookmarked Gyan++ threads, and Unsure Instacue cards in one place. Filter by subject or chapter.",
        "rows": [
          {
            "i": "ti-bookmark",
            "c": "#9FE1CB",
            "t": "Saved posts and Gyan++ threads",
            "b": "bt"
          },
          {
            "i": "ti-cards",
            "c": "#AFA9EC",
            "t": "Unsure Instacue cards for re-review",
            "b": "bp"
          }
        ]
      }
    ]
  },
  {
    "id": "gy",
    "lbl": "Gyan++",
    "ico": "ti-help-circle",
    "c": "#D4537E",
    "bg": "#1F0E18",
    "bd": "#D4537E",
    "desc": "Live doubt wall — post, answer, upvote, comment",
    "subs": [
      {
        "id": "gy1",
        "lbl": "Post doubt",
        "ico": "ti-plus",
        "c": "#F4C0D1",
        "rdm": 3,
        "tip": "+5 RDM · AI <2s",
        "ey": "Gyan++ · Post",
        "ti": "Post any subject doubt",
        "de": "Post any PCM doubt. Prof-Pi answers in < 2 seconds. 1 free doubt/day on trial. Posting earns +5 RDM.",
        "rows": [
          {
            "i": "ti-plus",
            "c": "#F4C0D1",
            "t": "Prof-Pi answers in < 2 seconds",
            "b": null
          },
          {
            "i": "ti-bolt",
            "c": "#EF9F27",
            "t": "+5 RDM on posting",
            "b": "ba"
          },
          {
            "i": "ti-tag",
            "c": "#1D9E75",
            "t": "Tag subject + chapter",
            "b": "bt"
          }
        ]
      },
      {
        "id": "gy2",
        "lbl": "Get answers",
        "ico": "ti-message-circle",
        "c": "#D4537E",
        "rdm": 3,
        "tip": "AI + peers + teachers",
        "ey": "Gyan++ · Answers",
        "ti": "AI, peer and teacher answers",
        "de": "Answers from Prof-Pi, peers and teachers. Teacher Section has teal border and exam tips. Accept best answer → +40 RDM to the answerer.",
        "rows": [
          {
            "i": "ti-robot",
            "c": "#7F77DD",
            "t": "Prof-Pi — instant AI answer",
            "b": "bp"
          },
          {
            "i": "ti-school",
            "c": "#1D9E75",
            "t": "Teacher Section — teal border",
            "b": "bt"
          },
          {
            "i": "ti-circle-check",
            "c": "#EF9F27",
            "t": "Accept answer → +40 RDM",
            "b": "ba"
          }
        ]
      },
      {
        "id": "gy3",
        "lbl": "Upvote",
        "ico": "ti-arrow-up",
        "c": "#9FE1CB",
        "rdm": 2,
        "tip": "+2 RDM to poster",
        "ey": "Gyan++ · Upvote",
        "ti": "Upvote answers and questions",
        "de": "Upvote helpful questions, answers and teacher notes. Each upvote credits +2 RDM to the poster.",
        "rows": [
          {
            "i": "ti-arrow-up",
            "c": "#9FE1CB",
            "t": "Upvote on question or answer",
            "b": "bt"
          },
          {
            "i": "ti-coin",
            "c": "#EF9F27",
            "t": "+2 RDM per upvote to poster",
            "b": "ba"
          }
        ]
      },
      {
        "id": "gy4",
        "lbl": "Comment",
        "ico": "ti-message-2",
        "c": "#F4C0D1",
        "rdm": 2,
        "tip": "Comment any answer",
        "ey": "Gyan++ · Comments",
        "ti": "Comment on questions and answers",
        "de": "Add comments on any doubt, answer or teacher section. Comments appear in Student Comments and can be upvoted.",
        "rows": [
          {
            "i": "ti-message-2",
            "c": "#F4C0D1",
            "t": "Comment on question or any answer",
            "b": null
          },
          {
            "i": "ti-thumb-up",
            "c": "#1D9E75",
            "t": "Upvote comments for quality",
            "b": "bt"
          }
        ]
      }
    ]
  },
  {
    "id": "el",
    "lbl": "Earn & Learn",
    "ico": "ti-bolt",
    "c": "#EF9F27",
    "bg": "#281C08",
    "bd": "#EF9F27",
    "desc": "Buddy, referrals and challenges — earn more RDM",
    "subs": [
      {
        "id": "el1",
        "lbl": "Buddy",
        "ico": "ti-users",
        "c": "#FAC775",
        "rdm": 4,
        "tip": "1.25× RDM on buddy days",
        "ey": "Earn & Learn · Buddy",
        "ti": "Learning buddy system",
        "de": "Match with a buddy who has complementary knowledge gaps. Both completing the checklist on the same day = 1.25× RDM for that day.",
        "rows": [
          {
            "i": "ti-users",
            "c": "#FAC775",
            "t": "Buddy match — complementary gaps",
            "b": "ba"
          },
          {
            "i": "ti-star",
            "c": "#1D9E75",
            "t": "1.25× RDM on shared active day",
            "b": "bt"
          }
        ]
      },
      {
        "id": "el2",
        "lbl": "Referral",
        "ico": "ti-share",
        "c": "#97C459",
        "rdm": 3,
        "tip": "+150 signup · +500 sub",
        "ey": "Earn & Learn · Referral",
        "ti": "Referral bonus programme",
        "de": "Refer a friend: +150 RDM on signup. +500 RDM if they subscribe within 30 days. Three-level chain earns +200 RDM when your referee refers someone.",
        "rows": [
          {
            "i": "ti-share",
            "c": "#97C459",
            "t": "+150 RDM when friend signs up",
            "b": "bt"
          },
          {
            "i": "ti-trophy",
            "c": "#EF9F27",
            "t": "+500 RDM if friend subscribes ≤30 days",
            "b": "ba"
          }
        ]
      },
      {
        "id": "el3",
        "lbl": "Challenges",
        "ico": "ti-tournament",
        "c": "#FAC775",
        "rdm": 3,
        "tip": "MentaMill · FunBrain",
        "ey": "Earn & Learn · Challenges",
        "ti": "Earn RDM through challenges",
        "de": "MentaMill speed rounds, FunBrain puzzles, Quant Blitz and Logic Maze all earn RDM. Weekly challenges carry higher RDM pools.",
        "rows": [
          {
            "i": "ti-bolt",
            "c": "#EF9F27",
            "t": "MentaMill Blitz — speed MCQ (+10)",
            "b": "ba"
          },
          {
            "i": "ti-trophy",
            "c": "#1D9E75",
            "t": "Play Arena top-10 weekly bonus",
            "b": "bt"
          }
        ]
      }
    ]
  },
  {
    "id": "ef",
    "lbl": "EduFund",
    "ico": "ti-heart",
    "c": "#1D9E75",
    "bg": "#0A2A20",
    "bd": "#1D9E75",
    "desc": "Earn real educational grants through daily learning",
    "subs": [
      {
        "id": "ef1",
        "lbl": "Unlock EduFund",
        "ico": "ti-stairs-up",
        "c": "#9FE1CB",
        "rdm": 10,
        "tip": "₹3K → ₹12K → ₹50K",
        "ey": "EduFund · Unlock",
        "ti": "5 steps to unlock EduFund grants",
        "de": "Step 1: Subscribe. Step 2: Earn effective RDM daily. Step 3: Reach Sprout (5,000 eff. RDM + 60 active days = ₹3,000). Step 4: Submit proposal. Step 5: Donor reviews and awards.",
        "rows": [
          {
            "i": "ti-circle-check",
            "c": "#9FE1CB",
            "t": "Step 1 → Subscribe Starter or Pro",
            "b": "bt"
          },
          {
            "i": "ti-coin",
            "c": "#EF9F27",
            "t": "Step 2 → Earn effective RDM daily",
            "b": "ba"
          },
          {
            "i": "ti-plant",
            "c": "#1D9E75",
            "t": "Sprout: 5,000 RDM + 60 days = ₹3,000",
            "b": "bt"
          },
          {
            "i": "ti-award",
            "c": "#7F77DD",
            "t": "Champion: 40,000 RDM + 180 days = ₹50,000",
            "b": "bp"
          }
        ]
      }
    ]
  },
  {
    "id": "nb",
    "lbl": "News & Blogs",
    "ico": "ti-news",
    "c": "#85B7EB",
    "bg": "#0D1E30",
    "bd": "#85B7EB",
    "desc": "Exam news, topper stories and study guides",
    "subs": [
      {
        "id": "nb1",
        "lbl": "News",
        "ico": "ti-news",
        "c": "#85B7EB",
        "rdm": 5,
        "tip": "+3 RDM per article",
        "ey": "News & Blogs · News",
        "ti": "Latest exam news",
        "de": "Live exam news — JEE Main dates, KCET notifications, Board schedules, NCERT updates. Date-sorted, newest first. Reading earns +3 RDM.",
        "rows": [
          {
            "i": "ti-news",
            "c": "#85B7EB",
            "t": "JEE Main 2026 session dates",
            "b": "bb"
          },
          {
            "i": "ti-bolt",
            "c": "#1D9E75",
            "t": "+3 RDM for reading an article",
            "b": "bt"
          }
        ]
      },
      {
        "id": "nb2",
        "lbl": "Blogs",
        "ico": "ti-article",
        "c": "#AFA9EC",
        "rdm": 5,
        "tip": "Tips · Toppers · Syllabus",
        "ey": "News & Blogs · Blogs",
        "ti": "Blogs with categories and filters",
        "de": "Study strategies, topper interviews, chapter deep-dives and career guidance. Filter by Tips & Tricks, Toppers, Syllabus Updates, or Motivation.",
        "rows": [
          {
            "i": "ti-filter",
            "c": "#AFA9EC",
            "t": "Filter: Tips / Toppers / Syllabus",
            "b": "bp"
          },
          {
            "i": "ti-star",
            "c": "#EF9F27",
            "t": "Past Topper interviews + strategies",
            "b": "ba"
          }
        ]
      }
    ]
  },
  {
    "id": "rw",
    "lbl": "RDM Wallet",
    "ico": "ti-coin",
    "c": "#EF9F27",
    "bg": "#281C08",
    "bd": "#EF9F27",
    "desc": "Your RDM balance, activity log and earn guide",
    "subs": [
      {
        "id": "rw1",
        "lbl": "What is RDM?",
        "ico": "ti-info-circle",
        "c": "#FAC775",
        "rdm": 3,
        "tip": "Learning currency",
        "ey": "RDM Wallet · Explainer",
        "ti": "What is RDM?",
        "de": "RDM (Reward and Motivation) is EduBlast's learning currency. Effective RDM = face value × subscription multiplier. Determines EduFund grant eligibility.",
        "rows": [
          {
            "i": "ti-coin",
            "c": "#FAC775",
            "t": "RDM = Reward and Motivation currency",
            "b": "ba"
          },
          {
            "i": "ti-star",
            "c": "#1D9E75",
            "t": "Effective RDM = face value × multiplier",
            "b": "bt"
          }
        ]
      },
      {
        "id": "rw2",
        "lbl": "Breakdown",
        "ico": "ti-chart-pie",
        "c": "#EF9F27",
        "rdm": 3,
        "tip": "Balance · log",
        "ey": "RDM Wallet · Breakdown",
        "ti": "Your RDM breakdown",
        "de": "Shows: earned this week, total balance, active multiplier, effective EduFund RDM, and 30-day activity log with every earn and deduct event.",
        "rows": [
          {
            "i": "ti-chart-pie",
            "c": "#EF9F27",
            "t": "Balance · Multiplier · Effective RDM",
            "b": "ba"
          },
          {
            "i": "ti-list",
            "c": "#378ADD",
            "t": "30-day log with timestamps",
            "b": "bb"
          }
        ]
      },
      {
        "id": "rw3",
        "lbl": "How to earn",
        "ico": "ti-list-check",
        "c": "#9FE1CB",
        "rdm": 4,
        "tip": "All earn types listed",
        "ey": "RDM Wallet · Earn guide",
        "ti": "How to earn RDM — all methods",
        "de": "Login +20 · DailyDose +10 · 100% +25 · Gyan++ +5 · Accepted +40 · Upvote +2 · Referral signup +150 · Subscribes +500 · 7-day streak +100 · 90-day +500 · Save post +3.",
        "rows": [
          {
            "i": "ti-bolt",
            "c": "#9FE1CB",
            "t": "DailyDose +10 · 100% accuracy +25",
            "b": "bt"
          },
          {
            "i": "ti-flame",
            "c": "#D4537E",
            "t": "7-day streak +100 · 90-day +500",
            "b": null
          },
          {
            "i": "ti-share",
            "c": "#EF9F27",
            "t": "Referral signup +150 · Subscribes +500",
            "b": "ba"
          }
        ]
      }
    ]
  },
  {
    "id": "pr",
    "lbl": "Profile",
    "ico": "ti-user-circle",
    "c": "#AFA9EC",
    "bg": "#171425",
    "bd": "#AFA9EC",
    "desc": "Personal info, academics, EduFund, saved posts",
    "subs": [
      {
        "id": "pr1",
        "lbl": "All sections",
        "ico": "ti-user-circle",
        "c": "#AFA9EC",
        "rdm": 10,
        "tip": "Info · academics · saved",
        "ey": "Profile · All sections",
        "ti": "Your complete profile",
        "de": "Six sections: Personal Info, Academic Record, Subscription Status, Activity Track Record, Saved Posts, and EduFund Proposal status.",
        "rows": [
          {
            "i": "ti-user",
            "c": "#AFA9EC",
            "t": "Personal info — name, photo, class",
            "b": "bp"
          },
          {
            "i": "ti-certificate",
            "c": "#1D9E75",
            "t": "Academic record — Class 10 + exam",
            "b": "bt"
          },
          {
            "i": "ti-heart",
            "c": "#EF9F27",
            "t": "EduFund proposal + track record",
            "b": "ba"
          },
          {
            "i": "ti-bookmark",
            "c": "#85B7EB",
            "t": "Saved posts from Magic Wall",
            "b": "bb"
          }
        ]
      }
    ]
  }
];

export const SITE_TOUR_CAROUSEL_FLAT: SiteTourFlatStep[] = [];
for (const menu of SITE_TOUR_CAROUSEL_MENUS) {
  for (const sub of menu.subs) {
    SITE_TOUR_CAROUSEL_FLAT.push({ mid: menu.id, sid: sub.id, rdm: sub.rdm });
  }
}

export const SITE_TOUR_CAROUSEL_TOTAL_STEPS = SITE_TOUR_CAROUSEL_FLAT.length;

export function getSiteTourMenu(menuId: string): SiteTourMenu | undefined {
  return SITE_TOUR_CAROUSEL_MENUS.find((m) => m.id === menuId);
}

export function getSiteTourSubFeature(
  menuId: string,
  subId: string
): SiteTourSubFeature | undefined {
  const menu = getSiteTourMenu(menuId);
  return menu?.subs.find((s) => s.id === subId);
}

/** Inject live Site-tour totals into the "What is RDM?" slide (rw1). */
export function siteTourWhatIsRdmSlide(
  sub: SiteTourSubFeature,
  subId: string,
  claimRdm: number,
  counterTotal: number
): SiteTourSubFeature {
  if (subId !== "rw1") return sub;
  return {
    ...sub,
    de:
      `RDM (Reward and Motivation) is EduBlast's learning currency. ` +
      `Complete the full Site-tour to receive +${claimRdm} RDM once to your wallet. ` +
      `The header counter adds up to ${counterTotal} RDM as you read each feature — that tally is progress only, not extra payouts on top of the +${claimRdm} reward. ` +
      `Effective RDM = face value × subscription multiplier (EduFund eligibility).`,
    rows: [
      ...sub.rows,
      {
        i: "ti-route",
        c: "#9FE1CB",
        t: `Site-tour finish → +${claimRdm} RDM one-time (only real wallet credit)`,
        b: "bt",
      },
      {
        i: "ti-list-numbers",
        c: "#378ADD",
        t: `Tour counter totals ${counterTotal} RDM across all slides — same +${claimRdm} at the end`,
        b: "bb",
      },
    ],
  };
}

export function snapshotBadgeLabel(badge: SnapshotRowBadge): string | null {
  if (!badge) return null;
  switch (badge) {
    case "bt":
      return "Active";
    case "ba":
      return "RDM";
    case "bb":
      return "Info";
    case "bp":
      return "Module";
    default: {
      const _exhaustive: never = badge;
      return _exhaustive;
    }
  }
}

export function siteTourCarouselTotalPossibleRdm(): number {
  return SITE_TOUR_CAROUSEL_FLAT.reduce((sum, step) => sum + step.rdm, 0);
}

export function siteTourMenuSectionRdm(menu: SiteTourMenu): number {
  return menu.subs.reduce((sum, sub) => sum + sub.rdm, 0);
}
