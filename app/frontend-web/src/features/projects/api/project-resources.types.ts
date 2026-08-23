export interface ApiProjectLocation {
  id: string;
  name: string;
  description: string | null;
  visualPrompt: string | null;
  referenceImageUrl: string | null;
  status: string;
  updatedAt: string;
}

export interface ApiProjectAsset {
  id: string;
  name: string;
  assetType: string;
  storageKey: string;
  url: string | null;
  mimeType: string;
  status: string;
  metadataJson: string | null;
  updatedAt: string;
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null;
}

function isString(value: unknown): value is string {
  return typeof value === "string";
}

function isNullableString(value: unknown): value is string | null {
  return value === null || isString(value);
}

export function isApiProjectLocation(value: unknown): value is ApiProjectLocation {
  return (
    isRecord(value) &&
    isString(value.id) &&
    isString(value.name) &&
    isNullableString(value.description) &&
    isNullableString(value.visualPrompt) &&
    isNullableString(value.referenceImageUrl) &&
    isString(value.status) &&
    isString(value.updatedAt)
  );
}

export function isApiProjectAsset(value: unknown): value is ApiProjectAsset {
  return (
    isRecord(value) &&
    isString(value.id) &&
    isString(value.name) &&
    isString(value.assetType) &&
    isString(value.storageKey) &&
    isNullableString(value.url) &&
    isString(value.mimeType) &&
    isString(value.status) &&
    isNullableString(value.metadataJson) &&
    isString(value.updatedAt)
  );
}
