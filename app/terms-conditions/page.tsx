"use client";

import Link from "next/link";

/* ─── Shared components ─── */

function Badge({ color, icon, children }: { color: string; icon: string; children: React.ReactNode }) {
  const colors: Record<string, string> = {
    teal: "bg-[#0A2A20] text-[#9FE1CB]",
    blue: "bg-[#0D1E30] text-[#85B7EB]",
    amber: "bg-[#281C08] text-[#FAC775]",
    purple: "bg-[#171425] text-[#AFA9EC]",
  };
  return (
    <span className={`inline-flex items-center gap-1 rounded-full px-2.5 py-0.5 text-[10px] font-medium ${colors[color]}`}>
      <i className={`${icon} text-[11px]`} />
      {children}
    </span>
  );
}

function HighlightBox({ color, title, children }: { color: string; title: string; children: React.ReactNode }) {
  const bg: Record<string, string> = { teal: "bg-[#0A2A20] border-[#0F6E56]" };
  const titleColor: Record<string, string> = { teal: "text-[#9FE1CB]" };
  return (
    <div className={`rounded-lg border p-3.5 ${bg[color]}`}>
      <div className={`mb-1.5 text-[11px] font-medium uppercase tracking-wide ${titleColor[color]}`}>{title}</div>
      {children}
    </div>
  );
}

function RightCard({ icon, title, text }: { icon: string; title: string; text: string }) {
  return (
    <div className="rounded-lg border border-white/10 bg-[#1C2333] p-3">
      <div className="mb-1 flex items-center gap-1.5 text-xs font-medium text-[#E8EAF0]">
        <i className={`${icon} text-sm text-[#1D9E75]`} />
        {title}
      </div>
      <div className="text-[11px] leading-relaxed text-white/50">{text}</div>
    </div>
  );
}

function SectionHeading({ children }: { children: React.ReactNode }) {
  return (
    <h2 className="mt-7 border-t border-white/10 pt-5 text-lg font-medium first:mt-0 first:border-t-0 first:pt-0">
      {children}
    </h2>
  );
}

export default function TermsConditionsOverviewPage() {
  return (
    <>
      <div className="mb-6 border-b border-white/10 pb-4">
        <h1 className="text-2xl font-medium">EduBlast &mdash; Legal & compliance documents</h1>
        <div className="mt-1.5 flex flex-wrap gap-3.5 text-[11px] text-white/30">
          <span className="flex items-center gap-1"><i className="ti ti-calendar text-[13px]" />Effective: 14 May 2026</span>
          <span className="flex items-center gap-1"><i className="ti ti-refresh text-[13px]" />Last updated: 14 May 2026</span>
          <span className="flex items-center gap-1"><i className="ti ti-map-pin text-[13px]" />Jurisdiction: India</span>
        </div>
        <div className="mt-3 flex flex-wrap gap-2">
          <Badge color="teal" icon="ti ti-shield-check">DPDP Act 2023 compliant</Badge>
          <Badge color="blue" icon="ti ti-file-text">IT Act 2000</Badge>
          <Badge color="purple" icon="ti ti-device-laptop">EdTech guidelines</Badge>
          <Badge color="amber" icon="ti ti-users">Social media norms</Badge>
        </div>
      </div>

      <HighlightBox color="teal" title="About these documents">
        <p className="text-sm leading-relaxed text-white/50">
          EduBlast is an educational social media and EdTech platform operated by EduBlast Technologies Private Limited, a company registered under the Companies Act, 2013, with its registered office in Bengaluru, Karnataka, India. These documents govern your use of the EduBlast platform including its website, mobile application, and all associated services.
        </p>
        <p className="mt-2 text-sm leading-relaxed text-white/50">
          By registering an account or using the platform, you confirm that you have read, understood, and agree to be bound by these terms. If you are a minor under 18 years, your parent or legal guardian must read and consent on your behalf.
        </p>
      </HighlightBox>

      <SectionHeading>Document index</SectionHeading>
      <div className="mb-5 grid grid-cols-1 gap-3 sm:grid-cols-2">
        <Link href="/terms-conditions/terms-and-conditions" className="rounded-lg border border-white/10 bg-[#1C2333] p-4 transition-colors hover:border-[#1D9E75]/30">
          <div className="mb-2 flex items-center gap-2">
            <i className="ti ti-file-text text-xl text-[#1D9E75]" />
            <span className="text-sm font-medium">Terms &amp; Conditions</span>
          </div>
          <p className="text-xs leading-relaxed text-white/50">Governs user eligibility, account rules, content standards, platform use, subscriptions, RDM rewards, EduFund, teacher accounts, AI features, liability, and dispute resolution.</p>
          <div className="mt-2.5 text-[11px] text-[#1D9E75]">12 sections &middot; click to open <i className="ti ti-arrow-right text-xs" /></div>
        </Link>
        <Link href="/terms-conditions/privacy-policy" className="rounded-lg border border-white/10 bg-[#1C2333] p-4 transition-colors hover:border-[#1D9E75]/30">
          <div className="mb-2 flex items-center gap-2">
            <i className="ti ti-shield-lock text-xl text-[#1D9E75]" />
            <span className="text-sm font-medium">Privacy Policy</span>
          </div>
          <p className="text-xs leading-relaxed text-white/50">Explains what personal data we collect, why we collect it, how long we keep it, who we share it with, your rights under the DPDP Act 2023, and how to contact our grievance officer.</p>
          <div className="mt-2.5 text-[11px] text-[#1D9E75]">12 sections &middot; click to open <i className="ti ti-arrow-right text-xs" /></div>
        </Link>
      </div>

      <SectionHeading>Key compliance highlights</SectionHeading>
      <div className="grid grid-cols-1 gap-2.5 sm:grid-cols-2">
        <RightCard icon="ti ti-shield-check" title="DPDP Act 2023" text="Fully aligned with India&apos;s Digital Personal Data Protection Act 2023 — including consent notices, data principal rights, data fiduciary obligations, and child data protections." />
        <RightCard icon="ti ti-device-laptop" title="IT Act 2000 & IT Rules" text="Compliant with the Information Technology Act 2000, IT (Intermediary Guidelines) Rules 2021, and the Reasonable Security Practices Rules." />
        <RightCard icon="ti ti-school" title="EdTech guidelines" text="Follows MEITY and MoE advisory guidelines for online education platforms including data minimisation, purpose limitation, and minor user protections." />
        <RightCard icon="ti ti-users" title="Social media norms" text="Complies with Significant Social Media Intermediary (SSMI) obligations under IT Rules 2021 as applicable to UGC platforms above threshold user counts." />
      </div>
    </>
  );
}
