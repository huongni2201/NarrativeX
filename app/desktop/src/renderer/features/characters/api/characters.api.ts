import type {
  CursorPage,
  DesktopCharacter,
  DesktopCharacterDetail,
  DesktopCharacterVersionReference,
} from "@narrativex/client-contracts";
import { apiRequest } from "../../../api/client";
import { assertContract, isNumber, isRecord, isString } from "../../../api/guards";
import { collectCursorPages, parseCursorPage } from "../../../api/pagination";

const CHARACTER_PAGE_LIMIT = 100;

type CharactersPage = CursorPage<DesktopCharacter>;

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
