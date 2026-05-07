# Mentamill Anti-Cheat Quiz Implementation Guide

This document outlines the core architecture and logic used to implement the "Question-first reveal mode" quiz with anti-capture mechanisms, as demonstrated in the `DemoMentaMillQuiz` component. It serves as a guide for implementing similar secure quizzes throughout the application.

## 1. Core Concepts & Structure

The quiz features two distinct phases per question to prevent immediate brute-forcing or screenshotting while allowing users time to think:

- **Read Mode (e.g., first 20 seconds):** Only the question is shown. Options are hidden to prevent students from immediately searching for the exact answer choices.
- **Options Phase (e.g., last 10 seconds):** The multiple-choice options are revealed.

### Required State Variables
To manage this flow and the anti-cheat mechanics, the component requires the following state:
- `hasStarted` / `runFinished` / `securityLocked`: Tracks the macro-level state of the quiz session.
- `index`: The current question index.
- `timeLeft`: A timer driven by a wall-clock deadline.
- `selectedIndex`: Tracks the user's choice to handle scoring and prevent double-clicks.
- `showCaptureBlockOverlay`: Toggles the full-screen "Screenshots blocked" UI.

## 2. Timer Implementation (Wall-Clock Deadline)

Never use a naive `setInterval` that just subtracts `1` from a counter every second. When a browser tab is placed in the background (which happens during Snipping Tool or alt-tabbing), the browser will heavily throttle `setInterval`, causing the timer to freeze and granting the user infinite time.

**Solution:** Use a fixed wall-clock deadline.

```typescript
// 1. Set the deadline whenever the question index changes
useEffect(() => {
  if (!hasStarted || runFinished || securityLocked) {
    questionEndAtRef.current = null;
    return;
  }
  // TOTAL_SECONDS = e.g. 30
  questionEndAtRef.current = Date.now() + TOTAL_SECONDS * 1000;
}, [hasStarted, index, runFinished, securityLocked]);

// 2. Tick frequently (e.g., 250ms) to calculate the difference
useEffect(() => {
  if (!hasStarted || runFinished || securityLocked) return;

  let firedZero = false;
  const tick = () => {
    const end = questionEndAtRef.current;
    if (!end) return;
    
    const secs = Math.max(0, Math.ceil((end - Date.now()) / 1000));
    setTimeLeft(secs);

    if (secs === 0) {
      if (firedZero) return;
      firedZero = true;
      // Handle auto-advance logic here
    } else {
      firedZero = false;
    }
  };

  const id = window.setInterval(tick, 250);
  tick();
  return () => window.clearInterval(id);
}, [hasStarted, runFinished, securityLocked, index]);
```

**Customizing Timers:** You can separate the "total time" and the "read time". For example, if a question gives 60 seconds total, but options unlock at 20 seconds left, you simply set the deadline to `Date.now() + 60000`, and check `timeLeft <= 20` to toggle the visibility of the options grid.

## 3. Anti-Capture Mechanisms

A major feature of this quiz is preventing screenshots, screen recordings, and copy-pasting. Because web browsers run in a sandbox, we cannot intercept all OS-level capture events natively. However, we can use an aggressive combination of DOM events to maximize protection.

### A. The CSS Shield (Soft Wash)
Apply a static, soft-light radial gradient to the question and options containers. It should use `mix-blend-mode: soft-light` or similar so that text remains highly legible to the naked eye but gets heavily distorted by basic OCR or visual capture tools.
- *Avoid moving scanlines or moiré patterns as they cause visual fatigue.*

### B. Polling for Document Focus
Many screenshot tools steal focus from the document without triggering standard keyboard events.
- **Poll `document.hasFocus()`** every ~200ms while the quiz is active.
- If it returns `false`, immediately trigger the full-screen capture block overlay.

### C. The Aggressive Event Listener Suite
Attach listeners on the **capture phase** (setting the third argument of `addEventListener` to `true`) so that React's synthetic event bubbling (or focus traps) doesn't swallow keyboard shortcuts.

The required listeners are:
1. `keydown` (Capture Phase): Intercept `PrintScreen`, `Meta+Shift+S`, `Ctrl+Shift+S`, `Meta+C`, `Ctrl+C`, and DevTools shortcuts (`F12`, `Ctrl+Shift+I`).
2. `keyup` (Capture Phase): Specifically intercept `PrintScreen` release.
3. `visibilitychange`: Trigger the block overlay immediately if `document.visibilityState === "hidden"`. Use a double-check timeout to keep the block up if the user returns quickly.
4. `blur`, `pagehide`, `beforeprint`: Trigger the overlay when the window loses focus, navigates away, or attempts to print.
5. `contextmenu` and `copy`: Call `event.preventDefault()` to block right-clicking and copying.
6. DOM-level text selection: Set `document.body.style.userSelect = "none"`.

### D. The Block Overlay implementation
When an event fires, trigger a full-screen overlay for a specific duration (e.g., 2.5 to 3 seconds).
- **Important:** Use `useRef` for the timeout ID so that if multiple events fire at once (e.g., `blur` + `keydown`), you can clear the existing timeout and extend the duration, rather than the overlay flickering off instantly.

```typescript
const triggerCaptureBlockOverlay = useCallback((durationMs = 2400) => {
  setShowCaptureBlockOverlay(true);
  if (overlayTimerRef.current !== null) {
    window.clearTimeout(overlayTimerRef.current);
  }
  overlayTimerRef.current = window.setTimeout(() => {
    setShowCaptureBlockOverlay(false);
    overlayTimerRef.current = null;
  }, durationMs);
}, []);
```

## 4. Strict Mode (Optional Screen Sharing)

For high-stakes assessments, you can optionally require the user to share their screen using `navigator.mediaDevices.getDisplayMedia`.
- If the user stops sharing (the `videoTrack` fires an `"ended"` event), you immediately lock the quiz by setting `securityLocked = true`.

## 5. Earn & Learn (`InlineRdmChallenge`) — per-challenge timing

Refer challenges read pacing from `ReferChallengePublicSpec` in `lib/referEarnChallenges.ts` (wall-clock deadline per question + `referChallengeSessionDurationSec` for the session):

| Challenge | Session (MM:SS) | Stem (read-only) | Choices (final segment) |
|-----------|-----------------|------------------|-------------------------|
| MentaMill Blitz | 05:00 | 00:20 | 00:10 |
| FunBrain Quiz | 07:20 (`sessionTailSeconds: 20` on top of 7 min) | 00:20 | 00:10 |
| Academic Arena | 10:00 | 00:50 | 00:10 |
| Academic Arena Pro | 25:00 | 00:50 | 00:10 |

Reveal rule matches §1: show options when `perQuestionLeft <= optionsPhaseSec`. UI copy should keep numeric durations in **timer tokens** (`MM:SS`), not spelled-out “minutes/seconds” in prose.

## Summary Checklist for New Quizzes
- [ ] Use `questionEndAtRef` (wall-clock) instead of relative `setInterval` subtraction for timers.
- [ ] Render the Question separate from the Options, gating option visibility by checking `timeLeft <= REVEAL_OPTIONS_AT`.
- [ ] Add the CSS "soft shield" overlay behind the question text and options.
- [ ] Implement the `isDemoRunActive()` check so anti-cheat only applies *during* the quiz, not on the start/end screens.
- [ ] Mount the `document.hasFocus()` poller.
- [ ] Mount window `capture phase` listeners for keyboard shortcuts.
- [ ] Provide a clear, non-harsh full-screen overlay (e.g., Slate/Grey gradient, not blinding white) explaining that captures are disabled when triggered.