import { randomUUID } from "node:crypto";
import { spawn } from "node:child_process";
import { rm, stat } from "node:fs/promises";
import { basename, dirname, extname, join } from "node:path";

const WATERMARK_REMOVER_PACKAGE = "@pilio/gemini-watermark-remover";
const POSTPROCESS_TIMEOUT_MS = 120_000;
const MAX_STDERR_CHARS = 8_000;

export async function removeGeminiWatermark(sourcePath: string): Promise<string> {
  const source = await stat(sourcePath);
  if (!source.isFile() || source.size <= 0) {
    throw new Error("Gemini image postprocessing source is missing or empty.");
  }

  const extension = extname(sourcePath).toLowerCase() || ".png";
  const stem = basename(sourcePath, extname(sourcePath));
  const outputPath = join(
    dirname(sourcePath),
    `${stem}-clean-${randomUUID()}${extension}`,
  );

  try {
    await runWatermarkRemover(sourcePath, outputPath);
    const output = await stat(outputPath);
    if (!output.isFile() || output.size <= 0) {
      throw new Error("Gemini watermark remover finished without producing a valid image.");
    }

    await rm(sourcePath, { force: true });
    return outputPath;
  } catch (error) {
    await rm(outputPath, { force: true }).catch(() => undefined);
    throw error;
  }
}

export async function cleanupGeminiTempFile(sourcePath: string): Promise<void> {
  await rm(sourcePath, { force: true });
}

async function runWatermarkRemover(sourcePath: string, outputPath: string): Promise<void> {
  const pnpmArgs = [
    "dlx",
    WATERMARK_REMOVER_PACKAGE,
    "remove",
    sourcePath,
    "--output",
    outputPath,
  ];
  const isWindows = process.platform === "win32";
  const command = isWindows ? process.env.ComSpec || "cmd.exe" : "pnpm";
  const args = isWindows ? ["/d", "/s", "/c", "pnpm.cmd", ...pnpmArgs] : pnpmArgs;

  await new Promise<void>((resolve, reject) => {
    const child = spawn(command, args, {
      stdio: ["ignore", "ignore", "pipe"],
      windowsHide: true,
    });

    let stderr = "";
    let settled = false;
    const finish = (error?: Error) => {
      if (settled) return;
      settled = true;
      clearTimeout(timeout);
      if (error) reject(error);
      else resolve();
    };

    child.stderr?.setEncoding("utf8");
    child.stderr?.on("data", (chunk: string) => {
      stderr = (stderr + chunk).slice(-MAX_STDERR_CHARS);
    });

    child.once("error", (error) => {
      finish(
        new Error(
          `Could not start Gemini watermark remover. Ensure pnpm is installed and available in PATH. ${error.message}`,
        ),
      );
    });

    child.once("exit", (code, signal) => {
      if (code === 0) {
        finish();
        return;
      }
      const detail = stderr.trim();
      finish(
        new Error(
          `Gemini watermark remover failed${code === null ? "" : ` with exit code ${code}`}${signal ? ` (${signal})` : ""}${detail ? `: ${detail}` : "."}`,
        ),
      );
    });

    const timeout = setTimeout(() => {
      child.kill();
      finish(new Error("Gemini watermark remover timed out after 120 seconds."));
    }, POSTPROCESS_TIMEOUT_MS);
  });
}
