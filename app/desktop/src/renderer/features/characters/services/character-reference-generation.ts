import type { DesktopCharacterVersionReference } from "@narrativex/client-contracts";
import { assetsApi } from "../../assets/api/assets.api";
import { charactersApi } from "../api/characters.api";

interface ImageSelection {
  selectionToken: string;
  originalFilename: string;
  contentType: string;
  sizeBytes: number;
  checksumSha256: string;
  kind: "IMAGE" | "AUDIO" | "VIDEO" | "OTHER";
  durationMs?: number;
}

function mergeIdentityReference(
  references: DesktopCharacterVersionReference[],
  assetId: string,
): DesktopCharacterVersionReference[] {
  const secondary = references
    .filter((reference) => reference.role.toUpperCase() !== "IDENTITY")
    .sort((left, right) => left.priority - right.priority)
    .map((reference, index) => ({ ...reference, priority: index + 1 }));
  return [{ assetId, role: "IDENTITY", priority: 0 }, ...secondary];
}

async function registerSelection(projectId: string, selection: ImageSelection, generated: boolean) {
  if (selection.kind !== "IMAGE") {
    throw new Error("Character reference chỉ chấp nhận file ảnh.");
  }
  const asset = await assetsApi.registerLocal({
    projectId,
    type: "IMAGE",
    originalFilename: selection.originalFilename,
    contentType: selection.contentType,
    sizeBytes: selection.sizeBytes,
    checksumSha256: selection.checksumSha256,
    durationMs: null,
  });
  if (generated) {
    await window.narrativex.geminiWeb.commitImage({
      projectId,
      assetId: asset.id,
      selectionToken: selection.selectionToken,
    });
  } else {
    await window.narrativex.localStorage.commitSelectedAsset({
      projectId,
      assetId: asset.id,
      kind: "IMAGE",
      selectionToken: selection.selectionToken,
    });
  }
  return asset.id;
}

async function assignIdentityReference(input: {
  characterId: string;
  versionId: string;
  assetId: string;
}) {
  const current = await charactersApi.versionReferences(input.characterId, input.versionId);
  return charactersApi.setVersionReferences(
    input.characterId,
    input.versionId,
    mergeIdentityReference(current, input.assetId),
  );
}

export async function generateCharacterIdentityReference(input: {
  projectId: string;
  characterId: string;
  versionId: string;
  prompt: string;
}) {
  if (!input.prompt.trim()) {
    throw new Error("Backend chưa trả character generation prompt.");
  }
  const selection = await window.narrativex.geminiWeb.generateImage({
    projectId: input.projectId,
    prompt: input.prompt,
  });
  const assetId = await registerSelection(input.projectId, selection, true);
  const references = await assignIdentityReference({ ...input, assetId });
  return { assetId, references };
}

export async function importCharacterIdentityReference(input: {
  projectId: string;
  characterId: string;
  versionId: string;
}) {
  const selection = await window.narrativex.localStorage.selectAsset();
  if (!selection) return null;
  const assetId = await registerSelection(input.projectId, selection, false);
  const references = await assignIdentityReference({ ...input, assetId });
  return { assetId, references };
}
