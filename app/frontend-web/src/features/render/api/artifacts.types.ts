export type RenderArtifactStatus = string;

export interface RenderArtifact {
  id: number;
  projectId: number;
  chapterId: number;
  artifactType: string;
  renderFingerprint: string;
  storageKey: string | null;
  mimeType: string | null;
  sizeBytes: number | null;
  checksumSha256: string | null;
  durationMs: number | null;
  width: number | null;
  height: number | null;
  status: RenderArtifactStatus;
  createdAt: string;
  updatedAt: string;
  previewAvailable: boolean;
  previewUrl: string | null;
  downloadAvailable: boolean;
  downloadUrl: string | null;
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null;
}

function isNullableString(value: unknown): value is string | null {
  return value === null || typeof value === "string";
}

function isNullableNumber(value: unknown): value is number | null {
  return value === null || (typeof value === "number" && Number.isFinite(value));
}

export function isRenderArtifact(value: unknown): value is RenderArtifact {
  return (
    isRecord(value) &&
    typeof value.id === "number" &&
    typeof value.projectId === "number" &&
    typeof value.chapterId === "number" &&
    typeof value.artifactType === "string" &&
    typeof value.renderFingerprint === "string" &&
    isNullableString(value.storageKey) &&
    isNullableString(value.mimeType) &&
    isNullableNumber(value.sizeBytes) &&
    isNullableString(value.checksumSha256) &&
    isNullableNumber(value.durationMs) &&
    isNullableNumber(value.width) &&
    isNullableNumber(value.height) &&
    typeof value.status === "string" &&
    typeof value.createdAt === "string" &&
    typeof value.updatedAt === "string" &&
    typeof value.previewAvailable === "boolean" &&
    isNullableString(value.previewUrl) &&
    typeof value.downloadAvailable === "boolean" &&
    isNullableString(value.downloadUrl)
  );
}

export type Artifact = RenderArtifact;
