import { access, mkdir, rename, rm } from "node:fs/promises";
import { join } from "node:path";
import { geminiBrowserUserKey } from "./gemini-browser-registry";

const BROWSER_ID_PATTERN = /^[A-Za-z0-9._-]{1,128}$/;
const LEGACY_ENTRIES = ["chrome-profile", "session.json", "lanes", "slots"] as const;

async function exists(path: string): Promise<boolean> {
  try {
    await access(path);
    return true;
  } catch {
    return false;
  }
}

function assertBrowserId(browserId: string): void {
  if (!BROWSER_ID_PATTERN.test(browserId)) {
    throw new Error("Invalid Gemini browser id.");
  }
}

export class GeminiBrowserStorage {
  constructor(private readonly legacyRoot: string) {}

  userRoot(userId: string): string {
    return join(this.legacyRoot, "users", geminiBrowserUserKey(userId));
  }

  browserRoot(userId: string, browserId: string): string {
    assertBrowserId(browserId);
    return join(this.userRoot(userId), "browsers", browserId);
  }

  async migrateLegacyBrowserOne(userId: string): Promise<void> {
    const targetRoot = this.browserRoot(userId, "browser-1");
    await mkdir(targetRoot, { recursive: true });

    for (const entry of LEGACY_ENTRIES) {
      const source = join(this.legacyRoot, entry);
      if (!(await exists(source))) continue;
      const target = join(targetRoot, entry);
      if (await exists(target)) continue;
      await rename(source, target);
    }
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
