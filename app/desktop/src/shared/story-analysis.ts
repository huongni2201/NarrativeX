export type AccountConnectionState = "UNKNOWN" | "CONNECTED" | "AUTH_REQUIRED" | "UNAVAILABLE";
export type AccountQuotaState = "UNKNOWN" | "AVAILABLE" | "RATE_LIMITED" | "EXHAUSTED";

/** Only locally derived categories and HTTP status; never provider messages, headers or tokens. */
export interface AnalysisDiagnostic {
  source: "ANTIGRAVITY" | "GOOGLE_OAUTH";
  httpStatus: number | null;
  reason: "INVALID_GRANT" | null;
}

/** Redacted view of one locally stored Google account. Tokens never reach the renderer. */
export interface StoryAnalysisAccount {
  accountId: string;
  /** Masked e-mail such as "h***@gmail.com". */
  label: string;
  /** Backend credential reference, null until the account is registered. */
  credentialRef: string | null;
  connectionState: AccountConnectionState;
  quotaState: AccountQuotaState;
  nextEligibleAt: string | null;
  activeJobId: string | null;
  lastError: string | null;
  lastDiagnostic?: AnalysisDiagnostic | null;
  addedAt: string;
}

export interface StoryAnalysisStatus {
  /** True once an Antigravity-compatible OAuth client profile is present and valid. */
  configured: boolean;
  profileIssue: string | null;
  deviceReady: boolean;
  loginInProgress: boolean;
  accounts: StoryAnalysisAccount[];
  lastError: string | null;
}

export interface StoryAnalysisConfiguration {
  executionMode: "VERTEX_API" | "ANTIGRAVITY_API";
  model: string;
  effort: "LOW" | "MEDIUM" | "HIGH";
  maxConcurrentAnalyses: number;
  rowVersion: number;
}

/** Backend-owned desired state for one registered account (enable switch, per-account concurrency). */
export interface StoryAnalysisCredential {
  credentialRef: string;
  label: string;
  enabled: boolean;
  maxConcurrent: number;
  connectionState: AccountConnectionState;
  quotaState: AccountQuotaState;
  nextEligibleAt: string | null;
}
