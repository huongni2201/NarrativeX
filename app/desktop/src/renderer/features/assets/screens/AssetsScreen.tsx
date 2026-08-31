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
      description="Quản lý metadata và file project-local trên máy hiện tại trong cùng một feature."
      actions={
        <Button size="sm" onClick={() => void importAsset()} disabled={busy}>
          <Plus size={13} /> {busy ? "Importing…" : "Import asset"}
        </Button>
      }
    >
      {notice && (
        <p className="mb-3 border-l-2 border-border-dark bg-surface-panel px-3 py-2 text-[10px] leading-4 text-text-muted" role="status">
          {notice}
        </p>
      )}
      <div className="grid grid-cols-[repeat(auto-fill,minmax(230px,1fr))] gap-2.5">
        {assets.map((asset) => {
          const localState = localStates[asset.id];
          const Icon = asset.type === "AUDIO" ? FileAudio : asset.type === "IMAGE" ? FileImage : Film;
          const needsRepair = Boolean(localState && localState !== "AVAILABLE");
          return (
            <article key={asset.id} className="overflow-hidden rounded-md border border-border bg-card transition-colors hover:border-border-dark">
              <div className="grid min-h-24 place-items-center border-b border-border-subtle bg-surface-dark text-text-muted">
                <Icon size={24} strokeWidth={1.5} />
              </div>
              <div className="grid gap-2.5 p-3">
                <div>
                  <span className="text-[10px] font-medium uppercase tracking-[0.1em] text-text-dim">{asset.type}</span>
                  <h2 className="mt-0.5 truncate text-[12px] font-semibold text-foreground" title={asset.originalFilename}>{asset.originalFilename}</h2>
                </div>
                <div className="flex flex-wrap items-center gap-x-1.5 gap-y-1 text-[10px] text-text-muted">
                  <span>{formatBytes(asset.sizeBytes)}</span>
                  {asset.durationMs ? <><span className="text-text-dim">·</span><span>{formatDuration(asset.durationMs)}</span></> : null}
                  <span className="text-text-dim">·</span>
                  <span>{asset.status}</span>
                  <span className="text-text-dim">·</span>
                  <span className={needsRepair ? "text-warning" : "text-success"}>{localState ?? "MISSING"}</span>
                </div>
                {needsRepair && (
                  <Button variant="outline" size="sm" onClick={() => void importAsset(asset.id)} disabled={busy}>
                    <Wrench size={12} /> Repair local file
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
