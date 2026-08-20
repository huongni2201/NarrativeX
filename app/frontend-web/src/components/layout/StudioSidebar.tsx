/* eslint-disable @next/next/no-img-element -- User avatar URLs are backend/CDN-owned runtime values. */
"use client";

import { useState } from "react";
import Link from "next/link";
import Image from "next/image";
import { usePathname } from "next/navigation";
import {
  LayoutDashboard,
  FolderKanban,
  Users,
  Image as ImageIcon,
  Palette,
  History,
  Bell,
  Settings,
  Sparkles,
  Zap,
} from "lucide-react";
import { cn } from "@/lib/utils";
import { useAuthStore } from "@/store/useAuthStore";
import { useUserQuota } from "@/features/account/hooks/useUserQuota";
import { useNotifications } from "@/features/notifications/hooks/useNotifications";
import { NotificationDrawer } from "@/features/notifications/components/NotificationDrawer";
import { QuotaDetailModal } from "@/features/account/components/QuotaDetailModal";
import { ProviderHealthIndicator } from "@/features/health/components/ProviderHealthIndicator";

export const StudioSidebar = () => {
  const pathname = usePathname();
  const user = useAuthStore((state) => state.user);
  const { data: quota, isLoading: isQuotaLoading, isError: isQuotaError } = useUserQuota();
  const { data: notificationsData } = useNotifications({ limit: 1, unreadOnly: true });
  const unreadCount = notificationsData?.unreadCount ?? 0;

  const [isNotificationDrawerOpen, setIsNotificationDrawerOpen] = useState(false);
  const [isQuotaModalOpen, setIsQuotaModalOpen] = useState(false);

  const projectMatch = pathname.match(/^\/projects\/(\d+)/);
  const activeProjectId = projectMatch?.[1];

  const displayName = user?.displayName?.trim() || user?.email || "Người dùng";
  const secondaryIdentity = user?.displayName?.trim() ? user.email : null;
  const initials = displayName.slice(0, 1).toUpperCase();

  const totalCredits = quota ? Number(quota.totalCredits) || 0 : 0;
  const remainingCredits = quota ? Number(quota.remainingCredits) || 0 : 0;
  const creditPercent =
    totalCredits > 0
      ? Math.max(0, Math.min(100, Math.round((remainingCredits / totalCredits) * 100)))
      : 0;

  const navItems = [
    {
      id: "overview",
      label: "Tổng quan",
      icon: LayoutDashboard,
      href: "/projects",
      active: pathname === "/" || pathname === "/dashboard",
    },
    {
      id: "projects",
      label: "Dự án của tôi",
      icon: FolderKanban,
      href: "/projects",
      active:
        pathname === "/projects" ||
        (Boolean(activeProjectId) && pathname === `/projects/${activeProjectId}`),
    },
    {
      id: "characters",
      label: "Thư viện nhân vật",
      icon: Users,
      href: "/characters",
      active: pathname === "/characters" || pathname.startsWith("/characters/"),
    },
    {
      id: "assets",
      label: "Thư viện tài sản",
      icon: ImageIcon,
      href: "/assets",
      active: pathname === "/assets" || pathname.startsWith("/assets/"),
    },
    {
      id: "templates",
      label: "Mẫu & Phong cách",
      icon: Palette,
      href: "/presets",
      active: pathname === "/presets" || pathname.startsWith("/presets/"),
    },
    {
      id: "history",
      label: "Lịch sử công việc",
      icon: History,
      href: "/history",
      active: pathname === "/history" || pathname.startsWith("/history/"),
    },
    {
      id: "notifications",
      label: "Thông báo",
      icon: Bell,
      href: "/notifications",
      active: pathname === "/notifications" || pathname.startsWith("/notifications/"),
      badge: unreadCount > 0 ? unreadCount : undefined,
      onOpenDrawer: () => setIsNotificationDrawerOpen(true),
    },
    {
      id: "settings",
      label: "Cài đặt",
      icon: Settings,
      href: "#",
      disabled: true,
      tooltip: "Cài đặt hệ thống đang được phát triển",
    },
  ];

  return (
    <aside className="w-64 bg-[#090e17] border-r border-slate-800/80 flex flex-col justify-between shrink-0 h-screen sticky top-0 select-none z-20 overflow-y-auto">
      <div>
        <div className="p-4 px-5 border-b border-slate-800/60 flex items-center justify-between">
          <Link
            href="/projects"
            className="flex items-center gap-3 cursor-pointer group py-0.5"
            aria-label="Về danh sách dự án NarrativeX"
          >
            <div className="relative w-9 h-9 shrink-0 flex items-center justify-center">
              <Image
                src="/branding/narrativex-icon.png"
                alt="NarrativeX Logo"
                width={36}
                height={36}
                className="w-9 h-9 object-contain drop-shadow-[0_0_12px_rgba(124,58,237,0.5)] transition-transform duration-200 group-hover:scale-105"
                priority
              />
            </div>
            <div>
              <span className="text-[17px] font-extrabold tracking-tight text-white flex items-center gap-1 leading-tight">
                Narrative<span className="text-purple-400">X</span>
              </span>
              <span className="text-xs block font-medium text-slate-400 mt-0.5 tracking-wider uppercase">
                AI Story Video Studio
              </span>
            </div>
          </Link>
        </div>

        <div className="p-3.5 mx-3 mt-3 rounded-xl bg-[#0d1420]/80 border border-slate-800/80 flex items-center gap-3">
          <div className="w-10 h-10 rounded-full overflow-hidden border border-purple-500/40 ring-2 ring-purple-600/20 shrink-0 bg-slate-900">
            {user?.avatarUrl ? (
              <img src={user.avatarUrl} alt={displayName} className="w-full h-full object-cover" />
            ) : (
              <span className="w-full h-full flex items-center justify-center bg-purple-700 text-sm font-bold text-white">
                {initials}
              </span>
            )}
          </div>
          <div className="min-w-0 flex-1">
            <p className="text-sm font-semibold text-slate-100 truncate">{displayName}</p>
            {secondaryIdentity && (
              <p className="mt-0.5 truncate text-xs text-slate-400">{secondaryIdentity}</p>
            )}
          </div>
        </div>

        <nav className="p-3 space-y-1.5" aria-label="Điều hướng studio">
          {navItems.map((item) => {
            const Icon = item.icon;

            if (item.disabled) {
              return (
                <button
                  key={item.id}
                  type="button"
                  disabled
                  title={item.tooltip}
                  className="w-full flex items-center gap-3 px-3.5 py-2.5 rounded-lg text-sm font-medium text-slate-400 transition-colors opacity-80 cursor-not-allowed group text-left"
                >
                  <Icon className="w-5 h-5 text-slate-400 shrink-0" />
                  <span className="flex-1">{item.label}</span>
                </button>
              );
            }

            return (
              <div key={item.id} className="relative">
                <Link
                  href={item.href}
                  onClick={(e) => {
                    if (item.onOpenDrawer) {
                      e.preventDefault();
                      item.onOpenDrawer();
                    }
                  }}
                  aria-current={item.active ? "page" : undefined}
                  className={cn(
                    "w-full flex items-center justify-between px-3.5 py-2.5 rounded-lg text-sm font-medium transition-colors duration-150 text-left focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-purple-500",
                    item.active
                      ? "bg-purple-900/40 text-purple-200 border border-purple-800/60 font-semibold shadow-sm"
                      : "text-slate-300 hover:text-white hover:bg-slate-800/40",
                  )}
                >
                  <div className="flex items-center gap-3 min-w-0">
                    <Icon
                      className={cn("w-5 h-5 shrink-0", item.active ? "text-purple-400" : "text-slate-400")}
                    />
                    <span className="truncate">{item.label}</span>
                  </div>

                  {item.badge !== undefined && item.badge > 0 && (
                    <span className="ml-2 rounded-full bg-purple-600 px-2 py-0.5 text-[10px] font-bold text-white shadow-sm animate-pulse">
                      {item.badge}
                    </span>
                  )}
                </Link>
              </div>
            );
          })}
        </nav>
      </div>

      <div className="space-y-3">
        <div className="p-3.5 mx-3 rounded-2xl bg-[#0d1420] border border-slate-800 space-y-3">
          {isQuotaLoading ? (
            <div className="space-y-2.5 animate-pulse py-1">
              <div className="flex justify-between items-center">
                <div className="h-3 w-20 bg-slate-800 rounded" />
                <div className="h-4 w-12 bg-slate-800 rounded-full" />
              </div>
              <div className="h-2.5 w-full bg-slate-800 rounded" />
              <div className="h-1.5 w-full bg-slate-800 rounded-full" />
              <div className="h-8 w-full bg-slate-800/60 rounded-lg mt-2" />
            </div>
          ) : quota ? (
            <>
              <div className="flex items-center justify-between gap-2">
                <div className="flex items-center gap-1.5 min-w-0">
                  <Zap className="w-3.5 h-3.5 text-purple-400 shrink-0" />
                  <span className="text-xs font-semibold text-slate-200 uppercase tracking-wider truncate">
                    Usage / Quota
                  </span>
                </div>
                <button
                  type="button"
                  onClick={() => setIsQuotaModalOpen(true)}
                  className="shrink-0 rounded-full border border-purple-500/30 bg-purple-950/40 px-2 py-0.5 text-[10px] font-bold tracking-wide text-purple-300 uppercase hover:bg-purple-900/60 transition-colors"
                  title="Xem chi tiết hạn mức"
                >
                  {quota.tier || "Free"}
                </button>
              </div>

              <div className="space-y-1.5">
                <div className="flex items-center justify-between text-xs">
                  <span className="text-slate-400">Credits khả dụng</span>
                  <span className="font-semibold text-slate-200">
                    {remainingCredits.toLocaleString()}{" "}
                    <span className="text-slate-500 font-normal">/ {totalCredits.toLocaleString()}</span>
                  </span>
                </div>
                <div className="w-full bg-slate-800/80 rounded-full h-1.5 overflow-hidden">
                  <div
                    className="bg-gradient-to-r from-purple-500 to-indigo-500 h-full rounded-full transition-all duration-300"
                    style={{ width: `${creditPercent}%` }}
                  />
                </div>
              </div>

              <button
                type="button"
                onClick={() => setIsQuotaModalOpen(true)}
                className="w-full rounded-lg border border-slate-800 bg-slate-900/80 px-3 py-2 text-xs font-semibold text-purple-300 hover:bg-slate-800 hover:text-white flex items-center justify-center gap-1.5 transition-colors"
              >
                <Sparkles className="w-3.5 h-3.5 text-purple-400" />
                <span>Chi tiết hạn mức & gói</span>
              </button>
            </>
          ) : (
            <>
              <div className="flex items-center justify-between gap-3">
                <span className="text-xs font-semibold text-slate-300 uppercase tracking-wider">
                  Usage / Quota
                </span>
                <span className="rounded-full border border-slate-700 bg-slate-900 px-2 py-0.5 text-[10px] font-semibold uppercase tracking-wide text-slate-400">
                  {isQuotaError ? "Lỗi tải" : "Free"}
                </span>
              </div>

              <p className="text-xs leading-5 text-slate-400">
                {isQuotaError
                  ? "Không thể tải thông tin hạn mức lúc này."
                  : "Đăng nhập để xem hạn mức và số credits khả dụng."}
              </p>
            </>
          )}
        </div>

        {/* Footer info & Health Indicator */}
        <div className="px-5 pb-4 flex items-center justify-between">
          <ProviderHealthIndicator />
          <span className="text-[10px] text-slate-500 font-mono">v1.10</span>
        </div>
      </div>

      {/* Modals & Drawers */}
      <NotificationDrawer
        isOpen={isNotificationDrawerOpen}
        onClose={() => setIsNotificationDrawerOpen(false)}
      />

      <QuotaDetailModal
        isOpen={isQuotaModalOpen}
        onClose={() => setIsQuotaModalOpen(false)}
      />
    </aside>
  );
};
