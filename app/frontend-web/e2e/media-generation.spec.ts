import { expect, test } from "@playwright/test";
import { createProjectAndChapter, jobIdFromResponse, skipUnlessE2eConfigured, waitForJob, waitForMediaDetails } from "./test-helpers";

test("generates and approves deterministic visual media", async ({ page }) => {
  test.skip(skipUnlessE2eConfigured(), "Set E2E_BASE_URL and E2E_FULL_FLOW to run full E2E.");
  await createProjectAndChapter(page);
  const analysisResponsePromise = page.waitForResponse((response) => response.url().includes("/analysis-jobs") && response.request().method() === "POST");
  await page.getByRole("button", { name: "Phân tích", exact: true }).click();
  await waitForJob(page, await jobIdFromResponse(await analysisResponsePromise));
  await page.reload();
  await page.getByRole("button", { name: "Visuals", exact: true }).click();
  await page.getByRole("button", { name: "Generate visuals", exact: true }).click();
  const mediaResponsePromise = page.waitForResponse((response) => response.url().includes("/media-jobs") && response.request().method() === "POST");
  await page.getByRole("button", { name: "Tạo keyframe", exact: true }).click();
  const mediaJobId = await jobIdFromResponse(await mediaResponsePromise);
  await waitForJob(page, mediaJobId);
  await waitForMediaDetails(page, mediaJobId);
  const approveButtons = page.getByRole("button", { name: "Approve", exact: true });
  while (await approveButtons.count()) {
    await approveButtons.first().click();
  }
  await expect(page.getByText(/APPROVED/).first()).toBeVisible();
});
