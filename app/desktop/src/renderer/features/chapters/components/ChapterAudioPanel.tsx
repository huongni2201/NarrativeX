import type { DesktopChapterDetails } from "@narrativex/client-contracts";
import { AudioLines, Loader2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import {
  audioButtonLabel,
  audioStatusBadgeClass,
  audioStatusLabel,
  formatDurationMs,
  narrationVoiceName,
} from "../model/chapter-ui";
import type { ChapterAudioState } from "./chapter-editor.types";

export function ChapterAudioPanel({
  selected,
  generationBlockedByUnsavedChanges,
  audio,
}: Readonly<{
  selected: DesktopChapterDetails | null;
  generationBlockedByUnsavedChanges: boolean;
  audio: ChapterAudioState;
}>) {
  const generatedVoiceName = narrationVoiceName({
    generatedVoiceId: audio.workspace?.pipeline.audio.voiceId,
    voices: audio.voices,
  });

  return (
    <div className="space-y-3 rounded-lg border border-border bg-surface p-3.5">
      <div className="flex items-start justify-between gap-3">
        <div className="flex min-w-0 items-start gap-2">
          <AudioLines className="mt-0.5 shrink-0 text-text-secondary" size={16} />
          <div className="min-w-0">
            <h3 className="text-xs font-bold text-foreground">Audio chapter</h3>
            <p className="mt-1 text-[10px] leading-4 text-text-secondary">
              Chọn giọng, tốc độ và tạo narration từ bản chapter đã lưu.
            </p>
          </div>
        </div>
        <span
          className={`shrink-0 rounded px-2 py-1 text-[9px] font-semibold ${audioStatusBadgeClass(
            audio.busy ? "PROCESSING" : audio.status,
          )}`}
          aria-live="polite"
        >
          {audio.busy
            ? "Đang xử lý"
            : audio.workspace
              ? audioStatusLabel(audio.workspace.pipeline.audio.status)
              : audio.workspaceError
                ? "Không tải được"
                : selected
                  ? "Đang tải…"
                  : "Chưa có chapter"}
        </span>
      </div>

      <div className="grid grid-cols-[minmax(0,1fr)_88px_140px] items-end gap-2">
        <label className="grid min-w-0 gap-1 text-[10px] text-text-secondary">
          <span>Giọng đọc</span>
          <select
            aria-label="Voice đọc chapter"
            value={audio.voiceId}
            onChange={(event) => audio.onVoiceChange(event.target.value)}
            disabled={audio.controlsDisabled || !audio.voices.length}
            className="h-8 min-w-0 rounded-md border border-border bg-surface-input px-2 text-xs text-foreground disabled:cursor-not-allowed disabled:opacity-50"
          >
            {!audio.voices.length && <option value="">Chưa có voice</option>}
            {audio.voices.map((voice) => (
              <option key={voice.id} value={voice.id}>
                {voice.name} · {voice.language}
              </option>
            ))}
          </select>
        </label>

        <label className="grid gap-1 text-[10px] text-text-secondary">
          <span>Tốc độ</span>
          <Input
            aria-label="Tốc độ đọc"
            type="number"
            min="0.25"
            max="2"
            step="0.05"
            value={audio.speakingRate}
            onChange={(event) => audio.onSpeakingRateChange(event.target.value)}
            disabled={audio.controlsDisabled}
            className="h-8 border-border bg-surface-input text-xs disabled:cursor-not-allowed"
          />
        </label>

        <div className="grid gap-1">
          <span className="text-[10px] text-text-secondary">Tạo audio</span>
          <Button
            type="button"
            onClick={audio.onCreate}
            disabled={
              !selected ||
              !audio.voiceId ||
              audio.controlsDisabled ||
              generationBlockedByUnsavedChanges
            }
            className="h-8 w-full gap-1.5 whitespace-nowrap px-3 text-xs font-bold"
          >
            {audio.busy ? (
              <Loader2 className="animate-spin" size={13} />
            ) : (
              <AudioLines size={13} />
            )}
            <span>
              {audioButtonLabel({
                generatePending: audio.generatePending,
                processing: audio.processing,
                ready: audio.ready,
              })}
            </span>
          </Button>
        </div>
      </div>

      {generationBlockedByUnsavedChanges && (
        <p className="text-[10px] leading-4 text-warning">
          Hãy lưu thay đổi trước khi tạo audio hoặc phân tích chapter.
        </p>
      )}

      {audio.blockMessage && (
        <p
          className="rounded-md border border-warning/20 bg-warning-bg px-3 py-2 text-[10px] leading-4 text-warning"
          role="alert"
        >
          {audio.blockMessage}
        </p>
      )}

      {audio.requestError && (
        <p
          className="rounded-md border border-danger/20 bg-danger-bg px-3 py-2 text-[10px] leading-4 text-danger"
          role="alert"
        >
          {audio.requestError}
        </p>
      )}

      <div className="border-t border-border-subtle pt-3">
        {audio.busy && (
          <div className="flex items-center gap-2 rounded-md border border-info/20 bg-info-bg px-3 py-2 text-[10px] text-text-secondary">
            <Loader2 className="shrink-0 animate-spin text-info" size={13} />
            <span>
              {audio.generatePending
                ? "Đang gửi yêu cầu tạo audio…"
                : "Narration worker đang xử lý chapter này. Các chapter khác vẫn có thể tạo audio song song."}
            </span>
          </div>
        )}

        {!audio.busy && audio.ready && audio.workspace?.pipeline.audio.audioUrl && (
          <div className="space-y-2 rounded-md border border-border-subtle bg-surface-2 p-3">
            <div className="flex items-center justify-between gap-3 text-[10px]">
              <div className="min-w-0">
                <strong className="block truncate text-xs text-foreground">
                  Narration · {generatedVoiceName}
                </strong>
                <span className="text-text-muted">
                  {formatDurationMs(audio.workspace.pipeline.audio.durationMs)}
                </span>
              </div>
              <span className="shrink-0 rounded bg-success-bg px-2 py-1 font-semibold text-success">
                Sẵn sàng
              </span>
            </div>
            <audio
              key={audio.workspace.pipeline.audio.audioUrl}
              className="h-9 w-full"
              controls
              preload="metadata"
              src={audio.workspace.pipeline.audio.audioUrl}
              onError={audio.onRefetchWorkspace}
            />
          </div>
        )}

        {!audio.busy && audio.ready && !audio.workspace?.pipeline.audio.audioUrl && (
          <p className="rounded-md border border-warning/20 bg-warning-bg px-3 py-2 text-[10px] leading-4 text-warning">
            Audio đã sẵn sàng nhưng chưa lấy được URL nghe thử. Hãy tải lại workspace hoặc kiểm tra media storage.
          </p>
        )}

        {!audio.busy && audio.status === "FAILED" && (
          <p className="rounded-md border border-danger/20 bg-danger-bg px-3 py-2 text-[10px] leading-4 text-danger">
            Tạo audio thất bại. Bạn có thể giữ nguyên giọng/tốc độ và bấm Tạo audio để thử lại.
          </p>
        )}

        {!audio.busy && !audio.ready && audio.status !== "FAILED" && (
          <p className="text-[10px] text-text-muted">
            Chưa có audio để nghe. Sau khi job hoàn tất, player sẽ xuất hiện tại đây.
          </p>
        )}
      </div>
    </div>
  );
}
