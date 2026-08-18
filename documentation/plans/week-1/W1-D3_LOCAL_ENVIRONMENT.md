# W1-D3 — Reproducible Local Environment

## Objective

A developer with the documented prerequisites can clone the repository, configure non-secret local defaults and start the dependency stack without hidden manual setup.

## Target topology

```text
Next.js :3000
  -> Spring Boot :8080
       -> PostgreSQL :5432
       -> Redis :6379
       -> MinIO/S3 API :9000 (console :9001)
  -> Python worker (dry-run/health in Week 1)
```

PostgreSQL 18, Redis 8 and MinIO are the required Compose baseline. The Spring Boot backend is also available as a Compose-built container; the worker and frontend remain independently runnable during this phase.

## Files

- Modify: `docker-compose.yml`
- Create: root `.env.example` (never copy real credentials)
- Create/modify: module `.env.example` files
- Create: backend profile configuration under `app/backend-service/src/main/resources/`
- Modify: worker `config.py` and module README only for missing environment contracts
- Modify: `infrastructure/README.md` and root `README.md`
- Optional create: `scripts/dev-up.ps1`, `scripts/dev-check.ps1` if they remove repeated setup safely

## Tasks

### 1. Validate Compose dependencies

- [x] Pin PostgreSQL 18, Redis 8 and MinIO image versions; document the PostgreSQL 18 data-layout migration caveat.
- [ ] Add health checks that execute inside each image and verify the current MinIO image actually contains the health-check command.
- [ ] Add restart behavior suitable for local development without masking persistent crash loops.
- [ ] Create the private local bucket through an idempotent init service or documented bootstrap command.
- [ ] Keep volumes named and local; document the explicit command for destructive reset rather than running it automatically.
- [ ] Verify `docker compose config`, clean start, stop and second start. (`docker compose config` passes; Docker daemon was unavailable for lifecycle verification.)

### 2. Define environment contracts

- [x] Root `.env.example` contains safe local placeholders for database, Redis, MinIO, app ports and frontend API base URL.
- [x] OIDC/provider credentials are empty and documented as optional for local fake mode.
- [ ] Use separate configuration namespaces for `local`, `dev`, `staging` and `prod`; staging/prod must not inherit local passwords or `permitAll` behavior.
- [ ] Fail startup in non-local profiles when required secret/config values are absent.
- [ ] Never expose server/provider credentials through `NEXT_PUBLIC_*`.

Recommended profile contract:

| Profile | Providers | Auth | Storage | Failure posture |
|---|---|---|---|---|
| `local` | disabled/deterministic fake | explicit local principal, visible banner | MinIO | convenient but clearly non-production |
| `dev` | disabled or sandbox | OIDC or controlled dev identity | isolated dev bucket | fail closed for missing required security config |
| `staging` | sandbox/limited real | Google OIDC | private staging bucket | production-like, no local fallback |
| `prod` | approved real adapters | Google OIDC | private versioned storage | fail closed |

### 3. Health and readiness

- [ ] Backend liveness proves the process is running; readiness verifies PostgreSQL and required infrastructure without making paid provider calls.
- [ ] Worker health distinguishes `DISABLED`, `CONFIGURED`, `DEGRADED` and `READY`; disabled fake mode is not production-ready provider health.
- [ ] Do not include secrets, raw connection strings or sensitive provider errors in Actuator output.
- [ ] Document service URLs and expected healthy output.
- [ ] Add a smoke script that performs read-only checks and exits non-zero on failure.

### 4. CORS, cookies and local origins

- [ ] Allow only configured frontend origins; never use wildcard origin with credentials.
- [ ] Support credentialed browser requests from the local Next.js origin.
- [ ] Document cookie `Secure` behavior for HTTP localhost versus HTTPS staging/production.
- [ ] Keep session/cookie policy in backend configuration, not frontend environment variables.
- [ ] Add integration tests for accepted origin, rejected origin and preflight behavior.

### 5. Onboarding runbook

Document:

1. Required Java/Node/Python/Docker versions.
2. Copy `.env.example` to `.env` and which values may remain default locally.
3. `docker compose up -d --build` and health verification.
4. Backend, worker dry-run and frontend startup commands.
5. Local URLs and login mode.
6. Safe stop command.
7. Explicit, warned reset procedure for local volumes.
8. Common port, migration, cookie and MinIO bootstrap failures.

## Security checks

- [ ] `.env` remains ignored; `.env.example` contains no usable external credentials.
- [ ] MinIO bucket is private by default.
- [ ] Production profile cannot use local MinIO root credentials or local identity fallback.
- [ ] Logs redact passwords, cookies, authorization headers and provider credentials.
- [ ] A repository secret scan returns no confirmed credentials.

## Acceptance criteria

- [ ] A clean-machine rehearsal follows only the runbook and reaches healthy dependencies.
- [ ] Backend migrates and becomes ready against the Compose PostgreSQL instance.
- [ ] Frontend can send a credentialed request to the configured backend origin.
- [ ] Worker dry-run validates configuration without a provider call.
- [ ] Redis flush does not remove PostgreSQL business state.
- [ ] Restarting Compose preserves PostgreSQL and MinIO data through named volumes.
- [ ] All configuration and CORS tests pass.
