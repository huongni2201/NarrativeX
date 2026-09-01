# Visual beat hard 10-second density plan

## Goal

Prevent a Chapter with narration from being considered production-ready with an under-dense storyboard such as 10 minutes / 28 visual beats, while preserving concurrent narration and Chapter analysis.

## Contract

- Preferred visual beat cadence: 7.5 seconds.
- Hard maximum exact aligned duration: 10 seconds per visual beat.
- Hard planning floor: `ceil(planningDurationMs / 10_000)` beats.
- Narration generation and Chapter analysis remain independent and may run concurrently.
- When a narration asset already exists for the same Chapter/source snapshot at storyboard materialization time, use its actual duration for the planning floor.
- Otherwise use a conservative 100 WPM source-text duration estimate instead of the previous 140 WPM/adaptive long-form cadence.
- An analysis result below that planning floor is rejected before storyboard revision activation.
- After authoritative narration alignment exists, any mapped beat longer than 10 seconds invalidates the exact aligned clock so production render readiness remains fail-closed.
- If analysis wins the race and actual narration later proves slower than the conservative estimate, the current change does not automatically regenerate the storyboard; re-analysis after narration is ready will use actual duration. Automatic post-narration densification is a separate follow-up if required.

## TDD coverage

1. 10-minute narration policy -> target 80, minimum 60.
2. 28 beats / 10 minutes -> rejected by density admission.
3. Conservative pre-narration estimate -> 100 WPM.
4. Existing narration asset duration -> preferred over estimate at storyboard materialization.
5. Exact narration alignment containing any beat over 10 seconds -> rejected by the clock mapper.
6. Existing source-anchor and materialization behavior remains intact.
