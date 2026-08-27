import { writeFile } from "node:fs/promises";
import { join } from "node:path";
import type { PlannedSubtitle } from "./subtitle-planner";
import { subtitleCueIsRenderable } from "./subtitle-planner";

export async function writeSubtitleTrack(
  workDirectory: string,
  subtitles: readonly PlannedSubtitle[],
): Promise<string | null> {
  const cues = subtitles.filter(subtitleCueIsRenderable);
  if (!cues.length) return null;
  const path = join(workDirectory, "subtitles.srt");
  const body = cues
    .map(
      (cue, index) =>
        `${index + 1}\n${formatSrtTime(cue.startMs)} --> ${formatSrtTime(cue.endMs)}\n${sanitizeSrtText(cue.text)}\n`,
    )
    .join("\n");
  await writeFile(path, body, "utf8");
  return path;
}

export function formatSrtTime(ms: number): string {
  const value = Math.max(0, Math.round(ms));
  const hours = Math.floor(value / 3_600_000);
  const minutes = Math.floor((value % 3_600_000) / 60_000);
  const seconds = Math.floor((value % 60_000) / 1000);
  const millis = value % 1000;
  return `${pad(hours, 2)}:${pad(minutes, 2)}:${pad(seconds, 2)},${pad(millis, 3)}`;
}

function sanitizeSrtText(value: string): string {
  return value.replace(/\r\n?/g, "\n").replace(/\n{3,}/g, "\n\n").trim();
}

function pad(value: number, width: number): string {
  return String(value).padStart(width, "0");
}
