import type { BeatMediaFitMode, ProjectRenderBeatOverride } from "@narrativex/client-contracts";
import { resetTimelineDraft, updateTimelineDraft, type TimelineDraft } from "./timeline-draft.ts";

export type TimelineCommand =
  | { type: "SET_DURATION"; visualBeatId: string; durationMs: number }
  | { type: "SET_CAMERA"; visualBeatId: string; cameraMovement: string }
  | { type: "SET_FIT"; visualBeatId: string; fitMode: BeatMediaFitMode }
  | { type: "SET_TRIM_START"; visualBeatId: string; trimStartMs: number }
  | { type: "RESET_BEAT"; visualBeatId: string }
  | { type: "RESET_ALL" };

const MIN_DURATION_MS = 250;

export function applyTimelineCommand(draft: TimelineDraft, command: TimelineCommand): TimelineDraft {
  switch (command.type) {
    case "SET_DURATION":
      if (!Number.isFinite(command.durationMs) || command.durationMs < MIN_DURATION_MS) {
        throw new RangeError(`durationMs must be >= ${MIN_DURATION_MS}`);
      }
      return updateTimelineDraft(draft, command.visualBeatId, { durationMs: Math.round(command.durationMs) });
    case "SET_CAMERA":
      return updateTimelineDraft(draft, command.visualBeatId, { cameraMovement: required(command.cameraMovement, "cameraMovement") });
    case "SET_FIT":
      return updateTimelineDraft(draft, command.visualBeatId, { fitMode: command.fitMode });
    case "SET_TRIM_START":
      if (!Number.isFinite(command.trimStartMs) || command.trimStartMs < 0) {
        throw new RangeError("trimStartMs must be >= 0");
      }
      return updateTimelineDraft(draft, command.visualBeatId, { trimStartMs: Math.round(command.trimStartMs) });
    case "RESET_BEAT":
      return resetTimelineDraft(draft, command.visualBeatId);
    case "RESET_ALL":
      return {};
  }
}

export function isTimelineShortcutTarget(target: EventTarget | null): boolean {
  if (!(target instanceof HTMLElement)) return false;
  return target.isContentEditable || ["INPUT", "TEXTAREA", "SELECT"].includes(target.tagName);
}

export function renderOverrideFor(draft: TimelineDraft, visualBeatId: string): ProjectRenderBeatOverride | undefined {
  return draft[visualBeatId];
}

function required(value: string, name: string): string {
  const normalized = value.trim();
  if (!normalized) throw new TypeError(`${name} must not be blank`);
  return normalized;
}
