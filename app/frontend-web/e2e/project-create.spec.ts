import { expect, test } from "@playwright/test";
import { skipUnlessE2eConfigured } from "./test-helpers";

test("creates a project through the real workspace API", async ({ page }) => {
  test.skip(skipUnlessE2eConfigured(), "Set E2E_BASE_URL and E2E_FULL_FLOW to run full E2E.");
  await page.goto("/projects");
  await page.getByRole("button", { name: /Tạo dự án mới/i }).click();
  await page.getByLabel("Tên dự án").fill(`E2E Project ${Date.now()}`);
  await page.getByRole("button", { name: "Tạo dự án", exact: true }).click();
  await expect(page).toHaveURL(/\/projects\/\d+/);
});
