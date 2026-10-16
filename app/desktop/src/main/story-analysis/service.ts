import { randomUUID } from "node:crypto";
import { mkdir, readdir, readFile, rename, rm, stat, writeFile } from "node:fs/promises";
import { join } from "node:path";
import type { RunHooks } from "./agy-runner.ts";
import type { Eligibility } from "./agy-session.ts";
import { ADAPTER_VERSION, AnalysisBackendError, AnalysisError, type AnalysisClaim, type AnalysisCompletion, type Violation } from "./types.ts";

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
  /** The backend refused this Desktop's credential slot; the session must register a new one. */
  credentialRejected?(): Promise<void>;
}

export interface StoryAnalysisDependencies {
  session: ServiceSession;
  request<T>(path: string, body: unknown): Promise<T | null>;
  run(claim: AnalysisClaim, signal: AbortSignal, hooks?: RunHooks): Promise<AnalysisCompletion>;
  encrypt(value: string): Buffer;
  decrypt(value: Buffer): string;
  /** A delivery call failed (HTTP status, or null for a network error). Called at most once per path/status every 10 minutes. */
  onDeliveryError?(path: string, status: number | null): void;
}

const ROOT = "/api/v1/local-devices/chapter-analyses";
const PENDING = /^pending-([0-9a-f-]{36})\.encrypted$/iu;
const TICK_MS = 5_000;
const CANCEL_POLL_MS = 5_000;
/** Rejected, corrupt and half-written journal files are kept for inspection this long. */
const KEEP_INSPECTION_FILES_MS = 30 * 24 * 60 * 60_000;
const INSPECTION_FILE = /\.(?:rejected\.encrypted|encrypted\.corrupt|encrypted\.tmp)$/iu;
/** The backend answered definitively that this call is refused, so no attempt exists to reconcile (409 is excluded: recover decides). */
const CLAIM_REFUSED = new Set([400, 401, 403, 404, 410, 422]);
/** Statuses that mean the credential slot itself is gone or no longer ours. */
const CREDENTIAL_GONE = new Set([403, 404, 410]);

/** Only a confirmed missing attempt closes a journal without acknowledgement; auth/payload failures keep it. */
const isTerminalRejection = (error: unknown): boolean =>
  error instanceof AnalysisBackendError && [404, 410].includes(error.status);
const DELIVERY_REPORT_INTERVAL_MS = 10 * 60_000;
/**
 * A result that makes the backend answer 5xx this many times in a row is treated as rejected. Retrying a deterministic
 * server-side failure (for example a database constraint) forever would block every later chapter.
 */
const MAX_SERVER_FAULTS = 5;
/** The app closed or crashed while a chapter was being analyzed and no result was kept. */
const INTERRUPTED_CODE = "APP_INTERRUPTED";

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
  /** attemptId -> what is running right now, so the UI can show that the agy process really exists. */
  private readonly activity = new Map<string, { jobId: string; startedAt: number; pid: number | null }>();
  /** `path status` -> last time it was reported, so a journal that fails every 5 s does not flood the diagnostics. */
  private readonly deliveryReports = new Map<string, number>();
  /** claimRequestId -> consecutive 5xx answers while delivering its result. */
  private readonly serverFaults = new Map<string, number>();

  constructor(private readonly directory: string, private readonly dependencies: StoryAnalysisDependencies) {}

  start(): void {
    if (this.timer) return;
    this.stopped = false;
    this.timer = setInterval(() => { void this.tick(); }, TICK_MS);
    void this.pruneInspectionFiles().catch(() => undefined);
    void this.tick();
  }

  /** Deletes old `.rejected`, `.corrupt` and `.tmp` files so they cannot pile up forever. */
  private async pruneInspectionFiles(now = Date.now()): Promise<void> {
    for (const name of await readdir(this.directory).catch(() => [] as string[])) {
      if (!INSPECTION_FILE.test(name)) continue;
      const path = join(this.directory, name);
      const modified = await stat(path).then(info => info.mtimeMs, () => now);
      if (now - modified > KEEP_INSPECTION_FILES_MS) await rm(path, { force: true }).catch(() => undefined);
    }
  }

  stop(): void {
    this.stopped = true;
    if (this.timer) clearInterval(this.timer);
    this.timer = null;
    for (const attempt of this.running.values()) attempt.controller.abort();
  }

  /** Stops claiming, aborts running attempts and waits (bounded) for their journals to be written before the app quits. */
  async shutdown(timeoutMs = 3_000): Promise<void> {
    this.stop();
    await Promise.race([this.idle(), new Promise<void>(resolve => setTimeout(resolve, timeoutMs).unref())]);
  }

  /** Chapters being analyzed by this Desktop right now, with the agy process id once it started. */
  currentActivity(): Array<{ jobId: string; startedAt: string; pid: number | null }> {
    return [...this.activity.values()].map(entry => ({ jobId: entry.jobId, startedAt: new Date(entry.startedAt).toISOString(), pid: entry.pid }));
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
      // Never claim new work while an earlier claim/result is still unreconciled: otherwise every failing tick
      // leaves one more pending journal behind and the backend can see several unresolved attempts.
      const settled = await this.settleJournals();
      if (settled) this.dependencies.session.noteDeliveryProblem(null);
      if (!settled || this.stopped) return;
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
    } catch (error) {
      try {
        if (error instanceof AnalysisBackendError && CLAIM_REFUSED.has(error.status)) {
          // A definitive refusal created no attempt; keeping the journal would only send a pointless `recover` every tick.
          if (CREDENTIAL_GONE.has(error.status)) await this.dependencies.session.credentialRejected?.().catch(() => undefined);
          await this.clear(claimRequestId);
        }
        // Otherwise the claim may have reached the backend; the kept journal is reconciled by `recover` on a later tick.
      } finally {
        this.running.delete(claimRequestId); release();
      }
      return false;
    }
    if (!claim) {
      try { await this.clear(claimRequestId); }
      finally { this.running.delete(claimRequestId); release(); }
      return false;
    }
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
    const current = { jobId: claim.jobId, startedAt: Date.now(), pid: null as number | null };
    this.activity.set(claim.attemptId, current);
    try {
      journal.completion = await this.dependencies.run(claim, controller.signal, {
        onSpawn: pid => { current.pid = pid; },
        // Best effort: the UI shows it, nothing depends on it, and an older backend without the endpoint just ignores it.
        onProgress: progress => {
          void request(`${ROOT}/${claim.attemptId}/progress`, { leaseToken: claim.leaseToken, progress }).catch(() => undefined);
        },
        // The backend's own check of a result, so one repair turn can fix what it would otherwise reject. A backend that
        // cannot answer (older, offline) simply means the result is delivered as it is.
        validate: (rawJson, windowFirst, windowLast) =>
          request<Violation[]>(`${ROOT}/${claim.attemptId}/validation`, { leaseToken: claim.leaseToken, rawJson, windowFirst, windowLast }),
      });
    } catch (error) {
      failure = error instanceof AnalysisError ? error : new AnalysisError("AMBIGUOUS_OUTCOME", true);
      // Only a cancel the backend confirmed is USER_CANCELLED. An abort caused by shutting the app down is not: the
      // backend must not read it as the person's decision. The run lived in this process and its result is gone, so it
      // is a definite failure (nothing left to reconcile) that the person can re-run, never an automatic resubmission.
      if (!canceledByUser && controller.signal.aborted) failure = new AnalysisError(INTERRUPTED_CODE, false, null, failure.diagnostic);
      journal.observation = canceledByUser
        ? { code: "USER_CANCELLED", ambiguous: false }
        : { code: failure.code, ambiguous: failure.ambiguous };
    } finally {
      clearInterval(poll);
      this.activity.delete(claim.attemptId);
    }
    try {
      // Preserve the exact result before delivery; retries never run inference again.
      await this.save(journal);
      // The hold-off is applied synchronously inside noteFailure; its slower /usage refinement (up to 45 s) must not
      // delay delivery, or the lease could expire before the observation arrives.
      let noted: Promise<void> | undefined;
      if (failure && !canceledByUser && !this.stopped) noted = session.noteFailure(failure).catch(() => undefined);
      else if (!failure) session.noteSuccess();
      await this.deliverOrRecover(journal);
      await noted;
    } catch {
      session.noteDeliveryProblem("RESULT_DELIVERY_PENDING");
    }
  }

  /** Delivers journals left by a previous run or a failed delivery. Journals of running attempts are skipped. */
  private async settleJournals(): Promise<boolean> {
    let names: string[];
    try { names = await readdir(this.directory); } catch { return true; }
    let settled = true;
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
      catch { settled = false; this.dependencies.session.noteDeliveryProblem("RESULT_DELIVERY_PENDING"); }
    }
    return settled;
  }

  private async deliverOrRecover(journal: Journal): Promise<void> {
    const { request, session } = this.dependencies;
    const id = journal.claimRequestId;
    if (journal.completion && journal.claim) {
      const completePath = `${ROOT}/${journal.claim.attemptId}/complete`;
      try {
        await request(completePath, journal.completion);
      } catch (error) {
        this.reportDeliveryError(completePath, error);
        if (isTerminalRejection(error)) {
          // The backend no longer knows this attempt, so retrying can never succeed — and a journal that is retried
          // forever blocks every new claim (jobs stay QUEUED). Keep the result encrypted for inspection and move on.
          await this.keepRejected(journal);
          session.noteDeliveryProblem("AMBIGUOUS_OUTCOME");
          await this.clear(id);
          return;
        }
        const serverFault = error instanceof AnalysisBackendError && error.status >= 500 && this.countServerFault(id) >= MAX_SERVER_FAULTS;
        if (!(error instanceof AnalysisBackendError) || !([400, 409, 422].includes(error.status) || serverFault)) throw error;
        // A vanished attempt (404/410) at this point means it was not cancelled by the user; it must not stick either.
        const canceled = serverFault ? false : await request<boolean>(`${ROOT}/${journal.claim.attemptId}/cancellation`, { leaseToken: journal.claim.leaseToken })
          .catch(problem => { if (isTerminalRejection(problem)) return false; throw problem; });
        // Keep the rejected result encrypted for inspection; never generate a replacement silently.
        await this.keepRejected(journal);
        journal.completion = undefined;
        journal.observation = { code: canceled ? "USER_CANCELLED" : "SCHEMA_INVALID", ambiguous: false };
        session.noteDeliveryProblem(journal.observation.code);
        await this.save(journal);
        await this.sendTerminal(`${ROOT}/${journal.claim.attemptId}/observation`, { leaseToken: journal.claim.leaseToken, ...journal.observation });
      }
    } else if (journal.observation && journal.claim) {
      await this.sendTerminal(`${ROOT}/${journal.claim.attemptId}/observation`, { leaseToken: journal.claim.leaseToken, ...journal.observation });
    } else {
      // Interrupted before the result was kept: the backend fails the attempt so the person can re-run it. Nothing is resubmitted.
      await this.sendTerminal(`${ROOT}/recover`, { claimRequestId: journal.claimRequestId });
      session.noteDeliveryProblem(INTERRUPTED_CODE);
    }
    await this.clear(id);
  }

  /** Authentication or payload rejection is not acknowledgement that the backend settled this attempt. */
  private async sendTerminal(path: string, body: unknown): Promise<void> {
    try { await this.dependencies.request(path, body); }
    catch (error) {
      this.reportDeliveryError(path, error);
      if (!isTerminalRejection(error)) throw error;
    }
  }

  /** Writes the undeliverable result next to the journal; `pruneInspectionFiles` removes it after 30 days. */
  private async keepRejected(journal: Journal): Promise<void> {
    if (!journal.claim) return;
    await mkdir(this.directory, { recursive: true });
    await writeFile(join(this.directory, `${journal.claim.attemptId}.rejected.encrypted`), this.dependencies.encrypt(JSON.stringify(journal)), { mode: 0o600 });
  }

  /** Tells the host why delivery fails (status code), at most once per 10 minutes per path/status. */
  private reportDeliveryError(path: string, error: unknown): void {
    const status = error instanceof AnalysisBackendError ? error.status : null;
    const key = `${path} ${status}`;
    const now = Date.now();
    if (now - (this.deliveryReports.get(key) ?? 0) < DELIVERY_REPORT_INTERVAL_MS) return;
    this.deliveryReports.set(key, now);
    try { this.dependencies.onDeliveryError?.(path, status); } catch { /* Diagnostics must never break delivery. */ }
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

  private countServerFault(claimRequestId: string): number {
    const count = (this.serverFaults.get(claimRequestId) ?? 0) + 1;
    this.serverFaults.set(claimRequestId, count);
    return count;
  }

  private async clear(claimRequestId: string): Promise<void> {
    this.serverFaults.delete(claimRequestId);
    await rm(this.journalPath(claimRequestId), { force: true });
  }
}
