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

export function runProcess(
  command: string,
  args: readonly string[],
  cwd?: string,
  signal?: AbortSignal,
): RunningProcess {
  let child: ChildProcess | null = null;
  let settled = false;

  const result = new Promise<ProcessResult>((resolve, reject) => {
    child = spawn(command, [...args], {
      cwd,
      windowsHide: true,
      stdio: ["ignore", "pipe", "pipe"],
    });

    let stdout = "";
    let stderr = "";
    const onAbort = () => child?.kill();
    const cleanup = () => signal?.removeEventListener("abort", onAbort);

    child.stdout?.setEncoding("utf8");
    child.stderr?.setEncoding("utf8");
    child.stdout?.on("data", (chunk: string) => {
      stdout += chunk;
    });
    child.stderr?.on("data", (chunk: string) => {
      stderr += chunk;
    });

    signal?.addEventListener("abort", onAbort, { once: true });
    if (signal?.aborted) onAbort();

    child.once("error", (error) => {
      settled = true;
      cleanup();
      reject(error);
    });
    child.once("close", (exitCode) => {
      if (settled) return;
      settled = true;
      cleanup();
      if (signal?.aborted) {
        reject(
          signal.reason instanceof Error
            ? signal.reason
            : new Error("Process execution was aborted."),
        );
        return;
      }
      resolve({ exitCode, stdout, stderr });
    });
  });

  return {
    result,
    cancel: () => {
      if (!settled && child) child.kill();
    },
  };
}
