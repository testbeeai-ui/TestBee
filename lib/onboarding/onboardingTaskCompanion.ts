/** Active checklist task + companion UI (floating step tracker). */
export const ONBOARDING_ACTIVE_TASK_KEY = "edublast_active_onboarding_task";

/**
 * Set only when the user taps "Open task — earn X RDM!" in the task detail drawer.
 * Prevents the companion from appearing after merely opening a sticky note on the board.
 */
export const ONBOARDING_COMPANION_LAUNCHED_KEY = "edublast_onboarding_companion_launched_v1";

/**
 * One-shot: after launch, expand the task companion once the user lands on a route where
 * the companion is shown (survives client navigation + remount; cleared after expand).
 */
export const ONBOARDING_COMPANION_PENDING_EXPAND_KEY = "edublast_companion_pending_expand_v1";

/** Legacy single position key (migrated into POSITIONS_MAP_KEY). */
export const ONBOARDING_COMPANION_POSITION_KEY = "edublast_companion_position";

/** Per-task launcher (minimized) positions. */
const LAUNCHER_POSITIONS_MAP_KEY = "edublast_companion_launcher_positions_v3";

/** Per-task expanded panel positions (draggable). */
const PANEL_POSITIONS_MAP_KEY = "edublast_companion_panel_positions_v1";

/** Per-task expanded: `edublast_companion_expanded_v1_<taskId>` → "1" | "0". */
export const ONBOARDING_COMPANION_EXPANDED_KEY = "edublast_companion_expanded_v1";

function expandedPreferenceKey(taskId: string): string {
  return `${ONBOARDING_COMPANION_EXPANDED_KEY}_${taskId}`;
}

export const ONBOARDING_ACTIVE_TASK_CHANGED_EVENT = "edublast-active-onboarding-task-changed";

const COMPANION_PANEL_WIDTH = 310;
const COMPANION_PANEL_MIN_HEIGHT = 280;
const COMPANION_LAUNCHER_SIZE = 48;
const COMPANION_VIEWPORT_PAD = 12;

export type CompanionPosition = { x: number; y: number };

/** Left side below the top nav — default dock for the minimized reopen chip. */
export function getDefaultLauncherPosition(): CompanionPosition {
  if (typeof window === "undefined") {
    return { x: 20, y: 120 };
  }
  return clampCompanionPosition(
    {
      x: COMPANION_VIEWPORT_PAD + 16,
      y: COMPANION_VIEWPORT_PAD + 88,
    },
    { minimized: true }
  );
}

/** Viewport center — start of the minimize “dock to left” animation. */
export function getCenterLauncherPosition(): CompanionPosition {
  if (typeof window === "undefined") {
    return { x: 20, y: 120 };
  }
  return clampCompanionPosition(
    {
      x: (window.innerWidth - COMPANION_LAUNCHER_SIZE) / 2,
      y: (window.innerHeight - COMPANION_LAUNCHER_SIZE) / 2,
    },
    { minimized: true }
  );
}

/** Viewport center for the expanded task companion panel. */
export function getDefaultPanelPosition(): CompanionPosition {
  if (typeof window === "undefined") return { x: 20, y: 120 };
  return clampCompanionPosition({
    x: (window.innerWidth - COMPANION_PANEL_WIDTH) / 2,
    y: (window.innerHeight - COMPANION_PANEL_MIN_HEIGHT) / 2,
  });
}

export function clampCompanionPosition(
  pos: CompanionPosition,
  opts?: { minimized?: boolean; width?: number; height?: number }
): CompanionPosition {
  if (typeof window === "undefined") return pos;
  const minimized = opts?.minimized ?? false;
  const w = opts?.width ?? (minimized ? COMPANION_LAUNCHER_SIZE : COMPANION_PANEL_WIDTH);
  const h = opts?.height ?? (minimized ? COMPANION_LAUNCHER_SIZE : COMPANION_PANEL_MIN_HEIGHT);
  const maxW = window.innerWidth;
  const maxH = window.innerHeight;
  return {
    x: Math.max(COMPANION_VIEWPORT_PAD, Math.min(pos.x, maxW - w - COMPANION_VIEWPORT_PAD)),
    y: Math.max(COMPANION_VIEWPORT_PAD, Math.min(pos.y, maxH - h - COMPANION_VIEWPORT_PAD)),
  };
}

function readLauncherPositionsMap(): Record<string, CompanionPosition> {
  if (typeof window === "undefined") return {};
  try {
    const raw = window.localStorage.getItem(LAUNCHER_POSITIONS_MAP_KEY);
    if (!raw) return {};
    const parsed = JSON.parse(raw) as Record<string, CompanionPosition>;
    return parsed && typeof parsed === "object" ? parsed : {};
  } catch {
    return {};
  }
}

function writeLauncherPositionsMap(map: Record<string, CompanionPosition>): void {
  if (typeof window === "undefined") return;
  try {
    window.localStorage.setItem(LAUNCHER_POSITIONS_MAP_KEY, JSON.stringify(map));
  } catch {
    /* ignore */
  }
}

/** Snap legacy bottom-right saves to the left dock. */
export function normalizeLauncherPosition(pos: CompanionPosition): CompanionPosition {
  if (typeof window === "undefined") return pos;
  const dock = getDefaultLauncherPosition();
  if (pos.x > window.innerWidth * 0.5 && Math.abs(pos.x - dock.x) > 64) {
    return dock;
  }
  return pos;
}

/** Load saved position for the minimized reopen chip only. */
export function loadCompanionPosition(taskId?: string): CompanionPosition | null {
  if (typeof window === "undefined") return null;
  try {
    if (taskId) {
      const map = readLauncherPositionsMap();
      const fromMap = map[taskId];
      if (fromMap && typeof fromMap.x === "number" && typeof fromMap.y === "number") {
        return normalizeLauncherPosition(clampCompanionPosition(fromMap, { minimized: true }));
      }
    }
    return null;
  } catch {
    return null;
  }
}

export function saveCompanionPosition(taskId: string, pos: CompanionPosition): void {
  if (typeof window === "undefined" || !taskId) return;
  try {
    const map = readLauncherPositionsMap();
    map[taskId] = clampCompanionPosition(pos, { minimized: true });
    writeLauncherPositionsMap(map);
  } catch {
    /* ignore */
  }
}

function readPanelPositionsMap(): Record<string, CompanionPosition> {
  if (typeof window === "undefined") return {};
  try {
    const raw = window.localStorage.getItem(PANEL_POSITIONS_MAP_KEY);
    if (!raw) return {};
    const parsed = JSON.parse(raw) as Record<string, CompanionPosition>;
    return parsed && typeof parsed === "object" ? parsed : {};
  } catch {
    return {};
  }
}

function writePanelPositionsMap(map: Record<string, CompanionPosition>): void {
  if (typeof window === "undefined") return;
  try {
    window.localStorage.setItem(PANEL_POSITIONS_MAP_KEY, JSON.stringify(map));
  } catch {
    /* ignore */
  }
}

export function loadPanelPosition(taskId?: string): CompanionPosition | null {
  if (typeof window === "undefined" || !taskId) return null;
  try {
    const map = readPanelPositionsMap();
    const fromMap = map[taskId];
    if (fromMap && typeof fromMap.x === "number" && typeof fromMap.y === "number") {
      return clampCompanionPosition(fromMap);
    }
    return null;
  } catch {
    return null;
  }
}

export function savePanelPosition(taskId: string, pos: CompanionPosition): void {
  if (typeof window === "undefined" || !taskId) return;
  try {
    const map = readPanelPositionsMap();
    map[taskId] = clampCompanionPosition(pos);
    writePanelPositionsMap(map);
  } catch {
    /* ignore */
  }
}

export function loadCompanionExpandedPreference(taskId?: string): boolean | null {
  if (typeof window === "undefined") return null;
  try {
    if (taskId) {
      const v = window.sessionStorage.getItem(expandedPreferenceKey(taskId));
      if (v === "1") return true;
      if (v === "0") return false;
    }
    const legacy = window.sessionStorage.getItem(ONBOARDING_COMPANION_EXPANDED_KEY);
    if (legacy === "1") return true;
    if (legacy === "0") return false;
    return null;
  } catch {
    return null;
  }
}

export function saveCompanionExpandedPreference(taskId: string, expanded: boolean): void {
  if (typeof window === "undefined" || !taskId) return;
  try {
    window.sessionStorage.setItem(expandedPreferenceKey(taskId), expanded ? "1" : "0");
  } catch {
    /* ignore */
  }
}

export function clearCompanionExpandedPreference(taskId?: string): void {
  if (typeof window === "undefined") return;
  try {
    if (taskId) {
      window.sessionStorage.removeItem(expandedPreferenceKey(taskId));
      return;
    }
    window.sessionStorage.removeItem(ONBOARDING_COMPANION_EXPANDED_KEY);
    for (let i = window.sessionStorage.length - 1; i >= 0; i -= 1) {
      const key = window.sessionStorage.key(i);
      if (key?.startsWith(`${ONBOARDING_COMPANION_EXPANDED_KEY}_`)) {
        window.sessionStorage.removeItem(key);
      }
    }
  } catch {
    /* ignore */
  }
}

/** Fired when the floating companion finishes its ~4.5s celebration after a full task completes. */
export const ONBOARDING_TASK_CELEBRATION_ENDED_EVENT = "edublast-onboarding-task-celebration-ended";

export type OnboardingTaskCelebrationEndedDetail = {
  taskId: string;
};

/** Opens the full site-tour checklist (OnboardingNextTaskPrompt listens). */
export function dispatchOnboardingTaskCelebrationEnded(taskId: string): void {
  if (typeof window === "undefined" || !taskId) return;
  window.dispatchEvent(
    new CustomEvent<OnboardingTaskCelebrationEndedDetail>(ONBOARDING_TASK_CELEBRATION_ENDED_EVENT, {
      detail: { taskId },
    })
  );
}

/** Start tracking: sticky board → task detail → Open task (all 10 tasks). */
export function launchOnboardingTaskCompanion(taskId: string): void {
  if (typeof window === "undefined") return;
  window.localStorage.setItem(ONBOARDING_ACTIVE_TASK_KEY, taskId);
  window.localStorage.setItem(ONBOARDING_COMPANION_LAUNCHED_KEY, taskId);
  try {
    window.sessionStorage.setItem(ONBOARDING_COMPANION_PENDING_EXPAND_KEY, taskId);
  } catch {
    /* ignore quota / private mode */
  }
  window.dispatchEvent(new CustomEvent(ONBOARDING_ACTIVE_TASK_CHANGED_EVENT, { detail: taskId }));
}

export function dismissOnboardingTaskCompanion(): void {
  if (typeof window === "undefined") return;
  const taskId = window.localStorage.getItem(ONBOARDING_ACTIVE_TASK_KEY);
  window.localStorage.removeItem(ONBOARDING_ACTIVE_TASK_KEY);
  window.localStorage.removeItem(ONBOARDING_COMPANION_LAUNCHED_KEY);
  try {
    window.sessionStorage.removeItem(ONBOARDING_COMPANION_PENDING_EXPAND_KEY);
    if (taskId) clearCompanionExpandedPreference(taskId);
  } catch {
    /* ignore */
  }
  window.dispatchEvent(new CustomEvent(ONBOARDING_ACTIVE_TASK_CHANGED_EVENT, { detail: "" }));
}

/** Companion should show only after the user confirmed "Open task" in the detail drawer. */
export function isOnboardingTaskCompanionLaunched(taskId?: string): boolean {
  if (typeof window === "undefined") return false;
  const active = window.localStorage.getItem(ONBOARDING_ACTIVE_TASK_KEY);
  const launched = window.localStorage.getItem(ONBOARDING_COMPANION_LAUNCHED_KEY);
  if (!active || launched !== active) return false;
  if (taskId) return active === taskId;
  return true;
}

export function getLaunchedOnboardingTaskId(): string | null {
  if (!isOnboardingTaskCompanionLaunched()) return null;
  return window.localStorage.getItem(ONBOARDING_ACTIVE_TASK_KEY);
}
