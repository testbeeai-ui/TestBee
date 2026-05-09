"use client";

import { useCallback, useEffect, useLayoutEffect, useRef, useState } from "react";
import { flushSync } from "react-dom";

const TB_REFER_CAPTURE_VEIL_ID = "tb-refer-capture-veil";
const CAPTURE_BLOCK_MODAL_MS = 3200;
const VEIL_LIFT_DELAY_MS = 280;
const FOCUS_LOSS_FULL_TRIGGER_INTERVAL_MS = 120;
const CAPTURE_BLOCK_PAGEHIDE_MS = 4500;
/** If the DOM veil stays opaque while the React modal is hidden, recover (avoids “stuck blue screen”). */
const STUCK_VEIL_CHECK_MS = 800;
const STUCK_VEIL_FORCE_HIDE_MS = 4500;
const STUCK_VEIL_RELOAD_MS = 14000;
const STUCK_VEIL_RELOAD_SESSION_KEY = "tb-anticapture-stuck-reload-once";
/**
 * After arming, keep the slate fully opaque for this many animation frames before switching to the
 * invisible "pre-armed" layer. Otherwise the first composited frames still expose content to OS-level
 * screenshots (transparent veil = readable pixels).
 */
const STARTUP_FULL_VEIL_FRAME_COUNT = 3;

function destroyImmediateCaptureVeil(): void {
  if (typeof document === "undefined") return;
  const el = document.getElementById(TB_REFER_CAPTURE_VEIL_ID);
  if (el?.parentNode) {
    el.parentNode.removeChild(el);
  }
}

/**
 * Injected slate under the portal modal (`InlineRdmChallenge` uses z-[2147483647]).
 * Veil must stay one step below so the “Screenshots not available” card remains visible.
 */
function showImmediateCaptureVeil(): void {
  if (typeof document === "undefined") return;
  let el = document.getElementById(TB_REFER_CAPTURE_VEIL_ID) as HTMLDivElement | null;
  if (!el) {
    el = document.createElement("div");
    el.id = TB_REFER_CAPTURE_VEIL_ID;
    el.setAttribute("aria-hidden", "true");
    el.style.cssText = [
      "position:fixed !important",
      "inset:0 !important",
      "z-index:2147483646 !important",
      "margin:0 !important",
      "background:rgb(15 23 42) !important",
      "opacity:0",
      "pointer-events:none",
      "visibility:hidden",
      "display:block",
      "transition:none !important",
      "contain:paint !important",
    ].join(";");
    document.body.appendChild(el);
  }
  el.style.opacity = "1";
  el.style.pointerEvents = "auto";
  el.style.visibility = "visible";
}

function hideImmediateCaptureVeil(): void {
  if (typeof document === "undefined") return;
  const el = document.getElementById(TB_REFER_CAPTURE_VEIL_ID);
  if (el) {
    el.style.opacity = "0";
    el.style.pointerEvents = "none";
    el.style.visibility = "hidden";
  }
}

function isVeilVisuallyBlocking(): boolean {
  if (typeof document === "undefined") return false;
  const el = document.getElementById(TB_REFER_CAPTURE_VEIL_ID);
  if (!el) return false;
  try {
    const opacity = Number.parseFloat(window.getComputedStyle(el).opacity);
    const visible = el.style.visibility !== "hidden";
    return visible && opacity > 0.12;
  } catch {
    return false;
  }
}

/** Keep veil layer mounted/visible-at-zero-opacity so capture path avoids cold compositor wake-up. */
function armImmediateCaptureVeil(): void {
  if (typeof document === "undefined") return;
  let el = document.getElementById(TB_REFER_CAPTURE_VEIL_ID) as HTMLDivElement | null;
  if (!el) {
    showImmediateCaptureVeil();
    hideImmediateCaptureVeil();
    el = document.getElementById(TB_REFER_CAPTURE_VEIL_ID) as HTMLDivElement | null;
  }
  if (!el) return;
  el.style.display = "block";
  el.style.visibility = "visible";
  el.style.opacity = "0";
  el.style.pointerEvents = "none";
}

export type UseReferChallengeAntiCaptureOptions = {
  enabled: boolean;
  clipboardMessage?: string;
};

export function useReferChallengeAntiCapture({
  enabled,
  clipboardMessage = "Screenshots and screen capture are not available during this challenge.",
}: UseReferChallengeAntiCaptureOptions) {
  const overlayTimerRef = useRef<number | null>(null);
  const veilLiftTimerRef = useRef<number | null>(null);
  const preemptiveShieldTimerRef = useRef<number | null>(null);
  const visibilityLockTimerRef = useRef<number | null>(null);
  const suppressVisibilityLockUntilRef = useRef(0);
  const manualDismissUntilRef = useRef(0);
  const modifierShieldActiveRef = useRef(false);
  const overlayVisibleRef = useRef(false);
  const enabledRef = useRef(enabled);
  const focusLossPollRef = useRef<number | null>(null);
  const focusLossLastFullTriggerRef = useRef(0);
  const captureEventDedupeRef = useRef<string | null>(null);
  const stuckVeilSinceRef = useRef<number | null>(null);
  const stuckVeilIntervalRef = useRef<number | null>(null);
  const stuckVeilSoftRecoverSentRef = useRef(false);
  const startupFullVeilRafRef = useRef<number | null>(null);

  const [showCaptureBlockOverlay, setShowCaptureBlockOverlay] = useState(false);

  useLayoutEffect(() => {
    overlayVisibleRef.current = showCaptureBlockOverlay;
  }, [showCaptureBlockOverlay]);

  const clearDismissTimers = useCallback(() => {
    if (overlayTimerRef.current !== null) {
      window.clearTimeout(overlayTimerRef.current);
      overlayTimerRef.current = null;
    }
    if (veilLiftTimerRef.current !== null) {
      window.clearTimeout(veilLiftTimerRef.current);
      veilLiftTimerRef.current = null;
    }
    if (preemptiveShieldTimerRef.current !== null) {
      window.clearTimeout(preemptiveShieldTimerRef.current);
      preemptiveShieldTimerRef.current = null;
    }
  }, []);

  const scheduleOverlayDismiss = useCallback(
    (durationMs: number) => {
      clearDismissTimers();
      overlayTimerRef.current = window.setTimeout(() => {
        setShowCaptureBlockOverlay(false);
        overlayTimerRef.current = null;
        veilLiftTimerRef.current = window.setTimeout(() => {
          hideImmediateCaptureVeil();
          veilLiftTimerRef.current = null;
        }, VEIL_LIFT_DELAY_MS);
      }, durationMs);
    },
    [clearDismissTimers]
  );

  const triggerCaptureBlockOverlay = useCallback(
    (durationMs = CAPTURE_BLOCK_MODAL_MS) => {
      if (Date.now() < manualDismissUntilRef.current) {
        return;
      }
      showImmediateCaptureVeil();
      flushSync(() => {
        setShowCaptureBlockOverlay(true);
      });
      showImmediateCaptureVeil();
      requestAnimationFrame(() => {
        showImmediateCaptureVeil();
      });
      scheduleOverlayDismiss(durationMs);
    },
    [scheduleOverlayDismiss]
  );

  const dismissCaptureBlockOverlay = useCallback(() => {
    clearDismissTimers();
    manualDismissUntilRef.current = Date.now() + 1800;
    suppressVisibilityLockUntilRef.current = manualDismissUntilRef.current;
    if (focusLossPollRef.current !== null) {
      window.cancelAnimationFrame(focusLossPollRef.current);
      focusLossPollRef.current = null;
    }
    if (visibilityLockTimerRef.current !== null) {
      window.clearTimeout(visibilityLockTimerRef.current);
      visibilityLockTimerRef.current = null;
    }
    modifierShieldActiveRef.current = false;
    if (preemptiveShieldTimerRef.current !== null) {
      window.clearTimeout(preemptiveShieldTimerRef.current);
      preemptiveShieldTimerRef.current = null;
    }
    flushSync(() => {
      setShowCaptureBlockOverlay(false);
    });
    hideImmediateCaptureVeil();
  }, [clearDismissTimers]);

  const recoverStuckVeilSoft = useCallback(() => {
    if (!enabledRef.current) return;
    if (focusLossPollRef.current !== null) {
      window.cancelAnimationFrame(focusLossPollRef.current);
      focusLossPollRef.current = null;
    }
    modifierShieldActiveRef.current = false;
    if (preemptiveShieldTimerRef.current !== null) {
      window.clearTimeout(preemptiveShieldTimerRef.current);
      preemptiveShieldTimerRef.current = null;
    }
    clearDismissTimers();
    hideImmediateCaptureVeil();
    queueMicrotask(() => {
      setShowCaptureBlockOverlay(false);
    });
  }, [clearDismissTimers]);

  useLayoutEffect(() => {
    enabledRef.current = enabled;

    if (!enabled) {
      clearDismissTimers();
      stuckVeilSinceRef.current = null;
      stuckVeilSoftRecoverSentRef.current = false;
      if (stuckVeilIntervalRef.current !== null) {
        window.clearInterval(stuckVeilIntervalRef.current);
        stuckVeilIntervalRef.current = null;
      }
      queueMicrotask(() => {
        setShowCaptureBlockOverlay(false);
      });
      destroyImmediateCaptureVeil();
      if (visibilityLockTimerRef.current !== null) {
        window.clearTimeout(visibilityLockTimerRef.current);
        visibilityLockTimerRef.current = null;
      }
      return;
    }

    // Block first frames synchronously, then drop to invisible pre-armed veil (unless capture modal is up).
    showImmediateCaptureVeil();
    if (startupFullVeilRafRef.current !== null) {
      cancelAnimationFrame(startupFullVeilRafRef.current);
      startupFullVeilRafRef.current = null;
    }
    let startupFramesLeft = STARTUP_FULL_VEIL_FRAME_COUNT;
    const finishStartupVeil = () => {
      startupFullVeilRafRef.current = null;
      if (!enabledRef.current) return;
      if (overlayVisibleRef.current) return;
      if (modifierShieldActiveRef.current) return;
      armImmediateCaptureVeil();
    };
    const tickStartupVeil = () => {
      startupFramesLeft -= 1;
      if (startupFramesLeft <= 0) {
        finishStartupVeil();
        return;
      }
      startupFullVeilRafRef.current = requestAnimationFrame(tickStartupVeil);
    };
    startupFullVeilRafRef.current = requestAnimationFrame(tickStartupVeil);

    stuckVeilSinceRef.current = null;
    stuckVeilSoftRecoverSentRef.current = false;
    if (stuckVeilIntervalRef.current !== null) {
      window.clearInterval(stuckVeilIntervalRef.current);
    }
    stuckVeilIntervalRef.current = window.setInterval(() => {
      if (!enabledRef.current) return;
      const blocking = isVeilVisuallyBlocking();
      const modalUp = overlayVisibleRef.current;
      const focused = typeof document !== "undefined" && document.hasFocus();
      if (blocking && !modalUp && focused) {
        if (stuckVeilSinceRef.current === null) {
          stuckVeilSinceRef.current = Date.now();
        }
        const elapsed = Date.now() - stuckVeilSinceRef.current;
        if (elapsed >= STUCK_VEIL_RELOAD_MS) {
          try {
            if (sessionStorage.getItem(STUCK_VEIL_RELOAD_SESSION_KEY) !== "1") {
              sessionStorage.setItem(STUCK_VEIL_RELOAD_SESSION_KEY, "1");
              window.location.reload();
              return;
            }
          } catch {
            /* ignore */
          }
          recoverStuckVeilSoft();
          stuckVeilSinceRef.current = null;
          stuckVeilSoftRecoverSentRef.current = false;
        } else if (elapsed >= STUCK_VEIL_FORCE_HIDE_MS && !stuckVeilSoftRecoverSentRef.current) {
          stuckVeilSoftRecoverSentRef.current = true;
          recoverStuckVeilSoft();
        }
      } else {
        stuckVeilSinceRef.current = null;
        stuckVeilSoftRecoverSentRef.current = false;
      }
    }, STUCK_VEIL_CHECK_MS);

    const previousUserSelect = document.body.style.userSelect;
    const previousWebkitUserSelect = (
      document.body.style as CSSStyleDeclaration & {
        webkitUserSelect?: string;
      }
    ).webkitUserSelect;

    document.body.style.userSelect = "none";
    (document.body.style as CSSStyleDeclaration & { webkitUserSelect?: string }).webkitUserSelect =
      "none";

    const isRunActive = () => enabledRef.current;

    const handleContextMenu = (event: MouseEvent) => {
      if (!isRunActive()) return;
      event.preventDefault();
    };

    const handleCopy = (event: ClipboardEvent) => {
      if (!isRunActive()) return;
      event.preventDefault();
    };

    const isPrintScreenKey = (event: KeyboardEvent) =>
      event.key === "PrintScreen" || event.code === "PrintScreen";

    const shouldSkipDuplicateCaptureEvent = (event: KeyboardEvent) => {
      const mark = `${event.type}:${event.timeStamp}:${event.key}:${event.code}`;
      if (captureEventDedupeRef.current === mark) return true;
      captureEventDedupeRef.current = mark;
      queueMicrotask(() => {
        if (captureEventDedupeRef.current === mark) {
          captureEventDedupeRef.current = null;
        }
      });
      return false;
    };

    const stopFocusLossPoll = () => {
      if (focusLossPollRef.current !== null) {
        window.cancelAnimationFrame(focusLossPollRef.current);
        focusLossPollRef.current = null;
      }
    };

    const startFocusLossPoll = () => {
      stopFocusLossPoll();
      focusLossLastFullTriggerRef.current = performance.now();

      const loop = () => {
        if (!isRunActive()) {
          stopFocusLossPoll();
          return;
        }
        if (typeof document === "undefined") return;
        if (document.hasFocus()) {
          stopFocusLossPoll();
          return;
        }

        showImmediateCaptureVeil();

        const now = performance.now();
        if (now - focusLossLastFullTriggerRef.current >= FOCUS_LOSS_FULL_TRIGGER_INTERVAL_MS) {
          focusLossLastFullTriggerRef.current = now;
          triggerCaptureBlockOverlay(CAPTURE_BLOCK_MODAL_MS);
        }

        focusLossPollRef.current = window.requestAnimationFrame(loop);
      };

      focusLossPollRef.current = window.requestAnimationFrame(loop);
    };

    const handleCaptureKeyDown = (event: KeyboardEvent) => {
      if (!isRunActive()) return;

      const key = event.key.toLowerCase();
      const isMetaKey = event.key === "Meta" || event.key === "OS";
      const osMod =
        typeof event.getModifierState === "function" &&
        (event.getModifierState("OS") || event.getModifierState("Meta"));

      const isSnippingShortcut =
        event.shiftKey && key === "s" && (event.metaKey || event.ctrlKey || osMod);

      /**
       * Pre-emptive shield for Win/Cmd/Ctrl + Shift chord:
       * on some systems the OS capture UI starts before `S` keydown is processed.
       */
      const isDangerousModifierChord =
        event.shiftKey && (event.metaKey || event.ctrlKey || osMod || isMetaKey);
      if (isDangerousModifierChord && !isSnippingShortcut) {
        showImmediateCaptureVeil();
        modifierShieldActiveRef.current = true;
        if (preemptiveShieldTimerRef.current !== null) {
          window.clearTimeout(preemptiveShieldTimerRef.current);
        }
        preemptiveShieldTimerRef.current = window.setTimeout(() => {
          preemptiveShieldTimerRef.current = null;
          if (!overlayVisibleRef.current) {
            modifierShieldActiveRef.current = false;
            hideImmediateCaptureVeil();
          }
        }, 1800);
        return;
      }

      if (!isPrintScreenKey(event) && !isSnippingShortcut) return;

      if (preemptiveShieldTimerRef.current !== null) {
        window.clearTimeout(preemptiveShieldTimerRef.current);
        preemptiveShieldTimerRef.current = null;
      }
      if (shouldSkipDuplicateCaptureEvent(event)) {
        showImmediateCaptureVeil();
        return;
      }

      suppressVisibilityLockUntilRef.current = Date.now() + 1800;
      triggerCaptureBlockOverlay(CAPTURE_BLOCK_MODAL_MS);

      event.preventDefault();
      event.stopPropagation();
      try {
        event.stopImmediatePropagation();
      } catch {
        /* ignore */
      }
    };

    const handleCaptureKeyUp = (event: KeyboardEvent) => {
      if (!isRunActive()) return;

      if (modifierShieldActiveRef.current) {
        const key = event.key.toLowerCase();
        const isModifierRelease =
          key === "shift" || key === "meta" || key === "os" || key === "control" || key === "ctrl";
        const osStillPressed =
          typeof event.getModifierState === "function" &&
          (event.getModifierState("OS") || event.getModifierState("Meta"));
        const stillHoldingCaptureChord =
          event.shiftKey && (event.ctrlKey || event.metaKey || osStillPressed);
        if (isModifierRelease && !stillHoldingCaptureChord && !overlayVisibleRef.current) {
          modifierShieldActiveRef.current = false;
          if (preemptiveShieldTimerRef.current !== null) {
            window.clearTimeout(preemptiveShieldTimerRef.current);
            preemptiveShieldTimerRef.current = null;
          }
          hideImmediateCaptureVeil();
        }
      }

      if (!isPrintScreenKey(event)) return;

      if (shouldSkipDuplicateCaptureEvent(event)) {
        showImmediateCaptureVeil();
        return;
      }

      suppressVisibilityLockUntilRef.current = Date.now() + 1800;
      triggerCaptureBlockOverlay(CAPTURE_BLOCK_MODAL_MS);

      queueMicrotask(() => {
        if (typeof document !== "undefined" && document.hasFocus()) {
          void navigator.clipboard.writeText(clipboardMessage).catch(() => undefined);
        }
      });

      event.preventDefault();
      event.stopPropagation();
      try {
        event.stopImmediatePropagation();
      } catch {
        /* ignore */
      }
    };

    const handleKeyDown = (event: KeyboardEvent) => {
      if (!isRunActive()) return;
      const key = event.key.toLowerCase();
      const isCopy = (event.ctrlKey || event.metaKey) && key === "c";
      const isViewSource = (event.ctrlKey || event.metaKey) && key === "u";
      const isInspectCombo =
        event.key === "F12" ||
        ((event.ctrlKey || event.metaKey) &&
          event.shiftKey &&
          (key === "i" || key === "j" || key === "c"));
      if (isCopy || isInspectCombo || isViewSource) {
        event.preventDefault();
        event.stopPropagation();
      }
    };

    const handleVisibilityChange = () => {
      if (document.visibilityState === "hidden") {
        if (visibilityLockTimerRef.current !== null) {
          window.clearTimeout(visibilityLockTimerRef.current);
        }
        if (!isRunActive()) return;
        triggerCaptureBlockOverlay(CAPTURE_BLOCK_MODAL_MS);
        const confirmMs = 120;
        const now = Date.now();
        const suppressedFor = Math.min(
          280,
          Math.max(0, suppressVisibilityLockUntilRef.current - now)
        );
        const delayMs = confirmMs + suppressedFor;
        visibilityLockTimerRef.current = window.setTimeout(() => {
          visibilityLockTimerRef.current = null;
          if (document.visibilityState !== "hidden") return;
          if (isRunActive()) {
            triggerCaptureBlockOverlay(CAPTURE_BLOCK_MODAL_MS);
          }
        }, delayMs);
        return;
      }

      if (visibilityLockTimerRef.current !== null) {
        window.clearTimeout(visibilityLockTimerRef.current);
        visibilityLockTimerRef.current = null;
      }
    };

    const handleWindowBlur = () => {
      if (!isRunActive()) return;
      triggerCaptureBlockOverlay(CAPTURE_BLOCK_MODAL_MS);
      startFocusLossPoll();
    };

    const handleWindowFocus = () => {
      stopFocusLossPoll();
      window.setTimeout(() => {
        if (!enabledRef.current) return;
        if (!isVeilVisuallyBlocking() || overlayVisibleRef.current) {
          stuckVeilSinceRef.current = null;
          return;
        }
        recoverStuckVeilSoft();
      }, 280);
    };

    const handlePageShow = (event: PageTransitionEvent) => {
      if (event.persisted && enabledRef.current) {
        window.setTimeout(() => recoverStuckVeilSoft(), 0);
      }
    };

    const handleBeforePrint = () => {
      if (!isRunActive()) return;
      triggerCaptureBlockOverlay(CAPTURE_BLOCK_MODAL_MS);
    };

    const handlePageHide = () => {
      if (!isRunActive()) return;
      triggerCaptureBlockOverlay(CAPTURE_BLOCK_PAGEHIDE_MS);
    };

    document.addEventListener("contextmenu", handleContextMenu);
    document.addEventListener("copy", handleCopy);
    document.addEventListener("keydown", handleKeyDown);
    document.addEventListener("visibilitychange", handleVisibilityChange);
    window.addEventListener("blur", handleWindowBlur);
    window.addEventListener("focus", handleWindowFocus);
    window.addEventListener("pageshow", handlePageShow);
    window.addEventListener("beforeprint", handleBeforePrint);
    window.addEventListener("pagehide", handlePageHide);

    window.addEventListener("keydown", handleCaptureKeyDown, true);
    window.addEventListener("keyup", handleCaptureKeyUp, true);
    document.addEventListener("keydown", handleCaptureKeyDown, true);
    document.addEventListener("keyup", handleCaptureKeyUp, true);

    return () => {
      if (startupFullVeilRafRef.current !== null) {
        cancelAnimationFrame(startupFullVeilRafRef.current);
        startupFullVeilRafRef.current = null;
      }
      stopFocusLossPoll();
      if (stuckVeilIntervalRef.current !== null) {
        window.clearInterval(stuckVeilIntervalRef.current);
        stuckVeilIntervalRef.current = null;
      }
      stuckVeilSinceRef.current = null;
      stuckVeilSoftRecoverSentRef.current = false;
      clearDismissTimers();
      if (visibilityLockTimerRef.current !== null) {
        window.clearTimeout(visibilityLockTimerRef.current);
        visibilityLockTimerRef.current = null;
      }
      destroyImmediateCaptureVeil();
      document.body.style.userSelect = previousUserSelect;
      (
        document.body.style as CSSStyleDeclaration & { webkitUserSelect?: string }
      ).webkitUserSelect = previousWebkitUserSelect;
      document.removeEventListener("contextmenu", handleContextMenu);
      document.removeEventListener("copy", handleCopy);
      document.removeEventListener("keydown", handleKeyDown);
      document.removeEventListener("visibilitychange", handleVisibilityChange);
      window.removeEventListener("blur", handleWindowBlur);
      window.removeEventListener("focus", handleWindowFocus);
      window.removeEventListener("pageshow", handlePageShow);
      window.removeEventListener("beforeprint", handleBeforePrint);
      window.removeEventListener("pagehide", handlePageHide);
      window.removeEventListener("keydown", handleCaptureKeyDown, true);
      window.removeEventListener("keyup", handleCaptureKeyUp, true);
      document.removeEventListener("keydown", handleCaptureKeyDown, true);
      document.removeEventListener("keyup", handleCaptureKeyUp, true);
    };
  }, [
    enabled,
    triggerCaptureBlockOverlay,
    clipboardMessage,
    clearDismissTimers,
    scheduleOverlayDismiss,
    recoverStuckVeilSoft,
  ]);

  useEffect(() => {
    return () => {
      clearDismissTimers();
      if (visibilityLockTimerRef.current !== null) {
        window.clearTimeout(visibilityLockTimerRef.current);
        visibilityLockTimerRef.current = null;
      }
      destroyImmediateCaptureVeil();
    };
  }, [clearDismissTimers]);

  return { showCaptureBlockOverlay, triggerCaptureBlockOverlay, dismissCaptureBlockOverlay };
}
