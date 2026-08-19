# ADR-0009: Separate VisualBeat motion mode and camera movement

- Status: Accepted
- Date: 2026-08-19
- Decision owners: NarrativeX backend, worker and frontend maintainers

## Context

`VisualBeat` needs to describe both the render strategy and any camera movement. The legacy `motion_action` column mixed those responsibilities: values such as `PAN`, `PUSH_IN` and `TRACK` could not tell the runtime whether the beat was deterministic basic motion or AI-generated video. Some legacy seed values also did not match the backend enum, causing JPA hydration failures on the storyboard endpoint.

## Decision

Persist and expose two independent fields:

- `motionMode`: `STILL`, `BASIC_MOTION`, or `AI_VIDEO`.
- `cameraMovement`: `NONE`, `PAN`, `TILT`, `PUSH_IN`, `PULL_OUT`, `TRACK`, `ZOOM_IN`, `ZOOM_OUT`, or `PARALLAX`.

`reviewStatus` remains a separate review concern. Generation state is not duplicated on `VisualBeat`; it remains owned by `GenerationJob`/`StageAttempt`/`ProviderOperation`.

The consolidated Flyway V1 baseline includes `motion_mode` and `camera_movement`, enforces database checks, and does not include legacy `motion_action`. The worker writes the new columns directly, and the storyboard API returns both fields for frontend rendering.

## Consequences

- Runtime code can choose rendering strategy independently from camera direction.
- Database and API contracts reject unknown values instead of allowing JPA enum hydration to fail later.
- The MVP camera vocabulary stays compact; directional variants such as `PAN_LEFT`/`PAN_RIGHT` can be added only when a real UI/provider contract requires them.
- Fresh database installations apply both fields directly as part of the V1 baseline.
