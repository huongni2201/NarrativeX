import type {
  DesktopCharacterAppearance,
  DesktopCharacterVersionReference,
} from "@narrativex/client-contracts";
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

export function buildCharacterIdentityPrompt(input: {
  canonicalName: string;
  visualPrompt: string;
  bible?: string | null;
  appearance?: DesktopCharacterAppearance | null;
}) {
  const appearance = input.appearance;
  const details = [
    input.visualPrompt.trim(),
    appearance?.appearancePrompt?.trim(),
    appearance?.ageState ? `Age state: ${appearance.ageState}` : null,
    appearance?.hairstyle ? `Hairstyle: ${appearance.hairstyle}` : null,
    appearance?.injury ? `Injury/markings: ${appearance.injury}` : null,
  ].filter(Boolean);

  return [
    "CHARACTER REFERENCE TASK",
    "Generate exactly one canonical identity reference for the established character below.",
    `Character: ${input.canonicalName}`,
    `Canonical identity: ${details.join("; ")}`,
    input.bible?.trim() ? `Character bible context: ${input.bible.trim()}` : null,
    "REFERENCE COMPOSITION:",
    "- one character only",
    "- head and upper torso clearly visible",
    "- neutral or subtle expression",
    "- slight three-quarter angle",
    "- face unobstructed and easy to recognize",
    "- clean simple background",
    "- no story action or unrelated props",
    "- no text, captions, logos, watermarks, contact sheet, or second character",
    "PURPOSE: this image becomes canonical identity evidence for later storyboard frames.",
    "Preserve specified traits exactly. Do not invent or redesign defining identity traits.",
  ]
    .filter(Boolean)
    .join("\n");
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
  canonicalName: string;
  visualPrompt: string;
  bible?: string | null;
  appearance?: DesktopCharacterAppearance | null;
}) {
  const selection = await window.narrativex.geminiWeb.generateImage({
    projectId: input.projectId,
    prompt: buildCharacterIdentityPrompt(input),
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
