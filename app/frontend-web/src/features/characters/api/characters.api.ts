import { apiRequest } from "@/shared/api/client";
import type { CursorPage } from "@/types/api";
import { isCursorPage } from "@/types/api";

const DEFAULT_CHARACTER_PAGE_SIZE = 20;

export type ApiCharacterStatus = "ACTIVE" | "ARCHIVED";
export type ApiCharacterReferenceRole =
  | "IDENTITY"
  | "PROFILE"
  | "EXPRESSION"
  | "OUTFIT"
  | "POSE";

export interface ApiCharacterVersionReference {
  assetId: string;
  role: ApiCharacterReferenceRole;
  priority: number;
}

export interface ApiCharacterSummary {
  id: number;
  workspaceId: string | null;
  canonicalName: string;
  aliases: string[];
  status: ApiCharacterStatus;
  rowVersion: number;
}

export interface ApiProjectCharacterSummary {
  id: number;
  assignmentId: number;
  projectId: number;
  workspaceId: string | null;
  canonicalName: string;
  aliases: string[];
  projectAliases: string[];
  role: string;
  importance: number;
  groups: string[];
  pinnedCharacterVersionId: number | null;
  status: string;
  sceneCount: number;
  rowVersion: number;
  createdAt: string;
  updatedAt: string;
}

export interface ApiProjectCharacterVersion {
  versionNumber: number | null;
  status: string | null;
  bible: string | null;
  visualPrompt: string | null;
  masterAssetId: number | null;
}

export interface ApiProjectCharacterAppearance {
  ageState: string | null;
  hairstyle: string | null;
  injury: string | null;
  wardrobeContext: string | null;
  appearancePrompt: string | null;
}

export interface ApiProjectCharacterDetail extends ApiProjectCharacterSummary {
  version: ApiProjectCharacterVersion | null;
  appearance: ApiProjectCharacterAppearance | null;
}

export interface CharacterListParams {
  cursor?: string;
  limit?: number;
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null;
}

function isStringArray(value: unknown): value is string[] {
  return Array.isArray(value) && value.every((item) => typeof item === "string");
}

function isNullableNumber(value: unknown): value is number | null {
  return value === null || typeof value === "number";
}

function isNullableString(value: unknown): value is string | null {
  return value === null || typeof value === "string";
}

function isReferenceRole(value: unknown): value is ApiCharacterReferenceRole {
  return (
    value === "IDENTITY" ||
    value === "PROFILE" ||
    value === "EXPRESSION" ||
    value === "OUTFIT" ||
    value === "POSE"
  );
}

function isApiCharacterVersionReference(value: unknown): value is ApiCharacterVersionReference {
  return (
    isRecord(value) &&
    typeof value.assetId === "string" &&
    value.assetId.length > 0 &&
    isReferenceRole(value.role) &&
    typeof value.priority === "number" &&
    Number.isSafeInteger(value.priority) &&
    value.priority >= 0 &&
    value.priority <= 99
  );
}

function isCharacterReferenceArray(value: unknown): value is ApiCharacterVersionReference[] {
  return Array.isArray(value) && value.every(isApiCharacterVersionReference);
}

function isApiCharacterSummary(value: unknown): value is ApiCharacterSummary {
  return (
    isRecord(value) &&
    typeof value.id === "number" &&
    (value.workspaceId === null || typeof value.workspaceId === "string") &&
    typeof value.canonicalName === "string" &&
    isStringArray(value.aliases) &&
    (value.status === "ACTIVE" || value.status === "ARCHIVED") &&
    typeof value.rowVersion === "number"
  );
}

function isApiProjectCharacterSummary(value: unknown): value is ApiProjectCharacterSummary {
  return (
    isRecord(value) &&
    typeof value.id === "number" &&
    typeof value.assignmentId === "number" &&
    typeof value.projectId === "number" &&
    (value.workspaceId === null || typeof value.workspaceId === "string") &&
    typeof value.canonicalName === "string" &&
    isStringArray(value.aliases) &&
    isStringArray(value.projectAliases) &&
    typeof value.role === "string" &&
    typeof value.importance === "number" &&
    isStringArray(value.groups) &&
    isNullableNumber(value.pinnedCharacterVersionId) &&
    typeof value.status === "string" &&
    typeof value.sceneCount === "number" &&
    typeof value.rowVersion === "number" &&
    typeof value.createdAt === "string" &&
    typeof value.updatedAt === "string"
  );
}

function isApiProjectCharacterVersion(value: unknown): value is ApiProjectCharacterVersion {
  return (
    isRecord(value) &&
    (value.versionNumber === null || typeof value.versionNumber === "number") &&
    isNullableString(value.status) &&
    isNullableString(value.bible) &&
    isNullableString(value.visualPrompt) &&
    isNullableNumber(value.masterAssetId)
  );
}

function isApiProjectCharacterAppearance(value: unknown): value is ApiProjectCharacterAppearance {
  return (
    isRecord(value) &&
    isNullableString(value.ageState) &&
    isNullableString(value.hairstyle) &&
    isNullableString(value.injury) &&
    isNullableString(value.wardrobeContext) &&
    isNullableString(value.appearancePrompt)
  );
}

function isApiProjectCharacterDetail(value: unknown): value is ApiProjectCharacterDetail {
  return (
    isApiProjectCharacterSummary(value) &&
    isRecord(value) &&
    (value.version === null || isApiProjectCharacterVersion(value.version)) &&
    (value.appearance === null || isApiProjectCharacterAppearance(value.appearance))
  );
}

function listPath(
  basePath: string,
  { cursor, limit = DEFAULT_CHARACTER_PAGE_SIZE }: CharacterListParams = {},
): string {
  const params = new URLSearchParams({ limit: String(limit) });
  if (cursor) params.set("cursor", cursor);
  return `${basePath}?${params.toString()}`;
}

function versionReferencesPath(characterId: number, versionId: number): string {
  return `/api/v1/characters/${encodeURIComponent(characterId)}/versions/${encodeURIComponent(versionId)}/references`;
}

export const charactersApi = {
  list: (params: CharacterListParams = {}) =>
    apiRequest<CursorPage<ApiCharacterSummary>>(
      listPath("/api/v1/characters", params),
      {},
      (value): value is CursorPage<ApiCharacterSummary> =>
        isCursorPage(value, isApiCharacterSummary),
    ),

  get: (characterId: number) =>
    apiRequest<ApiCharacterSummary>(
      `/api/v1/characters/${encodeURIComponent(characterId)}`,
      {},
      isApiCharacterSummary,
    ),

  count: () =>
    apiRequest<number>("/api/v1/characters/count", {}, (value): value is number => typeof value === "number" && Number.isSafeInteger(value) && value >= 0),

  listProject: (projectId: number, params: CharacterListParams = {}) =>
    apiRequest<CursorPage<ApiProjectCharacterSummary>>(
      listPath(`/api/v1/projects/${projectId}/characters`, params),
      {},
      (value): value is CursorPage<ApiProjectCharacterSummary> =>
        isCursorPage(value, isApiProjectCharacterSummary),
    ),

  getProjectDetail: (projectId: number, characterId: number) =>
    apiRequest<ApiProjectCharacterDetail>(
      `/api/v1/projects/${projectId}/characters/${characterId}`,
      {},
      isApiProjectCharacterDetail,
    ),

  getVersionReferences: (characterId: number, versionId: number) =>
    apiRequest<ApiCharacterVersionReference[]>(
      versionReferencesPath(characterId, versionId),
      {},
      isCharacterReferenceArray,
    ),

  setVersionReferences: (
    characterId: number,
    versionId: number,
    references: ApiCharacterVersionReference[],
  ) =>
    apiRequest<ApiCharacterVersionReference[]>(
      versionReferencesPath(characterId, versionId),
      {
        method: "PUT",
        json: { references },
      },
      isCharacterReferenceArray,
    ),
};
