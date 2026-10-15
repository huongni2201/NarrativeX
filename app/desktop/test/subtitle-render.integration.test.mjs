import assert from "node:assert/strict";
import test from "node:test";
import { spawnSync } from "node:child_process";
import { mkdtemp, writeFile, rm } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { fileURLToPath } from "node:url";
import { buildAssTrack, escapeSubtitleFilterPath } from "../src/main/rendering/subtitle-ass.ts";
import { DEFAULT_SUBTITLE_STYLE } from "../src/shared/subtitle-style.ts";

const ffmpeg = fileURLToPath(new URL(`../resources/ffmpeg/ffmpeg${process.platform === "win32" ? ".exe" : ""}`, import.meta.url));

test("real FFmpeg places Vietnamese captions at all nine anchors with the selected fonts", async () => {
  const directory = await mkdtemp(join(tmpdir(), "narrativex-subtitle-style-"));
  try {
    const positions = ["TOP_LEFT", "TOP_CENTER", "TOP_RIGHT", "MIDDLE_LEFT", "MIDDLE_CENTER",
      "MIDDLE_RIGHT", "BOTTOM_LEFT", "BOTTOM_CENTER", "BOTTOM_RIGHT"];
    const fonts = ["Arial", "Verdana", "Georgia", "Tahoma"];
    for (const [index, position] of positions.entries()) {
      const fontFamily = fonts[index % 4];
      const style = {...DEFAULT_SUBTITLE_STYLE, position, fontFamily, preset: "OUTLINE", fontSizeRatio: 0.06, edgeMarginRatio: 0.08};
      const path = join(directory, `${index}.ass`);
      await writeFile(path, buildAssTrack([{startMs: 0, endMs: 1000, text: "Đường về nhà"}], 640, 360, style), "utf8");
      const result = spawnSync(ffmpeg, ["-hide_banner", "-f", "lavfi", "-i", "color=black:s=640x360:r=24:d=1",
        "-vf", `ass='${escapeSubtitleFilterPath(path)}'`, "-frames:v", "1", "-f", "rawvideo", "-pix_fmt", "rgb24", "pipe:1"],
        {windowsHide: true, maxBuffer: 2_000_000});
      assert.equal(result.status, 0, result.stderr.toString());
      assert.equal(result.stdout.length, 640 * 360 * 3);
      let minX = 640, maxX = -1, minY = 360, maxY = -1;
      for (let y = 0; y < 360; y++) for (let x = 0; x < 640; x++) {
        if (result.stdout[(y * 640 + x) * 3] > 140) {
          minX = Math.min(minX, x); maxX = Math.max(maxX, x);
          minY = Math.min(minY, y); maxY = Math.max(maxY, y);
        }
      }
      assert.ok(maxX > minX && maxY > minY, `${position}: no visible text`);
      const centerX = (minX + maxX) / 2, centerY = (minY + maxY) / 2;
      assert.ok(position.endsWith("LEFT") ? centerX < 213 : position.endsWith("RIGHT") ? centerX > 426 : Math.abs(centerX - 320) < 15, `${position}: wrong horizontal anchor`);
      assert.ok(position.startsWith("TOP") ? centerY < 120 : position.startsWith("BOTTOM") ? centerY > 240 : Math.abs(centerY - 180) < 15, `${position}: wrong vertical anchor`);
      if (process.platform === "win32") assert.match(result.stderr.toString(), new RegExp(`fontselect:.*\\(${fontFamily},.* -> .*${fontFamily}`, "i"));
    }
  } finally {
    // Only remove the exact temporary directory created by this test.
    assert.ok(directory.startsWith(join(tmpdir(), "narrativex-subtitle-style-")));
    await rm(directory, {recursive: true, force: true});
  }
});
