import { mkdir, readFile, readdir, rename, writeFile } from "node:fs/promises";
import { dirname, join } from "node:path";

export type RenderJournalStage =
  | "CLAIMED"
  | "MATERIALIZING"
  | "SEGMENT_RENDER"
  | "VIDEO_CONCAT"
  | "AUDIO_CONCAT"
  | "MUX"
  | "VERIFY"
  | "REGISTER"
  | "COMPLETED"
  | "FAILED"
  | "CANCELLED";

export type RenderJournalTerminalState = "SUCCESS" | "KNOWN_FAILURE" | "USER_CANCELLED";
export type RenderRecoveryAction = "NO_OP" | "RETRY_STAGE" | "RERUN_RENDER" | "RECONCILE_REGISTER" | "USER_RETRY";

export interface RenderJournal {
  version: 1;
  projectId: string;
  jobId: string;
  renderFingerprint: string;
  stage: RenderJournalStage;
  workDirectory: string;
  updatedAt: string;
  terminalState?: RenderJournalTerminalState;
  errorCode?: string;
  failedStage?: RenderJournalStage;
  errorDetail?: string;
  retryable?: boolean;
}

export interface UnfinishedRenderJournal extends RenderJournal {
  journalPath: string;
}

export function recoveryActionForStage(stage: RenderJournalStage): RenderRecoveryAction {
  if (stage === "REGISTER") return "RECONCILE_REGISTER";
  if (stage === "SEGMENT_RENDER" || stage === "VIDEO_CONCAT" || stage === "AUDIO_CONCAT" || stage === "MUX") return "RERUN_RENDER";
  if (stage === "CLAIMED" || stage === "MATERIALIZING" || stage === "VERIFY") return "RETRY_STAGE";
  if (stage === "COMPLETED") return "NO_OP";
  return "USER_RETRY";
}

export class RenderJournalStore {
  private readonly projectsRoot: string;

  constructor(projectsRoot: string) { this.projectsRoot = projectsRoot; }

  async load(projectId: string, jobId: string): Promise<RenderJournal | null> {
    const path = this.path(projectId, jobId);
    try { return JSON.parse(await readFile(path, "utf8")) as RenderJournal; } catch (error) { if (isMissing(error)) return null; throw error; }
  }

  async save(journal: RenderJournal): Promise<void> {
    const path = this.path(journal.projectId, journal.jobId);
    const temporary = `${path}.${process.pid}.${Date.now()}.tmp`;
    await mkdir(dirname(path), { recursive: true });
    await writeFile(temporary, `${JSON.stringify(journal, null, 2)}\n`, "utf8");
    await rename(temporary, path);
  }

  async advance(current: RenderJournal, stage: RenderJournalStage, errorCode?: string): Promise<RenderJournal> {
    const next: RenderJournal = {
      ...current,
      stage,
      updatedAt: new Date().toISOString(),
      ...(errorCode ? { errorCode } : {}),
      ...(errorCode ? {} : { errorCode: undefined, failedStage: undefined, errorDetail: undefined, retryable: undefined }),
      ...(stage === "COMPLETED" ? { terminalState: "SUCCESS" as const } : {}),
      ...(stage === "CANCELLED" ? { terminalState: "USER_CANCELLED" as const } : {}),
      ...(stage !== "COMPLETED" && stage !== "CANCELLED" ? { terminalState: undefined } : {}),
    };
    await this.save(next);
    return next;
  }

  async fail(
    current: RenderJournal,
    errorCode: string,
    failedStage: RenderJournalStage,
    errorDetail: string,
    retryable: boolean,
  ): Promise<RenderJournal> {
    const next: RenderJournal = {
      ...current,
      stage: retryable ? failedStage : "FAILED",
      terminalState: retryable ? undefined : "KNOWN_FAILURE",
      errorCode,
      failedStage,
      errorDetail: sanitizeJournalDetail(errorDetail),
      retryable,
      updatedAt: new Date().toISOString(),
    };
    await this.save(next);
    return next;
  }

  async listUnfinished(): Promise<UnfinishedRenderJournal[]> {
    const result: UnfinishedRenderJournal[] = [];
    for (const project of await safeDirectories(this.projectsRoot)) {
      const workRoot = join(this.projectsRoot, project, "work");
      for (const job of await safeDirectories(workRoot)) {
        const journalPath = join(workRoot, job, "render.state.json");
        try {
          const journal = JSON.parse(await readFile(journalPath, "utf8")) as RenderJournal;
          if (journal.stage !== "COMPLETED" && journal.stage !== "FAILED" && journal.stage !== "CANCELLED") result.push({ ...journal, journalPath });
        } catch (error) {
          if (!isMissing(error)) throw error;
        }
      }
    }
    return result.sort((left, right) => left.updatedAt.localeCompare(right.updatedAt));
  }

  private path(projectId: string, jobId: string): string { return join(this.projectsRoot, projectId, "work", jobId, "render.state.json"); }
}

async function safeDirectories(path: string): Promise<string[]> {
  try { return (await readdir(path, { withFileTypes: true })).filter((entry) => entry.isDirectory()).map((entry) => entry.name); } catch (error) { if (isMissing(error)) return []; throw error; }
}

function isMissing(error: unknown): boolean { return typeof error === "object" && error !== null && "code" in error && error.code === "ENOENT"; }

function sanitizeJournalDetail(value: string): string {
  return value
    .replace(/https?:\/\/[^\s]+/gi, "[redacted-url]")
    .replace(/(token|secret|password|signature)=([^&\s]+)/gi, "$1=[redacted]")
    .slice(0, 1_000);
}
