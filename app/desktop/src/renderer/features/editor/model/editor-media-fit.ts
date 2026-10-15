import type { BeatMediaFitMode, DesktopTimelineBeat } from "../../../../shared/api-types";

const IMAGE_FIT_MODES: readonly BeatMediaFitMode[] = ["TRIM"];
const VIDEO_FIT_MODES: readonly BeatMediaFitMode[] = [
  "TRIM",
  "LOOP",
  "FREEZE_END",
  "SPEED_ADJUST",
];

export function getAllowedBeatFitModes(
  mediaType: DesktopTimelineBeat["mediaType"] | null,
): readonly BeatMediaFitMode[] {
  return mediaType === "VIDEO" ? VIDEO_FIT_MODES : IMAGE_FIT_MODES;
}
