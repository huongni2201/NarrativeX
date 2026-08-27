import { useEffect, useState } from "react";
import {
  AlertCircle,
  CheckCircle2,
  FileImage,
  Film,
  FolderOpen,
  RotateCcw,
  SlidersHorizontal,
  Upload,
  WandSparkles,
} from "lucide-react";
import type {
  AutoEditBeatDecision,
  BeatMediaFitMode,
  DesktopAsset,
  DesktopTimelineBeat,
} from "@narrativex/client-contracts";
import type { MediaMutationNotice } from "../EditorScreen";

interface EditorInspectorPanelProps {
  selectedBeat: DesktopTimelineBeat | null;
  autoDecision: AutoEditBeatDecision | null;
  selectableAssets: DesktopAsset[];
  mediaBusy: boolean;
  mediaNotice: MediaMutationNotice | null;
  onUploadMedia: (type: "IMAGE" | "VIDEO") => void;
  onChooseAsset: (assetId: string) => void;
  onUpdateFitMode: (fitMode: BeatMediaFitMode) => void;
  onResetSource: () => void;
}

type InspectorTab = "scene" | "audio" | "effects";

export function EditorInspectorPanel({
  selectedBeat,
  autoDecision,
  selectableAssets,
  mediaBusy,
  mediaNotice,
  onUploadMedia,
  onChooseAsset,
  onUpdateFitMode,
  onResetSource,
}: Readonly<EditorInspectorPanelProps>) {
  const [activeTab, setActiveTab] = useState<InspectorTab>("scene");
  const [isAssetPickerOpen, setIsAssetPickerOpen] = useState(false);
  const [showAdvanced, setShowAdvanced] = useState(false);

  useEffect(() => {
    setIsAssetPickerOpen(false);
    setShowAdvanced(false);
    setActiveTab("scene");
  }, [selectedBeat]);

  return (
    <aside className="flex h-full min-h-0 flex-col bg-surface-panel text-[10px]">
      <div className="nx-panel-header flex items-center px-4">
        <div>
          <h3 className="text-[12px] font-semibold text-foreground">Inspector</h3>
          <p className="mt-0.5 text-[9px] text-text-dim">Context for the selected visual beat</p>
        </div>
      </div>

      <div className="grid grid-cols-3 border-b border-border-subtle bg-surface-dark px-3 pt-2">
        <InspectorTabButton label="Scene" active={activeTab === "scene"} onClick={() => setActiveTab("scene")} />
        <InspectorTabButton label="Audio" active={activeTab === "audio"} onClick={() => setActiveTab("audio")} />
        <InspectorTabButton label="Effects" active={activeTab === "effects"} onClick={() => setActiveTab("effects")} />
      </div>

      <div className="min-h-0 flex-1 overflow-y-auto p-3">
        {selectedBeat ? (
          <div className="space-y-3">
            {activeTab === "scene" && (
              <>
                <InspectorCard title="Scene Settings">
                  <div className="space-y-2">
                    <div className="rounded-md border border-border-subtle bg-background p-3">
                      <span className="text-[8px] font-semibold uppercase tracking-[0.12em] text-text-dim">Visual Beat</span>
                      <div className="mt-1.5 flex items-center justify-between gap-2">
                        <strong className="truncate text-[11px] font-semibold text-foreground">{selectedBeat.title || "Visual Beat"}</strong>
                        <span className={`rounded-md border px-2 py-1 text-[8px] font-medium ${selectedBeat.assetReady ? "border-success/30 bg-success-bg text-success" : "border-border bg-surface-2 text-text-muted"}`}>
                          {selectedBeat.assetReady ? "Ready" : "Draft"}
                        </span>
                      </div>
                    </div>
                    <div className="grid grid-cols-2 gap-2">
                      <InfoCell label="Duration" value={formatTimecode(selectedBeat.durationMs)} />
                      <InfoCell label="Media" value={selectedBeat.mediaType || "Generated"} />
                      <InfoCell label="Fit mode" value={selectedBeat.fitMode} />
                      <InfoCell label="Clock" value="Narration" />
                    </div>
                  </div>
                </InspectorCard>

                <InspectorCard title="Auto Edit">
                  <div className="rounded-lg border border-primary/25 bg-primary-muted p-3">
                    <div className="flex items-center justify-between gap-2">
                      <span className="flex items-center gap-1.5 text-[10px] font-semibold text-primary-hover">
                        <WandSparkles size={12} /> NarrativeX decision
                      </span>
                      <span className="rounded-md border border-primary/20 bg-background/60 px-2 py-1 text-[7px] uppercase tracking-wider text-primary-hover">
                        {autoDecision?.source === "AI_DIRECTED" ? "AI directed" : "Rule engine"}
                      </span>
                    </div>
                    <div className="mt-3 grid grid-cols-2 gap-2">
                      <InfoCell label="Motion" value={autoDecision?.cameraMovement || "NONE"} />
                      <InfoCell label="Fit" value={autoDecision?.fitMode || selectedBeat.fitMode} />
                      <InfoCell label="Trim start" value={formatTimecode(autoDecision?.trimStartMs ?? selectedBeat.trimStartMs)} />
                      <InfoCell label="Clock" value="Narration" />
                    </div>
                    <p className="mt-3 text-[9px] leading-4 text-text-muted">
                      {autoDecision?.reason || "Narration controls the beat clock and FFmpeg executes the selected edit parameters."}
                    </p>
                  </div>

                  <button
                    type="button"
                    onClick={() => setShowAdvanced((value) => !value)}
                    className="mt-2 flex h-8 w-full items-center justify-center gap-1.5 rounded-md border border-border bg-surface-input text-[9px] font-medium text-text-muted transition hover:bg-surface-2 hover:text-foreground"
                  >
                    <SlidersHorizontal size={11} />
                    {showAdvanced ? "Hide manual override" : "Manual override"}
                  </button>

                  {showAdvanced && (
                    <div className="mt-2 space-y-2 rounded-lg border border-border-subtle bg-background p-2.5">
                      <p className="text-[8px] leading-4 text-text-dim">
                        Ghi đè quyết định Auto Edit cho beat hiện tại.
                      </p>
                      <div className="grid grid-cols-2 gap-1.5 rounded-md border border-border-subtle bg-surface p-1.5">
                        {(
                          [
                            { mode: "TRIM", label: "Trim" },
                            { mode: "LOOP", label: "Loop" },
                            { mode: "FREEZE_END", label: "Freeze" },
                            { mode: "SPEED_ADJUST", label: "Speed" },
                          ] as const
                        ).map(({ mode, label }) => (
                          <button
                            key={mode}
                            type="button"
                            disabled={mediaBusy || !selectedBeat.mediaAssetId}
                            onClick={() => onUpdateFitMode(mode)}
                            className={`rounded-md py-1.5 text-[8px] font-medium transition-colors disabled:opacity-40 ${
                              selectedBeat.fitMode === mode
                                ? "bg-primary text-primary-foreground"
                                : "text-text-muted hover:bg-surface-2 hover:text-foreground"
                            }`}
                          >
                            {label}
                          </button>
                        ))}
                      </div>
                    </div>
                  )}
                </InspectorCard>

                <InspectorCard title="Media">
                  <div className="flex items-center justify-between gap-2">
                    <span className="text-[9px] text-text-muted">Current source</span>
                    <span className="rounded-md border border-border bg-surface-2 px-2 py-1 text-[8px] font-medium text-text-secondary">
                      {mediaSourceLabel(selectedBeat)}
                    </span>
                  </div>

                  <div className="mt-2 rounded-lg border border-dashed border-border p-3 text-center">
                    <p className="text-[9px] text-text-muted">Replace media for this visual beat</p>
                    <div className="mt-3 grid grid-cols-2 gap-2">
                      <ActionButton icon={<Upload size={11} />} label="Upload Image" disabled={mediaBusy} onClick={() => onUploadMedia("IMAGE")} />
                      <ActionButton icon={<Film size={11} />} label="Upload Video" disabled={mediaBusy} onClick={() => onUploadMedia("VIDEO")} />
                    </div>
                    <div className="relative mt-2">
                      <ActionButton
                        icon={<FolderOpen size={11} />}
                        label="Choose From Assets"
                        disabled={mediaBusy}
                        onClick={() => setIsAssetPickerOpen((open) => !open)}
                      />
                      {isAssetPickerOpen && (
                        <div className="absolute right-0 top-9 z-40 max-h-52 w-full overflow-y-auto rounded-lg border border-border bg-surface-elevated p-1.5 shadow-[var(--shadow-panel)]">
                          {selectableAssets.length ? (
                            selectableAssets.map((asset) => (
                              <button
                                key={asset.id}
                                type="button"
                                onClick={() => {
                                  onChooseAsset(asset.id);
                                  setIsAssetPickerOpen(false);
                                }}
                                className="flex w-full items-center gap-2 rounded-md px-2 py-2 text-left transition hover:bg-surface-3"
                              >
                                {asset.type === "IMAGE" ? <FileImage size={12} /> : <Film size={12} />}
                                <span className="min-w-0 flex-1 truncate text-[9px] text-text-secondary">{asset.originalFilename}</span>
                              </button>
                            ))
                          ) : (
                            <div className="p-3 text-center text-[9px] text-text-muted">Không có asset phù hợp.</div>
                          )}
                        </div>
                      )}
                    </div>
                  </div>

                  {selectedBeat.mediaSelectionActive && (
                    <button
                      type="button"
                      onClick={onResetSource}
                      disabled={mediaBusy}
                      className="mt-2 flex h-8 w-full items-center justify-center gap-1.5 rounded-md border border-border bg-surface-input text-[9px] text-text-muted transition hover:border-border-dark hover:bg-surface-2 hover:text-foreground disabled:opacity-50"
                    >
                      <RotateCcw size={11} />
                      Use generated source
                    </button>
                  )}

                  {mediaBusy && (
                    <p className="mt-2 rounded-md border border-border-subtle bg-background px-2.5 py-2 text-[9px] leading-4 text-text-muted" role="status">
                      Đang lưu thay đổi…
                    </p>
                  )}

                  {mediaNotice && !mediaBusy && (
                    <div
                      className={`mt-2 rounded-md border px-2.5 py-2 text-[9px] leading-4 ${
                        mediaNotice.tone === "success"
                          ? "border-success/30 bg-success-bg text-success"
                          : "border-danger/30 bg-danger-bg text-danger"
                      }`}
                      role={mediaNotice.tone === "error" ? "alert" : "status"}
                    >
                      <div className="flex items-start gap-2">
                        {mediaNotice.tone === "success" ? (
                          <CheckCircle2 size={12} className="mt-0.5 shrink-0" />
                        ) : (
                          <AlertCircle size={12} className="mt-0.5 shrink-0" />
                        )}
                        <div className="min-w-0 flex-1">
                          <p>{mediaNotice.message}</p>
                          {mediaNotice.retry && (
                            <button
                              type="button"
                              onClick={mediaNotice.retry}
                              className="mt-2 rounded-md border border-current/30 px-2 py-1 text-[8px] font-semibold transition hover:bg-background/30"
                            >
                              Thử lại
                            </button>
                          )}
                        </div>
                      </div>
                    </div>
                  )}
                </InspectorCard>

                <InspectorCard title="Visual Intent">
                  <p className="min-h-20 rounded-md border border-border bg-surface-input p-3 text-[9px] leading-5 text-text-secondary">
                    {selectedBeat.visualIntent || "Chưa có mô tả visual beat."}
                  </p>
                </InspectorCard>
              </>
            )}

            {activeTab === "audio" && (
              <InspectorCard title="Audio Sync">
                <div className="rounded-lg border border-border-subtle bg-background p-3">
                  <span className="block text-[10px] font-medium text-text-secondary">Narration master clock</span>
                  <p className="mt-1.5 text-[9px] leading-4 text-text-dim">
                    Timing của visual beat được căn theo narration. Audio controls chi tiết tiếp tục được quản lý ở các workflow Voice và timeline hiện có.
                  </p>
                  <div className="mt-3 grid grid-cols-2 gap-2">
                    <InfoCell label="Sync" value="Automatic" />
                    <InfoCell label="Beat duration" value={formatTimecode(selectedBeat.durationMs)} />
                  </div>
                </div>
              </InspectorCard>
            )}

            {activeTab === "effects" && (
              <InspectorCard title="Visual Effects">
                <div className="rounded-lg border border-border-subtle bg-background p-3">
                  <span className="block text-[10px] font-medium text-text-secondary">Current motion</span>
                  <strong className="mt-1.5 block text-[11px] text-foreground">{selectedBeat.cameraMovement || "Default"}</strong>
                  <p className="mt-2 text-[9px] leading-4 text-text-dim">
                    Manual fit overrides are available in Scene → Auto Edit. Dedicated effects are intentionally not exposed until the underlying behavior is supported by the production pipeline.
                  </p>
                </div>
              </InspectorCard>
            )}
          </div>
        ) : (
          <div className="grid min-h-48 place-items-center rounded-lg border border-dashed border-border p-5 text-center text-[9px] leading-5 text-text-muted">
            Chọn một visual beat để review quyết định Auto Edit.
          </div>
        )}
      </div>
    </aside>
  );
}

function InspectorTabButton({ label, active, onClick }: Readonly<{ label: string; active: boolean; onClick: () => void }>) {
  return (
    <button
      type="button"
      onClick={onClick}
      className={`border-b-2 px-2 py-2.5 text-[10px] font-medium transition ${active ? "border-primary text-primary-hover" : "border-transparent text-text-muted hover:text-foreground"}`}
    >
      {label}
    </button>
  );
}

function InspectorCard({ title, children }: Readonly<{ title: string; children: React.ReactNode }>) {
  return (
    <section className="rounded-lg border border-border-subtle bg-surface p-3">
      <h4 className="mb-2.5 text-[9px] font-semibold uppercase tracking-[0.12em] text-text-dim">{title}</h4>
      {children}
    </section>
  );
}

function ActionButton({
  icon,
  label,
  disabled,
  onClick,
}: Readonly<{
  icon: React.ReactNode;
  label: string;
  disabled?: boolean;
  onClick?: () => void;
}>) {
  return (
    <button
      type="button"
      disabled={disabled}
      onClick={onClick}
      className="flex h-8 w-full items-center justify-center gap-1.5 rounded-md border border-border bg-surface-input text-[8px] font-medium text-text-secondary transition-colors hover:border-border-dark hover:bg-surface-2 disabled:opacity-45"
    >
      {icon}
      <span className="truncate">{label}</span>
    </button>
  );
}

function InfoCell({ label, value }: Readonly<{ label: string; value: string }>) {
  return (
    <div className="min-w-0 rounded-md border border-border-subtle bg-background px-2.5 py-2">
      <span className="block text-[7px] uppercase tracking-wider text-text-dim">{label}</span>
      <strong className="mt-1 block truncate text-[9px] font-medium text-text-secondary">{value}</strong>
    </div>
  );
}

function mediaSourceLabel(beat: DesktopTimelineBeat): string {
  if (!beat.mediaSelectionActive) return "Generated";
  if (beat.mediaType === "VIDEO") return "Video override";
  if (beat.mediaType === "IMAGE") return "Image override";
  return "Generated";
}

function formatTimecode(ms: number): string {
  const totalSeconds = Math.max(0, Math.floor(ms / 1000));
  const minutes = Math.floor(totalSeconds / 60);
  const seconds = totalSeconds % 60;
  const hundredths = Math.floor((ms % 1000) / 10);
  return `${String(minutes).padStart(2, "0")}:${String(seconds).padStart(2, "0")}.${String(hundredths).padStart(2, "0")}`;
}
