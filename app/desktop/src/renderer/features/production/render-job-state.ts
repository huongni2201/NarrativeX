import type { DesktopRenderJobStatus } from "@narrativex/client-contracts";

const ACTIVE_RENDER_STATUSES = new Set<DesktopRenderJobStatus>([
  "QUEUED",
  "RUNNING",
  "UNKNOWN",
  "STALLED",
]);

export function isActiveRenderJob(status: DesktopRenderJobStatus | null | undefined): boolean {
  return status != null && ACTIVE_RENDER_STATUSES.has(status);
}

export function isTerminalRenderJob(status: DesktopRenderJobStatus | null | undefined): boolean {
  return status === "COMPLETED" || status === "FAILED" || status === "CANCELED";
}
