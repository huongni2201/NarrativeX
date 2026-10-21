import assert from "node:assert/strict";
import test from "node:test";
import { genderLabel, groupVieNeuVoices, parseVoiceMetadata, regionLabel, VOICE_SAMPLE_TEXT } from "../src/renderer/features/voices/model/vieneu-voices.ts";

const voice = (id, name, metadata, extra = {}) => ({
  id, name, provider: "VIENEU", language: "vi-VN", gender: null, sampleUrl: null,
  metadataJson: metadata === undefined ? null : JSON.stringify(metadata), ...extra,
});

test("metadata parsing tolerates missing, malformed and non-object JSON", () => {
  const empty = { custom: false, featured: false, region: null, description: null, referenceAssetId: null, referenceFilename: null };
  assert.deepEqual(parseVoiceMetadata({ metadataJson: null }), empty);
  assert.deepEqual(parseVoiceMetadata({ metadataJson: "{not json" }), empty);
  assert.deepEqual(parseVoiceMetadata({ metadataJson: "[1]" }), empty);
  assert.deepEqual(parseVoiceMetadata({ metadataJson: "{\"custom\":\"true\",\"featured\":1}" }), empty);
});

test("custom voices expose their reference binding", () => {
  const parsed = parseVoiceMetadata(voice("custom-1", "A", { custom: true, referenceAssetId: "asset", referenceFilename: "a.wav", description: " warm " }));
  assert.equal(parsed.custom, true);
  assert.equal(parsed.referenceAssetId, "asset");
  assert.equal(parsed.referenceFilename, "a.wav");
});

test("grouping separates custom from system voices and puts featured presets first", () => {
  const groups = groupVieNeuVoices([
    voice("vieneu-preset-b", "Bình", { preset: true }),
    voice("custom-2", "Zed", { custom: true }),
    voice("vieneu-preset-a", "An", { preset: true, featured: true }),
    voice("vieneu-preset-c", "Cường", { preset: true }),
    voice("custom-1", "Ánh", { custom: true }),
    voice("other", "Other", {}, { provider: "OTHER" }),
  ]);
  assert.deepEqual(groups.custom.map(item => item.id), ["custom-1", "custom-2"]);
  assert.deepEqual(groups.builtIn.map(item => item.id), ["vieneu-preset-a", "vieneu-preset-b", "vieneu-preset-c"]);
});

test("labels use Vietnamese copy and keep unknown regions visible", () => {
  assert.equal(regionLabel("north"), "Miền Bắc");
  assert.equal(regionLabel("islands"), "islands");
  assert.equal(regionLabel(null), null);
  assert.equal(genderLabel("FEMALE"), "Nữ");
  assert.equal(genderLabel(null), "Chưa rõ giới tính");
});

test("voice sample text is long enough for a 10–15 second reading", () => {
  const syllables = VOICE_SAMPLE_TEXT.split(/\s+/).filter(Boolean).length;
  assert.ok(syllables >= 45 && syllables <= 65, `got ${syllables} syllables`);
  assert.ok(VOICE_SAMPLE_TEXT.length <= 500);
});
