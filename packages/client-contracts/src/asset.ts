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
  storageMode?: "REMOTE" | "LOCAL_ONLY" | "HYBRID";
  storageKey?: string | null;
  sha256?: string;
}

/** Wire request for POST /api/v1/assets/local. Mirrors RegisterLocalAssetRequest on backend. */
export interface RegisterLocalAssetRequest {
  type: "AUDIO" | "IMAGE" | "VIDEO";
  originalFilename: string;
  contentType: string;
  sizeBytes: number;
  checksumSha256: string;
  durationMs?: number | null;
}

/** Desktop-local registration context. projectId/assetId must never be sent to the backend DTO. */
export interface LocalAssetRegistration extends RegisterLocalAssetRequest {
  projectId: string;
  assetId?: string;
}

export interface LocalMaterializationStatus {
  assetId: string;
  state: "AVAILABLE" | "MISSING" | "CORRUPT";
  sizeBytes: number | null;
  checksumSha256: string | null;
  confirmedAt: string | null;
}

export interface DesktopPreset {
  name: string;
  description: string;
  thumbnail: string | null;
  tags: string[];
  category?: string;
}
