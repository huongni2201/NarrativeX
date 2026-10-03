import type { QueryClient } from "@tanstack/react-query";
import { isRecord } from "../../../../shared/api-envelope.ts";
import { refreshProduction } from "../../production/queries/production-cache.ts";

const activeConnections = new Map<string, number>();

export function isProjectSseActive(projectId?: string | null): boolean {
  return Boolean(projectId && (activeConnections.get(projectId) ?? 0) > 0);
}

interface EventTransport {
  subscribe(path: string, handlers: {
    onEvent: (event: { event: string; data: string }) => void;
    onError: (error: unknown) => void;
  }): () => void;
}

export function subscribeProjectEvents(client: QueryClient, projectId: string, api: EventTransport, onConnection: (connected: boolean) => void) {
  let connected = false;
  let stopped = false;
  const pendingJobs = new Set<string>();
  let progressTimer: ReturnType<typeof setTimeout> | undefined;
  const flushProgress = () => {
    progressTimer = undefined;
    for (const jobId of pendingJobs) {
      for (const kind of ["generation-job", "media-job"]) {
        void client.invalidateQueries({ queryKey: ["generation", kind, jobId], exact: true });
      }
    }
    pendingJobs.clear();
  };
  const setConnected = (next: boolean) => {
    if (next === connected) return;
    connected = next;
    const count = (activeConnections.get(projectId) ?? 0) + (next ? 1 : -1);
    if (count > 0) activeConnections.set(projectId, count);
    else activeConnections.delete(projectId);
    onConnection(next);
  };
  const refresh = () => {
    void refreshProduction(client, projectId);
    void client.invalidateQueries({ queryKey: ["storyboards", projectId] });
    void client.invalidateQueries({ queryKey: ["story", "chapter", projectId] });
  };
  const unsubscribe = api.subscribe(`/api/v1/projects/${encodeURIComponent(projectId)}/generation/events`, {
    onEvent(event) {
      if (stopped) return;
      if (event.event === "connected") {
        if (!connected) { setConnected(true); refresh(); }
        return;
      }
      let payload: unknown;
      try { payload = JSON.parse(event.data); } catch { refresh(); return; }
      if (!isRecord(payload) || payload.projectId !== projectId || typeof payload.jobId !== "string") return;
      pendingJobs.add(payload.jobId);
      if (payload.terminal === true || ["COMPLETED", "FAILED", "CANCELED"].includes(String(payload.status))) {
        clearTimeout(progressTimer);
        flushProgress();
        refresh();
      } else if (progressTimer === undefined) {
        progressTimer = setTimeout(flushProgress, 250);
      }
    },
    onError() { if (!stopped) { setConnected(false); refresh(); } },
  });
  return () => {
    if (stopped) return;
    stopped = true;
    clearTimeout(progressTimer);
    pendingJobs.clear();
    unsubscribe();
    setConnected(false);
  };
}
