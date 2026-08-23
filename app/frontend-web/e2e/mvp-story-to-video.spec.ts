import { expect, test } from "@playwright/test";
import {
  createProjectAndChapter,
  jobIdFromResponse,
  skipUnlessE2eConfigured,
  waitForJob,
  waitForMediaDetails,
} from "./test-helpers";

test.describe("MVP story to video", () => {
  test("runs the real analysis → visual → narration → FFmpeg render flow", async ({ page }) => {
    test.skip(skipUnlessE2eConfigured(), "Set E2E_BASE_URL and E2E_FULL_FLOW to run full E2E.");
    await test.step("login and create project/chapter", async () => {
      await createProjectAndChapter(page);
    });

    const analysisResponsePromise = page.waitForResponse((response) => response.url().includes("/analysis-jobs") && response.request().method() === "POST");
    await page.getByRole("button", { name: "Phân tích", exact: true }).click();
    await waitForJob(page, await jobIdFromResponse(await analysisResponsePromise));
    await page.reload();

    await test.step("open storyboard and assert visual beats", async () => {
      await page.getByRole("button", { name: "Storyboard", exact: true }).click();
      await expect(page.getByText(/Visual Beat/i).first()).toBeVisible();
    });

    await test.step("generate and approve images", async () => {
      await page.getByRole("button", { name: "Visuals", exact: true }).click();
      await page.getByRole("button", { name: "Generate visuals", exact: true }).click();
      const mediaResponsePromise = page.waitForResponse((response) => response.url().includes("/media-jobs") && response.request().method() === "POST");
      await page.getByRole("button", { name: "Tạo keyframe", exact: true }).click();
      const mediaJobId = await jobIdFromResponse(await mediaResponsePromise);
      await waitForJob(page, mediaJobId);
      await waitForMediaDetails(page, mediaJobId);
      const approveButtons = page.getByRole("button", { name: "Approve", exact: true });
      while (await approveButtons.count()) await approveButtons.first().click();
      await expect(page.getByText(/APPROVED/).first()).toBeVisible();
    });

    await test.step("generate narration and wait for audio", async () => {
      await page.getByRole("button", { name: "Tổng quan", exact: true }).click();
      await page.getByRole("button", { name: "Tạo Audio", exact: true }).click();
      const narrationResponsePromise = page.waitForResponse((response) => response.url().includes("/narration-jobs") && response.request().method() === "POST");
      await page.getByRole("button", { name: /Tạo giọng đọc|Tạo narration|Tạo audio/i }).last().click();
      await waitForJob(page, await jobIdFromResponse(await narrationResponsePromise));
      await page.reload();
      await page.getByRole("button", { name: "Audio", exact: true }).click();
      await expect(page.getByText(/Audio đã tạo xong/i)).toBeVisible();
    });

    await test.step("render, seek metadata, download and refresh", async () => {
      await page.getByRole("button", { name: "Render & Export", exact: true }).click();
      const renderResponsePromise = page.waitForResponse((response) => response.url().endsWith("/render") && response.request().method() === "POST");
      await page.getByRole("button", { name: "Render Chapter", exact: true }).click();
      await waitForJob(page, await jobIdFromResponse(await renderResponsePromise));
      await expect(page.getByTestId("render-video")).toBeVisible();
      await expect(page.getByTestId("render-video")).toHaveAttribute("preload", "metadata");
      await expect
        .poll(() => page.getByTestId("render-video").evaluate((video) => (video as HTMLVideoElement).readyState >= 1))
        .toBe(true);
      await expect(page.getByRole("link", { name: "Tải MP4" })).toBeVisible();
      await page.reload();
      await page.getByRole("button", { name: "Render & Export", exact: true }).click();
      await expect(page.getByTestId("render-video")).toBeVisible();
      await expect(page.getByRole("link", { name: "Tải MP4" })).toBeVisible();
    });
  });
});
