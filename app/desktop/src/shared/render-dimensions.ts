/** Output dimensions shared by native rendering and renderer previews. */
export function renderDimensions(
  resolution: string,
  aspectRatio: string,
): { width: number; height: number } {
  const explicit = resolution.match(/^(\d+)x(\d+)$/i);
  if (explicit) {
    return { width: Number(explicit[1]), height: Number(explicit[2]) };
  }

  const sizes: Record<string, number> = {
    "720p": 720,
    "1080p": 1080,
    "1440p": 1440,
    "2160p": 2160,
  };
  const base = sizes[resolution.toLowerCase()];
  if (!base) throw new Error(`Unsupported render resolution: ${resolution}`);

  const ratio = aspectRatio.match(/^(\d+):(\d+)$/);
  if (!ratio) throw new Error(`Unsupported render aspect ratio: ${aspectRatio}`);
  const ratioWidth = Number(ratio[1]);
  const ratioHeight = Number(ratio[2]);
  if (ratioWidth <= 0 || ratioHeight <= 0) {
    throw new Error(`Unsupported render aspect ratio: ${aspectRatio}`);
  }

  if (ratioWidth >= ratioHeight) {
    return {
      width: evenDimension((base * ratioWidth) / ratioHeight),
      height: base,
    };
  }
  return {
    width: base,
    height: evenDimension((base * ratioHeight) / ratioWidth),
  };
}

function evenDimension(value: number): number {
  return Math.max(2, Math.round(value / 2) * 2);
}
