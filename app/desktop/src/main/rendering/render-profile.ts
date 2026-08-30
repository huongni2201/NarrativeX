export interface ParsedRenderProfile {
  fps: number;
  subtitleMode: "burn_in" | "none";
}

export function parseRenderProfile(renderProfileJson: string): ParsedRenderProfile {
  try {
    const profile = JSON.parse(renderProfileJson) as {
      fps?: unknown;
      subtitles?: { mode?: unknown };
    };
    return {
      fps: typeof profile.fps === "number" && profile.fps > 0 ? profile.fps : 30,
      subtitleMode: profile.subtitles?.mode === "none" ? "none" : "burn_in",
    };
  } catch {
    return { fps: 30, subtitleMode: "burn_in" };
  }
}
