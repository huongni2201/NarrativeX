import assert from "node:assert/strict";
import test from "node:test";
import { isApiChapterStoryboard } from "../src/features/storyboard/api/storyboard.contracts.ts";

test("accepts the UUID storyboard response returned by the backend", () => {
  const response = {
    chapter: {
      id: "01a0310f-39df-7d2b-abaf-2fe616e1cfd8",
      orderIndex: 3,
      title: "Xuyên Thành Phản Diện, Chặn Đại Mỹ Nhân Trước Cửa Vệ Sinh",
    },
    scenes: [],
  };

  assert.equal(isApiChapterStoryboard(response), true);
});

test("accepts UUID scene and visual beat identifiers", () => {
  const response = {
    chapter: {
      id: "01a0310f-39df-7d2b-abaf-2fe616e1cfd8",
      orderIndex: 3,
      title: "Chapter",
    },
    scenes: [
      {
        id: "01a0310f-9b17-7d2b-abaf-2fe616e1cfd8",
        orderIndex: 0,
        title: "Opening",
        status: "DRAFT",
        approvedBeatCount: 0,
        totalBeatCount: 1,
        visualBeats: [
          {
            id: "01a0310f-4d0e-7d2b-abaf-2fe616e1cfd8",
            sceneId: "01a0310f-9b17-7d2b-abaf-2fe616e1cfd8",
            orderIndex: 0,
            title: "Establishing shot",
            visualIntent: "A quiet opening frame.",
            motionMode: "STILL",
            cameraMovement: "NONE",
            reviewStatus: "NEEDS_REVIEW",
            aspectRatioOverride: null,
            qualityTierOverride: null,
            rowVersion: 0,
          },
        ],
      },
    ],
  };

  assert.equal(isApiChapterStoryboard(response), true);
});
