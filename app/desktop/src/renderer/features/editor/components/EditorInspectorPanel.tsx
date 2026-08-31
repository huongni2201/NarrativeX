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
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import type { MediaMutationNotice } from "../EditorScreen";
import { getAllowedBeatFitModes } from "../model/editor-media-fit";

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
  const allowedFitModes = getAllowedBeatFitModes(selectedBeat?.mediaType ?? null);

  return (
    <aside className="nx-editor-inspector flex h-full min-h-0 flex-col bg-surface-panel font-sans text-foreground">
      <div className="flex h-14 shrink-0 items-center border-b border-border-subtle px-4">
        <div>
          <h3 className="text-[14px] font-semibold tracking-tight text-foreground">Inspector</h3>
          <p className="mt-0.5 truncate text-[10px] text-text-dim">{selectedBeat ? beatTitle : "No beat selected"}</p>
        </div>
      </div>

      <div
        role="tablist"
        aria-label="Inspector sections"
        className="flex border-b border-border-subtle bg-surface-dark px-3"
      >
        <InspectorTabButton tab="scene" label="Scene" active={activeTab === "scene"} onClick={() => setActiveTab("scene")} />
        <InspectorTabButton tab="audio" label="Audio" active={activeTab === "audio"} onClick={() => setActiveTab("audio")} />
        <InspectorTabButton tab="effects" label="Effects" active={activeTab === "effects"} onClick={() => setActiveTab("effects")} />
      </div>

      <div className="min-h-0 flex-1 overflow-y-auto px-4 py-3">
        {activeTab === "scene" && (
          <div role="tabpanel" id="inspector-panel-scene" aria-labelledby="inspector-tab-scene" className="divide-y divide-border-subtle">
            <section className="space-y-3 pb-4">
              <SectionTitle>Scene Settings</SectionTitle>

              <div>
                <FieldLabel>Name</FieldLabel>
                <Input aria-label="Scene name" readOnly value={beatTitle} className="text-[11px]" />
              </div>

              <div className="grid grid-cols-[repeat(auto-fit,minmax(112px,1fr))] gap-2.5">
                <div>
                  <FieldLabel>Duration</FieldLabel>
                  <Input aria-label="Scene duration" readOnly value={durationText} className="font-mono text-[11px]" />
                </div>
                <div>
                  <FieldLabel>Transition</FieldLabel>
                  <div className="flex h-8 w-full items-center justify-between rounded-md border border-border-subtle bg-surface-input px-3 text-[11px] text-text-secondary">
                    <span>None</span>
                    <ChevronDown size={13} className="text-text-muted" aria-hidden="true" />
                  </div>
                </div>
              </div>
            </section>

            <section className="space-y-2.5 py-4">
              <SectionTitle>Media</SectionTitle>

              <div className="flex min-h-[132px] flex-col items-center justify-center border-y border-dashed border-border-subtle bg-background/35 p-4 text-center">
                <ImageIcon size={24} className="text-text-muted" strokeWidth={1.5} aria-hidden="true" />
                <p className="mt-2 text-[11px] font-medium text-text-secondary">Drag &amp; drop media here</p>
                <p className="mt-0.5 text-[10px] text-text-dim">or choose a source</p>
                <Button
                  size="sm"
                  disabled={mediaBusy}
                  onClick={() => onUploadMedia()}
                  className="mt-2.5"
                >
                  Upload Media
                </Button>
              </div>

              <div className="flex items-center justify-between py-1 text-[10px]">
                <span className="text-text-dim">Current source</span>
                <span className="font-medium text-text-secondary">
                  {selectedBeat ? mediaSourceLabel(selectedBeat) : "Auto / Default"}
                </span>
              </div>

              <div className="relative">
                <Button
                  variant="outline"
                  size="sm"
                  disabled={mediaBusy}
                  onClick={() => setIsAssetPickerOpen((open) => !open)}
                  className="w-full"
                >
                  <FolderOpen size={12} />
                  <span>Choose From Assets</span>
                </Button>

                {isAssetPickerOpen && (
                  <div className="absolute right-0 top-8 z-40 max-h-48 w-full overflow-y-auto rounded-md border border-border bg-surface-elevated p-1 shadow-[var(--shadow-panel)]">
                    {selectableAssets.length ? (
                      selectableAssets.map((asset) => (
                        <button
                          key={asset.id}
                          type="button"
                          onClick={() => {
                            onChooseAsset(asset.id);
                            setIsAssetPickerOpen(false);
                          }}
                          className="flex w-full items-center gap-2 rounded-sm px-2 py-1.5 text-left text-[10px] text-text-secondary transition-colors hover:bg-surface-3 hover:text-foreground"
                        >
                          {asset.type === "IMAGE" ? <FileImage size={12} /> : <Film size={12} />}
                          <span className="min-w-0 flex-1 truncate">{asset.originalFilename}</span>
                        </button>
                      ))
                    ) : (
                      <div className="p-3 text-center text-[10px] text-text-muted">Không có asset phù hợp.</div>
                    )}
                  </div>
                )}
              </div>

              {selectedBeat?.mediaSelectionActive && (
                <Button
                  variant="ghost"
                  size="sm"
                  onClick={onResetSource}
                  disabled={mediaBusy}
                  className="w-full"
                >
                  <RotateCcw size={11} />
                  Use generated source
                </Button>
              )}

              {mediaBusy && (
                <p className="border-l-2 border-border-dark bg-background px-2.5 py-1.5 text-[10px] text-text-muted" role="status">
                  Đang lưu thay đổi…
                </p>
              )}

              {visibleMediaNotice && !mediaBusy && (
                <div
                  className={`border-l-2 px-2.5 py-2 text-[10px] leading-4 ${
                    visibleMediaNotice.tone === "success"
                      ? "border-success bg-success-bg text-success"
                      : "border-danger bg-danger-bg text-danger"
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
                          className="mt-2 rounded-sm border border-current/30 px-2 py-1 text-[10px] font-semibold transition-colors hover:bg-background/30"
                        >
                          Thử lại
                        </button>
                      )}
                    </div>
                  </div>
                </div>
              )}
            </section>

            <section className="space-y-2 py-4">
              <SectionTitle>Notes</SectionTitle>
              <div className="relative">
                <Textarea
                  aria-label="Notes for this scene"
                  value={notes}
                  onChange={(event) => setNotes(event.target.value.slice(0, 500))}
                  maxLength={500}
                  placeholder="Ghi chú cho cảnh này..."
                  className="h-28 resize-none pb-7 text-[11px]"
                />
                <span className="pointer-events-none absolute bottom-2.5 right-3 text-[10px] text-text-dim">
                  {notes.length} / 500
                </span>
              </div>
            </section>

            <section className="space-y-2.5 pt-4">
              <div className="flex items-center justify-between gap-2">
                <span className="flex items-center gap-1.5 text-[11px] font-semibold text-foreground">
                  <WandSparkles size={12} className="text-primary" /> Auto Edit Decision
                </span>
                <span className="text-[9px] font-semibold uppercase tracking-[0.1em] text-text-dim">
                  {autoDecision?.source === "AI_DIRECTED" ? "AI directed" : "Rule engine"}
                </span>
              </div>
              <div className="grid grid-cols-[repeat(auto-fit,minmax(108px,1fr))] gap-x-3 gap-y-2 border-y border-border-subtle py-2.5">
                <InfoCell label="Motion" value={autoDecision?.cameraMovement || "NONE"} />
                <InfoCell label="Fit" value={autoDecision?.fitMode || selectedBeat?.fitMode || "TRIM"} />
                <InfoCell label="Trim start" value={formatTimecode(autoDecision?.trimStartMs ?? selectedBeat?.trimStartMs ?? 0)} />
                <InfoCell label="Clock" value="Narration" />
              </div>
              <p className="text-[10px] leading-4 text-text-muted">
                {autoDecision?.reason || "Narration controls beat duration and FFmpeg auto-fits the media."}
              </p>
              <Button
                variant="outline"
                size="sm"
                onClick={() => setShowAdvanced((value) => !value)}
                className="w-full"
              >
                <SlidersHorizontal size={11} />
                {showAdvanced ? "Hide manual override" : "Manual override"}
              </Button>
              {showAdvanced && (
                <div className="space-y-2 border-t border-border-subtle pt-2.5">
                  <p className="text-[10px] leading-4 text-text-dim">Ghi đè quyết định Auto Edit cho beat hiện tại.</p>
                  <div className="grid grid-cols-2 gap-1">
                    {allowedFitModes.map((mode) => (
                      <button
                        key={mode}
                        type="button"
                        disabled={mediaBusy || !selectedBeat?.mediaAssetId}
                        onClick={() => onUpdateFitMode(mode)}
                        className={`rounded-sm px-2 py-1.5 text-[10px] font-medium transition-colors disabled:opacity-40 ${
                          selectedBeat?.fitMode === mode
                            ? "bg-primary-muted text-primary"
                            : "text-text-muted hover:bg-surface-2 hover:text-foreground"
                        }`}
                      >
                        {fitModeLabel(mode)}
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
            className="space-y-2 py-1"
          >
            <SectionTitle>Audio Sync</SectionTitle>
            <p className="text-[11px] leading-5 text-text-muted">
              Timing của visual beat được căn theo master narration track. Audio controls chi tiết được quản lý ở workflow Voice và timeline.
            </p>
          </section>
        )}

        {activeTab === "effects" && (
          <section
            role="tabpanel"
            id="inspector-panel-effects"
            aria-labelledby="inspector-tab-effects"
            className="space-y-2 py-1"
          >
            <SectionTitle>Visual Effects</SectionTitle>
            <p className="text-[11px] text-text-muted">
              Current motion: <strong className="font-medium text-foreground">{selectedBeat?.cameraMovement || "Auto"}</strong>
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
      className={`relative px-3 py-2.5 text-[11px] font-medium transition-colors duration-150 ${
        active ? "text-foreground" : "text-text-muted hover:text-foreground"
      }`}
    >
      {label}
      {active && <span className="absolute inset-x-2 bottom-0 h-px bg-primary" aria-hidden="true" />}
    </button>
  );
}

function SectionTitle({ children }: Readonly<{ children: React.ReactNode }>) {
  return <h4 className="text-[11px] font-semibold text-foreground">{children}</h4>;
}

function FieldLabel({ children }: Readonly<{ children: React.ReactNode }>) {
  return <label className="mb-1.5 block text-[10px] font-medium text-text-muted">{children}</label>;
}

function InfoCell({ label, value }: Readonly<{ label: string; value: string }>) {
  return (
    <div className="min-w-0">
      <span className="block text-[9px] uppercase tracking-[0.08em] text-text-dim">{label}</span>
      <strong className="mt-0.5 block truncate text-[10px] font-medium text-text-secondary">{value}</strong>
    </div>
  );
}

function mediaSourceLabel(beat: DesktopTimelineBeat): string {
  if (!beat.mediaSelectionActive) return "Generated";
  if (beat.mediaType === "VIDEO") return "Video override";
  if (beat.mediaType === "IMAGE") return "Image override";
  return "Generated";
}

function fitModeLabel(mode: BeatMediaFitMode): string {
  switch (mode) {
    case "LOOP":
      return "Loop";
    case "FREEZE_END":
      return "Freeze";
    case "SPEED_ADJUST":
      return "Speed";
    default:
      return "Trim";
  }
}

function formatTimecode(ms: number): string {
  const totalSeconds = Math.max(0, Math.floor(ms / 1000));
  const minutes = Math.floor(totalSeconds / 60);
  const seconds = totalSeconds % 60;
  const hundredths = Math.floor((ms % 1000) / 10);
  return `${String(minutes).padStart(2, "0")}:${String(seconds).padStart(2, "0")}.${String(hundredths).padStart(2, "0")}`;
}
