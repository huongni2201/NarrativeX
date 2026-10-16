import { app, safeStorage, shell } from "electron";
import { spawn } from "node:child_process";
import { rm } from "node:fs/promises";
import { join } from "node:path";
import type { StoryAnalysisActivity, StoryAnalysisConfiguration } from "../../shared/story-analysis.ts";
import type { DesktopBackendApiService } from "../api/backend-api-service";
import type { DeviceIdentityStore } from "../local-execution/device-identity";
import type { LocalExecutionService } from "../local-execution/service";
import { registerTrustedIpcHandler, type RendererTrustPolicy } from "../security/renderer-security";
import { nodeExec } from "./agy-exec.ts";
import { AgyInstallResolver, locateAgy } from "./agy-locator.ts";
import { AgyRunner } from "./agy-runner.ts";
import { AgySession } from "./agy-session.ts";
import { DiagnosticsLog } from "./diagnostics.ts";
import { StoryAnalysisService } from "./service.ts";
import { AnalysisBackendError } from "./types.ts";

/** Signal 0 only checks that the process exists; EPERM still means it exists. */
function processExists(pid: number): boolean {
  try { process.kill(pid, 0); return true; }
  catch (error) { return (error as NodeJS.ErrnoException).code === "EPERM"; }
}

const CONFIGURATION_PATH = "/api/v1/story-analysis/configuration";
const TERMS_URL = "https://policies.google.com/terms";

export function registerStoryAnalysis(
  trust: RendererTrustPolicy,
  backendUrl: string,
  api: DesktopBackendApiService,
  identities: DeviceIdentityStore,
  local: LocalExecutionService,
): StoryAnalysisService {
  const directory = join(app.getPath("userData"), "story-analysis");
  // Remove files of the retired in-app OAuth flow; NarrativeX no longer holds any Google credential.
  // Scratch folders left by a crashed run are removed too; the worker only starts after this finished.
  const cleanup = Promise.all([
    rm(join(directory, "accounts"), { recursive: true, force: true }),
    rm(join(directory, "oauth-client.json"), { force: true }),
    rm(join(directory, "scratch"), { recursive: true, force: true, maxRetries: 3, retryDelay: 200 }),
  ]).catch(() => undefined);

  // Spike step 6b (scripts/agy-cli-spike.ps1) passed on agy 1.3.5 (sandboxLeaked=false, fileCreated=false), so the gate
  // is open by default. agy still always runs with --sandbox. Set NARRATIVEX_AGY_ISOLATION_VERIFIED=0 to lock it again.
  const isolationVerified = process.env.NARRATIVEX_AGY_ISOLATION_VERIFIED !== "0";
  const resolver = new AgyInstallResolver(() => locateAgy({
    exec: nodeExec, env: process.env, platform: process.platform, home: app.getPath("home"),
  }));
  const diagnostics = new DiagnosticsLog(join(directory, "diagnostics.log"));
  const runner = new AgyRunner({
    exec: nodeExec,
    install: () => resolver.install(),
    directory,
    isolationVerified,
    onDiagnostic: (code, exitCode, reason, rawText) => { void diagnostics.record(code, exitCode, reason, rawText); },
  });

  const request = async <T>(path: string, body: unknown): Promise<T | null> => {
    // Pair/unpair replaces the local identity without necessarily revoking the previous backend token.
    const identity = await identities.load();
    if (!identity) throw new Error("Local device must be connected first");
    const response = await fetch(new URL(path, backendUrl), {
      method: "POST",
      headers: { "Content-Type": "application/json", "X-NX-Device-Token": identity.deviceToken },
      body: JSON.stringify(body),
      redirect: "error",
      signal: AbortSignal.timeout(30_000),
    });
    if (response.status === 204) return null;
    if (!response.ok) throw new AnalysisBackendError(response.status);
    const envelope = await response.json() as { success: boolean; data: T };
    if (!envelope.success) throw new Error("Analysis backend rejected the request");
    return envelope.data;
  };

  const session = new AgySession({
    directory,
    resolver,
    runner,
    request,
    isolationVerified,
    async configuration() {
      const response = await api.request({ path: CONFIGURATION_PATH, method: "GET", timeoutMs: 15_000 });
      if (response.status !== 200) return null;
      const envelope = JSON.parse(response.bodyText) as { success?: boolean; data?: StoryAnalysisConfiguration };
      return envelope.success && envelope.data ? envelope.data : null;
    },
    deviceReady: async () => Boolean(await identities.load()),
    async ensureDevice() {
      if (await identities.load()) return;
      const response = await api.request({ path: "/api/v1/local-devices/pairing-codes", method: "POST" });
      if (response.status !== 200) throw new Error("Unable to connect this Desktop to the backend");
      const envelope = JSON.parse(response.bodyText);
      if (!envelope.success || typeof envelope.data?.code !== "string") throw new Error("Invalid pairing response");
      await local.pair(envelope.data.code);
    },
    openConsole: agyPath => new Promise<void>((resolve, reject) => {
      // A detached Windows process gets its own console; the executable path never passes through a shell.
      const child = spawn(agyPath, [], { detached: true, stdio: "ignore", windowsHide: false });
      child.once("error", reject);
      child.once("spawn", () => { child.unref(); resolve(); });
    }),
  });

  const crypto = {
    encrypt(value: string) {
      if (!safeStorage.isEncryptionAvailable()) throw new Error("OS secure storage unavailable");
      return safeStorage.encryptString(value);
    },
    decrypt: (value: Buffer) => safeStorage.decryptString(value),
  };
  const service = new StoryAnalysisService(join(directory, "journal"), {
    session,
    request,
    run: (claim, signal, hooks) => runner.run(claim, signal, hooks),
    encrypt: crypto.encrypt,
    decrypt: crypto.decrypt,
    // Records which call keeps failing (and its HTTP status) in diagnostics.log, e.g. a result that cannot be delivered.
    onDeliveryError: (path, status) => { void diagnostics.record("RESULT_DELIVERY_PENDING", status, path, ""); },
  });

  registerTrustedIpcHandler("desktop:story-analysis:status", trust, () => session.status());
  registerTrustedIpcHandler("desktop:story-analysis:refresh", trust, () => session.status(true));
  registerTrustedIpcHandler("desktop:story-analysis:activity", trust, (): StoryAnalysisActivity[] =>
    service.currentActivity().map(entry => ({ ...entry, processAlive: entry.pid === null || processExists(entry.pid) })));
  registerTrustedIpcHandler("desktop:story-analysis:models", trust, () => session.listModels());
  registerTrustedIpcHandler("desktop:story-analysis:open-agy", trust, () => session.openAgy());
  registerTrustedIpcHandler("desktop:story-analysis:open-terms", trust, () => shell.openExternal(TERMS_URL));
  void cleanup.then(() => service.start());
  // Give running attempts a moment to write their journal (observation or result) before the process goes away.
  let quitting = false;
  app.on("before-quit", event => {
    if (quitting) return;
    quitting = true;
    event.preventDefault();
    void service.shutdown().catch(() => undefined).finally(() => app.quit());
  });
  return service;
}
