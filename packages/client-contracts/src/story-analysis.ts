/** ANTIGRAVITY_CLI is retired and only appears on historical snapshots and runs. */
export type ChapterAnalysisExecutionMode = "VERTEX_API" | "ANTIGRAVITY_CLI" | "ANTIGRAVITY_API";
export type ChapterAnalysisUsageState = "REPORTED" | "PARTIAL" | "UNKNOWN" | "LEGACY_UNSPECIFIED";
export type ChapterAnalysisInputBudgetAccuracy = "EXACT" | "ESTIMATED" | "UNKNOWN";

export type ChapterAnalysisAttemptCheckpoint =
  | "CLAIMED"
  | "SUBMITTING"
  | "LOCAL_RUNNING"
  | "RESULT_READY"
  | "DELIVERED"
  | "REJECTED_BEFORE_EXECUTION"
  | "FAILED"
  | "CANCELED"
  | "UNKNOWN";

export type ChapterAnalysisObservationCode =
  | "CLI_UNAVAILABLE"
  | "CLI_VERSION_UNSUPPORTED"
  | "AUTH_REQUIRED"
  | "CREDENTIAL_BINDING_MISMATCH"
  | "MODEL_UNAVAILABLE"
  | "INPUT_TOO_LARGE"
  | "QUOTA_EXHAUSTED"
  | "RATE_LIMITED"
  | "CLI_PROTOCOL_ERROR"
  | "OUTPUT_LIMIT_EXCEEDED"
  | "PROVIDER_REFUSAL"
  | "CONTENT_BLOCKED"
  | "SOURCE_REVISION_CHANGED"
  | "SCHEMA_INVALID"
  | "ANCHOR_INVALID"
  | "LEASE_LOST"
  | "DEVICE_OFFLINE"
  | "AMBIGUOUS_OUTCOME"
  | "RESULT_CONFLICT"
  | "RESULT_DELIVERY_PENDING"
  | "PROVIDER_UNAVAILABLE"
  | "OAUTH_NOT_CONFIGURED"
  | "ACCOUNT_NOT_ONBOARDED";

export type ChapterAnalysisQuotaState =
  | "UNKNOWN"
  | "AVAILABLE"
  | "RATE_LIMITED"
  | "EXHAUSTED";

export interface ChapterAnalysisInputBudget {
  accuracy: ChapterAnalysisInputBudgetAccuracy;
  tokenCount: number | null;
  inputBytes: number;
  maxInputBytes: number;
}

export interface ChapterAnalysisUsage {
  promptTokens: number | null;
  outputTokens: number | null;
  thinkingTokens: number | null;
  cachedTokens: number | null;
  totalTokens: number | null;
  runtimeMs: number | null;
  state: ChapterAnalysisUsageState;
}

export interface ChapterAnalysisProvenance {
  provider: "VERTEX" | "ANTIGRAVITY";
  executionMode: ChapterAnalysisExecutionMode;
  attemptId: string | null;
  credentialRef: string | null;
  /** Client or adapter revision that produced the run (the Desktop OAuth adapter for ANTIGRAVITY_API). */
  cliVersion: string | null;
  conversationId: string | null;
  modelObserved: string | null;
  effortObserved: string | null;
  promptHash: string;
  schemaHash: string;
  outputHash: string;
}

export interface StoryAnalysisCredentialSummary {
  credentialRef: string;
  label: string;
  provider: "ANTIGRAVITY";
  enabled: boolean;
  connectionState: "UNKNOWN" | "CONNECTED" | "AUTH_REQUIRED" | "UNAVAILABLE";
  quotaState: ChapterAnalysisQuotaState;
  observedAt: string | null;
  nextEligibleAt: string | null;
  credentialGeneration: number;
  maxConcurrent: number;
}

export interface StoryAnalysisRuntimeConfiguration {
  revision: number;
  executionMode: ChapterAnalysisExecutionMode;
  model: string;
  effort: "LOW" | "MEDIUM" | "HIGH";
  maxConcurrentAnalyses: number;
  defaultMaxConcurrentPerCredential: number;
  maxQueuedAnalyses: number;
  automaticApiFallback: false;
  multiCredentialExecution: boolean;
}
