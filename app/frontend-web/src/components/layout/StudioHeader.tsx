import React, { useState, useRef, useEffect } from "react";
import { useStudioStore } from "@/store/useStudioStore";
import { useAuthStore } from "@/store/useAuthStore";
import { ApiClientError, api } from "@/lib/api";
import { ChevronDown, Plus, LogOut, Settings, User } from "lucide-react";
import { Button } from "@/components/ui/Button";

interface StudioHeaderProps {
  title?: string;
  actions?: React.ReactNode;
}

export const StudioHeader: React.FC<StudioHeaderProps> = ({ title, actions }) => {
  const setScreen = useStudioStore((state) => state.setScreen);
  const openWizard = useStudioStore((state) => state.openWizard);
  const user = useAuthStore((state) => state.user);
  const clearSession = useAuthStore((state) => state.clearSession);
  const [isProfileMenuOpen, setIsProfileMenuOpen] = useState(false);
  const [isLoggingOut, setIsLoggingOut] = useState(false);
  const [logoutError, setLogoutError] = useState<string | null>(null);
  const menuRef = useRef<HTMLDivElement>(null);

  const displayName = user?.displayName || user?.email || "NarrativeX Creator";
  const email = user?.email || user?.id || "";
  const initials = displayName.slice(0, 1).toUpperCase();

  const handleLogout = async () => {
    setIsLoggingOut(true);
    setLogoutError(null);
    try {
      await api.logout();
      clearSession();
    } catch (error) {
      if (error instanceof ApiClientError && error.status === 401) {
        clearSession();
      } else {
        setLogoutError("Không thể đăng xuất. Vui lòng thử lại.");
        setIsProfileMenuOpen(true);
      }
    } finally {
      setIsLoggingOut(false);
    }
  };

  useEffect(() => {
    const handleClickOutside = (event: MouseEvent) => {
      if (menuRef.current && !menuRef.current.contains(event.target as Node)) {
        setIsProfileMenuOpen(false);
      }
    };
    document.addEventListener("mousedown", handleClickOutside);
    return () => document.removeEventListener("mousedown", handleClickOutside);
  }, []);

  return (
    <header className="h-16 bg-[#070b14]/90 backdrop-blur-md border-b border-slate-800/80 px-6 flex items-center justify-between sticky top-0 z-30">
      {/* Title / Breadcrumb Area */}
      <div className="flex items-center gap-4">
        {title && <h1 className="text-lg md:text-xl font-bold text-slate-100">{title}</h1>}
      </div>

      {/* Right Controls */}
      <div className="flex items-center gap-3">
        {actions}

        {/* Global New Project CTA Button */}
        <Button
          onClick={() => openWizard(1)}
          variant="primary"
          size="sm"
          className="shadow-[0_0_15px_rgba(124,58,237,0.35)] font-semibold hidden sm:inline-flex"
          leftIcon={<Plus className="w-3.5 h-3.5 mr-1" />}
        >
          Dự án mới
        </Button>

        {/* User Profile Menu */}
        <div className="relative pl-3 border-l border-slate-800" ref={menuRef}>
          <button
            type="button"
            onClick={() => setIsProfileMenuOpen(!isProfileMenuOpen)}
            className="flex items-center gap-2 p-1 rounded-lg hover:bg-slate-800/60 transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-purple-500"
          >
            <div className="w-8 h-8 rounded-full overflow-hidden border border-purple-500/40 ring-2 ring-purple-600/20 shrink-0">
              {user?.avatarUrl ? (
                <img src={user.avatarUrl} alt={displayName} className="w-full h-full object-cover" />
              ) : (
                <span className="w-full h-full flex items-center justify-center bg-purple-700 text-sm font-bold">{initials}</span>
              )}
            </div>
            <div className="text-left hidden md:block">
              <p className="text-xs font-semibold text-slate-200 leading-tight">
                {displayName}
              </p>
              <p className="text-[10px] text-purple-400 font-mono">Creator Pro</p>
            </div>
            <ChevronDown className="w-3.5 h-3.5 text-slate-400" />
          </button>

          {/* Profile Dropdown */}
          {isProfileMenuOpen && (
            <div className="absolute right-0 mt-2 w-48 rounded-xl bg-[#0d1420] border border-slate-800 shadow-2xl py-1 z-50 animate-in fade-in zoom-in-95 duration-150">
              <div className="px-3.5 py-2.5 border-b border-slate-800/80">
                <p className="text-xs font-bold text-white">{displayName}</p>
                <p className="text-[11px] text-slate-400 font-mono">{email}</p>
              </div>

              <div className="p-1 space-y-0.5">
                <button
                  type="button"
                  onClick={() => {
                    setIsProfileMenuOpen(false);
                    setScreen("overview");
                  }}
                  className="w-full text-left px-3 py-1.5 rounded-lg text-xs text-slate-300 hover:bg-slate-800 hover:text-white flex items-center gap-2 transition-colors"
                >
                  <User className="w-3.5 h-3.5 text-slate-400" />
                  <span>Tổng quan tài khoản</span>
                </button>

                <button
                  type="button"
                  onClick={() => {
                    setIsProfileMenuOpen(false);
                  }}
                  className="w-full text-left px-3 py-1.5 rounded-lg text-xs text-slate-300 hover:bg-slate-800 hover:text-white flex items-center gap-2 transition-colors"
                >
                  <Settings className="w-3.5 h-3.5 text-slate-400" />
                  <span>Cài đặt Studio</span>
                </button>

                <div className="border-t border-slate-800/80 my-1" />

                <button
                  type="button"
                  onClick={handleLogout}
                  disabled={isLoggingOut}
                  className="w-full text-left px-3 py-1.5 rounded-lg text-xs text-rose-400 hover:bg-rose-950/40 hover:text-rose-300 flex items-center gap-2 transition-colors font-medium"
                >
                  <LogOut className="w-3.5 h-3.5" />
                  <span>{isLoggingOut ? "Đang đăng xuất…" : "Đăng xuất"}</span>
                </button>
                {logoutError && <p className="px-3 py-1 text-[11px] text-rose-400">{logoutError}</p>}
              </div>
            </div>
          )}
        </div>
      </div>
    </header>
  );
};
