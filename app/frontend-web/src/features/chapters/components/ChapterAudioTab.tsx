import { AlertCircle, CheckCircle2, Clock3, Loader2, Volume2 } from "lucide-react";
import type { ApiChapterWorkspace } from "@/types/api";

interface ChapterAudioTabProps {
  workspace: ApiChapterWorkspace;
}

const statusCopy: Record<string, string> = {
  NOT_STARTED: "Chưa tạo narration",
  QUEUED: "Đang chờ worker xử lý",
  GENERATING: "Đang tạo audio và subtitle",
  RUNNING: "Đang tạo audio và subtitle",
  READY: "Audio đã sẵn sàng",
  FAILED: "Tạo audio thất bại",
  STALLED: "Worker đang cần retry",
  UNKNOWN: "Đang xác minh trạng thái provider",
  PAUSED_COST_LIMIT: "Đang tạm dừng do giới hạn chi phí",
};

export function ChapterAudioTab({ workspace }: Readonly<ChapterAudioTabProps>) {
  const audio = workspace.pipeline.audio;
  const isActive = ["QUEUED", "GENERATING", "RUNNING", "STALLED", "UNKNOWN", "PAUSED_COST_LIMIT"].includes(audio.status);
  const isReady = audio.status === "READY" && Boolean(audio.audioUrl);
  const isFailed = audio.status === "FAILED";

  return (
    <section className="rounded-2xl border border-border bg-surface-card/90 p-5 sm:p-6">
      <div className="flex flex-col gap-4 sm:flex-row sm:items-start sm:justify-between">
        <div className="flex items-start gap-3">
          <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl bg-amber-500/15 text-amber-300">
            <Volume2 className="h-5 w-5" />
          </div>
          <div>
            <h2 className="text-base font-semibold text-slate-100">Audio narration</h2>
            <p className="mt-1 text-sm text-slate-400">Chapter: {workspace.chapter.title}</p>
          </div>
        </div>
        <StatusBadge status={audio.status} active={isActive} ready={isReady} failed={isFailed} />
      </div>

      {isReady ? (
        <div className="mt-6 rounded-xl border border-emerald-500/20 bg-emerald-500/5 p-4">
          <p className="mb-3 text-sm font-medium text-emerald-200">Audio đã tạo xong</p>
          <audio className="w-full" controls preload="metadata" src={audio.audioUrl ?? undefined}>
            Trình duyệt không hỗ trợ phát audio.
          </audio>
          {audio.durationMs ? (
            <p className="mt-2 text-xs text-slate-400">
              Thời lượng: {formatDuration(audio.durationMs)}
            </p>
          ) : null}
        </div>
      ) : (
        <div className="mt-6 rounded-xl border border-border bg-surface-panel/70 p-4">
          <div className="flex items-start gap-3">
            {isActive ? (
              <Loader2 className="mt-0.5 h-4 w-4 shrink-0 motion-safe:animate-spin text-amber-300" />
            ) : isFailed ? (
              <AlertCircle className="mt-0.5 h-4 w-4 shrink-0 text-rose-300" />
            ) : (
              <Clock3 className="mt-0.5 h-4 w-4 shrink-0 text-slate-400" />
            )}
            <div>
              <p className="text-sm font-medium text-slate-200">
                {statusCopy[audio.status] ?? "Chưa có audio"}
              </p>
              <p className="mt-1 text-xs leading-5 text-slate-400">
                {isActive
                  ? "Job đã được nhận. Tab này sẽ tự cập nhật khi worker hoàn tất; chưa có file để phát ở thời điểm hiện tại."
                  : isFailed
                    ? "Kiểm tra log worker/provider rồi tạo lại narration."
                    : "Hãy tạo narration từ bước Audio trong Tổng quan. "}
              </p>
            </div>
          </div>
        </div>
      )}
    </section>
  );
}

function StatusBadge({
  status,
  active,
  ready,
  failed,
}: {
  status: string;
  active: boolean;
  ready: boolean;
  failed: boolean;
}) {
  return (
    <span
      className={`inline-flex items-center gap-1.5 rounded-full border px-2.5 py-1 text-xs font-medium ${
        ready
          ? "border-emerald-500/30 bg-emerald-500/10 text-emerald-300"
          : failed
            ? "border-rose-500/30 bg-rose-500/10 text-rose-300"
            : active
              ? "border-amber-500/30 bg-amber-500/10 text-amber-300"
              : "border-border bg-surface-panel text-slate-400"
      }`}
    >
      {ready ? <CheckCircle2 className="h-3.5 w-3.5" /> : null}
      {statusCopy[status] ?? status}
    </span>
  );
}

function formatDuration(durationMs: number) {
  const totalSeconds = Math.round(durationMs / 1000);
  return `${Math.floor(totalSeconds / 60)}:${String(totalSeconds % 60).padStart(2, "0")}`;
}
