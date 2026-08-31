import { useEffect, useState } from "react";
import { useQueryClient } from "@tanstack/react-query";
import type { DesktopAsset } from "@narrativex/client-contracts";
import { FileAudio, FileImage, Film, Plus, Wrench } from "lucide-react";
import { Button } from "@/components/ui/button";
import { localAssetPreviewUrl } from "../../../../shared/local-asset-preview-url";
import { EmptyState, FeaturePage } from "../../workspace/components/FeaturePage";
import { InlineNotice, StatusIndicator } from "../../workspace/components/WorkstationPrimitives";
import { assetsApi } from "../api/assets.api";

type LocalState = "AVAILABLE" | "MISSING" | "CORRUPT";

export function AssetsScreen({ projectId, assets }: Readonly<{ projectId: string; assets: DesktopAsset[] }>) {
  const queryClient = useQueryClient();
  const [notice, setNotice] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  const [localStates, setLocalStates] = useState<Record<string, LocalState>>({});

  useEffect(() => {
    void refreshLocalStates(projectId).then(setLocalStates).catch(() => undefined);
  }, [projectId, assets.length]);

  async function importAsset(repairAssetId?: string) {
    setBusy(true);
    setNotice(null);
    try {
      const selection = await window.narrativex.localStorage.selectAsset();
      if (!selection) return;
      if (selection.kind === "OTHER") throw new Error("Chỉ hỗ trợ image, audio hoặc video asset.");

      const asset = repairAssetId
        ? { id: repairAssetId }
        : await assetsApi.registerLocal({
            projectId,
            type: selection.kind,
            originalFilename: selection.originalFilename,
            contentType: selection.contentType,
            sizeBytes: selection.sizeBytes,
            checksumSha256: selection.checksumSha256,
            durationMs: selection.durationMs,
          });

      if (repairAssetId) {
        await window.narrativex.localStorage.repairSelectedAsset({
          projectId,
          assetId: repairAssetId,
          kind: selection.kind,
          selectionToken: selection.selectionToken,
        });
      } else {
        await window.narrativex.localStorage.commitSelectedAsset({
          projectId,
          assetId: asset.id,
          kind: selection.kind,
          selectionToken: selection.selectionToken,
        });
      }

      await queryClient.invalidateQueries({ queryKey: ["assets", "library"] });
      setLocalStates(await refreshLocalStates(projectId));
      const durationLabel = selection.durationMs ? ` · ${formatDuration(selection.durationMs)}` : "";
      setNotice(`${selection.originalFilename} đã được ${repairAssetId ? "repair" : "import"}${durationLabel}.`);
    } catch (error) {
      setNotice(error instanceof Error ? error.message : "Không thể import asset.");
    } finally {
      setBusy(false);
    }
  }

  return (
    <FeaturePage
      title="Asset Browser"
      description="Project-local image, audio và video trên máy hiện tại."
      actions={<Button size="sm" onClick={() => void importAsset()} disabled={busy}><Plus size={13} /> {busy ? "Importing…" : "Import asset"}</Button>}
      contentClassName="min-h-0 overflow-auto bg-background p-0"
    >
      {notice ? <InlineNotice>{notice}</InlineNotice> : null}
      {assets.length ? (
        <div className="grid grid-cols-[repeat(auto-fill,minmax(210px,1fr))] gap-px bg-border-subtle">
          {assets.map((asset) => {
            const localState = localStates[asset.id];
            const Icon = asset.type === "AUDIO" ? FileAudio : asset.type === "IMAGE" ? FileImage : Film;
            const needsRepair = Boolean(localState && localState !== "AVAILABLE");
            const canPreviewImage = asset.type === "IMAGE" && localState === "AVAILABLE";
            return (
              <article key={asset.id} className="group min-w-0 bg-surface-panel transition-colors hover:bg-surface-hover">
                <div className="relative grid aspect-video place-items-center overflow-hidden bg-surface-dark text-text-muted">
                  {canPreviewImage ? (
                    <img
                      src={localAssetPreviewUrl(projectId, asset.id)}
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
                </div>
                <div className="p-2.5">
                  <h2 className="truncate text-[11px] font-semibold text-foreground" title={asset.originalFilename}>{asset.originalFilename}</h2>
                  <div className="mt-1.5 flex min-w-0 flex-wrap items-center gap-x-2 gap-y-1 text-[9px] text-text-dim">
                    <span>{formatBytes(asset.sizeBytes)}</span>
                    {asset.durationMs ? <span>{formatDuration(asset.durationMs)}</span> : null}
                    <span>{asset.status}</span>
                  </div>
                  <div className="mt-2 flex items-center justify-between gap-2 border-t border-border-subtle pt-2">
                    <StatusIndicator label={localState ?? "CHECKING"} tone={needsRepair ? "warning" : localState === "AVAILABLE" ? "success" : "neutral"} />
                    {needsRepair ? (
                      <Button variant="outline" size="sm" onClick={() => void importAsset(asset.id)} disabled={busy}>
                        <Wrench size={11} /> Repair
                      </Button>
                    ) : null}
                  </div>
                </div>
              </article>
            );
          })}
        </div>
      ) : (
        <EmptyState title="Chưa có asset" description="Import image, audio hoặc video từ máy để bắt đầu." />
      )}
    </FeaturePage>
  );
}

async function refreshLocalStates(projectId: string): Promise<Record<string, LocalState>> {
  const entries = await window.narrativex.localStorage.verifyProject(projectId);
  return Object.fromEntries(entries.map((entry) => [entry.assetId, entry.state]));
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
