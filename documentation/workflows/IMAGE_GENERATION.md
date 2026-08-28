# Image Generation Workflow — V1.11

Image generation produces immutable image MediaAssets for VisualBeats. NarrativeX is image-first, but image generation is separate from final FFmpeg motion/rendering and from optional I2V.

## Admission and editor flow

Desktop generation is an account/provider-consuming action. Guests may prepare project/chapter state, but the backend requires an authenticated user before AI analysis/generation admission.

Current Desktop foundation:

```text
select Chapter(s)
  -> ensure required analysis/storyboard state
  -> estimate authorized generation work
  -> enqueue
  -> observe job progress (SSE/poll fallback where applicable)
  -> review generated results
  -> materialize accepted/required result locally
  -> use/select result in production timeline
```

The renderer consumes typed backend contracts; it does not call Vertex or receive provider credentials.

## Durable provider execution

```text
pinned authorized image work
  -> StageAttempt claim/lease
  -> ProviderOperation persisted before external submission
  -> provider submit/status/reconcile
  -> validate/correlate result
  -> stable MediaAsset identity + checksum + lineage
  -> terminal provider/item/stage state
```

Rules:

- persist request identity/ProviderOperation before external paid submission;
- use allowed-state/CAS fences where mutable execution state requires them;
- ambiguous outcomes become `UNKNOWN` and reconcile before resubmission;
- deterministic provider/schema/correlation failures become terminal failures rather than endless UNKNOWN retry;
- completed results are immutable except idempotent same-fingerprint replay;
- provider URLs/local paths are never authoritative media identity;
- worker lease loss must stop new provider submissions and stale-owner mutation;
- one completed provider batch does not complete a parent job while other items remain pending;
- output correlation fails closed when provider rows cannot be deterministically matched.

The worker owns provider mechanics; backend policy/admission remains authoritative.

## Validation and lineage

Before an image is accepted as a durable result, validate at least:

- media decode/type;
- positive dimensions;
- expected provider response/correlation;
- aspect/crop policy metadata;
- checksum/content hash;
- stable MediaAsset metadata and insert-only lineage.

Review/rejection/regeneration must not overwrite historical generated assets. Regeneration is a new explicit attempt.

## Visual style and continuity

Image style, source identity, storyboard/beat context, Character/Location continuity and relevant reference assets belong to the immutable generation snapshot/prompt context. Clients select allow-listed product options; they must not become the authority for server-owned policy/prompt suffixes.

The backend owns the final Gemini Web prompt text for both Visual Beats and generated Character identity references. Both use the same allow-listed `CINEMATIC_ANIME` visual-style profile and negative prompt, while each task keeps its own composition instructions. Visual Beat reads expose the final text as `beat.prompt`; project-character detail reads expose it as `version.prompt`. The stored `visualIntent`/`visualPrompt` fields remain canonical source descriptions and are not replaced by the derived provider prompt.

The Desktop renderer must submit the backend-returned final prompt verbatim. It must not rebuild, append, or maintain a parallel style prompt. This keeps Generate, Generate All, and Character identity generation visually consistent and gives one backend source of truth for style-policy changes.

### Beat-scoped character reference flow

Character identity is established before storyboard image generation. Chapter analysis now records only the characters actually visible in each Visual Beat and assigns each participant a `PRIMARY`, `SECONDARY`, or `BACKGROUND` role. These rows are materialized into `visual_beat_characters`; old/manual beats without explicit rows fall back to the parent Scene cast for compatibility.

For one Gemini Web Visual Beat, continuity resolution is:

```text
Visual Beat
  -> resolve explicit beat participants
  -> resolve pinned CharacterVersion, otherwise latest LOCKED CharacterVersion
  -> resolve current CharacterAppearance / OutfitVersion state
  -> select reference assets deterministically
       1. one highest-priority identity anchor per visible character
       2. additional references by priority
       3. hard cap: 3 attachments per generated frame
  -> assign attachment order REF_01, REF_02, REF_03
  -> materialize those immutable MediaAssets into local ProjectStorage
  -> attach the files to Gemini in exactly REF order
  -> append the backend-derived REF-to-character map to the scene prompt
  -> submit generation
```

The prompt names every attachment explicitly, for example `REF_01 = Lan [PRIMARY]`, and instructs the model never to merge or swap identities. Reference images are identity evidence rather than composition templates. A beat with no visible established character sends no character reference and explicitly tells the model not to invent one.

Reference upload happens before the generation DOM/network baseline is captured. This is important: uploaded reference previews must never be mistaken for the newly generated image.

### Gemini Web output capture

Gemini Web uses Chrome DevTools Protocol Network capture as the primary output path:

```text
references attached
  -> snapshot existing DOM images
  -> start Network.responseReceived / Network.loadingFinished tracking
  -> submit prompt
  -> wait for a new generated DOM image
  -> correlate the fresh DOM image with image/* network responses
  -> Network.getResponseBody
  -> validate supported MIME and byte bounds
  -> persist into Gemini staging
  -> register/commit as NarrativeX MediaAsset
```

The visible Gemini Download control is fallback-only. This avoids making successful generation depend on Gemini's current button labels, hover behavior, menus, or DOM layout.

Long-term reuse preference remains:

```text
REUSE_APPROVED
  -> REFRAME_DERIVED
  -> EDIT_EXISTING
  -> GENERATE_NEW
```

Richer reuse/reframe/edit review behavior remains roadmap work.

## Desktop local materialization

The current Desktop creator flow materializes generated images needed by the project into ProjectStorage rather than requiring local rendering to consume arbitrary cloud URLs.

```text
validated generated image identity
  -> worker persists generated bytes in shared project-local media storage
  -> backend issues a short-lived capability URL for that local file
  -> Electron main verifies expected size/checksum
  -> commit under project assets/images
  -> project.manifest.json records relative path + integrity
  -> production timeline/render resolves mediaAssetId locally
```

Absolute local paths never become backend domain identity. PostgreSQL records the logical storage key and `PROJECT_LOCAL` storage mode for worker-generated images.

## Beat media selection

Generated images are candidates, not automatically the only final production media. The production timeline may persist an explicit media selection for a VisualBeat. The consolidated V1 `production_beat_media_selections` table supports this durable choice.

A user may also replace a beat with imported media. Image-only camera/motion controls apply only when the selected media semantics support them.

## Storage boundary

Generated and imported project media stays local. Cloudflare R2 is reserved for authenticated account-owned voice-reference/custom-voice assets; generated image results are not uploaded to R2 as transport or durability storage.

Backend download URLs for worker-generated images are short-lived capability URLs into the shared project-local media root. They exist only to let the authenticated Desktop workflow materialize and verify the same local bytes without exposing absolute filesystem paths.

## Client upload note

Do not carry forward browser-era R2 CORS instructions as the Desktop import architecture. Desktop native project imports use Electron main + backend stable asset registration + ProjectStorage. Voice-reference upload is the only retained direct R2 upload workflow.

## Remaining work

- richer approval/reuse/reframe/edit lineage and affected-scope regeneration;
- stronger adaptive Scene/VisualBeat planning before generation;
- production hardening for large batch/retry/provider failure cases;
- complete cost/actual-usage reconciliation.
