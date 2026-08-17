# Character domain migration evidence

Date: 2026-08-17

## Commands

- `mvn -q -DskipTests compile` — passed after Maven dependency access was approved.
- `mvn -q test` — passed; Spring context initialized with the five Character JPA entity types and Character unit/use-case tests passed.
- `git diff --check` — passed.

## Behavior covered

- One Character identity can be assigned to multiple projects through separate ProjectCharacter records.
- Appearance state is stored against the existing identity.
- A CharacterVersion must enter review before it can be locked and pinned.
- Assignment verifies project access and Character ownership through application ports.
