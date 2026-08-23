export interface GenerateNarrationInput {
  voiceId: string;
  speakingRate?: number;
  voiceReferenceAssetId?: string | null;
}

export interface GenerateBatchNarrationInput extends GenerateNarrationInput {
  chapterIds: number[];
}

export interface VoiceOption {
  id: string;
  name: string;
  language: string;
  gender: "FEMALE" | "MALE";
  style: "Standard" | "Neural" | "Wavenet" | "Studio";
  description: string;
  provider?: string;
  sampleUrl?: string | null;
  supportsSpeakingRate?: boolean;
  supportsVoiceClone?: boolean;
  supportsBatch?: boolean;
  sampleRateHz?: number;
  executionSemantics?: "LOCAL_RETRYABLE" | "EXTERNAL_DURABLE" | string;
}

export const PRESET_VOICES: VoiceOption[] = [
  {
    id: "vieneu-ngoc-huyen-v2",
    name: "Ngọc Huyền v2",
    language: "vi-VN",
    gender: "FEMALE",
    style: "Standard",
    description: "Voice reference profile của hệ thống VieNeu.",
    provider: "VIENEU",
  },
  {
    id: "vieneu-ngoc-huyen",
    name: "Ngọc Huyền",
    language: "vi-VN",
    gender: "FEMALE",
    style: "Standard",
    description: "Preset VieNeu miền Bắc, tự nhiên.",
    provider: "VIENEU",
  },
  {
    id: "vieneu-thanh-binh",
    name: "Thanh Bình",
    language: "vi-VN",
    gender: "MALE",
    style: "Standard",
    description: "Preset VieNeu miền Bắc, kể chuyện.",
    provider: "VIENEU",
  },
  {
    id: "vieneu-ngoc-linh",
    name: "Ngọc Linh",
    language: "vi-VN",
    gender: "FEMALE",
    style: "Standard",
    description: "Preset VieNeu miền Bắc, kể chuyện.",
    provider: "VIENEU",
  },
  {
    id: "vieneu-kim-thanh",
    name: "Kim Thanh",
    language: "vi-VN",
    gender: "FEMALE",
    style: "Neural",
    description: "Preset VieNeu miền Nam, audiobook.",
    provider: "VIENEU",
  },
];
