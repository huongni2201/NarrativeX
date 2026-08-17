# NarrativeX Week 1 — Implementation Pack

Status: proposed implementation plan  
Source of truth: NarrativeX Project Specification v1.7 and [`NARRATIVEX_WEEK_1_2_IMPLEMENTATION_TIMELINE.md`](../../product/NARRATIVEX_WEEK_1_2_IMPLEMENTATION_TIMELINE.md)  
Scope: Week 1 — Foundation & Clean

## Outcome

At the end of Week 1, NarrativeX must have a documented and testable foundation:

```text
Browser UI
  -> authenticated Spring Boot boundary
  -> PostgreSQL business state
  -> Redis acceleration only
  -> private S3-compatible storage

+ repeatable local environment
+ versioned Flyway baseline
+ stable API/error conventions
+ project/workspace ownership enforcement
+ recorded test baseline
```

Real AI generation, worker queue execution, asset upload, Project/Story vertical-slice completion and SSE progress are Week 2 work. Week 1 may preserve deterministic fakes, but must not present them as production provider health.

## Documents

| Day | Plan | Primary deliverable |
|---|---|---|
| W1-D1 | [`W1-D1_REPOSITORY_AUDIT.md`](./W1-D1_REPOSITORY_AUDIT.md) | Architecture map, baseline checks, P0/P1/P2 debt register and no-refactor list |
| W1-D2 | [`W1-D2_ARCHITECTURE_CLEANUP.md`](./W1-D2_ARCHITECTURE_CLEANUP.md) | Enforced modular-monolith and frontend API boundaries |
| W1-D3 | [`W1-D3_LOCAL_ENVIRONMENT.md`](./W1-D3_LOCAL_ENVIRONMENT.md) | One-command dependency stack, profiles, health and onboarding runbook |
| W1-D4 | [`W1-D4_DATABASE_FOUNDATION.md`](./W1-D4_DATABASE_FOUNDATION.md) | Reviewed schema baseline, safe Flyway path and persistence tests |
| W1-D5 | [`W1-D5_AUTH_SECURITY_OWNERSHIP.md`](./W1-D5_AUTH_SECURITY_OWNERSHIP.md) | Google OIDC/session foundation and server-side tenant ownership |

## Delivery order and gates

The documents are executed in order. A day is complete only when its tests and evidence are attached to the PR or recorded in the document.

1. D1 freezes the current baseline; do not refactor before the audit is recorded.
2. D2 establishes ownership and dependency rules; later changes follow those boundaries.
3. D3 makes PostgreSQL, Redis and MinIO reproducible for integration tests.
4. D4 validates the persistence contract on a clean PostgreSQL instance.
5. D5 replaces permissive security on all non-local profiles and proves cross-tenant denial.

Blocking gates before Week 2:

- [ ] All P0 findings from D1 are closed or explicitly accepted with an owner and deadline.
- [ ] No backend domain package imports a provider SDK.
- [ ] `docker compose up -d` produces healthy PostgreSQL, Redis and MinIO dependencies.
- [ ] Flyway migrates an empty PostgreSQL database to the latest version and Hibernate validates it.
- [ ] Redis can be flushed without deleting canonical project/auth state.
- [ ] Non-local profiles fail closed when OIDC/session configuration is missing.
- [ ] Anonymous and cross-tenant project access tests return stable `401`/`403`/`404` behavior.
- [ ] Backend, frontend and worker verification commands pass or have a recorded baseline issue.
- [ ] No secrets or provider credentials are committed or exposed through `NEXT_PUBLIC_*` variables.

## Shared implementation rules

- PostgreSQL is authoritative. Redis contains only reconstructable delivery/cache/progress data.
- Domain/application code depends on ports; vendor SDK and object-storage clients live in adapters.
- Story text, prompts, references and provider output are untrusted data.
- Expensive work requires `OperationPlan`, reservation, entitlement/abuse checks and usage attribution; Week 1 must not add a shortcut around these gates.
- Mutable rows use optimistic locking. Locked/approved/render/provider snapshots are immutable.
- Every behavior change includes success, denial and error-path tests.
- Update the smallest relevant document. Create an ADR for a cross-cutting decision such as identifier strategy, module dependency policy or authentication/session model.

## Verification commands

Run the narrow check after each task and the complete baseline at the end of the week:

```powershell
cd app/backend-service
./mvnw.cmd test

cd ../ai-worker
python -m pytest
python -m ruff check .
python -m mypy src

cd ../frontend-web
npm ci
npm run lint
npm run type-check
npm run build

cd ../..
docker compose config
docker compose up -d
docker compose ps
```

Do not commit generated frontend files such as `tsconfig.tsbuildinfo`. Preserve unrelated worktree changes while implementing these plans.

