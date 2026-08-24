export interface FfmpegProgress {
  outTimeMs: number | null;
  frame: number | null;
  fps: number | null;
  speed: string | null;
  progress: "continue" | "end" | null;
}

export function parseFfmpegProgress(chunk: string): FfmpegProgress {
  const values = new Map<string, string>();
  for (const line of chunk.split(/\r?\n/)) {
    const separator = line.indexOf("=");
    if (separator > 0) values.set(line.slice(0, separator), line.slice(separator + 1));
  }
  return {
    outTimeMs: numberOrNull(values.get("out_time_ms")),
    frame: numberOrNull(values.get("frame")),
    fps: numberOrNull(values.get("fps")),
    speed: values.get("speed") ?? null,
    progress: values.get("progress") === "continue" || values.get("progress") === "end" ? values.get("progress") as "continue" | "end" : null,
  };
}

function numberOrNull(value: string | undefined): number | null {
  if (value === undefined || value === "") return null;
  const parsed = Number(value);
  return Number.isFinite(parsed) ? parsed : null;
}
