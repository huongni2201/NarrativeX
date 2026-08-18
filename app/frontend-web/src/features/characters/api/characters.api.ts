import { apiRequest } from "@/shared/api/client";
import type { CursorPage } from "@/types/api";
import { isCursorPage } from "@/types/api";

const DEFAULT_CHARACTER_PAGE_SIZE = 20;

export type ApiCharacterStatus = "ACTIVE" | "ARCHIVED";

export interface ApiCharacterSummary {
  id: number;
  workspaceId: string | null;
  canonicalName: string;
  aliases: string[];
  status: ApiCharacterStatus;
  rowVersion: number;
}

export interface CharacterListParams {
  cursor?: string;
  limit?: number;
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null;
}

function isApiCharacterSummary(value: unknown): value is ApiCharacterSummary {
  return (
    isRecord(value) &&
    typeof value.id === "number" &&
    (value.workspaceId === null || typeof value.workspaceId === "string") &&
    typeof value.canonicalName === "string" &&
    Array.isArray(value.aliases) &&
    value.aliases.every((alias) => typeof alias === "string") &&
    (value.status === "ACTIVE" || value.status === "ARCHIVED") &&
    typeof value.rowVersion === "number"
  );
}

function characterListPath({
  cursor,
  limit = DEFAULT_CHARACTER_PAGE_SIZE,
}: CharacterListParams = {}): string {
  const params = new URLSearchParams({ limit: String(limit) });
  if (cursor) params.set("cursor", cursor);
  return `/api/v1/characters?${params.toString()}`;
}

export const charactersApi = {
  list: (params: CharacterListParams = {}) =>
    apiRequest<CursorPage<ApiCharacterSummary>>(
      characterListPath(params),
      {},
      (value): value is CursorPage<ApiCharacterSummary> =>
        isCursorPage(value, isApiCharacterSummary),
    ),
};
