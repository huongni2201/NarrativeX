import type { GenerationJobStatus } from "../../../shared/api-types";

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

export function generationJobPollInterval(
  queryStatus: string,
  jobStatus: string | null | undefined,
): number | false {
  if (queryStatus === "error") return false;
  return !jobStatus || isActiveGenerationJobStatus(jobStatus) ? 15_000 : false;
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
