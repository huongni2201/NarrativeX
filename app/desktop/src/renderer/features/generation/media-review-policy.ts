import type { DesktopAsset, LocalMaterializationStatus, MediaGenerationItem } from "@narrativex/client-contracts";

export type ReviewAction = "APPROVE" | "REJECT" | "REGENERATE";

export interface ReviewReadiness {
  canApprove: boolean;
  canReject: boolean;
  canRegenerate: boolean;
  reason: string | null;
}

export function reviewReadiness(
  item: MediaGenerationItem,
  asset: DesktopAsset | null,
  materialization: LocalMaterializationStatus | null,
): ReviewReadiness {
  if (item.executionStatus === "QUEUED" || item.executionStatus === "RUNNING") {
    return { canApprove: false, canReject: false, canRegenerate: false, reason: "Generation is still running." };
  }
  if (!item.mediaAssetId || !asset) {
    return { canApprove: false, canReject: item.reviewStatus === "NEEDS_REVIEW", canRegenerate: true, reason: "Generated asset is missing." };
  }
  if (!asset.sha256 || asset.sizeBytes <= 0) {
    return { canApprove: false, canReject: true, canRegenerate: true, reason: "Asset checksum/size is incomplete." };
  }
  const localMode = asset.storageMode === "LOCAL_ONLY" || asset.storageMode === "HYBRID";
  if (localMode) {
    if (!materialization || materialization.state !== "AVAILABLE") {
      return { canApprove: false, canReject: true, canRegenerate: true, reason: "Asset is not verified on this device." };
    }
    if (materialization.sizeBytes !== asset.sizeBytes || materialization.checksumSha256 !== asset.sha256) {
      return { canApprove: false, canReject: true, canRegenerate: true, reason: "Local asset verification does not match backend identity." };
    }
  }
  return {
    canApprove: item.reviewStatus === "NEEDS_REVIEW" || item.reviewStatus === "REJECTED",
    canReject: item.reviewStatus === "NEEDS_REVIEW" || item.reviewStatus === "APPROVED",
    canRegenerate: true,
    reason: null,
  };
}

export function selectedRegenerationIds(items: readonly MediaGenerationItem[], selectedIds: ReadonlySet<string>): string[] {
  const known = new Set(items.map((item) => item.id));
  return [...selectedIds].filter((id) => known.has(id));
}

export function preserveUnaffectedReviews(
  before: readonly MediaGenerationItem[],
  regeneratedItemIds: ReadonlySet<string>,
): ReadonlyMap<string, MediaGenerationItem["reviewStatus"]> {
  return new Map(before.filter((item) => !regeneratedItemIds.has(item.id)).map((item) => [item.id, item.reviewStatus]));
}

export function diffPrompt(previousPrompt: string, nextPrompt: string): { changed: boolean; before: string; after: string } {
  const before = previousPrompt.trim();
  const after = nextPrompt.trim();
  return { changed: before !== after, before, after };
}
