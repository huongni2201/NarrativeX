import { useState } from "react";
import {
  Activity,
  RefreshCw,
  CheckCircle2,
  XCircle,
  Clock,
  ChevronDown,
  ChevronRight,
  Terminal,
  AlertCircle,
} from "lucide-react";
import type { DesktopJobHistoryItem } from "@narrativex/client-contracts";
import type { DesktopWorkspaceState } from "../../workspace/queries/useProjectWorkspace";
import { useJobHistoryQuery } from "../queries/jobs.queries";

export interface JobsScreenProps {
  projectId: string;
  workspace: DesktopWorkspaceState;
}

export function JobsScreen({ projectId }: JobsScreenProps) {
  const [filter, setFilter] = useState<"ALL" | "RUNNING" | "COMPLETED" | "FAILED">("ALL");
  const [expandedJobId, setExpandedJobId] = useState<string | null>(null);

  const { data: page, isLoading, isError, refetch } = useJobHistoryQuery(50);
  const jobs: DesktopJobHistoryItem[] = page?.content ?? [];

  const filteredJobs = jobs.filter((job) => {
    if (filter === "ALL") return true;
    if (filter === "RUNNING") return job.status === "RUNNING" || job.status === "QUEUED";
    return job.status === filter;
  });

  const getStatusIcon = (status: string) => {
    switch (status) {
      case "RUNNING":
        return <RefreshCw size={15} className="animate-spin text-primary" />;
      case "COMPLETED":
        return <CheckCircle2 size={15} className="text-success" />;
      case "FAILED":
        return <XCircle size={15} className="text-destructive" />;
      case "QUEUED":
      default:
        return <Clock size={15} className="text-warning" />;
    }
  };

  return (
    <div className="flex h-full w-full flex-col overflow-hidden bg-background">
      {/* Header */}
      <div className="flex h-12 shrink-0 items-center justify-between border-b border-border-subtle bg-surface-dark px-4">
        <div className="flex items-center gap-3">
          <Activity size={18} className="text-primary" />
          <h2 className="text-[15px] font-semibold text-foreground">Tác vụ hệ thống & Nhật ký xử lý (Jobs)</h2>
        </div>

        {/* Filter Pills */}
        <div className="flex items-center gap-1 rounded-lg bg-surface-2 p-1 text-[12px]">
          {(["ALL", "RUNNING", "COMPLETED", "FAILED"] as const).map((tab) => (
            <button
              key={tab}
              type="button"
              onClick={() => setFilter(tab)}
              className={`rounded-md px-3 py-1 font-medium transition-all ${
                filter === tab
                  ? "bg-primary-muted text-primary shadow-sm"
                  : "text-text-muted hover:text-foreground"
              }`}
            >
              {tab === "ALL" && "Tất cả"}
              {tab === "RUNNING" && "Đang chạy"}
              {tab === "COMPLETED" && "Hoàn tất"}
              {tab === "FAILED" && "Lỗi"}
            </button>
          ))}
        </div>
      </div>

      {/* Jobs List */}
      <div className="min-h-0 flex-1 overflow-y-auto p-4">
        {isLoading ? (
          <div className="flex h-64 flex-col items-center justify-center text-text-muted">
            <RefreshCw size={32} className="animate-spin text-primary mb-3" />
            <span className="text-[13px] font-medium text-foreground">Đang tải danh sách tác vụ...</span>
          </div>
        ) : isError ? (
          <div className="flex h-64 flex-col items-center justify-center text-text-muted">
            <AlertCircle size={36} className="text-destructive mb-2" />
            <p className="text-[14px] text-foreground font-medium">Không thể tải nhật ký tác vụ</p>
            <button
              type="button"
              onClick={() => void refetch()}
              className="mt-3 inline-flex items-center gap-1.5 rounded-md bg-surface-3 px-3 py-1.5 text-[12px] font-medium text-foreground hover:bg-surface-2 border border-border-subtle"
            >
              <RefreshCw size={12} />
              <span>Thử lại</span>
            </button>
          </div>
        ) : filteredJobs.length === 0 ? (
          <div className="flex h-64 flex-col items-center justify-center text-text-muted">
            <Activity size={36} className="mb-2 text-text-dim" />
            <p className="text-[14px]">
              {filter === "ALL" ? "Chưa có tác vụ nào được thực thi." : `Không có tác vụ nào ở trạng thái ${filter}.`}
            </p>
          </div>
        ) : (
          <div className="flex flex-col gap-2">
            {filteredJobs.map((job) => {
              const isExpanded = expandedJobId === job.jobId;
              const formattedDate = new Date(job.createdAt).toLocaleString();

              return (
                <div
                  key={job.jobId}
                  className="rounded-lg border border-border-subtle bg-surface transition-all hover:border-border"
                >
                  <div
                    className="flex cursor-pointer items-center justify-between p-3.5"
                    onClick={() => setExpandedJobId(isExpanded ? null : job.jobId)}
                  >
                    <div className="flex items-center gap-3">
                      <button type="button" className="text-text-muted hover:text-foreground">
                        {isExpanded ? <ChevronDown size={16} /> : <ChevronRight size={16} />}
                      </button>
                      {getStatusIcon(job.status)}
                      <div>
                        <div className="flex items-center gap-2">
                          <span className="text-[14px] font-medium text-foreground">
                            {job.jobType}
                          </span>
                          <span className="rounded bg-surface-3 px-1.5 py-0.5 text-[10px] font-mono text-text-secondary uppercase">
                            {job.jobType}
                          </span>
                        </div>
                        <div className="flex items-center gap-3 text-[12px] text-text-muted mt-0.5">
                          {job.currentStep && <span>Bước: {job.currentStep}</span>}
                          {job.currentStep && <span>•</span>}
                          <span>Thời gian: {formattedDate}</span>
                        </div>
                      </div>
                    </div>

                    <div className="flex items-center gap-4">
                      <div className="text-right">
                        <span className="text-[12px] font-mono font-medium text-foreground">{job.progress}%</span>
                        <div className="mt-1 h-1.5 w-24 overflow-hidden rounded-full bg-surface-3">
                          <div
                            className="h-full bg-primary transition-all duration-300"
                            style={{ width: `${Math.max(5, Math.min(100, job.progress))}%` }}
                          />
                        </div>
                      </div>

                      <span
                        className={`rounded-full border px-2.5 py-0.5 text-[11px] font-medium ${
                          job.status === "COMPLETED"
                            ? "border-success/30 bg-success-bg text-success"
                            : job.status === "RUNNING"
                            ? "border-primary/30 bg-primary-muted text-primary"
                            : job.status === "FAILED"
                            ? "border-destructive/30 bg-danger-bg text-destructive"
                            : "border-warning/30 bg-warning-bg text-warning"
                        }`}
                      >
                        {job.status}
                      </span>
                    </div>
                  </div>

                  {/* Expandable Diagnostics */}
                  {isExpanded && (
                    <div className="border-t border-border-subtle bg-surface-panel p-3.5 text-[12px]">
                      <div className="flex items-center gap-1.5 text-text-muted mb-2 font-mono">
                        <Terminal size={13} />
                        <span>Technical Diagnostics</span>
                      </div>
                      <div className="grid grid-cols-3 gap-2 font-mono text-text-secondary">
                        <div className="rounded bg-surface-dark p-2">
                          <span className="text-text-muted block text-[11px]">Job ID:</span>
                          <span className="truncate block text-foreground">{job.jobId}</span>
                        </div>
                        <div className="rounded bg-surface-dark p-2">
                          <span className="text-text-muted block text-[11px]">Current Step:</span>
                          <span className="truncate block text-foreground">{job.currentStep || "—"}</span>
                        </div>
                        <div className="rounded bg-surface-dark p-2">
                          <span className="text-text-muted block text-[11px]">Error Code:</span>
                          <span className="block text-foreground">{job.errorCode || "None"}</span>
                        </div>
                      </div>
                    </div>
                  )}
                </div>
              );
            })}
          </div>
        )}
      </div>
    </div>
  );
}