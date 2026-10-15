import { randomUUID } from "node:crypto";
import { mkdir, readFile, rename, rm, writeFile } from "node:fs/promises";
import { join } from "node:path";
import type { AccountRuntime } from "./accounts.ts";
import type { StoredAccount } from "./account-vault.ts";
import { ADAPTER_VERSION, AnalysisError, type AnalysisClaim, type AnalysisCompletion } from "./types.ts";

interface Journal {
  claimRequestId: string;
  credentialRef: string;
  claim?: AnalysisClaim;
  completion?: AnalysisCompletion;
  observation?: { code: string; ambiguous: boolean };
}

/** What the worker needs from the account layer. */
export interface WorkerAccounts {
  list(): Promise<StoredAccount[]>;
  runtime(accountId: string): AccountRuntime;
  update(accountId: string, change: Partial<AccountRuntime>, report?: boolean): void;
  prepare(accountId: string): Promise<{ credentialRef: string; projectId: string }>;
}

export interface StoryAnalysisDependencies {
  accounts: WorkerAccounts;
  ready(): Promise<boolean>;
  request<T>(path: string, body: unknown): Promise<T | null>;
  run(accountId: string, projectId: string, claim: AnalysisClaim, signal: AbortSignal): Promise<AnalysisCompletion>;
  encrypt(value: string): Buffer;
  decrypt(value: Buffer): string;
  now?(): number;
}

const ROOT = "/api/v1/local-devices/chapter-analyses";
const RATE_LIMIT_BACKOFF_MS = 60_000;
const QUOTA_BACKOFF_MS = 60 * 60_000;

export class AnalysisBackendError extends Error {
  constructor(readonly status: number) { super(`Analysis backend returned ${status}`); }
}

/**
 * One worker per Google account. Accounts run in parallel; an account never runs two analyses at once.
 * The backend decides which account may claim a queued job (enable switch, quota, concurrency limits).
 */
export class StoryAnalysisService {
  private timer: NodeJS.Timeout | null = null;
  private stopped = false;
  private readonly busy = new Set<string>();
  private readonly controllers = new Map<string, AbortController>();
  private ticking = false;

  constructor(private readonly directory: string, private readonly dependencies: StoryAnalysisDependencies) {}

  start(): void {
    if (this.timer) return;
    this.stopped = false;
    this.timer = setInterval(() => { void this.tick(); }, 5_000);
    void this.tick();
  }

  stop(): void {
    this.stopped = true;
    if (this.timer) clearInterval(this.timer);
    this.timer = null;
    for (const controller of this.controllers.values()) controller.abort();
  }

  /** Starts a worker for every idle account; resolves when this round of workers has finished. */
  async tick(): Promise<void> {
    if (this.stopped || this.ticking) return;
    this.ticking = true;
    try {
      if (!(await this.dependencies.ready())) return;
      const accounts = await this.dependencies.accounts.list();
      await Promise.all(accounts.filter(a => !this.busy.has(a.accountId)).map(a => this.work(a)));
    } catch { /* The next round reports state per account. */ }
    finally { this.ticking = false; }
  }

  private now(): number { return (this.dependencies.now ?? Date.now)(); }

  private journalPath(accountId: string): string { return join(this.directory, `pending-${accountId}.encrypted`); }

  private async work(account: StoredAccount): Promise<void> {
    const id = account.accountId;
    const accounts = this.dependencies.accounts;
    this.busy.add(id);
    let journal: Journal | null = null;
    try {
      journal = await this.load(id);
      if (journal) { await this.deliverOrRecover(id, journal); return; }
      const runtime = accounts.runtime(id);
      if (runtime.connectionState === "AUTH_REQUIRED") return;
      if (runtime.nextEligibleAt !== null && runtime.nextEligibleAt > this.now()) return;
      let prepared: { credentialRef: string; projectId: string };
      try { prepared = await accounts.prepare(id); }
      catch (error) { this.fail(id, error); return; }
      journal = { claimRequestId: randomUUID(), credentialRef: prepared.credentialRef };
      // Commit local claim intent before contacting the backend.
      await this.save(id, journal);
      const claim = await this.dependencies.request<AnalysisClaim>(`${ROOT}/claim`,
        { claimRequestId: journal.claimRequestId, credentialRef: prepared.credentialRef, adapterVersion: ADAPTER_VERSION });
      if (!claim) { await this.clear(id); return; }
      journal.claim = claim;
      await this.save(id, journal);
      accounts.update(id, { activeJobId: claim.jobId });
      const controller = new AbortController();
      this.controllers.set(id, controller);
      let cancellationInFlight = false;
      const poll = setInterval(() => {
        if (cancellationInFlight) return;
        cancellationInFlight = true;
        void this.dependencies.request<boolean>(`${ROOT}/${claim.attemptId}/cancellation`, { leaseToken: claim.leaseToken })
          .then(canceled => { if (canceled) controller.abort(); })
          .catch(() => { /* A transient backend outage does not erase the running result. */ })
          .finally(() => { cancellationInFlight = false; });
      }, 5_000);
      try {
        journal.completion = await this.dependencies.run(id, prepared.projectId, claim, controller.signal);
        accounts.update(id, { connectionState: "CONNECTED", quotaState: "AVAILABLE", lastError: null, lastDiagnostic: null }, true);
      } catch (error) {
        const failure = error instanceof AnalysisError ? error : new AnalysisError("AMBIGUOUS_OUTCOME", true);
        journal.observation = { code: failure.code, ambiguous: failure.ambiguous };
        this.fail(id, failure);
      } finally {
        clearInterval(poll);
        this.controllers.delete(id);
      }
      // Preserve the exact result before delivery; retries never run inference again.
      await this.save(id, journal);
      await this.deliverOrRecover(id, journal);
    } catch (error) {
      accounts.update(id, { lastError: error instanceof AnalysisError ? error.code : "RESULT_DELIVERY_PENDING",
        lastDiagnostic: error instanceof AnalysisError ? error.diagnostic : null });
    } finally {
      accounts.update(id, { activeJobId: null });
      this.busy.delete(id);
    }
  }

  /** Records a failure on the account and applies the matching hold-off. */
  private fail(accountId: string, error: unknown): void {
    const failure = error instanceof AnalysisError ? error : new AnalysisError("PROVIDER_UNAVAILABLE", false);
    const accounts = this.dependencies.accounts;
    accounts.update(accountId, { lastDiagnostic: failure.diagnostic });
    switch (failure.code) {
      case "AUTH_REQUIRED": accounts.update(accountId, { connectionState: "AUTH_REQUIRED", lastError: failure.code }, true); break;
      case "RATE_LIMITED": accounts.update(accountId, { quotaState: "RATE_LIMITED", nextEligibleAt: this.now() + (failure.retryAfterMs ?? RATE_LIMIT_BACKOFF_MS), lastError: failure.code }, true); break;
      case "QUOTA_EXHAUSTED": accounts.update(accountId, { quotaState: "EXHAUSTED", nextEligibleAt: this.now() + (failure.retryAfterMs ?? QUOTA_BACKOFF_MS), lastError: failure.code }, true); break;
      case "PROVIDER_UNAVAILABLE": accounts.update(accountId, { connectionState: "UNAVAILABLE", lastError: failure.code }, true); break;
      default: accounts.update(accountId, { lastError: failure.code });
    }
  }

  private async deliverOrRecover(accountId: string, journal: Journal): Promise<void> {
    if (journal.completion && journal.claim) {
      try {
        await this.dependencies.request(`${ROOT}/${journal.claim.attemptId}/complete`, journal.completion);
      } catch (error) {
        if (!(error instanceof AnalysisBackendError) || ![400, 409, 422].includes(error.status)) throw error;
        const canceled = await this.dependencies.request<boolean>(`${ROOT}/${journal.claim.attemptId}/cancellation`, { leaseToken: journal.claim.leaseToken });
        // Keep the rejected result encrypted for inspection; never generate a replacement silently.
        await writeFile(join(this.directory, `${journal.claim.attemptId}.rejected.encrypted`), this.dependencies.encrypt(JSON.stringify(journal)), { mode: 0o600 });
        journal.completion = undefined;
        journal.observation = { code: canceled ? "USER_CANCELLED" : "SCHEMA_INVALID", ambiguous: false };
        this.dependencies.accounts.update(accountId, { lastError: journal.observation.code, lastDiagnostic: null });
        await this.save(accountId, journal);
        await this.dependencies.request(`${ROOT}/${journal.claim.attemptId}/observation`, { leaseToken: journal.claim.leaseToken, ...journal.observation });
      }
    } else if (journal.observation && journal.claim) {
      await this.dependencies.request(`${ROOT}/${journal.claim.attemptId}/observation`,
        { leaseToken: journal.claim.leaseToken, ...journal.observation });
    } else {
      await this.dependencies.request(`${ROOT}/recover`, { claimRequestId: journal.claimRequestId });
      this.dependencies.accounts.update(accountId, { lastError: "AMBIGUOUS_OUTCOME", lastDiagnostic: null });
    }
    await this.clear(accountId);
  }

  private async save(accountId: string, journal: Journal): Promise<void> {
    await mkdir(this.directory, { recursive: true });
    const path = this.journalPath(accountId);
    const temporary = `${path}.tmp`;
    await writeFile(temporary, this.dependencies.encrypt(JSON.stringify(journal)), { mode: 0o600 });
    await rename(temporary, path);
  }

  private async load(accountId: string): Promise<Journal | null> {
    try { return JSON.parse(this.dependencies.decrypt(await readFile(this.journalPath(accountId)))) as Journal; }
    catch (error) { if ((error as NodeJS.ErrnoException).code === "ENOENT") return null; throw error; }
  }

  private async clear(accountId: string): Promise<void> { await rm(this.journalPath(accountId), { force: true }); }
}
