import assert from "node:assert/strict";
import test from "node:test";
import { spawnSync } from "node:child_process";
import { mkdtemp, rm, readFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { fileURLToPath } from "node:url";
import { parseRenderProfile } from "../src/main/rendering/render-profile.ts";
import { buildBeatRenderArgs } from "../src/main/rendering/segment-renderer.ts";
import { buildLocalRenderManifest } from "../src/main/rendering/render-manifest.ts";
import { concatVideo } from "../src/main/rendering/video-concat.ts";

const profile = JSON.stringify({schemaVersion: 4, audioMode: "NATIVE_TAKE", fps: 24,
  watermark: {mode: "none", policyVersion: 1}, subtitles: {mode: "none"}});

test("native cut snapshots preserve every shot frame window without legacy scene fades", () => {
  const manifest = buildLocalRenderManifest({ jobId: "job", projectId: "project", resolution: "720p",
    aspectRatio: "16:9", totalDurationMs: 9000, renderProfileJson: profile,
    chapters: [{ chapterId: "chapter", orderIndex: 0, globalStartMs: 0, globalEndMs: 9000,
      durationMs: 9000, localPath: "", sizeBytes: 0, checksum: "" }],
    beats: [0, 1, 2].map((index) => ({ visualBeatId: "shared-beat", shotId: `shot-${index}`,
      takeId: `take-${index}`, chapterId: "chapter", sceneIndex: index, beatIndex: 0,
      globalStartMs: index * 3000, globalEndMs: (index + 1) * 3000, durationMs: 3000,
      mediaType: "VIDEO", mediaAssetId: `asset-${index}`, localPath: "source.mp4",
      checksum: "a".repeat(64), sizeBytes: 100, sourceDurationMs: 5000, trimStartMs: 2000,
      sourceOutMs: 5000, fitMode: "TRIM", cameraMovement: "NONE" })) });
  assert.deepEqual(manifest.beats.map((beat) => [beat.startFrame, beat.endFrame]), [[0, 72], [72, 144], [144, 216]]);
  for (const beat of manifest.beats) {
    assert.equal(beat.transitionInMs, 0);
    assert.equal(beat.transitionOutMs, 0);
    assert.doesNotMatch(buildBeatRenderArgs(manifest, beat, "output.mp4").join(" "), /fade=/);
  }
});
test("native profile requires explicit audio mode; legacy profile stays external", () => {
  assert.equal(parseRenderProfile(profile).audioMode, "NATIVE_TAKE");
  assert.throws(() => parseRenderProfile(profile.replace('"NATIVE_TAKE"', '"guess"')), /audio mode/i);
  assert.equal(parseRenderProfile(JSON.stringify({schemaVersion:3, fps:30,
    watermark:{mode:"none",policyVersion:1}})).audioMode, "EXTERNAL_NARRATION");
});

test("three trimmed native cuts preserve ordered decoded audio and 720p24 frames", async () => {
  const suffix = process.platform === "win32" ? ".exe" : "";
  const ffmpeg = fileURLToPath(new URL(`../resources/ffmpeg/ffmpeg${suffix}`, import.meta.url));
  const ffprobe = fileURLToPath(new URL(`../resources/ffmpeg/ffprobe${suffix}`, import.meta.url));
  const run = (exe, args) => {
    const result = spawnSync(exe, args, {encoding:"utf8", windowsHide:true});
    assert.equal(result.status, 0, result.error?.message ?? result.stderr);
    return result.stdout;
  };
  const dir = await mkdtemp(join(tmpdir(), "nx-native-av-"));
  try {
    const parsed = parseRenderProfile(profile);
    const manifest = {width:1280,height:720,fps:24,audioMode:parsed.audioMode,
      videoQuality:parsed.video,colorMode:parsed.colorMode,watermark:parsed.watermark};
    const segments = [];
    for (const [i, frequency] of [440,660,880].entries()) {
      const source = join(dir, `source-${i}.mp4`), output = join(dir, `cut-${i}.mp4`);
      run(ffmpeg, ["-f","lavfi","-i",`color=c=${["red","green","blue"][i]}:s=1280x720:r=24:d=5`,
        "-f","lavfi","-i",`sine=frequency=${frequency}:sample_rate=48000:duration=5`,
        "-c:v","libx264","-preset","ultrafast","-pix_fmt","yuv420p","-c:a","aac","-y",source]);
      const beat = {visualBeatId:"same-beat",shotId:`shot-${i}`,takeId:`take-${i}`,
        mediaType:"VIDEO",localPath:source,sourceDurationMs:5000,trimStartMs:2000,sourceOutMs:5000,
        durationMs:3000,fitMode:"TRIM",frameCount:72,cameraMovement:"NONE",transitionInMs:0,transitionOutMs:0};
      run(ffmpeg, buildBeatRenderArgs(manifest,beat,output,"libx264"));
      segments.push(output);
    }
    const final = await concatVideo(ffmpeg, dir, segments);
    const streams = JSON.parse(run(ffprobe,["-v","error","-count_frames","-show_streams","-of","json",final])).streams;
    const video = streams.find(s=>s.codec_type==="video");
    assert.equal(video.width,1280); assert.equal(video.height,720);
    assert.equal(video.r_frame_rate,"24/1"); assert.equal(Number(video.nb_read_frames),216);
    assert.ok(streams.find(s=>s.codec_type==="audio"));
    const pcm = join(dir,"audio.pcm");
    run(ffmpeg,["-i",final,"-map","0:a:0","-ac","1","-ar","48000","-f","s16le","-y",pcm]);
    const bytes = await readFile(pcm);
    for (const [i, frequency] of [440,660,880].entries()) {
      let crossings=0, previous=0;
      for(let sample=(i*3+1)*48000; sample<(i*3+2)*48000; sample++) {
        const current=bytes.readInt16LE(sample*2);
        if(previous<0 && current>=0) crossings++;
        previous=current;
      }
      assert.ok(Math.abs(crossings-frequency)<3, `cut ${i}: measured ${crossings}, expected ${frequency}`);
    }
  } finally { await rm(dir,{recursive:true,force:true}); }
});
