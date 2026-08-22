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
  supportsSpeakingRate?: boolean;
  supportsVoiceClone?: boolean;
  supportsBatch?: boolean;
  sampleRateHz?: number;
  executionSemantics?: "LOCAL_RETRYABLE" | "EXTERNAL_DURABLE" | string;
}

export const PRESET_VOICES: VoiceOption[] = [
  {
    id: "vi-VN-Standard-A",
    name: "Mai Anh (Nữ - Truyền cảm)",
    language: "vi-VN",
    gender: "FEMALE",
    style: "Standard",
    description: "Giọng đọc nữ miền Bắc nhẹ nhàng, phù hợp văn xuôi, tản văn, tự sự.",
    supportsSpeakingRate: true,
  },
  {
    id: "vi-VN-Standard-B",
    name: "Minh Quân (Nam - Trầm ấm)",
    language: "vi-VN",
    gender: "MALE",
    style: "Standard",
    description: "Giọng đọc nam miền Bắc trầm hùng, phù hợp truyện kiếm hiệp, lịch sử, kỳ ảo.",
    supportsSpeakingRate: true,
  },
  {
    id: "vi-VN-Standard-C",
    name: "Thảo Vy (Nữ - Ngọt ngào)",
    language: "vi-VN",
    gender: "FEMALE",
    style: "Standard",
    description: "Giọng đọc nữ miền Nam tự nhiên, phù hợp truyện ngôn tình, hiện đại.",
    supportsSpeakingRate: true,
  },
  {
    id: "vi-VN-Standard-D",
    name: "Hùng Dũng (Nam - Quyền lực)",
    language: "vi-VN",
    gender: "MALE",
    style: "Standard",
    description: "Giọng đọc nam miền Nam rõ ràng, phù hợp trinh thám, hành động.",
    supportsSpeakingRate: true,
  },
  {
    id: "vi-VN-Neural2-A",
    name: "Ánh Dương (Nữ - Neural HD)",
    language: "vi-VN",
    gender: "FEMALE",
    style: "Neural",
    description: "Công nghệ Neural biểu cảm cao, ngắt nghỉ theo ngữ cảnh tự nhiên.",
    supportsSpeakingRate: true,
  },
  {
    id: "en-US-Standard-C",
    name: "Emma (Female - US Narration)",
    language: "en-US",
    gender: "FEMALE",
    style: "Standard",
    description: "Clear and expressive US English female voice.",
    supportsSpeakingRate: true,
  },
  {
    id: "en-US-Standard-D",
    name: "James (Male - US Deep)",
    language: "en-US",
    gender: "MALE",
    style: "Standard",
    description: "Deep cinematic storytelling voice for English stories.",
    supportsSpeakingRate: true,
  },
];
