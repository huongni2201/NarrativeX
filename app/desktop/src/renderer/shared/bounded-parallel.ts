export async function runBoundedParallel<T>(
  items: readonly T[],
  concurrency: number,
  worker: (item: T, index: number) => Promise<void>,
  shouldContinue: () => boolean = () => true,
): Promise<void> {
  if (!items.length) return;
  const capacity = Math.max(1, Math.min(items.length, Math.floor(concurrency) || 1));
  let nextIndex = 0;

  async function runWorker(): Promise<void> {
    while (shouldContinue()) {
      const index = nextIndex;
      if (index >= items.length) return;
      nextIndex += 1;
      await worker(items[index], index);
    }
  }

  await Promise.all(Array.from({ length: capacity }, () => runWorker()));
}
