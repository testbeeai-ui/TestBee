"use client";

import { useCallback, useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { Calendar, ExternalLink, Loader2, Video, X } from "lucide-react";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { useToast } from "@/hooks/use-toast";
import { fetchWithClientAuth } from "@/lib/auth/clientApiAuth";
import { supabase } from "@/integrations/supabase/client";
import WallTimeSelects from "@/components/teacher-portal/live/WallTimeSelects";
import {
  formatTeacherLiveClassQuotaLabel,
  isUnlimitedLiveClassesCap,
  liveClassQuotaExceededMessage,
  type TeacherPlanKey,
} from "@/lib/teacherPortal/teacherPlan";
import { buildTeacherMeetJoinUrl, teacherMeetJoinTitle } from "@/lib/meetLink";

type PlanLimitsResponse = {
  tier: TeacherPlanKey;
  liveClasses: { allowed: boolean; remaining: number; cap: number };
  usage?: { liveClassesBookedThisMonth?: number };
};

type BookedSlotRow = {
  id: string;
  slot_at: string;
  duration_minutes: number;
  meet_link: string | null;
};

export type BookLiveClassSlotPanelProps = {
  classroomId: string;
  sectionId: string;
  sectionName: string;
  /** compact = trigger bar + modal on Students tab; settings = inline form in Settings */
  variant?: "compact" | "settings";
  disabled?: boolean;
  googleCalendarConnected?: boolean;
  /** Connected Calendar account — Meet opens as host via authuser. */
  googleCalendarEmail?: string | null;
  onConnectGoogle?: () => void;
  onBooked?: () => void;
  /** Open schedule modal once (e.g. sidebar quick link). */
  autoOpenSchedule?: boolean;
  onAutoOpenScheduleHandled?: () => void;
};

function formatSlotShort(iso: string, durationMinutes: number): string {
  const start = new Date(iso);
  if (Number.isNaN(start.getTime())) return iso;
  const end = new Date(start.getTime() + durationMinutes * 60 * 1000);
  const d = start.toLocaleDateString("en-IN", { day: "numeric", month: "short" });
  const t1 = start.toLocaleTimeString("en-IN", { hour: "numeric", minute: "2-digit" });
  const t2 = end.toLocaleTimeString("en-IN", { hour: "numeric", minute: "2-digit" });
  return `${d} ${t1}–${t2}`;
}

const DURATION_OPTIONS = [45, 60, 90, 120] as const;

/** Solid surfaces + opaque borders — avoids muddy translucent stacking. */
const modalSurface = "bg-[#0c0e14] text-zinc-100";
const fieldShell =
  "mt-1.5 h-10 w-full rounded-md border border-zinc-700/90 bg-[#080a10] px-3 text-sm text-zinc-50 outline-none transition [color-scheme:dark] placeholder:text-zinc-600 focus:border-zinc-500 focus:ring-2 focus:ring-zinc-600/30 disabled:opacity-50";
const fieldLabelClass = "text-[13px] font-medium text-zinc-300";
const primaryBtnClass =
  "inline-flex h-10 w-full items-center justify-center gap-2 rounded-md bg-emerald-600 text-sm font-semibold text-white transition hover:bg-emerald-500 active:bg-emerald-700 disabled:cursor-not-allowed disabled:bg-zinc-800 disabled:text-zinc-500";
const compactScheduleBtnClass =
  "inline-flex h-8 shrink-0 items-center gap-1.5 rounded-md bg-emerald-600 px-3.5 text-xs font-semibold text-white transition hover:bg-emerald-500 active:bg-emerald-700";

export function BookLiveClassSlotPanel({
  classroomId,
  sectionId,
  sectionName,
  variant = "compact",
  disabled,
  googleCalendarConnected = true,
  googleCalendarEmail,
  onConnectGoogle,
  onBooked,
  autoOpenSchedule = false,
  onAutoOpenScheduleHandled,
}: BookLiveClassSlotPanelProps) {
  const router = useRouter();
  const { toast } = useToast();
  const [modalOpen, setModalOpen] = useState(false);
  const [slotDate, setSlotDate] = useState("");
  const [slotTime, setSlotTime] = useState("18:00");
  const [durationMinutes, setDurationMinutes] = useState(60);
  const [booking, setBooking] = useState(false);
  const [limits, setLimits] = useState<PlanLimitsResponse | null>(null);
  const [limitsLoading, setLimitsLoading] = useState(true);
  const [upcomingSlots, setUpcomingSlots] = useState<BookedSlotRow[]>([]);
  /** Live check via /api/integrations/google/status — avoids stale profiles.google_connected in bundle. */
  const [calendarConnectedLive, setCalendarConnectedLive] = useState<boolean | null>(null);
  const [calendarEmailLive, setCalendarEmailLive] = useState<string | null>(null);

  const refreshGoogleCalendarStatus = useCallback(async () => {
    try {
      const res = await fetchWithClientAuth(`/api/integrations/google/status?t=${Date.now()}`);
      const body = (await res.json()) as {
        connected?: boolean;
        googleAccountEmail?: string | null;
      };
      if (!res.ok) return;
      setCalendarConnectedLive(Boolean(body.connected));
      if (body.googleAccountEmail?.trim()) {
        setCalendarEmailLive(body.googleAccountEmail.trim());
      }
    } catch {
      // Keep prop fallback when status check fails.
    }
  }, []);

  const goToSubscriptions = () => router.push("/teacher-portal?section=subscriptions");

  const loadLimits = useCallback(async () => {
    setLimitsLoading(true);
    try {
      const res = await fetchWithClientAuth("/api/teacher/plan/limits");
      const body = (await res.json()) as PlanLimitsResponse & { error?: string };
      if (res.ok) setLimits(body);
    } finally {
      setLimitsLoading(false);
    }
  }, []);

  const loadUpcomingSlots = useCallback(async () => {
    try {
      const { data } = await (supabase as any)
        .from("live_class_slots")
        .select("id, slot_at, duration_minutes, meet_link")
        .eq("section_id", sectionId)
        .eq("status", "scheduled")
        .gte("slot_at", new Date().toISOString())
        .order("slot_at", { ascending: true })
        .limit(variant === "compact" ? 5 : 6);
      setUpcomingSlots((data ?? []) as BookedSlotRow[]);
    } catch {
      setUpcomingSlots([]);
    }
  }, [sectionId, variant]);

  useEffect(() => {
    void loadLimits();
    void loadUpcomingSlots();
    void refreshGoogleCalendarStatus();
  }, [loadLimits, loadUpcomingSlots, refreshGoogleCalendarStatus]);

  useEffect(() => {
    if (modalOpen) void refreshGoogleCalendarStatus();
  }, [modalOpen, refreshGoogleCalendarStatus]);

  useEffect(() => {
    if (!autoOpenSchedule || disabled || limitsLoading) return;
    setModalOpen(true);
    onAutoOpenScheduleHandled?.();
  }, [autoOpenSchedule, disabled, limitsLoading, onAutoOpenScheduleHandled]);

  const googleConnected = calendarConnectedLive ?? googleCalendarConnected;
  const resolvedCalendarEmail = calendarEmailLive ?? googleCalendarEmail ?? null;

  const tier = limits?.tier ?? "free";
  const quota = limits?.liveClasses;
  const planReady = Boolean(
    quota && (isUnlimitedLiveClassesCap(quota.cap) || quota.cap > 0) && quota.allowed
  );
  const canBook = planReady && googleConnected && !disabled;

  const upgradeLabel =
    quota && !quota.allowed ? liveClassQuotaExceededMessage(tier, quota.cap) : null;

  const quotaLabel = quota ? formatTeacherLiveClassQuotaLabel(quota) : null;
  const quotaToneClass =
    quota && isUnlimitedLiveClassesCap(quota.cap)
      ? "text-emerald-300"
      : quota && quota.remaining <= 3
        ? "text-amber-300"
        : "text-sky-300";

  const bookSlot = async () => {
    if (!slotDate || !slotTime) {
      toast({ title: "Pick date and time", variant: "destructive" });
      return;
    }
    if (!canBook) return;
    setBooking(true);
    try {
      const timeZone = Intl.DateTimeFormat().resolvedOptions().timeZone || "Asia/Kolkata";
      const res = await fetchWithClientAuth("/api/teacher/live-classes/book", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          classroomId,
          sectionId,
          slotDate,
          slotTime,
          timeZone,
          durationMinutes,
        }),
      });
      const body = (await res.json()) as { error?: string; remainingThisMonth?: number };
      if (!res.ok) throw new Error(body.error ?? "Booking failed");
      toast({
        title: "Live class booked",
        description:
          typeof body.remainingThisMonth === "number" &&
          limits?.liveClasses &&
          !isUnlimitedLiveClassesCap(limits.liveClasses.cap)
            ? `${body.remainingThisMonth} slot(s) left this month.`
            : "Added to Google Calendar with Meet link.",
      });
      setSlotDate("");
      await loadLimits();
      await loadUpcomingSlots();
      onBooked?.();
    } catch (e) {
      toast({
        title: "Could not book",
        description: e instanceof Error ? e.message : "Try again.",
        variant: "destructive",
      });
    } finally {
      setBooking(false);
    }
  };

  const linkBtn =
    "font-semibold text-violet-300 underline-offset-2 hover:text-violet-200 hover:underline";

  const upcomingList =
    upcomingSlots.length > 0 ? (
      <ul className="divide-y divide-zinc-800 rounded-md border border-zinc-800 bg-[#080a10]">
        {upcomingSlots.map((slot) => (
          <li
            key={slot.id}
            className="flex flex-wrap items-center gap-x-3 gap-y-1 px-3 py-2.5"
          >
            <p className="min-w-0 text-sm font-medium text-zinc-100">
              {formatSlotShort(slot.slot_at, slot.duration_minutes)}
            </p>
            {slot.meet_link ? (
              <a
                href={buildTeacherMeetJoinUrl(slot.meet_link, resolvedCalendarEmail)}
                target="_blank"
                rel="noreferrer"
                title={teacherMeetJoinTitle(resolvedCalendarEmail)}
                className="inline-flex items-center gap-1 text-xs font-medium text-emerald-400 hover:text-emerald-300"
              >
                Start meeting
                <ExternalLink className="h-3 w-3" />
              </a>
            ) : null}
          </li>
        ))}
      </ul>
    ) : null;

  const durationPills = (
    <div className="mt-1.5 grid grid-cols-4 gap-1 rounded-md border border-zinc-800 bg-[#080a10] p-1">
      {DURATION_OPTIONS.map((mins) => {
        const active = durationMinutes === mins;
        return (
          <button
            key={mins}
            type="button"
            disabled={booking}
            onClick={() => setDurationMinutes(mins)}
            className={`rounded px-2 py-2 text-xs font-medium transition ${
              active
                ? "bg-zinc-800 text-zinc-50 ring-1 ring-zinc-600"
                : "text-zinc-500 hover:bg-zinc-900 hover:text-zinc-300"
            }`}
          >
            {mins}m
          </button>
        );
      })}
    </div>
  );

  const modalBookingForm = (
    <div className="space-y-5">
      <div className="grid gap-4 sm:grid-cols-2">
        <label className="block">
          <span className={fieldLabelClass}>Date</span>
          <input
            type="date"
            value={slotDate}
            onChange={(e) => setSlotDate(e.target.value)}
            disabled={booking}
            min={new Date().toISOString().slice(0, 10)}
            className={fieldShell}
          />
        </label>

        <label className="block">
          <span className={fieldLabelClass}>Start time</span>
          <div className="mt-1.5 rounded-md border border-zinc-700/90 bg-[#080a10] [color-scheme:dark]">
            <WallTimeSelects
              value={slotTime}
              onChange={setSlotTime}
              disabled={booking}
              size="md"
              variant="inline"
            />
          </div>
        </label>
      </div>

      <div>
        <span className={fieldLabelClass}>Duration</span>
        {durationPills}
      </div>

      <div className="space-y-2">
        <button
          type="button"
          onClick={() => void bookSlot()}
          disabled={booking || !slotDate || !canBook}
          className={primaryBtnClass}
        >
          {booking ? (
            <Loader2 className="h-4 w-4 animate-spin" />
          ) : (
            <Calendar className="h-4 w-4" />
          )}
          Schedule live class
        </button>
        <p className="text-xs text-zinc-500">
          Google Calendar event · Meet link included
        </p>
      </div>
    </div>
  );

  const inlineBookingForm = (
    <div className="space-y-3">
      <div className="grid gap-2 sm:grid-cols-3">
        <label className="block">
          <span className={fieldLabelClass}>Date</span>
          <input
            type="date"
            value={slotDate}
            onChange={(e) => setSlotDate(e.target.value)}
            disabled={booking}
            min={new Date().toISOString().slice(0, 10)}
            className={fieldShell}
          />
        </label>
        <label className="block">
          <span className={fieldLabelClass}>Time</span>
          <div className="mt-1.5">
            <WallTimeSelects value={slotTime} onChange={setSlotTime} disabled={booking} />
          </div>
        </label>
        <label className="block">
          <span className={fieldLabelClass}>Duration</span>
          <select
            value={String(durationMinutes)}
            onChange={(e) => setDurationMinutes(Number(e.target.value))}
            disabled={booking}
            className={fieldShell}
          >
            {DURATION_OPTIONS.map((m) => (
              <option key={m} value={m}>
                {m} min
              </option>
            ))}
          </select>
        </label>
      </div>
      <button
        type="button"
        onClick={() => void bookSlot()}
        disabled={booking || !slotDate || !canBook}
        className={`${primaryBtnClass} w-full`}
      >
        {booking ? <Loader2 className="h-4 w-4 animate-spin" /> : <Calendar className="h-4 w-4" />}
        Schedule live class
      </button>
    </div>
  );

  if (limitsLoading) {
    return (
      <div className="flex items-center gap-2 rounded-xl border border-emerald-500/15 bg-[#0c1018] px-3.5 py-2.5 text-xs text-emerald-300/70">
        <Loader2 className="h-3.5 w-3.5 animate-spin" /> Loading live classes…
      </div>
    );
  }

  if (variant === "compact") {
    return (
      <>
        <div className="flex flex-wrap items-center gap-3 rounded-xl border border-emerald-500/20 bg-[#0c1018] px-3.5 py-2.5">
          <div className="flex h-9 w-9 shrink-0 items-center justify-center rounded-lg bg-emerald-500/10 ring-1 ring-emerald-500/25">
            <Video className="h-4 w-4 text-emerald-400" strokeWidth={2.25} />
          </div>

          <div className="min-w-0">
            <p className="truncate text-sm font-semibold text-white">{sectionName}</p>
            {quotaLabel ? (
              <p className={`mt-0.5 text-xs font-medium ${quotaToneClass}`}>{quotaLabel}</p>
            ) : (
              <p className="mt-0.5 text-xs text-emerald-400/80">Live class scheduling</p>
            )}
          </div>

          <button
            type="button"
            onClick={() => setModalOpen(true)}
            className={compactScheduleBtnClass}
          >
            <Calendar className="h-3.5 w-3.5" />
            Schedule lesson
          </button>
        </div>

        <Dialog open={modalOpen} onOpenChange={() => {}}>
          <DialogContent
            hideClose
            overlayClassName="bg-black/75"
            className={`gap-0 overflow-hidden rounded-xl border border-zinc-800 p-0 shadow-none sm:max-w-[400px] ${modalSurface} data-[state=open]:zoom-in-100 data-[state=closed]:zoom-out-100`}
            onInteractOutside={(e) => e.preventDefault()}
            onEscapeKeyDown={(e) => e.preventDefault()}
          >
            <div className="relative border-b border-zinc-800 px-5 py-4 pr-11">
              <button
                type="button"
                onClick={() => setModalOpen(false)}
                aria-label="Close"
                className="absolute right-3 top-3 inline-flex h-7 w-7 items-center justify-center rounded-md text-zinc-500 transition hover:bg-zinc-800 hover:text-zinc-200"
              >
                <X className="h-4 w-4" />
              </button>
              <DialogHeader className="space-y-0.5 text-left">
                <DialogTitle className="text-[15px] font-semibold tracking-tight text-zinc-50">
                  Schedule live class
                </DialogTitle>
                <p className="text-sm text-zinc-400">
                  {sectionName}
                  {quotaLabel ? (
                    <>
                      <span className="text-zinc-600"> · </span>
                      <span className="text-zinc-500">{quotaLabel}</span>
                    </>
                  ) : null}
                </p>
              </DialogHeader>
            </div>

            <div className="px-5 py-5">
              {upgradeLabel ? (
                <p className="rounded-lg border border-violet-500/20 bg-violet-500/5 px-3 py-2.5 text-sm text-slate-300">
                  <button type="button" onClick={goToSubscriptions} className={linkBtn}>
                    {upgradeLabel}
                  </button>
                </p>
              ) : !googleConnected ? (
                <p className="rounded-lg border border-amber-500/20 bg-amber-500/5 px-3 py-2.5 text-sm text-slate-300">
                  <button type="button" onClick={onConnectGoogle} className={linkBtn}>
                    Connect Google Calendar to schedule classes
                  </button>
                </p>
              ) : (
                modalBookingForm
              )}

              {upcomingList ? (
                <div className="mt-6 border-t border-zinc-800 pt-4">
                  <p className="mb-2 text-xs font-medium text-zinc-500">Upcoming</p>
                  {upcomingList}
                </div>
              ) : null}
            </div>
          </DialogContent>
        </Dialog>
      </>
    );
  }

  // Settings tab — inline form
  if (upgradeLabel) {
    return (
      <div className="rounded-xl border border-violet-500/20 bg-violet-500/5 px-3 py-2 text-xs text-slate-300">
        <button type="button" onClick={goToSubscriptions} className={linkBtn}>
          {upgradeLabel}
        </button>
      </div>
    );
  }

  if (!googleConnected) {
    return (
      <div className="rounded-xl border border-amber-500/20 bg-amber-500/5 px-3 py-2 text-xs text-slate-300">
        <button type="button" onClick={onConnectGoogle} className={linkBtn}>
          Connect Google Calendar to book
        </button>
      </div>
    );
  }

  return (
    <div className="space-y-3">
      {quotaLabel ? (
        <p className="text-xs text-slate-400">{quotaLabel}</p>
      ) : null}
      {inlineBookingForm}
      {upcomingList ? (
        <div>
          <p className="mb-2 text-xs font-medium text-slate-500">Upcoming</p>
          {upcomingList}
        </div>
      ) : null}
    </div>
  );
}
