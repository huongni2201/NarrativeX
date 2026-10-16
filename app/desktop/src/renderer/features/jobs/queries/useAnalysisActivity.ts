import { useEffect, useState } from "react";
import { useQuery } from "@tanstack/react-query";

export const ANALYSIS_ACTIVITY_KEY = ["story-analysis", "activity"] as const;

/** Polls the Desktop for the agy processes it is running. Disabled (and undefined) when nothing needs checking. */
export function useAnalysisActivity(enabled: boolean) {
  const bridge = window.narrativex?.storyAnalysis;
  return useQuery({
    queryKey: ANALYSIS_ACTIVITY_KEY,
    queryFn: () => bridge!.activity(),
    enabled: enabled && Boolean(bridge),
    refetchInterval: 3_000,
    retry: false,
  });
}

/** Current time that advances every second while `active`, so elapsed run times keep counting. */
export function useNow(active: boolean): number {
  const [now, setNow] = useState(() => Date.now());
  useEffect(() => {
    if (!active) return;
    setNow(Date.now());
    const timer = setInterval(() => setNow(Date.now()), 1_000);
    return () => clearInterval(timer);
  }, [active]);
  return now;
}
