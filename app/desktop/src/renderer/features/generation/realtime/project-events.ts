import { useEffect, useState } from "react";
import { useQueryClient } from "@tanstack/react-query";
import { subscribeProjectEvents } from "./project-event-subscription.ts";
export { isProjectSseActive } from "./project-event-subscription.ts";

export function useProjectGenerationEvents(projectId: string | null | undefined) {
  const client = useQueryClient();
  const [isConnected, setIsConnected] = useState(false);
  useEffect(() => {
    setIsConnected(false);
    if (!projectId) return;
    return subscribeProjectEvents(client, projectId, window.narrativex.api, setIsConnected);
  }, [projectId, client]);
  return { isConnected };
}
