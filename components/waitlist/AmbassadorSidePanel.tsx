"use client";

import { useState } from "react";
import { motion, AnimatePresence } from "framer-motion";
import {
  ArrowRight,
  Clock,
  Heart,
  Lock,
  Mail,
  Phone,
  Presentation,
  School,
  Star,
  Trophy,
  ListTodo,
  User,
} from "lucide-react";
import { cn } from "@/lib/utils";
import {
  ambassadorUrgencyLine,
  ROLE_OPTIONS,
  WAITLIST_STATS,
} from "@/components/waitlist/waitlist-constants";

const PATHWAY = [
  {
    num: "01",
    title: "Join waitlist",
    sub: "Fill full form — all fields required",
    icon: ListTodo,
    iconBg: "bg-[#0A2A20]",
    iconColor: "text-[#1D9E75]",
  },
  {
    num: "02",
    title: "Phone verify",
    sub: "5-min confirmation call",
    icon: Phone,
    iconBg: "bg-[#281C08]",
    iconColor: "text-[#EF9F27]",
  },
  {
    num: "03",
    title: "Early preview",
    sub: "Access before public launch",
    icon: Star,
    iconBg: "bg-[#171425]",
    iconColor: "text-[#7F77DD]",
  },
  {
    num: "04",
    title: "Paid role",
    sub: "3mth active + 5 referrals + interview",
    icon: Trophy,
    iconBg: "bg-[#EAF5EE]",
    iconColor: "text-[#27AE60]",
  },
] as const;

const shakeVariants = {
  shake: {
    x: [0, -6, 6, -6, 6, 0],
    transition: { duration: 0.4 },
  },
};

type Props = {
  step1Complete: boolean;
  role: string | null;
  onRoleChange: (role: string) => void;
  onRegisterClick: () => void;
  onFocusStep1: () => void;
  completed?: boolean;
  waitlistId?: string;
  waitlistJoined?: number;
};

export function AmbassadorSidePanel({
  step1Complete,
  role,
  onRoleChange,
  onRegisterClick,
  onFocusStep1,
  completed = false,
  waitlistId = "",
  waitlistJoined = 247,
}: Props) {
  const urgency = ambassadorUrgencyLine();
  const [showRoleError, setShowRoleError] = useState(false);

  if (completed) {
    return (
      <div className="relative overflow-hidden rounded-[14px] border border-[#2A3347]/80 bg-[#161C26] p-4 sm:p-5 before:absolute before:inset-x-0 before:top-0 before:h-[3px] before:rounded-t-[14px] before:bg-[#7F77DD] before:content-['']">
        <div className="mb-2.5 inline-flex items-center gap-1.5 rounded-full border border-[#7F77DD] bg-[#171425] px-2.5 py-0.5 text-[11px] font-medium text-[#AFA9EC]">
          <span className="flex h-[17px] w-[17px] shrink-0 items-center justify-center rounded-full bg-[#7F77DD] text-[10px] text-white">
            ✓
          </span>
          Become an ambassador — done
        </div>
        <div className="py-4 text-center">
          <div className="mx-auto mb-3 flex h-12 w-12 items-center justify-center rounded-full border-2 border-[#7F77DD] bg-[#171425]">
            <Trophy className="h-6 w-6 text-[#7F77DD]" />
          </div>
          <p className="text-sm font-semibold text-white">Ambassador application received!</p>
          <p className="mx-auto mt-2 max-w-[280px] text-xs leading-relaxed text-[#9BA3B8]">
            Thank you for applying to the EduBlast Ambassador programme. Your details have been successfully recorded.
          </p>

          {waitlistId && (
            <div className="mt-3.5 inline-flex items-center gap-1 bg-[#281C08] border border-[#EF9F27] rounded-full px-3 py-1 text-[11px] font-medium text-[#FAC775] shadow-sm">
              Waitlist ID: <span className="font-mono">EB-2026-{waitlistId.replace("EB-2026-", "")}</span>
            </div>
          )}

          <div className="mt-4 flex flex-col gap-2 text-left">
            <div className="flex items-start gap-2.5 p-2.5 bg-[#1C2333]/80 border border-[#2A3347]/80 rounded-lg text-xs leading-relaxed text-[#9BA3B8]">
              <Phone className="h-[16px] w-[16px] text-[#EF9F27] shrink-0 mt-0.5" />
              <span>We will call your mobile number to verify your details — keep an eye out for a call from our team.</span>
            </div>
            <div className="flex items-start gap-2.5 p-2.5 bg-[#1C2333]/80 border border-[#2A3347]/80 rounded-lg text-xs leading-relaxed text-[#9BA3B8]">
              <Mail className="h-[16px] w-[16px] text-[#1D9E75] shrink-0 mt-0.5" />
              <span>A confirmation email is on its way. Check your spam folder if it doesn't arrive shortly.</span>
            </div>
            <div className="flex items-start gap-2.5 p-2.5 bg-[#1C2333]/80 border border-[#2A3347]/80 rounded-lg text-xs leading-relaxed text-[#9BA3B8]">
              <User className="h-[16px] w-[16px] text-[#85B7EB] shrink-0 mt-0.5" />
              <span>Share EduBlast website with classmates. Each person who joins the website post-live strengthens your application for Ambassador.</span>
            </div>
          </div>
        </div>
      </div>
    );
  }

  const handleRegister = () => {
    if (!step1Complete) {
      onFocusStep1();
      return;
    }
    if (!role) {
      setShowRoleError(true);
      return;
    }
    setShowRoleError(false);
    onRegisterClick();
  };

  const handleRoleSelect = (roleId: string) => {
    if (step1Complete) {
      onRoleChange(roleId);
      setShowRoleError(false);
    }
  };

  return (
    <div className="relative overflow-hidden rounded-[14px] border border-[#2A3347]/80 bg-[#161C26] p-4 sm:p-5 before:absolute before:inset-x-0 before:top-0 before:h-[3px] before:rounded-t-[14px] before:bg-[#7F77DD] before:content-['']">
      <div className="mb-2.5 inline-flex items-center gap-1.5 rounded-full border border-[#7F77DD] bg-[#171425] px-2.5 py-0.5 text-[11px] font-medium text-[#AFA9EC]">
        <span className="flex h-[17px] w-[17px] shrink-0 items-center justify-center rounded-full bg-[#7F77DD] text-[10px] font-medium text-white">
          2
        </span>
        Become an ambassador
      </div>

      <h2 className="mb-1 text-base font-medium text-[#E8EAF0]">
        Want to be selected as <span className="text-[#7F77DD]">Ambassador?</span>
      </h2>
      <p className="mb-3 text-xs leading-relaxed text-[#9BA3B8] sm:mb-3.5">
        Complete Step 1 first, then fill your profile below. Verified applicants with complete
        profiles are selected for early access — and qualify for a{" "}
        <strong className="text-[#AFA9EC]">paid Ambassador role</strong> after the site goes live.
      </p>

      {!step1Complete && (
        <div className="mb-3 flex items-center gap-1.5 rounded-lg border border-[#344060] bg-[#222B3C] px-2.5 py-2 text-xs text-[#5C6480] sm:mb-3.5">
          <Lock className="h-3.5 w-3.5 shrink-0" />
          Complete Step 1 to unlock ambassador registration
        </div>
      )}

      <p className="mb-2 text-center text-[10px] font-medium uppercase tracking-[0.07em] text-[#7F77DD]">
        Ambassador pathway
      </p>
      <div className="relative mb-3 grid grid-cols-4 gap-1.5 sm:mb-3.5">
        <div
          className="pointer-events-none absolute top-5 left-[12%] right-[12%] z-0 h-px bg-[#2A3347]"
          aria-hidden
        />
        {PATHWAY.map((step) => {
          const Icon = step.icon;
          return (
            <div
              key={step.num}
              className="relative z-[1] min-w-0 rounded-lg border border-[#2A3347]/80 bg-[#1C2333] px-1 py-2 text-center sm:px-1.5"
            >
              <span className="absolute right-1 top-1 text-[9px] text-[#5C6480]">{step.num}</span>
              <div
                className={cn(
                  "mx-auto mb-1 flex h-7 w-7 items-center justify-center rounded-full",
                  step.iconBg
                )}
              >
                <Icon className={cn("h-3.5 w-3.5", step.iconColor)} />
              </div>
              <p className="text-[10px] font-medium text-white">{step.title}</p>
              <p className="text-[9px] leading-snug text-[#5C6480]">{step.sub}</p>
            </div>
          );
        })}
      </div>


      <p className="mb-2 text-[11px] font-medium text-[#9BA3B8]">
        I am a <span className="text-[#1D9E75]">*</span>
      </p>
      <motion.div
        variants={shakeVariants}
        animate={showRoleError ? "shake" : "default"}
        className={cn(
          "mb-3 grid grid-cols-2 gap-1.5",
          !step1Complete && "pointer-events-none opacity-60"
        )}
      >
        {ROLE_OPTIONS.map((item) => {
          const sel = role === item.id;
          const isSelected = sel && step1Complete;
          const iconClass = cn("h-3.5 w-3.5", isSelected ? "text-[#7F77DD]" : "text-[#5C6480]");
          return (
            <div
              key={item.id}
              onClick={() => handleRoleSelect(item.id)}
              className={cn(
                "min-w-0 rounded-[9px] border bg-[#1C2333] p-2 transition-all duration-200 sm:p-2.5",
                step1Complete && "cursor-pointer hover:border-[#344060] hover:bg-[#222B3C]",
                isSelected
                  ? "border-[#7F77DD] bg-[#171425] shadow-[0_0_12px_rgba(127,119,221,0.2)] ring-1 ring-[#7F77DD]/30"
                  : showRoleError
                    ? "border-rose-500/40 shadow-[0_0_0_1px_rgba(244,63,94,0.1)]"
                    : "border-[#2A3347]/80"
              )}
            >
              <div className="mb-1 flex items-center gap-1.5">
                <div
                  className={cn(
                    "flex h-7 w-7 shrink-0 items-center justify-center rounded-full bg-[#222B3C]",
                    isSelected && "bg-[#171425] border border-[#7F77DD]/40"
                  )}
                >
                  {item.id === "student" && <School className={iconClass} />}
                  {item.id === "teacher" && <Presentation className={iconClass} />}
                  {item.id === "parent" && <Heart className={iconClass} />}
                  {item.id === "other" && <User className={iconClass} />}
                </div>
                <p className="text-[11px] font-medium text-white sm:text-xs">{item.name}</p>
              </div>
              <p className="mb-1 text-[9px] leading-snug text-[#5C6480] sm:text-[10px]">{item.desc}</p>
              {item.badge && (
                <span className="inline-flex items-center gap-0.5 rounded-full border border-[#7F77DD] bg-[#171425] px-1.5 py-px text-[9px] font-medium text-[#AFA9EC]">
                  <Star className="h-2 w-2 fill-[#AFA9EC] text-[#AFA9EC]" />
                  {item.badge}
                </span>
              )}
            </div>
          );
        })}
      </motion.div>

      <AnimatePresence>
        {showRoleError && (
          <motion.div
            initial={{ opacity: 0, height: 0, marginBottom: 0 }}
            animate={{ opacity: 1, height: "auto", marginBottom: 8 }}
            exit={{ opacity: 0, height: 0, marginBottom: 0 }}
            className="overflow-hidden"
          >
            <div className="rounded-lg border border-rose-500/30 bg-rose-500/10 p-2.5 text-[11px] leading-relaxed text-rose-300 flex items-start gap-1.5 shadow-sm">
              <span className="text-rose-400 font-bold shrink-0">⚠️</span>
              <span>Please select your role from the options above to proceed.</span>
            </div>
          </motion.div>
        )}
      </AnimatePresence>

      <button
        type="button"
        onClick={handleRegister}
        className="mb-2.5 flex w-full items-center justify-center gap-1.5 rounded-full border-0 bg-[#7F77DD] py-2.5 text-sm font-medium text-white transition-colors hover:bg-[#534AB7]"
      >
        <ArrowRight className="h-4 w-4" />
        Register as Ambassador now
      </button>

      <div className="mb-3.5 grid grid-cols-3 gap-1.5">
        {WAITLIST_STATS.map((s) => {
          let displayNum = s.num;
          if (s.lbl === "on the waitlist") {
            displayNum = String(waitlistJoined);
          } else if (s.lbl === "ambassadors shortlisted") {
            displayNum = "18";
          }
          return (
            <div
              key={s.lbl}
              className="min-w-0 rounded-lg border border-[#2A3347]/80 bg-[#1C2333] p-2 text-center"
            >
              <p className={cn("text-base font-medium sm:text-lg", s.color)}>{displayNum}</p>
              <p className="text-[10px] text-[#5C6480]">{s.lbl}</p>
            </div>
          );
        })}
      </div>

      <p className="flex items-start justify-center gap-1.5 text-center text-[11px] leading-relaxed text-[#9BA3B8]">
        <Clock className="mt-0.5 h-3.5 w-3.5 shrink-0 text-[#EF9F27]" />
        <span>
          <strong className="text-[#FAC775]">{urgency.lead}</strong>
          {" · "}
          {urgency.detail}
        </span>
      </p>
    </div>
  );
}
