import type { DesktopTimeline } from "@narrativex/client-contracts";

export function getRenderReadinessBlockers(timeline: DesktopTimeline | null): string[] {
  if (!timeline) return ["Timeline chưa được tải."];

  const blockers: string[] = [];
  if (timeline.chapters.length === 0) blockers.push("Project chưa có chapter để render.");
  if (timeline.beats.length === 0) blockers.push("Project chưa có Visual Beat để render.");

  for (const chapter of timeline.chapters) {
    if (!chapter.audioReady || !chapter.narrationAssetId) {
      blockers.push(`${chapter.title}: narration chưa READY.`);
    }
  }

  for (const beat of timeline.beats) {
    if (!beat.assetReady || !beat.mediaAssetId) {
      blockers.push(`${beat.title || `Visual Beat ${beat.beatIndex + 1}`}: thiếu media READY.`);
    }
  }

  if (!timeline.readyForRender && blockers.length === 0) {
    blockers.push("Timing Visual Beat chưa liên tục hoặc chưa phủ hết narration.");
  }

  return blockers;
}
