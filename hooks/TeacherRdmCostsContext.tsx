"use client";

import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useState,
  type ReactNode,
} from "react";
import { fetchWithClientAuth } from "@/lib/auth/clientApiAuth";
import {
  DEFAULT_LIVE_CLASS_DELIVERY_RDM_CONFIG,
  type LiveClassDeliveryRdmConfig,
} from "@/lib/teacherPortal/liveClassDeliveryRdm";
import {
  DEFAULT_TEACHER_RDM_COSTS,
  type TeacherRdmCosts,
} from "@/lib/teacherPortal/teacherRdmConfig";

type TeacherRdmCostsContextValue = {
  costs: TeacherRdmCosts;
  liveClassDelivery: LiveClassDeliveryRdmConfig;
  loading: boolean;
  refresh: () => Promise<void>;
};

const TeacherRdmCostsContext = createContext<TeacherRdmCostsContextValue>({
  costs: DEFAULT_TEACHER_RDM_COSTS,
  liveClassDelivery: DEFAULT_LIVE_CLASS_DELIVERY_RDM_CONFIG,
  loading: false,
  refresh: async () => {},
});

export function TeacherRdmCostsProvider({ children }: { children: ReactNode }) {
  const [costs, setCosts] = useState<TeacherRdmCosts>(DEFAULT_TEACHER_RDM_COSTS);
  const [liveClassDelivery, setLiveClassDelivery] = useState<LiveClassDeliveryRdmConfig>(
    DEFAULT_LIVE_CLASS_DELIVERY_RDM_CONFIG
  );
  const [loading, setLoading] = useState(true);

  const refresh = useCallback(async () => {
    try {
      const res = await fetchWithClientAuth("/api/teacher/rdm/costs", {
        credentials: "include",
      });
      const payload = (await res.json().catch(() => ({}))) as {
        costs?: TeacherRdmCosts;
        liveClassDelivery?: LiveClassDeliveryRdmConfig;
      };
      if (res.ok && payload.costs) {
        setCosts(payload.costs);
      }
      if (res.ok && payload.liveClassDelivery) {
        setLiveClassDelivery(payload.liveClassDelivery);
      }
    } catch {
      // Keep last known or defaults
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    void refresh();
    const onFocus = () => void refresh();
    window.addEventListener("focus", onFocus);
    return () => window.removeEventListener("focus", onFocus);
  }, [refresh]);

  const value = useMemo(
    () => ({ costs, liveClassDelivery, loading, refresh }),
    [costs, liveClassDelivery, loading, refresh]
  );

  return (
    <TeacherRdmCostsContext.Provider value={value}>{children}</TeacherRdmCostsContext.Provider>
  );
}

export function useTeacherRdmCosts() {
  return useContext(TeacherRdmCostsContext);
}
