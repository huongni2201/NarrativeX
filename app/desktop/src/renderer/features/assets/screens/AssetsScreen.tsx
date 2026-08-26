import { useEffect, useState } from "react";
import { useQueryClient } from "@tanstack/react-query";
import type { DesktopAsset } from "@narrativex/client-contracts";
import { FileAudio, FileImage, Film, Plus, Wrench } from "lucide-react";
import { Button } from "@/components/ui/button";
import { EmptyState, FeaturePage } from "../../workspace/components/FeaturePage";
import { assetsApi } from "../api/assets.api";

type LocalState = "AVAILABLE" | "MISSING" | "CORRUPT";

export function AssetsScreen({
  projectId,
  assets,
}: Readonly<{
  projectId: string;
  assets: DesktopAsset[];
}>) {
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
      description="Quản lý remote metadata và materialized file trên máy hiện tại trong cùng một feature."
      actions={
        <Button size="sm" onClick={() => void importAsset()} disabled={busy}>
          <Plus size={14} /> {busy ? "Importing…" : "Import asset"}
        </Button>
      }
    >
      {notice && <p className="mb-3 text-[10px] text-muted-foreground">{notice}</p>}
      <div className="grid grid-cols-[repeat(auto-fill,minmax(230px,1fr))] gap-3">
        {assets.map((asset) => {
          const localState = localStates[asset.id];
          const Icon = asset.type === "AUDIO" ? FileAudio : asset.type === "IMAGE" ? FileImage : Film;
          return (
            <article key={asset.id} className="overflow-hidden rounded-lg border border-border bg-card">
              <div className="grid min-h-28 place-items-center bg-secondary text-primary-hover">
                <Icon size={28} />
              </div>
              <div className="grid gap-2 p-3">
                <div>
                  <span className="text-[9px] uppercase tracking-[.12em] text-muted-foreground">{asset.type}</span>
                  <h2 className="truncate text-xs font-semibold" title={asset.originalFilename}>{asset.originalFilename}</h2>
                </div>
                <p className="text-[10px] text-muted-foreground">
                  {formatBytes(asset.sizeBytes)}
                  {asset.durationMs ? ` · ${formatDuration(asset.durationMs)}` : ""}
                  {` · ${asset.status} · ${localState ?? asset.storageMode ?? "REMOTE"}`}
                </p>
                {localState && localState !== "AVAILABLE" && (
                  <Button variant="outline" size="sm" onClick={() => void importAsset(asset.id)} disabled={busy}>
                    <Wrench size={13} /> Repair local file
                  </Button>
                )}
              </div>
            </article>
          );
        })}
      </div>
      {!assets.length && (
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
