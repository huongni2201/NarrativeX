import { spawn } from "node:child_process";

export interface ExecOptions {
  cwd?: string;
  env?: NodeJS.ProcessEnv;
  /** UTF-8 text written to stdin, then stdin is closed. */
  stdin?: string;
  timeoutMs: number;
  signal?: AbortSignal;
}

export interface ExecResult {
  exitCode: number | null;
  stdout: string;
  stderr: string;
  timedOut: boolean;
  aborted: boolean;
  /** Set when the process could not be started at all (nothing was sent to the provider). */
  spawnError: string | null;
}

export type Exec = (file: string, args: string[], options: ExecOptions) => Promise<ExecResult>;

const MAX_OUTPUT_BYTES = 16 * 1024 * 1024;

function killTree(pid: number | undefined): void {
  if (!pid) return;
  try {
    if (process.platform === "win32") spawn("taskkill", ["/pid", String(pid), "/T", "/F"], { windowsHide: true, stdio: "ignore" }).on("error", () => undefined);
    else process.kill(pid, "SIGKILL");
  } catch { /* The process already exited. */ }
}

/** Runs a command without a shell. Output is captured as UTF-8 and capped; the whole process tree is killed on timeout or abort. */
export const nodeExec: Exec = (file, args, options) => new Promise(resolve => {
  let stdout = "", stderr = "", timedOut = false, aborted = false, settled = false;
  const finish = (result: Partial<ExecResult>) => {
    if (settled) return;
    settled = true;
    clearTimeout(timer);
    options.signal?.removeEventListener("abort", onAbort);
    resolve({ exitCode: null, stdout, stderr, timedOut, aborted, spawnError: null, ...result });
  };
  let child: ReturnType<typeof spawn>;
  try {
    child = spawn(file, args, { cwd: options.cwd, env: options.env, windowsHide: true, stdio: ["pipe", "pipe", "pipe"] });
  } catch (error) { resolve({ exitCode: null, stdout: "", stderr: "", timedOut: false, aborted: false, spawnError: (error as Error).message }); return; }
  const onAbort = () => { aborted = true; killTree(child.pid); };
  const timer = setTimeout(() => { timedOut = true; killTree(child.pid); }, options.timeoutMs);
  if (options.signal?.aborted) onAbort(); else options.signal?.addEventListener("abort", onAbort, { once: true });
  child.stdout?.setEncoding("utf8").on("data", (chunk: string) => { if (stdout.length < MAX_OUTPUT_BYTES) stdout += chunk; });
  child.stderr?.setEncoding("utf8").on("data", (chunk: string) => { if (stderr.length < MAX_OUTPUT_BYTES) stderr += chunk; });
  child.on("error", error => finish({ spawnError: error.message }));
  child.on("close", code => finish({ exitCode: code }));
  child.stdin?.on("error", () => undefined);
  child.stdin?.end(options.stdin ?? "", "utf8");
});
