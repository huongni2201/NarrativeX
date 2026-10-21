import { DesktopApiError } from "../api/client.ts";

/** Cancellation stops unsent writes; the in-flight outcome must still be recorded. */
export async function runReviewBatch<T extends { id: string }>(
  items: readonly T[],
  write: (item: T) => Promise<unknown>,
  onProgress?: (completed: number) => void,
  signal?: AbortSignal,
) {
  const succeeded: string[] = [];
  const failed: Array<{ id: string; message: string }> = [];
  let stopReason: "cancelled" | "unavailable" | null = null;
  let next = 0;
  for (; next < items.length; next++) {
    if (signal?.aborted) { stopReason = "cancelled"; break; }
    const item = items[next];
    try {
      await write(item);
      succeeded.push(item.id);
    } catch (error) {
      failed.push({ id: item.id, message: error instanceof Error ? error.message : "Không lưu được mục này." });
      // Only item-specific validation/conflict errors are safe to continue past.
      if (!(error instanceof DesktopApiError) || ![400, 404, 409, 422].includes(error.status)) {
        stopReason = "unavailable";
      }
    }
    onProgress?.(succeeded.length + failed.length);
    if (stopReason) { next++; break; }
  }
  return { succeeded, failed, unattempted: items.slice(next).map((item) => item.id), stopReason };
}
