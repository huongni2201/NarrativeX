export interface DesktopVoice {
  id: string;
  provider: string;
  name: string;
  language: string;
  gender: string | null;
  sampleUrl: string | null;
}

export type ExecutionPreference = "AUTO" | "CLOUD" | "LOCAL";
export type VoiceReferenceScope = "PROJECT" | "ACCOUNT";

export interface VoiceReferenceInput {
  scope: VoiceReferenceScope;
  assetId: string;
}

export interface GenerateNarrationInput {
  chapterId: string;
  voiceId: string;
  speakingRate?: number;
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
  voiceReference: VoiceReferenceInput;
}

export interface VoicePreviewResult {
  url: string;
  expiresAt: string;
  contentType: string;
  durationMs: number;
}
