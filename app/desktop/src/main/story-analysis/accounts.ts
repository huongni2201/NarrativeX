import { generateProjectId } from "./antigravity-api.ts";
import type { AccountVault, StoredAccount } from "./account-vault.ts";
import { fingerprintOf, loginWithGoogle, maskEmail, OAuthError, type OAuthDependencies } from "./oauth-flow.ts";
import type { ProfileResult } from "./oauth-profile.ts";
import { ADAPTER_VERSION, AnalysisError } from "./types.ts";
import type { AccountConnectionState, AccountQuotaState, AnalysisDiagnostic, StoryAnalysisAccount, StoryAnalysisStatus } from "../../shared/story-analysis.ts";

export interface AccountRuntime {
  connectionState: AccountConnectionState;
  quotaState: AccountQuotaState;
  nextEligibleAt: number | null;
  activeJobId: string | null;
  lastError: string | null;
  lastDiagnostic: AnalysisDiagnostic | null;
}

export type BackendRequest = <T>(path: string, body: unknown) => Promise<T | null>;

export interface AccountManagerDependencies {
  vault: AccountVault;
  profile: () => Promise<ProfileResult>;
  oauth: OAuthDependencies;
  request: BackendRequest;
  ready: () => Promise<boolean>;
  /** Pairs this installation with the backend (machine credential, not a business identity). */
  ensureDevice: () => Promise<void>;
  now?: () => number;
}

const ROOT = "/api/v1/local-devices/analysis-credentials";
export const MAX_ACCOUNTS = 16;
/** Errors that describe the connection itself; they clear once the account is prepared again. */
const CONNECTION_ERRORS = new Set(["AUTH_REQUIRED", "PROVIDER_UNAVAILABLE", "OAUTH_NOT_CONFIGURED", "ACCOUNT_NOT_ONBOARDED", "DEVICE_UNPAIRED"]);
const freshRuntime = (): AccountRuntime => ({ connectionState: "UNKNOWN", quotaState: "UNKNOWN", nextEligibleAt: null, activeJobId: null, lastError: null, lastDiagnostic: null });

/** Owns the local Google accounts and their runtime state; the backend owns enable switches and limits. */
export class AccountManager {
  private readonly runtimes = new Map<string, AccountRuntime>();
  private readonly preparing = new Map<string, Promise<{ credentialRef: string; projectId: string }>>();
  private login: AbortController | null = null;

  constructor(private readonly deps: AccountManagerDependencies) {}

  list(): Promise<StoredAccount[]> { return this.deps.vault.list(); }

  runtime(accountId: string): AccountRuntime {
    let value = this.runtimes.get(accountId);
    if (!value) { value = freshRuntime(); this.runtimes.set(accountId, value); }
    return value;
  }

  /** Updates in-memory state and mirrors connection/quota observations to the backend (best effort). */
  update(accountId: string, change: Partial<AccountRuntime>, report = false): void {
    const current = this.runtime(accountId);
    const changed = (change.connectionState !== undefined && change.connectionState !== current.connectionState)
      || (change.quotaState !== undefined && change.quotaState !== current.quotaState)
      || (change.nextEligibleAt !== undefined && change.nextEligibleAt !== current.nextEligibleAt);
    Object.assign(current, change);
    if (report && changed) void this.report(accountId);
  }

  private async report(accountId: string): Promise<void> {
    const account = (await this.list()).find(a => a.accountId === accountId);
    const runtime = this.runtime(accountId);
    if (!account?.credentialRef) return;
    try {
      await this.deps.request(`${ROOT}/${account.credentialRef}/observation`, {
        connectionState: runtime.connectionState, quotaState: runtime.quotaState,
        nextEligibleAt: runtime.nextEligibleAt ? new Date(runtime.nextEligibleAt).toISOString() : null,
      });
    } catch { /* The backend is reconciled again on the next observation. */ }
  }

  /** Registers the credential and saves a fallback project identifier locally when none is stored. */
  prepare(accountId: string): Promise<{ credentialRef: string; projectId: string }> {
    let pending = this.preparing.get(accountId);
    if (!pending) {
      pending = this.doPrepare(accountId).finally(() => { this.preparing.delete(accountId); });
      this.preparing.set(accountId, pending);
    }
    return pending;
  }

  private async doPrepare(accountId: string): Promise<{ credentialRef: string; projectId: string }> {
    let account = (await this.list()).find(a => a.accountId === accountId);
    if (!account) throw new AnalysisError("AUTH_REQUIRED", false);
    const profile = await this.deps.profile();
    if (!profile.ok) throw new AnalysisError("OAUTH_NOT_CONFIGURED", false);
    if (!account.credentialRef) {
      const registered = await this.deps.request<{ credentialRef: string }>(ROOT, {
        fingerprint: account.fingerprint, label: account.label, adapterVersion: ADAPTER_VERSION, models: [],
      });
      if (!registered?.credentialRef) throw new AnalysisError("DEVICE_UNPAIRED", false);
      account = (await this.deps.vault.patch(accountId, { credentialRef: registered.credentialRef })) ?? account;
    }
    let projectId = account.projectId;
    if (!projectId) {
      projectId = generateProjectId();
      await this.deps.vault.patch(accountId, { projectId });
    }
    const previous = this.runtime(accountId).lastError;
    const lastError = previous && CONNECTION_ERRORS.has(previous) ? null : previous;
    this.update(accountId, { connectionState: "CONNECTED", lastError,
      lastDiagnostic: lastError ? this.runtime(accountId).lastDiagnostic : null }, true);
    return { credentialRef: account.credentialRef!, projectId };
  }

  async status(): Promise<StoryAnalysisStatus> {
    const profile = await this.deps.profile();
    const accounts = await this.list();
    const now = (this.deps.now ?? Date.now)();
    const view: StoryAnalysisAccount[] = accounts.map(account => {
      const runtime = this.runtime(account.accountId);
      const waiting = runtime.nextEligibleAt !== null && runtime.nextEligibleAt > now;
      return {
        accountId: account.accountId, label: account.label, credentialRef: account.credentialRef,
        connectionState: runtime.connectionState,
        quotaState: waiting || runtime.quotaState === "AVAILABLE" || runtime.quotaState === "UNKNOWN" ? runtime.quotaState : "UNKNOWN",
        nextEligibleAt: waiting ? new Date(runtime.nextEligibleAt!).toISOString() : null,
        activeJobId: runtime.activeJobId, lastError: runtime.lastError, lastDiagnostic: runtime.lastDiagnostic, addedAt: account.addedAt,
      };
    });
    return {
      configured: profile.ok, profileIssue: profile.ok ? null : profile.issue,
      deviceReady: await this.deps.ready(), loginInProgress: this.login !== null, accounts: view,
      lastError: null,
    };
  }

  /** Opens the Google consent page in the system browser and stores the resulting account. */
  async addAccount(): Promise<StoryAnalysisStatus> {
    if (this.login) throw new OAuthError("LOGIN_IN_PROGRESS");
    const profile = await this.deps.profile();
    if (!profile.ok) throw new OAuthError("OAUTH_NOT_CONFIGURED");
    const existing = await this.list();
    const controller = new AbortController();
    this.login = controller;
    try {
      await this.deps.ensureDevice();
      const { tokens, identity } = await loginWithGoogle(profile.profile, this.deps.oauth, controller.signal);
      const fingerprint = fingerprintOf(identity.subject);
      if (existing.length >= MAX_ACCOUNTS && !existing.some(a => a.fingerprint === fingerprint)) throw new OAuthError("ACCOUNT_LIMIT_REACHED");
      const stored = await this.deps.vault.upsert({ label: maskEmail(identity.email), fingerprint }, tokens);
      // A successful login (new or repeated) clears the previous AUTH_REQUIRED state.
      this.update(stored.accountId, { connectionState: "CONNECTED", lastError: null, lastDiagnostic: null, quotaState: "UNKNOWN", nextEligibleAt: null });
      void this.prepare(stored.accountId).catch(error => {
        this.update(stored.accountId, { lastError: error instanceof AnalysisError ? error.code : "PROVIDER_UNAVAILABLE" });
      });
    } finally {
      this.login = null;
    }
    return this.status();
  }

  cancelLogin(): void { this.login?.abort(); }

  async removeAccount(accountId: string): Promise<StoryAnalysisStatus> {
    const account = (await this.list()).find(a => a.accountId === accountId);
    if (account) {
      if (this.runtime(accountId).activeJobId) throw new Error("ANALYSIS_IN_PROGRESS");
      if (account.credentialRef) {
        try { await this.deps.request(`${ROOT}/${account.credentialRef}/retire`, {}); }
        catch { throw new Error("BACKEND_UNAVAILABLE"); }
      }
      await this.deps.vault.remove(accountId);
      this.runtimes.delete(accountId);
    }
    return this.status();
  }
}
