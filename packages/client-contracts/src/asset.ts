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
  storageMode?: "REMOTE" | "LOCAL_ONLY" | "PROJECT_LOCAL";
  storageKey?: string | null;
  sha256?: string;
}

/** Wire request for POST /api/v1/assets/local. Project-local media is always project-scoped. */
export interface RegisterLocalAssetRequest {
  projectId: string;
  type: "AUDIO" | "IMAGE" | "VIDEO";
  originalFilename: string;
  contentType: string;
  sizeBytes: number;
  checksumSha256: string;
  durationMs?: number | null;
}

/** Desktop-local registration context. assetId remains a client-side materialization identity. */
export interface LocalAssetRegistration extends RegisterLocalAssetRequest {
  assetId?: string;
}

export interface DesktopPreset {
  name: string;
  description: string;
  thumbnail: string | null;
  tags: string[];
  category?: string;
}
