import { useEffect, useState } from "react";
import {
  AlertCircle,
  CheckCircle2,
  ChevronDown,
  FileImage,
  Film,
  FolderOpen,
  Image as ImageIcon,
  RotateCcw,
  SlidersHorizontal,
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
  onUploadMedia: (type?: "IMAGE" | "VIDEO") => void;
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
  const [notes, setNotes] = useState("");

  useEffect(() => {
    setIsAssetPickerOpen(false);
    setShowAdvanced(false);
    setActiveTab("scene");
    setNotes("");
  }, [selectedBeat]);

  const beatTitle = selectedBeat?.title || "Visual Beat";
  const durationText = selectedBeat ? formatTimecode(selectedBeat.durationMs) : "00:10.00";
  const visibleMediaNotice =
    selectedBeat && mediaNotice?.beatId === selectedBeat.visualBeatId ? mediaNotice : null;

  return (
    <aside className="nx-editor-inspector flex h-full min-h-0 flex-col bg-surface-panel font-sans text-foreground">
      <div className="flex h-14 shrink-0 items-center border-b border-border-subtle px-5">
        <h3 className="text-[14px] font-bold text-foreground">Inspector</h3>
      </div>

      <div
        role="tablist"
        aria-label="Inspector sections"
        className="flex border-b border-border-subtle bg-surface-dark px-4"
      >
        <InspectorTabButton tab="scene" label="Scene" active={activeTab === "scene"} onClick={() => setActiveTab("scene")} />
        <InspectorTabButton tab="audio" label="Audio" active={activeTab === "audio"} onClick={() => setActiveTab("audio")} />
        <InspectorTabButton tab="effects" label="Effects" active={activeTab === "effects"} onClick={() => setActiveTab("effects")} />
      </div>

      <div className="min-h-0 flex-1 space-y-4 overflow-y-auto p-4">
        {activeTab === "scene" && (
          <div role="tabpanel" id="inspector-panel-scene" aria-labelledby="inspector-tab-scene" className="space-y-4">
            <section className="space-y-3">
              <h4 className="text-[12px] font-bold text-foreground">Scene Settings</h4>

              <div>
                <label className="mb-1.5 block text-[11px] text-text-dim">Name</label>
                <input
                  aria-label="Scene name"
                  readOnly
                  value={beatTitle}
                  className="h-8 w-full rounded-md border border-border-subtle bg-surface-input px-3 text-[11px] text-foreground focus:outline-none"
                />
              </div>

              <div className="grid grid-cols-[repeat(auto-fit,minmax(112px,1fr))] gap-2.5">
                <div>
                  <label className="mb-1.5 block text-[11px] text-text-dim">Duration</label>
                  <input
                    aria-label="Scene duration"
                    readOnly
                    value={durationText}
                    className="h-8 w-full rounded-md border border-border-subtle bg-surface-input px-3 font-mono text-[11px] text-foreground focus:outline-none"
                  />
                </div>
                <div>
                  <label className="mb-1.5 block text-[11px] text-text-dim">Transition</label>
                  <div className="flex h-8 w-full items-center justify-between rounded-md border border-border-subtle bg-surface-input px-3 text-[11px] text-foreground">
                    <span>None</span>
                    <ChevronDown size={13} className="text-text-muted" aria-hidden="true" />
                  </div>
                </div>
              </div>
            </section>

            <section className="space-y-2">
              <h4 className="text-[12px] font-bold text-foreground">Media</h4>

              <div className="flex min-h-[140px] flex-col items-center justify-center rounded-lg border border-border-subtle bg-[#0a0e16] p-4 text-center">
                <ImageIcon size={26} className="text-text-muted opacity-80" strokeWidth={1.5} aria-hidden="true" />
                <p className="mt-2.5 text-[12px] font-medium text-text-secondary">Drag &amp; drop media here</p>
                <p className="mt-0.5 text-[10px] text-text-dim">or</p>
                <button
                  type="button"
                  disabled={mediaBusy}
                  onClick={() => onUploadMedia()}
                  className="mt-2.5 h-8 rounded-md bg-[#2d1b54] px-4 text-[11px] font-semibold text-white shadow-[0_0_12px_rgba(109,60,207,0.25)] transition hover:bg-[#3c246f] active:scale-95 disabled:opacity-40"
                >
                  Upload Media
                </button>
              </div>

              <div className="flex items-center justify-between pt-1 text-[10px]">
                <span className="text-text-dim">Current source</span>
                <span className="rounded border border-border-subtle bg-surface-input px-2 py-0.5 font-medium text-text-secondary">
                  {selectedBeat ? mediaSourceLabel(selectedBeat) : "Auto / Default"}
                </span>
              </div>

              <div className="relative pt-1">
                <button
                  type="button"
                  disabled={mediaBusy}
                  onClick={() => setIsAssetPickerOpen((open) => !open)}
                  className="flex h-7 w-full items-center justify-center gap-1.5 rounded-md border border-border-subtle bg-surface-input text-[10px] font-medium text-text-secondary transition hover:border-border hover:bg-surface-2"
                >
                  <FolderOpen size={12} />
                  <span>Choose From Assets</span>
                </button>

                {isAssetPickerOpen && (
                  <div className="absolute right-0 top-9 z-40 max-h-48 w-full overflow-y-auto rounded-lg border border-border-subtle bg-surface-elevated p-1 shadow-[var(--shadow-panel)]">
                    {selectableAssets.length ? (
                      selectableAssets.map((asset) => (
                        <button
                          key={asset.id}
                          type="button"
                          onClick={() => {
                            onChooseAsset(asset.id);
                            setIsAssetPickerOpen(false);
                          }}
                          className="flex w-full items-center gap-2 rounded px-2 py-1.5 text-left transition hover:bg-surface-3"
                        >
                          {asset.type === "IMAGE" ? <FileImage size={12} /> : <Film size={12} />}
                          <span className="min-w-0 flex-1 truncate text-[10px] text-text-secondary">{asset.originalFilename}</span>
                        </button>
                      ))
                    ) : (
                      <div className="p-3 text-center text-[10px] text-text-muted">Không có asset phù hợp.</div>
                    )}
                  </div>
                )}
              </div>

              {selectedBeat?.mediaSelectionActive && (
                <button
                  type="button"
                  onClick={onResetSource}
                  disabled={mediaBusy}
                  className="flex h-7 w-full items-center justify-center gap-1.5 rounded-md border border-border-subtle bg-surface-input text-[10px] text-text-muted transition hover:border-border hover:bg-surface-2 hover:text-foreground disabled:opacity-50"
                >
                  <RotateCcw size={11} />
                  Use generated source
                </button>
              )}

              {mediaBusy && (
                <p className="rounded-md border border-border-subtle bg-background px-2.5 py-1.5 text-[10px] text-text-muted" role="status">
                  Đang lưu thay đổi…
                </p>
              )}

              {visibleMediaNotice && !mediaBusy && (
                <div
                  className={`rounded-md border px-2.5 py-2 text-[10px] leading-4 ${
                    visibleMediaNotice.tone === "success"
                      ? "border-success/30 bg-success-bg text-success"
                      : "border-danger/30 bg-danger-bg text-danger"
                  }`}
                  role={visibleMediaNotice.tone === "error" ? "alert" : "status"}
                >
                  <div className="flex items-start gap-2">
                    {visibleMediaNotice.tone === "success" ? (
                      <CheckCircle2 size={12} className="mt-0.5 shrink-0" />
                    ) : (
                      <AlertCircle size={12} className="mt-0.5 shrink-0" />
                    )}
                    <div className="min-w-0 flex-1">
                      <p>{visibleMediaNotice.message}</p>
                      {visibleMediaNotice.retry && (
                        <button
                          type="button"
                          onClick={visibleMediaNotice.retry}
                          className="mt-2 rounded-md border border-current/30 px-2 py-1 text-[10px] font-semibold transition hover:bg-background/30"
                        >
                          Thử lại
                        </button>
                      )}
                    </div>
                  </div>
                </div>
              )}
            </section>

            <section className="space-y-2">
              <h4 className="text-[12px] font-bold text-foreground">Notes</h4>
              <div className="relative">
                <textarea
                  aria-label="Notes for this scene"
                  value={notes}
                  onChange={(event) => setNotes(event.target.value.slice(0, 500))}
                  maxLength={500}
                  placeholder="Ghi chú cho cảnh này..."
                  className="h-28 w-full resize-none rounded-lg border border-border-subtle bg-[#0a0e16] p-3 text-[11px] text-foreground placeholder:text-text-dim focus:border-primary/60 focus:outline-none"
                />
                <span className="pointer-events-none absolute bottom-2.5 right-3 text-[10px] text-text-dim">
                  {notes.length} / 500
                </span>
              </div>
            </section>

            <section className="space-y-2 rounded-lg border border-border-subtle bg-surface p-3">
              <div className="flex items-center justify-between">
                <span className="flex items-center gap-1.5 text-[11px] font-semibold text-primary">
                  <WandSparkles size={12} /> Auto Edit Decision
                </span>
                <span className="rounded bg-primary-muted px-1.5 py-0.5 text-[10px] font-bold uppercase tracking-wider text-primary">
                  {autoDecision?.source === "AI_DIRECTED" ? "AI directed" : "Rule engine"}
                </span>
              </div>
              <div className="grid grid-cols-[repeat(auto-fit,minmax(108px,1fr))] gap-2">
                <InfoCell label="Motion" value={autoDecision?.cameraMovement || "NONE"} />
                <InfoCell label="Fit" value={autoDecision?.fitMode || selectedBeat?.fitMode || "TRIM"} />
                <InfoCell label="Trim start" value={formatTimecode(autoDecision?.trimStartMs ?? selectedBeat?.trimStartMs ?? 0)} />
                <InfoCell label="Clock" value="Narration" />
              </div>
              <p className="text-[10px] leading-4 text-text-muted">
                {autoDecision?.reason || "Narration controls beat duration and FFmpeg auto-fits the media."}
              </p>
              <button
                type="button"
                onClick={() => setShowAdvanced((value) => !value)}
                className="flex h-8 w-full items-center justify-center gap-1.5 rounded-md border border-border bg-surface-input text-[10px] font-medium text-text-muted transition hover:bg-surface-2 hover:text-foreground"
              >
                <SlidersHorizontal size={11} />
                {showAdvanced ? "Hide manual override" : "Manual override"}
              </button>
              {showAdvanced && (
                <div className="space-y-2 rounded-lg border border-border-subtle bg-background p-2.5">
                  <p className="text-[10px] leading-4 text-text-dim">Ghi đè quyết định Auto Edit cho beat hiện tại.</p>
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
                        disabled={mediaBusy || !selectedBeat?.mediaAssetId}
                        onClick={() => onUpdateFitMode(mode)}
                        className={`rounded-md py-1.5 text-[10px] font-medium transition-colors disabled:opacity-40 ${
                          selectedBeat?.fitMode === mode
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
            </section>
          </div>
        )}

        {activeTab === "audio" && (
          <section
            role="tabpanel"
            id="inspector-panel-audio"
            aria-labelledby="inspector-tab-audio"
            className="space-y-2 rounded-lg border border-border-subtle bg-surface p-3.5"
          >
            <h4 className="text-[12px] font-bold text-foreground">Audio Sync</h4>
            <p className="text-[11px] leading-5 text-text-dim">
              Timing của visual beat được căn theo master narration track. Audio controls chi tiết được quản lý ở workflow Voice và timeline.
            </p>
          </section>
        )}

        {activeTab === "effects" && (
          <section
            role="tabpanel"
            id="inspector-panel-effects"
            aria-labelledby="inspector-tab-effects"
            className="space-y-2 rounded-lg border border-border-subtle bg-surface p-3.5"
          >
            <h4 className="text-[12px] font-bold text-foreground">Visual Effects</h4>
            <p className="text-[11px] text-text-dim">
              Current motion: <strong className="text-foreground">{selectedBeat?.cameraMovement || "Auto"}</strong>
            </p>
          </section>
        )}
      </div>
    </aside>
  );
}

function InspectorTabButton({
  tab,
  label,
  active,
  onClick,
}: Readonly<{ tab: InspectorTab; label: string; active: boolean; onClick: () => void }>) {
  return (
    <button
      id={`inspector-tab-${tab}`}
      type="button"
      role="tab"
      aria-selected={active}
      aria-controls={`inspector-panel-${tab}`}
      onClick={onClick}
      className={`relative px-4 py-2.5 text-[11px] font-medium transition ${
        active ? "font-semibold text-primary" : "text-text-muted hover:text-foreground"
      }`}
    >
      {label}
      {active && <span className="absolute inset-x-0 bottom-0 h-[2px] bg-primary" aria-hidden="true" />}
    </button>
  );
}

function InfoCell({ label, value }: Readonly<{ label: string; value: string }>) {
  return (
    <div className="min-w-0 rounded-md border border-border-subtle bg-background px-2.5 py-2">
      <span className="block text-[9px] uppercase tracking-wider text-text-dim">{label}</span>
      <strong className="mt-1 block truncate text-[10px] font-medium text-text-secondary">{value}</strong>
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
