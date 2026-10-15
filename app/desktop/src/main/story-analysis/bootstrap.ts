import { app, safeStorage, shell } from "electron";
import { join } from "node:path";
import type { DesktopBackendApiService } from "../api/backend-api-service";
import type { DeviceIdentityStore } from "../local-execution/device-identity";
import type { LocalExecutionService } from "../local-execution/service";
import { registerTrustedIpcHandler, type RendererTrustPolicy } from "../security/renderer-security";
import { AccountManager } from "./accounts";
import { AccountSessions } from "./account-sessions";
import { AccountVault } from "./account-vault";
import { runAnalysis, type ApiDependencies } from "./antigravity-api";
import { loadProfile, type ProfileResult } from "./oauth-profile";
import { AnalysisBackendError, StoryAnalysisService } from "./service";

const GOOGLE_CONSENT_ORIGIN = "https://accounts.google.com/";
const TERMS_URL = "https://www.antigravity.google/terms";

export function registerStoryAnalysis(trust: RendererTrustPolicy, backendUrl: string,
  api: DesktopBackendApiService, identities: DeviceIdentityStore, local: LocalExecutionService): StoryAnalysisService {
  const directory = join(app.getPath("userData"), "story-analysis");
  const crypto = {
    encrypt(value: string) {
      if (!safeStorage.isEncryptionAvailable()) throw new Error("OS secure storage unavailable");
      return safeStorage.encryptString(value);
    },
    decrypt: (value: Buffer) => safeStorage.decryptString(value),
  };
  const vault = new AccountVault(join(directory, "accounts"), crypto);

  let cached: { at: number; value: ProfileResult } | null = null;
  const profile = async (): Promise<ProfileResult> => {
    if (!cached || Date.now() - cached.at > 5_000) cached = { at: Date.now(), value: await loadProfile(directory) };
    return cached.value;
  };
  const oauth = {
    fetch: globalThis.fetch,
    async openUrl(url: string) {
      // Only the Google consent page is ever opened from here.
      if (!url.startsWith(GOOGLE_CONSENT_ORIGIN)) throw new Error("Unexpected authorization URL");
      await shell.openExternal(url);
    },
  };
  const sessions = new AccountSessions(vault, profile, oauth);
  const apiFor = (result: ProfileResult & { ok: true }): ApiDependencies => ({ fetch: globalThis.fetch, tokens: sessions, profile: result.profile });

  const request = async <T>(path: string, body: unknown): Promise<T | null> => {
    const identity = await identities.load();
    if (!identity) throw new Error("Local device must be connected first");
    const response = await fetch(new URL(path, backendUrl), { method: "POST",
      headers: { "Content-Type": "application/json", "X-NX-Device-Token": identity.deviceToken },
      body: JSON.stringify(body), redirect: "error", signal: AbortSignal.timeout(30_000) });
    if (response.status === 204) return null;
    if (!response.ok) throw new AnalysisBackendError(response.status);
    const envelope = await response.json() as { success: boolean; data: T };
    if (!envelope.success) throw new Error("Analysis backend rejected the request");
    return envelope.data;
  };

  const accounts = new AccountManager({
    vault, profile, oauth, request,
    ready: async () => Boolean(await identities.load()),
    ensureDevice: async () => {
      if (await identities.load()) return;
      const response = await api.request({ path: "/api/v1/local-devices/pairing-codes", method: "POST" });
      if (response.status !== 200) throw new Error("Unable to connect this Desktop to the backend");
      const envelope = JSON.parse(response.bodyText);
      if (!envelope.success || typeof envelope.data?.code !== "string") throw new Error("Invalid pairing response");
      await local.pair(envelope.data.code);
    },
  });

  const service = new StoryAnalysisService(join(directory, "journal"), {
    accounts,
    ready: async () => Boolean(await identities.load()),
    request,
    async run(accountId, projectId, claim, signal) {
      const result = await profile();
      if (!result.ok) throw new Error("OAUTH_NOT_CONFIGURED");
      return runAnalysis(apiFor(result), accountId, projectId, claim, signal);
    },
    encrypt: crypto.encrypt,
    decrypt: crypto.decrypt,
  });

  registerTrustedIpcHandler("desktop:story-analysis:status", trust, () => accounts.status());
  registerTrustedIpcHandler("desktop:story-analysis:add-account", trust, () => accounts.addAccount());
  registerTrustedIpcHandler("desktop:story-analysis:cancel-login", trust, () => { accounts.cancelLogin(); });
  registerTrustedIpcHandler("desktop:story-analysis:remove-account", trust, accountId => {
    if (typeof accountId !== "string" || !/^[0-9a-f-]{36}$/u.test(accountId)) throw new Error("Invalid account");
    return accounts.removeAccount(accountId);
  });
  registerTrustedIpcHandler("desktop:story-analysis:terms", trust, () => shell.openExternal(TERMS_URL));
  service.start();
  app.on("before-quit", () => { accounts.cancelLogin(); service.stop(); });
  return service;
}
