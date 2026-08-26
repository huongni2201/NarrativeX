export interface DesktopVoice {
  id: string;
  provider: string;
  name: string;
  language: string;
  gender: string | null;
  sampleUrl: string | null;
}

export type ExecutionPreference = "AUTO" | "CLOUD" | "LOCAL";

export interface GenerateNarrationInput {
  chapterId: string;
  voiceId: string;
  speakingRate?: number;
  voiceReferenceAssetId?: string;
  executionPreference?: ExecutionPreference;
}

export interface GenerateBatchNarrationInput {
  projectId: string;
  chapterIds: string[];
  voiceId: string;
  speakingRate?: number;
  voiceReferenceAssetId?: string;
  executionPreference?: ExecutionPreference;
}

export interface GenerateVoicePreviewInput {
  chapterId: string;
  voiceId: string;
  sampleText: string;
  speakingRate?: number;
  voiceReferenceAssetId: string;
}

export interface VoicePreviewResult {
  url: string;
  expiresAt: string;
  contentType: string;
  durationMs: number;
}
