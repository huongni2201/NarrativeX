import type { CreateChapterInput, DesktopChapterDetails, UpdateChapterInput } from "@narrativex/client-contracts";
import { apiRequest } from "./client";
import { assertContract, isNumber, isRecord, isString } from "./guards";

export interface ChaptersPage { content: DesktopChapterDetails[]; nextCursor: string | null; }

function isChapter(value: unknown): value is DesktopChapterDetails {
  return isRecord(value) && isString(value.id) && isString(value.storyVersionId) && isNumber(value.orderIndex)
    && isString(value.title) && isString(value.sourceHash) && isNumber(value.rowVersion);
}

function parseChapters(value: unknown): ChaptersPage {
  assertContract(isRecord(value) && Array.isArray(value.content), "Chapters response không đúng contract.");
  assertContract(value.content.every(isChapter), "Chapters response chứa chapter không hợp lệ.");
  return { content: value.content, nextCursor: typeof value.nextCursor === "string" ? value.nextCursor : null };
}

export const chaptersApi = {
  list: (projectId: string, storyVersionId: string) => apiRequest<unknown>(`/api/v1/projects/${encodeURIComponent(projectId)}/chapters?storyVersionId=${encodeURIComponent(storyVersionId)}&limit=100`).then(parseChapters),
  get: (projectId: string, chapterId: string) => apiRequest<DesktopChapterDetails>(`/api/v1/projects/${encodeURIComponent(projectId)}/chapters/${encodeURIComponent(chapterId)}`),
  create: (projectId: string, input: CreateChapterInput) => apiRequest<DesktopChapterDetails>(`/api/v1/projects/${encodeURIComponent(projectId)}/chapters`, { method: "POST", headers: { "Idempotency-Key": crypto.randomUUID() }, body: JSON.stringify(input) }),
  update: (projectId: string, chapterId: string, input: UpdateChapterInput) => apiRequest<DesktopChapterDetails>(`/api/v1/projects/${encodeURIComponent(projectId)}/chapters/${encodeURIComponent(chapterId)}`, { method: "PUT", headers: { "If-Match": `"${input.rowVersion}"` }, body: JSON.stringify({ title: input.title, sourceText: input.sourceText }) }),
  remove: (projectId: string, chapterId: string) => apiRequest<void>(`/api/v1/projects/${encodeURIComponent(projectId)}/chapters/${encodeURIComponent(chapterId)}`, { method: "DELETE" }),
};
