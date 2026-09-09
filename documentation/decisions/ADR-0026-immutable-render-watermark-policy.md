# ADR-0026: Snapshot watermark policy for Desktop renders

- Status: Accepted
- Date: 2026-09-09

## Context

Watermark entitlement is server-authoritative, while final video encoding runs on the user's Desktop. A render must keep the entitlement decision made at admission even if the account plan changes before execution or the job resumes from a local cache.

## Decision

The backend derives watermark policy from the admitted account quota and persists it in immutable render-profile schema version 3. The policy contains a closed mode (`required` or `none`) and a policy version. Desktop rejects missing, malformed, or unsupported profile policy instead of defaulting to no watermark.

Watermark policy participates in the render manifest fingerprint and segment cache key. The supported Desktop renderer applies a fixed application-owned FFmpeg overlay; renderer input cannot supply arbitrary text or filter expressions. Existing version 2 snapshots remain explicit legacy data and are not claimed by the version 3 renderer.

## Consequences

- Plan upgrades or downgrades after admission do not mutate an accepted render.
- Resume and cache reuse cannot cross watermark policies.
- Older clients cannot silently render schema version 3 jobs without the policy.
- A user controls the Desktop machine and can modify its executable or output bytes. This design enforces policy for supported clients, but a completion callback or JSON metadata is not cryptographic proof that final bytes contain the watermark. Strong tamper resistance would require a separate architecture decision, such as trusted server-side rendering or attested execution.

## Verification

Contract tests cover server derivation and persistence, Desktop tests cover strict profile parsing and cache invalidation, and an FFmpeg integration test compares decoded output pixels for `required` versus `none`.
