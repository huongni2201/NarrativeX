export type DesktopRenderJobStatus =
  | "QUEUED"
  | "RUNNING"
  | "COMPLETED"
  | "FAILED"
  | "CANCELED"
  | "UNKNOWN"
  | "STALLED"
  | "PAUSED_COST_LIMIT";

export interface DesktopRenderJob {
  jobId: string;
  type: string;
  status: DesktopRenderJobStatus;
  progress: number;
  currentStep: string | null;
  errorCode: string | null;
}
