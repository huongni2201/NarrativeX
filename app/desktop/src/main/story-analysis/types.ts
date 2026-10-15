import type { AnalysisDiagnostic } from "../../shared/story-analysis.ts";

export interface AnalysisClaim {
  jobId: string;
  projectId: string;
  attemptId: string;
  leaseToken: string;
  sourceText: string;
  sourceLanguage: string;
  promptTemplate: string;
  responseSchema: Record<string, unknown>;
  profile: { model: string; effort: "LOW" | "MEDIUM" | "HIGH"; promptHash: string; schemaHash: string };
  maxInputBytes: number;
  maxOutputBytes: number;
  maxRuntimeMs: number;
}

export interface AnalysisCompletion {
  leaseToken: string;
  rawJson: string;
  adapterVersion: string;
  conversationId: string | null;
  usage: {
    promptTokens: number | null; outputTokens: number | null; thinkingTokens: number | null;
    cachedTokens: number | null; totalTokens: number | null; runtimeMs: number;
  };
}

/** `ambiguous` means the provider may have executed the request; it is never resubmitted. */
export class AnalysisError extends Error {
  constructor(readonly code: string, readonly ambiguous: boolean, readonly retryAfterMs: number | null = null,
    readonly diagnostic: AnalysisDiagnostic | null = null) {
    super(code);
  }
}

/** Adapter revision recorded in provenance. Bump when the request/response mapping changes. */
export const ADAPTER_VERSION = "antigravity-oauth-api/3";
