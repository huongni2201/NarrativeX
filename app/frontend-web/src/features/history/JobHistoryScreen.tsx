"use client";

import { useState } from "react";
import { History, RefreshCw, CheckCircle2, Clock, AlertCircle } from "lucide-react";
import { useJobHistory } from "./hooks/useJobHistory";
import { JobHistoryTable } from "./components/JobHistoryTable";
import { ACTIVE_JOB_STATUSES, type JobStatus } from "@/types/api";

export function JobHistoryScreen() {
  const [limit] = useState(20);
  const [cursorHistory, setCursorHistory] = useState<string[]>([]);
  const currentCursor = cursorHistory[cursorHistory.length - 1];

  const { data, isLoading, isFetching, refetch } = useJobHistory({
    limit,
    cursor: currentCursor,
  });

  const [statusFilter, setStatusFilter] = useState<string>("ALL");

  const jobs = data?.content ?? [];
  const isActiveJob = (status: string) => ACTIVE_JOB_STATUSES.has(status as JobStatus);
  const filteredJobs =
    statusFilter === "ALL"
      ? jobs
      : jobs.filter((j) => {
          if (statusFilter === "RUNNING") return isActiveJob(j.status);
          return j.status === statusFilter;
        });

  const totalCount = jobs.length;
  const runningCount = jobs.filter((j) => isActiveJob(j.status)).length;
  const completedCount = jobs.filter((j) => j.status === "COMPLETED").length;
  const failedCount = jobs.filter((j) => j.status === "FAILED").length;

  const handleNextPage = () => {
    if (data?.nextCursor) {
      setCursorHistory((prev) => [...prev, data.nextCursor!]);
    }
  };

  const handlePrevPage = () => {
    setCursorHistory((prev) => prev.slice(0, -1));
  };

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
        <div className="flex items-center gap-3">
          <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-primary-muted text-primary">
            <History className="h-5 w-5" />
          </div>
          <div>
            <h1 className="text-xl font-bold text-text-primary sm:text-2xl">Lịch sử công việc</h1>
            <p className="text-xs text-text-secondary">
              Theo dõi và giám sát tiến độ thực thi của toàn bộ tác vụ AI & render
            </p>
          </div>
        </div>

        <button
          type="button"
          onClick={() => refetch()}
          disabled={isFetching}
          className="inline-flex items-center gap-2 rounded-lg border border-border bg-surface-card px-3.5 py-2 text-xs font-semibold text-text-primary transition-colors hover:bg-surface-2 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary disabled:opacity-50"
        >
          <RefreshCw className={`h-3.5 w-3.5 ${isFetching ? "animate-spin text-primary" : ""}`} />
          Làm mới
        </button>
      </div>

      {/* Metrics Grid */}
      <div className="grid grid-cols-2 gap-3 sm:grid-cols-4">
        <div className="rounded-xl border border-border bg-surface-card p-4">
          <div className="flex items-center justify-between text-xs text-text-muted">
            <span>Tổng tác vụ (trang này)</span>
            <History className="h-4 w-4" />
          </div>
          <p className="mt-2 text-2xl font-bold text-text-primary">{totalCount}</p>
        </div>

        <div className="rounded-xl border border-border bg-surface-card p-4">
          <div className="flex items-center justify-between text-xs text-text-muted">
            <span>Đang xử lý</span>
            <Clock className="h-4 w-4 text-warning" />
          </div>
          <p className="mt-2 text-2xl font-bold text-warning">{runningCount}</p>
        </div>

        <div className="rounded-xl border border-border bg-surface-card p-4">
          <div className="flex items-center justify-between text-xs text-text-muted">
            <span>Hoàn thành</span>
            <CheckCircle2 className="h-4 w-4 text-success" />
          </div>
          <p className="mt-2 text-2xl font-bold text-success">{completedCount}</p>
        </div>

        <div className="rounded-xl border border-border bg-surface-card p-4">
          <div className="flex items-center justify-between text-xs text-text-muted">
            <span>Thất bại</span>
            <AlertCircle className="h-4 w-4 text-danger" />
          </div>
          <p className="mt-2 text-2xl font-bold text-danger">{failedCount}</p>
        </div>
      </div>

      {/* Filters */}
      <div className="flex flex-wrap items-center justify-between gap-3 border-b border-border/80 pb-3">
        <div className="flex items-center gap-1.5 rounded-lg border border-border bg-surface-panel p-1">
          <button
            type="button"
            onClick={() => setStatusFilter("ALL")}
            className={`rounded-md px-3 py-1 text-xs font-medium transition-colors ${
              statusFilter === "ALL"
                ? "bg-primary text-white"
                : "text-text-secondary hover:text-text-primary"
            }`}
          >
            Tất cả ({totalCount})
          </button>
          <button
            type="button"
            onClick={() => setStatusFilter("RUNNING")}
            className={`rounded-md px-3 py-1 text-xs font-medium transition-colors ${
              statusFilter === "RUNNING"
                ? "bg-primary text-white"
                : "text-text-secondary hover:text-text-primary"
            }`}
          >
            Đang chạy ({runningCount})
          </button>
          <button
            type="button"
            onClick={() => setStatusFilter("COMPLETED")}
            className={`rounded-md px-3 py-1 text-xs font-medium transition-colors ${
              statusFilter === "COMPLETED"
                ? "bg-primary text-white"
                : "text-text-secondary hover:text-text-primary"
            }`}
          >
            Hoàn thành ({completedCount})
          </button>
          <button
            type="button"
            onClick={() => setStatusFilter("FAILED")}
            className={`rounded-md px-3 py-1 text-xs font-medium transition-colors ${
              statusFilter === "FAILED"
                ? "bg-primary text-white"
                : "text-text-secondary hover:text-text-primary"
            }`}
          >
            Thất bại ({failedCount})
          </button>
        </div>

        {/* Pagination */}
        <div className="flex items-center gap-2">
          <button
            type="button"
            onClick={handlePrevPage}
            disabled={cursorHistory.length === 0 || isLoading}
            className="rounded-lg border border-border bg-surface-card px-3 py-1.5 text-xs font-medium text-text-secondary transition-colors hover:bg-surface-2 hover:text-text-primary disabled:opacity-40"
          >
            Trang trước
          </button>
          <span className="text-xs text-text-muted">
            Trang {cursorHistory.length + 1}
          </span>
          <button
            type="button"
            onClick={handleNextPage}
            disabled={!data?.hasNext || isLoading}
            className="rounded-lg border border-border bg-surface-card px-3 py-1.5 text-xs font-medium text-text-secondary transition-colors hover:bg-surface-2 hover:text-text-primary disabled:opacity-40"
          >
            Trang sau
          </button>
        </div>
      </div>

      {/* Table */}
      <JobHistoryTable jobs={filteredJobs} isLoading={isLoading} />
    </div>
  );
}
