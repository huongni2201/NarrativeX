import { AlertTriangle, CheckCircle2, Loader2 } from "lucide-react";
import { ACTIVE_JOB_STATUSES } from "@/types/api";
import { Progress } from "@/components/ui/Progress";
import type { ApiGenerationJob } from "@/types/api";
import type { ChapterRenderStatus } from "@/features/render/hooks/useChapterRender";

interface RenderProgressProps {
  job: Pick<ApiGenerationJob, "jobId" | "status" | "progress" | "currentStep">;
  status?: ChapterRenderStatus;
  progress?: number;
}

const statusCopy: Record<string, string> = {
  QUEUED: "Đang chờ worker xử lý",
  RUNNING: "Đang render video",
  STALLED: "Worker đang cần retry",
  UNKNOWN: "Đang xác minh trạng thái render",
  PAUSED_COST_LIMIT: "Đang tạm dừng do giới hạn chi phí",
  COMPLETED: "Render hoàn tất",
  FAILED: "Render thất bại",
  CANCELED: "Render đã bị hủy",
  IDLE: "Chưa bắt đầu render",
  SUBMITTING: "Đang gửi render job",
  RESOLVING_ARTIFACT: "Đang xác nhận artifact",
  READY: "Artifact đã sẵn sàng",
};

export function RenderProgress({ job, status, progress: progressOverride }: Readonly<RenderProgressProps>) {
  const displayStatus = status ?? job.status;
  const progress = progressOverride ?? (displayStatus === "COMPLETED" || displayStatus === "READY" ? 100 : Math.min(100, Math.max(0, job.progress)));
  const complete = displayStatus === "READY";
  const active = status ? ["QUEUED", "RUNNING", "STALLED", "COMPLETED", "RESOLVING_ARTIFACT"].includes(status) : ACTIVE_JOB_STATUSES.has(job.status);

  return (
    <section className="rounded-xl border border-border-dark bg-surface-panel p-4" aria-labelledby="render-progress-title">
      <div className="flex items-start justify-between gap-3">
        <div>
          <h3 id="render-progress-title" className="text-sm font-semibold text-slate-100">
            Render progress
          </h3>
          <p className="mt-1 text-xs text-slate-400">
            {statusCopy[displayStatus] ?? displayStatus} · {job.currentStep}
          </p>
        </div>
        {complete ? (
          <CheckCircle2 className="h-5 w-5 shrink-0 text-emerald-300" aria-hidden="true" />
        ) : active ? (
          <Loader2 className="h-5 w-5 shrink-0 animate-spin text-orange-300" aria-hidden="true" />
        ) : (
          <AlertTriangle className="h-5 w-5 shrink-0 text-rose-300" aria-hidden="true" />
        )}
      </div>
      <div
        className="mt-4"
        role="progressbar"
        aria-label="Tiến độ render video"
        aria-valuemin={0}
        aria-valuemax={100}
        aria-valuenow={progress}
      >
        <Progress value={progress} color={complete ? "green" : "orange"} />
      </div>
      <div className="mt-2 flex items-center justify-between gap-3 text-xs text-slate-400" aria-live="polite">
        <span>{progress}%</span>
        <span className="truncate font-mono">Job {job.jobId.slice(0, 8)}…</span>
      </div>
    </section>
  );
}
