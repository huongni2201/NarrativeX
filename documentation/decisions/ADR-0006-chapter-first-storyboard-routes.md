# ADR-0006: Chapter-first storyboard routes

- Status: Accepted for integration phase
- Date: 2026-08-17
- Scope: Next.js navigation and chapter workspace URL contract

## Context

Storyboard is a chapter-scoped editing surface. The current W1-D2 prototype keeps the chapter workspace context in Zustand and renders the storyboard as a workspace tab. Replacing that prototype navigation during the architecture cleanup would mix route migration with the W1-D2 boundary work.

## Decision

The target App Router hierarchy is:

```text
/projects/[projectId]
/projects/[projectId]/chapters/[chapterId]
/projects/[projectId]/chapters/[chapterId]/storyboard
/projects/[projectId]/chapters/[chapterId]/visuals
/projects/[projectId]/chapters/[chapterId]/audio
/projects/[projectId]/chapters/[chapterId]/render
```

The chapter breadcrumb/context remains visible on every chapter child route. W1-D2 keeps the existing Zustand screen switcher; route implementation begins with project/backend integration and must preserve chapter context during navigation.

## Consequences

Deep links, reloads and browser history can identify the exact project/chapter/workspace surface. The integration phase must migrate state carefully and avoid treating a storyboard route as a project-global screen. Until then, the prototype route remains intentionally non-canonical.
