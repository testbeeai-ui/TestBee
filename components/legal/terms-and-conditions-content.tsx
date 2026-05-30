"use client";

import { ArrowUp } from "lucide-react";

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
    amber: "bg-[#281C08] border-[#3A2810]",
    purple: "bg-[#171425] border-[#2A2560]",
  };
  const titleColor: Record<string, string> = {
    teal: "text-[#9FE1CB]",
    blue: "text-[#85B7EB]",
    amber: "text-[#FAC775]",
    purple: "text-[#AFA9EC]",
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

function BackToTop({ scrollContainerId }: { scrollContainerId?: string }) {
  return (
    <button
      type="button"
      onClick={() => {
        const el = scrollContainerId ? document.getElementById(scrollContainerId) : null;
        if (el) el.scrollTo({ top: 0, behavior: "smooth" });
        else window.scrollTo({ top: 0, behavior: "smooth" });
      }}
      className="mt-6 inline-flex items-center gap-1.5 rounded-lg border border-[#0A2A20] bg-transparent px-3 py-1.5 text-[11px] text-[#1D9E75] transition-colors hover:bg-[#0A2A20]"
    >
      <ArrowUp className="h-3.5 w-3.5" />
      Back to top
    </button>
  );
}

/** Full Terms & Conditions body — shared by `/terms-conditions/terms-and-conditions` and onboarding dialog. */
export function TermsAndConditionsContent({ scrollContainerId }: { scrollContainerId?: string }) {
  return (
    <>
      <div className="mb-6 border-b border-white/10 pb-4">
        <h1 className="text-2xl font-medium">Terms &amp; Conditions</h1>
        <div className="mt-1.5 flex flex-wrap gap-3.5 text-[11px] text-white/30">
          <span className="flex items-center gap-1">
            <i className="ti ti-calendar text-[13px]" />
            Effective: 14 May 2026
          </span>
          <span className="flex items-center gap-1">
            <i className="ti ti-building text-[13px]" />
            EduBlast Technologies Pvt Ltd
          </span>
        </div>
      </div>

      <div className="mb-4 flex items-center justify-between rounded-lg border border-white/10 bg-[#1C2333] px-3.5 py-2.5 text-xs">
        <span className="text-white/50">Version 1.0 &mdash; Initial publication</span>
        <span className="text-white/30">Next review: May 2027</span>
      </div>

      <HighlightBox color="amber" title="Please read before using EduBlast">
        <p className="text-sm leading-relaxed text-white/50">
          These Terms &amp; Conditions (&quot;Terms&quot;) form a binding legal agreement between
          you (&quot;User&quot;, &quot;you&quot;) and EduBlast Technologies Private Limited
          (&quot;EduBlast&quot;, &quot;we&quot;, &quot;us&quot;, &quot;Company&quot;). Using the
          EduBlast platform in any form constitutes acceptance of these Terms in full. If you do not
          agree, you must not use the platform.
        </p>
      </HighlightBox>

      <SectionHeading id="tnc-1">1. Definitions</SectionHeading>
      <p className="text-sm leading-relaxed text-white/50">
        In these Terms, the following terms carry the meanings assigned below unless context
        requires otherwise:
      </p>
      <ul className="list-disc space-y-1 pl-5 text-sm leading-relaxed text-white/50">
        <li>
          <strong>&quot;Platform&quot;</strong> means the EduBlast website (edublast.in), mobile
          application, and all associated services, tools, and content.
        </li>
        <li>
          <strong>&quot;User&quot;</strong> means any individual who accesses, registers on, or uses
          the Platform in any capacity — including students, teachers, parents, and guardians.
        </li>
        <li>
          <strong>&quot;Student&quot;</strong> means a User who registers to access learning content
          and associated features.
        </li>
        <li>
          <strong>&quot;Teacher&quot;</strong> means a User who registers to create and deliver
          educational content, conduct live classes, or contribute expert commentary on the
          Platform.
        </li>
        <li>
          <strong>&quot;RDM&quot;</strong> (Reward and Development Marks) means the non-monetary
          digital points system issued by EduBlast to Users for qualifying activity on the Platform.
        </li>
        <li>
          <strong>&quot;EduFund&quot;</strong> means EduBlast&apos;s grant eligibility programme
          through which qualifying Users may access financial aid from partner organisations.
        </li>
        <li>
          <strong>&quot;User Generated Content (UGC)&quot;</strong> means any content — including
          questions, answers, Instacues, comments, posts, or uploaded files — created and submitted
          by Users on the Platform.
        </li>
        <li>
          <strong>&quot;Gyan++&quot;</strong> means EduBlast&apos;s AI-powered Q&amp;A wall feature.
        </li>
        <li>
          <strong>&quot;Instacue&quot;</strong> means EduBlast&apos;s short-form concept note and
          spaced repetition revision card feature.
        </li>
        <li>
          <strong>&quot;Services&quot;</strong> means collectively all features, tools, content, and
          functionality available on the Platform.
        </li>
      </ul>

      <SectionHeading id="tnc-2">2. User eligibility</SectionHeading>
      <HighlightBox color="blue" title="Age and eligibility requirements">
        <p className="text-sm leading-relaxed text-white/50">
          The Platform is intended for students enrolled in or preparing for PUC 1, PUC 2, Class 11,
          Class 12, and associated competitive examinations (JEE, KCET, NEET, Board exams) in India.
          Use by persons outside these categories is permitted but the Platform is optimised for
          this audience.
        </p>
      </HighlightBox>
      <ul className="list-disc space-y-1 pl-5 text-sm leading-relaxed text-white/50">
        <li>Users must be at least 13 years of age to create an account independently.</li>
        <li>
          Users between 13 and 17 years (minors) must have verifiable parental or guardian consent
          before registering. By registering a minor&apos;s account, the parent or guardian confirms
          they have read these Terms and the Privacy Policy and consent on the minor&apos;s behalf.
        </li>
        <li>
          Users under 13 may not register on the Platform under any circumstances. EduBlast will
          delete any account found to belong to a user under 13 immediately upon discovery.
        </li>
        <li>Teacher accounts require the registrant to be at least 18 years of age.</li>
        <li>
          Users must be residents of India or Indian nationals studying abroad. EduBlast&apos;s
          services are specifically designed for the Indian curriculum and examination system.
        </li>
        <li>
          By using the Platform, you represent and warrant that you meet all eligibility
          requirements.
        </li>
      </ul>

      <SectionHeading id="tnc-3">3. Account registration and security</SectionHeading>
      <ul className="list-disc space-y-1 pl-5 text-sm leading-relaxed text-white/50">
        <li>
          You must provide accurate, complete, and current information during registration.
          Providing false information is grounds for immediate account termination.
        </li>
        <li>
          You are responsible for maintaining the confidentiality of your account credentials. You
          must not share your password with any third party.
        </li>
        <li>
          You must notify EduBlast immediately at <strong>support@edublast.in</strong> if you become
          aware of any unauthorised access to your account.
        </li>
        <li>
          EduBlast will not be liable for any loss or damage arising from unauthorised access
          resulting from your failure to maintain account security.
        </li>
        <li>
          One individual may hold only one account unless EduBlast has expressly granted permission
          for additional accounts (e.g. one student account and one teacher account).
        </li>
        <li>
          Accounts are non-transferable. You may not sell, trade, or assign your account to another
          person.
        </li>
      </ul>

      <SectionHeading id="tnc-4">4. Platform use rules and prohibited conduct</SectionHeading>
      <p className="text-sm leading-relaxed text-white/50">
        You agree to use the Platform only for its intended educational and community purposes. The
        following conduct is strictly prohibited:
      </p>
      <ul className="list-disc space-y-1 pl-5 text-sm leading-relaxed text-white/50">
        <li>
          Posting content that is defamatory, obscene, hateful, discriminatory, or that promotes
          violence, self-harm, or illegal activities.
        </li>
        <li>
          Uploading any content that infringes third-party intellectual property rights including
          copyrights, trademarks, or patents.
        </li>
        <li>
          Impersonating any person, including another user, teacher, or EduBlast staff member.
        </li>
        <li>
          Using automated bots, scripts, scrapers, or any tool to artificially inflate RDM balances,
          create fake interactions, or extract Platform data at scale.
        </li>
        <li>
          Attempting to hack, reverse-engineer, decompile, or disrupt the Platform or its underlying
          systems.
        </li>
        <li>Sharing examination question papers or answer keys obtained through improper means.</li>
        <li>
          Harassing, bullying, or intimidating other users, including in comments, direct messages,
          or the Gyan++ wall.
        </li>
        <li>
          Using the Platform to advertise, promote, or sell products or services not sanctioned by
          EduBlast.
        </li>
        <li>Sharing another user&apos;s personal information without their explicit consent.</li>
        <li>Circumventing any technical or access controls implemented by EduBlast.</li>
      </ul>
      <p className="text-sm leading-relaxed text-white/50">
        EduBlast reserves the right to remove any content that violates these rules, suspend or
        terminate the relevant account, and report conduct to law enforcement authorities where
        legally required.
      </p>

      <SectionHeading id="tnc-5">
        5. User generated content and intellectual property
      </SectionHeading>
      <SubHeading>5.1 Ownership of UGC</SubHeading>
      <p className="text-sm leading-relaxed text-white/50">
        You retain ownership of the UGC you create and submit to the Platform. By submitting UGC,
        you grant EduBlast a non-exclusive, royalty-free, worldwide, perpetual licence to host,
        store, display, reproduce, modify (for formatting purposes only), and distribute your UGC on
        the Platform and in promotional materials describing the Platform.
      </p>
      <SubHeading>5.2 EduBlast intellectual property</SubHeading>
      <p className="text-sm leading-relaxed text-white/50">
        All content created by EduBlast — including but not limited to the Platform design,
        DailyDose questions, Testbee mock papers, Instacue templates, software code, logos, brand
        assets, and editorial content — is the exclusive property of EduBlast Technologies Private
        Limited and is protected by applicable Indian and international intellectual property laws.
        You may not copy, reproduce, or distribute EduBlast content without express written
        permission.
      </p>
      <SubHeading>5.3 Content responsibility</SubHeading>
      <p className="text-sm leading-relaxed text-white/50">
        EduBlast does not pre-screen UGC but reserves the right to remove any content that violates
        these Terms or applicable law. You represent that you have all necessary rights to submit
        any content you post on the Platform.
      </p>

      <SectionHeading id="tnc-6">6. RDM rewards system and EduFund</SectionHeading>
      <HighlightBox color="teal" title="Important — RDM is not currency">
        <p className="text-sm leading-relaxed text-white/50">
          RDM (Reward and Development Marks) are non-monetary digital points issued by EduBlast as a
          reward for platform engagement. RDM has no monetary value, cannot be redeemed for cash,
          cannot be transferred between accounts, and cannot be sold or traded. EduBlast may modify,
          reset, or discontinue the RDM system at any time.
        </p>
      </HighlightBox>
      <ul className="list-disc space-y-1 pl-5 text-sm leading-relaxed text-white/50">
        <li>
          RDM is awarded for qualifying activities including completing DailyDose quizzes, answering
          doubts on Gyan++, attending live classes, completing mock tests, and other platform
          interactions as defined in the Platform help documentation.
        </li>
        <li>
          EduBlast may modify the activities that generate RDM, the amounts awarded, and any caps or
          limits at any time with reasonable notice to users.
        </li>
        <li>
          Any attempt to artificially accumulate RDM through prohibited means (bots, fake accounts,
          coordinated manipulation) will result in immediate forfeiture of all RDM and account
          termination.
        </li>
        <li>
          <strong>EduFund is not a guaranteed scholarship.</strong> Accumulating sufficient RDM and
          meeting activity thresholds makes a User eligible to apply for consideration, but does not
          guarantee receipt of financial aid. Grant decisions rest with EduBlast&apos;s EduFund
          committee and partner organisations.
        </li>
        <li>
          EduFund grant disbursement is subject to verified financial need, accurate submission of
          supporting documents, and continued compliance with these Terms.
        </li>
        <li>
          Providing false information in an EduFund application is grounds for immediate account
          termination and may constitute fraud under applicable law.
        </li>
        <li>
          RDM balances are associated with the individual account and are forfeited upon account
          termination.
        </li>
      </ul>

      <SectionHeading id="tnc-7">7. Subscriptions, payments and refunds</SectionHeading>
      <ul className="list-disc space-y-1 pl-5 text-sm leading-relaxed text-white/50">
        <li>
          EduBlast offers paid subscription plans (Scholar and Champion) in addition to a free tier.
          Subscription details, pricing, and features are as listed on the Platform&apos;s
          subscription page at the time of purchase.
        </li>
        <li>
          Payments are processed through Razorpay Payment Gateway. By making a payment you also
          accept Razorpay&apos;s terms of service. EduBlast does not store card or UPI details —
          these are handled exclusively by Razorpay under PCI DSS standards.
        </li>
        <li>
          Annual subscriptions are billed as a single upfront payment. Monthly subscriptions are
          billed on a recurring basis on the same calendar date each month.
        </li>
        <li>
          Auto-renewal is enabled by default. You may disable auto-renewal at any time from the
          Subscription page of your account settings. Disabling auto-renewal does not generate a
          refund for the current billing period.
        </li>
        <li>
          <strong>Refund policy:</strong> A full refund is available within 7 calendar days of an
          annual subscription renewal, provided no more than 10% of the subscription period has been
          used. Monthly subscriptions are non-refundable. Refund requests must be submitted to
          billing@edublast.in.
        </li>
        <li>
          EduBlast reserves the right to change subscription pricing with 30 days&apos; prior
          notice. Pricing changes take effect at the next renewal date for existing subscribers.
        </li>
        <li>
          All amounts are in Indian Rupees (INR). GST is charged at the applicable statutory rate.
        </li>
      </ul>

      <SectionHeading id="tnc-8">8. Teacher accounts and content creation</SectionHeading>
      <ul className="list-disc space-y-1 pl-5 text-sm leading-relaxed text-white/50">
        <li>
          Teacher accounts are subject to a verification process before the Teacher Section and
          class hosting features are activated. EduBlast may request identification documents,
          educational credentials, or subject expertise verification.
        </li>
        <li>
          Teachers earn RDM for qualifying contributions to Gyan++ Teacher Sections and receive
          revenue share on paid class bookings as detailed in the separate Teacher Programme
          agreement.
        </li>
        <li>
          Teachers are solely responsible for the accuracy, legality, and quality of educational
          content they post. EduBlast does not verify the correctness of educational advice provided
          by teachers and is not liable for any consequences arising from reliance on
          teacher-provided content.
        </li>
        <li>
          EduBlast may remove, edit for formatting, or demote teacher content that is flagged by the
          community or identified by the platform as inaccurate, inappropriate, or in violation of
          these Terms.
        </li>
        <li>
          Teacher accounts that fall below a 4.0 average community rating may have Teacher Section
          posting rights restricted pending review.
        </li>
      </ul>

      <SectionHeading id="tnc-9">9. AI-powered features</SectionHeading>
      <HighlightBox color="purple" title="AI feature disclaimer">
        <p className="text-sm leading-relaxed text-white/50">
          EduBlast uses artificial intelligence to power features including Gyan++ doubt answering,
          Testbee adaptive question selection, Instacue spaced repetition scheduling, and the AI
          Calendar. AI-generated content on the Platform is provided for educational assistance only
          and may contain errors, inaccuracies, or outdated information.
        </p>
      </HighlightBox>
      <ul className="list-disc space-y-1 pl-5 text-sm leading-relaxed text-white/50">
        <li>
          AI-generated answers on Gyan++ are clearly labelled and should be verified against
          authoritative educational sources before reliance in examinations.
        </li>
        <li>
          EduBlast does not warrant the accuracy, completeness, or fitness for purpose of any
          AI-generated content.
        </li>
        <li>
          Users should not rely solely on AI-generated content for examination preparation. EduBlast
          encourages users to cross-reference AI answers with textbooks, teachers, and verified
          educational resources.
        </li>
        <li>
          EduBlast collects and uses anonymised interaction data to improve its AI models. No
          personally identifiable information is used to train AI models without explicit consent as
          described in the Privacy Policy.
        </li>
      </ul>

      <SectionHeading id="tnc-10">10. Account suspension and termination</SectionHeading>
      <ul className="list-disc space-y-1 pl-5 text-sm leading-relaxed text-white/50">
        <li>
          EduBlast reserves the right to suspend or terminate any account at any time for violation
          of these Terms, applicable law, or for conduct that EduBlast determines is harmful to the
          Platform community.
        </li>
        <li>
          Where practicable, EduBlast will notify users of the reason for suspension and provide an
          opportunity to respond before permanent termination, except where the violation involves
          illegal content, child safety, or platform security.
        </li>
        <li>
          Upon termination, your access to the Platform ceases immediately. RDM balances and EduFund
          eligibility are forfeited.
        </li>
        <li>
          Your UGC may remain on the Platform following account termination where it forms part of
          ongoing community discussions, subject to anonymisation where feasible.
        </li>
        <li>
          You may delete your account at any time from Account Settings. This initiates a 30-day
          cooling-off period before permanent deletion, during which you may reactivate the account.
          After 30 days, account data is deleted subject to the data retention provisions in the
          Privacy Policy.
        </li>
      </ul>

      <SectionHeading id="tnc-11">11. Limitation of liability and disclaimer</SectionHeading>
      <p className="text-sm leading-relaxed text-white/50">
        The Platform and all Services are provided &quot;as is&quot; and &quot;as available&quot;
        without warranty of any kind, express or implied, including but not limited to warranties of
        merchantability, fitness for a particular purpose, or non-infringement.
      </p>
      <p className="text-sm leading-relaxed text-white/50">
        EduBlast does not guarantee that: (a) the Platform will be uninterrupted, secure, or
        error-free; (b) any specific examination result or score improvement will result from use of
        the Platform; (c) AI-generated content is accurate or current; or (d) teacher-provided
        content is complete, accurate, or appropriate for your specific circumstances.
      </p>
      <p className="text-sm leading-relaxed text-white/50">
        To the maximum extent permitted by applicable Indian law, EduBlast&apos;s aggregate
        liability for any claim arising from or related to these Terms or the Platform shall not
        exceed the total subscription fees paid by you in the 12 months preceding the claim.
        EduBlast is not liable for any indirect, incidental, consequential, or punitive damages.
      </p>
      <p className="text-sm leading-relaxed text-white/50">
        Nothing in these Terms limits EduBlast&apos;s liability for death or personal injury caused
        by its negligence, fraud, or any liability that cannot be excluded by law.
      </p>

      <SectionHeading id="tnc-12">
        12. Governing law, dispute resolution and amendments
      </SectionHeading>
      <ul className="list-disc space-y-1 pl-5 text-sm leading-relaxed text-white/50">
        <li>
          These Terms are governed by and construed in accordance with the laws of India. Any
          disputes arising from these Terms shall be subject to the exclusive jurisdiction of the
          courts in Bengaluru, Karnataka.
        </li>
        <li>
          Before initiating formal legal proceedings, both parties agree to attempt resolution
          through good faith negotiation for a period of 30 days from the date the dispute is
          notified in writing.
        </li>
        <li>
          EduBlast may amend these Terms at any time. Material changes will be communicated via
          email to registered users and/or a prominent notice on the Platform at least 14 days
          before the changes take effect. Continued use of the Platform after the effective date
          constitutes acceptance of the amended Terms.
        </li>
        <li>
          If any provision of these Terms is found to be unenforceable, the remaining provisions
          continue in full force and effect.
        </li>
        <li>
          These Terms constitute the entire agreement between you and EduBlast with respect to the
          Platform and supersede all prior agreements or representations.
        </li>
      </ul>

      <div className="mt-5 grid grid-cols-1 gap-2.5 sm:grid-cols-2">
        <ContactCard
          label="Legal queries"
          value="legal@edublast.in"
          sub="Response within 7 working days"
        />
        <ContactCard
          label="Registered office"
          value="EduBlast Technologies Pvt Ltd"
          sub="Bengaluru, Karnataka — 560001, India"
        />
      </div>
      <BackToTop scrollContainerId={scrollContainerId} />
    </>
  );
}

export default function TermsAndConditionsPage() {
  return <TermsAndConditionsContent />;
}
