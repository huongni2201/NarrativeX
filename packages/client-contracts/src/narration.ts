export interface DesktopVoice {
  id: string;
  provider: string;
  name: string;
  language: string;
  gender: string | null;
  sampleUrl: string | null;
}

export type ExecutionPreference = "AUTO" | "CLOUD" | "LOCAL";
