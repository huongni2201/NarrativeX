# Infrastructure baseline

The v1.6 baseline separates environment configuration from application images and secrets. docker-compose.yml is the local/dev dependency stack for PostgreSQL, Redis, and MinIO. Staging and production must use isolated accounts, buckets, databases, secrets, and provider routes; production promotion is from an immutable image and requires a backup/restore check before migrations.

## Production guardrails

- PostgreSQL is the authoritative state store and needs PITR/HA coverage.
- Object storage is private, versioned, and replicated for critical media.
- Redis is reconstructable and must not be the only copy of job state.
- Managed-provider mode may run with zero self-hosted GPUs; ComfyUI GPU pools are an explicit capacity/cost decision.
- Do not place production secrets in .env, frontend bundles, container images, or repository files.
