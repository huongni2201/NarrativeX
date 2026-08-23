import fs from "node:fs";
import path from "node:path";
import { defineConfig, devices } from "@playwright/test";

function loadLocalE2eEnv() {
  const envPath = path.resolve("..", "..", ".env.e2e.local");
  if (!fs.existsSync(envPath)) return;
  for (const line of fs.readFileSync(envPath, "utf8").split(/\r?\n/)) {
    const match = line.match(/^([A-Z][A-Z0-9_]*)=(.*)$/);
    if (match && !process.env[match[1]]) process.env[match[1]] = match[2];
  }
}

loadLocalE2eEnv();

const authFile = path.resolve("playwright", ".auth", "user.json");
const hasTestCredentials = Boolean(
  process.env.E2E_TEST_EMAIL && process.env.E2E_TEST_PASSWORD,
);

export default defineConfig({
  testDir: "./e2e",
  globalSetup: hasTestCredentials ? "./e2e/global-setup.ts" : undefined,
  timeout: 30_000,
  expect: {
    timeout: 5_000,
  },
  forbidOnly: Boolean(process.env.CI),
  retries: process.env.CI ? 2 : 0,
  reporter: process.env.CI ? "github" : "list",
  use: {
    baseURL: process.env.E2E_BASE_URL ?? "http://127.0.0.1:3000",
    storageState: hasTestCredentials ? authFile : undefined,
    trace: "retain-on-failure",
    video: "retain-on-failure",
    screenshot: "only-on-failure",
    actionTimeout: 5_000,
    navigationTimeout: 10_000,
  },
  projects: [{ name: "chromium", use: { ...devices["Desktop Chrome"] } }],
});
