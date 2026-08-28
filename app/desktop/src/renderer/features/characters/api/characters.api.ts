import type {
  CursorPage,
  DesktopCharacter,
  DesktopCharacterDetail,
  DesktopCharacterVersion,
  DesktopCharacterVersionReference,
} from "@narrativex/client-contracts";
import { apiRequest } from "../../../api/client";
import { assertContract, isNumber, isRecord, isString } from "../../../api/guards";
import { collectCursorPages, parseCursorPage } from "../../../api/pagination";

const CHARACTER_PAGE_LIMIT = 100;

type CharactersPage = CursorPage<DesktopCharacter>;

export interface CharacterVersionMutationResult extends DesktopCharacterVersion {
  id: string;
  characterId: string;
  versionNumber: number;
  status: string;
  bible: string;
  visualPrompt: string;
  lockedAt: string | null;
  lockedBy: string | null;
}

function isCharacter(value: unknown): value is DesktopCharacter {
  return isRecord(value) && isString(value.id) && isString(value.canonicalName);
}

function isCharacterVersionReference(value: unknown): value is DesktopCharacterVersionReference {
  return (
    isRecord(value) &&
    isString(value.assetId) &&
    isString(value.role) &&
    isNumber(value.priority)
  );
}

function parseCharacterVersionReferences(value: unknown) {
  assertContract(
    Array.isArray(value) && value.every(isCharacterVersionReference),
    "Character references response không đúng contract.",
  );
  return value;
}

async function listPage(
  projectId: string,
  cursor: string | null = null,
): Promise<CharactersPage> {
  const params = new URLSearchParams({ limit: String(CHARACTER_PAGE_LIMIT) });
  if (cursor) params.set("cursor", cursor);

  return apiRequest<unknown>(
    `/api/v1/projects/${encodeURIComponent(projectId)}/characters?${params.toString()}`,
  ).then((value) =>
    parseCursorPage(
      value,
      isCharacter,
      "Characters response không đúng contract.",
    ),
  );
}

async function listAll(projectId: string): Promise<DesktopCharacter[]> {
  const pages = await collectCursorPages<CharactersPage>(
    (cursor) => listPage(projectId, cursor),
    "Characters pagination returned a repeated cursor.",
  );
  return pages.flatMap((page) => page.content);
}

export const charactersApi = {
  list: listPage,
  listAll,

  detail: (projectId: string, characterId: string) =>
    apiRequest<DesktopCharacterDetail>(
      `/api/v1/projects/${encodeURIComponent(projectId)}/characters/${encodeURIComponent(characterId)}`,
    ),

  versionReferences: (characterId: string, versionId: string) =>
    apiRequest<unknown>(
      `/api/v1/characters/${encodeURIComponent(characterId)}/versions/${encodeURIComponent(versionId)}/references`,
    ).then(parseCharacterVersionReferences),

  setVersionReferences: (
    characterId: string,
    versionId: string,
    references: DesktopCharacterVersionReference[],
  ) =>
    apiRequest<unknown>(
      `/api/v1/characters/${encodeURIComponent(characterId)}/versions/${encodeURIComponent(versionId)}/references`,
      {
        method: "PUT",
        body: JSON.stringify({ references }),
      },
    ).then(parseCharacterVersionReferences),

  createVersion: (characterId: string, input: { bible: string; visualPrompt: string }) =>
    apiRequest<CharacterVersionMutationResult>(
      `/api/v1/characters/${encodeURIComponent(characterId)}/versions`,
      {
        method: "POST",
        body: JSON.stringify(input),
      },
    ),

  reviewVersion: (characterId: string, versionId: string) =>
    apiRequest<CharacterVersionMutationResult>(
      `/api/v1/characters/${encodeURIComponent(characterId)}/versions/${encodeURIComponent(versionId)}/review`,
      { method: "POST" },
    ),

  lockVersion: (characterId: string, versionId: string) =>
    apiRequest<CharacterVersionMutationResult>(
      `/api/v1/characters/${encodeURIComponent(characterId)}/versions/${encodeURIComponent(versionId)}/lock`,
      { method: "POST" },
    ),

  pinVersion: (projectId: string, characterId: string, versionId: string) =>
    apiRequest<DesktopCharacterDetail>(
      `/api/v1/projects/${encodeURIComponent(projectId)}/characters/${encodeURIComponent(characterId)}/pinned-version`,
      {
        method: "PUT",
        body: JSON.stringify({ versionId }),
      },
    ),

  create: (input: {
    canonicalName: string;
    aliases?: string[];
    workspaceId?: string;
  }) =>
    apiRequest<DesktopCharacter>("/api/v1/characters", {
      method: "POST",
      body: JSON.stringify(input),
    }),

  assign: (
    projectId: string,
    input: {
      characterId: string;
      role: string;
      importance?: number;
      projectAliases?: string[];
    },
  ) =>
    apiRequest<{ id: string; characterId: string; projectId: string }>(
      `/api/v1/projects/${encodeURIComponent(projectId)}/characters`,
      {
        method: "POST",
        body: JSON.stringify({
          ...input,
          importance: input.importance ?? 0,
          projectAliases: input.projectAliases ?? [],
          groups: [],
        }),
      },
    ),
};
