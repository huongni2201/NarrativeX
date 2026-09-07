import { rm } from "node:fs/promises";
import { join } from "node:path";
import { geminiBrowserUserKey } from "./gemini-browser-registry.ts";

const BROWSER_ID_PATTERN = /^[A-Za-z0-9._-]{1,128}$/;

function assertBrowserId(browserId: string): void {
  if (!BROWSER_ID_PATTERN.test(browserId)) {
    throw new Error("Invalid Gemini browser id.");
  }
}

export class GeminiBrowserStorage {
  constructor(private readonly storageRoot: string) {}

  userRoot(userId: string): string {
    return join(this.storageRoot, "users", geminiBrowserUserKey(userId));
  }

  browserRoot(userId: string, browserId: string): string {
    assertBrowserId(browserId);
    return join(this.userRoot(userId), "browsers", browserId);
  }

  async resetLogin(userId: string, browserId: string): Promise<void> {
    const root = this.browserRoot(userId, browserId);
    await Promise.all([
      rm(join(root, "chrome-profile"), { recursive: true, force: true }),
      rm(join(root, "session.json"), { force: true }),
      rm(join(root, "browser-control.json"), { force: true }),
      rm(join(root, "lanes"), { recursive: true, force: true }),
      rm(join(root, "slots"), { recursive: true, force: true }),
    ]);
  }

  async removeBrowserData(userId: string, browserId: string): Promise<void> {
    await rm(this.browserRoot(userId, browserId), { recursive: true, force: true });
  }
}
