import { spawn } from "node:child_process";

export interface ExecOptions {
  cwd?: string;
  env?: NodeJS.ProcessEnv;
  /** UTF-8 text written to stdin, then stdin is closed. */
  stdin?: string;
  timeoutMs: number;
  signal?: AbortSignal;
  /** How long to wait for the process to close after it was killed before giving up on it (default 10 s). */
  hardStopMs?: number;
  /** A complete agy stream-json result ends the turn even if the CLI fails to exit. */
  completeOnResult?: boolean;
  /** Called once with the child's process id right after it started. */
  onSpawn?: (pid: number) => void;
}

export interface ExecResult {
  exitCode: number | null;
  stdout: string;
  stderr: string;
  timedOut: boolean;
  aborted: boolean;
  /** Set when the process could not be started at all (nothing was sent to the provider). */
  spawnError: string | null;
  /** True when stdout or stderr hit the capture cap, so the tail of the output is missing. */
  truncated?: boolean;
  /** An authoritative terminal stream event was received before timeout or cancellation. */
  resultReceived?: boolean;
}

export type Exec = (file: string, args: string[], options: ExecOptions) => Promise<ExecResult>;

/** Cap on captured characters per stream. */
const MAX_OUTPUT_CHARS = 16 * 1024 * 1024;
/** If `close` never arrives after a kill (taskkill failed, a grandchild holds the pipes), give up waiting. */
const HARD_STOP_MS = 10_000;
const RESULT_EXIT_GRACE_MS = 1_000;

function killTree(pid: number | undefined): void {
  if (!pid) return;
  try {
    if (process.platform === "win32") spawn("taskkill", ["/pid", String(pid), "/T", "/F"], { windowsHide: true, stdio: "ignore" }).on("error", () => undefined);
    else process.kill(pid, "SIGKILL");
  } catch { /* The process already exited. */ }
}

/** Runs a command without a shell. Output is captured as UTF-8 and capped; the whole process tree is killed on timeout or abort. */
export const nodeExec: Exec = (file, args, options) => new Promise(resolve => {
  let stdout = "", stderr = "", timedOut = false, aborted = false, settled = false, truncated = false, resultReceived = false;
  let hardStop: NodeJS.Timeout | undefined;
  let resultExit: NodeJS.Timeout | undefined;
  let lineStart = 0;
  const finish = (result: Partial<ExecResult>) => {
    if (settled) return;
    settled = true;
    clearTimeout(timer);
    clearTimeout(hardStop);
    clearTimeout(resultExit);
    options.signal?.removeEventListener("abort", onAbort);
    resolve({ exitCode: null, stdout, stderr, timedOut, aborted, spawnError: null, truncated, resultReceived, ...result });
  };
  let child: ReturnType<typeof spawn>;
  try {
    child = spawn(file, args, { cwd: options.cwd, env: options.env, windowsHide: true, stdio: ["pipe", "pipe", "pipe"] });
  } catch (error) { resolve({ exitCode: null, stdout: "", stderr: "", timedOut: false, aborted: false, spawnError: (error as Error).message }); return; }
  if (child.pid !== undefined) { try { options.onSpawn?.(child.pid); } catch { /* Progress reporting must never break the run. */ } }
  const stop = () => {
    killTree(child.pid);
    hardStop ??= setTimeout(() => { child.stdout?.destroy(); child.stderr?.destroy(); finish({}); }, options.hardStopMs ?? HARD_STOP_MS);
  };
  const onAbort = () => { if (!resultReceived) { aborted = true; stop(); } };
  const timer = setTimeout(() => { timedOut = true; stop(); }, options.timeoutMs);
  if (options.signal?.aborted) onAbort(); else options.signal?.addEventListener("abort", onAbort, { once: true });
  child.stdout?.setEncoding("utf8").on("data", (chunk: string) => {
    if (settled || resultReceived) return;
    if (stdout.length + chunk.length > MAX_OUTPUT_CHARS) { truncated = true; stdout += chunk.slice(0, MAX_OUTPUT_CHARS - stdout.length); }
    else stdout += chunk;
    if (!options.completeOnResult || truncated || aborted || timedOut) return;
    let lineEnd: number;
    while ((lineEnd = stdout.indexOf("\n", lineStart)) >= 0) {
      const line = stdout.slice(lineStart, lineEnd);
      lineStart = lineEnd + 1;
      try {
        const event = JSON.parse(line);
        if (event?.event !== "result" || !event.result || Array.isArray(event.result) || typeof event.result.status !== "string") continue;
        resultReceived = true;
        stdout = stdout.slice(0, lineStart);
        clearTimeout(timer);
        // Keep the result; give agy a moment to exit, then reap only this process tree.
        resultExit = setTimeout(stop, RESULT_EXIT_GRACE_MS);
        break;
      } catch { /* Incomplete/malformed output is never a terminal signal. */ }
    }
  });
  child.stderr?.setEncoding("utf8").on("data", (chunk: string) => { if (stderr.length < MAX_OUTPUT_CHARS) stderr += chunk; else truncated = true; });
  child.on("error", error => finish({ spawnError: error.message }));
  child.on("close", code => finish({ exitCode: code }));
  child.stdin?.on("error", () => undefined);
  child.stdin?.end(options.stdin ?? "", "utf8");
});
