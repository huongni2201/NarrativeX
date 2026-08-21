import Link from "next/link";
import { CheckCircle2, Clock, AlertCircle, XCircle, RotateCcw, ArrowRight } from "lucide-react";
import type { JobHistoryItem } from "../types/job-history.types";

interface JobHistoryTableProps {
  jobs: JobHistoryItem[];
  isLoading: boolean;
}

export function JobHistoryTable({ jobs, isLoading }: Readonly<JobHistoryTableProps>) {
  if (isLoading && jobs.length === 0) {
    return (
      <div className="flex h-64 flex-col items-center justify-center gap-3 rounded-2xl border border-border bg-surface-card p-8">
        <RotateCcw className="h-6 w-6 animate-spin text-primary" />
        <p className="text-sm text-text-secondary">Đang tải lịch sử công việc…</p>
      </div>
    );
  }

  if (jobs.length === 0) {
    return (
      <div className="flex h-64 flex-col items-center justify-center gap-3 rounded-2xl border border-border bg-surface-card p-8 text-center">
        <Clock className="h-10 w-10 text-text-muted opacity-40" />
        <h3 className="text-base font-semibold text-text-primary">Chưa có công việc nào</h3>
        <p className="max-w-md text-xs text-text-secondary">
          Các tác vụ phân tích Chapter, tạo giọng đọc hay render video sẽ được ghi nhận tự động tại đây.
        </p>
      </div>
    );
  }

  return (
    <div className="overflow-hidden rounded-2xl border border-border bg-surface-card shadow-md">
      <div className="overflow-x-auto">
        <table className="w-full text-left text-xs">
          <thead className="border-b border-border bg-surface-2/60 text-text-secondary">
            <tr>
              <th className="px-4 py-3.5 font-semibold">Mã Job / Project</th>
              <th className="px-4 py-3.5 font-semibold">Loại tác vụ</th>
              <th className="px-4 py-3.5 font-semibold">Trạng thái</th>
              <th className="px-4 py-3.5 font-semibold">Tiến độ</th>
              <th className="px-4 py-3.5 font-semibold">Bước hiện tại</th>
              <th className="px-4 py-3.5 font-semibold">Thời gian tạo</th>
              <th className="px-4 py-3.5 font-semibold">Hoàn tất</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-border/60">
            {jobs.map((job) => (
              <tr key={job.jobId} className="transition-colors hover:bg-surface-2/30">
                <td className="px-4 py-3.5">
                  <div className="flex flex-col gap-0.5">
                    <span className="font-mono font-medium text-text-primary">{job.jobId.slice(0, 8)}...</span>
                    {job.projectId ? (
                      <Link
                        href={`/projects/${job.projectId}`}
                        className="inline-flex items-center gap-1 text-[11px] text-primary-hover hover:underline"
                      >
                        {job.projectName || `Project #${job.projectId}`}
                        <ArrowRight className="h-3 w-3" />
                      </Link>
                    ) : (
                      <span className="text-[11px] text-text-muted">Hệ thống</span>
                    )}
                  </div>
                </td>
                <td className="px-4 py-3.5">
                  <span className="inline-block rounded-md border border-border px-2 py-0.5 font-mono text-[11px] font-medium text-text-secondary bg-surface-panel">
                    {formatJobType(job.jobType)}
                  </span>
                </td>
                <td className="px-4 py-3.5">
                  <JobStatusBadge status={job.status} />
                </td>
                <td className="px-4 py-3.5">
                  <div className="w-24">
                    <div className="flex items-center justify-between text-[11px] font-medium text-text-secondary mb-1">
                      <span>{job.progress}%</span>
                    </div>
                    <div className="h-1.5 w-full overflow-hidden rounded-full bg-surface-3">
                      <div
                        className={`h-full transition-[width] duration-300 ${
                          job.status === "FAILED"
                            ? "bg-danger"
                            : job.status === "COMPLETED"
                              ? "bg-success"
                              : "bg-primary"
                        }`}
                        style={{ width: `${Math.min(100, Math.max(0, job.progress))}%` }}
                      />
                    </div>
                  </div>
                </td>
                <td className="px-4 py-3.5 max-w-[200px] truncate text-text-secondary">
                  {job.errorCode ? (
                    <span className="text-danger flex items-center gap-1 font-medium">
                      <AlertCircle className="h-3.5 w-3.5 shrink-0" />
                      {job.errorCode}
                    </span>
                  ) : (
                    job.currentStep || "—"
                  )}
                </td>
                <td className="px-4 py-3.5 text-text-muted whitespace-nowrap">
                  {formatDate(job.createdAt)}
                </td>
                <td className="px-4 py-3.5 text-text-muted whitespace-nowrap">
                  {job.completedAt ? formatDate(job.completedAt) : "—"}
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
}

function JobStatusBadge({ status }: { status: string }) {
  switch (status) {
    case "COMPLETED":
      return (
        <span className="inline-flex items-center gap-1 rounded-full border border-success/30 bg-success-bg px-2.5 py-0.5 text-[11px] font-medium text-success">
          <CheckCircle2 className="h-3 w-3" />
          Hoàn thành
        </span>
      );
    case "RUNNING":
      return (
        <span className="inline-flex items-center gap-1 rounded-full border border-primary/40 bg-primary-muted px-2.5 py-0.5 text-[11px] font-medium text-primary-hover animate-pulse">
          <RotateCcw className="h-3 w-3 animate-spin" />
          Đang chạy
        </span>
      );
    case "QUEUED":
      return (
        <span className="inline-flex items-center gap-1 rounded-full border border-warning/30 bg-warning-bg px-2.5 py-0.5 text-[11px] font-medium text-warning">
          <Clock className="h-3 w-3" />
          Chờ xử lý
        </span>
      );
    case "FAILED":
      return (
        <span className="inline-flex items-center gap-1 rounded-full border border-danger/30 bg-danger-bg px-2.5 py-0.5 text-[11px] font-medium text-danger">
          <AlertCircle className="h-3 w-3" />
          Thất bại
        </span>
      );
    case "CANCELED":
      return (
        <span className="inline-flex items-center gap-1 rounded-full border border-border px-2.5 py-0.5 text-[11px] font-medium text-text-muted bg-surface-2">
          <XCircle className="h-3 w-3" />
          Đã hủy
        </span>
      );
    default:
      return (
        <span className="inline-flex items-center gap-1 rounded-full border border-border px-2.5 py-0.5 text-[11px] font-medium text-text-secondary bg-surface-2">
          {status}
        </span>
      );
  }
}

function formatJobType(type: string): string {
  const map: Record<string, string> = {
    STORY_ANALYZE: "Phân tích Story",
    CHAPTER_ANALYZE: "Phân tích Chapter",
    CHAPTER_NARRATE: "Tạo Giọng đọc",
    IMAGE_GENERATE: "Sinh Hình ảnh",
    SHOT_IMAGE_GENERATE: "Sinh Shot Beat",
    CHAPTER_GENERATE: "Tạo Chapter",
    CHAPTER_RENDER: "Render Chapter",
    RENDER_PROJECT: "Render Toàn bộ",
    RENDER_SHORT: "Render Short Clip",
  };
  return map[type] ?? type;
}

function formatDate(isoString: string): string {
  try {
    const d = new Date(isoString);
    return new Intl.DateTimeFormat("vi-VN", {
      hour: "2-digit",
      minute: "2-digit",
      second: "2-digit",
      day: "2-digit",
      month: "2-digit",
    }).format(d);
  } catch {
    return isoString;
  }
}
