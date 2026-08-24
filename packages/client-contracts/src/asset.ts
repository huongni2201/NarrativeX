export interface DesktopAsset {
  id: string;
  type: "AUDIO" | "IMAGE" | "VIDEO";
  origin: string;
  originalFilename: string;
  contentType: string;
  sizeBytes: number;
  status: string;
  createdAt: string;
  durationMs: number | null;
}

export interface DesktopPreset {
  name: string;
  description: string;
  thumbnail: string | null;
  tags: string[];
  category?: string;
}
