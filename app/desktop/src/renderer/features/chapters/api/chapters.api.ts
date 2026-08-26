import type {
  CreateChapterInput,
  CursorPage,
  DesktopChapterDetails,
  UpdateChapterInput,
} from "@narrativex/client-contracts";
import { apiCommand, apiRequest } from "../../../api/client";
import { isNumber, isRecord, isString } from "../../../api/guards";
import { parseCursorPage } from "../../../api/pagination";
import { parseChapterWorkspace } from "./chapter-workspace-contract";

export { parseChapterWorkspace } from "./chapter-workspace-contract";

export type ChaptersPage = CursorPage<DesktopChapterDetails>;

const CHAPTER_PAGE_LIMIT = 100;

function isChapter(value: unknown): value is DesktopChapterDetails {
  return (
    isRecord(value) &&
    isString(value.id) &&
    isString(value.storyVersionId) &&
    isNumber(value.orderIndex) &&
    isString(value.title) &&
    isString(value.sourceText) &&
    isString(value.sourceHash) &&
    isNumber(value.rowVersion)
  );
}

function parseChapters(value: unknown): ChaptersPage {
  return parseCursorPage(
    value,
    isChapter,
    "Chapters response không đúng contract.",
  );
}

async function listPage(
  projectId: string,
  storyVersionId: string,
  cursor?: string | null,
): Promise<ChaptersPage> {
  const params = new URLSearchParams({
    storyVersionId,
    limit: String(CHAPTER_PAGE_LIMIT),
  });
  if (cursor) params.set("cursor", cursor);

  return apiRequest<unknown>(
    `/api/v1/projects/${encodeURIComponent(projectId)}/chapters?${params.toString()}`,
  ).then(parseChapters);
}

async function listAll(projectId: string, storyVersionId: string): Promise<DesktopChapterDetails[]> {
  const chapters: DesktopChapterDetails[] = [];
  const seenCursors = new Set<string>();
  let cursor: string | null = null;

  do {
    const page = await listPage(projectId, storyVersionId, cursor);
    chapters.push(...page.content);
    if (!page.hasNext || !page.nextCursor) break;
    if (seenCursors.has(page.nextCursor)) {
      throw new Error("Chapters pagination returned a repeated cursor.");
    }
    seenCursors.add(page.nextCursor);
    cursor = page.nextCursor;
  } while (true);

  return chapters;
}

export const chaptersApi = {
  list: listPage,
  listAll,

  get: (projectId: string, chapterId: string) =>
    apiRequest<DesktopChapterDetails>(
      `/api/v1/projects/${encodeURIComponent(projectId)}/chapters/${encodeURIComponent(chapterId)}`,
    ),

  workspace: (projectId: string, chapterId: string) =>
    apiRequest<unknown>(
      `/api/v1/projects/${encodeURIComponent(projectId)}/chapters/${encodeURIComponent(chapterId)}/workspace`,
    ).then(parseChapterWorkspace),

  create: (projectId: string, input: CreateChapterInput) =>
    apiRequest<DesktopChapterDetails>(
      `/api/v1/projects/${encodeURIComponent(projectId)}/chapters`,
      {
        method: "POST",
        headers: { "Idempotency-Key": crypto.randomUUID() },
        body: JSON.stringify(input),
      },
    ),

  update: (projectId: string, chapterId: string, input: UpdateChapterInput) =>
    apiRequest<DesktopChapterDetails>(
      `/api/v1/projects/${encodeURIComponent(projectId)}/chapters/${encodeURIComponent(chapterId)}`,
      {
        method: "PUT",
        headers: { "If-Match": `"${input.rowVersion}"` },
        body: JSON.stringify({ title: input.title, sourceText: input.sourceText }),
      },
    ),

  remove: (projectId: string, chapterId: string) =>
    apiCommand(
      `/api/v1/projects/${encodeURIComponent(projectId)}/chapters/${encodeURIComponent(chapterId)}`,
      { method: "DELETE" },
    ),
};