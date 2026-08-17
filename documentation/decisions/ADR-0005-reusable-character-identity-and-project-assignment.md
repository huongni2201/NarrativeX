# ADR-0005: Reusable Character identity with ProjectCharacter assignments

- Status: Accepted
- Date: 2026-08-17
- Scope: `character` bounded context and its project/generation boundaries

## Context

The maintained domain model defines a Character as a reusable identity owned by a user or workspace. A project may use the identity, but must not clone it. Character identity is versioned through immutable CharacterVersion snapshots. Age, hairstyle, injury, wardrobe and other story-state changes belong to CharacterAppearance and OutfitVersion rather than creating a new Character.

## Decision

- `Character` is the canonical reusable identity aggregate.
- `ProjectCharacter` is the project-scoped assignment and stores role, importance, aliases, groups and story metadata.
- `CharacterVersion` stores the immutable identity/Bible/visual/reference snapshot used by generation. Only a reviewed version may be locked or pinned to a project assignment.
- `CharacterAppearance` and `OutfitVersion` model temporal and visual state separately from identity.
- The module stores scalar IDs for project, asset and version boundaries. Cross-module access goes through application ports, not another module's JPA repository.
- Creating a `CharacterAppearance` must resolve the current user, verify character ownership, verify optional project ownership, and verify optional outfit ownership before persistence. An outfit version must belong to the same character as the appearance; the domain factory enforces this relation and PostgreSQL mirrors it with a composite foreign key.
- PostgreSQL owns canonical state; JSON arrays are persisted only as structured metadata, not as an alternative source of truth.

## Consequences

Projects can reuse one identity without divergent clones, while each generation can resolve and snapshot only participating characters. The first implementation leaves asset/consent aggregates to their future bounded contexts and stores their IDs, so rights and real-person consent gates must be enforced before generation submission.
