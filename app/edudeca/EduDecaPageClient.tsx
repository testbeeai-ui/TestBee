"use client";

import Link from "next/link";

import { EduDecaRegistrationPanel } from "@/components/edudeca/EduDecaRegistrationPanel";
import { PublicMarketingShell } from "@/components/landing/PublicMarketingShell";

export default function EduDecaPageClient() {
  return (
    <PublicMarketingShell>
      {({ isInAppShell }) => <EduDecaPageBody isInAppShell={isInAppShell} />}
    </PublicMarketingShell>
  );
}

function EduDecaPageBody({ isInAppShell }: { isInAppShell: boolean }) {
  return (
    <div
      className={
        isInAppShell
          ? "relative flex min-h-full flex-1 flex-col overflow-hidden bg-[#0E1117] text-[#EAEFF5]"
          : "relative overflow-hidden text-[#EAEFF5]"
      }
    >
      <div className="pointer-events-none absolute inset-x-0 top-0 h-[420px] bg-[radial-gradient(ellipse_at_center_top,rgba(29,158,117,0.12),transparent_70%)]" />

      <div className="relative mx-auto w-full max-w-3xl px-4 pb-16 pt-6 sm:px-6 sm:pb-20 sm:pt-8">
        <nav className="mb-8 flex items-center gap-2 text-xs text-[#8B96A5]">
          <Link
            href={isInAppShell ? "/home" : "/"}
            className="transition-colors hover:text-[#EAEFF5]"
          >
            {isInAppShell ? "Dashboard" : "Home"}
          </Link>
          <span aria-hidden>/</span>
          <span className="text-[#EAEFF5]">EduDeca</span>
        </nav>

        <EduDecaRegistrationPanel />
      </div>
    </div>
  );
}
