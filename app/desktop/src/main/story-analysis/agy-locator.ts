import { access } from "node:fs/promises";
import { join } from "node:path";
import type { Exec } from "./agy-exec.ts";

export interface AgyInstall { path: string; version: string }
export type LocateResult = { ok: true; install: AgyInstall } | { ok: false; issue: "AGY_NOT_FOUND" | "AGY_VERSION_UNSUPPORTED" | "PLATFORM_UNSUPPORTED" };

/** Flags this adapter relies on (--json-schema, --input-format, /usage) and the isolation spike (6b) were verified on 1.3.5. */
export const MIN_AGY_VERSION = "1.3.5";

export function compareVersions(a: string, b: string): number {
  const pa = a.split(".").map(Number), pb = b.split(".").map(Number);
  for (let i = 0; i < 3; i++) if ((pa[i] ?? 0) !== (pb[i] ?? 0)) return (pa[i] ?? 0) - (pb[i] ?? 0);
  return 0;
}

export interface LocatorDependencies {
  exec: Exec;
  env: NodeJS.ProcessEnv;
  platform: NodeJS.Platform;
  home: string;
  exists?: (path: string) => Promise<boolean>;
}

const fileExists = (path: string) => access(path).then(() => true, () => false);

/** Finds the Antigravity CLI: explicit override, PATH, then the two default install folders. */
export async function locateAgy(deps: LocatorDependencies): Promise<LocateResult> {
  if (deps.platform !== "win32") return { ok: false, issue: "PLATFORM_UNSUPPORTED" };
  const exists = deps.exists ?? fileExists;
  const candidates: string[] = [];
  if (deps.env.NARRATIVEX_AGY_PATH) candidates.push(deps.env.NARRATIVEX_AGY_PATH);
  const found = await deps.exec("where", ["agy"], { timeoutMs: 10_000 });
  if (found.exitCode === 0) candidates.push(...found.stdout.split(/\r?\n/u).map(line => line.trim()).filter(Boolean));
  if (deps.env.LOCALAPPDATA) candidates.push(join(deps.env.LOCALAPPDATA, "agy", "bin", "agy.exe"));
  candidates.push(join(deps.home, ".gemini", "bin", "agy.exe"));
  let unsupported = false;
  for (const path of [...new Set(candidates)]) {
    if (!(await exists(path))) continue;
    const result = await deps.exec(path, ["--version"], { timeoutMs: 15_000 });
    const version = /(\d+\.\d+\.\d+)/u.exec(result.stdout)?.[1];
    if (!version) continue;
    if (compareVersions(version, MIN_AGY_VERSION) < 0) { unsupported = true; continue; }
    return { ok: true, install: { path, version } };
  }
  return { ok: false, issue: unsupported ? "AGY_VERSION_UNSUPPORTED" : "AGY_NOT_FOUND" };
}

/** Caches a successful lookup so each chapter does not spawn `where` and `--version`. */
export class AgyInstallResolver {
  private cached: LocateResult | null = null;

  constructor(private readonly locate: () => Promise<LocateResult>) {}

  /** Re-checks the machine when `force` is set or the previous lookup failed. */
  async resolve(force = false): Promise<LocateResult> {
    if (!force && this.cached?.ok) return this.cached;
    this.cached = await this.locate();
    return this.cached;
  }

  async install(): Promise<AgyInstall | null> {
    const result = await this.resolve();
    return result.ok ? result.install : null;
  }
}
