/**
 * Runs tasks with a fixed concurrency ceiling, preserving input order in the
 * results. Answer engines rate-limit aggressively and a run is 75+ requests, so
 * every fan-out in the product goes through this.
 */
export async function mapWithConcurrency<T, R>(
  items: readonly T[],
  limit: number,
  task: (item: T, index: number) => Promise<R>,
): Promise<R[]> {
  const results = new Array<R>(items.length);
  let cursor = 0;

  const workers = Array.from({ length: Math.max(1, Math.min(limit, items.length)) }, async () => {
    while (true) {
      const index = cursor++;
      if (index >= items.length) return;
      results[index] = await task(items[index], index);
    }
  });

  await Promise.all(workers);
  return results;
}

/**
 * Calls `task` once, and on failure calls it exactly one more time.
 *
 * Deliberately not a general backoff helper: the probe runner retries once and
 * then records nothing, because a missing measurement is honest and a fabricated
 * one is not.
 */
export async function retryOnce<T>(
  task: () => Promise<T>,
  onRetry?: (error: unknown) => void,
): Promise<T> {
  try {
    return await task();
  } catch (error) {
    onRetry?.(error);
    return task();
  }
}
