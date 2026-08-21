"use client";

import React, { useState } from "react";
import { useStudioStore } from "@/store/useStudioStore";
import { Bell, HelpCircle, Plus } from "lucide-react";
import { Button } from "@/components/ui/Button";
import { useNotifications } from "@/features/notifications/hooks/useNotifications";
import { NotificationDrawer } from "@/features/notifications/components/NotificationDrawer";

interface StudioHeaderProps {
  title?: string;
  actions?: React.ReactNode;
}

export const StudioHeader: React.FC<StudioHeaderProps> = ({ title, actions }) => {
  const openWizard = useStudioStore((state) => state.openWizard);
  const { data: notificationsData } = useNotifications({ limit: 1, unreadOnly: true });
  const unreadCount = notificationsData?.unreadCount ?? 0;

  const [isNotificationDrawerOpen, setIsNotificationDrawerOpen] = useState(false);

  return (
    <header className="h-16 bg-background border-b border-border px-4 sm:px-6 flex items-center justify-between sticky top-0 z-30">
      <div className="flex min-w-0 items-center gap-4">
        {title && (
          <h1 className="truncate text-base sm:text-lg md:text-xl font-bold text-slate-100">
            {title}
          </h1>
        )}
      </div>

      <div className="flex items-center gap-2 sm:gap-3">
        {actions}

        {/* Nút Trợ giúp */}
        <button
          type="button"
          aria-label="Trợ giúp & Hướng dẫn"
          title="Trợ giúp & Hướng dẫn"
          className="flex h-10 w-10 items-center justify-center rounded-full border border-transparent text-slate-400 transition-colors hover:border-border hover:bg-surface-3 hover:text-slate-200 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary"
        >
          <HelpCircle className="h-5 w-5" />
        </button>

        {/* Nút Chuông Thông báo */}
        <button
          type="button"
          aria-label={`Thông báo (${unreadCount} chưa đọc)`}
          title="Trung tâm thông báo"
          onClick={() => setIsNotificationDrawerOpen(true)}
          className="relative flex h-10 w-10 items-center justify-center rounded-full border border-transparent text-slate-400 transition-colors hover:border-border hover:bg-surface-3 hover:text-slate-200 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary"
        >
          <Bell className="h-5 w-5" />
          {unreadCount > 0 && (
            <span
              className="absolute -top-0.5 -right-0.5 flex h-4 min-w-[16px] items-center justify-center rounded-full bg-primary px-1 text-[10px] font-bold text-white shadow-md ring-2 ring-background"
            >
              {unreadCount > 99 ? "99+" : unreadCount}
            </span>
          )}
        </button>

        {/* Nút Tạo dự án mới */}
        <Button
          onClick={() => openWizard(1)}
          variant="primary"
          size="sm"
          className="font-semibold inline-flex items-center"
          leftIcon={<Plus className="h-4 w-4 mr-1" />}
        >
          Dự án mới
        </Button>
      </div>

      <NotificationDrawer
        isOpen={isNotificationDrawerOpen}
        onClose={() => setIsNotificationDrawerOpen(false)}
      />
    </header>
  );
};
