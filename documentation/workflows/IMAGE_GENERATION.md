# Image Generation Workflow — V1.12

Image generation produces immutable image MediaAssets for VisualBeats. NarrativeX is image-first, but image generation is separate from final FFmpeg motion/rendering and from optional I2V.

## Admission and editor flow

Desktop generation is an account/provider-consuming action. Guests may prepare project/chapter state, but the backend requires an authenticated user before AI analysis/generation admission.

Current Desktop foundation:

```text
select Chapter(s)
  -> ensure required analysis/storyboard state
  -> prepare immutable generation inputs
  -> validate blocking issues/staleness
  -> dispatch authorized provider/browser work
  -> observe/reconcile progress
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

Gemini Web is intentionally different: it is a user-owned browser-product integration rather than a fake paid-provider ledger. Its immutable generation input is still backend-authoritative, while browser attempt reconciliation is device-local as defined by ADR-0021.

## Validation and lineage

Before an image is accepted as a durable result, validate at least:

- media decode/type;
- positive dimensions;
- expected provider response/correlation;
- aspect/crop policy metadata;
- checksum/content hash;
- stable MediaAsset metadata and insert-only lineage.

Review/rejection/regeneration must not overwrite historical generated assets. Regeneration is a new explicit attempt. Attaching a newly generated Storyboard preview resets the Visual Beat to `NEEDS_REVIEW`; generated and approved are separate states.

## Visual style and continuity

Image style, source identity, storyboard/beat context, Character/Location continuity and relevant reference assets belong to the immutable generation snapshot/prompt context. Clients select allow-listed product options; they must not become the authority for server-owned policy/prompt suffixes.

The backend owns the final Gemini Web prompt text for both Visual Beats and generated Character identity references. Both use the same allow-listed `CINEMATIC_ANIME` visual-style profile and negative prompt, while each task keeps its own composition instructions. The stored `visualIntent`/`visualPrompt` fields remain canonical source descriptions and are not replaced by the derived provider prompt.

A live Storyboard `beat.prompt` is current-draft display data. It is not allowed to redefine a pending Gemini job after prepare. The Desktop renderer submits the prompt stored in the prepared backend beat snapshot verbatim and does not rebuild, append or maintain a parallel style prompt.

### Prompt Architecture V2

The still-image prompt is compiled from durable canonical state plus beat-local direction. Narrative text is not allowed to redefine visual identity on every frame.

```text
ImageStyle
   + pinned CharacterVersion.visualPrompt       (permanent identity)
   + timeline-scoped CharacterAppearance        (temporary state when available)
   + pinned beat continuity                     (authoritative visible state)
   + ProjectLocation.visualPrompt                (reusable location canon)
   + VisualBeat.visualIntent                     (beat-local scene delta)
   + camera/aspect ratio
   + deterministic reference bindings
        -> backend VisualPromptComposer
        -> exact final provider prompt
```

Prompt precedence is explicit:

1. pinned continuity is authoritative for this beat when it conflicts with generic canon/current-state data;
2. attached identity references preserve facial identity/permanent traits but do not override beat-specific wardrobe, injury, hairstyle, pose, crop, expression, background or lighting;
3. Character identity canon defines permanent traits not clear in references;
4. timeline-scoped current appearance supplies temporary wardrobe, hairstyle, age state and injury when the current continuity timeline has a matching appearance record; legacy chapters without continuity use only the same chapter's `chapter:<chapterId>` appearance rather than the latest appearance from another chapter;
5. Visual Beat scene direction controls current action, pose, expression, composition, environment state and lighting;
6. ImageStyle controls rendering language only and must never redesign identity.

`visualIntent` is therefore a scene delta, not a second complete character prompt. It must refer to established characters by name and must not restate or redesign permanent face geometry, body proportions, skin tone, hair color or stable hair silhouette. Character narrative `bible` text remains useful for story continuity but is not injected into the character identity-reference image prompt, because motivations/backstory can cause unsupported visual inference.

Location analysis stores narrative `description` separately from reusable `visual_prompt`. Location visual canon should capture stable architecture, layout, materials, important furniture/props and spatial landmarks; temporary event lighting, current character action and camera composition belong to the Visual Beat instead.

The character identity-reference task uses the same `CINEMATIC_ANIME` rendering profile as storyboard frames but a neutral composition policy: one character, unobstructed readable face, restrained expression, simple background and soft frontal lighting. Dramatic story composition belongs to Visual Beats, not to the canonical identity anchor.

### Beat-scoped character reference flow

Character identity is established before storyboard image generation. Chapter analysis records only the characters actually visible in each Visual Beat and assigns each participant a `PRIMARY`, `SECONDARY`, or `BACKGROUND` role. These rows are materialized into `visual_beat_characters`; old/manual beats without explicit rows fall back to the parent Scene cast for compatibility.

For one Gemini Web Visual Beat, continuity resolution is:

```text
Visual Beat
  -> resolve explicit beat participants
  -> resolve pinned CharacterVersion, otherwise latest LOCKED CharacterVersion
  -> resolve current timeline appearance / pinned continuity state
  -> select reference assets from the same pinned CharacterVersion
       1. one highest-priority identity anchor per visible character
       2. additional references by semantic role then priority
       3. hard cap: 3 attachments per generated frame
  -> if required reference budget exceeds 3, block before submit
  -> assign attachment order REF_01, REF_02, REF_03
  -> pin labels/roles/content type/SHA-256 in backend snapshot
  -> materialize those immutable MediaAssets into local ProjectStorage
  -> re-hash local bytes in Electron main before upload
  -> attach the files to Gemini in exactly REF order
  -> submit the prepared backend prompt unchanged
```

The prompt names every attachment explicitly, for example `REF_01 = Lan [PRIMARY]`, and instructs the model never to merge or swap identities. Reference images are identity evidence rather than composition templates: their background, crop, pose, facial expression, lighting and reference outfit should not be copied when current pinned state specifies something else. A beat with no visible established character sends no character reference and does not acquire a fabricated character canon.

Reference upload happens before the generation DOM/network baseline is captured. This is important: uploaded reference previews must never be mistaken for the newly generated image.

### Immutable Gemini Web Storyboard batches

One-beat Generate and Generate All share the same prepare contract:

```text
POST .../gemini-generation-batches:prepare
  Idempotency-Key
  beatIds[]
  optional expectedStoryboardRevisionId
      -> REPEATABLE_READ
      -> authorize project/chapter ownership
      -> pin source/storyboard/continuity/style/provider revisions
      -> compile each exact final prompt
      -> pin character snapshot + ordered refs/checksums
      -> persist request + beat fingerprints
      -> return warnings/blocking issues
```

`storyboard_generation_batches` and `storyboard_generation_beat_snapshots` are additive PostgreSQL metadata. They do not replace the existing continuity plan or provider-operation model. The batch references the current continuity authority and only records the exact input used by Desktop browser dispatch.

Prepare idempotency is scoped to the normalized requested beat list as well as accepted beat fingerprints. Reusing one key with a different requested scope is rejected even if both requests fail admission before any beat snapshot can be accepted.

Before each browser dispatch and again before attaching the output, Desktop reads the same batch. Backend stale evaluation compares current source/storyboard/continuity/policy and recomputes the current beat candidate only to compare its fingerprint. Canon text, appearance/wardrobe, reference asset/checksum/order, beat row version or continuity semantic changes therefore make pending work stale. The stored immutable prompt remains the historical submitted input.

Blocking issues never cross the browser boundary. Warnings remain visible for review. Refreshing Storyboard UI does not silently create a new snapshot revision.

### Gemini Web attempts, pause and resume

The renderer queue is execution progress only. It persists batch/snapshot identity and attempt state, not provider prompts as business authority.

```text
prepared beat
  -> local attempt reserved as SUBMITTING
  -> main validates provenance/reference bytes
  -> main attempt journal PREPARED/SUBMITTING
  -> Chrome submit/capture
  -> COMPLETED + output checksum
  -> backend stale check
  -> attach, or retain stale output without attaching
```

Ambiguous browser outcomes become `UNKNOWN`. Restart converts unresolved local `SUBMITTING` state to `UNKNOWN`; resume asks Electron main's attempt journal before creating a new attempt. `UNKNOWN`, `SUBMITTING`, and main-side `COMPLETED` results that have not safely attached are not blindly resubmitted.

Pause stops admission of new work. Already-running tabs may finish, but every late output still passes stale/provenance checks. A legacy queue format is migrated paused and only its pending beats are prepared again; already generated/approved assets are not deleted or regenerated automatically.

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
  -> worker/browser staging owns generated bytes temporarily
  -> backend stable asset registration where applicable
  -> Electron main validates expected size/checksum
  -> commit under project assets/images
  -> project.manifest.json records relative path + integrity
  -> production timeline/render resolves mediaAssetId locally
```

Absolute local paths never become backend domain identity. PostgreSQL records logical media identity/provenance while ProjectStorage owns durable local bytes.

## Beat media selection

Generated images are candidates, not automatically the only final production media. The production timeline may persist an explicit media selection for a VisualBeat. The consolidated V1 `production_beat_media_selections` table supports this durable choice.

A user may also replace a beat with imported media. Image-only camera/motion controls apply only when the selected media semantics support them.

## Storage boundary

Generated and imported project media stays local. Cloudflare R2 is reserved for authenticated account-owned voice-reference/custom-voice assets; generated image results are not uploaded to R2 as transport or durability storage.

Backend download URLs for worker-generated images are short-lived capability URLs into the shared project-local media root. They exist only to let the authenticated Desktop workflow materialize and verify the same local bytes without exposing absolute filesystem paths.

## Client upload note

Do not carry forward browser-era R2 CORS instructions as the Desktop import architecture. Desktop native project imports use Electron main + backend stable asset registration + ProjectStorage. Voice-reference upload is the only retained direct R2 upload workflow.

## Conditional visual anchors

Do not introduce extra anchor-image generation merely because deterministic consistency work exists. Visual anchors remain conditional. First run a real-image comparison after timeline/state resolution, immutable snapshots, checksum-bound reference transport and attempt isolation are verified. Open anchor work only if meaningful residual identity/style drift remains and a controlled comparison shows the additional anchor lifecycle improves quality without violating reference budget, cast isolation or review cost.

## Remaining work

- richer approval/reuse/reframe/edit lineage and affected-scope regeneration;
- stronger adaptive Scene/VisualBeat planning before generation;
- real-image Gemini consistency benchmark and Desktop runtime screenshot evidence for the prepared-batch flow;
- production hardening driven by measured browser/provider failure data rather than blind retry heuristics.
