/* eslint-disable @next/next/no-img-element -- User avatar URLs are backend/CDN-owned runtime values. */
"use client";

import { useEffect, useRef, useState } from "react";
import Link from "next/link";
import Image from "next/image";
import { usePathname, useRouter } from "next/navigation";
import {
  LayoutDashboard,
  FolderKanban,
  Users,
  Image as ImageIcon,
  Palette,
  History,
  Settings,
  Zap,
  ChevronDown,
  LogOut,
  User,
  Crown,
} from "lucide-react";
import { cn } from "@/lib/utils";
import { useAuthStore } from "@/store/useAuthStore";
import { authApi } from "@/features/auth/api/auth.api";
import { useAuthSessionLifecycle } from "@/features/auth/hooks/useAuthSessionLifecycle";
import { ApiClientError } from "@/shared/api/client";
import { useUserQuota } from "@/features/account/hooks/useUserQuota";
import { QuotaDetailModal } from "@/features/account/components/QuotaDetailModal";

export const StudioSidebar = () => {
  const pathname = usePathname();
  const router = useRouter();
  const user = useAuthStore((state) => state.user);
  const { clearAuthenticatedSession } = useAuthSessionLifecycle();
  const { data: quota, isLoading: isQuotaLoading, isError: isQuotaError } = useUserQuota();

  const [isQuotaModalOpen, setIsQuotaModalOpen] = useState(false);
  const [isProfileMenuOpen, setIsProfileMenuOpen] = useState(false);
  const [isLoggingOut, setIsLoggingOut] = useState(false);
  const [logoutError, setLogoutError] = useState<string | null>(null);
  const profileMenuRef = useRef<HTMLDivElement>(null);
  const profileButtonRef = useRef<HTMLButtonElement>(null);

  const projectMatch = pathname.match(/^\/projects\/(\d+)/);
  const activeProjectId = projectMatch?.[1];

  const displayName = user?.displayName?.trim() || user?.email || "Người dùng";
  const secondaryIdentity = user?.displayName?.trim() ? user.email : null;
  const initials = displayName.slice(0, 1).toUpperCase();

  const handleLogout = async () => {
    setIsLoggingOut(true);
    setLogoutError(null);
    try {
      await authApi.logout();
      clearAuthenticatedSession();
    } catch (error) {
      if (error instanceof ApiClientError && error.status === 401) {
        clearAuthenticatedSession();
      } else {
        setLogoutError("Không thể đăng xuất. Vui lòng thử lại.");
        setIsProfileMenuOpen(true);
      }
    } finally {
      setIsLoggingOut(false);
    }
  };

  useEffect(() => {
    if (!isProfileMenuOpen) return;
    const handleClickOutside = (event: MouseEvent) => {
      if (profileMenuRef.current && !profileMenuRef.current.contains(event.target as Node)) {
        setIsProfileMenuOpen(false);
      }
    };
    const handleKeyDown = (event: KeyboardEvent) => {
      if (event.key === "Escape") {
        setIsProfileMenuOpen(false);
        profileButtonRef.current?.focus();
      }
    };
    document.addEventListener("mousedown", handleClickOutside);
    document.addEventListener("keydown", handleKeyDown);
    return () => {
      document.removeEventListener("mousedown", handleClickOutside);
      document.removeEventListener("keydown", handleKeyDown);
    };
  }, [isProfileMenuOpen]);

  const isUnlimited = quota ? quota.totalCredits === null || quota.tier === "ULTRA" : false;
  const totalCredits = quota && quota.totalCredits !== null ? Number(quota.totalCredits) || 0 : 0;
  const remainingCredits = quota && quota.remainingCredits !== null ? Number(quota.remainingCredits) || 0 : 0;
  const creditsUsed = quota ? Number(quota.usage.creditsUsed) || 0 : 0;
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
      id: "settings",
      label: "Cài đặt",
      icon: Settings,
      href: "#",
      disabled: true,
      tooltip: "Cài đặt hệ thống đang được phát triển",
    },
  ];

  return (
    <aside className="w-64 bg-surface-panel border-r border-border flex flex-col justify-between shrink-0 h-dvh sticky top-0 select-none z-20 overflow-y-auto">
      <div>
        <div className="p-4 px-5 border-b border-slate-800/60 flex items-center justify-between">
          <Link
            href="/projects"
            className="flex items-center gap-3 cursor-pointer group py-0.5"
            aria-label="Về danh sách dự án NarrativeX"
          >
            <div className="relative w-9 h-9 shrink-0 flex items-center justify-center">
              <Image
                src="/branding/narrativex-icon-orange-v2.png"
                alt="NarrativeX Logo"
                width={36}
                height={36}
                className="w-9 h-9 object-contain transition-transform duration-200 group-hover:scale-105"
                priority
              />
            </div>
            <div>
              <span className="text-[17px] font-extrabold tracking-tight text-white flex items-center gap-1 leading-tight">
                Narrative<span className="text-primary-hover">X</span>
              </span>
              <span className="text-xs block font-medium text-slate-400 mt-0.5 tracking-wider uppercase">
                AI Story Video Studio
              </span>
            </div>
          </Link>
        </div>

        {/* Profile / Account Dropdown Trigger */}
        <div className="relative mx-3 mt-3" ref={profileMenuRef}>
          <button
            ref={profileButtonRef}
            type="button"
            onClick={() => setIsProfileMenuOpen((open) => !open)}
            aria-expanded={isProfileMenuOpen}
            aria-haspopup="menu"
            aria-label={`Mở menu tài khoản của ${displayName}`}
            className="w-full p-2.5 rounded-xl bg-surface border border-border flex items-center gap-3 hover:bg-surface-3 hover:border-slate-700 transition-all text-left group focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary"
          >
            <div className="w-9 h-9 rounded-full overflow-hidden border border-primary/40 ring-2 ring-primary/20 shrink-0 bg-slate-900 flex items-center justify-center">
              {user?.avatarUrl ? (
                <img src={user.avatarUrl} alt="" className="w-full h-full object-cover" />
              ) : (
                <span className="w-full h-full flex items-center justify-center bg-primary text-xs font-bold text-white">
                  {initials}
                </span>
              )}
            </div>
            <div className="min-w-0 flex-1">
              <p className="text-sm font-semibold text-slate-100 truncate group-hover:text-white transition-colors">
                {displayName}
              </p>
              {secondaryIdentity && (
                <p className="mt-0.5 truncate text-[11px] text-slate-400 font-mono">
                  {secondaryIdentity}
                </p>
              )}
            </div>
            <ChevronDown
              className={cn(
                "w-4 h-4 text-slate-400 transition-transform duration-200 shrink-0",
                isProfileMenuOpen && "rotate-180 text-primary-light"
              )}
            />
          </button>

          {isProfileMenuOpen && (
            <div
              role="menu"
              className="absolute left-0 right-0 top-full mt-1.5 rounded-xl bg-surface border border-border shadow-2xl py-1 z-50 animate-in fade-in zoom-in-95 duration-100"
            >
              <div className="px-3.5 py-2.5 border-b border-slate-800/80">
                <p className="text-xs font-bold text-white truncate">{displayName}</p>
                {secondaryIdentity && (
                  <p className="truncate text-[11px] text-slate-400 font-mono mt-0.5">
                    {secondaryIdentity}
                  </p>
                )}
              </div>

              <div className="p-1 space-y-0.5">
                <button
                  type="button"
                  role="menuitem"
                  onClick={() => {
                    setIsProfileMenuOpen(false);
                    router.push("/projects");
                  }}
                  className="w-full text-left px-3 py-2 rounded-lg text-xs text-slate-300 hover:bg-surface-3 hover:text-white flex items-center gap-2.5 transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary"
                >
                  <User className="w-4 h-4 text-slate-400" />
                  <span>Tổng quan Studio</span>
                </button>

                <div className="border-t border-slate-800/80 my-1" />

                <button
                  type="button"
                  role="menuitem"
                  onClick={handleLogout}
                  disabled={isLoggingOut}
                  className="w-full text-left px-3 py-2 rounded-lg text-xs text-rose-400 hover:bg-rose-950/40 hover:text-rose-300 flex items-center gap-2.5 transition-colors font-medium disabled:cursor-wait disabled:opacity-60 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-rose-500"
                >
                  <LogOut className="w-4 h-4" />
                  <span>{isLoggingOut ? "Đang đăng xuất…" : "Đăng xuất"}</span>
                </button>

                {logoutError && (
                  <p role="alert" className="px-3 py-1 text-[11px] text-rose-400">
                    {logoutError}
                  </p>
                )}
              </div>
            </div>
          )}
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
                  aria-current={item.active ? "page" : undefined}
                  className={cn(
                    "w-full flex items-center justify-between px-3.5 py-2.5 rounded-lg text-sm font-medium transition-colors duration-150 text-left focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary",
                    item.active
                      ? "border-l-2 border-primary bg-primary-muted/70 pl-3 text-primary-light font-semibold"
                      : "text-slate-300 hover:text-white hover:bg-slate-800/40",
                  )}
                >
                  <div className="flex items-center gap-3 min-w-0">
                    <Icon
                      className={cn("w-5 h-5 shrink-0", item.active ? "text-primary-hover" : "text-slate-400")}
                    />
                    <span className="truncate">{item.label}</span>
                  </div>
                </Link>
              </div>
            );
          })}
        </nav>
      </div>

      <div className="pb-3">
        <div className="p-3.5 mx-3 rounded-xl bg-surface border border-border space-y-3">
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
                  <Zap className="w-3.5 h-3.5 text-primary-hover shrink-0" />
                  <span className="text-xs font-semibold text-slate-200 uppercase tracking-wider truncate">
                    LIMIT / QUOTA
                  </span>
                </div>
                <button
                  type="button"
                  onClick={() => setIsQuotaModalOpen(true)}
                  className="shrink-0 rounded-full border border-primary/40 bg-primary-muted px-2 py-0.5 text-[10px] font-bold tracking-wide text-primary-hover uppercase hover:bg-primary-muted transition-colors"
                  title="Xem chi tiết hạn mức"
                >
                  {quota.tier || "Miễn phí"}
                </button>
              </div>

              <div className="space-y-1.5">
                <div className="flex items-center justify-between text-xs">
                  <span className="text-slate-400">{isUnlimited ? "Credits đã dùng" : "Credits khả dụng"}</span>
                  <span className="font-semibold text-slate-200 tabular-nums">
                    {isUnlimited ? (
                      <span>{creditsUsed.toLocaleString()} <span className="text-emerald-400 font-normal">/ ∞</span></span>
                    ) : (
                      <>
                        {remainingCredits.toLocaleString()}{" "}
                        <span className="text-slate-500 font-normal">/ {totalCredits.toLocaleString()}</span>
                      </>
                    )}
                  </span>
                </div>
                <div className="w-full bg-slate-800/80 rounded-full h-1.5 overflow-hidden">
                  <div
                    className={cn(
                      "h-full rounded-full transition-[width] duration-300",
                      isUnlimited
                        ? "w-full bg-gradient-to-r from-primary via-orange-500 to-emerald-400"
                        : "bg-primary",
                    )}
                    style={isUnlimited ? undefined : { width: `${creditPercent}%` }}
                  />
                </div>
              </div>

              <button
                type="button"
                onClick={() => setIsQuotaModalOpen(true)}
                className="w-full rounded-lg bg-gradient-to-r from-primary to-orange-500 px-3 py-2 text-xs font-bold text-white shadow-sm shadow-primary/20 hover:from-primary-hover hover:to-orange-600 flex items-center justify-center gap-1.5 transition-all active:scale-[0.98]"
              >
                <Crown className="w-3.5 h-3.5 shrink-0" />
                <span>Nâng cấp</span>
              </button>
            </>
          ) : (
            <>
              <div className="flex items-center justify-between gap-3">
                <span className="text-xs font-semibold text-slate-300 uppercase tracking-wider">
                  Sử dụng / Hạn mức
                </span>
                <span className="rounded-full border border-slate-700 bg-slate-900 px-2 py-0.5 text-[10px] font-semibold uppercase tracking-wide text-slate-400">
                  {isQuotaError ? "Lỗi tải" : "Miễn phí"}
                </span>
              </div>

              <p className="text-xs leading-5 text-slate-400">
                {isQuotaError
                  ? "Không thể tải thông tin hạn mức lúc này."
                  : "Đăng nhập để xem hạn mức và số credits khả dụng."}
              </p>

              <button
                type="button"
                onClick={() => setIsQuotaModalOpen(true)}
                className="w-full rounded-lg bg-gradient-to-r from-primary to-orange-500 px-3 py-2 text-xs font-bold text-white shadow-sm shadow-primary/20 hover:from-primary-hover hover:to-orange-600 flex items-center justify-center gap-1.5 transition-all active:scale-[0.98]"
              >
                <Crown className="w-3.5 h-3.5 shrink-0" />
                <span>Nâng cấp</span>
              </button>
            </>
          )}
        </div>
      </div>

      {/* Modals & Drawers */}
      <QuotaDetailModal
        isOpen={isQuotaModalOpen}
        onClose={() => setIsQuotaModalOpen(false)}
      />
    </aside>
  );
};
