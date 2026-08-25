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
  assertContract(hasNext || nextCursor === null, message);

  return {
    content,
    nextCursor,
    limit,
    hasNext,
  };
}
