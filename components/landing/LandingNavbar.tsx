"use client";

import { useState } from "react";
import Link from "next/link";
import { Menu, X } from "lucide-react";
import { NAV_LINKS } from "./landing-constants";

export default function LandingNavbar() {
  const [mobileOpen, setMobileOpen] = useState(false);

  return (
    <nav className="sticky top-0 z-50 bg-white/80 backdrop-blur-lg border-b border-gray-200/60">
      <div className="max-w-[1200px] mx-auto flex items-center justify-between px-5 h-14">
        {/* Logo */}
        <Link href="/" className="flex items-center gap-2">
          <span className="w-8 h-8 rounded-[9px] bg-[#1D9E75] flex items-center justify-center text-white text-sm font-medium">
            E
          </span>
          <span className="text-lg font-medium tracking-tight text-gray-900">
            Edu<span className="text-[#1D9E75]">Blast</span>
          </span>
        </Link>

        {/* Desktop links */}
        <div className="hidden md:flex items-center gap-5">
          {NAV_LINKS.map((l) => (
            <a
              key={l.label}
              href={l.href}
              className="text-sm text-gray-500 hover:text-gray-900 transition-colors"
            >
              {l.label}
            </a>
          ))}
        </div>

        {/* Desktop CTAs */}
        <div className="hidden md:flex items-center gap-2">
          <Link
            href="/auth"
            className="border border-gray-300 rounded-lg px-4 py-[7px] text-sm text-gray-500 hover:text-gray-900 hover:border-gray-400 transition-colors"
          >
            Sign in
          </Link>
          <Link
            href="/auth"
            className="bg-[#1D9E75] text-white rounded-lg px-[18px] py-2 text-sm font-medium hover:bg-[#178d68] transition-colors"
          >
            Start free
          </Link>
        </div>

        {/* Mobile hamburger */}
        <button
          className="md:hidden p-2 text-gray-600"
          onClick={() => setMobileOpen(!mobileOpen)}
          aria-label="Toggle menu"
        >
          {mobileOpen ? <X className="w-5 h-5" /> : <Menu className="w-5 h-5" />}
        </button>
      </div>

      {/* Mobile panel */}
      {mobileOpen && (
        <div className="md:hidden border-t border-gray-200/60 bg-white px-5 pb-4 pt-3 space-y-3">
          {NAV_LINKS.map((l) => (
            <a
              key={l.label}
              href={l.href}
              className="block text-[15px] text-gray-600 py-1"
              onClick={() => setMobileOpen(false)}
            >
              {l.label}
            </a>
          ))}
          <div className="flex gap-2 pt-2">
            <Link
              href="/auth"
              className="border border-gray-300 rounded-lg px-4 py-2 text-sm text-gray-500 flex-1 text-center"
              onClick={() => setMobileOpen(false)}
            >
              Sign in
            </Link>
            <Link
              href="/auth"
              className="bg-[#1D9E75] text-white rounded-lg px-4 py-2 text-sm font-medium flex-1 text-center"
              onClick={() => setMobileOpen(false)}
            >
              Start free
            </Link>
          </div>
        </div>
      )}
    </nav>
  );
}
