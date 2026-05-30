"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import {
  User,
  GraduationCap,
  Trophy,
  Activity,
  Heart,
  CreditCard,
  LayoutGrid,
  Wallet,
  Receipt,
  CircleMinus,
  Settings,
  ChevronDown,
} from "lucide-react";
import { useAuth } from "@/hooks/useAuth";
import { cn } from "@/lib/utils";

export type StudentProfileSectionId =
  | "personal"
  | "academic"
  | "achievements"
  | "activity"
  | "edufund"
  | "sub-overview"
  | "sub-plans"
  | "sub-payment"
  | "sub-checkout"
  | "sub-history"
  | "sub-cancel"
  | "settings";

const NAV: { id: StudentProfileSectionId; label: string; icon: typeof User }[] = [
  { id: "personal", label: "Personal info", icon: User },
  { id: "academic", label: "Academic record", icon: GraduationCap },
  { id: "achievements", label: "Achievements", icon: Trophy },
  { id: "activity", label: "Activity track record", icon: Activity },
  { id: "edufund", label: "EduFund Eligibility", icon: Heart },
];

const PERSONAL_GROUP: StudentProfileSectionId[] = [
  "personal",
  "academic",
  "achievements",
  "activity",
];
const SUBSCRIPTION_GROUP: StudentProfileSectionId[] = [
  "sub-overview",
  "sub-plans",
  "sub-payment",
  "sub-checkout",
  "sub-history",
  "sub-cancel",
];
const SUBSCRIPTION_ITEMS: { id: StudentProfileSectionId; label: string; icon: typeof User }[] = [
  { id: "sub-overview", label: "My subscription", icon: CreditCard },
  { id: "sub-plans", label: "Change plan", icon: LayoutGrid },
  { id: "sub-payment", label: "Payment methods", icon: CreditCard },
  { id: "sub-checkout", label: "Pay via Razorpay", icon: Wallet },
  { id: "sub-history", label: "Billing history", icon: Receipt },
  { id: "sub-cancel", label: "Cancel subscription", icon: CircleMinus },
];

interface StudentProfileShellProps {
  displayName: string;
  roleLabel?: string;
  initials: string;
  activeSection: StudentProfileSectionId;
  onSectionChange: (id: StudentProfileSectionId) => void;
  rdmDisplay?: number;
  children: React.ReactNode;
}

export default function StudentProfileShell({
  displayName,
  roleLabel = "Student",
  initials,
  activeSection,
  onSectionChange,
  rdmDisplay,
  children,
}: StudentProfileShellProps) {
  const router = useRouter();
  const { signOut } = useAuth();
  const [loggingOut, setLoggingOut] = useState(false);
  const [personalSubCollapsed, setPersonalSubCollapsed] = useState(false);
  const [subscriptionSubCollapsed, setSubscriptionSubCollapsed] = useState(false);
  const personalOpen = PERSONAL_GROUP.includes(activeSection);
  const subscriptionOpen = SUBSCRIPTION_GROUP.includes(activeSection);
  const subMenuVisible = personalOpen && !personalSubCollapsed;
  const subscriptionMenuVisible = subscriptionOpen && !subscriptionSubCollapsed;

  useEffect(() => {
    if (!personalOpen) setPersonalSubCollapsed(false);
  }, [personalOpen]);

  useEffect(() => {
    if (!subscriptionOpen) setSubscriptionSubCollapsed(false);
  }, [subscriptionOpen]);

  const handleLogout = async () => {
    setLoggingOut(true);
    try {
      await signOut();
    } catch (e) {
      console.error("[profile-shell] signOut", e);
      router.replace("/");
      router.refresh();
    } finally {
      setLoggingOut(false);
    }
  };

  const personalItem = NAV.find((n) => n.id === "personal")!;
  const edufundItem = NAV.find((n) => n.id === "edufund")!;
  const underPersonal = NAV.filter((n) => n.id !== "personal" && n.id !== "edufund");
  const PersonalIcon = personalItem.icon;
  const personalActive = activeSection === "personal";
  const { id: edufundId, label: edufundLabel, icon: EdufundIcon } = edufundItem;
  const edufundActive = activeSection === edufundId;
  const settingsActive = activeSection === "settings";

  return (
    <div className="flex min-h-0 flex-col gap-3 sm:min-h-[min(82vh,900px)] sm:gap-4 lg:flex-row lg:items-stretch lg:gap-4 xl:gap-5 2xl:gap-6">
      <aside className="flex w-full shrink-0 flex-col rounded-xl border border-border bg-card sm:rounded-2xl dark:border-white/10 dark:bg-[#0c1017] lg:w-[13.5rem] xl:w-60 2xl:w-64">
        <div className="border-b border-border/80 p-2.5 dark:border-white/10 sm:p-3">
          <div className="flex items-start gap-2 sm:gap-2.5">
            <div className="flex h-9 w-9 shrink-0 items-center justify-center rounded-full bg-emerald-600/20 text-[11px] font-black text-emerald-400 ring-2 ring-emerald-500/40 sm:h-10 sm:w-10 sm:text-xs">
              {initials.slice(0, 2).toUpperCase()}
            </div>
            <div className="flex min-w-0 flex-1 flex-col gap-0">
              <p className="m-0 truncate text-sm font-bold leading-none text-foreground sm:text-base dark:text-white">
                {displayName}
              </p>
              <div className="mt-0 flex min-h-8 items-center justify-between gap-2">
                <p className="m-0 min-w-0 truncate text-[11px] font-semibold leading-none text-muted-foreground sm:text-xs dark:text-slate-400">
                  {roleLabel}
                </p>
                <button
                  type="button"
                  onClick={() => void handleLogout()}
                  disabled={loggingOut}
                  className={cn(
                    "shrink-0 rounded-lg border border-rose-400/40 px-3 py-1.5 text-xs font-semibold leading-none text-rose-400 transition-colors sm:px-3.5 sm:py-1.5 sm:text-sm",
                    "hover:border-rose-500/60 hover:bg-rose-500/10 hover:text-rose-300 disabled:pointer-events-none disabled:opacity-50",
                    "dark:border-rose-400/30 dark:text-rose-400 dark:hover:border-rose-400/50"
                  )}
                >
                  {loggingOut ? "Signing out" : "Logout"}
                </button>
              </div>
            </div>
          </div>
          {rdmDisplay != null ? (
            <p className="mt-1.5 text-[11px] leading-none text-muted-foreground sm:mt-2 sm:text-xs dark:text-slate-500">
              <span className="font-bold text-emerald-400">{rdmDisplay.toLocaleString()}</span> RDM
            </p>
          ) : null}
        </div>
        <nav className="flex flex-col gap-0.5 p-1.5 sm:p-2">
          <button
            type="button"
            onClick={() => {
              if (!personalOpen) {
                onSectionChange("personal");
                setPersonalSubCollapsed(false);
                return;
              }
              if (subMenuVisible) setPersonalSubCollapsed(true);
              else setPersonalSubCollapsed(false);
            }}
            className={cn(
              "flex w-full items-center gap-1.5 rounded-lg px-2.5 py-2 text-left text-[11px] font-bold transition-colors sm:gap-2 sm:px-3 sm:py-2.5 sm:text-xs lg:text-sm",
              personalActive
                ? "border-l-4 border-emerald-500 bg-emerald-500/15 text-emerald-100"
                : personalOpen && !personalActive
                  ? "border-l-4 border-transparent bg-muted/40 text-foreground dark:bg-white/10 dark:text-slate-200"
                  : "border-l-4 border-transparent text-muted-foreground hover:bg-muted/50 hover:text-foreground dark:hover:bg-white/5"
            )}
          >
            <PersonalIcon className="h-3.5 w-3.5 shrink-0 opacity-90 sm:h-4 sm:w-4" />
            <span className="min-w-0 flex-1 truncate">{personalItem.label}</span>
            <ChevronDown
              className={cn(
                "h-3.5 w-3.5 shrink-0 opacity-70 transition-transform sm:h-4 sm:w-4",
                subMenuVisible ? "rotate-0" : "-rotate-90"
              )}
            />
          </button>
          {subMenuVisible
            ? underPersonal.map(({ id, label, icon: SubIcon }) => {
                const active = activeSection === id;
                return (
                  <button
                    key={id}
                    type="button"
                    onClick={() => onSectionChange(id)}
                    className={cn(
                      "flex w-full items-center gap-1.5 rounded-lg py-2 pl-7 pr-2.5 text-left text-[11px] font-bold transition-colors sm:gap-2 sm:py-2.5 sm:pl-9 sm:pr-3 sm:text-xs lg:text-sm",
                      active
                        ? "border-l-4 border-emerald-500 bg-emerald-500/15 text-emerald-100"
                        : "border-l-4 border-transparent text-muted-foreground hover:bg-muted/50 hover:text-foreground dark:hover:bg-white/5"
                    )}
                  >
                    <SubIcon className="h-3.5 w-3.5 shrink-0 opacity-90 sm:h-4 sm:w-4" />
                    <span className="min-w-0 flex-1 truncate">{label}</span>
                  </button>
                );
              })
            : null}
          <button
            type="button"
            onClick={() => onSectionChange(edufundId)}
            className={cn(
              "flex w-full items-center gap-1.5 rounded-lg px-2.5 py-2 text-left text-[11px] font-bold transition-colors sm:gap-2 sm:px-3 sm:py-2.5 sm:text-xs lg:text-sm",
              edufundActive
                ? "border-l-4 border-emerald-500 bg-emerald-500/15 text-emerald-100"
                : "border-l-4 border-transparent text-muted-foreground hover:bg-muted/50 hover:text-foreground dark:hover:bg-white/5"
            )}
          >
            <EdufundIcon className="h-3.5 w-3.5 shrink-0 opacity-90 sm:h-4 sm:w-4" />
            <span className="min-w-0 flex-1 truncate">{edufundLabel}</span>
          </button>
          {/* Subscription expandable */}
          <button
            type="button"
            onClick={() => {
              if (!subscriptionOpen) {
                onSectionChange("sub-overview");
                setSubscriptionSubCollapsed(false);
                return;
              }
              if (subscriptionMenuVisible) setSubscriptionSubCollapsed(true);
              else setSubscriptionSubCollapsed(false);
            }}
            className={cn(
              "flex w-full items-center gap-1.5 rounded-lg px-2.5 py-2 text-left text-[11px] font-bold transition-colors sm:gap-2 sm:px-3 sm:py-2.5 sm:text-xs lg:text-sm",
              activeSection === "sub-overview" && !subscriptionSubCollapsed
                ? "border-l-4 border-emerald-500 bg-emerald-500/15 text-emerald-100"
                : subscriptionOpen && !subscriptionMenuVisible
                  ? "border-l-4 border-transparent bg-muted/40 text-foreground dark:bg-white/10 dark:text-slate-200"
                  : "border-l-4 border-transparent text-muted-foreground hover:bg-muted/50 hover:text-foreground dark:hover:bg-white/5"
            )}
          >
            <CreditCard className="h-3.5 w-3.5 shrink-0 opacity-90 sm:h-4 sm:w-4" />
            <span className="min-w-0 flex-1 truncate">Subscription</span>
            <ChevronDown
              className={cn(
                "h-3.5 w-3.5 shrink-0 opacity-70 transition-transform sm:h-4 sm:w-4",
                subscriptionMenuVisible ? "rotate-0" : "-rotate-90"
              )}
            />
          </button>
          {subscriptionMenuVisible
            ? SUBSCRIPTION_ITEMS.map(({ id, label, icon: SubIcon }) => {
                const active = activeSection === id;
                return (
                  <button
                    key={id}
                    type="button"
                    onClick={() => onSectionChange(id)}
                    className={cn(
                      "flex w-full items-center gap-1.5 rounded-lg py-2 pl-7 pr-2.5 text-left text-[11px] font-bold transition-colors sm:gap-2 sm:py-2.5 sm:pl-9 sm:pr-3 sm:text-xs lg:text-sm",
                      active
                        ? "border-l-4 border-emerald-500 bg-emerald-500/15 text-emerald-100"
                        : "border-l-4 border-transparent text-muted-foreground hover:bg-muted/50 hover:text-foreground dark:hover:bg-white/5"
                    )}
                  >
                    <SubIcon className="h-3.5 w-3.5 shrink-0 opacity-90 sm:h-4 sm:w-4" />
                    <span className="min-w-0 flex-1 truncate">{label}</span>
                  </button>
                );
              })
            : null}
          <button
            type="button"
            onClick={() => onSectionChange("settings")}
            className={cn(
              "flex w-full items-center gap-1.5 rounded-lg px-2.5 py-2 text-left text-[11px] font-bold transition-colors sm:gap-2 sm:px-3 sm:py-2.5 sm:text-xs lg:text-sm",
              settingsActive
                ? "border-l-4 border-emerald-500 bg-emerald-500/15 text-emerald-100"
                : "border-l-4 border-transparent text-muted-foreground hover:bg-muted/50 hover:text-foreground dark:hover:bg-white/5"
            )}
          >
            <Settings className="h-3.5 w-3.5 shrink-0 opacity-90 sm:h-4 sm:w-4" />
            <span className="min-w-0 flex-1 truncate">Settings</span>
          </button>
        </nav>
      </aside>

      <div className="min-w-0 flex-1 lg:min-w-0">{children}</div>
    </div>
  );
}
