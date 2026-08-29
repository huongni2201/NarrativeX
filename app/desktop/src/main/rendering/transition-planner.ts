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
 * Plans duration-preserving transitions only. Scene changes get a subtle
 * fade-through-black and chapter changes get a slightly stronger one. The fades
 * are compiled inside adjacent segments, so narration timing never changes and
 * final concat can remain deterministic.
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
    const chapterChanged = previous.chapterId !== current.chapterId;
    const sceneChanged = chapterChanged || previous.sceneIndex !== current.sceneIndex;
    if (!sceneChanged) continue;

    const fadeMs = chapterChanged
      ? Math.min(safeChapterFade(previous.durationMs), safeChapterFade(current.durationMs))
      : Math.min(safeSceneFade(previous.durationMs), safeSceneFade(current.durationMs));
    if (fadeMs <= 0) continue;

    plans[index - 1] = {
      ...plans[index - 1],
      transitionOutMs: fadeMs,
      transitionType: "FADE_BLACK",
    };
    plans[index] = {
      ...plans[index],
      transitionInMs: fadeMs,
      transitionType: "FADE_BLACK",
    };
  }

  return plans;
}

function safeChapterFade(durationMs: number): number {
  if (!Number.isFinite(durationMs) || durationMs < 600) return 0;
  return Math.max(100, Math.min(180, Math.floor(durationMs * 0.08)));
}

function safeSceneFade(durationMs: number): number {
  if (!Number.isFinite(durationMs) || durationMs < 600) return 0;
  return Math.max(100, Math.min(140, Math.floor(durationMs * 0.03)));
}
