"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { FolderKanban, Users, Image as ImageIcon, Palette, Settings } from "lucide-react";
import { cn } from "@/lib/utils";

export const StudioSidebar = () => {
  const pathname = usePathname();

  const navItems = [
    { id: "projects", label: "Dự án của tôi", icon: FolderKanban, href: "/projects", active: pathname === "/projects" || pathname.startsWith("/projects/") },
    { id: "characters", label: "Thư viện nhân vật", icon: Users, href: "/characters", active: pathname === "/characters" || pathname.startsWith("/characters/") },
    { id: "assets", label: "Thư viện tài sản", icon: ImageIcon, href: "/assets", active: pathname === "/assets" || pathname.startsWith("/assets/") },
    { id: "templates", label: "Mẫu & Phong cách", icon: Palette, href: "/presets", active: pathname === "/presets" || pathname.startsWith("/presets/") },
  ];

  return (
    <aside className="w-64 bg-[#090e17] border-r border-slate-800/80 flex flex-col justify-between shrink-0 h-screen sticky top-0 select-none z-20">
      <div>
        <div className="p-4 px-5 border-b border-slate-800/60 flex items-center justify-between">
          <Link href="/projects" className="flex items-center cursor-pointer group py-1" aria-label="Về danh sách dự án NarrativeX">
            <img src="/branding/narrativex-logo-dark.png" alt="NarrativeX Logo" className="h-11 w-auto max-w-[190px] object-contain transition-transform group-hover:scale-105" />
          </Link>
        </div>

        <nav className="p-3 space-y-1" aria-label="Điều hướng studio">
          {navItems.map((item) => {
            const Icon = item.icon;
            return (
              <Link
                key={item.id}
                href={item.href}
                aria-current={item.active ? "page" : undefined}
                className={cn(
                  "w-full flex items-center gap-3 px-3.5 py-2.5 rounded-lg text-sm font-medium transition-all duration-150 text-left focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-purple-500",
                  item.active ? "bg-purple-900/40 text-purple-300 border border-purple-800/50 font-semibold" : "text-slate-400 hover:text-slate-200 hover:bg-slate-800/40",
                )}
              >
                <Icon className={cn("w-4.5 h-4.5 shrink-0", item.active ? "text-purple-400" : "text-slate-500")} />
                <span>{item.label}</span>
              </Link>
            );
          })}
        </nav>
      </div>

      <div className="p-3">
        <button type="button" disabled title="Cài đặt sẽ được bật khi backend có contract tương ứng" className="w-full flex items-center gap-3 px-3.5 py-2 rounded-lg text-sm font-medium text-slate-500 cursor-not-allowed opacity-70">
          <Settings className="w-4.5 h-4.5" />
          <span>Cài đặt</span>
          <span className="ml-auto text-[10px] uppercase tracking-wide">Sắp có</span>
        </button>
      </div>
    </aside>
  );
};
