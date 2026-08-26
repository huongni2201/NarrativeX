import type { CursorPage } from "@narrativex/client-contracts";
import { assertContract, isNumber, isRecord } from "./guards.ts";

export function parseCursorPage<T>(
  value: unknown,
  isItem: (candidate: unknown) => candidate is T,
  message: string,
): CursorPage<T> {
  assertContract(isRecord(value), message);

  const content = value.content;
  const nextCursor = value.nextCursor;
  const limit = value.limit;
  const hasNext = value.hasNext;

  assertContract(Array.isArray(content) && content.every(isItem), message);
  assertContract(nextCursor === null || typeof nextCursor === "string", message);
  assertContract(
    isNumber(limit) && Number.isInteger(limit) && limit >= 1 && limit <= 100,
    message,
  );
  assertContract(typeof hasNext === "boolean", message);
  assertContract(
    hasNext
      ? typeof nextCursor === "string" && nextCursor.length > 0
      : nextCursor === null,
    message,
  );

  return {
    content,
    nextCursor,
    limit,
    hasNext,
  };
}

export async function collectCursorPages<P extends CursorPage<unknown>>(
  loadPage: (cursor: string | null) => Promise<P>,
  repeatedCursorMessage: string,
): Promise<P[]> {
  const pages: P[] = [];
  const seenCursors = new Set<string>();
  let cursor: string | null = null;

  do {
    const page = await loadPage(cursor);
    pages.push(page);
    if (!page.hasNext) break;

    const nextCursor = page.nextCursor;
    if (!nextCursor) {
      throw new Error("Cursor page reported more data without a next cursor.");
    }
    if (seenCursors.has(nextCursor)) {
      throw new Error(repeatedCursorMessage);
    }
    seenCursors.add(nextCursor);
    cursor = nextCursor;
  } while (true);

  return pages;
}
