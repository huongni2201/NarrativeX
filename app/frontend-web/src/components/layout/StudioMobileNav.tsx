"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { FolderKanban, Image as ImageIcon, Palette, Users } from "lucide-react";
import { cn } from "@/lib/utils";

const navItems = [
  { href: "/projects", label: "Dự án", icon: FolderKanban },
  { href: "/characters", label: "Nhân vật", icon: Users },
  { href: "/assets", label: "Tài sản", icon: ImageIcon },
  { href: "/presets", label: "Phong cách", icon: Palette },
] as const;

export function StudioMobileNav() {
  const pathname = usePathname();

  return (
    <nav
      aria-label="Điều hướng studio trên di động"
      className="fixed inset-x-0 bottom-0 z-40 grid grid-cols-4 border-t border-border bg-surface-panel px-1 pb-[max(0.5rem,env(safe-area-inset-bottom))] pt-2 lg:hidden"
    >
      {navItems.map(({ href, label, icon: Icon }) => {
        const active = pathname === href || pathname.startsWith(`${href}/`);

        return (
          <Link
            key={href}
            href={href}
            aria-current={active ? "page" : undefined}
            className={cn(
              "flex min-w-0 flex-col items-center gap-1 rounded-lg px-1 py-1.5 text-[10px] font-medium focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-purple-500",
              active ? "text-purple-300" : "text-slate-500 hover:text-slate-300",
            )}
          >
            <Icon className="h-4 w-4" />
            <span className="max-w-full truncate">{label}</span>
          </Link>
        );
      })}
    </nav>
  );
}
