import assert from "node:assert/strict";
import test from "node:test";
import { DesktopApiError } from "../src/renderer/api/client.ts";
import { promptSettingsApi } from "../src/renderer/features/settings/api/prompt-settings.api.ts";
import {
  MAX_PROMPT_STYLES,
  PROMPT_REVISION_CONFLICT_CODE,
  addStyle,
  clonePromptSettings,
  isPromptDraftDirty,
  promptSettingsEqual,
  removeStyle,
  resetToDefaults,
  updateInstruction,
  updateStyle,
  validatePromptDraft,
} from "../src/renderer/features/settings/model/prompt-settings-draft.ts";

function settings(overrides = {}) {
  return {
    formatVersion: 1,
    revision: "7",
    activeStyleId: "CINEMATIC",
    styles: [
      {
        id: "CINEMATIC",
        name: "Cinematic",
        positivePrompt: "film still",
        negativePrompt: "blurry",
        characterRenderingPrompt: "natural skin",
      },
      {
        id: "ANIME",
        name: "Anime",
        positivePrompt: "anime frame",
        negativePrompt: "",
        characterRenderingPrompt: "",
      },
    ],
    instructions: { chapterAnalysis: "a", characterReference: "b", storyboard: "c", video: "d" },
    videoNegativePrompt: "morphing",
    ...overrides,
  };
}

test("draft equality ignores revision but not content", () => {
  const base = settings();
  assert.equal(promptSettingsEqual(base, settings({ revision: "9" })), true);
  assert.equal(promptSettingsEqual(base, updateInstruction(base, "video", "x")), false);
  assert.equal(isPromptDraftDirty(null, base), false);
  assert.equal(isPromptDraftDirty(clonePromptSettings(base), base), false);
  assert.equal(isPromptDraftDirty(updateStyle(base, "ANIME", { name: "Anime 2" }), base), true);
});

test("editing helpers never mutate the saved object", () => {
  const base = settings();
  const frozen = JSON.stringify(base);
  updateStyle(base, "CINEMATIC", { positivePrompt: "changed" });
  addStyle(base, "ANIME");
  removeStyle(base, "ANIME");
  updateInstruction(base, "storyboard", "z");
  assert.equal(JSON.stringify(base), frozen);
});

test("add style clones the source with a fresh valid id and keeps the active style", () => {
  const base = settings();
  const next = addStyle(base, "ANIME");
  assert.equal(next.styles.length, 3);
  const created = next.styles[2];
  assert.equal(created.id, "CUSTOM_1");
  assert.equal(created.positivePrompt, "anime frame");
  assert.equal(next.activeStyleId, "CINEMATIC");
  assert.equal(addStyle(next, null).styles[3].id, "CUSTOM_2");
  assert.deepEqual(validatePromptDraft(next), []);

  const full = { ...base, styles: Array.from({ length: MAX_PROMPT_STYLES }, (_, i) => ({ ...base.styles[0], id: `S${i}` })), activeStyleId: "S0" };
  assert.equal(addStyle(full, "S0").styles.length, MAX_PROMPT_STYLES);
});

test("removing the active style falls back and the last style is protected", () => {
  const base = settings();
  const removed = removeStyle(base, "CINEMATIC");
  assert.equal(removed.activeStyleId, "ANIME");
  assert.equal(removeStyle(removed, "ANIME").styles.length, 1);
});

test("reset to defaults keeps the loaded revision so Save still uses compare-and-set", () => {
  const defaults = settings({ revision: "1", activeStyleId: "ANIME" });
  const reset = resetToDefaults(settings({ revision: "7" }), defaults);
  assert.equal(reset.revision, "7");
  assert.equal(reset.activeStyleId, "ANIME");
  reset.styles[0].name = "mutated";
  assert.equal(defaults.styles[0].name, "Cinematic");
});

test("validation mirrors the cheap server rules", () => {
  assert.deepEqual(validatePromptDraft(settings()), []);
  const bad = settings({
    activeStyleId: "MISSING",
    styles: [
      { id: "bad id", name: "", positivePrompt: " ", negativePrompt: "", characterRenderingPrompt: "" },
      { id: "bad id", name: "x", positivePrompt: "p", negativePrompt: "", characterRenderingPrompt: "" },
    ],
  });
  const problems = validatePromptDraft(bad).join("\n");
  assert.match(problems, /invalid/);
  assert.match(problems, /duplicated/);
  assert.match(problems, /needs a name/);
  assert.match(problems, /positive prompt/);
  assert.match(problems, /active style/);

  const huge = updateInstruction(settings(), "video", "é".repeat(17 * 1024));
  assert.match(validatePromptDraft(huge).join("\n"), /exceeds 32768 bytes/);
});

test("prompt settings API sends the edited revision as a string and parses conflicts", async () => {
  const calls = [];
  const previous = globalThis.window;
  globalThis.window = {
    narrativex: {
      api: {
        request: async (input) => {
          calls.push({ path: input.path, method: input.method, body: input.body });
          if (input.method === "PUT") {
            return {
              status: 409,
              statusText: "Conflict",
              bodyText: JSON.stringify({ success: false, status: 409, code: PROMPT_REVISION_CONFLICT_CODE, message: "stale" }),
            };
          }
          return {
            status: 200,
            statusText: "OK",
            bodyText: JSON.stringify({
              success: true,
              message: "ok",
              timestamp: "2026-10-14T00:00:00Z",
              data: { settings: settings(), effectiveHash: "h", defaults: settings({ revision: "1" }) },
            }),
          };
        },
      },
    },
  };
  try {
    const view = await promptSettingsApi.get();
    assert.equal(view.settings.revision, "7");
    assert.equal(calls[0].path, "/api/v1/settings/prompts");

    await assert.rejects(
      () => promptSettingsApi.save(settings()),
      (error) => error instanceof DesktopApiError && error.status === 409 && error.code === PROMPT_REVISION_CONFLICT_CODE,
    );
    assert.equal(calls[1].method, "PUT");
    assert.equal(JSON.parse(calls[1].body).revision, "7");
  } finally {
    if (previous === undefined) delete globalThis.window;
    else globalThis.window = previous;
  }
});
