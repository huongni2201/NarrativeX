import { spawn, type ChildProcess } from "node:child_process";

export interface ProcessResult {
  exitCode: number | null;
  stdout: string;
  stderr: string;
}

export interface RunningProcess {
  result: Promise<ProcessResult>;
  cancel(): void;
}

export function runProcess(command: string, args: readonly string[], cwd?: string, signal?: AbortSignal): RunningProcess {
  let child: ChildProcess | null = null;
  let settled = false;
  const result = new Promise<ProcessResult>((resolve, reject) => {
    child = spawn(command, [...args], { cwd, windowsHide: true, stdio: ["ignore", "pipe", "pipe"] });
    let stdout = "";
    let stderr = "";
    child.stdout?.setEncoding("utf8");
    child.stderr?.setEncoding("utf8");
    child.stdout?.on("data", (chunk: string) => { stdout += chunk; });
    child.stderr?.on("data", (chunk: string) => { stderr += chunk; });
    if (signal?.aborted) child.kill();
    signal?.addEventListener("abort", () => child?.kill(), { once: true });
    child.once("error", reject);
    child.once("close", (exitCode) => { settled = true; resolve({ exitCode, stdout, stderr }); });
  });
  return {
    result,
    cancel: () => {
      if (!settled && child) child.kill();
    },
  };
}
