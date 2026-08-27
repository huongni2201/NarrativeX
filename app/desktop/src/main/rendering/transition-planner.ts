export interface TransitionPlanningBeat {
  visualBeatId: string;
  chapterId: string;
  sceneIndex: number;
  durationMs: number;
}

export interface BeatTransitionPlan {
  visualBeatId: string;
  transitionInMs: number;
  transitionOutMs: number;
  transitionType: "CUT" | "FADE_BLACK";
}

/**
 * Plans only duration-preserving transitions. Chapter boundaries use a short
 * fade-through-black that is compiled inside the adjacent segments, so the
 * global narration clock never changes and concat can remain stream-copy.
 * Regular beat/scene boundaries stay as CUT until a future xfade pipeline can
 * explicitly model overlapping timeline duration.
 */
export function planBeatTransitions(
  beats: readonly TransitionPlanningBeat[],
): BeatTransitionPlan[] {
  const plans: BeatTransitionPlan[] = beats.map((beat) => ({
    visualBeatId: beat.visualBeatId,
    transitionInMs: 0,
    transitionOutMs: 0,
    transitionType: "CUT",
  }));

  for (let index = 1; index < beats.length; index += 1) {
    const previous = beats[index - 1];
    const current = beats[index];
    if (previous.chapterId === current.chapterId) continue;

    const previousFadeMs = safeEdgeFade(previous.durationMs);
    const currentFadeMs = safeEdgeFade(current.durationMs);
    if (previousFadeMs <= 0 || currentFadeMs <= 0) continue;

    plans[index - 1] = {
      ...plans[index - 1],
      transitionOutMs: previousFadeMs,
      transitionType: "FADE_BLACK",
    };
    plans[index] = {
      ...plans[index],
      transitionInMs: currentFadeMs,
      transitionType: "FADE_BLACK",
    };
  }

  return plans;
}

function safeEdgeFade(durationMs: number): number {
  if (!Number.isFinite(durationMs) || durationMs < 600) return 0;
  return Math.max(80, Math.min(180, Math.floor(durationMs * 0.08)));
}
