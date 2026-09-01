# Visual beat hard 10-second density plan

## Goal

Prevent a Chapter with narration from activating an under-dense storyboard such as 10 minutes / 28 visual beats.

## Contract

- Preferred visual beat cadence: 7.5 seconds.
- Hard planning floor: `ceil(actualNarrationDurationMs / 10_000)` beats.
- If a narration generation job for the same Chapter/source snapshot is active, Chapter analysis waits instead of claiming first.
- When a narration asset already exists for the same Chapter/source snapshot, Chapter analysis uses its actual duration instead of the 140 WPM estimate.
- If no narration job/asset exists, standalone Chapter analysis still uses source-text estimation.
- An analysis result below the hard floor is rejected before storyboard activation.
- Production render readiness must be false when exact aligned timing contains any beat longer than 10 seconds.

## TDD order

1. Add failing prompt/density tests for actual 10-minute narration -> target 80, minimum 60.
2. Add failing validation test for 28 beats / 10 minutes.
3. Add failing repository contract test proving active narration blocks analysis claim and completed narration duration is selected.
4. Implement shared density policy + request field.
5. Wire claim query and storyboard materialization validation.
6. Add backend exact-timing hard-max render gate.
7. Run AI-worker and backend verification.
