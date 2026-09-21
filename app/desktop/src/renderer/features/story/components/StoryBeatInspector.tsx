import { useState } from "react";
import {
  BookOpen,
  Volume2,
  Film,
  Compass,
  Code2,
  CheckCircle2,
  Clock,
  User,
  MapPin,
  ExternalLink,
  Copy,
} from "lucide-react";
import type { DesktopStoryBeat, StoryBeatReviewStatus } from "@narrativex/client-contracts";

export interface StoryBeatInspectorProps {
  beat: DesktopStoryBeat | null;
  onUpdateReviewStatus?: (status: StoryBeatReviewStatus) => void;
  isUpdatingStatus?: boolean;
}

export function StoryBeatInspector({ beat, onUpdateReviewStatus, isUpdatingStatus }: StoryBeatInspectorProps) {
  const [activeTab, setActiveTab] = useState<"story" | "audio" | "visual" | "continuity" | "advanced">("story");
  const [copiedPrompt, setCopiedPrompt] = useState(false);

  if (!beat) {
    return (
      <div className="flex h-full flex-col items-center justify-center p-6 text-center text-text-muted">
        <BookOpen size={36} className="mb-2 text-text-dim" />
        <span className="text-[14px] font-medium text-text-secondary">Chưa chọn StoryBeat</span>
        <p className="mt-1 text-[12px]">Chọn một StoryBeat trong danh sách để xem và chỉnh sửa thông tin chi tiết.</p>
      </div>
    );
  }

  const isApproved = beat.reviewStatus === "APPROVED";
  const isSynthetic = beat.persistenceState === "SYNTHETIC";

  return (
    <div className="flex h-full w-full flex-col overflow-hidden bg-surface-dark border-l border-border-subtle">
      {/* Inspector Header */}
      <div className="flex shrink-0 flex-col gap-2 border-b border-border-subtle p-3.5 bg-surface-panel">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-2">
            <span className="font-mono text-[12px] font-bold text-primary">#{beat.orderIndex + 1}</span>
            <span className="text-[14px] font-semibold text-foreground truncate max-w-[180px]">
              {beat.title || `Beat #${beat.orderIndex + 1}`}
            </span>
          </div>

          {/* Quick Review Status Actions */}
          <div className="flex items-center gap-1.5">
            {isSynthetic && (
              <span
                className="rounded bg-surface-3 px-2 py-0.5 text-[11px] font-medium text-text-muted border border-border-subtle"
                title="Beat này được tạo tạm từ dữ liệu legacy và chưa có entity StoryBeat trong database."
              >
                Legacy / Read-only
              </span>
            )}
            <button
              type="button"
              disabled={isUpdatingStatus || isSynthetic}
              onClick={() => {
                if (isSynthetic) return;
                onUpdateReviewStatus?.(isApproved ? "NEEDS_REVIEW" : "APPROVED");
              }}
              className={`inline-flex items-center gap-1.5 rounded-md px-2.5 py-1 text-[11px] font-semibold transition-all focus-visible:ring-1 focus-visible:ring-primary ${
                isApproved
                  ? "bg-success text-white shadow-sm hover:brightness-110"
                  : "bg-surface-3 text-text-secondary hover:text-foreground hover:bg-surface-2 border border-border-subtle"
              } disabled:opacity-50`}
              title={
                isSynthetic
                  ? "Beat này được tạo tạm từ dữ liệu legacy và chưa có entity StoryBeat trong database."
                  : isApproved
                  ? "Bấm để đổi thành Cần duyệt"
                  : "Bấm để đánh dấu Đã duyệt"
              }
            >
              <CheckCircle2 size={12} />
              <span>{isApproved ? "Đã duyệt" : "Duyệt Beat"}</span>
            </button>
          </div>
        </div>

        {/* Inspector 5 Tabs */}
        <div
          role="tablist"
          aria-label="StoryBeat inspector sections"
          className="flex items-center gap-1 rounded-lg bg-surface-dark p-1 text-[12px]"
        >
          {(["story", "audio", "visual", "continuity", "advanced"] as const).map((tab) => {
            const isActive = activeTab === tab;
            return (
              <button
                key={tab}
                type="button"
                role="tab"
                id={`inspector-tab-${tab}`}
                aria-selected={isActive}
                aria-controls={`inspector-panel-${tab}`}
                onClick={() => setActiveTab(tab)}
                className={`flex-1 rounded py-1 font-medium transition-all text-center capitalize focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-primary ${
                  isActive ? "bg-primary-muted text-primary shadow-sm" : "text-text-muted hover:text-foreground"
                }`}
              >
                {tab}
              </button>
            );
          })}
        </div>
      </div>

      {/* Tab Contents */}
      <div className="min-h-0 flex-1 overflow-y-auto p-4 space-y-4 text-[13px]">
        {/* STORY TAB */}
        {activeTab === "story" && (
          <div className="space-y-4">
            <div>
              <label className="block text-[11px] font-medium text-text-muted uppercase tracking-wider mb-1">
                Tóm tắt ngữ nghĩa (Dramatic Summary)
              </label>
              <div className="rounded-md border border-border-subtle bg-surface p-3 text-text-primary leading-relaxed">
                {beat.summary || "Chưa có nội dung tóm tắt ngữ nghĩa."}
              </div>
            </div>

            <div className="grid grid-cols-2 gap-3">
              <div>
                <span className="block text-[11px] font-medium text-text-muted uppercase tracking-wider mb-1">Mục đích (Purpose)</span>
                <span className="rounded bg-surface px-2.5 py-1 font-mono text-[12px] text-foreground inline-block border border-border-subtle">
                  {beat.purpose || "PLOT"}
                </span>
              </div>

              <div>
                <span className="block text-[11px] font-medium text-text-muted uppercase tracking-wider mb-1">Mức độ quan trọng</span>
                <span className="rounded bg-surface px-2.5 py-1 font-mono text-[12px] text-foreground inline-block border border-border-subtle">
                  {beat.importance || "NORMAL"}
                </span>
              </div>
            </div>

            {beat.timing.durationMs !== null && (
              <div>
                <span className="block text-[11px] font-medium text-text-muted uppercase tracking-wider mb-1">Thời lượng đồng bộ (Narration Clock)</span>
                <div className="flex items-center gap-2 rounded bg-surface p-2.5 border border-border-subtle">
                  <Clock size={14} className="text-cyan" />
                  <span className="font-mono text-[13px] text-foreground">
                    {(beat.timing.durationMs / 1000).toFixed(2)} giây
                  </span>
                  {beat.timing.startMs !== null && (
                    <span className="text-[11px] text-text-muted">
                      ({(beat.timing.startMs / 1000).toFixed(1)}s - {(beat.timing.endMs! / 1000).toFixed(1)}s)
                    </span>
                  )}
                </div>
              </div>
            )}
          </div>
        )}

        {/* AUDIO TAB */}
        {activeTab === "audio" && (
          <div className="space-y-3">
            <div className="flex items-center justify-between">
              <span className="text-[12px] font-semibold text-text-secondary uppercase tracking-wider">
                Audio Cues ({beat.audioCues.length})
              </span>
            </div>

            {beat.audioCues.length === 0 ? (
              <p className="text-[12px] text-text-muted italic">Không có Audio Cue trong beat này.</p>
            ) : (
              beat.audioCues.map((cue, idx) => (
                <div key={cue.id || idx} className="rounded-lg border border-border-subtle bg-surface p-3 space-y-2">
                  <div className="flex items-center justify-between">
                    <div className="flex items-center gap-1.5">
                      <Volume2 size={13} className="text-info" />
                      <span className="text-[12px] font-bold text-foreground">{cue.cueType}</span>
                      {cue.speakerName && (
                        <span className="rounded bg-surface-3 px-1.5 py-0.5 text-[11px] text-text-secondary">
                          {cue.speakerName}
                        </span>
                      )}
                    </div>
                    <span className="text-[10px] font-mono text-text-muted uppercase">
                      {cue.adaptationAction}
                    </span>
                  </div>

                  <p className="rounded bg-surface-dark p-2.5 text-[13px] text-foreground italic border border-border-subtle/40">
                    &ldquo;{cue.adaptedText || "—"}&rdquo;
                  </p>

                  {cue.deliveryHint && (
                    <div className="text-[11px] text-text-secondary">
                      <span className="text-text-muted">Chỉ đạo diễn xuất: </span>
                      {cue.deliveryHint}
                    </div>
                  )}

                  {typeof cue.audioStartMs === "number" && typeof cue.audioEndMs === "number" && (
                    <div className="flex items-center gap-1 text-[11px] font-mono text-cyan pt-1">
                      <Clock size={11} />
                      <span>
                        {(cue.audioStartMs / 1000).toFixed(2)}s - {(cue.audioEndMs / 1000).toFixed(2)}s
                      </span>
                    </div>
                  )}
                </div>
              ))
            )}
          </div>
        )}

        {/* VISUAL / SHOT TAB */}
        {activeTab === "visual" && (
          <div className="space-y-3">
            <div className="flex items-center justify-between">
              <span className="text-[12px] font-semibold text-text-secondary uppercase tracking-wider">
                Video Shot Plan ({beat.visualBeats.length})
              </span>
            </div>

            {beat.visualBeats.length === 0 ? (
              <p className="text-[12px] text-text-muted italic">Không có Shot nào trong StoryBeat này.</p>
            ) : (
              beat.visualBeats.map((vBeat, idx) => (
                <div key={vBeat.id || idx} className="rounded-lg border border-border-subtle bg-surface p-3 space-y-2">
                  <div className="flex items-center justify-between">
                    <div className="flex items-center gap-1.5">
                      <Film size={13} className="text-primary" />
                      <span className="text-[13px] font-medium text-foreground">
                        {vBeat.title || `Shot #${idx + 1}`}
                      </span>
                    </div>
                    <div className="flex items-center gap-1">
                      {vBeat.dramaticIntent && (
                        <span className="rounded bg-surface-3 px-1.5 py-0.5 font-mono text-[9px] text-text-secondary">
                          {vBeat.dramaticIntent}
                        </span>
                      )}
                      {vBeat.retentionRole && (
                        <span className="rounded bg-cyan-soft text-cyan border border-cyan/30 px-1.5 py-0.5 font-mono text-[9px]">
                          {vBeat.retentionRole}
                        </span>
                      )}
                    </div>
                  </div>

                  <div className="rounded bg-surface-dark p-2.5 text-[12px] text-text-secondary border border-border-subtle/40">
                    <p>{vBeat.visualIntent || vBeat.visualSummary || "Chưa có chỉ đạo cinematic shot."}</p>
                  </div>

                  <div className="flex items-center justify-between text-[11px] text-text-muted">
                    <span>Trọng số thời lượng: {vBeat.relativeWeight}x</span>
                    <span>Motion: {vBeat.motionMode || "DYNAMIC"}</span>
                  </div>
                </div>
              ))
            )}
          </div>
        )}

        {/* CONTINUITY TAB */}
        {activeTab === "continuity" && (
          <div className="space-y-3">
            <div>
              <span className="block text-[11px] font-medium text-text-muted uppercase tracking-wider mb-1">
                Nhân vật tham gia trong Beat
              </span>
              <div className="rounded-lg border border-border-subtle bg-surface p-3">
                <div className="flex items-center gap-2 text-[13px] text-foreground">
                  <User size={14} className="text-primary" />
                  <span>Dựa trên kết quả Story Director</span>
                </div>
              </div>
            </div>

            <div>
              <span className="block text-[11px] font-medium text-text-muted uppercase tracking-wider mb-1">
                Trạng thái liên tục (Continuity Facts)
              </span>
              <div className="rounded-lg border border-border-subtle bg-surface p-3 font-mono text-[11px] text-text-secondary">
                {beat.continuityStateJson && beat.continuityStateJson !== "{}" ? (
                  <pre className="whitespace-pre-wrap">{beat.continuityStateJson}</pre>
                ) : (
                  <span className="text-text-muted italic">Không có ràng buộc dị biệt.</span>
                )}
              </div>
            </div>
          </div>
        )}

        {/* ADVANCED TAB */}
        {activeTab === "advanced" && (
          <div className="space-y-3 font-mono text-[11px]">
            <div>
              <span className="block text-text-muted uppercase tracking-wider mb-1">StoryBeat ID</span>
              <div className="rounded bg-surface-dark p-2 text-foreground truncate border border-border-subtle">
                {beat.id}
              </div>
            </div>

            <div>
              <span className="block text-text-muted uppercase tracking-wider mb-1">Scene ID</span>
              <div className="rounded bg-surface-dark p-2 text-foreground truncate border border-border-subtle">
                {beat.sceneId}
              </div>
            </div>

            <div className="grid grid-cols-2 gap-2">
              <div>
                <span className="block text-text-muted uppercase tracking-wider mb-1">Source UTF-16</span>
                <div className="rounded bg-surface-dark p-2 text-foreground border border-border-subtle">
                  [{beat.sourceStart ?? "null"}, {beat.sourceEnd ?? "null"}]
                </div>
              </div>

              <div>
                <span className="block text-text-muted uppercase tracking-wider mb-1">Row Version</span>
                <div className="rounded bg-surface-dark p-2 text-foreground border border-border-subtle">
                  {beat.rowVersion}
                </div>
              </div>
            </div>

            {beat.visualBeats[0]?.prompt && (
              <div className="space-y-1.5">
                <div className="flex items-center justify-between">
                  <span className="block text-text-muted uppercase tracking-wider">Compiled Prompt Snapshot</span>
                  <button
                    type="button"
                    onClick={async () => {
                      if (beat.visualBeats[0]?.prompt) {
                        await window.narrativex.system.copyText(beat.visualBeats[0].prompt);
                        setCopiedPrompt(true);
                        setTimeout(() => setCopiedPrompt(false), 2000);
                      }
                    }}
                    className="inline-flex items-center gap-1 rounded bg-surface-3 px-2 py-0.5 text-[10px] text-text-secondary hover:text-foreground hover:bg-surface-2 transition-colors border border-border-subtle"
                    title="Sao chép prompt vào clipboard"
                  >
                    <Copy size={11} />
                    <span>{copiedPrompt ? "Đã copy!" : "Copy Prompt"}</span>
                  </button>
                </div>
                <div className="rounded bg-surface-dark p-2 text-text-secondary max-h-32 overflow-y-auto whitespace-pre-wrap border border-border-subtle">
                  {beat.visualBeats[0].prompt}
                </div>
              </div>
            )}
          </div>
        )}
      </div>
    </div>
  );
}
