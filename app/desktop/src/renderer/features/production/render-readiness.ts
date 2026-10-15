import type { DesktopTimeline } from "@narrativex/client-contracts";
import { planSubtitles } from "../../../shared/subtitle-planner.ts";

export function getRenderReadinessBlockers(timeline: DesktopTimeline | null): string[] {
  if (!timeline) return ["Timeline chưa được tải."];

  const blockers: string[] = [];
  if (timeline.chapters.length === 0) blockers.push("Project chưa có chapter để render.");
  if (timeline.beats.length === 0) blockers.push("Project chưa có Visual Beat để render.");

  const nativeTakeAudio =
    timeline.beats.length > 0 && timeline.beats.every((beat) => Boolean(beat.shotId && beat.takeId));

  for (const chapter of timeline.chapters) {
    if (!nativeTakeAudio && (!chapter.audioReady || !chapter.narrationAssetId)) {
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

export function getNativeSubtitleTimingWarning(
  timeline: DesktopTimeline | null,
  subtitlesEnabled: boolean,
): string | null {
  if (!timeline || !subtitlesEnabled) return null;
  const nativeTakeAudio =
    timeline.beats.length > 0 && timeline.beats.every((beat) => Boolean(beat.shotId && beat.takeId));
  if (!nativeTakeAudio) return null;

  const cues = planSubtitles(
    timeline.chapters.map((chapter) => ({
      chapterId: chapter.chapterId,
      globalStartMs: chapter.startMs,
      globalEndMs: chapter.endMs,
      subtitleText: chapter.subtitleText ?? "",
      subtitleWordsJson: chapter.subtitleWordsJson ?? null,
    })),
  );
  return cues.length
    ? null
    : "Native take audio has no verified word timings yet; this export will contain no timed subtitles.";
}
