# ADR-0019: Per-request VieNeu voice-reference upload

- Status: Accepted
- Date: 2026-08-22
- Scope: User-selected narration voices and short MP3 reference uploads.

## Decision

Narration keeps the existing voice catalog selection and adds an optional
`voiceReferenceAssetId` to a narration request. The asset is uploaded through the existing private
R2 media upload flow, checked as a user-owned READY AUDIO asset, and linked durably from
`narration_requests.voice_reference_asset_id`.

The AI worker downloads the asset only while processing the request. It validates the MP3 duration
as at least 3 seconds, clips at 8 seconds, converts it to mono WAV with `pydub.AudioSegment`, and
passes the temporary file to VieNeu using `ref_audio`. The sample is not placed in an outbox/job
payload and is not added to the process-wide persisted VieNeu profile, preventing cross-user voice
profile leakage.

## Consequences

- Existing catalog voices remain selectable without an upload.
- Reference uploads are accepted only for VieNeu catalog voices; Google TTS rejects the field.
- Browser duration validation improves feedback, but worker validation remains authoritative.
- The worker image must include FFmpeg because pydub delegates MP3 decoding to it.
- Uploaded real-person voices still require explicit consent, tenant isolation, restricted retention,
  and deletion handling.

## References

- VieNeu SDK voice cloning API: https://pypi.org/project/vieneu/
- Python pydub documentation: https://github.com/jiaaro/pydub
