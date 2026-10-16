import assert from "node:assert/strict";
import test from "node:test";
import { currentCharacterVoice, characterVoiceReady } from "../src/renderer/features/voices/model/character-voice.ts";

const profile = (id, versionNumber, extra = {}) => ({ id, characterId: "character", versionNumber, status: "ACTIVE", voiceDescription: "Warm, low voice", ...extra });
const state = (profiles, pinnedVoiceProfileId = null) => ({ profiles, pinnedVoiceProfileId, characterRowVersion: 0 });

test("character voices respect the pinned identity ahead of a newer active version", () => {
  const data = state([profile("new", 3), profile("pinned", 1)], "pinned");
  assert.equal(currentCharacterVoice(data).id, "pinned");
  assert.equal(characterVoiceReady(data), true);
});

test("an archived pinned profile is blocked instead of silently changing the speaker's voice", () => {
  const data = state([profile("new", 3), profile("pinned", 1, { status: "ARCHIVED" })], "pinned");
  assert.equal(currentCharacterVoice(data), null);
  assert.equal(characterVoiceReady(data), false);
});

test("without a pin the newest active profile is used, but it still needs a description", () => {
  const data = state([profile("old", 1), profile("new", 2, { voiceDescription: "  " }), profile("archived", 4, { status: "ARCHIVED" })]);
  assert.equal(currentCharacterVoice(data).id, "new");
  assert.equal(characterVoiceReady(data), false);
  assert.equal(characterVoiceReady(undefined), false);
  assert.equal(characterVoiceReady(state([])), false);
});
