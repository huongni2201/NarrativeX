import { useMemo, useState } from "react";
import type {
  DesktopAsset,
  DesktopChapterDetails,
  DesktopTimeline,
} from "@narrativex/client-contracts";
import { FileAudio, FileImage, Film, Plus, Wrench } from "lucide-react";
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
  const importAssetMutation = useProjectAssetImport(projectId);
  const localStates = localStatesQuery.data ?? {};
  const busy = importAssetMutation.isPending;

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

  const actions = (
    <div className="flex flex-wrap items-center justify-end gap-3">
      <Select value={chapterId} onValueChange={setChapterId}>
        <SelectTrigger className="h-9.5 w-[240px] text-[13px]">
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
      <Button size="default" onClick={() => void importAsset()} disabled={busy}>
        <Plus size={16} /> {importAssetMutation.isPending ? "Importing…" : "Import asset"}
      </Button>
    </div>
  );

  return (
    <FeaturePage
      title="Asset Browser"
      description="Project-local image, audio và video trên máy hiện tại."
      actions={actions}
      contentClassName="min-h-0 overflow-auto bg-background p-6 lg:p-8"
    >
      {notice ? <InlineNotice>{notice}</InlineNotice> : null}
      {visibleAssets.length ? (
        <div className="grid max-w-[1600px] grid-cols-[repeat(auto-fill,minmax(280px,1fr))] gap-5">
          {visibleAssets.map((asset) => {
            const localState = localStates[asset.id];
            const Icon = asset.type === "AUDIO" ? FileAudio : asset.type === "IMAGE" ? FileImage : Film;
            const needsRepair = Boolean(localState && localState !== "AVAILABLE");
            const canPreviewImage = asset.type === "IMAGE" && localState === "AVAILABLE";
            const canPreviewVideo = asset.type === "VIDEO" && localState === "AVAILABLE";
            return (
              <article key={asset.id} className="group min-w-0 overflow-hidden rounded-lg border border-border-subtle bg-surface-panel transition-all hover:border-primary/50 hover:bg-surface-hover shadow-sm">
                <div className="relative grid aspect-video place-items-center overflow-hidden bg-surface-dark text-text-muted">
                  {canPreviewImage ? (
                    <img
                      src={localAssetPreviewUrl(projectId, asset.id)}
                      alt={asset.originalFilename}
                      className="h-full w-full object-cover transition-transform duration-150 group-hover:scale-[1.02]"
                      loading="lazy"
                    />
                  ) : canPreviewVideo ? (
                    <video
                      src={localAssetPreviewUrl(projectId, asset.id)}
                      className="h-full w-full object-cover"
                      controls
                      preload="metadata"
                    />
                  ) : (
                    <Icon size={32} strokeWidth={1.4} />
                  )}
                  <span className="absolute left-2.5 top-2.5 rounded bg-background/90 px-2 py-0.5 text-[10px] font-semibold uppercase tracking-[0.08em] text-text-secondary backdrop-blur-sm border border-border-subtle">
                    {asset.type}
                  </span>
                </div>
                <div className="p-4">
                  <h2 className="truncate text-[13px] font-semibold text-foreground" title={asset.originalFilename}>{asset.originalFilename}</h2>
                  <div className="mt-2 flex min-w-0 flex-wrap items-center gap-x-2.5 gap-y-1 text-[11px] text-text-dim">
                    <span>{formatBytes(asset.sizeBytes)}</span>
                    {asset.durationMs ? <span>· {formatDuration(asset.durationMs)}</span> : null}
                    <span>· {asset.status}</span>
                  </div>
                  <div className="mt-3 flex items-center justify-between gap-2 border-t border-border-subtle pt-3">
                    <StatusIndicator label={localState ?? (localStatesQuery.isPending ? "CHECKING" : "UNKNOWN")} tone={needsRepair ? "warning" : localState === "AVAILABLE" ? "success" : "neutral"} />
                    <div className="flex flex-wrap items-center justify-end gap-1.5">
                      {needsRepair ? (
                        <Button variant="outline" size="sm" onClick={() => void importAsset(asset.id)} disabled={busy}>
                          <Wrench size={13} /> Repair
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
          icon={Film}
          title={assets.length ? "Không có asset trong chapter này" : "Chưa có asset media trong project"}
          description={
            assets.length
              ? "Chọn chapter khác hoặc All chapters để xem các asset còn lại."
              : "Import image, audio hoặc video từ máy của bạn để bắt đầu xây dựng production media."
          }
          action={
            <Button size="default" onClick={() => void importAsset()} disabled={busy}>
              <Plus size={16} /> Import asset ngay
            </Button>
          }
        />
      )}
    </FeaturePage>
  );
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
