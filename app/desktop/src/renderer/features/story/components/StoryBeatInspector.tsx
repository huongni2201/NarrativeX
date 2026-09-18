import { useState } from "react";
import {
  BookOpen,
  Volume2,
  Image as ImageIcon,
  Compass,
  Code2,
  CheckCircle2,
  Clock,
  User,
  MapPin,
  ExternalLink,
} from "lucide-react";
import type { DesktopStoryBeat } from "@narrativex/client-contracts";

export interface StoryBeatInspectorProps {
  beat: DesktopStoryBeat | null;
  onUpdateReviewStatus?: (status: "APPROVED" | "NEEDS_REVIEW" | "REJECTED") => void;
}

export function StoryBeatInspector({ beat, onUpdateReviewStatus }: StoryBeatInspectorProps) {
  const [activeTab, setActiveTab] = useState<"story" | "audio" | "visual" | "continuity" | "advanced">("story");

  if (!beat) {
    return (
      <div className="flex h-full flex-col items-center justify-center p-6 text-center text-text-muted">
        <BookOpen size={36} className="mb-2 text-text-dim" />
        <span className="text-[14px] font-medium text-text-secondary">Chưa chọn StoryBeat</span>
        <p className="mt-1 text-[12px]">Chọn một StoryBeat trong danh sách để xem và chỉnh sửa thông tin chi tiết.</p>
      </div>
    );
  }

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
            <button
              type="button"
              onClick={() => onUpdateReviewStatus?.("APPROVED")}
              className={`inline-flex items-center gap-1 rounded px-2.5 py-1 text-[11px] font-medium transition-all ${
                beat.reviewStatus === "APPROVED"
                  ? "bg-success text-white"
                  : "bg-surface-3 text-text-secondary hover:text-foreground"
              }`}
              title="Đánh dấu đã duyệt"
            >
              <CheckCircle2 size={12} />
              <span>Duyệt</span>
            </button>
          </div>
        </div>

        {/* Inspector 5 Tabs */}
        <div className="flex items-center gap-1 rounded-lg bg-surface-dark p-1 text-[12px]">
          <button
            type="button"
            onClick={() => setActiveTab("story")}
            className={`flex-1 rounded py-1 font-medium transition-all text-center ${
              activeTab === "story" ? "bg-primary-muted text-primary shadow-sm" : "text-text-muted hover:text-foreground"
            }`}
          >
            Story
          </button>
          <button
            type="button"
            onClick={() => setActiveTab("audio")}
            className={`flex-1 rounded py-1 font-medium transition-all text-center ${
              activeTab === "audio" ? "bg-primary-muted text-primary shadow-sm" : "text-text-muted hover:text-foreground"
            }`}
          >
            Audio
          </button>
          <button
            type="button"
            onClick={() => setActiveTab("visual")}
            className={`flex-1 rounded py-1 font-medium transition-all text-center ${
              activeTab === "visual" ? "bg-primary-muted text-primary shadow-sm" : "text-text-muted hover:text-foreground"
            }`}
          >
            Visual
          </button>
          <button
            type="button"
            onClick={() => setActiveTab("continuity")}
            className={`flex-1 rounded py-1 font-medium transition-all text-center ${
              activeTab === "continuity" ? "bg-primary-muted text-primary shadow-sm" : "text-text-muted hover:text-foreground"
            }`}
          >
            Continuity
          </button>
          <button
            type="button"
            onClick={() => setActiveTab("advanced")}
            className={`flex-1 rounded py-1 font-medium transition-all text-center ${
              activeTab === "advanced" ? "bg-primary-muted text-primary shadow-sm" : "text-text-muted hover:text-foreground"
            }`}
          >
            Advanced
          </button>
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

        {/* VISUAL TAB */}
        {activeTab === "visual" && (
          <div className="space-y-3">
            <div className="flex items-center justify-between">
              <span className="text-[12px] font-semibold text-text-secondary uppercase tracking-wider">
                Visual Beats ({beat.visualBeats.length})
              </span>
            </div>

            {beat.visualBeats.length === 0 ? (
              <p className="text-[12px] text-text-muted italic">Không có Visual Beat nào trong StoryBeat này.</p>
            ) : (
              beat.visualBeats.map((vBeat, idx) => (
                <div key={vBeat.id || idx} className="rounded-lg border border-border-subtle bg-surface p-3 space-y-2">
                  <div className="flex items-center justify-between">
                    <div className="flex items-center gap-1.5">
                      <ImageIcon size={13} className="text-primary" />
                      <span className="text-[13px] font-medium text-foreground">
                        {vBeat.title || `Visual #${idx + 1}`}
                      </span>
                    </div>
                    <span className="rounded bg-surface-3 px-1.5 py-0.5 font-mono text-[10px] text-text-secondary">
                      {vBeat.visualFocus || "SPEAKER"}
                    </span>
                  </div>

                  <div className="rounded bg-surface-dark p-2.5 text-[12px] text-text-secondary border border-border-subtle/40">
                    <p>{vBeat.visualIntent || vBeat.visualSummary || "Chưa có mô tả hình ảnh."}</p>
                  </div>

                  <div className="flex items-center justify-between text-[11px] text-text-muted">
                    <span>Trọng số thời lượng: {vBeat.relativeWeight}x</span>
                    <span>Chế độ: {vBeat.motionMode}</span>
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
              <div>
                <span className="block text-text-muted uppercase tracking-wider mb-1">Compiled Prompt Snapshot</span>
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
