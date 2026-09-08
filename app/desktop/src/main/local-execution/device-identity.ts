import { app, safeStorage } from "electron";
import { promises as fs } from "node:fs";
import path from "node:path";

interface StoredIdentity {
  deviceId: string;
  userId: string;
  encryptedDeviceToken: string;
}

export interface DeviceIdentity {
  deviceId: string;
  userId: string;
  deviceToken: string;
}

function isStoredIdentity(value: unknown): value is StoredIdentity {
  if (!value || typeof value !== "object" || Array.isArray(value)) return false;
  const candidate = value as Record<string, unknown>;
  return (
    typeof candidate.deviceId === "string" &&
    candidate.deviceId.trim().length > 0 &&
    typeof candidate.userId === "string" &&
    candidate.userId.trim().length > 0 &&
    typeof candidate.encryptedDeviceToken === "string" &&
    candidate.encryptedDeviceToken.trim().length > 0
  );
}

export class DeviceIdentityStore {
  private readonly filePath = path.join(app.getPath("userData"), "device-identity.json");

  async load(): Promise<DeviceIdentity | null> {
    try {
      const raw = await fs.readFile(this.filePath, "utf8");
      const parsed: unknown = JSON.parse(raw);
      if (!isStoredIdentity(parsed)) return null;
      if (!safeStorage.isEncryptionAvailable()) return null;
      const deviceToken = safeStorage.decryptString(
        Buffer.from(parsed.encryptedDeviceToken, "base64"),
      );
      return { deviceId: parsed.deviceId, userId: parsed.userId, deviceToken };
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
      JSON.stringify(
        {
          deviceId: identity.deviceId,
          userId: identity.userId,
          encryptedDeviceToken,
        } satisfies StoredIdentity,
      ),
      { encoding: "utf8", mode: 0o600 },
    );
  }

  async clear(): Promise<void> {
    await fs.rm(this.filePath, { force: true });
  }
}
