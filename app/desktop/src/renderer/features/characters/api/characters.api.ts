import type { CursorPage, DesktopCharacter } from "@narrativex/client-contracts";
import { apiRequest } from "../../../api/client";
import { isRecord, isString } from "../../../api/guards";
import { parseCursorPage } from "../../../api/pagination";

function isCharacter(value: unknown): value is DesktopCharacter {
  return isRecord(value) && isString(value.id) && isString(value.canonicalName);
}

export const charactersApi = {
  list: (projectId: string): Promise<CursorPage<DesktopCharacter>> =>
    apiRequest<unknown>(
      `/api/v1/projects/${encodeURIComponent(projectId)}/characters?limit=100`,
    ).then((value) =>
      parseCursorPage(
        value,
        isCharacter,
        "Characters response không đúng contract.",
      ),
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
