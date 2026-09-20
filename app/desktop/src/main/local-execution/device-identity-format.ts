export interface StoredDeviceIdentity {
  schemaVersion: 2;
  deviceId: string;
  encryptedDeviceToken: string;
}

export interface DeviceIdentityCredentials {
  deviceId: string;
  deviceToken: string;
}

function isNonEmptyString(value: unknown): value is string {
  return typeof value === "string" && value.trim().length > 0;
}

export function decodeStoredIdentity(
  value: unknown,
  decryptDeviceToken: (encryptedDeviceToken: string) => string,
): DeviceIdentityCredentials | null {
  if (!value || typeof value !== "object" || Array.isArray(value)) return null;
  const candidate = value as Record<string, unknown>;
  if (
    candidate.schemaVersion !== undefined &&
    candidate.schemaVersion !== 2
  ) {
    return null;
  }
  if (!isNonEmptyString(candidate.deviceId) || !isNonEmptyString(candidate.encryptedDeviceToken)) {
    return null;
  }
  return {
    deviceId: candidate.deviceId,
    deviceToken: decryptDeviceToken(candidate.encryptedDeviceToken),
  };
}

export function encodeStoredIdentity(
  identity: DeviceIdentityCredentials,
  encryptDeviceToken: (deviceToken: string) => string,
): StoredDeviceIdentity {
  return {
    schemaVersion: 2,
    deviceId: identity.deviceId,
    encryptedDeviceToken: encryptDeviceToken(identity.deviceToken),
  };
}
