export interface ClaimSessionState {
  claimEpoch: number;
  currentEpoch: number;
  claimedDeviceId: string;
  currentDeviceId: string | null;
  claimedUserId: string;
  currentUserId: string | null;
  online: boolean;
}

export function claimSessionIsCurrent(state: ClaimSessionState): boolean {
  return (
    state.currentEpoch === state.claimEpoch &&
    state.currentDeviceId === state.claimedDeviceId &&
    state.currentUserId === state.claimedUserId &&
    state.online
  );
}

export function heartbeatRetryDelayMs(
  attempt: number,
  heartbeatIntervalMs: number,
  randomValue = Math.random(),
): number {
  const baseDelay = Math.max(1, Math.min(heartbeatIntervalMs, 1_000));
  const exponent = Math.min(Math.max(0, attempt), 6);
  const cappedDelay = Math.min(30_000, baseDelay * 2 ** exponent);
  const normalizedRandom = Math.max(0, Math.min(1, randomValue));
  const jitter = 0.8 + normalizedRandom * 0.4;
  return Math.max(1, Math.round(cappedDelay * jitter));
}
