"use client";

import { useState } from "react";
import PersonaStudentTab from "./PersonaStudentTab";
import PersonaCoachingTab from "./PersonaCoachingTab";
import PersonaTeacherTab from "./PersonaTeacherTab";
import PersonaParentTab from "./PersonaParentTab";

const TABS = [
  { id: "student", label: "I am a student", activeBg: "#E1F5EE", activeBorder: "#1D9E75", activeText: "#085041" },
  { id: "coaching", label: "I am at a coaching class", activeBg: "#FAECE7", activeBorder: "#D85A30", activeText: "#4A1B0C" },
  { id: "teacher", label: "I am a teacher", activeBg: "#EEEDFE", activeBorder: "#534AB7", activeText: "#26215C" },
  { id: "parent", label: "I am a parent", activeBg: "#FAEEDA", activeBorder: "#EF9F27", activeText: "#412402" },
] as const;

type TabId = (typeof TABS)[number]["id"];

export default function PersonaSection() {
  const [active, setActive] = useState<TabId>("student");

  return (
    <section id="personas" className="px-5 md:px-10 py-10 border-b border-gray-200/60">
      <div className="max-w-[1200px] mx-auto">
        <p className="text-xs font-medium tracking-[0.06em] text-gray-400 uppercase mb-[6px]">
          Who is EduBlast for?
        </p>
        <h2 className="text-xl md:text-[26px] font-medium text-gray-900 leading-[1.3] mb-7">
          Pick your story. It is probably yours.
        </h2>

        {/* Tab triggers */}
        <div className="flex flex-wrap gap-[6px] mb-7">
          {TABS.map((t) => {
            const isActive = active === t.id;
            return (
              <button
                key={t.id}
                onClick={() => setActive(t.id)}
                className="rounded-lg px-[18px] py-2 text-sm transition-colors border"
                style={
                  isActive
                    ? { background: t.activeBg, borderColor: t.activeBorder, color: t.activeText, fontWeight: 500 }
                    : { background: "white", borderColor: "#e5e5e5", color: "#6b7280" }
                }
              >
                {t.label}
              </button>
            );
          })}
        </div>

        {/* Tab panels */}
        {active === "student" && <PersonaStudentTab />}
        {active === "coaching" && <PersonaCoachingTab />}
        {active === "teacher" && <PersonaTeacherTab />}
        {active === "parent" && <PersonaParentTab />}
      </div>
    </section>
  );
}
