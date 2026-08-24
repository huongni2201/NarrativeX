"use client";

import { createContext, useContext, useEffect, useMemo, useState } from "react";
import { useQueryClient } from "@tanstack/react-query";
import { apiUrl } from "@/shared/api/client";
import { queryKeys } from "@/lib/query-keys";
import {
  isApiGenerationJob,
  TERMINAL_JOB_STATUSES,
  type ApiGenerationJob,
  type ProjectId,
} from "@/types/api";
import { useAuthStore } from "@/store/useAuthStore";

interface GenerationEventEnvelope {
  eventId: string;
  projectId: ProjectId;
  job: ApiGenerationJob;
}

interface GenerationEventsContextValue {
  connected: boolean;
}

const GenerationEventsContext = createContext<GenerationEventsContextValue>({ connected: false });

export function GenerationEventsProvider({ children }: Readonly<{ children: React.ReactNode }>) {
  const queryClient = useQueryClient();
  const authStatus = useAuthStore((state) => state.status);
  const [connected, setConnected] = useState(false);

  useEffect(() => {
    if (authStatus !== "authenticated") {
      setConnected(false);
      return undefined;
    }

    const source = new EventSource(apiUrl("/api/v1/generation-events"), {
      withCredentials: true,
    });

    const handleGenerationUpdate = (event: MessageEvent<string>) => {
      const envelope = parseGenerationEvent(event.data);
      if (!envelope) return;

      const { job } = envelope;
      queryClient.setQueryData(queryKeys.job(job.jobId), job);
      void queryClient.invalidateQueries({
        queryKey: queryKeys.mediaJob(job.jobId),
        refetchType: "active",
      });

      if (job.target.type === "CHAPTER") {
        void queryClient.invalidateQueries({
          queryKey: queryKeys.chapterWorkspace(envelope.projectId, job.target.id),
          refetchType: "active",
        });
      }

      if (TERMINAL_JOB_STATUSES.has(job.status)) {
        void queryClient.invalidateQueries({
          queryKey: ["notifications"],
          refetchType: "active",
        });
      }
    };

    source.onopen = () => setConnected(true);
    source.onerror = () => setConnected(false);
    source.addEventListener("generation.updated", handleGenerationUpdate as EventListener);

    return () => {
      source.removeEventListener("generation.updated", handleGenerationUpdate as EventListener);
      source.close();
      setConnected(false);
    };
  }, [authStatus, queryClient]);

  const contextValue = useMemo(() => ({ connected }), [connected]);
  return (
    <GenerationEventsContext.Provider value={contextValue}>
      {children}
    </GenerationEventsContext.Provider>
  );
}

export function useGenerationEventsStatus() {
  return useContext(GenerationEventsContext);
}

function parseGenerationEvent(raw: string): GenerationEventEnvelope | null {
  try {
    const value: unknown = JSON.parse(raw);
    if (!isRecord(value) || typeof value.eventId !== "string" || typeof value.projectId !== "string") {
      return null;
    }
    return isApiGenerationJob(value.job)
      ? { eventId: value.eventId, projectId: value.projectId, job: value.job }
      : null;
  } catch {
    return null;
  }
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null;
}
