"use client";

import React, { useEffect, useRef, useState } from "react";
import { useRouter } from "next/navigation";
import { useStudioStore } from "@/store/useStudioStore";
import { useAuthStore } from "@/store/useAuthStore";
import { authApi } from "@/features/auth/api/auth.api";
import { useAuthSessionLifecycle } from "@/features/auth/hooks/useAuthSessionLifecycle";
import { ApiClientError } from "@/shared/api/client";
import { ChevronDown, LogOut, Plus, User } from "lucide-react";
import { Button } from "@/components/ui/Button";

interface StudioHeaderProps {
  title?: string;
  actions?: React.ReactNode;
}

export const StudioHeader: React.FC<StudioHeaderProps> = ({ title, actions }) => {
  const router = useRouter();
  const openWizard = useStudioStore((state) => state.openWizard);
  const user = useAuthStore((state) => state.user);
  const { clearAuthenticatedSession } = useAuthSessionLifecycle();
  const [isProfileMenuOpen, setIsProfileMenuOpen] = useState(false);
  const [isLoggingOut, setIsLoggingOut] = useState(false);
  const [logoutError, setLogoutError] = useState<string | null>(null);
  const menuRef = useRef<HTMLDivElement>(null);
  const menuButtonRef = useRef<HTMLButtonElement>(null);

  const displayName = user?.displayName || user?.email || "NarrativeX Creator";
  const email = user?.email || user?.id || "";
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
      if (menuRef.current && !menuRef.current.contains(event.target as Node)) {
        setIsProfileMenuOpen(false);
      }
    };
    const handleKeyDown = (event: KeyboardEvent) => {
      if (event.key === "Escape") {
        setIsProfileMenuOpen(false);
        menuButtonRef.current?.focus();
      }
    };
    document.addEventListener("mousedown", handleClickOutside);
    document.addEventListener("keydown", handleKeyDown);
    return () => {
      document.removeEventListener("mousedown", handleClickOutside);
      document.removeEventListener("keydown", handleKeyDown);
    };
  }, [isProfileMenuOpen]);

  return (
    <header className="h-16 bg-[#070b14]/90 backdrop-blur-md border-b border-slate-800/80 px-4 sm:px-6 flex items-center justify-between sticky top-0 z-30">
      <div className="flex min-w-0 items-center gap-4">
        {title && (
          <h1 className="truncate text-base sm:text-lg md:text-xl font-bold text-slate-100">
            {title}
          </h1>
        )}
      </div>

      <div className="flex items-center gap-3">
        {actions}
        <Button
          onClick={() => openWizard(1)}
          variant="primary"
          size="sm"
          className="font-semibold hidden sm:inline-flex"
          leftIcon={<Plus className="w-3.5 h-3.5 mr-1" />}
        >
          Dự án mới
        </Button>

        <div className="relative pl-3 border-l border-slate-800" ref={menuRef}>
          <button
            ref={menuButtonRef}
            type="button"
            onClick={() => setIsProfileMenuOpen((open) => !open)}
            aria-expanded={isProfileMenuOpen}
            aria-haspopup="menu"
            aria-label={`Mở menu tài khoản của ${displayName}`}
            className="flex items-center gap-2 p-1 rounded-lg hover:bg-slate-800/60 transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-purple-500"
          >
            <div className="w-8 h-8 rounded-full overflow-hidden border border-purple-500/40 ring-2 ring-purple-600/20 shrink-0">
              {user?.avatarUrl ? (
                <img src={user.avatarUrl} alt="" className="w-full h-full object-cover" />
              ) : (
                <span className="w-full h-full flex items-center justify-center bg-purple-700 text-sm font-bold">
                  {initials}
                </span>
              )}
            </div>
            <div className="text-left hidden md:block">
              <p className="text-xs font-semibold text-slate-200 leading-tight">{displayName}</p>
              {email && (
                <p className="max-w-40 truncate text-[10px] text-slate-400 font-mono">
                  {email}
                </p>
              )}
            </div>
            <ChevronDown className="w-3.5 h-3.5 text-slate-400" />
          </button>

          {isProfileMenuOpen && (
            <div
              role="menu"
              className="absolute right-0 mt-2 w-52 rounded-xl bg-[#0d1420] border border-slate-800 shadow-2xl py-1 z-50"
            >
              <div className="px-3.5 py-2.5 border-b border-slate-800/80">
                <p className="text-xs font-bold text-white">{displayName}</p>
                {email && (
                  <p className="truncate text-[11px] text-slate-400 font-mono">{email}</p>
                )}
              </div>
              <div className="p-1 space-y-0.5">
                <button
                  type="button"
                  role="menuitem"
                  onClick={() => {
                    setIsProfileMenuOpen(false);
                    router.push("/");
                  }}
                  className="w-full text-left px-3 py-1.5 rounded-lg text-xs text-slate-300 hover:bg-slate-800 hover:text-white flex items-center gap-2 transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-purple-500"
                >
                  <User className="w-3.5 h-3.5 text-slate-400" />
                  <span>Tổng quan Studio</span>
                </button>
                <div className="border-t border-slate-800/80 my-1" />
                <button
                  type="button"
                  role="menuitem"
                  onClick={handleLogout}
                  disabled={isLoggingOut}
                  className="w-full text-left px-3 py-1.5 rounded-lg text-xs text-rose-400 hover:bg-rose-950/40 hover:text-rose-300 flex items-center gap-2 transition-colors font-medium disabled:cursor-wait disabled:opacity-60 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-rose-500"
                >
                  <LogOut className="w-3.5 h-3.5" />
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
      </div>
    </header>
  );
};
