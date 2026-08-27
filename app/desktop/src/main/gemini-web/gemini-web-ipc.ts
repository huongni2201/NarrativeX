import { app } from "electron";
import { createHash } from "node:crypto";
import { createReadStream } from "node:fs";
import { stat } from "node:fs/promises";
import { basename, dirname, extname, join } from "node:path";
import { GeminiWebAutomation } from "./gemini-web-automation";
import {
  isGeminiDownloadRecoveryError,
  recoverGeminiWebImageDownload,
} from "./gemini-web-download-recovery";
import { compileGeminiWebPrompt } from "./gemini-web-prompt";
import { ProjectStorage } from "../local-storage/project-storage";
import {
  registerTrustedIpcHandlerWithEvent,
  type RendererTrustPolicy,
} from "../security/renderer-security";
import { SelectionTokenStore } from "../security/selection-token-store";

const pendingGeminiSelections = new SelectionTokenStore<{ sourcePath: string }>();

export function registerGeminiWebIpc(
  policy: RendererTrustPolicy,
  projectStorage: ProjectStorage,
): void {
  const automationRoot = join(dirname(projectStorage.rootDirectory()), "gemini-web");
  const automation = new GeminiWebAutomation(automationRoot);

  registerTrustedIpcHandlerWithEvent(
    "desktop:gemini-web:generate-image",
    policy,
    async (event, input) => {
      if (!isGenerateInput(input)) throw new Error("Invalid Gemini Web generation request.");
      const prompt = compileGeminiWebPrompt(input.prompt);
      let sourcePath: string;
      try {
        const result = await automation.generateImage(prompt);
        sourcePath = result.sourcePath;
      } catch (error) {
        if (!isGeminiDownloadRecoveryError(error)) throw error;
        sourcePath = await recoverGeminiWebImageDownload(automationRoot);
      }
      return stageGeneratedImage(event.sender.id, sourcePath);
    },
  );

  registerTrustedIpcHandlerWithEvent(
    "desktop:gemini-web:commit-image",
    policy,
    async (event, input) => {
      if (!isCommitInput(input)) throw new Error("Invalid Gemini Web image commit request.");
      const selection = pendingGeminiSelections.consume(
        input.selectionToken,
        event.sender.id,
        "gemini-image-import",
      );
      return projectStorage.registerAsset(input.projectId, {
        assetId: input.assetId,
        kind: "IMAGE",
        sourcePath: selection.sourcePath,
      });
    },
  );

  app.on("before-quit", () => {
    void automation.stop().catch(() => undefined);
  });
}

async function stageGeneratedImage(senderId: number, sourcePath: string) {
  const file = await stat(sourcePath);
  if (!file.isFile() || file.size <= 0) {
    throw new Error("Gemini Web downloaded an empty or invalid image file.");
  }
  if (kindForPath(sourcePath) !== "IMAGE") {
    throw new Error("Gemini Web download is not a supported image file.");
  }

  const selectionToken = pendingGeminiSelections.create(
    senderId,
    "gemini-image-import",
    { sourcePath },
  );
  return {
    selectionToken,
    originalFilename: basename(sourcePath),
    contentType: contentTypeForPath(sourcePath),
    sizeBytes: file.size,
    checksumSha256: await checksumFile(sourcePath),
    kind: "IMAGE" as const,
  };
}

function isGenerateInput(value: unknown): value is { prompt: string } {
  if (!value || typeof value !== "object") return false;
  const input = value as Record<string, unknown>;
  return typeof input.prompt === "string" && input.prompt.trim().length > 0;
}

function isCommitInput(value: unknown): value is {
  projectId: string;
  assetId: string;
  selectionToken: string;
} {
  if (!value || typeof value !== "object") return false;
  const input = value as Record<string, unknown>;
  return (
    typeof input.projectId === "string" &&
    typeof input.assetId === "string" &&
    typeof input.selectionToken === "string"
  );
}

function kindForPath(sourcePath: string): "IMAGE" | "OTHER" {
  return [".png", ".jpg", ".jpeg", ".webp"].includes(extname(sourcePath).toLowerCase())
    ? "IMAGE"
    : "OTHER";
}

function contentTypeForPath(sourcePath: string): string {
  switch (extname(sourcePath).toLowerCase()) {
    case ".png":
      return "image/png";
    case ".jpg":
    case ".jpeg":
      return "image/jpeg";
    case ".webp":
      return "image/webp";
    default:
      return "application/octet-stream";
  }
}

async function checksumFile(sourcePath: string): Promise<string> {
  const hash = createHash("sha256");
  for await (const chunk of createReadStream(sourcePath)) hash.update(chunk);
  return hash.digest("hex");
}
