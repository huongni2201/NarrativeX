import type { ProjectRenderBeatOverride } from "@narrativex/client-contracts";

export type TimelineDraft = Record<string, ProjectRenderBeatOverride>;

export function updateTimelineDraft(
  draft: TimelineDraft,
  visualBeatId: string,
  patch: Omit<ProjectRenderBeatOverride, "visualBeatId">,
): TimelineDraft {
  const current = draft[visualBeatId];
  const { visualBeatId: _currentId, ...currentValues } = current ?? {};
  const next = { visualBeatId, ...currentValues, ...patch };
  if (next.durationMs === undefined && next.cameraMovement === undefined && next.mediaAssetId === undefined) {
    const copy = { ...draft };
    delete copy[visualBeatId];
    return copy;
  }
  return { ...draft, [visualBeatId]: next };
}

export function resetTimelineDraft(draft: TimelineDraft, visualBeatId: string): TimelineDraft {
  const copy = { ...draft };
  delete copy[visualBeatId];
  return copy;
}

export function timelineOverrides(draft: TimelineDraft): ProjectRenderBeatOverride[] {
  return Object.values(draft);
}
