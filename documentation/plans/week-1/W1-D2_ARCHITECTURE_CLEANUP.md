# W1-D2 — Architecture Boundary & Frontend API Foundation

Status: implemented with verification evidence recorded in [`../../audits/evidence/W1-D2_COMMAND_EVIDENCE.md`](../../audits/evidence/W1-D2_COMMAND_EVIDENCE.md)

## Scope

W1-D2 establishes enforceable boundaries around the existing modular monolith and prepares the existing frontend for later API integration. It does not redesign the UI or implement Week 2 project/story, upload, queue, worker, SSE, or provider flows.

## Implemented baseline

- Application services use application commands/contracts rather than HTTP request DTOs.
- Generation accesses projects through `project.application.port.in.ProjectAccess`, never a project repository.
- Automated source-level architecture tests enforce application/API, API/repository, cross-module repository, domain/runtime, shared/business, and controller-package rules.
- Shared RFC 9457 `ProblemDetail` responses expose stable `code`, `messageKey`, `status`, `path`, `instance`, and `correlationId`; validation includes field violations.
- A correlation-ID filter returns `X-Correlation-Id` on responses and supplies it to problem payloads.
- Transactions remain at application use-case boundaries; the later DDD migration separates persistence mappings without changing the database schema (see `DDD_MIGRATION.md`).
- The frontend has typed API DTOs, a single fetch/error boundary, conservative TanStack Query defaults, stable query keys, and an App Router provider wrapper.
- Mock data is explicit through `NEXT_PUBLIC_NX_DATA_MODE`; all application runtimes default to API mode and reject mock mode. Test and Storybook runtimes may opt into mock mode.

## Deliberately deferred

- W1-D3 local runtime composition.
- W1-D4 PostgreSQL/Flyway clean-database baseline.
- W1-D5 authentication, session, and tenant ownership enforcement.
- W2-D1+ real project/story integration, uploads, durable queue/worker leases, SSE progress, CI/staging, and provider integration.

## Acceptance evidence

See the command-by-command results in [`W1-D2_COMMAND_EVIDENCE.md`](../../audits/evidence/W1-D2_COMMAND_EVIDENCE.md). The Windows Maven wrapper and initial `npm ci` remain blocked by pre-existing environment issues; installed Maven and an offline npm repair were used only after recording those failures.
