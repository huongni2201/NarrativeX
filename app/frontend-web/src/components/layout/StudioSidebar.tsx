"use client";

import Link from "next/link";
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
} from "lucide-react";
import { cn } from "@/lib/utils";
import { useAuthStore } from "@/store/useAuthStore";

export const StudioSidebar = () => {
  const pathname = usePathname();
  const user = useAuthStore((state) => state.user);

  const displayName = user?.displayName || "Ngọc Bùi";
  const initials = displayName.slice(0, 1).toUpperCase();

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
      active: pathname === "/projects" || pathname.startsWith("/projects/"),
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
      href: "#",
      disabled: true,
      tooltip: "Lịch sử công việc đang chờ API backend",
    },
    {
      id: "notifications",
      label: "Thông báo",
      icon: Bell,
      href: "#",
      badge: "3",
      disabled: true,
      tooltip: "Hệ thống thông báo đang chờ API backend",
    },
    {
      id: "settings",
      label: "Cài đặt",
      icon: Settings,
      href: "#",
      disabled: true,
      tooltip: "Cài đặt hệ thống đang chờ API backend",
    },
  ];

  return (
    <aside className="w-64 bg-[#090e17] border-r border-slate-800/80 flex flex-col justify-between shrink-0 h-screen sticky top-0 select-none z-20 overflow-y-auto">
      <div>
        {/* Logo Banner */}
        <div className="p-4 px-5 border-b border-slate-800/60 flex items-center justify-between">
          <Link
            href="/projects"
            className="flex items-center gap-2.5 cursor-pointer group py-0.5"
            aria-label="Về danh sách dự án NarrativeX"
          >
            <div className="w-8 h-8 rounded-lg bg-gradient-to-br from-purple-600 to-indigo-600 flex items-center justify-center font-bold text-white shadow-[0_0_12px_rgba(124,58,237,0.5)]">
              N
            </div>
            <div>
              <span className="text-base font-extrabold tracking-tight text-white flex items-center gap-1">
                Narrative<span className="text-purple-400">X</span>
              </span>
              <span className="text-[10px] block font-medium text-slate-400 -mt-1 tracking-wider uppercase">
                AI Story Video Studio
              </span>
            </div>
          </Link>
        </div>

        {/* User Profile Card matching top sidebar mockup */}
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
            <p className="text-xs font-bold text-slate-100 truncate">{displayName}</p>
            <span className="inline-flex items-center gap-1 text-[11px] font-semibold text-purple-400">
              <Sparkles className="w-2.5 h-2.5 text-purple-400" />
              Creator Pro
            </span>
          </div>
        </div>

        {/* Navigation Menu */}
        <nav className="p-3 space-y-1" aria-label="Điều hướng studio">
          {navItems.map((item) => {
            const Icon = item.icon;

            if (item.disabled) {
              return (
                <button
                  key={item.id}
                  type="button"
                  disabled
                  title={item.tooltip}
                  className="w-full flex items-center gap-3 px-3.5 py-2.5 rounded-lg text-xs font-medium text-slate-400 hover:text-slate-300 hover:bg-slate-800/30 transition-colors opacity-80 cursor-not-allowed group text-left"
                >
                  <Icon className="w-4 h-4 text-slate-400 group-hover:text-slate-300 shrink-0" />
                  <span className="flex-1">{item.label}</span>
                  {item.badge && (
                    <span className="px-1.5 py-0.2 rounded-full text-[10px] font-bold bg-purple-600 text-white min-w-4 text-center">
                      {item.badge}
                    </span>
                  )}
                </button>
              );
            }

            return (
              <Link
                key={item.id}
                href={item.href}
                aria-current={item.active ? "page" : undefined}
                className={cn(
                  "w-full flex items-center gap-3 px-3.5 py-2.5 rounded-lg text-xs font-medium transition-all duration-150 text-left focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-purple-500",
                  item.active
                    ? "bg-purple-900/40 text-purple-300 border border-purple-800/60 font-semibold shadow-sm"
                    : "text-slate-400 hover:text-slate-200 hover:bg-slate-800/40",
                )}
              >
                <Icon
                  className={cn("w-4 h-4 shrink-0", item.active ? "text-purple-400" : "text-slate-400")}
                />
                <span>{item.label}</span>
              </Link>
            );
          })}
        </nav>
      </div>

      {/* Usage / Quota Widget matching mockup bottom */}
      <div className="p-3.5 m-3 rounded-2xl bg-[#0d1420] border border-slate-800 space-y-3">
        <div className="flex items-center justify-between">
          <span className="text-[11px] font-semibold text-slate-300 uppercase tracking-wider">
            Usage / Quota
          </span>
        </div>

        <div>
          <span className="text-[10px] font-medium text-slate-400 block">Credit còn lại</span>
          <div className="text-xl font-extrabold text-white font-mono tracking-tight mt-0.5">
            12,450
          </div>
        </div>

        <button
          type="button"
          onClick={() => {
            alert("Hệ thống nâng cấp gói cước & nạp Credit đang trong lộ trình phát triển backend.");
          }}
          className="w-full py-2 px-3 rounded-lg bg-gradient-to-r from-purple-600 to-indigo-600 hover:from-purple-500 hover:to-indigo-500 text-xs font-bold text-white shadow-[0_0_15px_rgba(124,58,237,0.35)] transition-all flex items-center justify-center gap-1.5"
        >
          <span>Nâng cấp</span>
        </button>

        <div className="pt-2 border-t border-slate-800/80 space-y-0.5 text-[11px] text-slate-400">
          <div className="flex items-center justify-between">
            <span>Gói:</span>
            <span className="font-semibold text-purple-300">Creator Pro</span>
          </div>
          <div className="flex items-center justify-between">
            <span>Hết hạn:</span>
            <span className="font-mono text-slate-300">15/09/2026</span>
          </div>
        </div>
      </div>
    </aside>
  );
};

