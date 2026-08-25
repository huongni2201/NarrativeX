import { app, safeStorage } from "electron";
import { randomBytes, randomUUID } from "node:crypto";
import { promises as fs } from "node:fs";
import path from "node:path";

interface StoredGuestDeviceIdentity {
  schemaVersion: 1;
  deviceId: string;
  encryptedSecret: string;
}

export interface GuestDeviceIdentity {
  deviceId: string;
  secret: string;
}

export class GuestDeviceIdentityStore {
  private identityPromise: Promise<GuestDeviceIdentity> | null = null;

  loadOrCreate(): Promise<GuestDeviceIdentity> {
    if (this.identityPromise) return this.identityPromise;
    const pending = this.loadOrCreateOnce();
    this.identityPromise = pending;
    void pending.catch(() => {
      if (this.identityPromise === pending) this.identityPromise = null;
    });
    return pending;
  }

  private async loadOrCreateOnce(): Promise<GuestDeviceIdentity> {
    const existing = await this.load();
    if (existing) return existing;
    const identity = {
      deviceId: randomUUID(),
      secret: randomBytes(32).toString("base64url"),
    } satisfies GuestDeviceIdentity;
    await this.save(identity);
    return identity;
  }

  private filePath(): string {
    return path.join(app.getPath("userData"), "guest-device-identity.json");
  }

  private async load(): Promise<GuestDeviceIdentity | null> {
    const filePath = this.filePath();
    try {
      const raw = await fs.readFile(filePath, "utf8");
      const stored = JSON.parse(raw) as Partial<StoredGuestDeviceIdentity>;
      if (
        stored.schemaVersion !== 1 ||
        typeof stored.deviceId !== "string" ||
        !/^[0-9a-f-]{36}$/i.test(stored.deviceId) ||
        typeof stored.encryptedSecret !== "string" ||
        !stored.encryptedSecret
      ) {
        throw new Error("Stored guest device identity is invalid.");
      }
      if (!safeStorage.isEncryptionAvailable()) {
        throw new Error("OS secure storage is not available.");
      }
      const secret = safeStorage.decryptString(Buffer.from(stored.encryptedSecret, "base64"));
      if (!/^[A-Za-z0-9_-]{43}$/.test(secret)) {
        throw new Error("Stored guest device secret is invalid.");
      }
      return { deviceId: stored.deviceId, secret };
    } catch (error) {
      if ((error as NodeJS.ErrnoException).code === "ENOENT") return null;
      throw error;
    }
  }

  private async save(identity: GuestDeviceIdentity): Promise<void> {
    if (!safeStorage.isEncryptionAvailable()) {
      throw new Error("OS secure storage is not available.");
    }
    const filePath = this.filePath();
    await fs.mkdir(path.dirname(filePath), { recursive: true });
    const document: StoredGuestDeviceIdentity = {
      schemaVersion: 1,
      deviceId: identity.deviceId,
      encryptedSecret: safeStorage.encryptString(identity.secret).toString("base64"),
    };
    const temporaryPath = `${filePath}.${randomUUID()}.tmp`;
    await fs.writeFile(temporaryPath, `${JSON.stringify(document, null, 2)}\n`, {
      encoding: "utf8",
      mode: 0o600,
    });
    await fs.rename(temporaryPath, filePath);
  }
}
