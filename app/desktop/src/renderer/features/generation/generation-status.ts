import type { GenerationJobStatus } from "@narrativex/client-contracts";

const ACTIVE_GENERATION_JOB_STATUSES = new Set<GenerationJobStatus>([
  "QUEUED",
  "RUNNING",
  "UNKNOWN",
  "STALLED",
]);

const ACTIVE_MEDIA_EXECUTION_STATUSES = new Set([
  "QUEUED",
  "RUNNING",
  "VALIDATING",
  "UNKNOWN",
]);

export function isActiveGenerationJobStatus(
  status: string | null | undefined,
): boolean {
  return Boolean(
    status && ACTIVE_GENERATION_JOB_STATUSES.has(status as GenerationJobStatus),
  );
}

export function isActiveMediaExecutionStatus(
  status: string | null | undefined,
): boolean {
  return Boolean(status && ACTIVE_MEDIA_EXECUTION_STATUSES.has(status));
}

export function isTerminalGenerationJobStatus(
  status: string | null | undefined,
): boolean {
  return status === "COMPLETED" || status === "FAILED" || status === "CANCELED";
}
