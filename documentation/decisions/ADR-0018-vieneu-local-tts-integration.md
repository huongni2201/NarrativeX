# ADR-0018: VieNeu-TTS local voice-cloning integration

- Status: Accepted
- Date: 2026-08-22
- Scope: Vietnamese local TTS execution and runtime voice-profile enrollment.

## Decision

NarrativeX integrates VieNeu-TTS v3 Turbo as an AI-worker adapter behind the existing narration
provider port. The worker enrolls the configured runtime `.wav` reference as `Ngọc Huyền v2`,
persists the SDK profile, converts the returned waveform to the pipeline's 16-bit mono 48 kHz PCM
contract, and then uses the existing PostgreSQL-fenced provider operation plus R2 media lifecycle.

The provider is selected with `TTS_PROVIDER_MODE=vieneu`; it does not change backend authorization,
quota, idempotency, moderation, or durable-state ownership. The reference sample is not stored in
source control or job payloads. Real-person references require explicit consent and restricted
retention/deletion handling.

## Consequences

- CPU deployments can use the v3 Turbo ONNX backend without adding model code to the repository.
- Voice enrollment is repeatable and can be re-run with `VIENEU_FORCE_REENROLL=true`.
- VieNeu v3 Turbo has no speaking-rate parameter, so the adapter accepts only `1.0`.
- Local execution has zero external provider character cost, while storage and product quotas still
  apply.

## References

- VieNeu-TTS SDK: https://pypi.org/project/vieneu/
- VieNeu-TTS repository: https://github.com/pnnbao97/VieNeu-TTS
