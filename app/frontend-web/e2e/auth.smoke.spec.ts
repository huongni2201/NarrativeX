import { expect, test } from "@playwright/test";

test.use({ storageState: { cookies: [], origins: [] } });

test.describe("authentication smoke flow", () => {
  test.beforeEach(() => {
    test.skip(!process.env.E2E_BASE_URL, "Set E2E_BASE_URL to run browser smoke tests.");
  });

  test("renders the real login form and surfaces an API error", async ({ page }) => {
    await page.goto("/auth");

    await expect(page.getByRole("heading", { name: "Đăng nhập NarrativeX" })).toBeVisible();
    await page.getByLabel("Email").fill("e2e-invalid@example.com");
    await page.getByLabel("Mật khẩu").fill("invalid-password");
    await page.getByRole("button", { name: "Đăng nhập", exact: true }).click();

    await expect(page.getByRole("alert")).toBeVisible();
  });

  test("logs in with out-of-band credentials", async ({ page }) => {
    test.skip(
      !process.env.E2E_TEST_EMAIL || !process.env.E2E_TEST_PASSWORD,
      "Set E2E_TEST_EMAIL and E2E_TEST_PASSWORD to run the authenticated flow.",
    );

    await page.goto("/auth");
    await page.getByLabel("Email").fill(process.env.E2E_TEST_EMAIL!);
    await page.getByLabel("Mật khẩu").fill(process.env.E2E_TEST_PASSWORD!);
    await page.getByRole("button", { name: "Đăng nhập", exact: true }).click();

    await expect(page).toHaveURL(/\/projects/);
  });
});
