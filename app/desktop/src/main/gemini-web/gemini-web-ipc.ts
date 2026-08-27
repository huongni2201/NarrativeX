import { app } from "electron";
import { createHash } from "node:crypto";
import { createReadStream } from "node:fs";
import { stat } from "node:fs/promises";
import { basename, dirname, extname, join } from "node:path";
import {
  GeminiWebAutomation,
  type GeminiWebReferenceFile,
} from "./gemini-web-automation";
import { compileGeminiWebPrompt } from "./gemini-web-prompt";
import { ProjectStorage } from "../local-storage/project-storage";
import {
  registerTrustedIpcHandlerWithEvent,
  type RendererTrustPolicy,
} from "../security/renderer-security";
import { SelectionTokenStore } from "../security/selection-token-store";

const pendingGeminiSelections = new SelectionTokenStore<{ sourcePath: string }>();
const MAX_REFERENCE_IMAGES = 3;
const OPAQUE_ID_PATTERN = /^[A-Za-z0-9._-]{1,128}$/;

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
      const references = await resolveReferenceFiles(projectStorage, input);
      const result = await automation.generateImage(
        compileGeminiWebPrompt(input.prompt),
        references,
      );
      return stageGeneratedImage(event.sender.id, result.sourcePath);
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

type GeminiReferenceInput = {
  refLabel: string;
  assetId: string;
  characterId: string;
  canonicalName: string;
  beatRole?: string | null;
};

type GeminiGenerateInput = {
  prompt: string;
  projectId?: string;
  references?: GeminiReferenceInput[];
};

function isGenerateInput(value: unknown): value is GeminiGenerateInput {
  if (!value || typeof value !== "object") return false;
  const input = value as Record<string, unknown>;
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
