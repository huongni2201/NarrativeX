import { randomUUID } from "node:crypto";
import { mkdir, readdir, readFile, rename, rm, writeFile } from "node:fs/promises";
import { join } from "node:path";
import type { Eligibility } from "./agy-session.ts";
import { ADAPTER_VERSION, AnalysisBackendError, AnalysisError, type AnalysisClaim, type AnalysisCompletion } from "./types.ts";

/** The only parts of a claim that must survive a restart; the chapter text is never kept after claiming. */
interface JournalClaim { jobId: string; attemptId: string; leaseToken: string }

/** One encrypted file per attempt, written before each step so a crash never repeats inference. */
interface Journal {
  claimRequestId: string;
  credentialRef: string;
  claim?: JournalClaim;
  completion?: AnalysisCompletion;
  observation?: { code: string; ambiguous: boolean };
}

/** What the worker needs from the agy session. */
export interface ServiceSession {
  eligibility(): Promise<Eligibility | null>;
  noteSuccess(): void;
  noteFailure(error: AnalysisError): Promise<void>;
  noteDeliveryProblem(code: string | null): void;
  setRunning(count: number): void;
}

export interface StoryAnalysisDependencies {
  session: ServiceSession;
  request<T>(path: string, body: unknown): Promise<T | null>;
  run(claim: AnalysisClaim, signal: AbortSignal): Promise<AnalysisCompletion>;
  encrypt(value: string): Buffer;
  decrypt(value: Buffer): string;
}

const ROOT = "/api/v1/local-devices/chapter-analyses";
const PENDING = /^pending-([0-9a-f-]{36})\.encrypted$/iu;
const TICK_MS = 5_000;
const CANCEL_POLL_MS = 5_000;

/** The backend will not accept this call again, so retrying the journal would loop forever. */
const isTerminalRejection = (error: unknown): boolean =>
  error instanceof AnalysisBackendError && error.status >= 400 && error.status < 500 && error.status !== 408 && error.status !== 429;

/**
 * Claims chapters for the one agy session and runs up to `maxParallel` at once.
 * Claim, completion and observation are journaled per attempt; a result is delivered at most once and never regenerated.
 */
export class StoryAnalysisService {
  private timer: NodeJS.Timeout | null = null;
  private stopped = false;
  private ticking = false;
  /** claimRequestId -> running attempt (claim in flight or inference running). */
  private readonly running = new Map<string, { controller: AbortController; done: Promise<void> }>();

  constructor(private readonly directory: string, private readonly dependencies: StoryAnalysisDependencies) {}

  start(): void {
    if (this.timer) return;
    this.stopped = false;
    this.timer = setInterval(() => { void this.tick(); }, TICK_MS);
    void this.tick();
  }

  stop(): void {
    this.stopped = true;
    if (this.timer) clearInterval(this.timer);
    this.timer = null;
    for (const attempt of this.running.values()) attempt.controller.abort();
  }

  /** Resolves when every attempt started so far has finished (used by tests and shutdown). */
  async idle(): Promise<void> {
    while (this.running.size) await Promise.allSettled([...this.running.values()].map(attempt => attempt.done));
  }

  /** Delivers leftover journals, then fills the free parallel slots. Resolves once claiming is done, not when inference ends. */
  async tick(): Promise<void> {
    if (this.stopped || this.ticking) return;
    this.ticking = true;
    try {
      await this.settleJournals();
      const eligibility = await this.dependencies.session.eligibility();
      if (!eligibility || this.stopped) return;
      while (!this.stopped && this.running.size < eligibility.maxParallel) {
        if (!(await this.startOne(eligibility.credentialRef))) break;
      }
    } catch { /* The session reports the reason; the next tick tries again. */ }
    finally {
      this.ticking = false;
      this.dependencies.session.setRunning(this.running.size);
    }
  }

  private journalPath(claimRequestId: string): string { return join(this.directory, `pending-${claimRequestId}.encrypted`); }

  /** Claims one job; returns false when nothing was claimed, so the loop stops asking. */
  private async startOne(credentialRef: string): Promise<boolean> {
    const claimRequestId = randomUUID();
    const controller = new AbortController();
    let release!: () => void;
    const done = new Promise<void>(resolve => { release = resolve; });
    this.running.set(claimRequestId, { controller, done });
    const journal: Journal = { claimRequestId, credentialRef };
    let claim: AnalysisClaim | null;
    try {
      // Commit local claim intent before contacting the backend.
      await this.save(journal);
      claim = await this.dependencies.request<AnalysisClaim>(`${ROOT}/claim`, { claimRequestId, credentialRef, adapterVersion: ADAPTER_VERSION });
    } catch {
      // The claim may have reached the backend; the kept journal is reconciled by `recover` on a later tick.
      this.running.delete(claimRequestId); release();
      return false;
    }
    if (!claim) { await this.clear(claimRequestId); this.running.delete(claimRequestId); release(); return false; }
    journal.claim = { jobId: claim.jobId, attemptId: claim.attemptId, leaseToken: claim.leaseToken };
    try { await this.save(journal); }
    catch {
      // Without a journal the lease cannot be tracked; report it as unresolved instead of running blind.
      journal.observation = { code: "AMBIGUOUS_OUTCOME", ambiguous: true };
      void this.deliverOrRecover(journal).catch(() => undefined).finally(() => { this.running.delete(claimRequestId); release(); });
      return true;
    }
    void this.execute(journal, claim, controller).finally(() => {
      this.running.delete(claimRequestId);
      this.dependencies.session.setRunning(this.running.size);
      release();
    });
    return true;
  }

  private async execute(journal: Journal, claim: AnalysisClaim, controller: AbortController): Promise<void> {
    const { session, request } = this.dependencies;
    let canceledByUser = false;
    let polling = false;
    const poll = setInterval(() => {
      if (polling) return;
      polling = true;
      void request<boolean>(`${ROOT}/${claim.attemptId}/cancellation`, { leaseToken: claim.leaseToken })
        .then(canceled => { if (canceled) { canceledByUser = true; controller.abort(); } })
        .catch(() => { /* A transient backend outage does not erase the running result. */ })
        .finally(() => { polling = false; });
    }, CANCEL_POLL_MS);
    let failure: AnalysisError | null = null;
    try {
      journal.completion = await this.dependencies.run(claim, controller.signal);
    } catch (error) {
      failure = error instanceof AnalysisError ? error : new AnalysisError("AMBIGUOUS_OUTCOME", true);
      // A cancel the backend confirmed is a known outcome, not an unresolved one.
      journal.observation = canceledByUser
        ? { code: "USER_CANCELLED", ambiguous: false }
        : { code: failure.code, ambiguous: failure.ambiguous };
    } finally {
      clearInterval(poll);
    }
    try {
      // Preserve the exact result before delivery; retries never run inference again.
      await this.save(journal);
      if (failure && !canceledByUser) await session.noteFailure(failure); else if (!failure) session.noteSuccess();
      await this.deliverOrRecover(journal);
    } catch {
      session.noteDeliveryProblem("RESULT_DELIVERY_PENDING");
    }
  }

  /** Delivers journals left by a previous run or a failed delivery. Journals of running attempts are skipped. */
  private async settleJournals(): Promise<void> {
    let names: string[];
    try { names = await readdir(this.directory); } catch { return; }
    for (const name of names) {
      const id = PENDING.exec(name)?.[1];
      if (!id || this.running.has(id) || this.stopped) continue;
      let journal: Journal | null;
      try { journal = await this.load(id); }
      catch {
        // An unreadable journal cannot be resolved here; keep it for inspection and stop retrying it.
        await rename(this.journalPath(id), `${this.journalPath(id)}.corrupt`).catch(() => undefined);
        continue;
      }
      if (!journal) continue;
      try { await this.deliverOrRecover(journal); }
      catch { this.dependencies.session.noteDeliveryProblem("RESULT_DELIVERY_PENDING"); }
    }
  }

  private async deliverOrRecover(journal: Journal): Promise<void> {
    const { request, session } = this.dependencies;
    const id = journal.claimRequestId;
    if (journal.completion && journal.claim) {
      try {
        await request(`${ROOT}/${journal.claim.attemptId}/complete`, journal.completion);
      } catch (error) {
        if (!(error instanceof AnalysisBackendError) || ![400, 409, 422].includes(error.status)) throw error;
        const canceled = await request<boolean>(`${ROOT}/${journal.claim.attemptId}/cancellation`, { leaseToken: journal.claim.leaseToken });
        // Keep the rejected result encrypted for inspection; never generate a replacement silently.
        await mkdir(this.directory, { recursive: true });
        await writeFile(join(this.directory, `${journal.claim.attemptId}.rejected.encrypted`), this.dependencies.encrypt(JSON.stringify(journal)), { mode: 0o600 });
        journal.completion = undefined;
        journal.observation = { code: canceled ? "USER_CANCELLED" : "SCHEMA_INVALID", ambiguous: false };
        session.noteDeliveryProblem(journal.observation.code);
        await this.save(journal);
        await this.sendTerminal(`${ROOT}/${journal.claim.attemptId}/observation`, { leaseToken: journal.claim.leaseToken, ...journal.observation });
      }
    } else if (journal.observation && journal.claim) {
      await this.sendTerminal(`${ROOT}/${journal.claim.attemptId}/observation`, { leaseToken: journal.claim.leaseToken, ...journal.observation });
    } else {
      // Interrupted before the result was kept: the backend marks the attempt UNKNOWN. Nothing is resubmitted.
      await this.sendTerminal(`${ROOT}/recover`, { claimRequestId: journal.claimRequestId });
      session.noteDeliveryProblem("AMBIGUOUS_OUTCOME");
    }
    await this.clear(id);
  }

  /** Sends a final report; a permanent 4xx rejection closes the journal instead of looping. */
  private async sendTerminal(path: string, body: unknown): Promise<void> {
    try { await this.dependencies.request(path, body); }
    catch (error) { if (!isTerminalRejection(error)) throw error; }
  }

  private async save(journal: Journal): Promise<void> {
    await mkdir(this.directory, { recursive: true });
    const path = this.journalPath(journal.claimRequestId);
    const temporary = `${path}.tmp`;
    await writeFile(temporary, this.dependencies.encrypt(JSON.stringify(journal)), { mode: 0o600 });
    await rename(temporary, path);
  }

  private async load(claimRequestId: string): Promise<Journal | null> {
    try { return JSON.parse(this.dependencies.decrypt(await readFile(this.journalPath(claimRequestId)))) as Journal; }
    catch (error) { if ((error as NodeJS.ErrnoException).code === "ENOENT") return null; throw error; }
  }

  private async clear(claimRequestId: string): Promise<void> { await rm(this.journalPath(claimRequestId), { force: true }); }
}
