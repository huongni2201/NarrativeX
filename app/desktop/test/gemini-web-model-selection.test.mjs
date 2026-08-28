import test from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { findGeminiModelCandidateIndex } from "../src/main/gemini-web/gemini-web-model-selection.ts";

test("model selection chooses the Pro option instead of a menu wrapper", () => {
  const candidates = [
    {
      role: "menu",
      label: "3.5 Flash-Lite\n3.7 Flash\n3.1 Pro",
      ariaLabel: "",
      title: "",
    },
    {
      role: "menuitemradio",
      label: "3.5 Flash-Lite\nCâu trả lời nhanh nhất",
      ariaLabel: "",
      title: "",
    },
    {
      role: "menuitemradio",
      label: "3.7 Flash\nTrợ giúp toàn diện",
      ariaLabel: "",
      title: "",
    },
    {
      role: "menuitemradio",
      label: "3.1 Pro\nSuy luận nâng cao",
      ariaLabel: "",
      title: "",
    },
  ];

  assert.equal(findGeminiModelCandidateIndex(candidates, "Gemini 3.1 Pro"), 3);
});

test("model selection does not treat a container containing Pro as the selected option", () => {
  const candidates = [
    {
      role: "menu",
      label: "3.5 Flash-Lite\n3.7 Flash\n3.1 Pro",
      ariaLabel: "",
      title: "",
    },
  ];

  assert.equal(findGeminiModelCandidateIndex(candidates, "Gemini 3.1 Pro"), -1);
});

test("Gemini automation uses role-aware model option targeting", () => {
  const source = readFileSync(
    new URL("../src/main/gemini-web/gemini-web-automation.ts", import.meta.url),
    "utf8",
  );

  assert.match(source, /findGeminiModelCandidateIndex/);
  assert.doesNotMatch(source, /normalized\.includes\("3\.1 pro"\)/);
});
