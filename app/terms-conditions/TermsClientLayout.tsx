"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import LandingNavbar from "@/components/landing/LandingNavbar";
import { INVESTOR_NAV_LINKS } from "@/components/landing/landing-constants";

type DocId = "overview" | "tnc" | "pp";

const SIDEBAR_SECTIONS: Record<
  DocId,
  { id: string; icon: string; label: string; href?: string; scrollTo?: string }[]
> = {
  overview: [
    { id: "overview", icon: "ti ti-files", label: "Document overview", href: "/terms-conditions" },
    {
      id: "tnc",
      icon: "ti ti-file-text",
      label: "Terms & Conditions",
      href: "/terms-conditions/terms-and-conditions",
    },
    {
      id: "pp",
      icon: "ti ti-shield-lock",
      label: "Privacy Policy",
      href: "/terms-conditions/privacy-policy",
    },
    {
      id: "q-tnc-2",
      icon: "ti ti-users",
      label: "User eligibility",
      href: "/terms-conditions/terms-and-conditions",
      scrollTo: "tnc-2",
    },
    {
      id: "q-tnc-6",
      icon: "ti ti-coin",
      label: "RDM & EduFund rules",
      href: "/terms-conditions/terms-and-conditions",
      scrollTo: "tnc-6",
    },
    {
      id: "q-pp-3",
      icon: "ti ti-eye",
      label: "Data we collect",
      href: "/terms-conditions/privacy-policy",
      scrollTo: "pp-3",
    },
    {
      id: "q-pp-7",
      icon: "ti ti-user-check",
      label: "Your DPDP rights",
      href: "/terms-conditions/privacy-policy",
      scrollTo: "pp-7",
    },
    {
      id: "q-pp-10",
      icon: "ti ti-device-mobile",
      label: "Minor & child safety",
      href: "/terms-conditions/privacy-policy",
      scrollTo: "pp-10",
    },
    {
      id: "q-pp-12",
      icon: "ti ti-mail",
      label: "Grievance officer",
      href: "/terms-conditions/privacy-policy",
      scrollTo: "pp-12",
    },
  ],
  tnc: [
    { id: "tnc-1", icon: "ti ti-circle-number-1", label: "Definitions" },
    { id: "tnc-2", icon: "ti ti-circle-number-2", label: "User eligibility" },
    { id: "tnc-3", icon: "ti ti-circle-number-3", label: "Account registration" },
    { id: "tnc-4", icon: "ti ti-circle-number-4", label: "Platform use rules" },
    { id: "tnc-5", icon: "ti ti-circle-number-5", label: "Content & IP" },
    { id: "tnc-6", icon: "ti ti-circle-number-6", label: "RDM & EduFund" },
    { id: "tnc-7", icon: "ti ti-circle-number-7", label: "Subscriptions & payments" },
    { id: "tnc-8", icon: "ti ti-circle-number-8", label: "Teacher accounts" },
    { id: "tnc-9", icon: "ti ti-circle-number-9", label: "AI features" },
    { id: "tnc-10", icon: "ti ti-circle-number-10", label: "Termination" },
    { id: "tnc-11", icon: "ti ti-circle-number-11", label: "Liability & disclaimer" },
    { id: "tnc-12", icon: "ti ti-circle-number-12", label: "Governing law" },
  ],
  pp: [
    { id: "pp-1", icon: "ti ti-circle-number-1", label: "About this policy" },
    { id: "pp-2", icon: "ti ti-circle-number-2", label: "Data fiduciary" },
    { id: "pp-3", icon: "ti ti-circle-number-3", label: "Data we collect" },
    { id: "pp-4", icon: "ti ti-circle-number-4", label: "Purpose & legal basis" },
    { id: "pp-5", icon: "ti ti-circle-number-5", label: "Data retention" },
    { id: "pp-6", icon: "ti ti-circle-number-6", label: "Data sharing" },
    { id: "pp-7", icon: "ti ti-circle-number-7", label: "Your DPDP rights" },
    { id: "pp-8", icon: "ti ti-circle-number-8", label: "Consent management" },
    { id: "pp-9", icon: "ti ti-circle-number-9", label: "Security" },
    { id: "pp-10", icon: "ti ti-circle-number-10", label: "Minors & child safety" },
    { id: "pp-11", icon: "ti ti-circle-number-11", label: "Cookies & tracking" },
    { id: "pp-12", icon: "ti ti-circle-number-12", label: "Grievance officer" },
  ],
};

export default function TermsClientLayout({ children }: { children: React.ReactNode }) {
  const pathname = usePathname();

  const activeDoc: DocId = pathname.includes("/privacy-policy")
    ? "pp"
    : pathname.includes("/terms-and-conditions")
      ? "tnc"
      : "overview";

  const sidebarItems = SIDEBAR_SECTIONS[activeDoc];

  const scrollToSection = (id: string) => {
    const el = document.getElementById(id);
    if (el) el.scrollIntoView({ behavior: "smooth" });
  };

  return (
    <div className="min-h-screen bg-[#0E1117] text-[#E8EAF0]">
      <link
        rel="stylesheet"
        href="https://cdn.jsdelivr.net/npm/@tabler/icons-webfont@latest/dist/tabler-icons.min.css"
      />
      <LandingNavbar variant="dark" navLinks={INVESTOR_NAV_LINKS} />

      {/* Top nav toggles */}
      <div className="sticky top-[50px] z-10 flex flex-wrap items-center gap-1.5 border-b border-white/10 bg-[#161B25] px-3 py-2 md:px-5">
        <Link
          href="/terms-conditions"
          className={`rounded-lg border px-2.5 py-1.5 text-[11px] font-medium transition-colors md:px-3.5 md:text-xs ${
            activeDoc === "overview"
              ? "border-[#1D9E75] bg-[#0A2A20] text-[#9FE1CB]"
              : "border-white/10 bg-transparent text-white/50 hover:bg-white/5"
          }`}
        >
          Overview
        </Link>
        <Link
          href="/terms-conditions/terms-and-conditions"
          className={`rounded-lg border px-2.5 py-1.5 text-[11px] font-medium transition-colors md:px-3.5 md:text-xs ${
            activeDoc === "tnc"
              ? "border-[#1D9E75] bg-[#0A2A20] text-[#9FE1CB]"
              : "border-white/10 bg-transparent text-white/50 hover:bg-white/5"
          }`}
        >
          <span className="md:hidden">T&amp;C</span>
          <span className="hidden md:inline">Terms &amp; Conditions</span>
        </Link>
        <Link
          href="/terms-conditions/privacy-policy"
          className={`rounded-lg border px-2.5 py-1.5 text-[11px] font-medium transition-colors md:px-3.5 md:text-xs ${
            activeDoc === "pp"
              ? "border-[#1D9E75] bg-[#0A2A20] text-[#9FE1CB]"
              : "border-white/10 bg-transparent text-white/50 hover:bg-white/5"
          }`}
        >
          <span className="md:hidden">Privacy</span>
          <span className="hidden md:inline">Privacy Policy</span>
        </Link>
      </div>

      <div className="flex min-h-[calc(100vh-100px)]">
        {/* Sidebar */}
        <aside className="hidden w-[230px] shrink-0 border-r border-white/10 bg-[#161B25] p-4 md:block">
          <nav className="space-y-0.5">
            {sidebarItems.map((item) => {
              const isQuickRef = item.id.startsWith("q-");
              if (isQuickRef && activeDoc === "overview") {
                return (
                  <div key={item.id}>
                    {item.id === "q-tnc-2" && (
                      <div className="mb-1 mt-4 px-2 text-[10px] font-medium uppercase tracking-widest text-white/20">
                        Quick reference
                      </div>
                    )}
                    <Link
                      href={`${item.href}${item.scrollTo ? `#${item.scrollTo}` : ""}`}
                      className="flex w-full items-center gap-2 rounded-lg px-2 py-1.5 text-xs text-white/40 transition-colors hover:bg-white/5 hover:text-white/70"
                    >
                      <i className={`${item.icon} text-sm`} />
                      {item.label}
                    </Link>
                  </div>
                );
              }
              if (item.href) {
                return (
                  <Link
                    key={item.id}
                    href={item.href}
                    className="flex w-full items-center gap-2 rounded-lg px-2 py-1.5 text-xs text-white/40 transition-colors hover:bg-white/5 hover:text-white/70"
                  >
                    <i className={`${item.icon} text-sm`} />
                    {item.label}
                  </Link>
                );
              }
              return (
                <button
                  key={item.id}
                  onClick={() => scrollToSection(item.id)}
                  className="flex w-full items-center gap-2 rounded-lg px-2 py-1.5 text-xs text-white/40 transition-colors hover:bg-white/5 hover:text-white/70"
                >
                  <i className={`${item.icon} text-sm`} />
                  {item.label}
                </button>
              );
            })}
          </nav>
        </aside>

        {/* Main content */}
        <main className="flex-1 overflow-y-auto px-4 py-6 md:px-8 md:py-7 lg:max-w-[760px]">
          {children}
        </main>
      </div>
    </div>
  );
}
