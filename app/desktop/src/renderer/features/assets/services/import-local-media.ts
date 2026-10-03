import type { LocalAssetImportResult } from "../../../../preload/types";
import { assetsApi } from "../api/assets.api";

export interface ImportLocalMediaOptions {
  projectId: string;
  allowedKinds?: Array<"IMAGE" | "VIDEO" | "AUDIO">;
}

export async function importLocalMedia({
  projectId,
  allowedKinds = ["IMAGE", "VIDEO"],
}: ImportLocalMediaOptions): Promise<LocalAssetImportResult | null> {
  const selection = await window.narrativex.localStorage.selectAsset();
  if (!selection) return null;

  if (selection.kind === "OTHER" || !allowedKinds.includes(selection.kind)) {
    throw new Error(
      `Định dạng không được hỗ trợ (${selection.kind}). Vui lòng chọn ${allowedKinds.join(" hoặc ")}.`,
    );
  }

  const asset = await assetsApi.registerLocal({
    projectId,
    type: selection.kind,
    originalFilename: selection.originalFilename,
    contentType: selection.contentType,
    sizeBytes: selection.sizeBytes,
    checksumSha256: selection.checksumSha256,
    durationMs: selection.durationMs ?? null,
  });

  await window.narrativex.localStorage.commitSelectedAsset({
    projectId,
    assetId: asset.id,
    kind: selection.kind,
    selectionToken: selection.selectionToken,
  });

  return {
    assetId: asset.id,
    kind: selection.kind,
    relativePath: `assets/${asset.id}`,
    sizeBytes: selection.sizeBytes,
    checksumSha256: selection.checksumSha256,
  };
}
