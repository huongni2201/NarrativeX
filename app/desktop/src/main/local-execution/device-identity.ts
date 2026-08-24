import { app, safeStorage } from "electron";
import { promises as fs } from "node:fs";
import path from "node:path";

interface StoredIdentity {
  deviceId?: string;
  encryptedDeviceToken?: string;
}

export interface DeviceIdentity {
  deviceId: string;
  deviceToken: string;
}

export class DeviceIdentityStore {
  private readonly filePath = path.join(app.getPath("userData"), "device-identity.json");

  async load(): Promise<DeviceIdentity | null> {
    try {
      const raw = await fs.readFile(this.filePath, "utf8");
      const stored = JSON.parse(raw) as StoredIdentity;
      if (!stored.deviceId || !stored.encryptedDeviceToken || !safeStorage.isEncryptionAvailable()) {
        return null;
      }
      const deviceToken = safeStorage.decryptString(
        Buffer.from(stored.encryptedDeviceToken, "base64"),
      );
      return { deviceId: stored.deviceId, deviceToken };
    } catch (error) {
      if ((error as NodeJS.ErrnoException).code === "ENOENT") return null;
      throw error;
    }
  }

  async save(identity: DeviceIdentity): Promise<void> {
    if (!safeStorage.isEncryptionAvailable()) {
      throw new Error("OS secure storage is not available.");
    }
    await fs.mkdir(path.dirname(this.filePath), { recursive: true });
    const encryptedDeviceToken = safeStorage
      .encryptString(identity.deviceToken)
      .toString("base64");
    await fs.writeFile(
      this.filePath,
      JSON.stringify({ deviceId: identity.deviceId, encryptedDeviceToken } satisfies StoredIdentity),
      { encoding: "utf8", mode: 0o600 },
    );
  }

  async clear(): Promise<void> {
    await fs.rm(this.filePath, { force: true });
  }
}
