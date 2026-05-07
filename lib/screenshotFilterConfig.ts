/** `public.rdm_config` key; 1 = screenshot deterrence on, 0 = off. */
export const SCREENSHOT_FILTER_RDM_CONFIG_KEY = "screenshot_filter_enabled" as const;

export function rdmValueToScreenshotFilterEnabled(value: number | null | undefined): boolean {
  if (value === 0) return false;
  return true;
}
