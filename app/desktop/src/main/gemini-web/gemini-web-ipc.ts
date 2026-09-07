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
  GeminiGenerationAttemptJournal,
  geminiAttemptErrorCode,
} from "./gemini-generation-attempt-journal";
import {
  cleanupGeminiTempFile,
  createGeminiWatermarkRemovedCopy,
} from "./gemini-image-postprocessor";
import { inspectGeminiImage, validateGeneratedGeminiImage } from "./gemini-image-quality";
import { installGeminiWatermarkAssetVariants } from "./gemini-watermark-asset-variants";
import { isGeminiWebLane, type GeminiWebLane } from "../../shared/gemini-web-lanes";
import { ProjectStorage } from "../local-storage/project-storage";
import { desktopPreferencesStore } from "../preferences/preferences-bootstrap";
import {
  registerTrustedIpcHandlerWithEvent,
  type RendererTrustPolicy,
} from "../security/renderer-security";
import { SelectionTokenStore } from "../security/selection-token-store";

const MAX_REFERENCE_IMAGES = 3;
const MAX_WATERMARK_BATCH = 1_000;
const OPAQUE_ID_PATTERN = /^[A-Za-z0-9._-]{1,128}$/;
const SHA256_PATTERN = /^[0-9a-f]{64}$/;
const STORYBOARD_STYLE_POLICY_VERSION = "storyboard-manhwa-v2";
const STORYBOARD_PROVIDER_POLICY_VERSION = "gemini-web-3.1-pro-cinematic-v1";

type StagedGeminiSelection = {
  sourcePath: string;
  lane: GeminiWebLane;
  attemptId: string | null;
  inputFingerprint: string | null;
};

const pendingGeminiSelections = new SelectionTokenStore<StagedGeminiSelection>();

export function registerGeminiWebIpc(policy: RendererTrustPolicy, projectStorage: ProjectStorage): void {
  const automationRoot = join(dirname(projectStorage.rootDirectory()), "gemini-web");
  const attempts = new GeminiGenerationAttemptJournal(automationRoot);
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
      const provenance = input.provenance ?? null;

      if (provenance) {
        const attempt = await attempts.begin({
          attemptId: provenance.attemptId,
          lane: input.lane,
          projectId: input.projectId ?? null,
          batchId: provenance.batchId,
          snapshotId: provenance.snapshotId,
          batchFingerprint: provenance.batchFingerprint,
          inputFingerprint: provenance.inputFingerprint,
          stylePolicyVersion: provenance.stylePolicyVersion,
          providerPolicyVersion: provenance.providerPolicyVersion,
        });
        if (attempt.stage !== "PREPARED") {
          const code = attempt.stage === "UNKNOWN"
            ? "GEMINI_ATTEMPT_UNKNOWN"
            : "GEMINI_ATTEMPT_ALREADY_DISPATCHED";
          throw new Error(`${code}: generation attempt ${provenance.attemptId} must be reconciled instead of resubmitted.`);
        }
        await attempts.update(provenance.attemptId, "SUBMITTING");
      }

      try {
        const result = await browsers.generateImage(input.lane, input.prompt, references);
        const selection = await stageGeneratedImage(
          event.sender.id,
          result.sourcePath,
          input.lane,
          provenance?.attemptId ?? null,
          provenance?.inputFingerprint ?? null,
        );
        if (provenance) {
          await attempts.update(provenance.attemptId, "COMPLETED", {
            outputChecksumSha256: selection.checksumSha256,
            errorCode: null,
          });
        }
        return selection;
      } catch (error) {
        if (provenance) {
          const errorCode = geminiAttemptErrorCode(error);
          const stage = isDefinitiveGeminiFailure(errorCode, error) ? "FAILED" : "UNKNOWN";
          await attempts.update(provenance.attemptId, stage, { errorCode }).catch(() => undefined);
        }
        throw error;
      }
    },
  );

  registerTrustedIpcHandlerWithEvent(
    "desktop:gemini-web:attempt-status",
    policy,
    async (_event, input) => {
      if (!isAttemptStatusInput(input)) throw new Error("Invalid Gemini generation attempt lookup.");
      return attempts.get(input.attemptId);
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
    if (seenAssets.has(reference.assetId)) {
      throw new Error("REFERENCE_BINDING_DUPLICATE: Gemini reference assets must be unique.");
    }
    if (seenLabels.has(reference.refLabel)) {
      throw new Error("REFERENCE_BINDING_DUPLICATE: Gemini reference labels must be unique.");
    }
    seenAssets.add(reference.assetId);
    seenLabels.add(reference.refLabel);
    const sourcePath = await projectStorage.resolveAsset(input.projectId, reference.assetId);
    if (reference.sha256) {
      const actualChecksum = await checksumFile(sourcePath);
      if (actualChecksum !== reference.sha256) {
        throw new Error(
          `REFERENCE_INTEGRITY_FAILED: ${reference.refLabel} checksum does not match the prepared snapshot.`,
        );
      }
    }
    resolved.push({
      path: sourcePath,
      refLabel: reference.refLabel,
      canonicalName: reference.canonicalName,
      characterId: reference.characterId,
      beatRole: reference.beatRole,
      referenceRole: reference.referenceRole,
      priority: reference.priority,
      contentType: reference.contentType,
      sha256: reference.sha256,
    });
  }
  return resolved;
}

async function stageGeneratedImage(
  senderId: number,
  sourcePath: string,
  lane: GeminiWebLane,
  attemptId: string | null,
  inputFingerprint: string | null,
) {
  const file = await stat(sourcePath);
  if (!file.isFile() || file.size <= 0) throw new Error("Gemini Web downloaded an empty or invalid image file.");
  if (kindForPath(sourcePath) !== "IMAGE") throw new Error("Gemini Web download is not a supported image file.");

  const metadata = await inspectGeminiImage(sourcePath);
  validateGeneratedGeminiImage(metadata);
  const selectionToken = pendingGeminiSelections.create(
    senderId,
    "gemini-image-import",
    { sourcePath, lane, attemptId, inputFingerprint },
  );
  return {
    selectionToken,
    originalFilename: basename(sourcePath),
    contentType: contentTypeForPath(sourcePath),
    sizeBytes: file.size,
    checksumSha256: metadata.sha256,
    width: metadata.width,
    height: metadata.height,
    kind: "IMAGE" as const,
    ...(attemptId ? { generationAttemptId: attemptId } : {}),
    ...(inputFingerprint ? { generationInputFingerprint: inputFingerprint } : {}),
  };
}

type GeminiReferenceInput = {
  refLabel: string;
  assetId: string;
  characterId: string;
  canonicalName: string;
  beatRole?: string | null;
  referenceRole?: string | null;
  priority?: number;
  contentType?: string | null;
  sha256?: string | null;
};

type GeminiGenerationProvenance = {
  attemptId: string;
  batchId: string;
  snapshotId: string;
  batchFingerprint: string;
  inputFingerprint: string;
  stylePolicyVersion: string;
  providerPolicyVersion: string;
};

type GeminiGenerateInput = {
  lane: GeminiWebLane;
  prompt: string;
  projectId?: string;
  references?: GeminiReferenceInput[];
  provenance?: GeminiGenerationProvenance;
};

type GeminiWatermarkBatchInput = { projectId: string; assetIds: string[] };

function isGenerateInput(value: unknown): value is GeminiGenerateInput {
  if (!value || typeof value !== "object") return false;
  const input = value as Record<string, unknown>;
  if (!isGeminiWebLane(input.lane)) return false;
  if (typeof input.prompt !== "string" || !input.prompt.trim()) return false;
  if (input.projectId !== undefined && typeof input.projectId !== "string") return false;
  if (input.lane === "STORYBOARD" && !isGenerationProvenance(input.provenance)) return false;
  if (input.provenance !== undefined && !isGenerationProvenance(input.provenance)) return false;
  if (input.references === undefined) return true;
  if (!Array.isArray(input.references) || input.references.length > MAX_REFERENCE_IMAGES) return false;
  if (input.references.length > 0 && typeof input.projectId !== "string") return false;
  return input.references.every(isReferenceInput);
}

function isGenerationProvenance(value: unknown): value is GeminiGenerationProvenance {
  if (!value || typeof value !== "object") return false;
  const provenance = value as Record<string, unknown>;
  return (
    typeof provenance.attemptId === "string" && OPAQUE_ID_PATTERN.test(provenance.attemptId) &&
    typeof provenance.batchId === "string" && OPAQUE_ID_PATTERN.test(provenance.batchId) &&
    typeof provenance.snapshotId === "string" && OPAQUE_ID_PATTERN.test(provenance.snapshotId) &&
    typeof provenance.batchFingerprint === "string" && SHA256_PATTERN.test(provenance.batchFingerprint) &&
    typeof provenance.inputFingerprint === "string" && SHA256_PATTERN.test(provenance.inputFingerprint) &&
    provenance.stylePolicyVersion === STORYBOARD_STYLE_POLICY_VERSION &&
    provenance.providerPolicyVersion === STORYBOARD_PROVIDER_POLICY_VERSION
  );
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
    (reference.beatRole === undefined || reference.beatRole === null || ["PRIMARY", "SECONDARY", "BACKGROUND"].includes(String(reference.beatRole))) &&
    (reference.referenceRole === undefined || reference.referenceRole === null || typeof reference.referenceRole === "string") &&
    (reference.priority === undefined || (Number.isInteger(reference.priority) && Number(reference.priority) >= 0)) &&
    (reference.contentType === undefined || reference.contentType === null || typeof reference.contentType === "string") &&
    (reference.sha256 === undefined || reference.sha256 === null || (typeof reference.sha256 === "string" && SHA256_PATTERN.test(reference.sha256)))
  );
}

function isAttemptStatusInput(value: unknown): value is { attemptId: string } {
  if (!value || typeof value !== "object") return false;
  const input = value as Record<string, unknown>;
  return typeof input.attemptId === "string" && OPAQUE_ID_PATTERN.test(input.attemptId);
}

function isCommitInput(value: unknown): value is { lane: GeminiWebLane; projectId: string; assetId: string; selectionToken: string } {
  if (!value || typeof value !== "object") return false;
  const input = value as Record<string, unknown>;
  return isGeminiWebLane(input.lane) && typeof input.projectId === "string" && typeof input.assetId === "string" && typeof input.selectionToken === "string";
}

function isWatermarkBatchInput(value: unknown): value is GeminiWatermarkBatchInput {
  if (!value || typeof value !== "object") return false;
  const input = value as Record<string, unknown>;
  return typeof input.projectId === "string" && input.projectId.length > 0 && Array.isArray(input.assetIds) && input.assetIds.length <= MAX_WATERMARK_BATCH && input.assetIds.every((assetId) => typeof assetId === "string" && OPAQUE_ID_PATTERN.test(assetId));
}

function isDefinitiveGeminiFailure(errorCode: string | null, error: unknown): boolean {
  if (errorCode === "GEMINI_GENERATION_REJECTED") return true;
  if (errorCode === "GEMINI_AUTH_REQUIRED") return true;
  if (errorCode === "GEMINI_BUSY") return true;
  if (errorCode === "GEMINI_REFERENCE_LIMIT") return true;
  if (errorCode === "GEMINI_PROMPT_EMPTY") return true;
  if (errorCode?.includes("MODEL") || errorCode?.includes("PRESET")) return true;
  const text = error instanceof Error ? error.message : String(error ?? "");
  return /signed in|login|reference|preset|model|invalid request/i.test(text);
}

function kindForPath(sourcePath: string): "IMAGE" | "OTHER" {
  return [".png", ".jpg", ".jpeg", ".webp"].includes(extname(sourcePath).toLowerCase()) ? "IMAGE" : "OTHER";
}

function contentTypeForPath(sourcePath: string): string {
  switch (extname(sourcePath).toLowerCase()) {
    case ".png": return "image/png";
    case ".jpg":
    case ".jpeg": return "image/jpeg";
    case ".webp": return "image/webp";
    default: return "application/octet-stream";
  }
}

async function checksumFile(sourcePath: string): Promise<string> {
  const hash = createHash("sha256");
  for await (const chunk of createReadStream(sourcePath)) hash.update(chunk);
  return hash.digest("hex");
}
