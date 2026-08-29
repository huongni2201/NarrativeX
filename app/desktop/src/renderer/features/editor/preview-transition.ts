export function transitionBlackOpacity(
  beat: { startMs: number; endMs: number },
  plan: { transitionInMs: number; transitionOutMs: number },
  playheadMs: number,
): number {
  if (playheadMs < beat.startMs || playheadMs > beat.endMs) return 0;

  if (plan.transitionInMs > 0 && playheadMs <= beat.startMs + plan.transitionInMs) {
    const progress = (playheadMs - beat.startMs) / plan.transitionInMs;
    return clamp01(1 - progress);
  }

  if (plan.transitionOutMs > 0 && playheadMs >= beat.endMs - plan.transitionOutMs) {
    const progress = (playheadMs - (beat.endMs - plan.transitionOutMs)) / plan.transitionOutMs;
    return clamp01(progress);
  }

  return 0;
}

function clamp01(value: number): number {
  return Math.max(0, Math.min(1, value));
}
