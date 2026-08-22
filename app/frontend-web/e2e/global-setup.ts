import fs from "node:fs";
import path from "node:path";
import { chromium, type FullConfig } from "@playwright/test";

export default async function globalSetup(config: FullConfig) {
  const email = process.env.E2E_TEST_EMAIL;
  const password = process.env.E2E_TEST_PASSWORD;
  if (!email || !password) {
    throw new Error("E2E_TEST_EMAIL and E2E_TEST_PASSWORD are required for authenticated E2E tests.");
  }

  const baseURL = String(config.projects[0]?.use.baseURL ?? "http://127.0.0.1:3000");
  const authFile = path.resolve("playwright", ".auth", "user.json");
  fs.mkdirSync(path.dirname(authFile), { recursive: true });

  const browser = await chromium.launch();
  try {
    const page = await browser.newPage();
    await page.goto(`${baseURL}/auth`);
    await page.getByLabel("Email").fill(email);
    await page.getByLabel("Mật khẩu").fill(password);
    await page.getByRole("button", { name: "Đăng nhập", exact: true }).click();
    await page.waitForURL(/\/projects/, { waitUntil: "domcontentloaded" });
    await page.context().storageState({ path: authFile });
  } finally {
    await browser.close();
  }
}
