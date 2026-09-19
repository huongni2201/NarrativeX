import { useEffect, useState } from "react";
import { useQueryClient } from "@tanstack/react-query";
import { chapterQueryKeys } from "../../chapters/queries/chapters.queries";
import { generationQueryKeys } from "../queries/generation.queries";

export interface ProjectGenerationEvent {
  jobId: string;
  projectId: string;
  type: string;
  status: string;
  step: string;
  progress: number;
  active: boolean;
  terminal: boolean;
  errorCode: string;
}

// Global active SSE connection tracker per project
const activeConnections = new Map<string, number>();

export function isProjectSseActive(projectId?: string | null): boolean {
  if (!projectId) return false;
  return (activeConnections.get(projectId) ?? 0) > 0;
}

export function useProjectGenerationEvents(projectId: string | null | undefined) {
  const queryClient = useQueryClient();
  const [isConnected, setIsConnected] = useState(false);

  useEffect(() => {
    if (!projectId) {
      setIsConnected(false);
      return;
    }

    const path = `/api/v1/projects/${encodeURIComponent(projectId)}/generation/events`;

    const handleEvent = (eventName: string, dataStr: string) => {
      try {
        if (eventName === "connected") {
          setIsConnected(true);
          activeConnections.set(projectId, (activeConnections.get(projectId) ?? 0) + 1);
          return;
        }

        const payload = JSON.parse(dataStr) as ProjectGenerationEvent;
        if (!payload || payload.projectId !== projectId) return;

        // Invalidate generation queries
        void queryClient.invalidateQueries({
          queryKey: generationQueryKeys.all,
        });

        // Invalidate chapter queries for this project
        void queryClient.invalidateQueries({
          queryKey: chapterQueryKeys.all(projectId),
        });

        // Invalidate project timeline & storyboards
        void queryClient.invalidateQueries({
          queryKey: ["projects", projectId, "timeline"],
        });
        void queryClient.invalidateQueries({
          queryKey: ["storyboards", projectId],
        });
      } catch {
        // In case of unparseable event, invalidate generation to remain consistent
        void queryClient.invalidateQueries({
          queryKey: generationQueryKeys.all,
        });
      }
    };

    const unsubscribe = window.narrativex.api.subscribe(path, {
      onEvent: (event) => {
        handleEvent(event.event, event.data);
      },
      onError: () => {
        setIsConnected(false);
      },
    });

    return () => {
      unsubscribe();
      const current = activeConnections.get(projectId) ?? 0;
      if (current <= 1) {
        activeConnections.delete(projectId);
      } else {
        activeConnections.set(projectId, current - 1);
      }
      setIsConnected(false);
    };
  }, [projectId, queryClient]);

  return { isConnected };
}
