import React from "react";
import {
  LayoutDashboard,
  FolderKanban,
  Users,
  Image as ImageIcon,
  Palette,
  Clock,
  Bell,
  Settings,
  Sparkles,
  Zap,
} from "lucide-react";
import { useStudioStore } from "@/store/useStudioStore";
import { useProductionStore } from "@/store/useProductionStore";
import { cn } from "@/lib/utils";

export const StudioSidebar: React.FC = () => {
  const { currentScreen, setScreen, openWizard } = useStudioStore();
  const setView = useProductionStore((state) => state.setView);

  const navItems = [
    {
      id: "overview",
      label: "Tổng quan",
      icon: LayoutDashboard,
      onClick: () => {
        setScreen("overview");
      },
      active: currentScreen === "overview",
    },
    {
      id: "projects",
      label: "Dự án của tôi",
      icon: FolderKanban,
      onClick: () => {
        setScreen("project-workspace");
        setView("overview");
      },
      active: currentScreen === "project-workspace" || currentScreen === "dashboard",
    },
    {
      id: "characters",
      label: "Thư viện nhân vật",
      icon: Users,
      onClick: () => {
        setScreen("characters");
      },
      active: currentScreen === "characters" || currentScreen === "character-bible",
    },
    {
      id: "assets",
      label: "Thư viện tài sản",
      icon: ImageIcon,
      onClick: () => {
        setScreen("assets");
      },
      active: currentScreen === "assets",
    },
    {
      id: "templates",
      label: "Mẫu & Phong cách",
      icon: Palette,
      onClick: () => {
        setScreen("presets");
      },
      active: currentScreen === "presets",
    },
    {
      id: "jobs",
      label: "Lịch sử công việc",
      icon: Clock,
      onClick: () => {
        setScreen("project-workspace");
        setView("workspace");
      },
      active: false,
    },
  ];

  return (
    <aside className="w-64 bg-[#090e17] border-r border-slate-800/80 flex flex-col justify-between shrink-0 h-screen sticky top-0 select-none z-20">
      {/* Brand Header */}
      <div>
        <div className="p-4 px-5 border-b border-slate-800/60 flex items-center justify-between">
          <div
            onClick={() => setScreen("overview")}
            className="flex items-center cursor-pointer group py-1"
          >
            <img
              src="/branding/narrativex-logo-dark.png"
              alt="NarrativeX Logo"
              className="h-11 w-auto max-w-[190px] object-contain transition-transform group-hover:scale-105"
            />
          </div>
        </div>

        {/* Navigation Menu */}
        <nav className="p-3 space-y-1">
          {navItems.map((item) => {
            const Icon = item.icon;
            return (
              <button
                key={item.id}
                onClick={item.onClick}
                className={cn(
                  "w-full flex items-center gap-3 px-3.5 py-2.5 rounded-lg text-sm font-medium transition-all duration-150 text-left focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-purple-500",
                  item.active
                    ? "bg-purple-900/40 text-purple-300 border border-purple-800/50 shadow-[0_0_15px_rgba(124,58,237,0.15)] font-semibold"
                    : "text-slate-400 hover:text-slate-200 hover:bg-slate-800/40"
                )}
              >
                <Icon
                  className={cn(
                    "w-4.5 h-4.5 shrink-0",
                    item.active ? "text-purple-400" : "text-slate-500"
                  )}
                />
                <span>{item.label}</span>
              </button>
            );
          })}
        </nav>
      </div>

      {/* Footer / Account & Plan */}
      <div className="p-3 space-y-3">
        {/* Bottom Utility Nav */}
        <div className="space-y-1 pt-2 border-t border-slate-800/60">
          <button
            type="button"
            className="w-full flex items-center justify-between px-3.5 py-2 rounded-lg text-sm font-medium text-slate-400 hover:text-slate-200 hover:bg-slate-800/40 transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-purple-500"
          >
            <div className="flex items-center gap-3">
              <Bell className="w-4.5 h-4.5 text-slate-500" />
              <span>Thông báo</span>
            </div>
            <span className="w-5 h-5 rounded-full bg-purple-600 text-white text-[11px] font-bold flex items-center justify-center shadow-[0_0_8px_rgba(124,58,237,0.6)]">
              3
            </span>
          </button>

          <button
            type="button"
            className="w-full flex items-center gap-3 px-3.5 py-2 rounded-lg text-sm font-medium text-slate-400 hover:text-slate-200 hover:bg-slate-800/40 transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-purple-500"
          >
            <Settings className="w-4.5 h-4.5 text-slate-500" />
            <span>Cài đặt</span>
          </button>
        </div>

        {/* Plan & Credits Card */}
        <div className="p-3.5 rounded-xl bg-[#0e1626] border border-slate-800/80 shadow-md">
          <div className="flex items-center justify-between mb-1.5">
            <span className="text-xs text-slate-400">Gói của bạn</span>
            <span className="text-xs font-semibold text-purple-300 bg-purple-950/80 px-2 py-0.5 rounded border border-purple-800/50">
              Creator Pro
            </span>
          </div>
          <div className="flex items-center gap-1.5 text-xs text-slate-300 font-mono mb-3">
            <Zap className="w-3.5 h-3.5 text-amber-400 fill-amber-400" />
            <span>Credits: <strong className="text-white font-bold">12,450</strong></span>
          </div>
          <button
            type="button"
            onClick={() => { }}
            className="w-full py-1.5 px-3 bg-gradient-to-r from-purple-600 to-indigo-600 hover:from-purple-500 hover:to-indigo-500 text-white text-xs font-semibold rounded-lg transition-all shadow-[0_0_12px_rgba(124,58,237,0.35)]"
          >
            Nâng cấp
          </button>
        </div>
      </div>
    </aside>
  );
};
