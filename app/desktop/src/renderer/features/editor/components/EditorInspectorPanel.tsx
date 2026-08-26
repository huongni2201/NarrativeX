import { useState } from "react";
import {
  ChevronDown,
  ChevronUp,
  FileImage,
  Film,
  FolderOpen,
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
  onAiRefine,
}: Readonly<EditorInspectorPanelProps>) {
  const [activeTab, setActiveTab] = useState<"Beat" | "Visual" | "Audio" | "Notes">("Beat");
  const [isAssetPickerOpen, setIsAssetPickerOpen] = useState(false);
  const [aiPrompt, setAiPrompt] = useState("");
  const [promptText, setPromptText] = useState(
    selectedBeat?.visualIntent || "Giới thiệu bối cảnh và nhân vật chính.",
  );

  // Collapsible section toggles
  const [openSections, setOpenSections] = useState({
    mediaSource: true,
    fitToBeat: true,
    beatInfo: true,
    aiAssistant: true,
  });

  const toggleSection = (section: keyof typeof openSections) => {
    setOpenSections((prev) => ({ ...prev, [section]: !prev[section] }));
  };

  const handleSendAi = () => {
    if (!aiPrompt.trim()) return;
    if (onAiRefine) onAiRefine(aiPrompt);
    setAiPrompt("");
  };

  return (
    <aside className="flex h-full min-h-0 flex-col border-l border-border/60 bg-[#0b0f17] text-xs">
      {/* Inspector Header */}
      <div className="border-b border-border/50 px-3.5 py-3">
        <h3 className="text-xs font-bold text-foreground">Inspector</h3>
      </div>

      {/* Tabs */}
      <div className="flex items-center gap-1 border-b border-border/50 bg-[#090d15] p-1.5">
        {(["Beat", "Visual", "Audio", "Notes"] as const).map((tab) => {
          const isActive = activeTab === tab;
          return (
            <button
              key={tab}
              type="button"
              onClick={() => setActiveTab(tab)}
              className={`flex-1 rounded-lg py-1.5 text-center text-xs font-medium transition ${
                isActive
                  ? "border border-[#ff8a00]/50 bg-[#ff8a00]/15 font-bold text-[#ff8a00] shadow-sm"
                  : "text-muted-foreground hover:bg-[#121926] hover:text-foreground"
              }`}
            >
              {tab}
            </button>
          );
        })}
      </div>

      {/* Panel Scrollable Sections */}
      <div className="flex-1 space-y-3 overflow-y-auto p-3 scrollbar-thin scrollbar-track-transparent scrollbar-thumb-border/40">
        {selectedBeat ? (
          <>
            {/* Section 1: Media Source */}
            <div className="space-y-2 rounded-xl border border-border/50 bg-[#0d121c] p-2.5">
              <button
                type="button"
                className="flex w-full items-center justify-between text-left"
                onClick={() => toggleSection("mediaSource")}
              >
                <span className="text-[11px] font-bold text-foreground">Media Source</span>
                {openSections.mediaSource ? <ChevronUp size={13} className="text-muted-foreground" /> : <ChevronDown size={13} className="text-muted-foreground" />}
              </button>

              {openSections.mediaSource && (
                <div className="space-y-2 pt-1">
                  <div className="flex items-center justify-between text-[10px]">
                    <span className="text-muted-foreground">Current Source</span>
                    <span className="rounded bg-purple-950/80 px-2 py-0.5 font-medium text-purple-300 border border-purple-800/40">
                      {selectedBeat.mediaType === "VIDEO"
                        ? "Uploaded Video"
                        : selectedBeat.mediaType === "IMAGE"
                          ? "Uploaded Image"
                          : "AI Generated"}
                    </span>
                  </div>

                  {/* 2x2 Grid of Actions */}
                  <div className="grid grid-cols-2 gap-1.5">
                    <button
                      type="button"
                      disabled={mediaBusy}
                      className="flex h-8 items-center justify-center gap-1.5 rounded-lg border border-border/60 bg-[#121926] text-[11px] font-medium text-foreground transition hover:border-[#ff8a00]/60 hover:text-[#ff8a00]"
                    >
                      <Sparkles size={12} className="text-[#ff8a00]" />
                      <span>AI Generate</span>
                    </button>

                    <button
                      type="button"
                      disabled={mediaBusy}
                      onClick={() => onUploadMedia("IMAGE")}
                      className="flex h-8 items-center justify-center gap-1.5 rounded-lg border border-border/60 bg-[#121926] text-[11px] font-medium text-foreground transition hover:border-border hover:bg-[#162030]"
                    >
                      <Upload size={12} className="text-emerald-400" />
                      <span>Upload Image</span>
                    </button>

                    <button
                      type="button"
                      disabled={mediaBusy}
                      onClick={() => onUploadMedia("VIDEO")}
                      className="flex h-8 items-center justify-center gap-1.5 rounded-lg border border-border/60 bg-[#121926] text-[11px] font-medium text-foreground transition hover:border-border hover:bg-[#162030]"
                    >
                      <Film size={12} className="text-purple-400" />
                      <span>Upload Video</span>
                    </button>

                    <div className="relative">
                      <button
                        type="button"
                        disabled={mediaBusy}
                        onClick={() => setIsAssetPickerOpen(!isAssetPickerOpen)}
                        className="flex h-8 w-full items-center justify-center gap-1.5 rounded-lg border border-border/60 bg-[#121926] text-[11px] font-medium text-foreground transition hover:border-border hover:bg-[#162030]"
                      >
                        <FolderOpen size={12} className="text-amber-400" />
                        <span>Choose from Assets</span>
                      </button>

                      {isAssetPickerOpen && (
                        <div className="absolute right-0 top-9 z-30 max-h-48 w-60 space-y-1 overflow-y-auto rounded-lg border border-border bg-[#101724] p-1.5 shadow-2xl">
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
                                  <FileImage size={12} className="text-emerald-400" />
                                ) : (
                                  <Film size={12} className="text-purple-400" />
                                )}
                                <span className="truncate text-foreground">{asset.originalFilename}</span>
                              </button>
                            ))
                          ) : (
                            <div className="p-2 text-center text-xs text-muted-foreground">
                              Không có asset nào.
                            </div>
                          )}
                        </div>
                      )}
                    </div>
                  </div>

                  {mediaNotice && (
                    <p className="text-[10px] text-[#ff8a00]">{mediaNotice}</p>
                  )}
                </div>
              )}
            </div>

            {/* Section 2: Fit to Beat */}
            <div className="space-y-2 rounded-xl border border-border/50 bg-[#0d121c] p-2.5">
              <button
                type="button"
                className="flex w-full items-center justify-between text-left"
                onClick={() => toggleSection("fitToBeat")}
              >
                <span className="text-[11px] font-bold text-foreground">Fit to Beat</span>
                {openSections.fitToBeat ? <ChevronUp size={13} className="text-muted-foreground" /> : <ChevronDown size={13} className="text-muted-foreground" />}
              </button>

              {openSections.fitToBeat && (
                <div className="space-y-2.5 pt-1">
                  {/* Pills */}
                  <div className="grid grid-cols-4 gap-1 rounded-lg bg-[#080d15] p-1 border border-border/40 text-[11px]">
                    {(
                      [
                        { mode: "TRIM", label: "Trim" },
                        { mode: "LOOP", label: "Loop" },
                        { mode: "FREEZE_END", label: "Freeze End" },
                        { mode: "SPEED_ADJUST", label: "Speed Adjust" },
                      ] as const
                    ).map(({ mode, label }) => {
                      const isSelected = selectedBeat.fitMode === mode;
                      return (
                        <button
                          key={mode}
                          type="button"
                          onClick={() => onUpdateFitMode(mode)}
                          className={`rounded-md py-1 text-center font-medium transition ${
                            isSelected
                              ? "bg-[#ff8a00] text-black font-bold shadow-sm"
                              : "text-muted-foreground hover:text-foreground"
                          }`}
                        >
                          {label}
                        </button>
                      );
                    })}
                  </div>

                  {/* Range Slider / Trim Scrub Bar */}
                  <div className="space-y-1 pt-1">
                    <div className="relative h-2 w-full rounded-full bg-[#182232]">
                      <div className="absolute inset-y-0 left-0 right-1/4 rounded-full bg-gradient-to-r from-purple-500/60 to-purple-400" />
                      <div className="absolute top-1/2 left-3/4 h-3.5 w-3.5 -translate-x-1/2 -translate-y-1/2 rounded-full border-2 border-white bg-purple-500 shadow-md" />
                    </div>
                    <div className="flex items-center justify-between font-mono text-[9px] text-muted-foreground">
                      <span>00:00.00</span>
                      <span className="font-bold text-foreground">
                        {formatTimecode(selectedBeat.durationMs)}
                      </span>
                      <span>
                        {formatTimecode(selectedBeat.sourceDurationMs || selectedBeat.durationMs * 1.5)}
                      </span>
                    </div>
                  </div>

                  {/* Audio Sync */}
                  <div className="space-y-1">
                    <div className="flex items-center justify-between text-[11px]">
                      <span className="text-muted-foreground">Audio Sync</span>
                      <div className="flex items-center gap-1 rounded border border-border/60 bg-[#121926] px-2 py-0.5 font-medium text-foreground">
                        <span>Auto</span>
                        <ChevronDown size={11} className="text-muted-foreground" />
                      </div>
                    </div>
                    <p className="text-[9px] text-muted-foreground/70">
                      Automatically align media to narration.
                    </p>
                  </div>
                </div>
              )}
            </div>

            {/* Section 3: Beat Info */}
            <div className="space-y-2 rounded-xl border border-border/50 bg-[#0d121c] p-2.5">
              <button
                type="button"
                className="flex w-full items-center justify-between text-left"
                onClick={() => toggleSection("beatInfo")}
              >
                <span className="text-[11px] font-bold text-foreground">Beat Info</span>
                {openSections.beatInfo ? <ChevronUp size={13} className="text-muted-foreground" /> : <ChevronDown size={13} className="text-muted-foreground" />}
              </button>

              {openSections.beatInfo && (
                <div className="space-y-2 pt-1 text-xs">
                  {/* Metrics */}
                  <div className="flex items-center justify-between text-[11px]">
                    <span className="text-muted-foreground">Duration</span>
                    <span className="font-mono font-bold text-foreground">
                      {formatTimecode(selectedBeat.durationMs)}
                    </span>
                    <span className="text-muted-foreground pl-3">Beats</span>
                    <span className="font-mono font-bold text-foreground">6</span>
                  </div>

                  {/* Status */}
                  <div className="flex items-center justify-between text-[11px]">
                    <span className="text-muted-foreground">Status</span>
                    <div className="flex items-center gap-1 rounded border border-border/60 bg-[#121926] px-2 py-0.5 font-medium text-foreground">
                      <span>Draft</span>
                      <ChevronDown size={11} className="text-muted-foreground" />
                    </div>
                  </div>

                  {/* Textarea */}
                  <div className="relative">
                    <textarea
                      className="h-16 w-full resize-none rounded-lg border border-border/60 bg-[#090e16] p-2 text-xs text-foreground placeholder:text-muted-foreground/60 focus:border-[#ff8a00]/70 focus:outline-none"
                      value={promptText}
                      onChange={(e) => setPromptText(e.target.value)}
                      maxLength={500}
                    />
                    <div className="absolute bottom-1.5 right-2 text-[9px] text-muted-foreground/60">
                      {promptText.length}/500
                    </div>
                  </div>
                </div>
              )}
            </div>

            {/* Section 4: AI Assistant */}
            <div className="space-y-2 rounded-xl border border-border/50 bg-[#0d121c] p-2.5">
              <button
                type="button"
                className="flex w-full items-center justify-between text-left"
                onClick={() => toggleSection("aiAssistant")}
              >
                <div className="flex items-center gap-1.5 text-[11px] font-bold text-foreground">
                  <Sparkles size={13} className="text-[#ff8a00]" />
                  <span>AI Assistant</span>
                </div>
                {openSections.aiAssistant ? <ChevronUp size={13} className="text-muted-foreground" /> : <ChevronDown size={13} className="text-muted-foreground" />}
              </button>

              {openSections.aiAssistant && (
                <div className="space-y-2 pt-1">
                  {/* Prompt input */}
                  <div className="flex items-center gap-1.5 rounded-lg border border-border/60 bg-[#090e16] p-1">
                    <input
                      type="text"
                      className="flex-1 bg-transparent px-2 text-xs text-foreground placeholder:text-muted-foreground/60 focus:outline-none"
                      placeholder="Ask AI to refine this beat..."
                      value={aiPrompt}
                      onChange={(e) => setAiPrompt(e.target.value)}
                      onKeyDown={(e) => e.key === "Enter" && handleSendAi()}
                    />
                    <button
                      type="button"
                      onClick={handleSendAi}
                      className="flex h-6 w-6 items-center justify-center rounded bg-[#ff8a00] text-black transition hover:bg-[#ffa133]"
                      title="Send"
                      aria-label="Send"
                    >
                      <Send size={11} />
                    </button>
                  </div>

                  {/* Chips */}
                  <div className="flex flex-wrap gap-1.5">
                    {[
                      "Improve composition",
                      "Suggest mood",
                      "Expand scene",
                    ].map((chip) => (
                      <button
                        key={chip}
                        type="button"
                        onClick={() => setAiPrompt(chip)}
                        className="rounded-full border border-border/60 bg-[#121926] px-2.5 py-0.5 text-[10px] text-muted-foreground transition hover:border-[#ff8a00]/50 hover:text-[#ff8a00]"
                      >
                        {chip}
                      </button>
                    ))}
                  </div>
                </div>
              )}
            </div>
          </>
        ) : (
          <div className="p-8 text-center text-xs text-muted-foreground">
            Chưa có beat được chọn.
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
