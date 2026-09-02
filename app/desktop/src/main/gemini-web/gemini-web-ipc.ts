import { app } from "electron";
import { createHash } from "node:crypto";
import { createReadStream } from "node:fs";
import { stat } from "node:fs/promises";
import { basename, dirname, extname, join } from "node:path";
import type { GeminiWebReferenceFile } from "./gemini-web-automation";
import { GeminiBrowserHost } from "./gemini-browser-host";
import { GeminiBrowserPool } from "./gemini-browser-pool";
import { registerGeminiBrowserIpc } from "./gemini-browser-ipc";
import {
  cleanupGeminiTempFile,
  createGeminiWatermarkRemovedCopy,
} from "./gemini-image-postprocessor";
import { installGeminiWatermarkAssetVariants } from "./gemini-watermark-asset-variants";
import { isGeminiWebLane, type GeminiWebLane } from "../../shared/gemini-web-lanes";
import { ProjectStorage } from "../local-storage/project-storage";
import { desktopPreferencesStore } from "../preferences/preferences-bootstrap";
import {
  registerTrustedIpcHandlerWithEvent,
  type RendererTrustPolicy,
} from "../security/renderer-security";
import { SelectionTokenStore } from "../security/selection-token-store";

const pendingGeminiSelections = new SelectionTokenStore<{
  sourcePath: string;
  lane: GeminiWebLane;
}>();
const MAX_REFERENCE_IMAGES = 3;
const MAX_WATERMARK_BATCH = 1_000;
const OPAQUE_ID_PATTERN = /^[A-Za-z0-9._-]{1,128}$/;

export function registerGeminiWebIpc(
  policy: RendererTrustPolicy,
  projectStorage: ProjectStorage,
): void {
  const automationRoot = join(dirname(projectStorage.rootDirectory()), "gemini-web");
  const browsers = new GeminiBrowserPool(
    automationRoot,
    desktopPreferencesStore(),
    ({ browser, rootDirectory, getTabCounts }) =>
      new GeminiBrowserHost(browser.id, rootDirectory, getTabCounts),
  );
  const watermarkVariants = installGeminiWatermarkAssetVariants(projectStorage);

  registerGeminiBrowserIpc(policy, browsers);

  registerTrustedIpcHandlerWithEvent(
    "desktop:gemini-web:generate-image",
    policy,
    async (event, input) => {
      if (!isGenerateInput(input)) throw new Error("Invalid Gemini Web generation request.");
      const references = await resolveReferenceFiles(projectStorage, input);
      const result = await browsers.generateImage(input.lane, input.prompt, references);
      return stageGeneratedImage(event.sender.id, result.sourcePath, input.lane);
    },
  );

  registerTrustedIpcHandlerWithEvent(
    "desktop:gemini-web:commit-image",
    policy,
    async (event, input) => {
      if (!isCommitInput(input)) throw new Error("Invalid Gemini Web image commit request.");
      const stagedSelection = pendingGeminiSelections.peek(
        input.selectionToken,
        event.sender.id,
        "gemini-image-import",
      );
      if (stagedSelection.lane !== input.lane) {
        throw new Error("Gemini image selection belongs to another generation lane.");
      }
      const selection = pendingGeminiSelections.consume(
        input.selectionToken,
        event.sender.id,
        "gemini-image-import",
      );
      try {
        const asset = await projectStorage.registerAsset(input.projectId, {
          assetId: input.assetId,
          kind: "IMAGE",
          sourcePath: selection.sourcePath,
        });
        await watermarkVariants.markGeminiAsset(input.projectId, input.assetId);
        return asset;
      } finally {
        await cleanupGeminiTempFile(selection.sourcePath);
      }
    },
  );

  registerTrustedIpcHandlerWithEvent(
    "desktop:gemini-web:watermark-states",
    policy,
    async (_event, input) => {
      if (!isWatermarkBatchInput(input)) throw new Error("Invalid Gemini watermark state request.");
      return watermarkVariants.watermarkStates(input.projectId, [...new Set(input.assetIds)]);
    },
  );

  registerTrustedIpcHandlerWithEvent(
    "desktop:gemini-web:remove-watermarks",
    policy,
    async (_event, input) => {
      if (!isWatermarkBatchInput(input)) throw new Error("Invalid Gemini watermark removal request.");
      const assetIds = [...new Set(input.assetIds)];
      const states = await watermarkVariants.watermarkStates(input.projectId, assetIds);
      const processed: string[] = [];
      const skipped: string[] = [];
      const failed: Array<{ assetId: string; message: string }> = [];

      for (const assetId of assetIds) {
        if (states[assetId] !== "PENDING") {
          skipped.push(assetId);
          continue;
        }
        let cleanedPath: string | null = null;
        try {
          const sourcePath = await watermarkVariants.resolveCanonicalAsset(input.projectId, assetId);
          cleanedPath = await createGeminiWatermarkRemovedCopy(sourcePath);
          await watermarkVariants.registerRemovedVariant(input.projectId, assetId, cleanedPath);
          processed.push(assetId);
        } catch (error) {
          failed.push({
            assetId,
            message: error instanceof Error ? error.message : "Gemini watermark removal failed.",
          });
        } finally {
          if (cleanedPath) await cleanupGeminiTempFile(cleanedPath).catch(() => undefined);
        }
      }
      return { processed, skipped, failed };
    },
  );

  app.on("before-quit", () => {
    void browsers.stop().catch(() => undefined);
  });
}

async function resolveReferenceFiles(
  projectStorage: ProjectStorage,
  input: GeminiGenerateInput,
): Promise<GeminiWebReferenceFile[]> {
  if (!input.references?.length) return [];
  if (!input.projectId) throw new Error("projectId is required when Gemini references are supplied.");

  const resolved: GeminiWebReferenceFile[] = [];
  const seenAssets = new Set<string>();
  const seenLabels = new Set<string>();
  for (const reference of input.references) {
    if (seenAssets.has(reference.assetId)) continue;
    if (seenLabels.has(reference.refLabel)) {
      throw new Error("Gemini reference labels must be unique.");
    }
    seenAssets.add(reference.assetId);
    seenLabels.add(reference.refLabel);
    const sourcePath = await projectStorage.resolveAsset(input.projectId, reference.assetId);
    resolved.push({
      path: sourcePath,
      refLabel: reference.refLabel,
      canonicalName: reference.canonicalName,
      characterId: reference.characterId,
      beatRole: reference.beatRole,
    });
  }
  return resolved;
}

async function stageGeneratedImage(senderId: number, sourcePath: string, lane: GeminiWebLane) {
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
    { sourcePath, lane },
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

type GeminiReferenceInput = {
  refLabel: string;
  assetId: string;
  characterId: string;
  canonicalName: string;
  beatRole?: string | null;
};

type GeminiGenerateInput = {
  lane: GeminiWebLane;
  prompt: string;
  projectId?: string;
  references?: GeminiReferenceInput[];
};

type GeminiWatermarkBatchInput = {
  projectId: string;
  assetIds: string[];
};

function isGenerateInput(value: unknown): value is GeminiGenerateInput {
  if (!value || typeof value !== "object") return false;
  const input = value as Record<string, unknown>;
  if (!isGeminiWebLane(input.lane)) return false;
  if (typeof input.prompt !== "string" || !input.prompt.trim()) return false;
  if (input.projectId !== undefined && typeof input.projectId !== "string") return false;
  if (input.references === undefined) return true;
  if (!Array.isArray(input.references) || input.references.length > MAX_REFERENCE_IMAGES) return false;
  if (input.references.length > 0 && typeof input.projectId !== "string") return false;
  return input.references.every(isReferenceInput);
}

function isReferenceInput(value: unknown): value is GeminiReferenceInput {
  if (!value || typeof value !== "object") return false;
  const reference = value as Record<string, unknown>;
  return (
    typeof reference.refLabel === "string" &&
    /^REF_0[1-3]$/.test(reference.refLabel) &&
    typeof reference.assetId === "string" &&
    OPAQUE_ID_PATTERN.test(reference.assetId) &&
    typeof reference.characterId === "string" &&
    reference.characterId.length <= 128 &&
    typeof reference.canonicalName === "string" &&
    reference.canonicalName.trim().length > 0 &&
    reference.canonicalName.length <= 200 &&
    (reference.beatRole === undefined ||
      reference.beatRole === null ||
      ["PRIMARY", "SECONDARY", "BACKGROUND"].includes(String(reference.beatRole)))
  );
}

function isCommitInput(value: unknown): value is {
  lane: GeminiWebLane;
  projectId: string;
  assetId: string;
  selectionToken: string;
} {
  if (!value || typeof value !== "object") return false;
  const input = value as Record<string, unknown>;
  return (
    isGeminiWebLane(input.lane) &&
    typeof input.projectId === "string" &&
    typeof input.assetId === "string" &&
    typeof input.selectionToken === "string"
  );
}

function isWatermarkBatchInput(value: unknown): value is GeminiWatermarkBatchInput {
  if (!value || typeof value !== "object") return false;
  const input = value as Record<string, unknown>;
  return (
    typeof input.projectId === "string" &&
    input.projectId.length > 0 &&
    Array.isArray(input.assetIds) &&
    input.assetIds.length <= MAX_WATERMARK_BATCH &&
    input.assetIds.every((assetId) => typeof assetId === "string" && OPAQUE_ID_PATTERN.test(assetId))
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
