"use client";

function Badge({
  color,
  icon,
  children,
}: {
  color: string;
  icon: string;
  children: React.ReactNode;
}) {
  const colors: Record<string, string> = {
    teal: "bg-[#0A2A20] text-[#9FE1CB]",
    blue: "bg-[#0D1E30] text-[#85B7EB]",
    amber: "bg-[#281C08] text-[#FAC775]",
  };
  return (
    <span
      className={`inline-flex items-center gap-1 rounded-full px-2.5 py-0.5 text-[10px] font-medium ${colors[color]}`}
    >
      <i className={`${icon} text-[11px]`} />
      {children}
    </span>
  );
}

function HighlightBox({
  color,
  title,
  children,
}: {
  color: string;
  title: string;
  children: React.ReactNode;
}) {
  const bg: Record<string, string> = {
    teal: "bg-[#0A2A20] border-[#0F6E56]",
    blue: "bg-[#0D1E30] border-[#1E3A52]",
    coral: "bg-[#241008] border-[#3A1808]",
  };
  const titleColor: Record<string, string> = {
    teal: "text-[#9FE1CB]",
    blue: "text-[#85B7EB]",
    coral: "text-[#F0997B]",
  };
  return (
    <div className={`rounded-lg border p-3.5 ${bg[color]}`}>
      <div
        className={`mb-1.5 text-[11px] font-medium uppercase tracking-wide ${titleColor[color]}`}
      >
        {title}
      </div>
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

function ContactCard({ label, value, sub }: { label: string; value: string; sub?: string }) {
  return (
    <div className="rounded-lg border border-white/10 bg-[#1C2333] p-3">
      <div className="mb-1 text-[10px] font-medium uppercase tracking-wide text-white/30">
        {label}
      </div>
      <div className="text-xs text-[#9FE1CB]">{value}</div>
      {sub && <div className="mt-0.5 text-[11px] text-white/30">{sub}</div>}
    </div>
  );
}

function SectionHeading({ id, children }: { id?: string; children: React.ReactNode }) {
  return (
    <h2
      id={id}
      className="mt-7 border-t border-white/10 pt-5 text-lg font-medium first:mt-0 first:border-t-0 first:pt-0"
    >
      {children}
    </h2>
  );
}

function SubHeading({ children }: { children: React.ReactNode }) {
  return <h3 className="mt-4 mb-1.5 text-[15px] font-medium">{children}</h3>;
}

function BackToTop() {
  return (
    <button
      onClick={() => window.scrollTo({ top: 0, behavior: "smooth" })}
      className="mt-6 inline-flex items-center gap-1.5 rounded-lg border border-[#0A2A20] bg-transparent px-3 py-1.5 text-[11px] text-[#1D9E75] transition-colors hover:bg-[#0A2A20]"
    >
      <i className="ti ti-arrow-up text-sm" />
      Back to top
    </button>
  );
}

export default function PrivacyPolicyPage() {
  return (
    <>
      <div className="mb-6 border-b border-white/10 pb-4">
        <h1 className="text-2xl font-medium">Privacy Policy</h1>
        <div className="mt-1.5 flex flex-wrap gap-3.5 text-[11px] text-white/30">
          <span className="flex items-center gap-1">
            <i className="ti ti-calendar text-[13px]" />
            Effective: 14 May 2026
          </span>
          <span className="flex items-center gap-1">
            <i className="ti ti-shield-check text-[13px]" />
            DPDP Act 2023 compliant
          </span>
        </div>
        <div className="mt-3 flex flex-wrap gap-2">
          <Badge color="teal" icon="ti ti-shield">
            DPDP Act 2023
          </Badge>
          <Badge color="blue" icon="ti ti-file-text">
            IT Act 2000
          </Badge>
          <Badge color="amber" icon="ti ti-users">
            IT Rules 2021
          </Badge>
        </div>
      </div>

      <div className="mb-4 flex items-center justify-between rounded-lg border border-white/10 bg-[#1C2333] px-3.5 py-2.5 text-xs">
        <span className="text-white/50">Version 1.0 — Initial publication</span>
        <span className="text-white/30">Next review: May 2027</span>
      </div>

      <SectionHeading id="pp-1">1. About this privacy policy</SectionHeading>
      <p className="text-sm leading-relaxed text-white/50">
        This Privacy Policy describes how EduBlast Technologies Private Limited
        (&quot;EduBlast&quot;, &quot;Data Fiduciary&quot;, &quot;we&quot;, &quot;us&quot;) collects,
        uses, stores, shares, and protects personal data of users (&quot;Data Principals&quot;) of
        the EduBlast platform in accordance with the Digital Personal Data Protection Act 2023 (DPDP
        Act), the Information Technology Act 2000, and associated rules and regulations.
      </p>
      <p className="text-sm leading-relaxed text-white/50">
        This Policy applies to all users of the EduBlast platform — students, teachers, parents, and
        guardians — regardless of whether they use the Platform on a paid or free basis.
      </p>

      <SectionHeading id="pp-2">2. Data fiduciary and contact details</SectionHeading>
      <div className="grid grid-cols-1 gap-2.5 sm:grid-cols-2">
        <ContactCard
          label="Data Fiduciary"
          value="EduBlast Technologies Pvt Ltd"
          sub="Bengaluru, Karnataka — 560001"
        />
        <ContactCard
          label="Grievance Officer (DPDP)"
          value="privacy@edublast.in"
          sub="Response within 72 hours"
        />
        <ContactCard
          label="Data Protection Officer"
          value="dpo@edublast.in"
          sub="For formal data requests"
        />
        <ContactCard
          label="Nodal contact (IT Rules 2021)"
          value="nodal@edublast.in"
          sub="Law enforcement queries"
        />
      </div>

      <SectionHeading id="pp-3">3. Personal data we collect</SectionHeading>
      <div className="overflow-x-auto">
        <table className="w-full text-xs">
          <thead>
            <tr className="border-b border-white/10 bg-[#222A3A]">
              <th className="p-2 text-left font-medium text-white/50">Category</th>
              <th className="p-2 text-left font-medium text-white/50">Data collected</th>
              <th className="p-2 text-left font-medium text-white/50">Collection method</th>
            </tr>
          </thead>
          <tbody className="text-white/50">
            <tr className="border-b border-white/10">
              <td className="p-2 font-medium text-[#E8EAF0]">Identity</td>
              <td className="p-2">Full name, date of birth, gender, profile photo</td>
              <td className="p-2">Registration form, profile settings</td>
            </tr>
            <tr className="border-b border-white/10">
              <td className="p-2 font-medium text-[#E8EAF0]">Contact</td>
              <td className="p-2">Email address, mobile number (+91 country code)</td>
              <td className="p-2">Registration, OTP verification</td>
            </tr>
            <tr className="border-b border-white/10">
              <td className="p-2 font-medium text-[#E8EAF0]">Location</td>
              <td className="p-2">State, city/town (user-selected), IP-based region</td>
              <td className="p-2">Registration, device</td>
            </tr>
            <tr className="border-b border-white/10">
              <td className="p-2 font-medium text-[#E8EAF0]">Academic</td>
              <td className="p-2">
                Class/board, stream, target exam, school/college name, uploaded marksheets
              </td>
              <td className="p-2">Profile completion, uploads</td>
            </tr>
            <tr className="border-b border-white/10">
              <td className="p-2 font-medium text-[#E8EAF0]">Activity</td>
              <td className="p-2">
                DailyDose scores, mock test results, questions asked/answered, RDM earned, streaks,
                time spent
              </td>
              <td className="p-2">Platform usage</td>
            </tr>
            <tr className="border-b border-white/10">
              <td className="p-2 font-medium text-[#E8EAF0]">Payment</td>
              <td className="p-2">
                Subscription tier, payment method type, transaction IDs (no card/UPI details stored)
              </td>
              <td className="p-2">Razorpay gateway (tokenised)</td>
            </tr>
            <tr className="border-b border-white/10">
              <td className="p-2 font-medium text-[#E8EAF0]">Device &amp; technical</td>
              <td className="p-2">Device type, OS, browser, IP address, session tokens</td>
              <td className="p-2">Automatic collection</td>
            </tr>
            <tr className="border-b border-white/10">
              <td className="p-2 font-medium text-[#E8EAF0]">UGC content</td>
              <td className="p-2">Questions, answers, comments, Instacues, uploaded files</td>
              <td className="p-2">User submission</td>
            </tr>
            <tr>
              <td className="p-2 font-medium text-[#E8EAF0]">EduFund</td>
              <td className="p-2">
                Income certificate, family income declaration, bank details (for disbursement only)
              </td>
              <td className="p-2">Grant application (explicit consent)</td>
            </tr>
          </tbody>
        </table>
      </div>

      <HighlightBox color="teal" title="Data minimisation principle">
        <p className="text-sm leading-relaxed text-white/50">
          EduBlast collects only the minimum personal data necessary for each specific purpose.
          Where data can be anonymised or pseudonymised for a purpose (such as AI model training or
          analytics), we do so by default. You may choose not to provide optional data fields — your
          ability to use core platform features will not be affected, though certain features like
          EduFund applications require complete information.
        </p>
      </HighlightBox>

      <SectionHeading id="pp-4">4. Purpose and legal basis for processing</SectionHeading>
      <div className="overflow-x-auto">
        <table className="w-full text-xs">
          <thead>
            <tr className="border-b border-white/10 bg-[#222A3A]">
              <th className="p-2 text-left font-medium text-white/50">Purpose</th>
              <th className="p-2 text-left font-medium text-white/50">Data used</th>
              <th className="p-2 text-left font-medium text-white/50">Legal basis (DPDP Act)</th>
            </tr>
          </thead>
          <tbody className="text-white/50">
            <tr className="border-b border-white/10">
              <td className="p-2">Account creation and authentication</td>
              <td className="p-2">Name, email, mobile, DOB</td>
              <td className="p-2">Consent (registration)</td>
            </tr>
            <tr className="border-b border-white/10">
              <td className="p-2">Delivering educational services (classes, mocks, Gyan++)</td>
              <td className="p-2">Identity, academic, activity</td>
              <td className="p-2">Contract performance</td>
            </tr>
            <tr className="border-b border-white/10">
              <td className="p-2">RDM calculation and EduFund eligibility tracking</td>
              <td className="p-2">Activity data, verified documents</td>
              <td className="p-2">Consent + legitimate interest</td>
            </tr>
            <tr className="border-b border-white/10">
              <td className="p-2">Payment processing</td>
              <td className="p-2">Subscription data, transaction IDs</td>
              <td className="p-2">Contract performance</td>
            </tr>
            <tr className="border-b border-white/10">
              <td className="p-2">EduFund grant application and disbursement</td>
              <td className="p-2">Income documents, bank details</td>
              <td className="p-2">Explicit consent (separate notice)</td>
            </tr>
            <tr className="border-b border-white/10">
              <td className="p-2">Platform safety — detecting fraud, abuse, prohibited content</td>
              <td className="p-2">Activity, UGC, device data</td>
              <td className="p-2">Legitimate interest / legal obligation</td>
            </tr>
            <tr className="border-b border-white/10">
              <td className="p-2">AI model improvement (anonymised only)</td>
              <td className="p-2">Anonymised interaction data</td>
              <td className="p-2">Consent (opt-in preference)</td>
            </tr>
            <tr className="border-b border-white/10">
              <td className="p-2">Marketing communications</td>
              <td className="p-2">Email, notification preferences</td>
              <td className="p-2">Consent (opt-in, withdrawable)</td>
            </tr>
            <tr className="border-b border-white/10">
              <td className="p-2">Legal compliance and law enforcement requests</td>
              <td className="p-2">As required by order</td>
              <td className="p-2">Legal obligation</td>
            </tr>
            <tr>
              <td className="p-2">Parent/guardian access to student activity</td>
              <td className="p-2">Student activity data</td>
              <td className="p-2">Consent of parent/guardian at registration</td>
            </tr>
          </tbody>
        </table>
      </div>

      <SectionHeading id="pp-5">5. Data retention</SectionHeading>
      <ul className="list-disc space-y-1 pl-5 text-sm leading-relaxed text-white/50">
        <li>
          <strong>Active account data:</strong> Retained for the duration of the account plus 3
          years from the date of last activity, to enable account reactivation and address any legal
          claims.
        </li>
        <li>
          <strong>EduFund financial documents</strong> (income certificates, bank details): Retained
          for 7 years from the date of the grant application in accordance with financial
          record-keeping requirements under the Income Tax Act.
        </li>
        <li>
          <strong>Transaction records</strong> (subscription payments, RDM logs): Retained for 7
          years from the date of transaction.
        </li>
        <li>
          <strong>UGC (questions, answers, comments):</strong> Retained as long as it forms part of
          the community knowledge base. Upon account deletion, UGC is anonymised (user identity
          removed) unless the content is illegal, in which case it is deleted.
        </li>
        <li>
          <strong>Device and technical logs:</strong> Retained for 180 days for security purposes,
          then deleted.
        </li>
        <li>
          <strong>After account deletion:</strong> All remaining personal data is deleted within 30
          days of the account deletion request, subject to the above retention obligations.
        </li>
      </ul>

      <SectionHeading id="pp-6">6. Data sharing and third parties</SectionHeading>
      <p className="text-sm leading-relaxed text-white/50">
        EduBlast does not sell personal data to any third party. We do not permit third parties to
        use your personal data for their own marketing purposes.
      </p>
      <div className="overflow-x-auto">
        <table className="w-full text-xs">
          <thead>
            <tr className="border-b border-white/10 bg-[#222A3A]">
              <th className="p-2 text-left font-medium text-white/50">Recipient</th>
              <th className="p-2 text-left font-medium text-white/50">Data shared</th>
              <th className="p-2 text-left font-medium text-white/50">Purpose</th>
              <th className="p-2 text-left font-medium text-white/50">Safeguards</th>
            </tr>
          </thead>
          <tbody className="text-white/50">
            <tr className="border-b border-white/10">
              <td className="p-2">Razorpay</td>
              <td className="p-2">Payment session data (tokenised)</td>
              <td className="p-2">Payment processing</td>
              <td className="p-2">PCI DSS, data processing agreement</td>
            </tr>
            <tr className="border-b border-white/10">
              <td className="p-2">AWS / Cloud hosting</td>
              <td className="p-2">All platform data</td>
              <td className="p-2">Data storage and computing</td>
              <td className="p-2">Encryption at rest and transit, DPA</td>
            </tr>
            <tr className="border-b border-white/10">
              <td className="p-2">Partner NGOs (EduFund)</td>
              <td className="p-2">Verified portfolio (with explicit consent)</td>
              <td className="p-2">Grant evaluation</td>
              <td className="p-2">Explicit consent required before sharing</td>
            </tr>
            <tr className="border-b border-white/10">
              <td className="p-2">Analytics providers</td>
              <td className="p-2">Anonymised, aggregated usage data</td>
              <td className="p-2">Platform improvement</td>
              <td className="p-2">Anonymisation before sharing</td>
            </tr>
            <tr>
              <td className="p-2">Law enforcement</td>
              <td className="p-2">As required by valid legal order</td>
              <td className="p-2">Legal compliance</td>
              <td className="p-2">
                Verification of legal authority; notification to user where permissible
              </td>
            </tr>
          </tbody>
        </table>
      </div>

      <HighlightBox color="coral" title="Cross-border data transfers">
        <p className="text-sm leading-relaxed text-white/50">
          EduBlast stores all primary data on servers located within India. Where third-party
          service providers (such as analytics or AI tools) process data outside India, we ensure
          that such transfers comply with applicable Indian law and that equivalent data protection
          standards are contractually imposed on the recipient. We will update this policy and seek
          additional consent if cross-border transfer requirements change under the DPDP Act upon
          relevant rules being notified.
        </p>
      </HighlightBox>

      <SectionHeading id="pp-7">7. Your rights under the DPDP Act 2023</SectionHeading>
      <HighlightBox color="teal" title="DPDP Act 2023 — Data Principal rights">
        <p className="text-sm leading-relaxed text-white/50">
          Under the Digital Personal Data Protection Act 2023, you have the following rights as a
          Data Principal. These rights can be exercised by contacting dpo@edublast.in. We will
          respond within 72 hours of receiving a request and act upon it within the timeframes
          prescribed under the Act.
        </p>
      </HighlightBox>
      <div className="grid grid-cols-1 gap-2.5 sm:grid-cols-2">
        <RightCard
          icon="ti ti-eye"
          title="Right to access"
          text="You may request a summary of the personal data we hold about you, the purposes for which it is being processed, and the identities of Data Fiduciaries and processors with whom it has been shared."
        />
        <RightCard
          icon="ti ti-edit"
          title="Right to correction"
          text="You may request that inaccurate or incomplete personal data we hold about you be corrected or completed. You can update most data directly from your profile settings."
        />
        <RightCard
          icon="ti ti-trash"
          title="Right to erasure"
          text="You may request deletion of your personal data. We will delete it within 30 days subject to retention obligations under law (financial records, legal proceedings). Deleting your account initiates this process."
        />
        <RightCard
          icon="ti ti-hand-stop"
          title="Right to withdraw consent"
          text="Where processing is based on consent, you may withdraw consent at any time. Withdrawal does not affect the legality of processing before the withdrawal. Certain withdrawals will result in account termination."
        />
        <RightCard
          icon="ti ti-shield-off"
          title="Right to grievance redressal"
          text="You have the right to a prompt and effective grievance redressal mechanism. Complaints must first be raised with our Grievance Officer. If not resolved within 30 days, you may escalate to the Data Protection Board of India."
        />
        <RightCard
          icon="ti ti-user-x"
          title="Right of nominee"
          text="You may nominate a person to exercise your data principal rights in the event of your death or incapacity, as provided under the DPDP Act 2023."
        />
      </div>
      <p className="mt-3 text-sm leading-relaxed text-white/50">
        To exercise any right, contact: <strong>dpo@edublast.in</strong> with subject line
        &quot;DPDP Rights Request — [Right Type]&quot; and include your registered email address for
        identity verification.
      </p>

      <SectionHeading id="pp-8">8. Consent management</SectionHeading>
      <ul className="list-disc space-y-1 pl-5 text-sm leading-relaxed text-white/50">
        <li>
          EduBlast obtains consent through a clear, plain-language consent notice at registration.
          Consent is obtained separately for each distinct purpose where required under the DPDP
          Act.
        </li>
        <li>
          Consent for sensitive purposes (EduFund financial documents, AI model training, marketing
          communications) is obtained through an explicit opt-in mechanism with a separate notice.
        </li>
        <li>
          Consent is not bundled — agreeing to these Terms does not constitute blanket consent for
          all data processing. Each consent notice specifies the exact data to be collected, the
          purpose, and the right to withdraw.
        </li>
        <li>
          You may manage your consent preferences at any time from Account Settings &gt; Privacy
          &amp; Consent.
        </li>
        <li>
          Withdrawal of consent takes effect within 48 hours of submission and is prospective only.
        </li>
      </ul>

      <SectionHeading id="pp-9">9. Data security</SectionHeading>
      <ul className="list-disc space-y-1 pl-5 text-sm leading-relaxed text-white/50">
        <li>
          All data transmitted to and from the Platform is encrypted using TLS 1.2 or higher
          (in-transit encryption).
        </li>
        <li>
          All personal data stored on EduBlast servers is encrypted at rest using AES-256 standard.
        </li>
        <li>
          Access to personal data is restricted to EduBlast employees and contractors who require it
          to perform their duties, and is subject to confidentiality obligations.
        </li>
        <li>
          EduBlast conducts periodic security audits and vulnerability assessments in accordance
          with the Reasonable Security Practices Rules under the IT Act 2000.
        </li>
        <li>
          In the event of a data breach involving personal data, EduBlast will notify affected users
          and the relevant regulatory authority within the timeframes prescribed under applicable
          law.
        </li>
        <li>
          Passwords are stored as salted hashes and are never stored in plaintext. Payment data is
          tokenised by Razorpay and not stored on EduBlast servers.
        </li>
      </ul>

      <SectionHeading id="pp-10">10. Minors and child data protection</SectionHeading>
      <HighlightBox color="blue" title="Special protections for users under 18">
        <p className="text-sm leading-relaxed text-white/50">
          The DPDP Act 2023 imposes heightened obligations for processing data of children (persons
          under 18 years). EduBlast treats all registered users who indicate they are under 18, or
          who are otherwise identified as minors, with these enhanced protections.
        </p>
      </HighlightBox>
      <ul className="list-disc space-y-1 pl-5 text-sm leading-relaxed text-white/50">
        <li>
          <strong>Verifiable parental consent:</strong> Before processing data of a user who is a
          minor, EduBlast will obtain verifiable consent from the parent or guardian through a
          separate consent flow at registration. The parent/guardian must confirm their identity via
          OTP or email verification.
        </li>
        <li>
          <strong>No tracking or behavioural advertising:</strong> EduBlast does not engage in
          tracking, profiling for advertising, or targeted marketing in relation to minor users.
        </li>
        <li>
          <strong>No social media-style engagement loops for minors:</strong> While EduBlast
          operates a social learning feed, features that could be considered detrimental to the
          well-being of minors (e.g. aggressive streak penalties, exposure to adult content) are
          disabled for accounts identified as minors.
        </li>
        <li>
          <strong>Parental access:</strong> Parents and guardians who register under the parent
          account type may access their linked child&apos;s activity dashboard at any time. This
          includes activity logs, quiz scores, and time-on-platform data.
        </li>
        <li>
          <strong>Strict age enforcement:</strong> Accounts found to belong to users under 13 will
          be deleted within 24 hours of discovery without prior notice.
        </li>
        <li>
          <strong>School-facing obligations:</strong> Where EduBlast serves students through
          institutional licences held by schools or coaching institutes, the institution acts as a
          co-fiduciary and bears responsibility for ensuring parental consent is obtained before
          student enrolment.
        </li>
      </ul>

      <SectionHeading id="pp-11">11. Cookies and tracking technologies</SectionHeading>
      <ul className="list-disc space-y-1 pl-5 text-sm leading-relaxed text-white/50">
        <li>
          <strong>Essential cookies:</strong> Required for basic platform functionality
          (authentication sessions, security tokens, language preferences). These cannot be disabled
          without preventing platform use.
        </li>
        <li>
          <strong>Analytics cookies:</strong> Used to understand aggregate usage patterns and
          improve the platform. These are anonymised before processing. You may opt out from Account
          Settings &gt; Privacy.
        </li>
        <li>
          <strong>No third-party advertising cookies:</strong> EduBlast does not use cookies or
          tracking pixels for third-party advertising purposes. The platform is ad-free and we do
          not share data with advertising networks.
        </li>
        <li>
          EduBlast uses browser localStorage for storing non-personal session preferences (such as
          dark mode preference and language setting).
        </li>
        <li>
          You may clear all non-essential cookies at any time through your browser settings. This
          will not affect your account data.
        </li>
      </ul>

      <SectionHeading id="pp-12">12. Grievance officer and escalation</SectionHeading>
      <HighlightBox color="teal" title="Grievance redressal — DPDP Act 2023, Section 13">
        <p className="text-sm leading-relaxed text-white/50">
          In accordance with the DPDP Act 2023 and the IT (Intermediary Guidelines) Rules 2021,
          EduBlast has appointed a Grievance Officer to address privacy complaints and data-related
          requests. All complaints must first be directed to the Grievance Officer. If your
          complaint is not resolved within 30 days, you may escalate to the Data Protection Board of
          India once constituted under the DPDP Act.
        </p>
      </HighlightBox>
      <div className="grid grid-cols-1 gap-2.5 sm:grid-cols-2">
        <ContactCard
          label="Grievance Officer"
          value="Ms. Priya Suresh"
          sub="Designation: Chief Privacy Officer"
        />
        <ContactCard label="Email" value="grievance@edublast.in" sub="Response within 72 hours" />
        <ContactCard
          label="Postal address"
          value="EduBlast Technologies Pvt Ltd"
          sub="Bengaluru, Karnataka 560001"
        />
        <ContactCard
          label="Response time"
          value="72 hours acknowledgement"
          sub="Resolution within 30 days"
        />
      </div>
      <SubHeading>Escalation path</SubHeading>
      <ol className="list-decimal space-y-1 pl-5 text-sm leading-relaxed text-white/50">
        <li>
          <strong>Step 1:</strong> Submit complaint to grievance@edublast.in. EduBlast acknowledges
          within 72 hours and resolves within 30 days.
        </li>
        <li>
          <strong>Step 2:</strong> If unresolved, escalate to the Data Protection Board of India
          (upon notification of constitution under Section 18 of the DPDP Act 2023).
        </li>
        <li>
          <strong>Step 3:</strong> Appellate Tribunal under the DPDP Act for appeals against Board
          orders, or civil courts of competent jurisdiction in Bengaluru, Karnataka.
        </li>
      </ol>
      <p className="mt-5 text-[11px] text-white/20">
        This Privacy Policy was last reviewed and approved on 14 May 2026. EduBlast will review and
        update this Policy at least annually, or sooner if required by changes in applicable law,
        regulatory guidance, or significant changes to data processing activities. Material changes
        will be notified to registered users by email at least 14 days before taking effect.
      </p>
      <BackToTop />
    </>
  );
}
