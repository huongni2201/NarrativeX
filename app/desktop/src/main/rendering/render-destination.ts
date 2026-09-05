import { randomUUID } from "node:crypto";
import { copyFile, rename, rm, stat } from "node:fs/promises";
import { basename, extname, join } from "node:path";

const INVALID_FILENAME = /[<>:"/\\|?*\u0000-\u001f]/gu;

export function buildRenderOutputFilename(
  projectName: string | null | undefined,
  now = new Date(),
): string {
  const stem = sanitizeFilenameStem(projectName) || "narrativex-render";
  return `${stem}-${timestamp(now)}.mp4`;
}

export async function resolveAvailableRenderPath(
  directory: string,
  filename: string,
  exists: (path: string) => Promise<boolean> = pathExists,
): Promise<string> {
  const extension = extname(filename) || ".mp4";
  const stem = filename.slice(0, Math.max(0, filename.length - extension.length));
  let candidate = join(directory, `${stem}${extension}`);
  if (!(await exists(candidate))) return candidate;

  for (let index = 2; index < 10_000; index += 1) {
    candidate = join(directory, `${stem}-${index}${extension}`);
    if (!(await exists(candidate))) return candidate;
  }
  throw new Error("Unable to allocate a unique final render filename.");
}

export async function deliverRenderArtifact(input: {
  sourcePath: string;
  destinationDirectory: string;
  projectName?: string | null;
  now?: Date;
}): Promise<string> {
  const filename = buildRenderOutputFilename(input.projectName, input.now);
  const destinationPath = await resolveAvailableRenderPath(
    input.destinationDirectory,
    filename,
  );
  const temporaryPath = join(
    input.destinationDirectory,
    `.${basename(destinationPath)}.${randomUUID()}.partial`,
  );
  try {
    await copyFile(input.sourcePath, temporaryPath);
    await rename(temporaryPath, destinationPath);
    return destinationPath;
  } finally {
    await rm(temporaryPath, { force: true }).catch(() => undefined);
  }
}

function sanitizeFilenameStem(value: string | null | undefined): string {
  return (value ?? "")
    .normalize("NFC")
    .replace(INVALID_FILENAME, "-")
    .replace(/\s+/gu, "-")
    .replace(/-+/gu, "-")
    .replace(/^[.\s-]+|[.\s-]+$/gu, "")
    .slice(0, 120);
}

function timestamp(value: Date): string {
  const year = value.getUTCFullYear();
  const month = pad2(value.getUTCMonth() + 1);
  const day = pad2(value.getUTCDate());
  const hour = pad2(value.getUTCHours());
  const minute = pad2(value.getUTCMinutes());
  const second = pad2(value.getUTCSeconds());
  return `${year}${month}${day}-${hour}${minute}${second}`;
}

function pad2(value: number): string {
  return String(value).padStart(2, "0");
}

async function pathExists(path: string): Promise<boolean> {
  try {
    const value = await stat(path);
    return value.isFile() || value.isDirectory();
  } catch (error) {
    if (
      error &&
      typeof error === "object" &&
      "code" in error &&
      (error as { code?: unknown }).code === "ENOENT"
    ) {
      return false;
    }
    throw error;
  }
}
