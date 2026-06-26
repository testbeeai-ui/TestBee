"use client";

import { useCallback, useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { Calendar, Clock, ExternalLink, Loader2, Video, X } from "lucide-react";
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
import { type TeacherPlanKey } from "@/lib/teacherPortal/teacherPlan";

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
  onConnectGoogle?: () => void;
  onBooked?: () => void;
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

const fieldInputClass =
  "mt-1.5 h-11 w-full rounded-xl border border-white/12 bg-[#0c1020] px-3 text-sm text-slate-100 outline-none transition focus:border-sky-400/60 focus:ring-1 focus:ring-sky-400/20 disabled:opacity-50";

const fieldLabelClass =
  "text-[11px] font-semibold uppercase tracking-[0.12em] text-slate-500";

export function BookLiveClassSlotPanel({
  classroomId,
  sectionId,
  sectionName,
  variant = "compact",
  disabled,
  googleCalendarConnected = true,
  onConnectGoogle,
  onBooked,
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
  }, [loadLimits, loadUpcomingSlots]);

  const tier = limits?.tier ?? "free";
  const quota = limits?.liveClasses;
  const planReady = Boolean(quota && quota.cap > 0 && quota.allowed);
  const canBook = planReady && googleCalendarConnected && !disabled;

  const upgradeLabel =
    tier === "free"
      ? "Upgrade to Starter to book live classes"
      : tier === "starter" && quota && !quota.allowed
        ? "Upgrade to Pro for more slots"
        : null;

  const quotaLabel =
    quota && quota.cap > 0
      ? `${quota.remaining}/${quota.cap} left this month`
      : null;

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
          typeof body.remainingThisMonth === "number"
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
      <ul className="space-y-2">
        {upcomingSlots.map((slot) => (
          <li
            key={slot.id}
            className="flex items-center justify-between gap-3 rounded-xl border border-white/8 bg-white/[0.03] px-3 py-2.5"
          >
            <div className="min-w-0">
              <p className="truncate text-sm font-medium text-slate-200">
                {formatSlotShort(slot.slot_at, slot.duration_minutes)}
              </p>
            </div>
            {slot.meet_link ? (
              <a
                href={slot.meet_link}
                target="_blank"
                rel="noreferrer"
                className="inline-flex shrink-0 items-center gap-1 rounded-full border border-sky-500/30 bg-sky-500/10 px-2.5 py-1 text-[11px] font-semibold text-sky-200 hover:bg-sky-500/20"
              >
                Meet <ExternalLink className="h-3 w-3" />
              </a>
            ) : null}
          </li>
        ))}
      </ul>
    ) : null;

  const durationPills = (
    <div className="mt-1.5 flex flex-wrap gap-2">
      {DURATION_OPTIONS.map((mins) => {
        const active = durationMinutes === mins;
        return (
          <button
            key={mins}
            type="button"
            disabled={booking}
            onClick={() => setDurationMinutes(mins)}
            className={`rounded-full px-3.5 py-1.5 text-xs font-semibold transition ${
              active
                ? "bg-sky-500 text-white shadow-sm shadow-sky-900/40"
                : "border border-white/12 bg-[#0c1020] text-slate-400 hover:border-white/20 hover:text-slate-200"
            }`}
          >
            {mins} min
          </button>
        );
      })}
    </div>
  );

  const modalBookingForm = (
    <div className="space-y-5">
      <label className="block">
        <span className={fieldLabelClass}>Class date</span>
        <input
          type="date"
          value={slotDate}
          onChange={(e) => setSlotDate(e.target.value)}
          disabled={booking}
          min={new Date().toISOString().slice(0, 10)}
          className={fieldInputClass}
        />
      </label>

      <label className="block">
        <span className={fieldLabelClass}>Start time</span>
        <div className="mt-1.5">
          <WallTimeSelects value={slotTime} onChange={setSlotTime} disabled={booking} size="md" />
        </div>
      </label>

      <div>
        <span className={fieldLabelClass}>Duration</span>
        {durationPills}
      </div>

      <button
        type="button"
        onClick={() => void bookSlot()}
        disabled={booking || !slotDate || !canBook}
        className="inline-flex h-11 w-full items-center justify-center gap-2 rounded-xl bg-sky-500 text-sm font-bold text-white shadow-lg shadow-sky-950/30 transition hover:bg-sky-400 disabled:opacity-50"
      >
        {booking ? (
          <Loader2 className="h-4 w-4 animate-spin" />
        ) : (
          <Calendar className="h-4 w-4" />
        )}
        Book &amp; add to Google Calendar
      </button>
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
            className={fieldInputClass}
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
            className={fieldInputClass}
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
        className="inline-flex w-full items-center justify-center gap-1.5 rounded-xl bg-sky-500 py-2.5 text-sm font-bold text-white hover:bg-sky-400 disabled:opacity-50"
      >
        {booking ? <Loader2 className="h-4 w-4 animate-spin" /> : <Calendar className="h-4 w-4" />}
        Book &amp; add to Google Calendar
      </button>
    </div>
  );

  if (limitsLoading) {
    return (
      <div className="flex items-center gap-2 rounded-xl border border-white/10 bg-[#15162b] px-3 py-2 text-[11px] text-slate-500">
        <Loader2 className="h-3.5 w-3.5 animate-spin" /> Loading live class…
      </div>
    );
  }

  if (variant === "compact") {
    return (
      <>
        <div className="flex flex-wrap items-center justify-between gap-2 rounded-xl border border-sky-500/25 bg-sky-500/5 px-3 py-2.5">
          <div className="flex min-w-0 items-center gap-2 text-xs font-semibold text-sky-100">
            <Video className="h-4 w-4 shrink-0 text-sky-300" />
            <span className="truncate">Book live class · {sectionName}</span>
          </div>
          <div className="flex flex-wrap items-center gap-2">
            {quotaLabel ? (
              <span className="rounded-full border border-white/10 bg-black/25 px-2.5 py-1 text-[11px] font-semibold tabular-nums text-slate-300">
                {quotaLabel}
              </span>
            ) : null}
            <button
              type="button"
              onClick={() => setModalOpen(true)}
              className="inline-flex h-8 items-center gap-1 rounded-full bg-sky-500 px-3.5 text-[11px] font-bold text-white hover:bg-sky-400"
            >
              <Calendar className="h-3.5 w-3.5" />
              Book a class
            </button>
          </div>
        </div>

        <Dialog open={modalOpen} onOpenChange={() => {}}>
          <DialogContent
            hideClose
            className="gap-0 overflow-hidden rounded-3xl border border-white/15 bg-[#0f1329] p-0 text-slate-100 shadow-[0_24px_80px_rgba(0,0,0,0.55)] sm:max-w-[440px]"
            onInteractOutside={(e) => e.preventDefault()}
            onEscapeKeyDown={(e) => e.preventDefault()}
          >
            <div className="relative border-b border-white/10 bg-gradient-to-br from-sky-950/40 via-[#12162a] to-[#0f1329] px-6 py-5 pr-14">
              <button
                type="button"
                onClick={() => setModalOpen(false)}
                aria-label="Close"
                className="absolute right-4 top-4 inline-flex h-9 w-9 items-center justify-center rounded-full border border-white/12 bg-white/[0.06] text-slate-300 shadow-sm backdrop-blur-sm transition hover:border-white/22 hover:bg-white/12 hover:text-white focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-sky-400/40"
              >
                <X className="h-4 w-4" strokeWidth={2.25} />
              </button>
              <DialogHeader className="space-y-0 text-left">
                <div className="flex items-start gap-3">
                  <div className="flex h-11 w-11 shrink-0 items-center justify-center rounded-2xl bg-sky-500/15 ring-1 ring-sky-400/25">
                    <Video className="h-5 w-5 text-sky-300" />
                  </div>
                  <div className="min-w-0 flex-1 pt-0.5">
                    <DialogTitle className="text-lg font-bold tracking-tight text-white">
                      Book live class
                    </DialogTitle>
                    <p className="mt-0.5 truncate text-sm text-slate-400">{sectionName}</p>
                    {quotaLabel ? (
                      <span className="mt-2 inline-flex items-center gap-1 rounded-full border border-emerald-500/25 bg-emerald-500/10 px-2.5 py-0.5 text-[11px] font-semibold tabular-nums text-emerald-200">
                        <Clock className="h-3 w-3" />
                        {quotaLabel}
                      </span>
                    ) : null}
                  </div>
                </div>
              </DialogHeader>
            </div>

            <div className="px-6 py-5">
              {upgradeLabel ? (
                <p className="rounded-xl border border-violet-500/25 bg-violet-500/10 px-4 py-3 text-sm text-slate-300">
                  <button type="button" onClick={goToSubscriptions} className={linkBtn}>
                    {upgradeLabel}
                  </button>
                </p>
              ) : !googleCalendarConnected ? (
                <p className="rounded-xl border border-amber-500/25 bg-amber-500/10 px-4 py-3 text-sm text-slate-300">
                  <button type="button" onClick={onConnectGoogle} className={linkBtn}>
                    Connect Google Calendar to book
                  </button>
                </p>
              ) : (
                modalBookingForm
              )}

              {upcomingList ? (
                <div className="mt-5 border-t border-white/8 pt-4">
                  <p className="mb-2.5 text-[11px] font-semibold uppercase tracking-[0.12em] text-slate-500">
                    Upcoming
                  </p>
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

  if (!googleCalendarConnected) {
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
          <p className="mb-2 text-[10px] font-semibold uppercase tracking-wider text-slate-500">
            Upcoming
          </p>
          {upcomingList}
        </div>
      ) : null}
    </div>
  );
}
