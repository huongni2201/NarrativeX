# ADR-0022: R2 voice-only storage and explicit voice-reference scope

**Status:** Accepted  
**Date:** 2026-08-31

## Context

NarrativeX completed the pre-deployment local-media cutover. Current runtime code routes generated/imported project media to local project storage and reserves Cloudflare R2 for reusable account-owned voice-reference/custom-voice assets.

The earlier architecture still allowed R2 to be described as a generated image/narration transport. That wording no longer matches the active runtime and creates ambiguity around project media, worker output and voice references.

Voice-reference selection also now has two explicit scopes:

```text
VoiceReferenceScope
  PROJECT
  ACCOUNT
```

## Decision

### Project media

All project working media is local-first:

- generated narration;
- generated VisualBeat images;
- imported image/audio/video;
- project-scoped voice reference audio;
- character/portrait media;
- render intermediates/cache;
- final MP4 artifacts.

Project media must not be uploaded to R2 as a normal production step or fallback.

### Account voice references

R2 is reserved for authenticated reusable account-owned voice-reference/custom-voice assets.

Account voice references:

- are stored under an account-scoped `voices/...` namespace;
- require READY/integrity/ownership validation;
- carry durable R2 storage metadata;
- may be downloaded by an authorized narration worker into temporary execution storage.

### Project voice references

Project voice references remain device/project local.

They resolve through the project manifest using stable asset identity, project-relative path, expected size and SHA-256. A PROJECT voice reference must not carry an R2 storage key.

### Backend storage routing

The backend may expose local capability URLs for project-local media, but those URLs are not cloud storage. Object storage routing is limited to the voice namespace.

## Consequences

- R2 is no longer described as generated project-media transport or durability.
- Generic project-media R2 upload/fallback behavior is not part of the runtime contract.
- Narration requests must preserve explicit PROJECT versus ACCOUNT voice-reference semantics.
- Desktop/worker code must resolve PROJECT references from local ProjectStorage/manifest and ACCOUNT references through the authorized R2 voice path.
- Existing historical ADR language remains as historical evidence but is superseded within this storage scope.

## Supersedes

Within current runtime storage scope, this ADR supersedes ADR-0003 language that permits remote generated image/narration transport through R2 and narrows ADR-0012 by explicitly defining PROJECT versus ACCOUNT voice-reference storage.

## Verification evidence

Current implementation evidence includes:

- `RoutingMediaStorageAccess`: only `voices/` routes to object storage;
- `MediaUploadUseCase`: R2 upload accepts voice-reference audio only;
- `VoiceReferenceScope`: `PROJECT` and `ACCOUNT`;
- `VoiceReferenceAssetAccessAdapter`: project references resolve from project media, account references from voice-reference storage;
- `voice_reference_resolver.py`: PROJECT references resolve through `project.manifest.json` with size/checksum verification.
