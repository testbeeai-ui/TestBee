"use client";

import { useCallback, useEffect, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/hooks/useAuth";
import {
  SCREENSHOT_FILTER_RDM_CONFIG_KEY,
  rdmValueToScreenshotFilterEnabled,
} from "@/lib/screenshotFilterConfig";

/**
 * Reads `rdm_config.screenshot_filter_enabled` for signed-in users.
 * Defaults to `true` when unauthenticated, missing row, or error (safe default).
 * Refetches on tab visibility so admin toggles apply without redeploy.
 */
export function useScreenshotFilterEnabled(): boolean {
  const { user } = useAuth();
  const [enabled, setEnabled] = useState(true);

  const fetchFlag = useCallback(async () => {
    if (!user?.id) {
      setEnabled(true);
      return;
    }
    const { data, error } = await supabase
      .from("rdm_config")
      .select("value")
      .eq("key", SCREENSHOT_FILTER_RDM_CONFIG_KEY)
      .maybeSingle();

    if (error) {
      setEnabled(true);
      return;
    }
    setEnabled(rdmValueToScreenshotFilterEnabled(data?.value));
  }, [user?.id]);

  useEffect(() => {
    void fetchFlag();
  }, [fetchFlag]);

  useEffect(() => {
    const onVisibility = () => {
      if (document.visibilityState === "visible") void fetchFlag();
    };
    document.addEventListener("visibilitychange", onVisibility);
    return () => document.removeEventListener("visibilitychange", onVisibility);
  }, [fetchFlag]);

  return enabled;
}
