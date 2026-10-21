import type { AnalysisDiagnostic } from "../../shared/story-analysis.ts";

export interface AnalysisClaim {
  jobId: string;
  projectId: string;
  attemptId: string;
  leaseToken: string;
  /** The chapter as numbered pieces; the model names positions by `index` instead of copying text. */
  sourceUnits: Array<{ index: number; text: string }>;
  sourceLanguage: string;
  promptTemplate: string;
  responseSchema: Record<string, unknown>;
  stageContracts?: AnalysisStageContracts | null;
  profile: { model: string; effort: "LOW" | "MEDIUM" | "HIGH"; promptHash: string; schemaHash: string };
  maxInputBytes: number;
  maxOutputBytes: number;
  maxRuntimeMs: number;
}

export type AnalysisStage = "CANON" | "STORY";

export interface AnalysisStageContract {
  promptTemplate: string;
  responseSchema: Record<string, unknown>;
  promptHash: string;
  schemaHash: string;
}

export interface AnalysisStageContracts {
  CANON: AnalysisStageContract;
  STORY: AnalysisStageContract;
}

export interface AnalysisStageValidationContext {
  stage: AnalysisStage;
  canonContext?: { characters: Array<Record<string, unknown>>; locations: Array<Record<string, unknown>> };
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

/** A finding of the backend's check of a result: an ERROR blocks it, a WARNING is only worth improving. */
export interface Violation { severity: "ERROR" | "WARNING"; path: string; message: string }

/** `ambiguous` means the provider may have executed the request; it is never resubmitted. */
export class AnalysisError extends Error {
  constructor(readonly code: string, readonly ambiguous: boolean, readonly retryAfterMs: number | null = null,
    readonly diagnostic: AnalysisDiagnostic | null = null) {
    super(code);
  }
}

export class AnalysisBackendError extends Error {
  constructor(readonly status: number) { super(`Analysis backend returned ${status}`); }
}

/** Adapter revision recorded in provenance. Version 3 adds the frozen CANON → STORY execution contract. */
export const ADAPTER_VERSION = "antigravity-cli/3";
