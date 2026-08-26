import type { CursorPage, DesktopCharacter } from "@narrativex/client-contracts";
import { apiRequest } from "../../../api/client";
import { isRecord, isString } from "../../../api/guards";
import { parseCursorPage } from "../../../api/pagination";

const CHARACTER_PAGE_LIMIT = 100;

function isCharacter(value: unknown): value is DesktopCharacter {
  return isRecord(value) && isString(value.id) && isString(value.canonicalName);
}

async function listPage(
  projectId: string,
  cursor?: string | null,
): Promise<CursorPage<DesktopCharacter>> {
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
  const characters: DesktopCharacter[] = [];
  const seenCursors = new Set<string>();
  let cursor: string | null = null;

  do {
    const page = await listPage(projectId, cursor);
    characters.push(...page.content);
    if (!page.hasNext || !page.nextCursor) break;
    if (seenCursors.has(page.nextCursor)) {
      throw new Error("Characters pagination returned a repeated cursor.");
    }
    seenCursors.add(page.nextCursor);
    cursor = page.nextCursor;
  } while (true);

  return characters;
}

export const charactersApi = {
  list: listPage,
  listAll,

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