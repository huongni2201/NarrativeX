import assert from "node:assert/strict";
import test from "node:test";
import { renderDimensions } from "../src/shared/render-dimensions.ts";

test("output dimensions use the short edge for resolution labels and round the long edge to even pixels", () => {
  for (const [resolution, aspectRatio, expected] of [
    ["720p", "16:9", { width: 1280, height: 720 }],
    ["720p", "9:16", { width: 720, height: 1280 }],
    ["1080p", "9:16", { width: 1080, height: 1920 }],
    ["1440p", "9:16", { width: 1440, height: 2560 }],
    ["2160p", "9:16", { width: 2160, height: 3840 }],
    ["720p", "1:1", { width: 720, height: 720 }],
    ["720p", "4:3", { width: 960, height: 720 }],
    ["720p", "7:3", { width: 1680, height: 720 }],
    ["1080p", "1:3", { width: 1080, height: 3240 }],
    ["1080p", "3:7", { width: 1080, height: 2520 }],
    ["720p", "13:7", { width: 1338, height: 720 }],
    ["720P", "16:9", { width: 1280, height: 720 }],
  ]) assert.deepEqual(renderDimensions(resolution, aspectRatio), expected, `${resolution} ${aspectRatio}`);
});

test("explicit output dimensions retain native rendering semantics independently of aspect labels", () => {
  assert.deepEqual(renderDimensions("721x1281", "9:16"), { width: 721, height: 1281 });
  assert.deepEqual(renderDimensions("1280X720", "legacy"), { width: 1280, height: 720 });
  assert.throws(() => renderDimensions("360p", "16:9"), /Unsupported render resolution/);
  for (const ratio of ["0:9", "16:0", "landscape"]) {
    assert.throws(() => renderDimensions("720p", ratio), /Unsupported render aspect ratio/);
  }
});
