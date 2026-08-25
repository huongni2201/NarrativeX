import { readFile, readdir, rename, writeFile } from "node:fs/promises";
import { join } from "node:path";

export type RenderJournalStage = "CLAIMED" | "MATERIALIZING" | "SEGMENT_RENDER" | "VIDEO_CONCAT" | "AUDIO_CONCAT" | "MUX" | "VERIFY" | "REGISTER" | "COMPLETED" | "FAILED";

export interface RenderJournal {
  version: 1;
  projectId: string;
  jobId: string;
  renderFingerprint: string;
  stage: RenderJournalStage;
  workDirectory: string;
  updatedAt: string;
  errorCode?: string;
}

export interface UnfinishedRenderJournal extends RenderJournal {
  journalPath: string;
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
    await writeFile(temporary, `${JSON.stringify(journal, null, 2)}\n`, "utf8");
    await rename(temporary, path);
  }

  async advance(current: RenderJournal, stage: RenderJournalStage, errorCode?: string): Promise<RenderJournal> {
    const next: RenderJournal = { ...current, stage, updatedAt: new Date().toISOString(), ...(errorCode ? { errorCode } : {}) };
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
          if (journal.stage !== "COMPLETED" && journal.stage !== "FAILED") result.push({ ...journal, journalPath });
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
