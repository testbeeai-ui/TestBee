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
          ? "flex min-h-full flex-1 flex-col bg-[#0E1117] text-[#EAEFF5]"
          : undefined
      }
    >
      <div className="mx-auto w-full max-w-[1080px] px-4 sm:px-6 lg:px-8">
        <nav className="flex items-center gap-2 pt-5 text-xs text-[#8B96A5] sm:pt-6">
          <Link
            href={isInAppShell ? "/home" : "/"}
            className="transition-colors hover:text-[#EAEFF5]"
          >
            {isInAppShell ? "Dashboard" : "Home"}
          </Link>
          <span aria-hidden>/</span>
          <span className="text-[#EAEFF5]">EduDeca</span>
        </nav>

        <section className="relative overflow-hidden py-10 text-center sm:py-14">
          <div className="pointer-events-none absolute -top-16 left-1/2 h-[280px] w-[min(100%,640px)] -translate-x-1/2 bg-[radial-gradient(ellipse_at_center,rgba(29,158,117,0.14),transparent_65%)]" />
          <h1 className="relative z-10 text-3xl font-extrabold tracking-tight sm:text-4xl">
            EduDeca
          </h1>
          <p className="relative z-10 mx-auto mt-3 max-w-xl text-sm leading-relaxed text-[#8B96A5] sm:text-base">
            Class 11 and Class 12 on EduBlast.
          </p>
        </section>

        <section
          id="edudeca-content"
          aria-label="EduDeca page content"
          className="mb-16 overflow-hidden rounded-2xl border border-[#262E3A] bg-[#151A22]/60"
        >
          <EduDecaRegistrationPanel />
        </section>
      </div>
    </div>
  );
}
