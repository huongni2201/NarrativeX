import { useState } from "react";
import {
  ChevronDown,
  FileImage,
  Film,
  FolderOpen,
  RotateCcw,
  Send,
  Sparkles,
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
  onAiRefine?: (instruction: string) => void;
}

export function EditorInspectorPanel({
  selectedBeat,
  selectableAssets,
  mediaBusy,
  mediaNotice,
  onUploadMedia,
  onChooseAsset,
  onUpdateFitMode,
  onResetSource,
  onAiRefine,
}: Readonly<EditorInspectorPanelProps>) {
  const [activeTab, setActiveTab] = useState<"Beat" | "Visual" | "Audio" | "Notes">("Beat");
  const [isAssetPickerOpen, setIsAssetPickerOpen] = useState(false);
  const [aiPrompt, setAiPrompt] = useState("");
  const [promptText, setPromptText] = useState(
    selectedBeat?.visualIntent || "Cuộc đối đầu bất ngờ xảy ra khi bí mật bị lộ diện.",
  );

  const handleSendAi = () => {
    if (!aiPrompt.trim()) return;
    if (onAiRefine) onAiRefine(aiPrompt);
    setAiPrompt("");
  };

  const handleChipClick = (suggestion: string) => {
    setAiPrompt(suggestion);
  };

  return (
    <aside className="flex h-full min-h-0 flex-col border-l border-border/70 bg-[#0c1017] text-xs">
      {/* Top Tabs */}
      <div className="flex items-center border-b border-border/60 bg-[#0e141f]/70 px-2">
        {(["Beat", "Visual", "Audio", "Notes"] as const).map((tab) => (
          <button
            key={tab}
            type="button"
            onClick={() => setActiveTab(tab)}
            className={`relative flex-1 py-3 text-center text-xs font-medium transition ${
              activeTab === tab
                ? "font-semibold text-foreground after:absolute after:bottom-0 after:left-2 after:right-2 after:h-0.5 after:bg-[#ff8a00]"
                : "text-muted-foreground hover:text-foreground"
            }`}
          >
            {tab}
          </button>
        ))}
      </div>

      {/* Panel Scrollable Content */}
      <div className="flex-1 space-y-4 overflow-y-auto p-3.5 scrollbar-thin scrollbar-track-transparent scrollbar-thumb-border/40">
        {selectedBeat ? (
          <>
            {/* Section 1: MEDIA SOURCE */}
            <div className="space-y-2.5 rounded-xl border border-border/60 bg-[#101622]/80 p-3">
              <div className="flex items-center justify-between text-[11px]">
                <span className="font-bold uppercase tracking-wider text-muted-foreground text-[10px]">
                  MEDIA SOURCE
                </span>
                <span className="rounded-md border border-border/60 bg-[#151e2c] px-2 py-0.5 font-medium text-foreground">
                  {selectedBeat.mediaType === "VIDEO"
                    ? "Uploaded Video"
                    : selectedBeat.mediaType === "IMAGE"
                      ? "Uploaded Image"
                      : "AI Generated"}
                </span>
              </div>

              {/* 2x2 Grid of Actions */}
              <div className="grid grid-cols-2 gap-2 pt-1">
                {/* AI Generate Button */}
                <button
                  type="button"
                  disabled={mediaBusy}
                  className="flex h-9 items-center justify-center gap-1.5 rounded-lg border border-border/70 bg-[#141d2a] px-2 text-xs font-semibold text-foreground transition hover:border-[#ff8a00]/60 hover:bg-[#1a2536] hover:text-[#ff8a00] disabled:opacity-50"
                >
                  <Sparkles size={13} className="text-[#ff8a00]" />
                  <span>AI Generate</span>
                </button>

                {/* Upload Image Button */}
                <button
                  type="button"
                  disabled={mediaBusy}
                  onClick={() => onUploadMedia("IMAGE")}
                  className="flex h-9 items-center justify-center gap-1.5 rounded-lg border border-border/70 bg-[#141d2a] px-2 text-xs font-semibold text-foreground transition hover:border-border hover:bg-[#1a2536] disabled:opacity-50"
                >
                  <Upload size={13} className="text-emerald-400" />
                  <span>Upload Image</span>
                </button>

                {/* Upload Video Button */}
                <button
                  type="button"
                  disabled={mediaBusy}
                  onClick={() => onUploadMedia("VIDEO")}
                  className="flex h-9 items-center justify-center gap-1.5 rounded-lg border border-border/70 bg-[#141d2a] px-2 text-xs font-semibold text-foreground transition hover:border-border hover:bg-[#1a2536] disabled:opacity-50"
                >
                  <Film size={13} className="text-sky-400" />
                  <span>Upload Video</span>
                </button>

                {/* Choose Assets Button */}
                <div className="relative">
                  <button
                    type="button"
                    disabled={mediaBusy}
                    onClick={() => setIsAssetPickerOpen(!isAssetPickerOpen)}
                    className="flex h-9 w-full items-center justify-center gap-1.5 rounded-lg border border-border/70 bg-[#141d2a] px-2 text-xs font-semibold text-foreground transition hover:border-border hover:bg-[#1a2536] disabled:opacity-50"
                  >
                    <FolderOpen size={13} className="text-amber-400" />
                    <span>Choose Assets</span>
                  </button>

                  {/* Dropdown for assets */}
                  {isAssetPickerOpen && (
                    <div className="absolute right-0 top-10 z-30 max-h-48 w-64 space-y-1 overflow-y-auto rounded-lg border border-border bg-[#101724] p-1.5 shadow-2xl">
                      {selectableAssets.length ? (
                        selectableAssets.map((asset) => (
                          <button
                            key={asset.id}
                            type="button"
                            onClick={() => {
                              onChooseAsset(asset.id);
                              setIsAssetPickerOpen(false);
                            }}
                            className="flex w-full items-center gap-2 rounded-md px-2 py-1.5 text-left text-xs transition hover:bg-[#182335]"
                          >
                            {asset.type === "IMAGE" ? (
                              <FileImage size={13} className="text-emerald-400" />
                            ) : (
                              <Film size={13} className="text-sky-400" />
                            )}
                            <span className="truncate text-foreground">{asset.originalFilename}</span>
                          </button>
                        ))
                      ) : (
                        <div className="p-2 text-center text-xs text-muted-foreground">
                          Không có asset nào sẵn sàng.
                        </div>
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
                  className="flex w-full items-center justify-center gap-1.5 pt-1 text-[11px] text-muted-foreground transition hover:text-[#ff8a00]"
                >
                  <RotateCcw size={12} />
                  <span>Use generated source</span>
                </button>
              )}

              {mediaNotice && (
                <p className="text-[10px] text-[#ff8a00]">{mediaNotice}</p>
              )}
            </div>

            {/* Section 2: FIT TO BEAT */}
            <div className="space-y-3 rounded-xl border border-border/60 bg-[#101622]/80 p-3">
              <div className="flex items-center justify-between">
                <span className="font-bold uppercase tracking-wider text-muted-foreground text-[10px]">
                  FIT TO BEAT
                </span>
                <ChevronDown size={14} className="text-muted-foreground" />
              </div>

              {/* Mode Pills */}
              <div className="grid grid-cols-4 gap-1 rounded-lg bg-[#0a0f17] p-1 border border-border/50">
                {(
                  [
                    { mode: "TRIM", label: "Trim" },
                    { mode: "LOOP", label: "Loop" },
                    { mode: "FREEZE_END", label: "Freeze" },
                    { mode: "SPEED_ADJUST", label: "Speed" },
                  ] as const
                ).map(({ mode, label }) => {
                  const isSelected = selectedBeat.fitMode === mode;
                  return (
                    <button
                      key={mode}
                      type="button"
                      onClick={() => onUpdateFitMode(mode)}
                      className={`rounded-md py-1 text-center text-xs font-semibold transition ${
                        isSelected
                          ? "bg-[#ff8a00] text-black shadow-md"
                          : "text-muted-foreground hover:text-foreground"
                      }`}
                    >
                      {label}
                    </button>
                  );
                })}
              </div>

              {/* Range Slider / Trim Scrub Bar */}
              <div className="space-y-1.5 pt-1">
                <div className="relative h-2 w-full rounded-full bg-[#182232]">
                  <div className="absolute inset-y-0 left-0 right-1/4 rounded-full bg-gradient-to-r from-[#ff8a00]/40 to-[#ff8a00]" />
                  <div className="absolute top-1/2 left-3/4 h-3.5 w-3.5 -translate-x-1/2 -translate-y-1/2 rounded-full border-2 border-white bg-[#ff8a00] shadow-md" />
                </div>
                <div className="flex items-center justify-between font-mono text-[10px] text-muted-foreground">
                  <span>00:00.00</span>
                  <span className="font-bold text-[#ff8a00]">
                    {formatTimecode(selectedBeat.durationMs)}
                  </span>
                  <span>
                    {formatTimecode(selectedBeat.sourceDurationMs || selectedBeat.durationMs * 1.5)}
                  </span>
                </div>
              </div>

              {/* Audio Sync dropdown */}
              <div className="flex items-center justify-between pt-1 text-xs">
                <span className="text-muted-foreground">Audio Sync</span>
                <div className="flex items-center gap-1 rounded-md border border-border/70 bg-[#121927] px-2 py-1 font-medium text-foreground">
                  <span>Auto</span>
                  <ChevronDown size={12} className="text-muted-foreground" />
                </div>
              </div>
            </div>

            {/* Section 3: BEAT INFO */}
            <div className="space-y-3 rounded-xl border border-border/60 bg-[#101622]/80 p-3">
              <div className="flex items-center justify-between">
                <span className="font-bold uppercase tracking-wider text-muted-foreground text-[10px]">
                  BEAT INFO
                </span>
                <ChevronDown size={14} className="text-muted-foreground" />
              </div>

              {/* Metrics */}
              <div className="grid grid-cols-2 gap-3 text-xs">
                <div>
                  <span className="text-muted-foreground text-[11px]">Duration</span>
                  <div className="font-mono text-sm font-bold text-foreground">
                    {formatTimecode(selectedBeat.durationMs)}
                  </div>
                </div>
                <div>
                  <span className="text-muted-foreground text-[11px]">Beats</span>
                  <div className="font-mono text-sm font-bold text-foreground">
                    {selectedBeat.beatIndex + 1}
                  </div>
                </div>
              </div>

              {/* Status Row */}
              <div className="flex items-center justify-between text-xs">
                <span className="text-muted-foreground">Status</span>
                <div className="flex items-center gap-1 rounded-md border border-border/70 bg-[#121927] px-2 py-1 font-medium text-foreground">
                  <span>{selectedBeat.assetReady ? "Ready" : "Draft"}</span>
                  <ChevronDown size={12} className="text-muted-foreground" />
                </div>
              </div>

              {/* Narrative Prompt Textarea */}
              <div className="relative">
                <textarea
                  className="h-20 w-full resize-none rounded-lg border border-border/70 bg-[#0d131f] p-2.5 text-xs text-foreground placeholder:text-muted-foreground/60 focus:border-[#ff8a00]/70 focus:outline-none focus:ring-1 focus:ring-[#ff8a00]/40"
                  value={promptText}
                  onChange={(e) => setPromptText(e.target.value)}
                  maxLength={500}
                  placeholder="Nhập nội dung lời thoại hoặc ý đồ hình ảnh..."
                />
                <div className="absolute bottom-2 right-2 text-[10px] text-muted-foreground/70">
                  {promptText.length}/500
                </div>
              </div>
            </div>

            {/* Section 4: AI ASSISTANT */}
            <div className="space-y-3 rounded-xl border border-[#ff8a00]/30 bg-gradient-to-b from-[#181a24] to-[#10141f] p-3 shadow-lg">
              <div className="flex items-center justify-between text-xs">
                <div className="flex items-center gap-1.5 font-bold uppercase tracking-wider text-[#ff8a00] text-[11px]">
                  <Sparkles size={14} />
                  <span>AI ASSISTANT</span>
                </div>
                <ChevronDown size={14} className="text-muted-foreground" />
              </div>

              {/* Prompt Input with Send Button */}
              <div className="flex items-center gap-1.5 rounded-lg border border-border/70 bg-[#0d131f] p-1">
                <input
                  type="text"
                  className="flex-1 bg-transparent px-2 text-xs text-foreground placeholder:text-muted-foreground/70 focus:outline-none"
                  placeholder="Ask AI to refine this beat..."
                  value={aiPrompt}
                  onChange={(e) => setAiPrompt(e.target.value)}
                  onKeyDown={(e) => e.key === "Enter" && handleSendAi()}
                />
                <button
                  type="button"
                  onClick={handleSendAi}
                  className="flex h-7 w-7 items-center justify-center rounded-md bg-[#ff8a00] text-black shadow-md transition hover:bg-[#ffa133]"
                  title="Gửi yêu cầu tới AI"
                  aria-label="Send"
                >
                  <Send size={12} className="ml-0.5" />
                </button>
              </div>

              {/* Suggestion Chips */}
              <div className="flex flex-wrap gap-1.5">
                {[
                  "Improve composition",
                  "Suggest mood",
                  "Expand scene",
                ].map((chip) => (
                  <button
                    key={chip}
                    type="button"
                    onClick={() => handleChipClick(chip)}
                    className="rounded-full border border-border/70 bg-[#121927] px-2.5 py-1 text-[10px] text-muted-foreground transition hover:border-[#ff8a00]/50 hover:bg-[#1a2436] hover:text-[#ff8a00]"
                  >
                    {chip}
                  </button>
                ))}
              </div>
            </div>
          </>
        ) : (
          <div className="p-8 text-center text-xs text-muted-foreground">
            Chưa có visual beat nào được chọn.
          </div>
        )}
      </div>
    </aside>
  );
}

function formatTimecode(ms: number): string {
  const totalSecs = Math.max(0, Math.floor(ms / 1000));
  const mins = Math.floor(totalSecs / 60);
  const secs = totalSecs % 60;
  const hundredths = Math.floor((ms % 1000) / 10);
  return `${String(mins).padStart(2, "0")}:${String(secs).padStart(2, "0")}.${String(hundredths).padStart(2, "0")}`;
}

