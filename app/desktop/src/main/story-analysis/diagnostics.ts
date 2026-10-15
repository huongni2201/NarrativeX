import { mkdir, readFile, writeFile } from "node:fs/promises";
import { dirname } from "node:path";

const MAX_ENTRIES = 20;
const MAX_EXCERPT = 2048;

/** Masks e-mail addresses, bearer/OAuth tokens and long opaque strings before anything touches disk. */
export function redact(text: string): string {
  return text
    .replace(/([A-Za-z0-9._%+-])[A-Za-z0-9._%+-]*@([A-Za-z0-9.-]+)/gu, "$1***@$2")
    .replace(/(ya29\.|1\/\/)[A-Za-z0-9_\-.]+/gu, "<token>")
    .replace(/\bBearer\s+[A-Za-z0-9._~+/=-]+/giu, "Bearer <token>")
    .replace(/[A-Za-z0-9_-]{60,}/gu, "<long>")
    .slice(0, MAX_EXCERPT);
}

export interface DiagnosticEntry { at: string; code: string; exitCode: number | null; reason: string | null; excerpt: string }

/** Local-only ring of the latest agy failures, used to tune the error patterns. It is never uploaded. */
export class DiagnosticsLog {
  private queue: Promise<void> = Promise.resolve();

  constructor(private readonly path: string, private readonly now: () => number = Date.now) {}

  /** Serialized so parallel chapters cannot interleave a read-modify-write. */
  record(code: string, exitCode: number | null, reason: string | null, rawText: string): Promise<void> {
    const entry: DiagnosticEntry = { at: new Date(this.now()).toISOString(), code, exitCode, reason, excerpt: redact(rawText) };
    this.queue = this.queue.then(async () => {
      const entries = await this.read();
      entries.push(entry);
      await mkdir(dirname(this.path), { recursive: true });
      await writeFile(this.path, JSON.stringify(entries.slice(-MAX_ENTRIES), null, 2), { encoding: "utf8", mode: 0o600 });
    }).catch(() => undefined);
    return this.queue;
  }

  async read(): Promise<DiagnosticEntry[]> {
    try {
      const value: unknown = JSON.parse(await readFile(this.path, "utf8"));
      return Array.isArray(value) ? value as DiagnosticEntry[] : [];
    } catch { return []; }
  }
}
