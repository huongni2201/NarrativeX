# ADR-0003: v1.7 control plane and chapter-first continuation

- Status: Accepted
- Date: 2026-08-17
- Scope: v1.7 safety, lifecycle, notification, entitlement and incremental chapter workflows

## Context

The v1.7 specification makes Trust & Safety, rights/consent, account abuse, entitlement, notification delivery and deletion lifecycle part of the production path. It also treats Chapter as the incremental processing boundary: users can add or edit chapters without regenerating unaffected project scope. These decisions need durable state and cannot be represented only by Redis messages or frontend flags.

## Decision

1. Persist policy decisions and lifecycle state in PostgreSQL: rights attestations, moderation decisions, identity consent/profile metadata, notification/outbox events, plan entitlements/usage windows, AI audit events, abuse events and deletion requests.
2. Run account abuse checks before entitlement/quota/cost reservation when the decision can be made locally. A blocked or throttled request must not create a paid provider operation.
3. Treat `SAFE`, `REVIEW` and `BLOCK` as application outcomes. Provider safety signals are normalized input, not the publish authorization.
4. Persist rights policy version, rights basis and attested actor/time with each StoryVersion. An attestation is a prerequisite and audit record, not an automated legal conclusion.
5. Treat Chapter as a durable analyze/generate/render/resume scope. New or changed chapters inherit a snapshot of project Bible/settings; unaffected chapters remain reusable unless dependency analysis marks them affected.
6. Terminal render/Short state writes a unique outbox event in the same business transaction. Notification persistence is authoritative; email/web-push are retryable delivery channels.

## Consequences

- Flyway owns a v1.7 control-plane migration; Redis loss does not lose safety, usage, notification or deletion intent.
- The current repository exposes a foundation, not complete moderation, abuse, email or deletion executors. Those integrations must be implemented behind module ports and verified with deterministic tests.
- Entitlement and locale are configuration/presentation concerns. Stable codes and policy versions remain in domain state; localized labels do not.
- Chapter continuation makes affected-scope resolution and snapshot hashes mandatory before expensive work.

## Rejected alternatives

- Storing notification, safety or quota decisions only in Redis.
- Allowing providers to decide application publishability.
- Recomputing old chapters from mutable current Bible/settings.
- Treating client-side watermark/export flags as authorization.
