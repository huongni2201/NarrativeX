# Device-Local Project Isolation Design

Date: 2026-08-29
Status: approved direction, pre-release hard cutover

## Goal

Keep every NarrativeX project workspace and all project media local to the Desktop installation that created it. Signing into the same account on another device must start with an independent local project catalog; project media is never synchronized between devices. Account-owned custom voice/reference assets remain the only cross-device media and continue to use R2.

## Project visibility

The Desktop local project catalog is the authoritative source for which projects are visible on that installation. Backend project records remain durable orchestration/business state for projects created on that device, but the Desktop must not merge arbitrary backend project lists into the local catalog.

Creating a project still creates the backend project state required by analysis/generation, then immediately registers that project in the local catalog. A project ID absent from the local catalog is not opened by the Desktop project-detail flow.

## Project media

All generated/imported project media uses the `PROJECT_LOCAL` boundary and is resolved through stable media identity plus project-relative storage metadata. No project-media selection path may fall back to `REMOTE`, `HYBRID`, or generic cross-device materialization behavior.

`ProductionBeatMediaSelectionMapper` must validate that selected visual media is READY, owned by the current account, and available in the current project. Mapper XML must remain well formed; SQL operators containing `<` must never be embedded unescaped in XML.

## Shared account media

Custom voice/reference assets are account-owned and may be shared between devices because their bytes live in R2. This is the only media-sharing boundary in the current product architecture.

## Compatibility

NarrativeX is pre-release. No compatibility layer is required for stale cloud-backed project catalogs or remote project media. Existing test/dev data may be discarded.

## Tests

- mapper XML is parsed as XML in a regression test;
- beat media selection still requires project availability;
- Desktop project listing uses only the local catalog and does not import projects returned by the backend;
- project creation writes the created project into the local catalog;
- project detail refuses to open a project that is absent from the local catalog;
- custom voice/R2 flows remain unchanged.
