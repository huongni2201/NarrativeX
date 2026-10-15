import { stat } from "node:fs/promises";
import { sha256File } from "./file-integrity.ts";

/**
 * `fast`: trust a previous full hash while the file's size, mtime and inode are unchanged.
 * `full`: always re-hash (final render, upload and manual verification keep full integrity).
 */
export type IntegrityMode = "fast" | "full";

interface IntegrityEntry {
  size: number;
  mtimeMs: number;
  ino: number;
  sha256: string;
}

export interface IntegrityCacheOptions {
  maxEntries?: number;
  /** Injectable for tests; defaults to a streaming SHA-256 of the whole file. */
  hashFile?: (path: string) => Promise<string>;
}

const DEFAULT_MAX_ENTRIES = 5_000;

/**
 * Remembers the SHA-256 of files together with the stat signature they were hashed under, so a
 * repeated read of an unchanged file costs one `stat` instead of a full hash. Entries are an LRU
 * and concurrent hashes of the same file revision are joined.
 */
export class IntegrityCache {
  private readonly entries = new Map<string, IntegrityEntry>();
  private readonly inflight = new Map<string, Promise<string>>();
  private readonly maxEntries: number;
  private readonly hashFile: (path: string) => Promise<string>;

  constructor(options: IntegrityCacheOptions = {}) {
    this.maxEntries = options.maxEntries ?? DEFAULT_MAX_ENTRIES;
    this.hashFile = options.hashFile ?? sha256File;
  }

  get size(): number {
    return this.entries.size;
  }

  /** True when the file currently hashes to `expectedSha256`. */
  async verifyFile(path: string, expectedSha256: string, mode: IntegrityMode): Promise<boolean> {
    return (await this.sha256(path, mode)) === expectedSha256.toLowerCase();
  }

  async sha256(path: string, mode: IntegrityMode): Promise<string> {
    // The signature is taken before hashing: a file that changes mid-hash is then re-hashed on the
    // next call because its signature no longer matches the one stored here.
    const fileStat = await stat(path);
    const signature: Omit<IntegrityEntry, "sha256"> = {
      size: fileStat.size,
      mtimeMs: fileStat.mtimeMs,
      ino: fileStat.ino,
    };
    if (mode === "fast") {
      const cached = this.entries.get(path);
      if (cached && sameSignature(cached, signature)) {
        this.touch(path, cached);
        return cached.sha256;
      }
      const key = `${path}\0${signature.size}\0${signature.mtimeMs}\0${signature.ino}`;
      const running = this.inflight.get(key);
      if (running) return running;
      const hashing = this.hashAndStore(path, signature).finally(() => this.inflight.delete(key));
      this.inflight.set(key, hashing);
      return hashing;
    }
    return this.hashAndStore(path, signature);
  }

  /** Drops what is known about a path, for example right before it is overwritten. */
  invalidate(path: string): void {
    this.entries.delete(path);
  }

  private async hashAndStore(
    path: string,
    signature: Omit<IntegrityEntry, "sha256">,
  ): Promise<string> {
    const sha256 = (await this.hashFile(path)).toLowerCase();
    this.touch(path, { ...signature, sha256 });
    return sha256;
  }

  private touch(path: string, entry: IntegrityEntry): void {
    this.entries.delete(path);
    this.entries.set(path, entry);
    while (this.entries.size > this.maxEntries) {
      const oldest = this.entries.keys().next();
      if (oldest.done) break;
      this.entries.delete(oldest.value);
    }
  }
}

function sameSignature(entry: IntegrityEntry, signature: Omit<IntegrityEntry, "sha256">): boolean {
  return (
    entry.size === signature.size &&
    entry.mtimeMs === signature.mtimeMs &&
    entry.ino === signature.ino
  );
}

/** Shared by the project storage and the render segment cache. */
export const sharedIntegrityCache = new IntegrityCache();
