import { expect, test } from "@playwright/test";
import { createProjectAndChapter, jobIdFromResponse, skipUnlessE2eConfigured, waitForJob } from "./test-helpers";

test("creates a chapter and completes analysis", async ({ page }) => {
  test.skip(skipUnlessE2eConfigured(), "Set E2E_BASE_URL and E2E_FULL_FLOW to run full E2E.");
  await createProjectAndChapter(page);
  const responsePromise = page.waitForResponse((response) => response.url().includes("/analysis-jobs") && response.request().method() === "POST");
  await page.getByRole("button", { name: "Phân tích", exact: true }).click();
  const jobId = await jobIdFromResponse(await responsePromise);
  await waitForJob(page, jobId);
  await page.reload();
  await expect(page.getByRole("button", { name: "Storyboard", exact: true })).toBeEnabled();
  await expect(page.getByText(/Phân tích hoàn tất/i)).toBeVisible();
});
