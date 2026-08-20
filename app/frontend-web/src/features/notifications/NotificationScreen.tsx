"use client";

import { useState } from "react";
import Link from "next/link";
import {
  Bell,
  CheckCheck,
  Sparkles,
  AlertTriangle,
  Info,
  CheckCircle2,
  ExternalLink,
  RotateCcw,
} from "lucide-react";
import {
  useNotifications,
  useMarkNotificationRead,
  useMarkAllNotificationsRead,
} from "./hooks/useNotifications";
import type { NotificationItem } from "./types/notifications.types";

export function NotificationScreen() {
  const [unreadOnly, setUnreadOnly] = useState(false);
  const { data, isLoading, isFetching, refetch } = useNotifications({ limit: 50, unreadOnly });
  const markReadMutation = useMarkNotificationRead();
  const markAllReadMutation = useMarkAllNotificationsRead();

  const items = data?.items ?? [];
  const unreadCount = data?.unreadCount ?? 0;

  return (
    <div className="mx-auto max-w-4xl space-y-6">
      {/* Header */}
      <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
        <div className="flex items-center gap-3">
          <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-primary-light text-primary">
            <Bell className="h-5 w-5" />
          </div>
          <div>
            <h1 className="text-xl font-bold text-text-primary sm:text-2xl">Trung tâm thông báo</h1>
            <p className="text-xs text-text-secondary">
              Xem và quản lý các thông báo về tiến trình xử lý kịch bản, AI và hệ thống
            </p>
          </div>
        </div>

        <div className="flex items-center gap-2">
          {unreadCount > 0 && (
            <button
              type="button"
              onClick={() => markAllReadMutation.mutate()}
              disabled={markAllReadMutation.isPending}
              className="inline-flex items-center gap-1.5 rounded-lg border border-border bg-surface-card px-3.5 py-2 text-xs font-semibold text-text-primary transition-colors hover:bg-surface-2 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary disabled:opacity-50"
            >
              <CheckCheck className="h-3.5 w-3.5 text-primary" />
              Đánh dấu tất cả đã đọc
            </button>
          )}

          <button
            type="button"
            onClick={() => refetch()}
            disabled={isFetching}
            className="inline-flex items-center gap-1.5 rounded-lg border border-border bg-surface-card px-3.5 py-2 text-xs font-semibold text-text-primary transition-colors hover:bg-surface-2 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary disabled:opacity-50"
          >
            <RotateCcw className={`h-3.5 w-3.5 ${isFetching ? "animate-spin text-primary" : ""}`} />
            Làm mới
          </button>
        </div>
      </div>

      {/* Tabs Filter */}
      <div className="flex items-center gap-2 border-b border-border/80 pb-3">
        <button
          type="button"
          onClick={() => setUnreadOnly(false)}
          className={`rounded-lg px-4 py-1.5 text-xs font-medium transition-colors ${
            !unreadOnly
              ? "bg-primary text-white"
              : "bg-surface-card text-text-secondary hover:text-text-primary"
          }`}
        >
          Tất cả thông báo
        </button>
        <button
          type="button"
          onClick={() => setUnreadOnly(true)}
          className={`rounded-lg px-4 py-1.5 text-xs font-medium transition-colors ${
            unreadOnly
              ? "bg-primary text-white"
              : "bg-surface-card text-text-secondary hover:text-text-primary"
          }`}
        >
          Chưa đọc {unreadCount > 0 && `(${unreadCount})`}
        </button>
      </div>

      {/* Content */}
      <div className="space-y-3">
        {isLoading && items.length === 0 ? (
          <div className="flex h-64 flex-col items-center justify-center gap-3 rounded-2xl border border-border bg-surface-card p-8">
            <RotateCcw className="h-6 w-6 animate-spin text-primary" />
            <p className="text-sm text-text-secondary">Đang tải thông báo…</p>
          </div>
        ) : items.length === 0 ? (
          <div className="flex h-64 flex-col items-center justify-center gap-3 rounded-2xl border border-border bg-surface-card p-8 text-center">
            <Bell className="h-10 w-10 text-text-muted opacity-40" />
            <h3 className="text-base font-semibold text-text-primary">
              {unreadOnly ? "Không có thông báo chưa đọc" : "Chưa có thông báo nào"}
            </h3>
            <p className="max-w-md text-xs text-text-secondary">
              Các sự kiện khi hoàn tất tác vụ AI, cảnh báo hạn mức hoặc lỗi hệ thống sẽ hiển thị tại đây.
            </p>
          </div>
        ) : (
          items.map((item) => (
            <NotificationRow
              key={item.id}
              item={item}
              onMarkRead={() => markReadMutation.mutate(item.id)}
            />
          ))
        )}
      </div>
    </div>
  );
}

function NotificationRow({
  item,
  onMarkRead,
}: {
  item: NotificationItem;
  onMarkRead: () => void;
}) {
  const isUnread = !item.readAt;

  return (
    <div
      className={`flex items-start gap-4 rounded-2xl border p-4 transition-colors ${
        isUnread
          ? "border-primary/40 bg-surface-card shadow-md"
          : "border-border bg-surface-card/60 hover:bg-surface-card"
      }`}
    >
      <div className="mt-0.5 shrink-0">
        <NotificationIcon type={item.type} />
      </div>

      <div className="min-w-0 flex-1">
        <div className="flex items-center justify-between gap-2">
          <h3
            className={`text-sm font-semibold ${
              isUnread ? "text-text-primary" : "text-text-secondary"
            }`}
          >
            {formatNotificationTitle(item.titleKey)}
          </h3>
          <span className="text-xs text-text-muted whitespace-nowrap">
            {formatDate(item.createdAt)}
          </span>
        </div>

        <p className="mt-1 text-xs text-text-secondary leading-relaxed">
          {formatNotificationMessage(item.messageKey)}
        </p>

        <div className="mt-3 flex items-center justify-between">
          <div>
            {item.projectId && (
              <Link
                href={`/projects/${item.projectId}`}
                className="inline-flex items-center gap-1 text-xs text-primary-hover hover:underline"
              >
                Mở dự án
                <ExternalLink className="h-3 w-3" />
              </Link>
            )}
          </div>

          {isUnread && (
            <button
              type="button"
              onClick={onMarkRead}
              className="rounded-md border border-border px-2.5 py-1 text-xs text-primary-hover transition-colors hover:bg-surface-2"
            >
              Đánh dấu đã đọc
            </button>
          )}
        </div>
      </div>
    </div>
  );
}

function NotificationIcon({ type }: { type: string }) {
  if (type.includes("COMPLETED") || type.includes("SUCCESS")) {
    return (
      <div className="flex h-9 w-9 items-center justify-center rounded-xl bg-success-bg text-success">
        <CheckCircle2 className="h-4 w-4" />
      </div>
    );
  }
  if (type.includes("FAILED") || type.includes("ERROR")) {
    return (
      <div className="flex h-9 w-9 items-center justify-center rounded-xl bg-danger-bg text-danger">
        <AlertTriangle className="h-4 w-4" />
      </div>
    );
  }
  if (type.includes("AI") || type.includes("GENERATE") || type.includes("ANALYZE")) {
    return (
      <div className="flex h-9 w-9 items-center justify-center rounded-xl bg-primary-light text-primary">
        <Sparkles className="h-4 w-4" />
      </div>
    );
  }
  return (
    <div className="flex h-9 w-9 items-center justify-center rounded-xl bg-surface-3 text-text-secondary">
      <Info className="h-4 w-4" />
    </div>
  );
}

function formatNotificationTitle(key: string): string {
  const map: Record<string, string> = {
    "notification.story_analyze.completed": "Phân tích Chapter hoàn tất",
    "notification.story_analyze.failed": "Phân tích Chapter thất bại",
    "notification.narration.completed": "Tạo giọng đọc hoàn tất",
    "notification.narration.failed": "Tạo giọng đọc thất bại",
    "notification.render.completed": "Render video thành công",
    "notification.quota.low": "Hạn mức credit sắp hết",
    "notification.welcome": "Chào mừng đến với NarrativeX",
  };
  return map[key] ?? key;
}

function formatNotificationMessage(key: string): string {
  const map: Record<string, string> = {
    "notification.story_analyze.completed.desc": "Các Scene và Visual Beats đã được phân tích thành công.",
    "notification.narration.completed.desc": "Tệp âm thanh narration đã được lưu trữ bền vững trên Cloudflare R2.",
    "notification.welcome.desc": "Bắt đầu tạo câu chuyện hoặc nhập kịch bản đầu tiên của bạn.",
  };
  return map[key] ?? key;
}

function formatDate(isoString: string): string {
  try {
    const d = new Date(isoString);
    return new Intl.DateTimeFormat("vi-VN", {
      hour: "2-digit",
      minute: "2-digit",
      day: "2-digit",
      month: "2-digit",
      year: "numeric",
    }).format(d);
  } catch {
    return isoString;
  }
}
