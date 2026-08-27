# ADR-0008: Use the Production Profile for Machine-Local Docker Execution

## Status

Accepted

## Context

NarrativeX is developed and operated on a developer-owned Windows machine, but that machine is
expected to execute the real product flow. The old local Compose path defaulted to disabled or
fake providers and local media storage, which made it easy to mistake a test/demo run for a real
generation run. Docker should provide isolation and repeatability without changing provider or
storage semantics.

## Decision

The supported machine-local runtime is `docker-compose.yml` with
`SPRING_PROFILES_ACTIVE=prod` and `WORKER_ENV=production`. It explicitly selects:

- Vertex for analysis and image generation;
- Cloudflare R2 for durable generated media;
- VieNeu for narration;
- Desktop-local final rendering and artifact storage through the Electron main process;
- API mode for the Desktop client and server-managed session authentication.

The current Compose file keeps HTTPS ingress external to the application runtime; it
does not contain a web frontend, Caddy service or bundled tunnel service. Fake providers,
local media storage and frontend mock data remain test/Storybook capabilities only.
Production worker startup rejects disabled/fake/local provider or storage selections for roles that
need real external execution.

## Consequences

Real image generation now requires valid Google credentials, a Vertex batch staging bucket and R2
credentials before the containers can start. Provider calls and storage incur their normal costs.
The machine-local web session uses an HTTP-only, non-secure cookie because the local stack is bound
to loopback HTTP; the public stack keeps secure cookies behind HTTPS.

## Related Decisions

- ADR-0005: Deterministic MVP E2E render storage remains the test-only exception.
- ADR-0003: Media storage and external integration boundaries.
