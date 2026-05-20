export type ProposalCategory =
  | "Learning Device"
  | "Books & Materials"
  | "Lab Equipment"
  | "Course Fee";

export interface ProposalBadge {
  label: string;
}

export interface Proposal {
  id: string;
  profileId: string;
  title: string;
  story: string;
  fullStory: string;
  category: ProposalCategory;
  goal: number;
  raised: number;
  supporters: number;
  postedDate: string;
  badges: ProposalBadge[];
}

/** 5 dummy proposals for EduFund feed. profileId resolved at render (use user?.id). */
export const DUMMY_PROPOSALS: Proposal[] = [
  {
    id: "1",
    profileId: "",
    title: "Need a laptop for JEE Advanced preparation",
    story:
      "I am preparing for JEE Advanced 2026. My current device is very old and crashes during online mock tests. A basic laptop would help me access study materials and practice tests consistently.",
    fullStory: `I am a Class 12 PCM student preparing for JEE Advanced 2026. My family cannot afford a new laptop, and my current device is over 8 years old—it crashes during online mock tests and freezes when running multiple tabs.

A basic laptop would allow me to:
• Attend live doubt sessions without interruptions
• Take timed mock tests in exam-like conditions
• Access NCERT solutions and video lectures smoothly
• Practice coding for the new pattern sections

I have secured 92% in Class 10 and am consistently in the top 10 of my school. I am determined to crack JEE and pursue engineering. Any support would mean the world to me.`,
    category: "Learning Device",
    goal: 25000,
    raised: 12500,
    supporters: 18,
    postedDate: "12 Feb 2026",
    badges: [
      { label: "Scholar Rank" },
      { label: "28 Accepted Answers" },
      { label: "7-day Streak" },
      { label: "Physics Pro" },
    ],
  },
  {
    id: "2",
    profileId: "",
    title: "Biology reference books for NEET preparation",
    story:
      "I need NCERT supplement books and a good biology reference for NEET. My school library has limited copies and I cannot afford to buy them. These books will help me ace the biology section.",
    fullStory: `I am a Class 12 PCB student aiming for NEET 2026. Biology carries 360 marks in NEET and I need strong reference books alongside NCERT to master concepts like genetics, plant physiology, and human physiology.

The books I need:
• Trueman's Biology (Volume 1 & 2) for NEET
• MTG NCERT at your fingertips
• Previous years' question bank

My family runs a small shop and cannot afford these books. I have been borrowing from friends but need my own copies for regular revision. I scored 94% in Class 10 and am working hard to secure a government medical seat.

Your support will help me access quality study material and chase my dream of becoming a doctor.`,
    category: "Books & Materials",
    goal: 4500,
    raised: 4320,
    supporters: 43,
    postedDate: "8 Feb 2026",
    badges: [
      { label: "Scholar Rank" },
      { label: "15 Accepted Answers" },
      { label: "3-day Streak" },
      { label: "Biology Master" },
    ],
  },
  {
    id: "3",
    profileId: "",
    title: "Chemistry lab equipment for practicals",
    story:
      "Our school lab lacks basic equipment. I need a personal titration set and safety gear to practice Class 12 practicals at home. This will help me score well in the practical exams.",
    fullStory: `I am a Class 12 Science student. Our school chemistry lab has limited equipment and only 2–3 students get hands-on practice per session. The board practical exam carries 30 marks and I want to perform well.

I need:
• A basic titration set (burette, pipette, conical flask)
• Safety goggles and lab coat
• A few basic reagents for titration practice

My father is a daily wage worker. Buying lab equipment is beyond our means. I have been using diagrams and videos to learn, but practical experience is crucial.

I have answered 34 chemistry doubts on this platform and received the "Chemistry Pro" badge. I am committed to learning. Your support will give me the tools to excel.`,
    category: "Lab Equipment",
    goal: 3500,
    raised: 2100,
    supporters: 12,
    postedDate: "10 Feb 2026",
    badges: [
      { label: "Expert Rank" },
      { label: "34 Accepted Answers" },
      { label: "Chemistry Pro" },
      { label: "Bounty King" },
    ],
  },
  {
    id: "4",
    profileId: "",
    title: "Online coaching subscription for JEE Main",
    story:
      "I cannot afford paid coaching. An online subscription to a reputable JEE platform would give me access to structured lectures, doubt sessions, and mock tests. This would level the field for me.",
    fullStory: `I am from a small town in Rajasthan. There are no good coaching institutes nearby. My parents work in agriculture and cannot afford residential coaching in Kota or other cities.

An online coaching subscription (6–12 months) would provide:
• Structured video lectures for Physics, Chemistry, and Math
• Live doubt clearing sessions
• Chapter-wise tests and full-length mocks
• Performance analytics and weak area identification

I have been studying from free YouTube channels but need a structured curriculum to stay on track for JEE Main 2026. I have completed 5 mock tests on this platform and maintain a 7-day streak.

Education is my only way forward. Your contribution will help me compete fairly with students who have access to coaching.`,
    category: "Course Fee",
    goal: 12000,
    raised: 11520,
    supporters: 28,
    postedDate: "5 Feb 2026",
    badges: [
      { label: "Scholar Rank" },
      { label: "22 Accepted Answers" },
      { label: "7-day Streak" },
      { label: "Mock Test Topper" },
    ],
  },
  {
    id: "5",
    profileId: "",
    title: "Scientific calculator for Board and competitive exams",
    story:
      "I need a scientific calculator approved for JEE and Board exams. My old one has a damaged display. A new one is essential for solving numericals in Physics, Chemistry, and Math.",
    fullStory: `I am preparing for both CBSE Class 12 Board exams and JEE Main 2026. A scientific calculator is mandatory for both—used for logarithms, trigonometry, and complex calculations in Physics and Chemistry.

My current calculator has a cracked display and sometimes gives wrong readings. It is not reliable for exam conditions. The approved models (e.g., Casio fx-991MS) cost around ₹1,200–1,500.

My mother is a single parent working as a tailor. We manage basic expenses but cannot afford this extra cost. I have been practicing with phone calculator apps, but those are not allowed in exams.

I am in the top 5 of my class and have 10+ accepted answers on doubts. A calculator would remove a major hurdle in my preparation. Thank you for considering.`,
    category: "Learning Device",
    goal: 1500,
    raised: 900,
    supporters: 8,
    postedDate: "15 Feb 2026",
    badges: [
      { label: "Scholar Rank" },
      { label: "10 Accepted Answers" },
      { label: "3-day Streak" },
    ],
  },
];
