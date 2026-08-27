import { app } from "electron";
import { createHash } from "node:crypto";
import { createReadStream } from "node:fs";
import { stat } from "node:fs/promises";
import { basename, dirname, extname, join } from "node:path";
import { GeminiWebAutomation } from "./gemini-web-automation";
import { GeminiWebNetworkCapture } from "./gemini-web-network-capture";
import { compileGeminiWebPrompt } from "./gemini-web-prompt";
import { ProjectStorage } from "../local-storage/project-storage";
import {
  registerTrustedIpcHandlerWithEvent,
  type RendererTrustPolicy,
} from "../security/renderer-security";
import { SelectionTokenStore } from "../security/selection-token-store";

const pendingGeminiSelections = new SelectionTokenStore<{ sourcePath: string }>();
const NETWORK_RECOVERY_GRACE_MS = 8_000;

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

      const networkCapture = new GeminiWebNetworkCapture(automationRoot);
      const networkResult = networkCapture.captureNextGeneratedImage().catch(() => null);
      try {
        const result = await automation.generateImage(compileGeminiWebPrompt(input.prompt));
        networkCapture.cancel();
        return stageGeneratedImage(event.sender.id, result.sourcePath);
      } catch (error) {
        const captured = await waitForNetworkCapture(networkResult, NETWORK_RECOVERY_GRACE_MS);
        if (captured) {
          return stageGeneratedImage(event.sender.id, captured.sourcePath);
        }
        throw error;
      } finally {
        networkCapture.cancel();
      }
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

async function waitForNetworkCapture<T>(promise: Promise<T | null>, timeoutMs: number): Promise<T | null> {
  return await Promise.race([
    promise,
    new Promise<null>((resolve) => setTimeout(() => resolve(null), timeoutMs)),
  ]);
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
