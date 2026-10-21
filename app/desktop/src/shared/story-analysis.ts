export type AccountConnectionState = "UNKNOWN" | "CONNECTED" | "AUTH_REQUIRED" | "UNAVAILABLE";
export type AccountQuotaState = "UNKNOWN" | "AVAILABLE" | "RATE_LIMITED" | "EXHAUSTED";

/** Only a fixed category and the process exit code; never CLI output, tokens or story text. */
export interface AnalysisDiagnostic {
  source: "AGY_CLI";
  exitCode: number | null;
  /** UPPER_SNAKE category such as NOT_LOGGED_IN, QUOTA, TOOL_DENIED, TIMEOUT, SPAWN_FAILED, BAD_ENVELOPE. */
  reason: string | null;
}

/** Local CLI error log only; never model output. Older entries have no job ID. */
export interface AnalysisDiagnosticEntry {
  at: string;
  code: string;
  exitCode: number | null;
  reason: string | null;
  excerpt: string;
  jobId?: string;
  stage?: "CANON" | "STORY";
  windowNumber?: number;
  windowCount?: number;
}

/** Remaining share (0..1) of the `agy /usage` buckets for one model family. */
export interface AgyUsageGroup {
  family: "gemini" | "third-party";
  fiveHourRemaining: number | null;
  fiveHourResetsAt: string | null;
  weeklyRemaining: number | null;
  weeklyResetsAt: string | null;
}

/** One entry of `agy models`; the reasoning level is part of the slug. */
export interface AgyModel {
  slug: string;
  family: "gemini" | "third-party";
}

/**
 * Redacted view of the single login owned by agy on this machine.
 * NarrativeX never reads, copies or rotates the provider credential.
 */
export interface StoryAnalysisStatus {
  /** True when a supported agy executable was found. */
  cliReady: boolean;
  cliVersion: string | null;
  /** AGY_NOT_FOUND | AGY_VERSION_UNSUPPORTED | PLATFORM_UNSUPPORTED when not ready. */
  cliIssue: string | null;
  /** False until the isolated-profile and tool-lockdown gate (spike step 6b) has been confirmed. */
  isolationVerified: boolean;
  deviceReady: boolean;
  /** True when agy answered `/usage`, i.e. its own login is valid. */
  loggedIn: boolean;
  /** Backend credential reference; null until the single session slot is registered. */
  credentialRef: string | null;
  connectionState: AccountConnectionState;
  quotaState: AccountQuotaState;
  nextEligibleAt: string | null;
  usage: AgyUsageGroup[];
  usageObservedAt: string | null;
  runningJobs: number;
  /** Chapters analysed at once by this Desktop (1..3, never above the backend limit). */
  maxParallel: number;
  /** MODEL_NOT_AVAILABLE | MODEL_NOT_CONFIGURED when the configured model cannot be used; claims are paused. */
  modelIssue: string | null;
  lastError: string | null;
  lastDiagnostic: AnalysisDiagnostic | null;
}

/** A chapter analysis this Desktop is running right now; used to show that the agy process really exists. */
export interface StoryAnalysisActivity {
  jobId: string;
  /** When Desktop started running the claim (ISO 8601). */
  startedAt: string;
  /** agy process id; null while the process is still starting. */
  pid: number | null;
  /** False when the process id no longer exists although the run has not finished. */
  processAlive: boolean;
}

export interface StoryAnalysisConfiguration {
  executionMode: "ANTIGRAVITY_CLI";
  model: string;
  effort: "LOW" | "MEDIUM" | "HIGH";
  maxConcurrentAnalyses: number;
  rowVersion: number;
}
