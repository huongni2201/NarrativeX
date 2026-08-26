import { useEffect, useState } from "react";
import {
  ChevronDown,
  ChevronUp,
  FileImage,
  Film,
  FolderOpen,
  RotateCcw,
  Upload,
} from "lucide-react";
import type {
  BeatMediaFitMode,
  DesktopAsset,
  DesktopTimelineBeat,
} from "@narrativex/client-contracts";

interface EditorInspectorPanelProps {
  selectedBeat: DesktopTimelineBeat | null;
  selectableAssets: DesktopAsset[];
  mediaBusy: boolean;
  mediaNotice: string | null;
  onUploadMedia: (type: "IMAGE" | "VIDEO") => void;
  onChooseAsset: (assetId: string) => void;
  onUpdateFitMode: (fitMode: BeatMediaFitMode) => void;
  onResetSource: () => void;
}

type SectionId = "mediaSource" | "fitToBeat" | "beatInfo";

export function EditorInspectorPanel({
  selectedBeat,
  selectableAssets,
  mediaBusy,
  mediaNotice,
  onUploadMedia,
  onChooseAsset,
  onUpdateFitMode,
  onResetSource,
}: Readonly<EditorInspectorPanelProps>) {
  const [isAssetPickerOpen, setIsAssetPickerOpen] = useState(false);
  const [openSections, setOpenSections] = useState<Record<SectionId, boolean>>({
    mediaSource: true,
    fitToBeat: true,
    beatInfo: true,
  });

  useEffect(() => {
    setIsAssetPickerOpen(false);
  }, [selectedBeat]);

  const toggleSection = (section: SectionId) => {
    setOpenSections((previous) => ({ ...previous, [section]: !previous[section] }));
  };

  return (
    <aside className="flex h-full min-h-0 flex-col bg-surface-panel text-[10px]">
      <div className="nx-panel-header flex items-center px-3">
        <h3 className="text-[11px] font-bold text-foreground">Inspector</h3>
      </div>

      <div className="min-h-0 flex-1 space-y-2 overflow-y-auto p-2.5">
        {selectedBeat ? (
          <>
            <InspectorSection
              title="Media Source"
              open={openSections.mediaSource}
              onToggle={() => toggleSection("mediaSource")}
            >
              <div className="flex items-center justify-between gap-2">
                <span className="text-text-muted">Current source</span>
                <span className="rounded-sm border border-border bg-surface-2 px-1.5 py-0.5 text-[8px] font-medium text-text-secondary">
                  {mediaSourceLabel(selectedBeat)}
                </span>
              </div>

              <div className="grid grid-cols-2 gap-1.5">
                <ActionButton
                  icon={<Upload size={11} />}
                  label="Upload Image"
                  disabled={mediaBusy}
                  onClick={() => onUploadMedia("IMAGE")}
                />
                <ActionButton
                  icon={<Film size={11} />}
                  label="Upload Video"
                  disabled={mediaBusy}
                  onClick={() => onUploadMedia("VIDEO")}
                />

                <div className="relative col-span-2">
                  <ActionButton
                    icon={<FolderOpen size={11} />}
                    label="Choose From Assets"
                    disabled={mediaBusy}
                    onClick={() => setIsAssetPickerOpen((open) => !open)}
                  />
                  {isAssetPickerOpen && (
                    <div className="absolute right-0 top-8 z-40 max-h-48 w-64 overflow-y-auto rounded-md border border-border bg-surface-elevated p-1 shadow-[var(--shadow-panel)]">
                      {selectableAssets.length ? (
                        selectableAssets.map((asset) => (
                          <button
                            key={asset.id}
                            type="button"
                            onClick={() => {
                              onChooseAsset(asset.id);
                              setIsAssetPickerOpen(false);
                            }}
                            className="flex w-full items-center gap-2 rounded-sm px-2 py-1.5 text-left transition hover:bg-surface-3"
                          >
                            {asset.type === "IMAGE" ? <FileImage size={11} /> : <Film size={11} />}
                            <span className="min-w-0 flex-1 truncate text-[9px] text-text-secondary">
                              {asset.originalFilename}
                            </span>
                          </button>
                        ))
                      ) : (
                        <div className="p-2 text-center text-[9px] text-text-muted">Không có asset phù hợp.</div>
                      )}
                    </div>
                  )}
                </div>
              </div>

              {selectedBeat.mediaAssetId && (
                <button
                  type="button"
                  onClick={onResetSource}
                  disabled={mediaBusy}
                  className="flex h-7 w-full items-center justify-center gap-1.5 rounded-sm border border-border bg-surface-input text-[9px] text-text-muted transition hover:border-border-dark hover:bg-surface-2 hover:text-foreground disabled:opacity-50"
                >
                  <RotateCcw size={10} />
                  Reset to generated source
                </button>
              )}

              {mediaNotice && (
                <p className="rounded-sm border border-primary/25 bg-primary-muted px-2 py-1.5 text-[9px] leading-4 text-primary-hover" role="status">
                  {mediaNotice}
                </p>
              )}
            </InspectorSection>

            <InspectorSection
              title="Fit to Beat"
              open={openSections.fitToBeat}
              onToggle={() => toggleSection("fitToBeat")}
            >
              <div className="grid grid-cols-4 gap-1 rounded-sm border border-border-subtle bg-background p-1">
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
                    className={`rounded-sm py-1 text-[8px] font-medium transition-colors disabled:opacity-40 ${
                      selectedBeat.fitMode === mode
                        ? "bg-primary text-primary-foreground"
                        : "text-text-muted hover:bg-surface-2 hover:text-foreground"
                    }`}
                  >
                    {label}
                  </button>
                ))}
              </div>

              <div className="space-y-1.5">
                <div className="h-1.5 overflow-hidden rounded-full bg-surface-4">
                  <div className="h-full w-3/4 rounded-full bg-primary" />
                </div>
                <div className="flex justify-between font-mono text-[8px] text-text-dim">
                  <span>00:00.00</span>
                  <span className="text-text-secondary">{formatTimecode(selectedBeat.durationMs)}</span>
                  <span>{formatTimecode(selectedBeat.sourceDurationMs || selectedBeat.durationMs)}</span>
                </div>
              </div>

              <div className="flex items-center justify-between gap-2 rounded-sm border border-border-subtle bg-background px-2 py-1.5">
                <div>
                  <span className="block text-[9px] text-text-secondary">Audio Sync</span>
                  <span className="text-[8px] text-text-dim">Narration controls the beat clock</span>
                </div>
                <span className="rounded-sm border border-border bg-surface-2 px-2 py-1 text-[8px] font-medium text-text-secondary">
                  Narration master
                </span>
              </div>
            </InspectorSection>

            <InspectorSection
              title="Beat Info"
              open={openSections.beatInfo}
              onToggle={() => toggleSection("beatInfo")}
            >
              <div className="grid grid-cols-2 gap-1.5">
                <InfoCell label="Duration" value={formatTimecode(selectedBeat.durationMs)} />
                <InfoCell label="Status" value={selectedBeat.assetReady ? "Ready" : "Draft"} />
                <InfoCell label="Media" value={selectedBeat.mediaType || "Generated"} />
                <InfoCell label="Camera" value={selectedBeat.cameraMovement || "Default"} />
              </div>

              <div className="grid gap-1">
                <span className="text-[8px] font-medium uppercase tracking-wider text-text-dim">Visual intent</span>
                <p className="min-h-16 rounded-sm border border-border bg-surface-input p-2 text-[9px] leading-4 text-text-secondary">
                  {selectedBeat.visualIntent || "Chưa có mô tả visual beat."}
                </p>
              </div>
            </InspectorSection>
          </>
        ) : (
          <div className="grid min-h-40 place-items-center rounded-md border border-dashed border-border p-4 text-center text-[9px] leading-4 text-text-muted">
            Chọn một visual beat để chỉnh media và xem thông tin timing.
          </div>
        )}
      </div>
    </aside>
  );
}

function InspectorSection({
  title,
  open,
  onToggle,
  children,
}: Readonly<{
  title: string;
  open: boolean;
  onToggle: () => void;
  children: React.ReactNode;
}>) {
  return (
    <section className="rounded-md border border-border-subtle bg-surface">
      <button
        type="button"
        onClick={onToggle}
        className="flex h-8 w-full items-center justify-between gap-2 px-2.5 text-left"
      >
        <span className="flex items-center gap-1.5 text-[9px] font-semibold text-text-secondary">
          {title}
        </span>
        {open ? <ChevronUp size={10} className="text-text-dim" /> : <ChevronDown size={10} className="text-text-dim" />}
      </button>
      {open && <div className="space-y-2 border-t border-border-subtle p-2.5">{children}</div>}
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
      className="flex h-7 w-full items-center justify-center gap-1.5 rounded-sm border border-border bg-surface-input text-[8px] font-medium text-text-secondary transition-colors hover:border-border-dark hover:bg-surface-2 disabled:opacity-45"
    >
      {icon}
      <span className="truncate">{label}</span>
    </button>
  );
}

function InfoCell({ label, value }: Readonly<{ label: string; value: string }>) {
  return (
    <div className="min-w-0 rounded-sm border border-border-subtle bg-background px-2 py-1.5">
      <span className="block text-[7px] uppercase tracking-wider text-text-dim">{label}</span>
      <strong className="mt-0.5 block truncate text-[8px] font-medium text-text-secondary">{value}</strong>
    </div>
  );
}

function mediaSourceLabel(beat: DesktopTimelineBeat): string {
  if (beat.mediaType === "VIDEO") return "Uploaded Video";
  if (beat.mediaType === "IMAGE") return "Uploaded Image";
  return "AI Generated";
}

function formatTimecode(ms: number): string {
  const totalSeconds = Math.max(0, Math.floor(ms / 1000));
  const minutes = Math.floor(totalSeconds / 60);
  const seconds = totalSeconds % 60;
  const hundredths = Math.floor((ms % 1000) / 10);
  return `${String(minutes).padStart(2, "0")}:${String(seconds).padStart(2, "0")}.${String(hundredths).padStart(2, "0")}`;
}
