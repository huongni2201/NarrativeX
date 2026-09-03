import { mkdir, writeFile } from "node:fs/promises";
import { join } from "node:path";
import { SUBTITLE_STYLE_V1 } from "../../shared/subtitle-style.ts";
import type { PlannedSubtitle } from "./subtitle-planner";
import type { LocalRenderBeat, LocalRenderManifest } from "./render-manifest";

export interface BeatSubtitleSlice {
  readonly startMs: number;
  readonly endMs: number;
  readonly text: string;
}

export async function writeBeatSubtitleTrack(
  workDirectory: string,
  manifest: LocalRenderManifest,
  beat: LocalRenderBeat,
  index: number,
): Promise<string | null> {
  const cues = subtitleSlicesForBeat(manifest.subtitles, beat, manifest.fps);
  if (!cues.length) return null;
  const directory = join(workDirectory, "subtitles");
  await mkdir(directory, { recursive: true });
  const path = join(directory, `${String(index).padStart(5, "0")}.ass`);
  await writeFile(path, buildAssTrack(cues, manifest.width, manifest.height), "utf8");
  return path;
}

export function subtitleSlicesForBeat(
  subtitles: readonly PlannedSubtitle[],
  beat: LocalRenderBeat,
  fps: 30 | 60,
): BeatSubtitleSlice[] {
  const beatStartMs = frameMs(beat.startFrame, fps);
  const beatEndMs = frameMs(beat.endFrame, fps);
  return subtitles.flatMap((cue) => {
    const startMs = Math.max(beatStartMs, quantizeToFrame(cue.startMs, fps));
    const endMs = Math.min(beatEndMs, quantizeToFrame(cue.endMs, fps));
    if (!cue.text.trim() || endMs <= startMs) return [];
    return [{
      startMs: Math.max(0, startMs - beatStartMs),
      endMs: Math.max(0, endMs - beatStartMs),
      text: cue.text.trim(),
    }];
  });
}

export function buildAssTrack(
  cues: readonly BeatSubtitleSlice[],
  width: number,
  height: number,
): string {
  const style = SUBTITLE_STYLE_V1;
  const fontSize = Math.max(18, Math.round(height * style.fontSizeRatio));
  const marginV = Math.max(12, Math.round(height * style.bottomMarginRatio));
  const outline = Math.max(1, Math.round(height * style.outlineWidthRatio));
  const shadow = Math.max(0, Math.round(height * style.shadowDepthRatio));
  const marginH = Math.max(12, Math.round((width * (1 - style.maxWidthRatio)) / 2));
  const bold = style.fontWeight >= 600 ? -1 : 0;
  const backgroundAlpha = Math.round((1 - style.backgroundOpacity) * 255);

  return [
    "[Script Info]",
    "ScriptType: v4.00+",
    `PlayResX: ${width}`,
    `PlayResY: ${height}`,
    "ScaledBorderAndShadow: yes",
    "WrapStyle: 0",
    "",
    "[V4+ Styles]",
    "Format: Name,Fontname,Fontsize,PrimaryColour,SecondaryColour,OutlineColour,BackColour,Bold,Italic,Underline,StrikeOut,ScaleX,ScaleY,Spacing,Angle,BorderStyle,Outline,Shadow,Alignment,MarginL,MarginR,MarginV,Encoding",
    `Style: Default,${style.fontFamily},${fontSize},${assColor(style.primaryColor, 0)},${assColor(style.primaryColor, 0)},${assColor(style.outlineColor, 0)},${assColor(style.backgroundColor, backgroundAlpha)},${bold},0,0,0,100,100,0,0,3,${outline},${shadow},2,${marginH},${marginH},${marginV},1`,
    "",
    "[Events]",
    "Format: Layer,Start,End,Style,Name,MarginL,MarginR,MarginV,Effect,Text",
    ...cues.map((cue) =>
      `Dialogue: 0,${formatAssTime(cue.startMs)},${formatAssTime(cue.endMs)},Default,,0,0,0,,${sanitizeAssText(cue.text)}`,
    ),
    "",
  ].join("\n");
}

export function escapeSubtitleFilterPath(path: string): string {
  return path.replace(/\\/g, "/").replace(/:/g, "\\:").replace(/'/g, "\\'");
}

function quantizeToFrame(ms: number, fps: 30 | 60): number {
  return frameMs(Math.round((Math.max(0, ms) * fps) / 1000), fps);
}

function frameMs(frame: number, fps: 30 | 60): number {
  return (Math.max(0, frame) * 1000) / fps;
}

function formatAssTime(ms: number): string {
  const centiseconds = Math.max(0, Math.round(ms / 10));
  const hours = Math.floor(centiseconds / 360_000);
  const minutes = Math.floor((centiseconds % 360_000) / 6_000);
  const seconds = Math.floor((centiseconds % 6_000) / 100);
  const cs = centiseconds % 100;
  return `${hours}:${String(minutes).padStart(2, "0")}:${String(seconds).padStart(2, "0")}.${String(cs).padStart(2, "0")}`;
}

function sanitizeAssText(value: string): string {
  return value
    .replace(/\\/g, "\\\\")
    .replace(/\{/g, "\\{")
    .replace(/\}/g, "\\}")
    .replace(/\r\n?|\n/g, "\\N")
    .trim();
}

function assColor(hex: string, alpha: number): string {
  const normalized = hex.replace(/^#/, "").padEnd(6, "0").slice(0, 6);
  const red = normalized.slice(0, 2);
  const green = normalized.slice(2, 4);
  const blue = normalized.slice(4, 6);
  return `&H${Math.max(0, Math.min(255, alpha)).toString(16).padStart(2, "0").toUpperCase()}${blue}${green}${red}&`;
}
