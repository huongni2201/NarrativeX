# Domain Model

Owned by [ADR-0001](../decisions/ADR-0001-single-user-local-first.md), [ADR-0006](../decisions/ADR-0006-story-structure-and-source-anchoring.md) and [ADR-0008](../decisions/ADR-0008-video-first-shot-production.md). Status of each part lives in [current status](../current-status.md).

## Boundary

One installation serves one local user. `Project` is the highest business boundary. No entity carries `userId`, `accountId`, `ownerId` or a session, and no synthetic identity replaces them (ADR-0001). Provider credentials are runtime configuration, never application identity.

## Aggregates and hierarchy

```text
Project
 ├─ StoryVersion → Chapter → Scene → StoryBeat → { AudioCue[], VisualBeat[] }
 │                                                    VisualBeat → ShotSequence → Shot → Take → SelectedTake
 ├─ Character (reusable) ── ProjectCharacter ── CharacterVersion (immutable snapshot)
 ├─ ProjectLocation (Scene may link to one)
 └─ render snapshot → Desktop render (final MP4 stays local; the backend stores metadata only)
```

| Concept | Rule |
|---|---|
| **Chapter** | `sourceText` is immutable once saved. Workflows pin `chapterId`, story version and `sourceHash`. |
| **StoryBeat** | One coherent dramatic event. Owns ordered AudioCues (heard) and groups VisualBeats (seen). |
| **AudioCue** | Adaptation action `KEEP_EXACT`, `LIGHT_EDIT`, `COMPRESS` or `VISUAL_PRIMARY`. For `KEEP_EXACT` the backend derives text from source offsets and discards model-copied text. |
| **VisualBeat** | Carries dramatic intent and retention role. A row without a StoryBeat is a legacy compatibility path. |
| **Character** | Reusable identity. Appearance or outfit changes never create a new Character; `CharacterVersion` is the immutable snapshot. Context resolves only participating characters. |
| **Shot** | Atomic unit of generation, GPU admission, retry and technical validation. Describes a change between a start and an end state. |
| **Take** | One immutable generation attempt with a frozen input snapshot and fingerprint. Selectable only after terminal success, a positive source duration and a technical PASS. |
| **SelectedTake** | Binds one Take to its Shot with in/out points, an optimistic row version and the human content-review checklist. The timeline consumes SelectedTakes, never raw outputs. |

## Rules that cross aggregates

- Story text, prompts, references and provider output are untrusted. Validate schemas and enforce media-safety boundaries.
- Materialization of analysis output is all-or-nothing and fenced to the saved source revision (ADR-0006).
- Narration is the production master clock. Provisional or persisted estimates never make a render ready (ADR-0006, ADR-0007).
- Locked character versions, approved assets, provider snapshots and render snapshots are preserved, never rewritten by later edits.
- Capacity limits are non-monetary (`CAPACITY`, `LONGFORM_EXPORT`); there are no per-user quotas or billing (ADR-0001).
- Real-person references need explicit consent and restricted retention.

## Glossary

| Term | Meaning |
|---|---|
| Native AV | `LTX_NATIVE_AV`: the take carries its own synchronized audio. The only audio mode the active video profile admits. |
| Audio clock | The timeline authority for a chapter: observed narration or take audio, never a character-count estimate. |
| Capability gate | Admission fails closed unless the worker advertises the exact task type, schema, model revision and workflow profile. |
| UNKNOWN | An external outcome that could not be confirmed. It is reconciled, never blindly resubmitted (ADR-0003). |
| IMAGE_MOTION | Legacy production mode. Projects stay readable and exportable; new Projects use `VIDEO_FIRST`. |

## Related

[Shot domain](shot-domain.md) · [Generation domain](generation-domain.md) · [Retention domain](retention-domain.md) · [Database](../architecture/database.md)
