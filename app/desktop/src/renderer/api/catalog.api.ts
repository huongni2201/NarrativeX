import type { DesktopCharacter, DesktopPreset, DesktopVoice } from "@narrativex/client-contracts";
import { apiRequest } from "./client";
import { assertContract, isRecord, isString } from "./guards";

function isCharacter(value: unknown): value is DesktopCharacter { return isRecord(value) && isString(value.id) && isString(value.canonicalName); }
function isVoice(value: unknown): value is DesktopVoice { return isRecord(value) && isString(value.id) && isString(value.name) && isString(value.language); }
function isPreset(value: unknown): value is DesktopPreset { return isRecord(value) && isString(value.name) && isString(value.description) && (value.thumbnail === null || isString(value.thumbnail)) && Array.isArray(value.tags); }

export const catalogApi = {
  listCharacters: (projectId: string) => apiRequest<unknown>(`/api/v1/projects/${encodeURIComponent(projectId)}/characters?limit=100`).then((value) => { assertContract(isRecord(value) && Array.isArray(value.content) && value.content.every(isCharacter), "Characters response không đúng contract."); return { content: value.content, nextCursor: typeof value.nextCursor === "string" ? value.nextCursor : null }; }),
  createCharacter: (input: { canonicalName: string; aliases?: string[]; workspaceId?: string }) => apiRequest<DesktopCharacter>("/api/v1/characters", { method: "POST", body: JSON.stringify(input) }),
  assignCharacter: (projectId: string, input: { characterId: string; role: string; importance?: number; projectAliases?: string[] }) => apiRequest<{ id: string; characterId: string; projectId: string }>(`/api/v1/projects/${encodeURIComponent(projectId)}/characters`, { method: "POST", body: JSON.stringify({ ...input, importance: input.importance ?? 0, projectAliases: input.projectAliases ?? [], groups: [] }) }),
  listVoices: () => apiRequest<unknown>("/api/v1/voices").then((value) => { assertContract(Array.isArray(value) && value.every(isVoice), "Voices response không đúng contract."); return value; }),
  listPresets: () => Promise.all(["VISUAL_STYLE", "IMAGE", "MOTION", "OUTFIT", "RENDER"].map((category) => apiRequest<unknown>(`/api/v1/style-presets?category=${category}`).then((value) => { assertContract(Array.isArray(value) && value.every(isPreset), "Presets response không đúng contract."); return value.map((preset) => ({ ...preset, category })); }))).then((groups) => groups.flat()),
};
