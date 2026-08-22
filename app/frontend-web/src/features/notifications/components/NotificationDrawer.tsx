"use client";

import { useState } from "react";
import Link from "next/link";
import {
  Bell,
  CheckCheck,
  X,
  Sparkles,
  AlertTriangle,
  Info,
  CheckCircle2,
  ExternalLink,
} from "lucide-react";
import {
  useNotifications,
  useMarkNotificationRead,
  useMarkAllNotificationsRead,
} from "../hooks/useNotifications";
import type { NotificationItem } from "../types/notifications.types";
import { Drawer } from "@/components/ui/Drawer";
import { LoadingState } from "@/components/ui/LoadingState";

interface NotificationDrawerProps {
  isOpen: boolean;
  onClose: () => void;
}

export function NotificationDrawer({ isOpen, onClose }: Readonly<NotificationDrawerProps>) {
  const [unreadOnly, setUnreadOnly] = useState(false);
  const { data, isLoading } = useNotifications({ limit: 50, unreadOnly });
  const markReadMutation = useMarkNotificationRead();
  const markAllReadMutation = useMarkAllNotificationsRead();

  if (!isOpen) return null;

  const items = data?.items ?? [];
  const unreadCount = data?.unreadCount ?? 0;

  return (
    <Drawer isOpen={isOpen} onClose={onClose} ariaLabel="Trung tâm thông báo">
        {/* Header */}
        <div className="flex items-center justify-between border-b border-border p-4 sm:p-5">
          <div className="flex items-center gap-2.5">
            <div className="flex h-9 w-9 items-center justify-center rounded-xl bg-primary-muted text-primary">
              <Bell className="h-4 w-4" />
            </div>
            <div>
              <h2 className="text-base font-bold text-text-primary">Thông báo</h2>
              <p className="text-xs text-text-secondary">
                {unreadCount > 0 ? `Bạn có ${unreadCount} thông báo chưa đọc` : "Không có thông báo mới"}
              </p>
            </div>
          </div>

          <button
            type="button"
            onClick={onClose}
            className="rounded-lg p-1.5 text-text-muted transition-colors hover:bg-surface-2 hover:text-text-primary focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary"
            aria-label="Đóng bảng thông báo"
          >
            <X className="h-5 w-5" />
          </button>
        </div>

        {/* Filter & Actions Bar */}
        <div className="flex items-center justify-between border-b border-border/80 bg-surface-panel px-4 py-2.5">
          <div className="flex items-center gap-1 rounded-lg border border-border bg-surface-card p-0.5 text-xs">
            <button
              type="button"
              onClick={() => setUnreadOnly(false)}
              className={`rounded-md px-2.5 py-1 font-medium transition-colors ${
                !unreadOnly ? "bg-primary text-white" : "text-text-secondary hover:text-text-primary"
              }`}
            >
              Tất cả
            </button>
            <button
              type="button"
              onClick={() => setUnreadOnly(true)}
              className={`rounded-md px-2.5 py-1 font-medium transition-colors ${
                unreadOnly ? "bg-primary text-white" : "text-text-secondary hover:text-text-primary"
              }`}
            >
              Chưa đọc {unreadCount > 0 && `(${unreadCount})`}
            </button>
          </div>

          {unreadCount > 0 && (
            <button
              type="button"
              onClick={() => markAllReadMutation.mutate()}
              disabled={markAllReadMutation.isPending}
              className="inline-flex items-center gap-1.5 text-xs font-medium text-primary-hover hover:underline disabled:opacity-50"
            >
              <CheckCheck className="h-3.5 w-3.5" />
              Đọc tất cả
            </button>
          )}
        </div>

        {/* Items List */}
        <div className="flex-1 overflow-y-auto p-4 space-y-2.5">
          {isLoading && items.length === 0 ? (
            <LoadingState message="Đang tải thông báo…" className="h-40 flex-col text-xs text-text-muted" />
          ) : items.length === 0 ? (
            <div className="flex h-48 flex-col items-center justify-center gap-2 text-center text-text-muted">
              <Bell className="h-8 w-8 opacity-30" />
              <p className="text-xs font-medium text-text-secondary">
                {unreadOnly ? "Không có thông báo chưa đọc" : "Chưa có thông báo nào"}
              </p>
            </div>
          ) : (
            items.map((item) => (
              <NotificationCard
                key={item.id}
                item={item}
                onMarkRead={() => markReadMutation.mutate(item.id)}
              />
            ))
          )}
        </div>
    </Drawer>
  );
}

function NotificationCard({
  item,
  onMarkRead,
}: {
  item: NotificationItem;
  onMarkRead: () => void;
}) {
  const isUnread = !item.readAt;

  return (
    <div
      className={`group relative flex gap-3 rounded-xl border p-3.5 transition-colors ${
        isUnread
          ? "border-primary/40 bg-primary-muted/20"
          : "border-border bg-surface-2/40 hover:bg-surface-2/70"
      }`}
    >
      <div className="mt-0.5 shrink-0">
        <NotificationIcon type={item.type} />
      </div>

      <div className="min-w-0 flex-1">
        <div className="flex items-start justify-between gap-2">
          <h4
            className={`text-xs font-semibold ${
              isUnread ? "text-text-primary" : "text-text-secondary"
            }`}
          >
            {formatNotificationTitle(item.titleKey)}
          </h4>
          {isUnread && (
            <button
              type="button"
              onClick={onMarkRead}
              className="shrink-0 text-[10px] text-primary-hover hover:underline"
              title="Đánh dấu đã đọc"
            >
              Đã đọc
            </button>
          )}
        </div>

        <p className="mt-1 text-xs text-text-secondary leading-relaxed">
          {formatNotificationMessage(item.messageKey)}
        </p>

        <div className="mt-2.5 flex items-center justify-between text-[10px] text-text-muted">
          <span>{formatTimeAgo(item.createdAt)}</span>

          {item.projectId && (
            <Link
              href={`/projects/${item.projectId}`}
              className="inline-flex items-center gap-1 text-primary-hover hover:underline"
            >
              Xem dự án
              <ExternalLink className="h-2.5 w-2.5" />
            </Link>
          )}
        </div>
      </div>
    </div>
  );
}

function NotificationIcon({ type }: { type: string }) {
  if (type.includes("COMPLETED") || type.includes("SUCCESS")) {
    return (
      <div className="flex h-7 w-7 items-center justify-center rounded-lg bg-success-bg text-success">
        <CheckCircle2 className="h-3.5 w-3.5" />
      </div>
    );
  }
  if (type.includes("FAILED") || type.includes("ERROR")) {
    return (
      <div className="flex h-7 w-7 items-center justify-center rounded-lg bg-danger-bg text-danger">
        <AlertTriangle className="h-3.5 w-3.5" />
      </div>
    );
  }
  if (type.includes("AI") || type.includes("GENERATE") || type.includes("ANALYZE")) {
    return (
      <div className="flex h-7 w-7 items-center justify-center rounded-lg bg-primary-muted text-primary">
        <Sparkles className="h-3.5 w-3.5" />
      </div>
    );
  }
  return (
    <div className="flex h-7 w-7 items-center justify-center rounded-lg bg-surface-3 text-text-secondary">
      <Info className="h-3.5 w-3.5" />
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

function formatTimeAgo(isoString: string): string {
  try {
    const diffMs = Date.now() - new Date(isoString).getTime();
    const mins = Math.floor(diffMs / 60000);
    if (mins < 1) return "Vừa xong";
    if (mins < 60) return `${mins} phút trước`;
    const hours = Math.floor(mins / 60);
    if (hours < 24) return `${hours} giờ trước`;
    const days = Math.floor(hours / 24);
    return `${days} ngày trước`;
  } catch {
    return isoString;
  }
}
