export type WizardTask = {
  emoji: string;
  emojiBorderBgClass: string;
  title: string;
  steps: { label: string }[];
  main: {
    badge: string;
    title: { before: string; emphasis: string; after?: string };
    subtitle: string;
    stepTabs: string[];
  };
};

export const WIZARD_TASKS: WizardTask[] = [
  {
    emoji: "🏫",
    emojiBorderBgClass: "border-emerald-400/25 bg-emerald-500/10",
    title: "Create a classroom, add sections & invite students",
    steps: [
      { label: "Name your classroom & set subject" },
      { label: "Choose PUC level & exam target" },
      { label: "Add sections (real schedule + calendar sync)" },
      { label: "Review & launch classroom" },
    ],
    main: {
      badge: "🏫 Task 1 of 7 · Create classroom",
      title: { before: "Create your ", emphasis: "classroom" },
      subtitle: "Set up a new classroom batch, add sections, and launch — all in 4 steps.",
      stepTabs: ["Name & Subject", "Level & Target", "Add Sections", "Review & Launch"],
    },
  },
  {
    emoji: "📝",
    emojiBorderBgClass: "border-violet-400/25 bg-violet-500/10",
    title: "Create an assignment & assign to students or sections",
    steps: [
      { label: "Choose assignment type & topic" },
      { label: "Configure questions, marks & time" },
      { label: "Assign to — student / section / full class" },
      { label: "Set due date, RDM reward & publish" },
    ],
    main: {
      badge: "📝 Task 2 of 7 · Create assignment",
      title: { before: "Create an ", emphasis: "assignment" },
      subtitle:
        "Build a quiz, mock, or routine challenge and assign it to exactly who needs it — in 4 steps.",
      stepTabs: ["Type & Topic", "Configure", "Assign To", "Due Date & Publish"],
    },
  },
  {
    emoji: "📅",
    emojiBorderBgClass: "border-sky-400/25 bg-sky-500/10",
    title: "Schedule a lesson / webinar — let students register interest",
    steps: [
      { label: "Title & classroom" },
      { label: "Date, time & Google Meet" },
      { label: "Pre-work resources" },
      { label: "Post-work assignment" },
      { label: "Trial & publish" },
    ],
    main: {
      badge: "📅 Task 3 of 7 · Schedule lesson",
      title: { before: "Schedule a ", emphasis: "lesson / webinar" },
      subtitle:
        "Five steps with a top stepper — same scheduling logic as My Classes (calendar, Meet, pre/post work).",
      stepTabs: ["Title & Classroom", "Date & Meet", "Pre-work", "Post-work", "Trial & Publish"],
    },
  },
  {
    emoji: "📄",
    emojiBorderBgClass: "border-amber-400/25 bg-amber-500/10",
    title: "Create an offline test paper as PDF — assign or email",
    steps: [
      { label: "Choose exam — CBSE / KCET / JEE" },
      { label: "Select class, scope & subject" },
      { label: "Questions — count & presets" },
      { label: "Source & duration, then generate" },
      { label: "Preview PDF, download, print, or assign" },
    ],
    main: {
      badge: "📄 Task 4 of 7 · PDF test paper",
      title: { before: "Create an offline ", emphasis: "PDF test paper" },
      subtitle:
        "Generate a print-ready test paper and download or email it to students — in 5 steps.",
      stepTabs: ["Exam Type", "Class & Scope", "Questions", "Source & Duration", "Generate"],
    },
  },
  {
    emoji: "🎯",
    emojiBorderBgClass: "border-amber-400/25 bg-amber-500/10",
    title: "Nudge students with RDM rewards to study or attempt tests",
    steps: [
      { label: "Choose who to nudge" },
      { label: "Select nudge goal" },
      { label: "Write personalised message / template" },
      { label: "Set RDM bonus & send" },
    ],
    main: {
      badge: "🎯 Task 5 of 7 · Nudge with RDM",
      title: { before: "Nudge students with ", emphasis: "RDM rewards" },
      subtitle:
        "Re-engage students with personalised messages; assignment-linked RDM bonuses pay on send and credit when work is done.",
      stepTabs: ["Choose who", "Nudge goal", "Write message", "RDM & Send"],
    },
  },
  {
    emoji: "📊",
    emojiBorderBgClass: "border-emerald-400/25 bg-emerald-500/10",
    title: "Check assignment progress per student & send reminders",
    steps: [
      { label: "Select classroom & assignment" },
      { label: "View per-student submission status" },
      { label: "Send reminder to pending students" },
    ],
    main: {
      badge: "📊 Task 6 of 7 · Check progress",
      title: { before: "Check ", emphasis: "assignment progress" },
      subtitle: "See who submitted, who is pending, and send reminders — in 3 steps.",
      stepTabs: ["Select assignment", "View submissions", "Send reminder"],
    },
  },
  {
    emoji: "💬",
    emojiBorderBgClass: "border-fuchsia-400/25 bg-fuchsia-500/10",
    title: "Review student progress & send advice or counsel them",
    steps: [
      { label: "Select student from your classrooms" },
      { label: "Review their progress — scores, streaks, weak areas" },
      { label: "Write advice note / counselling template" },
      { label: "Send counselling message (advice only)" },
    ],
    main: {
      badge: "💬 Task 7 of 7 · Counsel student",
      title: { before: "Review progress & ", emphasis: "counsel", after: " a student" },
      subtitle:
        "See a student's snapshot and send them a personalised counselling note — in 4 steps.",
      stepTabs: ["Select student", "Review progress", "Write advice", "Send message"],
    },
  },
];
