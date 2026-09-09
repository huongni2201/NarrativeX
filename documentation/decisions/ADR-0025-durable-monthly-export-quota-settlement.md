# ADR-0025: Durable monthly export quota settlement

Status: Accepted  
Date: 2026-09-08

## Decision

Project render jobs consume one long-form export unit. Admission reserves that unit in PostgreSQL in the same transaction that creates the job, immutable input snapshot, operation plan, stage attempt and outbox entry. The reservation period is the server UTC month selected at admission.

The authoritative admission condition is `consumed units + active reserved units + requested units <= plan limit`. A null limit is unlimited. Successful completion settles the reserved unit exactly once into `usage_windows.longform_exports`; confirmed failure or cancellation releases it. Non-terminal and ambiguous states retain the reservation. Re-delivery of an existing artifact and idempotent replay do not reserve or consume another unit.

`RENDER_PROJECT` is the currently implemented long-form export. NarrativeX does not infer a short export from duration, filename or aspect ratio; a future short-export workflow must declare its quota kind explicitly.

## Consequences

- PostgreSQL row locks serialize requests competing for the final monthly unit.
- Reservation kind, units and settlement state are durable and auditable.
- Settlement is tied to the original reservation period even when completion crosses a month boundary.
- Credit accounting and expensive-job concurrency continue to use the same reservation row.
