export interface DesktopVoice {
  id: string;
  provider: string;
  name: string;
  language: string;
  gender: string | null;
  sampleUrl: string | null;
  /** Raw catalog metadata JSON (preset flags, custom reference binding). */
  metadataJson?: string | null;
}

type ExecutionPreference = "AUTO" | "CLOUD" | "LOCAL";
export type VoiceReferenceScope = "PROJECT" | "GLOBAL_LOCAL";

export interface CreateCustomVoiceInput {
  name: string;
  language?: string;
  gender?: "MALE" | "FEMALE" | "NEUTRAL";
  description?: string;
  referenceAssetId: string;
}

export interface VoiceReferenceInput {
  scope: VoiceReferenceScope;
  assetId: string;
}

export interface GenerateNarrationInput {
  chapterId: string;
  voiceId: string;
  speakingRate?: number;
  forceRegenerate?: boolean;
  voiceReference?: VoiceReferenceInput | null;
  executionPreference?: ExecutionPreference;
}

export interface GenerateBatchNarrationInput {
  projectId: string;
  chapterIds: string[];
  voiceId: string;
  speakingRate?: number;
  voiceReference?: VoiceReferenceInput | null;
  executionPreference?: ExecutionPreference;
}

export interface GenerateVoicePreviewInput {
  chapterId: string;
  voiceId: string;
  sampleText: string;
  speakingRate?: number;
  /** Omit to preview the catalog voice itself (preset name, or a custom voice's stored recording). */
  voiceReference?: VoiceReferenceInput | null;
}

export interface VoicePreviewResult {
  url: string;
  expiresAt: string;
  contentType: string;
  durationMs: number;
}
