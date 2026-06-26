"use client";

import {
  useCallback,
  useEffect,
  useLayoutEffect,
  useRef,
  useState,
  type CSSProperties,
} from "react";
import Image from "next/image";
import { Dialog, DialogContent, DialogTitle } from "@/components/ui/dialog";
import { useAuth } from "@/hooks/useAuth";
import { useToast } from "@/hooks/use-toast";
import { completeSiteTourCarousel } from "@/lib/onboarding/completeSiteTourCarousel";
import { ONBOARDING_SERVER_CHECKLIST_TASK_COUNT } from "@/lib/onboarding/onboardingChecklistRdm";
import {
  isOnboardingRewardClaimed,
  isOnboardingSiteTourClaimedLocally,
} from "@/lib/subscription/freeTrialClient";
import { fetchOnboardingRewardState } from "@/lib/subscription/onboardingRewardApi";
import {
  SITE_TOUR_CAROUSEL_DURATION_MS,
  SITE_TOUR_CAROUSEL_FLAT,
  SITE_TOUR_CAROUSEL_MENUS,
  SITE_TOUR_CAROUSEL_TOTAL_STEPS,
  getSiteTourMenu,
  getSiteTourSubFeature,
  siteTourCarouselTotalPossibleRdm,
  siteTourWhatIsRdmSlide,
  siteTourMenuSectionRdm,
} from "@/lib/onboarding/siteTourCarouselData";
import {
  clampFlatIndex,
  flatIndexForMenu,
  globalFlatPosition,
} from "@/lib/onboarding/siteTourCarouselFlatNav";
import {
  clearSiteTourCarouselState,
  saveSiteTourCarouselState,
} from "@/lib/onboarding/siteTourCarouselStorage";
import { DEFAULT_RDM_CONFIG } from "@/lib/rdm/rdmConfig";
import { cn } from "@/lib/utils";
import { SiteTourFeatureDetail } from "@/components/onboarding/SiteTourFeatureDetail";
import styles from "@/components/onboarding/SiteTourCarousel.module.css";

const TABLER_ICONS_HREF =
  "https://cdn.jsdelivr.net/npm/@tabler/icons-webfont@latest/dist/tabler-icons.min.css";

const EDUBLAST_LOGO_SRC = "/images/logo-2.png";

let tablerIconsRequested = false;

function ensureTablerIcons(): void {
  if (typeof document === "undefined" || tablerIconsRequested) return;
  tablerIconsRequested = true;
  if (document.querySelector(`link[href="${TABLER_ICONS_HREF}"]`)) return;
  const link = document.createElement("link");
  link.rel = "stylesheet";
  link.href = TABLER_ICONS_HREF;
  document.head.appendChild(link);
}

type SiteTourCarouselProps = {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  checklistRewardRdm?: number;
};

function siteTourClaimErrorMessage(error?: string): string {
  if (error?.startsWith("checklist_incomplete:")) {
    return `Finish all ${ONBOARDING_SERVER_CHECKLIST_TASK_COUNT} checklist tasks on their pages before claiming +100 RDM.`;
  }
  switch (error) {
    case "buddy_not_joined":
      return "Buddy invite could not be verified. Finish the full site tour to claim.";
    case "checklist_incomplete":
      return "Site tour could not mark all checklist tasks on the server. Refresh and try again.";
    case "trial_not_activated":
      return "Activate your free trial before claiming the site tour reward.";
    case "already_claimed":
      return "You already claimed this reward.";
    case "progress_sync_failed":
      return "Could not save site tour progress. Please try again.";
    default:
      return error ?? "Please check your connection and try again.";
  }
}

export function SiteTourCarousel({
  open,
  onOpenChange,
  checklistRewardRdm = DEFAULT_RDM_CONFIG.free_trial_checklist_reward_rdm,
}: SiteTourCarouselProps) {
  const { profile, refreshProfile } = useAuth();
  const { toast } = useToast();
  const userId = profile?.id;

  const [flatCi, setFlatCi] = useState(0);
  const [earned, setEarned] = useState(0);
  const [playing, setPlaying] = useState(true);
  const [done, setDone] = useState<Set<string>>(() => new Set());
  const [anim, setAnim] = useState(false);
  const [showCompletion, setShowCompletion] = useState(false);
  const [claiming, setClaiming] = useState(false);
  const [claimCompleted, setClaimCompleted] = useState(false);
  const [claimedAmount, setClaimedAmount] = useState(checklistRewardRdm);
  const [rewardAlreadyClaimed, setRewardAlreadyClaimed] = useState(false);
  const [siteTourRewardClaimedEver, setSiteTourRewardClaimedEver] = useState(false);
  const [progressLabel, setProgressLabel] = useState("Auto-advancing in 5s");
  const [progressSec, setProgressSec] = useState("5s");
  const [rdmPop, setRdmPop] = useState(false);
  const [okPulse, setOkPulse] = useState(false);
  const [showCloseConfirm, setShowCloseConfirm] = useState(false);

  const elapsedRef = useRef(0);
  const rafRef = useRef<number | null>(null);
  const startTsRef = useRef<number | null>(null);
  const progFillRef = useRef<HTMLDivElement>(null);
  const lastSecRef = useRef(5);
  const doneRef = useRef<Set<string>>(new Set());
  const earnedRef = useRef(0);
  const flatCiRef = useRef(0);
  const playingRef = useRef(true);
  const menuPillsRef = useRef<HTMLDivElement>(null);
  const carouselRef = useRef<HTMLDivElement>(null);
  const activeCardRef = useRef<HTMLButtonElement | null>(null);
  const claimStartedRef = useRef(false);
  const hydratedRef = useRef(false);
  const openRef = useRef(open);
  openRef.current = open;
  const showCompletionRef = useRef(false);

  const flatStep = SITE_TOUR_CAROUSEL_FLAT[flatCi];
  const menu = flatStep ? getSiteTourMenu(flatStep.mid) : undefined;
  const subRaw = flatStep ? getSiteTourSubFeature(flatStep.mid, flatStep.sid) : undefined;
  const sub =
    flatStep && subRaw
      ? siteTourWhatIsRdmSlide(
          subRaw,
          flatStep.sid,
          checklistRewardRdm,
          siteTourCarouselTotalPossibleRdm()
        )
      : undefined;
  const globalPos = flatStep ? globalFlatPosition(flatStep) : 0;

  const persistState = useCallback(
    (nextFlatCi: number, nextEarned: number, nextDone: Set<string>) => {
      earnedRef.current = nextEarned;
      doneRef.current = nextDone;
      flatCiRef.current = nextFlatCi;
      saveSiteTourCarouselState(userId, {
        ci: nextFlatCi,
        earned: nextEarned,
        doneIds: [...nextDone],
      });
    },
    [userId]
  );

  const creditCurrentFlat = useCallback(() => {
    const step = SITE_TOUR_CAROUSEL_FLAT[flatCiRef.current];
    if (!step || doneRef.current.has(step.sid)) return;
    doneRef.current = new Set(doneRef.current);
    doneRef.current.add(step.sid);
    earnedRef.current += step.rdm;
    setDone(new Set(doneRef.current));
    setEarned(earnedRef.current);
    setRdmPop(true);
    window.setTimeout(() => setRdmPop(false), 450);
    persistState(flatCiRef.current, earnedRef.current, doneRef.current);
  }, [persistState]);

  const stopAuto = useCallback(() => {
    if (rafRef.current != null) {
      cancelAnimationFrame(rafRef.current);
      rafRef.current = null;
    }
  }, []);

  const runClaim = useCallback(async () => {
    if (claimStartedRef.current) return;
    claimStartedRef.current = true;
    setClaiming(true);
    try {
      const result = await completeSiteTourCarousel();
      if (!result.ok) {
        toast({
          title: "Could not claim site tour reward",
          description: siteTourClaimErrorMessage(result.error),
          variant: "destructive",
        });
        claimStartedRef.current = false;
        return;
      }
      if (result.alreadyClaimed) {
        setRewardAlreadyClaimed(true);
        setSiteTourRewardClaimedEver(true);
        setClaimedAmount(0);
        toast({
          title: "You've already claimed this reward",
          description: `Your one-time +${checklistRewardRdm} RDM Site Tour reward was credited earlier. Replaying the tour does not add RDM again.`,
          duration: 7000,
        });
      } else {
        setRewardAlreadyClaimed(false);
        setSiteTourRewardClaimedEver(true);
        const creditedAmount = result.amount > 0 ? result.amount : checklistRewardRdm;
        setClaimedAmount(creditedAmount);
        toast({
          title: `+${creditedAmount} RDM credited to your wallet! 🎉`,
          description: "Site Tour completed — thank you!",
          duration: 6000,
        });
      }
      setClaimCompleted(true);
      await refreshProfile();
      clearSiteTourCarouselState(userId);
    } catch {
      toast({
        title: "Could not claim site tour reward",
        description: "Please check your connection and try again.",
        variant: "destructive",
      });
      claimStartedRef.current = false;
    } finally {
      setClaiming(false);
    }
  }, [checklistRewardRdm, refreshProfile, toast, userId]);

  const showCompletionScreen = useCallback(() => {
    stopAuto();
    showCompletionRef.current = true;
    setShowCompletion(true);
  }, [stopAuto]);

  const handleClaimReward = useCallback(() => {
    void runClaim();
  }, [runClaim]);

  // Drive the depleting bar straight on the DOM node so we don't re-render this
  // (very large) modal ~60x/second — that re-render storm is what made the bar
  // visibly stutter/freeze instead of animating smoothly across the 5 seconds.
  const setFillPct = useCallback((pct: number) => {
    if (progFillRef.current) progFillRef.current.style.width = `${pct}%`;
  }, []);

  const resetReadingTimer = useCallback(
    (paused: boolean) => {
      elapsedRef.current = 0;
      lastSecRef.current = 5;
      setFillPct(100);
      setProgressSec("5s");
      setProgressLabel(paused ? "Paused" : "Auto-advancing in 5s");
    },
    [setFillPct]
  );

  const goToFlat = useCallback(
    (index: number, withAnim: boolean) => {
      const clamped = clampFlatIndex(index);
      setFlatCi(clamped);
      flatCiRef.current = clamped;
      setAnim(withAnim);
      resetReadingTimer(!playingRef.current);
      persistState(clamped, earnedRef.current, doneRef.current);
    },
    [persistState, resetReadingTimer]
  );

  const advanceFlat = useCallback(
    (withAnim: boolean): boolean => {
      const next = flatCiRef.current + 1;
      if (next >= SITE_TOUR_CAROUSEL_TOTAL_STEPS) {
        showCompletionScreen();
        return false;
      }
      goToFlat(next, withAnim);
      return true;
    },
    [goToFlat, showCompletionScreen]
  );

  const tick = useCallback(() => {
    if (
      startTsRef.current == null ||
      !openRef.current ||
      !playingRef.current ||
      showCompletionRef.current
    ) {
      return;
    }
    const now = performance.now();
    const elapsed = now - startTsRef.current;
    elapsedRef.current = elapsed;
    const pct = Math.min(elapsed / SITE_TOUR_CAROUSEL_DURATION_MS, 1);
    setFillPct(100 - pct * 100);
    const secondsLeft = Math.max(0, Math.ceil((SITE_TOUR_CAROUSEL_DURATION_MS - elapsed) / 1000));
    // Only re-render the text when the whole-second value actually changes.
    if (secondsLeft !== lastSecRef.current) {
      lastSecRef.current = secondsLeft;
      setProgressSec(`${secondsLeft}s`);
      setProgressLabel(`Auto-advancing in ${secondsLeft}s`);
    }
    if (elapsed >= SITE_TOUR_CAROUSEL_DURATION_MS) {
      stopAuto();
      elapsedRef.current = 0;
      creditCurrentFlat();
      advanceFlat(true);
      return;
    }
    rafRef.current = requestAnimationFrame(tick);
  }, [advanceFlat, creditCurrentFlat, setFillPct, stopAuto]);

  const startAutoBar = useCallback(() => {
    if (!openRef.current || !playingRef.current || showCompletionRef.current) return;
    stopAuto();
    startTsRef.current = performance.now() - elapsedRef.current;
    rafRef.current = requestAnimationFrame(tick);
  }, [stopAuto, tick]);

  const jumpToMenu = useCallback(
    (menuId: string) => {
      const idx = flatIndexForMenu(menuId);
      if (idx < 0 || idx === flatCiRef.current) return;
      stopAuto();
      goToFlat(idx, false);
      if (playing) startAutoBar();
    },
    [goToFlat, playing, startAutoBar, stopAuto]
  );

  const jumpToFlat = useCallback(
    (index: number) => {
      if (index === flatCiRef.current) return;
      stopAuto();
      goToFlat(index, false);
      if (playing) startAutoBar();
    },
    [goToFlat, playing, startAutoBar, stopAuto]
  );

  const togglePlay = useCallback(() => {
    setPlaying((prev) => {
      const next = !prev;
      playingRef.current = next;
      if (next) {
        const secondsLeft = Math.max(
          1,
          Math.ceil((SITE_TOUR_CAROUSEL_DURATION_MS - elapsedRef.current) / 1000)
        );
        setProgressLabel(`Auto-advancing in ${secondsLeft}s`);
        startAutoBar();
      } else {
        stopAuto();
        setProgressLabel("Paused");
      }
      return next;
    });
  }, [startAutoBar, stopAuto]);

  const handlePrev = useCallback(() => {
    if (flatCiRef.current === 0) return;
    stopAuto();
    goToFlat(flatCiRef.current - 1, false);
    if (playing) startAutoBar();
  }, [goToFlat, playing, startAutoBar, stopAuto]);

  const handleNext = useCallback(() => {
    stopAuto();
    creditCurrentFlat();
    const advanced = advanceFlat(true);
    if (advanced && playing) startAutoBar();
  }, [advanceFlat, creditCurrentFlat, playing, startAutoBar, stopAuto]);

  const handleGotIt = useCallback(() => {
    stopAuto();
    setOkPulse(true);
    window.setTimeout(() => setOkPulse(false), 400);
    creditCurrentFlat();
    elapsedRef.current = 0;
    const advanced = advanceFlat(true);
    if (advanced && playing) startAutoBar();
  }, [advanceFlat, creditCurrentFlat, playing, startAutoBar, stopAuto]);

  const closeTour = useCallback(() => {
    stopAuto();
    playingRef.current = false;
    setPlaying(false);
    setShowCloseConfirm(false);
    persistState(flatCiRef.current, earnedRef.current, doneRef.current);
    onOpenChange(false);
  }, [onOpenChange, persistState, stopAuto]);

  const shouldSkipCloseConfirm = useCallback(() => {
    return (
      rewardAlreadyClaimed ||
      siteTourRewardClaimedEver ||
      isOnboardingRewardClaimed(profile) ||
      isOnboardingSiteTourClaimedLocally()
    );
  }, [profile, rewardAlreadyClaimed, siteTourRewardClaimedEver]);

  const handleClose = useCallback(() => {
    stopAuto();
    persistState(flatCiRef.current, earnedRef.current, doneRef.current);
    if (shouldSkipCloseConfirm()) {
      closeTour();
      return;
    }
    setShowCloseConfirm(true);
  }, [closeTour, persistState, shouldSkipCloseConfirm, stopAuto]);

  const handleConfirmStay = useCallback(() => {
    setShowCloseConfirm(false);
    if (playingRef.current) startAutoBar();
  }, [startAutoBar]);

  const handleConfirmClose = closeTour;

  const handleGoToDashboard = useCallback(() => {
    onOpenChange(false);
  }, [onOpenChange]);

  const carScroll = useCallback((dir: number) => {
    carouselRef.current?.scrollBy({ left: dir * 200, behavior: "smooth" });
  }, []);

  useEffect(() => {
    ensureTablerIcons();
  }, []);

  useEffect(() => {
    flatCiRef.current = flatCi;
  }, [flatCi]);

  useEffect(() => {
    playingRef.current = playing;
  }, [playing]);

  useEffect(() => {
    if (!open) {
      stopAuto();
      return;
    }
    if (hydratedRef.current) return;

    // Always start the tour fresh at slide 1 with 0 RDM, counting up to 100.
    // We intentionally ignore any persisted progress so the header never opens
    // mid-tour with a leftover non-zero RDM value.
    const nextDone = new Set<string>();
    const nextEarned = 0;
    const nextFlatCi = clampFlatIndex(0);

    doneRef.current = nextDone;
    earnedRef.current = nextEarned;
    flatCiRef.current = nextFlatCi;
    setDone(nextDone);
    setEarned(nextEarned);
    setFlatCi(nextFlatCi);
    setAnim(false);
    setShowCompletion(false);
    showCompletionRef.current = false;
    setShowCloseConfirm(false);
    setRewardAlreadyClaimed(false);
    setClaimCompleted(false);
    setSiteTourRewardClaimedEver(
      isOnboardingRewardClaimed(profile) || isOnboardingSiteTourClaimedLocally()
    );
    claimStartedRef.current = false;
    elapsedRef.current = 0;
    hydratedRef.current = true;
    setPlaying(true);
    playingRef.current = true;
    persistState(nextFlatCi, nextEarned, nextDone);
    resetReadingTimer(false);
  }, [
    open,
    persistState,
    profile,
    resetReadingTimer,
    stopAuto,
    userId,
  ]);

  useEffect(() => {
    if (!open || !userId) return;
    let cancelled = false;
    void fetchOnboardingRewardState({ fresh: true }).then((state) => {
      if (cancelled) return;
      if (state.claimedEver === true || state.claimedAt) {
        setSiteTourRewardClaimedEver(true);
      }
    });
    return () => {
      cancelled = true;
    };
  }, [open, userId]);

  useEffect(() => {
    if (!open) {
      stopAuto();
      playingRef.current = false;
      setPlaying(false);
      hydratedRef.current = false;
      setShowCompletion(false);
      showCompletionRef.current = false;
      setShowCloseConfirm(false);
      setRewardAlreadyClaimed(false);
      setClaimCompleted(false);
      setSiteTourRewardClaimedEver(false);
      claimStartedRef.current = false;
    }
  }, [open, stopAuto]);

  useEffect(() => {
    if (!open || showCompletion || showCloseConfirm) return;
    if (playing) startAutoBar();
    return () => stopAuto();
  }, [open, playing, flatCi, showCompletion, showCloseConfirm, startAutoBar, stopAuto]);

  // Pause auto-advance when the student switches tabs or leaves the site.
  useEffect(() => {
    if (!open) return;

    const pauseForBackground = () => {
      if (!playingRef.current || showCompletionRef.current) return;
      stopAuto();
      playingRef.current = false;
      setPlaying(false);
      setProgressLabel("Paused");
    };

    const onVisibilityChange = () => {
      if (document.visibilityState === "hidden") {
        pauseForBackground();
      }
    };

    document.addEventListener("visibilitychange", onVisibilityChange);
    return () => document.removeEventListener("visibilitychange", onVisibilityChange);
  }, [open, stopAuto]);

  useLayoutEffect(() => {
    if (!open || !flatStep) return;
    const pill = menuPillsRef.current?.querySelector(`.${styles.mpCur}`);
    pill?.scrollIntoView({ inline: "center", behavior: "smooth", block: "nearest" });
    activeCardRef.current?.scrollIntoView({
      inline: "center",
      behavior: "smooth",
      block: "nearest",
    });
  }, [flatCi, flatStep, open]);

  if (!flatStep || !menu || !sub) return null;

  const menuSectionRdm = siteTourMenuSectionRdm(menu);
  const investorTotalRdm = siteTourCarouselTotalPossibleRdm();

  return (
    <Dialog open={open} onOpenChange={(next) => (next ? onOpenChange(true) : handleClose())}>
      <DialogContent className={styles.dialogContent} hideClose aria-describedby={undefined}>
        <DialogTitle className="sr-only">EduBlast site tour</DialogTitle>
        <div className={styles.root}>
          <div className={styles.popupWrap}>
            <div className={styles.popup}>
              <div className={styles.ph}>
                <div className={styles.phBrand}>
                  <Image
                    src={EDUBLAST_LOGO_SRC}
                    alt="EduBlast"
                    width={132}
                    height={28}
                    draggable={false}
                    className={styles.phLogoImg}
                    priority
                  />
                  <span className={styles.phTagAside}>Site Tour</span>
                </div>
                <div className={styles.phRight}>
                  <div className={styles.rdmPill}>
                    <i className="ti ti-coin" aria-hidden />
                    <span className={cn(styles.rdmV, rdmPop && styles.rdmVPop)}>{earned}</span>
                    <span className={styles.rdmL}>&nbsp;RDM</span>
                  </div>
                  <button
                    type="button"
                    className={styles.phX}
                    onClick={handleClose}
                    aria-label="Close site tour"
                  >
                    <i className="ti ti-x" aria-hidden />
                  </button>
                </div>
              </div>

              <div className={styles.menuPills} ref={menuPillsRef}>
                {SITE_TOUR_CAROUSEL_MENUS.map((m) => {
                  const isCur = flatStep.mid === m.id;
                  const pillStyle: CSSProperties | undefined = isCur
                    ? { background: m.c, borderColor: m.c }
                    : undefined;
                  return (
                    <button
                      key={m.id}
                      type="button"
                      className={cn(styles.mp, isCur && styles.mpCur)}
                      style={pillStyle}
                      onClick={() => jumpToMenu(m.id)}
                    >
                      <i className={cn("ti", m.ico)} aria-hidden />
                      {m.lbl}
                    </button>
                  );
                })}
              </div>

              <div className={styles.pcontent}>
                <div
                  className={cn(styles.menuHero, anim && styles.anim)}
                  style={
                    {
                      ["--hero-accent" as string]: menu.c,
                    } as CSSProperties
                  }
                >
                  <div className={styles.mhIco} style={{ background: `${menu.bd}22` }}>
                    <i className={cn("ti", menu.ico)} style={{ color: menu.c }} aria-hidden />
                  </div>
                  <div>
                    <div className={styles.mhTitle}>{menu.lbl}</div>
                    <div className={styles.mhSub}>{menu.desc}</div>
                  </div>
                  <div
                    className={styles.mhBdg}
                    style={{
                      border: `1px solid color-mix(in srgb, ${menu.bd} 45%, transparent)`,
                      color: menu.c,
                    }}
                  >
                    <i className="ti ti-coin" aria-hidden />+{menuSectionRdm} RDM
                  </div>
                </div>

                <SiteTourFeatureDetail
                  sub={sub}
                  menuBg={menu.bg}
                  menuBd={menu.bd}
                  globalIndex={globalPos}
                  globalTotal={SITE_TOUR_CAROUSEL_TOTAL_STEPS}
                  anim={anim}
                />
              </div>

              <div className={styles.carouselWrap}>
                <div className={styles.carouselHdr}>
                  <div className={styles.carLbl}>
                    <i
                      className={cn("ti", menu.ico)}
                      style={{ color: menu.c, fontSize: 12 }}
                      aria-hidden
                    />
                    {menu.lbl} — features
                  </div>
                  <div className={styles.carNav}>
                    <button
                      type="button"
                      className={styles.carNavBtn}
                      onClick={() => carScroll(-1)}
                      title="Scroll left"
                    >
                      <i className="ti ti-chevron-left" aria-hidden />
                    </button>
                    <button
                      type="button"
                      className={styles.carNavBtn}
                      onClick={() => carScroll(1)}
                      title="Scroll right"
                    >
                      <i className="ti ti-chevron-right" aria-hidden />
                    </button>
                  </div>
                </div>
                <div className={styles.carousel} ref={carouselRef}>
                  {menu.subs.map((feature, index) => {
                    const featureFlatIdx = SITE_TOUR_CAROUSEL_FLAT.findIndex(
                      (f) => f.mid === menu.id && f.sid === feature.id
                    );
                    const isCur = flatCi === featureFlatIdx;
                    const isFeatureDone = done.has(feature.id);
                    return (
                      <button
                        key={feature.id}
                        type="button"
                        ref={isCur ? activeCardRef : undefined}
                        className={cn(
                          styles.cc,
                          isCur && styles.ccCur,
                          isFeatureDone && styles.ccDone
                        )}
                        aria-label={`${index + 1}. ${feature.lbl}${isFeatureDone ? ", completed" : ""}`}
                        style={
                          isCur
                            ? ({
                                borderColor: feature.c,
                                ["--cc-accent" as string]: feature.c,
                              } as CSSProperties)
                            : undefined
                        }
                        onClick={() => jumpToFlat(featureFlatIdx)}
                      >
                        <span className={styles.ccStep}>{index + 1}</span>
                        {isFeatureDone ? (
                          <span className={styles.ccTickBadge} title="Completed">
                            <i className="ti ti-check" aria-hidden />
                          </span>
                        ) : null}
                        <div
                          className={styles.ccDot}
                          style={isCur ? { borderColor: `${feature.c}99` } : undefined}
                        >
                          <i
                            className={cn("ti", feature.ico)}
                            style={{ color: feature.c }}
                            aria-hidden
                          />
                        </div>
                        <div className={styles.ccName}>{feature.lbl}</div>
                        <span className={styles.ccRdm}>+{feature.rdm}</span>
                      </button>
                    );
                  })}
                </div>
              </div>

              <div className={styles.pbot}>
                <div className={styles.ctrlGrp}>
                  <button
                    type="button"
                    className={styles.ctrl}
                    onClick={handlePrev}
                    title="Previous"
                    disabled={flatCi === 0}
                  >
                    <i className="ti ti-player-skip-back" aria-hidden />
                  </button>
                  <button
                    type="button"
                    className={cn(styles.ctrl, styles.ctrlPp)}
                    onClick={togglePlay}
                    title={playing ? "Pause" : "Play"}
                  >
                    <i
                      className={cn("ti", playing ? "ti-player-pause" : "ti-player-play")}
                      aria-hidden
                    />
                  </button>
                  <button type="button" className={styles.ctrl} onClick={handleNext} title="Next">
                    <i className="ti ti-player-skip-forward" aria-hidden />
                  </button>
                </div>
                <div className={styles.progWrap}>
                  <div className={styles.progTop}>
                    <span>{progressLabel}</span>
                    <span>{progressSec}</span>
                  </div>
                  <div className={styles.progBar}>
                    <div ref={progFillRef} className={styles.progFill} />
                  </div>
                </div>
                <div className={styles.rdmLbl}>+{sub.rdm} RDM</div>
                <button
                  type="button"
                  className={cn(styles.okBtn, okPulse && styles.okBtnPulse)}
                  onClick={handleGotIt}
                >
                  <i className="ti ti-check" aria-hidden />
                  OK, got it!
                </button>
              </div>
            </div>

            <div className={cn(styles.comp, showCompletion && styles.compShow)}>
              <div className={styles.compRing}>
                <i
                  className={cn("ti", claimCompleted ? "ti-circle-check" : "ti-trophy")}
                  aria-hidden
                />
              </div>
              <div className={styles.compTi}>
                {!claimCompleted
                  ? "Tour complete!"
                  : rewardAlreadyClaimed
                    ? "Tour complete — already claimed"
                    : "Site Tour completed — thank you!"}
              </div>
              <div className={styles.compSu}>
                {!claimCompleted ? (
                  <>
                    You explored all {SITE_TOUR_CAROUSEL_TOTAL_STEPS} features across{" "}
                    {SITE_TOUR_CAROUSEL_MENUS.length} menus. The tour counter reached {earned} of{" "}
                    {investorTotalRdm} RDM (progress only). Tap below to claim your one-time +
                    {checklistRewardRdm} RDM reward.
                  </>
                ) : rewardAlreadyClaimed ? (
                  <>
                    You explored all {SITE_TOUR_CAROUSEL_TOTAL_STEPS} features again. The header
                    counter is progress only — you already received your one-time +
                    {checklistRewardRdm} RDM Site Tour reward.
                  </>
                ) : (
                  <>
                    Thank you for completing the Site Tour! Your one-time +{checklistRewardRdm} RDM
                    reward has been added to your wallet.
                  </>
                )}
              </div>
              <div
                className={cn(
                  styles.compRdm,
                  claimCompleted && rewardAlreadyClaimed && styles.compRdmClaimed
                )}
              >
                <i
                  className={cn(
                    "ti",
                    claimCompleted && rewardAlreadyClaimed ? "ti-info-circle" : "ti-coin"
                  )}
                  aria-hidden
                />
                {!claimCompleted ? (
                  <span>+{checklistRewardRdm} RDM ready to claim</span>
                ) : rewardAlreadyClaimed ? (
                  <span>You&apos;ve already claimed this reward — no extra RDM was added.</span>
                ) : (
                  <span>+{claimedAmount} RDM added to your balance</span>
                )}
              </div>
              {!claimCompleted ? (
                <button
                  type="button"
                  className={styles.compCta}
                  onClick={handleClaimReward}
                  disabled={claiming}
                >
                  {claiming ? "Claiming…" : `Claim ${checklistRewardRdm} RDM`}
                </button>
              ) : (
                <button type="button" className={styles.compCta} onClick={handleGoToDashboard}>
                  OK, go to dashboard
                </button>
              )}
            </div>

            <div className={cn(styles.comp, showCloseConfirm && styles.compShow)}>
              <div className={styles.confirmIcon}>
                <i className="ti ti-clock-hour-4" aria-hidden />
              </div>
              <div className={styles.compTi}>Hold on! 🎁</div>
              <div className={styles.compSu}>
                Are you sure you want to lose the chance to earn{" "}
                <strong className={styles.confirmRdm}>{checklistRewardRdm} RDM</strong> and also
                qualify for <strong className={styles.confirmBonus}>ONE Month FREE Bonus</strong>?
              </div>
              <div className={styles.confirmBtns}>
                <button type="button" className={styles.confirmStayBtn} onClick={handleConfirmStay}>
                  No, stay!
                </button>
                <button
                  type="button"
                  className={styles.confirmCloseBtn}
                  onClick={handleConfirmClose}
                >
                  Yes, close
                </button>
              </div>
            </div>
          </div>
        </div>
      </DialogContent>
    </Dialog>
  );
}
