import { app, safeStorage } from "electron";
import { promises as fs } from "node:fs";
import path from "node:path";
import {
  decodeStoredIdentity,
  encodeStoredIdentity,
  type DeviceIdentityCredentials,
} from "./device-identity-format";

export type DeviceIdentity = DeviceIdentityCredentials;

export class DeviceIdentityStore {
  private readonly filePath = path.join(app.getPath("userData"), "device-identity.json");

  async load(): Promise<DeviceIdentity | null> {
    try {
      const raw = await fs.readFile(this.filePath, "utf8");
      const parsed: unknown = JSON.parse(raw);
      if (!safeStorage.isEncryptionAvailable()) return null;
      const identity = decodeStoredIdentity(
        parsed,
        (encryptedDeviceToken) =>
          safeStorage.decryptString(Buffer.from(encryptedDeviceToken, "base64")),
      );
      if (!identity) return null;
      if (
        parsed &&
        typeof parsed === "object" &&
        !Array.isArray(parsed) &&
        !("schemaVersion" in parsed)
      ) {
        await this.save(identity);
      }
      return identity;
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
    const storedIdentity = encodeStoredIdentity(identity, (deviceToken) =>
      safeStorage.encryptString(deviceToken).toString("base64"),
    );
    await fs.writeFile(
      this.filePath,
      JSON.stringify(storedIdentity),
      { encoding: "utf8", mode: 0o600 },
    );
  }

  async clear(): Promise<void> {
    await fs.rm(this.filePath, { force: true });
  }
}
