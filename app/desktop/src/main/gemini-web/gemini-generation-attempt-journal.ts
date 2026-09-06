import { mkdir, readFile, rename, writeFile } from "node:fs/promises";
import { dirname, join } from "node:path";
import type { GeminiWebLane } from "../../shared/gemini-web-lanes";

export type GeminiGenerationAttemptStage =
  | "PREPARED"
  | "SUBMITTING"
  | "COMPLETED"
  | "FAILED"
  | "UNKNOWN";

export interface GeminiGenerationAttemptRecord {
  attemptId: string;
  lane: GeminiWebLane;
  projectId: string | null;
  batchId: string | null;
  snapshotId: string | null;
  batchFingerprint: string | null;
  inputFingerprint: string | null;
  stylePolicyVersion: string | null;
  providerPolicyVersion: string | null;
  stage: GeminiGenerationAttemptStage;
  outputChecksumSha256: string | null;
  errorCode: string | null;
  updatedAt: string;
}

const MAX_ATTEMPTS = 2_000;

type JournalDocument = { schemaVersion: 1; attempts: GeminiGenerationAttemptRecord[] };

export class GeminiGenerationAttemptJournal {
  private readonly filePath: string;
  private writeChain: Promise<void> = Promise.resolve();

  constructor(rootDirectory: string) {
    this.filePath = join(rootDirectory, "attempt-journal.json");
  }

  async get(attemptId: string): Promise<GeminiGenerationAttemptRecord | null> {
    await this.writeChain;
    const document = await this.readDocument();
    return document.attempts.find((attempt) => attempt.attemptId === attemptId) ?? null;
  }

  async begin(record: Omit<GeminiGenerationAttemptRecord, "stage" | "outputChecksumSha256" | "errorCode" | "updatedAt">) {
    return this.mutate((document) => {
      const existing = document.attempts.find((attempt) => attempt.attemptId === record.attemptId);
      if (existing) {
        if (
          existing.inputFingerprint !== record.inputFingerprint ||
          existing.snapshotId !== record.snapshotId ||
          existing.batchId !== record.batchId
        ) {
          throw new Error("GEMINI_ATTEMPT_ID_CONFLICT: attemptId is already bound to different generation inputs.");
        }
        return existing;
      }
      const next: GeminiGenerationAttemptRecord = {
        ...record,
        stage: "PREPARED",
        outputChecksumSha256: null,
        errorCode: null,
        updatedAt: new Date().toISOString(),
      };
      document.attempts.push(next);
      if (document.attempts.length > MAX_ATTEMPTS) {
        document.attempts.splice(0, document.attempts.length - MAX_ATTEMPTS);
      }
      return next;
    });
  }

  async update(
    attemptId: string,
    stage: GeminiGenerationAttemptStage,
    details: { outputChecksumSha256?: string | null; errorCode?: string | null } = {},
  ) {
    return this.mutate((document) => {
      const attempt = document.attempts.find((candidate) => candidate.attemptId === attemptId);
      if (!attempt) throw new Error("Gemini generation attempt is not journaled.");
      attempt.stage = stage;
      if (details.outputChecksumSha256 !== undefined) {
        attempt.outputChecksumSha256 = details.outputChecksumSha256;
      }
      if (details.errorCode !== undefined) attempt.errorCode = details.errorCode;
      attempt.updatedAt = new Date().toISOString();
      return attempt;
    });
  }

  private async mutate<T>(mutator: (document: JournalDocument) => T): Promise<T> {
    let result!: T;
    const operation = this.writeChain.then(async () => {
      const document = await this.readDocument();
      result = mutator(document);
      await mkdir(dirname(this.filePath), { recursive: true });
      const temporaryPath = `${this.filePath}.tmp`;
      await writeFile(temporaryPath, JSON.stringify(document, null, 2), "utf8");
      await rename(temporaryPath, this.filePath);
    });
    this.writeChain = operation.catch(() => undefined);
    await operation;
    return result;
  }

  private async readDocument(): Promise<JournalDocument> {
    try {
      const parsed = JSON.parse(await readFile(this.filePath, "utf8")) as Partial<JournalDocument>;
      if (parsed.schemaVersion === 1 && Array.isArray(parsed.attempts)) {
        return { schemaVersion: 1, attempts: parsed.attempts as GeminiGenerationAttemptRecord[] };
      }
    } catch {
      // Missing or invalid local execution journal starts empty; backend snapshots remain authoritative.
    }
    return { schemaVersion: 1, attempts: [] };
  }
}

export function geminiAttemptErrorCode(error: unknown): string | null {
  const text = error instanceof Error ? error.message : String(error ?? "");
  const match = text.match(/\b(GEMINI_[A-Z0-9_]+|REFERENCE_[A-Z0-9_]+)\b/);
  return match?.[1] ?? null;
}
