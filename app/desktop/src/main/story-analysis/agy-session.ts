import { createHash, randomUUID } from "node:crypto";
import { mkdir, readFile, writeFile } from "node:fs/promises";
import { join } from "node:path";
import type {
  AccountConnectionState, AccountQuotaState, AgyModel, AgyUsageGroup, AnalysisDiagnostic,
  StoryAnalysisConfiguration, StoryAnalysisStatus,
} from "../../shared/story-analysis.ts";
import type { AgyInstallResolver } from "./agy-locator.ts";
import type { AgyRunner } from "./agy-runner.ts";
import { evaluateQuota } from "./agy-usage.ts";
import { ADAPTER_VERSION, AnalysisBackendError, AnalysisError } from "./types.ts";

export type BackendRequest = <T>(path: string, body: unknown) => Promise<T | null>;

export interface Eligibility { credentialRef: string; maxParallel: number }

export interface AgySessionDependencies {
  /** `<userData>\story-analysis`; holds the non-secret session.json. */
  directory: string;
  resolver: AgyInstallResolver;
  runner: Pick<AgyRunner, "usage" | "models">;
  request: BackendRequest;
  /** Backend analysis configuration (model, parallelism) read with the signed-in user session. */
  configuration(): Promise<StoryAnalysisConfiguration | null>;
  deviceReady(): Promise<boolean>;
  ensureDevice(): Promise<void>;
  /** Opens an interactive agy console so the person can log in. */
  openConsole(agyPath: string): Promise<void>;
  isolationVerified: boolean;
  now?(): number;
}

const CREDENTIALS = "/api/v1/local-devices/analysis-credentials";
const LABEL = "Antigravity CLI";
const MAX_PARALLEL = 3;
const REFRESH_INTERVAL_MS = 60_000;
const RATE_LIMIT_HOLD_MS = 60_000;
const REFUSAL_HOLD_MS = 30 * 60_000;
const QUOTA_FALLBACK_HOLD_MS = 15 * 60_000;
const QUOTA_UNKNOWN_RESET_HOLD_MS = 60 * 60_000;

interface StoredSession { installationId: string; credentialRef: string | null }

/**
 * The single login owned by the installed agy CLI. NarrativeX never reads or rotates the Google credential:
 * it only observes `/usage`, keeps one backend slot for this Desktop, and pauses claims while a hold-off is active.
 */
export class AgySession {
  private cliVersion: string | null = null;
  private cliIssue: string | null = "AGY_NOT_FOUND";
  private installPath: string | null = null;
  private deviceReady = false;
  private connectionState: AccountConnectionState = "UNKNOWN";
  private usage: AgyUsageGroup[] = [];
  private usageObservedAt: number | null = null;
  private models: AgyModel[] = [];
  private config: StoryAnalysisConfiguration | null = null;
  private holdOff: { until: number; state: AccountQuotaState; reason: string } | null = null;
  private lastError: string | null = null;
  private diagnostic: AnalysisDiagnostic | null = null;
  private blocked: string | null = null;
  private running = 0;
  private refreshedAt = 0;
  private refreshing: Promise<void> | null = null;
  private queuedRefresh: Promise<void> | null = null;
  private stored: StoredSession | null = null;
  private registering: Promise<string> | null = null;
  private lastReported = "";
  /** Serializes observations so an older state can never overtake a newer one on its way to the backend. */
  private reporting: Promise<void> = Promise.resolve();
  /** Delivery notice kept apart from `lastError` so a settled tick can clear it without erasing a chapter failure. */
  private deliveryNotice: string | null = null;

  constructor(private readonly deps: AgySessionDependencies) {}

  private now(): number { return (this.deps.now ?? Date.now)(); }

  // ---- state refresh ------------------------------------------------------------------------------------------

  /** Re-reads install, login, usage, models and configuration; concurrent callers share one probe. */
  refresh(force = true): Promise<void> {
    if (this.refreshing) {
      // A forced refresh (login changed, "refresh" pressed) must observe state newer than the probe already running.
      if (force && !this.queuedRefresh) {
        this.queuedRefresh = this.refreshing.catch(() => undefined).then(() => {
          this.queuedRefresh = null;
          return this.startRefresh(true);
        });
      }
      return this.queuedRefresh ?? this.refreshing;
    }
    if (this.queuedRefresh) return this.queuedRefresh;
    if (!force && this.now() - this.refreshedAt < REFRESH_INTERVAL_MS) return Promise.resolve();
    return this.startRefresh(force);
  }

  private startRefresh(force: boolean): Promise<void> {
    const run: Promise<void> = this.doRefresh(force).finally(() => {
      if (this.refreshing === run) this.refreshing = null;
      this.refreshedAt = this.now();
    });
    return this.refreshing = run;
  }

  private async doRefresh(force: boolean): Promise<void> {
    const located = await this.deps.resolver.resolve(force);
    this.deviceReady = await this.deps.deviceReady().catch(() => false);
    if (!located.ok) {
      this.cliIssue = located.issue; this.cliVersion = null; this.installPath = null;
      this.connectionState = "UNAVAILABLE"; this.lastError = located.issue;
      this.diagnostic = { source: "AGY_CLI", exitCode: null, reason: located.issue };
      return;
    }
    this.cliIssue = null; this.cliVersion = located.install.version; this.installPath = located.install.path;
    try {
      this.usage = await this.deps.runner.usage();
      this.usageObservedAt = this.now();
      this.connectionState = "CONNECTED";
      if (this.lastError === "AUTH_REQUIRED" || this.lastError === "PROVIDER_UNAVAILABLE") { this.lastError = null; this.diagnostic = null; }
      if (force || !this.models.length) this.models = await this.deps.runner.models().catch(() => this.models);
    } catch (error) {
      const failure = error instanceof AnalysisError ? error : new AnalysisError("PROVIDER_UNAVAILABLE", false);
      this.connectionState = failure.code === "AUTH_REQUIRED" ? "AUTH_REQUIRED" : "UNAVAILABLE";
      this.lastError = failure.code; this.diagnostic = failure.diagnostic;
    }
    // A transient backend error must not wipe the last known configuration and block claims until the next refresh.
    this.config = (await this.deps.configuration().catch(() => null)) ?? this.config;
    void this.report();
  }

  // ---- derived state ------------------------------------------------------------------------------------------

  private modelIssue(): string | null {
    if (!this.config) return null;
    if (!this.config.model.trim()) return "MODEL_NOT_CONFIGURED";
    return this.models.length > 0 && !this.models.some(model => model.slug === this.config!.model) ? "MODEL_NOT_AVAILABLE" : null;
  }

  private quota(): { state: AccountQuotaState; nextEligibleAt: number | null } {
    const now = this.now();
    if (this.holdOff && this.holdOff.until > now) return { state: this.holdOff.state, nextEligibleAt: this.holdOff.until };
    return evaluateQuota(this.usage, this.config?.model ?? null, now);
  }

  private maxParallel(): number {
    return Math.min(MAX_PARALLEL, Math.max(1, this.config?.maxConcurrentAnalyses ?? 1));
  }

  async status(force = false): Promise<StoryAnalysisStatus> {
    await this.refresh(force);
    const quota = this.quota();
    return {
      cliReady: this.cliIssue === null,
      cliVersion: this.cliVersion,
      cliIssue: this.cliIssue,
      isolationVerified: this.deps.isolationVerified,
      deviceReady: this.deviceReady,
      loggedIn: this.connectionState === "CONNECTED",
      credentialRef: this.stored?.credentialRef ?? null,
      connectionState: this.connectionState,
      quotaState: quota.state,
      nextEligibleAt: quota.nextEligibleAt ? new Date(quota.nextEligibleAt).toISOString() : null,
      usage: this.usage,
      usageObservedAt: this.usageObservedAt ? new Date(this.usageObservedAt).toISOString() : null,
      runningJobs: this.running,
      maxParallel: this.maxParallel(),
      modelIssue: this.modelIssue(),
      lastError: this.lastError ?? this.deliveryNotice ?? this.blocked,
      lastDiagnostic: this.diagnostic,
    };
  }

  /** Models from `agy models` (refreshed on demand). */
  async listModels(): Promise<AgyModel[]> {
    await this.refresh(true);
    return this.models;
  }

  async openAgy(): Promise<void> {
    const located = await this.deps.resolver.resolve();
    if (!located.ok) throw new AnalysisError(located.issue, false);
    await this.deps.openConsole(located.install.path);
  }

  setRunning(count: number): void { this.running = count; }

  // ---- gate for the worker ------------------------------------------------------------------------------------

  /** Returns what a claim needs, or null while anything blocks it (the reason is visible in `status()`). */
  async eligibility(): Promise<Eligibility | null> {
    await this.refresh(false);
    const block = (reason: string): null => { this.blocked = reason; return null; };
    if (this.cliIssue) return block(this.cliIssue);
    if (!this.deps.isolationVerified) return block("ISOLATION_NOT_VERIFIED");
    if (this.connectionState !== "CONNECTED") return block(this.lastError ?? "AUTH_REQUIRED");
    if (!this.config) return block("CONFIGURATION_UNAVAILABLE");
    const issue = this.modelIssue();
    if (issue) return block(issue);
    const quota = this.quota();
    if (quota.state === "EXHAUSTED" || quota.state === "RATE_LIMITED") {
      return block(this.holdOff && this.holdOff.until > this.now() ? this.holdOff.reason : quota.state === "EXHAUSTED" ? "QUOTA_EXHAUSTED" : "RATE_LIMITED");
    }
    try { await this.ensureCredential(); }
    catch { return block("DEVICE_UNPAIRED"); }
    this.blocked = null;
    return { credentialRef: this.stored!.credentialRef!, maxParallel: this.maxParallel() };
  }

  // ---- results of real work -----------------------------------------------------------------------------------

  noteSuccess(): void {
    this.connectionState = "CONNECTED";
    // A parallel job may have started before the latest 429/refusal; its success cannot lift that hold-off.
    this.lastError = null; this.diagnostic = null;
    if (this.deliveryNotice !== "RESULT_DELIVERY_PENDING") this.deliveryNotice = null;
    void this.report();
  }

  /** Applies the hold-off that matches a failure; chapter-local failures leave the session untouched. */
  async noteFailure(error: AnalysisError): Promise<void> {
    this.lastError = error.code; this.diagnostic = error.diagnostic;
    const now = this.now();
    switch (error.code) {
      case "AUTH_REQUIRED":
        this.connectionState = "AUTH_REQUIRED"; break;
      case "RATE_LIMITED":
        this.holdOff = { until: now + (error.retryAfterMs ?? RATE_LIMIT_HOLD_MS), state: "RATE_LIMITED", reason: "RATE_LIMITED" }; break;
      case "QUOTA_EXHAUSTED": {
        // Pause claims immediately; the slower /usage read below only refines the resume time.
        this.holdOff = { until: now + QUOTA_FALLBACK_HOLD_MS, state: "EXHAUSTED", reason: "QUOTA_EXHAUSTED" };
        await this.refresh(true).catch(() => undefined);
        const quota = evaluateQuota(this.usage, this.config?.model ?? null, this.now());
        const until = quota.state === "EXHAUSTED"
          ? quota.nextEligibleAt ?? this.now() + QUOTA_UNKNOWN_RESET_HOLD_MS
          : this.now() + QUOTA_FALLBACK_HOLD_MS;
        this.holdOff = { until, state: "EXHAUSTED", reason: "QUOTA_EXHAUSTED" };
        break;
      }
      case "PROVIDER_REFUSAL":
        this.holdOff = { until: now + REFUSAL_HOLD_MS, state: "RATE_LIMITED", reason: "PROVIDER_REFUSAL" };
        break;
      case "PROVIDER_UNAVAILABLE":
      case "CLI_UNAVAILABLE":
        this.connectionState = "UNAVAILABLE"; break;
      case "MODEL_UNAVAILABLE":
        await this.refresh(true).catch(() => undefined); break;
    }
    void this.report();
  }

  /** `null` means every pending result was delivered, so the "delivery pending" notice must not stay on screen. */
  noteDeliveryProblem(code: string | null): void {
    if (code) this.deliveryNotice = code;
    else if (this.deliveryNotice === "RESULT_DELIVERY_PENDING") this.deliveryNotice = null;
  }

  /** The backend refused this Desktop's credential slot: forget it so the next claim registers a fresh one. */
  async credentialRejected(): Promise<void> {
    this.registering = null;
    this.lastReported = "";
    if (this.stored) { this.stored.credentialRef = null; await this.persist().catch(() => undefined); }
  }

  // ---- backend slot -------------------------------------------------------------------------------------------

  private get file(): string { return join(this.deps.directory, "session.json"); }

  private async loadStored(): Promise<StoredSession> {
    if (this.stored) return this.stored;
    try {
      const value = JSON.parse(await readFile(this.file, "utf8")) as Partial<StoredSession>;
      if (typeof value.installationId === "string" && /^[0-9a-f-]{36}$/iu.test(value.installationId)) {
        return this.stored = { installationId: value.installationId, credentialRef: typeof value.credentialRef === "string" ? value.credentialRef : null };
      }
    } catch { /* First run or unreadable file: a new id is created below. */ }
    return this.stored = { installationId: randomUUID(), credentialRef: null };
  }

  private async persist(): Promise<void> {
    await mkdir(this.deps.directory, { recursive: true });
    await writeFile(this.file, JSON.stringify(this.stored), { encoding: "utf8", mode: 0o600 });
  }

  /** One credential per Desktop; registration is idempotent for the same fingerprint, so it runs once per process. */
  private ensureCredential(): Promise<string> {
    if (this.registering) return this.registering;
    this.registering = this.register().catch(error => { this.registering = null; throw error; });
    return this.registering;
  }

  private async register(): Promise<string> {
    const stored = await this.loadStored();
    if (!this.deviceReady) await this.deps.ensureDevice();
    this.deviceReady = true;
    const registration = (fingerprint: string) => this.deps.request<{ credentialRef: string }>(CREDENTIALS, {
      fingerprint,
      label: LABEL,
      adapterVersion: ADAPTER_VERSION,
      models: this.models.map(model => model.slug).slice(0, 32),
    });
    let registered: { credentialRef: string } | null;
    try { registered = await registration(createHash("sha256").update(`agy-cli:${stored.installationId}`).digest("hex")); }
    catch (error) {
      // The backend allows one slot per Desktop: a slot made by the earlier build keeps its own fingerprint.
      const legacy = error instanceof AnalysisBackendError && error.status === 409 ? await this.legacyFingerprint() : null;
      if (!legacy) throw error;
      registered = await registration(legacy);
    }
    if (!registered?.credentialRef) throw new AnalysisError("DEVICE_UNPAIRED", false);
    stored.credentialRef = registered.credentialRef;
    await this.persist();
    await this.report(true);
    return registered.credentialRef;
  }

  private async legacyFingerprint(): Promise<string | null> {
    try {
      const id = (await readFile(join(this.deps.directory, "agy-installation-id"), "utf8")).trim();
      return /^[0-9a-f-]{36}$/iu.test(id) ? createHash("sha256").update(id).digest("hex") : null;
    } catch { return null; }
  }

  /** Mirrors connection and quota to the backend so it can stop assigning work while the session is unusable. */
  private report(force = false): Promise<void> {
    const run = this.reporting.then(() => this.sendObservation(force));
    this.reporting = run.catch(() => undefined);
    return run;
  }

  /** Runs strictly after earlier reports and re-reads the current state, so a stale body is never sent late. */
  private async sendObservation(force: boolean): Promise<void> {
    const credentialRef = this.stored?.credentialRef;
    if (!credentialRef) return;
    const quota = this.quota();
    const body = {
      connectionState: this.connectionState,
      quotaState: quota.state,
      nextEligibleAt: quota.nextEligibleAt ? new Date(quota.nextEligibleAt).toISOString() : null,
    };
    const key = JSON.stringify(body);
    if (!force && key === this.lastReported) return;
    try { await this.deps.request(`${CREDENTIALS}/${credentialRef}/observation`, body); this.lastReported = key; }
    catch { /* The next state change or refresh retries; never blocks analysis. */ }
  }
}
