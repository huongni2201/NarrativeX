# Character domain migration

## Implemented

- Added a framework-free `Character` aggregate owned by a user/workspace.
- Added `ProjectCharacter` as the project assignment boundary; it stores project context without cloning identity.
- Added `CharacterVersion` with `DRAFT -> REVIEW -> LOCKED` behavior and lock metadata.
- Added `CharacterAppearance` and `OutfitVersion` so age, hairstyle, injury and wardrobe changes do not create a new identity.
- Added application commands, ownership-aware use cases, repository ports and JPA persistence adapters.
- Added the character tables and indexes to the consolidated Flyway V1 baseline for PostgreSQL-authoritative state.

## Deliberate follow-up

Asset metadata, consent/rights attestation and generation context resolution remain separate slices. CharacterVersion stores asset IDs and the application boundary must enforce those prerequisites before a generation request is accepted.
