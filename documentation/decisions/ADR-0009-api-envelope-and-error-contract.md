# ADR-0009: Unified JSON API envelope and error contract

- Status: Accepted
- Date: 2026-08-18
- Scope: NarrativeX REST API and frontend transport layer

## Context

The application had a mixed public contract: normal responses were unwrapped domain JSON while errors used Spring `ProblemDetail`. That forced frontend feature code to understand transport details and made security errors differ from controller errors.

## Decision

Normal NarrativeX REST JSON success responses use `ApiResponse<T>`. Database-backed collection endpoints use `ApiResponse<PaginationResponse<T>>` with real `Page<T>` pagination. Application and security errors use `ErrorResponse` with status, stable code, path, correlation ID when available, structured validation errors and timestamp. The frontend transport unwraps `ApiResponse.data`, returns `PaginationResponse<T>` to feature code, handles 204 without parsing a body, and defensively converts invalid/non-JSON failures to `HTTP_ERROR`.

SSE, job-event, binary/media, download, redirect, actuator and WebSocket payloads remain independent protocol contracts and are not wrapped.

## Consequences

- API clients no longer depend on `ProblemDetail`, `ApiProblem` or `application/problem+json`.
- HTTP status semantics remain authoritative; envelope flags do not replace status codes.
- Correlation IDs remain available for diagnostics in both headers and `ErrorResponse`.
- New JSON endpoints must adopt these envelopes and add contract tests; protocol endpoints must explicitly document their separate shape.
