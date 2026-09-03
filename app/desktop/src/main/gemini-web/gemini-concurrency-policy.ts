const RECOVERY_SUCCESSES = 3;

export class GeminiAdaptiveConcurrency {
  private effective = 1;
  private stableSuccesses = 0;
  private initialized = false;

  capacity(configured: number): number {
    const safeConfigured = Math.max(1, Math.floor(configured));
    if (!this.initialized) {
      this.effective = safeConfigured;
      this.initialized = true;
    } else {
      this.effective = Math.min(this.effective, safeConfigured);
    }
    return Math.max(1, this.effective);
  }

  recordSuccess(configured: number): void {
    const safeConfigured = Math.max(1, Math.floor(configured));
    this.stableSuccesses += 1;
    if (this.stableSuccesses >= RECOVERY_SUCCESSES && this.effective < safeConfigured) {
      this.effective += 1;
      this.stableSuccesses = 0;
    }
  }

  recordFailure(error: unknown): void {
    if (!isCapacityPressure(error)) return;
    this.effective = Math.max(1, this.effective - 1);
    this.stableSuccesses = 0;
  }
}

export function isCapacityPressure(error: unknown): boolean {
  const message = error instanceof Error ? `${error.name} ${error.message}` : String(error ?? "");
  return /quota|rate.?limit|too many requests|resource exhausted|timeout|timed out|429/i.test(message);
}
