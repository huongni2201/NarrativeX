import { useMemo, useState } from "react";
import type {
  DesktopAsset,
  DesktopChapterDetails,
  DesktopTimeline,
} from "@narrativex/client-contracts";
import { Eraser, FileAudio, FileImage, Film, Plus, Wrench } from "lucide-react";
import { Button } from "@/components/ui/button";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { localAssetPreviewUrl } from "../../../../shared/local-asset-preview-url";
import { EmptyState, FeaturePage } from "../../workspace/components/FeaturePage";
import { InlineNotice, StatusIndicator } from "../../workspace/components/WorkstationPrimitives";
import {
  ALL_ASSET_CHAPTERS,
  filterAssetsByChapter,
} from "../model/asset-chapter-filter";
import { useProjectAssetLocalStates } from "../queries/asset-local-state.queries";
import { useProjectAssetImport } from "../queries/asset-media.mutations";
import {
  useProjectAssetWatermarkRemoval,
  useProjectAssetWatermarkStates,
  type ProjectAssetWatermarkState,
} from "../queries/asset-watermark.queries";

export function AssetsScreen({
  projectId,
  assets,
  chapters,
  timeline,
}: Readonly<{
  projectId: string;
  assets: DesktopAsset[];
  chapters: DesktopChapterDetails[];
  timeline: DesktopTimeline | null;
}>) {
  const [notice, setNotice] = useState<string | null>(null);
  const [chapterId, setChapterId] = useState<string>(ALL_ASSET_CHAPTERS);
  const assetIds = useMemo(() => assets.map((asset) => asset.id), [assets]);
  const sortedChapters = useMemo(
    () => [...chapters].sort((left, right) => left.orderIndex - right.orderIndex),
    [chapters],
  );
  const visibleAssets = useMemo(
    () => filterAssetsByChapter(assets, timeline, chapterId),
    [assets, timeline, chapterId],
  );
  const localStatesQuery = useProjectAssetLocalStates(projectId, assetIds);
  const watermarkStatesQuery = useProjectAssetWatermarkStates(projectId, assetIds);
  const importAssetMutation = useProjectAssetImport(projectId);
  const watermarkRemovalMutation = useProjectAssetWatermarkRemoval(projectId);
  const localStates = localStatesQuery.data ?? {};
  const watermarkStates = watermarkStatesQuery.data ?? {};
  const pendingAssetIds = assets
    .filter((asset) => asset.type === "IMAGE" && watermarkStates[asset.id] === "PENDING")
    .map((asset) => asset.id);
  const busy = importAssetMutation.isPending || watermarkRemovalMutation.isPending;

  async function importAsset(repairAssetId?: string) {
    setNotice(null);
    try {
      const result = await importAssetMutation.mutateAsync(repairAssetId);
      if (!result) return;
      const durationLabel = result.durationMs ? ` · ${formatDuration(result.durationMs)}` : "";
      setNotice(`${result.originalFilename} đã được ${result.repaired ? "repair" : "import"}${durationLabel}.`);
    } catch (error) {
      setNotice(error instanceof Error ? error.message : "Không thể import asset.");
    }
  }

  async function removeWatermarks(targetAssetIds: string[]) {
    if (!targetAssetIds.length) return;
    setNotice(null);
    try {
      const result = await watermarkRemovalMutation.mutateAsync(targetAssetIds);
      const parts = [`Đã xoá watermark ${result.processed.length} ảnh.`];
      if (result.skipped.length) parts.push(`Bỏ qua ${result.skipped.length} ảnh.`);
      if (result.failed.length) parts.push(`Thất bại ${result.failed.length} ảnh.`);
      setNotice(parts.join(" "));
    } catch (error) {
      setNotice(error instanceof Error ? error.message : "Không thể xoá watermark.");
    }
  }

  const actions = (
    <div className="flex flex-wrap items-center justify-end gap-2">
      <Select value={chapterId} onValueChange={setChapterId}>
        <SelectTrigger className="h-8 w-[220px] text-[11px]">
          <SelectValue placeholder="All chapters" />
        </SelectTrigger>
        <SelectContent>
          <SelectItem value={ALL_ASSET_CHAPTERS}>All chapters</SelectItem>
          {sortedChapters.map((chapter) => (
            <SelectItem key={chapter.id} value={chapter.id}>
              Chapter {chapter.orderIndex + 1} · {chapter.title}
            </SelectItem>
          ))}
        </SelectContent>
      </Select>
      <Button
        variant="outline"
        size="sm"
        onClick={() => void removeWatermarks(pendingAssetIds)}
        disabled={busy || pendingAssetIds.length === 0}
      >
        <Eraser size={13} />
        {watermarkRemovalMutation.isPending
          ? "Removing…"
          : `Remove all watermarks${pendingAssetIds.length ? ` (${pendingAssetIds.length})` : ""}`}
      </Button>
      <Button size="sm" onClick={() => void importAsset()} disabled={busy}>
        <Plus size={13} /> {importAssetMutation.isPending ? "Importing…" : "Import asset"}
      </Button>
    </div>
  );

  return (
    <FeaturePage
      title="Asset Browser"
      description="Project-local image, audio và video trên máy hiện tại."
      actions={actions}
      contentClassName="min-h-0 overflow-auto bg-background p-0"
    >
      {notice ? <InlineNotice>{notice}</InlineNotice> : null}
      {visibleAssets.length ? (
        <div className="grid grid-cols-[repeat(auto-fill,minmax(210px,1fr))] gap-px bg-border-subtle">
          {visibleAssets.map((asset) => {
            const localState = localStates[asset.id];
            const watermarkState = watermarkStates[asset.id];
            const Icon = asset.type === "AUDIO" ? FileAudio : asset.type === "IMAGE" ? FileImage : Film;
            const needsRepair = Boolean(localState && localState !== "AVAILABLE");
            const canPreviewImage = asset.type === "IMAGE" && localState === "AVAILABLE";
            return (
              <article key={asset.id} className="group min-w-0 bg-surface-panel transition-colors hover:bg-surface-hover">
                <div className="relative grid aspect-video place-items-center overflow-hidden bg-surface-dark text-text-muted">
                  {canPreviewImage ? (
                    <img
                      src={previewUrl(projectId, asset.id, watermarkState)}
                      alt={asset.originalFilename}
                      className="h-full w-full object-cover transition-transform duration-150 group-hover:scale-[1.015]"
                      loading="lazy"
                    />
                  ) : (
                    <Icon size={24} strokeWidth={1.4} />
                  )}
                  <span className="absolute left-2 top-2 bg-background/85 px-1.5 py-0.5 text-[8px] font-semibold uppercase tracking-[0.08em] text-text-secondary backdrop-blur-sm">
                    {asset.type}
                  </span>
                  {watermarkState === "PENDING" || watermarkState === "REMOVED" ? (
                    <span className="absolute right-2 top-2 bg-background/85 px-1.5 py-0.5 text-[8px] font-semibold uppercase tracking-[0.06em] text-text-secondary backdrop-blur-sm">
                      Watermark {watermarkState === "REMOVED" ? "removed" : "pending"}
                    </span>
                  ) : null}
                </div>
                <div className="p-2.5">
                  <h2 className="truncate text-[11px] font-semibold text-foreground" title={asset.originalFilename}>{asset.originalFilename}</h2>
                  <div className="mt-1.5 flex min-w-0 flex-wrap items-center gap-x-2 gap-y-1 text-[9px] text-text-dim">
                    <span>{formatBytes(asset.sizeBytes)}</span>
                    {asset.durationMs ? <span>{formatDuration(asset.durationMs)}</span> : null}
                    <span>{asset.status}</span>
                  </div>
                  <div className="mt-2 flex items-center justify-between gap-2 border-t border-border-subtle pt-2">
                    <StatusIndicator label={localState ?? (localStatesQuery.isPending ? "CHECKING" : "UNKNOWN")} tone={needsRepair ? "warning" : localState === "AVAILABLE" ? "success" : "neutral"} />
                    <div className="flex flex-wrap items-center justify-end gap-1.5">
                      {needsRepair ? (
                        <Button variant="outline" size="sm" onClick={() => void importAsset(asset.id)} disabled={busy}>
                          <Wrench size={11} /> Repair
                        </Button>
                      ) : null}
                      {asset.type === "IMAGE" && watermarkState === "PENDING" ? (
                        <Button
                          variant="outline"
                          size="sm"
                          onClick={() => void removeWatermarks([asset.id])}
                          disabled={busy || localState !== "AVAILABLE"}
                        >
                          <Eraser size={11} /> Remove watermark
                        </Button>
                      ) : null}
                    </div>
                  </div>
                </div>
              </article>
            );
          })}
        </div>
      ) : (
        <EmptyState
          title={assets.length ? "Không có asset trong chapter này" : "Chưa có asset"}
          description={
            assets.length
              ? "Chọn chapter khác hoặc All chapters để xem các asset còn lại."
              : "Import image, audio hoặc video từ máy để bắt đầu."
          }
        />
      )}
    </FeaturePage>
  );
}

function previewUrl(
  projectId: string,
  assetId: string,
  watermarkState: ProjectAssetWatermarkState | undefined,
) {
  const base = localAssetPreviewUrl(projectId, assetId);
  return `${base}?watermark=${encodeURIComponent(watermarkState ?? "UNKNOWN")}`;
}

function formatBytes(value: number) {
  if (value < 1024) return `${value} B`;
  if (value < 1024 * 1024) return `${(value / 1024).toFixed(1)} KB`;
  return `${(value / (1024 * 1024)).toFixed(1)} MB`;
}

function formatDuration(value: number) {
  const totalSeconds = Math.round(value / 1000);
  const minutes = Math.floor(totalSeconds / 60);
  const seconds = totalSeconds % 60;
  return `${minutes}:${String(seconds).padStart(2, "0")}`;
}
