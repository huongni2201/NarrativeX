import type { ReactNode } from "react";
import {
  Bell,
  BookOpen,
  ChevronDown,
  Film,
  Folder,
  HelpCircle,
  Image as ImageIcon,
  Key,
  Layers3,
  Mic2,
  Redo2,
  Sparkles,
  Undo2,
  UserCircle,
} from "lucide-react";
import { NavLink, useNavigate } from "react-router-dom";
import type { DesktopWorkspaceState } from "../queries/useProjectWorkspace";
import type { ActivityId } from "../workspace-navigation";

const navigation: Array<{
  id: ActivityId;
  label: string;
  icon: typeof Layers3;
  segment: string;
}> = [
  { id: "editor", label: "Editor", icon: Layers3, segment: "editor" },
  { id: "chapters", label: "Chapters", icon: BookOpen, segment: "chapters" },
  { id: "characters", label: "Characters", icon: UserCircle, segment: "characters" },
  { id: "images", label: "Images", icon: ImageIcon, segment: "images" },
  { id: "voice", label: "Voice", icon: Mic2, segment: "voice" },
  { id: "assets", label: "Assets", icon: Folder, segment: "assets" },
  { id: "render", label: "Render", icon: Sparkles, segment: "render" },
  { id: "settings", label: "Settings", icon: Key, segment: "settings" },
];

export function WorkspaceShell({
  projectId,
  screen,
  workspace,
  children,
}: Readonly<{
  projectId: string;
  screen: ActivityId;
  workspace: DesktopWorkspaceState;
  children: ReactNode;
}>) {
  const navigate = useNavigate();
  const activeProject = workspace.projects.find((p) => p.id === projectId) ?? null;
  const projectName = activeProject?.name || "Sau Khi Tiếng Lòng Của Phản Diện Bị Lộ";

  return (
    <div className="flex h-dvh min-w-[1240px] flex-col bg-[#070a0f] text-foreground select-none font-sans">
      {/* Global Top Header Bar */}
      <header className="flex h-11 shrink-0 items-center justify-between border-b border-border/50 bg-[#090d14] px-3.5">
        {/* Left: Brand Logo & Project Picker */}
        <div className="flex items-center gap-3">
          <button
            type="button"
            className="flex items-center gap-2 font-bold transition hover:opacity-90"
            onClick={() => navigate("/projects")}
          >
            <div className="flex h-5 w-5 items-center justify-center rounded bg-gradient-to-br from-[#ff8a00] to-[#e66c00] text-black font-black text-xs shadow-[0_0_8px_rgba(255,138,0,0.4)]">
              N
            </div>
            <span className="text-xs font-black tracking-tight text-white">NarrativeX</span>
          </button>

          {/* Project dropdown */}
          <div className="flex items-center gap-1.5 pl-3">
            <span className="text-[11px] text-muted-foreground/80">Project</span>
            <div className="flex items-center gap-1.5 rounded-md border border-border/60 bg-[#0f1522] px-2.5 py-0.5 text-xs font-medium text-foreground transition hover:border-border">
              <span className="max-w-[260px] truncate">{projectName}</span>
              <ChevronDown size={11} className="text-muted-foreground" />
            </div>
          </div>
        </div>

        {/* Center: Scope Switcher */}
        <div className="flex items-center gap-1 rounded-md border border-border/40 bg-[#060910] p-0.5 text-xs">
          <span className="px-2 text-[10px] text-muted-foreground">Scope:</span>
          <button
            type="button"
            className="rounded border border-[#ff8a00]/50 bg-[#ff8a00]/15 px-2.5 py-0.5 text-[11px] font-semibold text-[#ff8a00] shadow-sm"
          >
            Chapter 01
          </button>
          <button
            type="button"
            className="rounded px-2.5 py-0.5 text-[11px] font-medium text-muted-foreground transition hover:text-foreground"
          >
            Full Project
          </button>
        </div>

        {/* Right Actions: Autosave, Undo/Redo, Notifications, Profile Avatar & Export Button */}
        <div className="flex items-center gap-2.5">
          {/* Autosave Status */}
          <div className="flex items-center gap-1.5 text-[11px] text-emerald-400">
            <span className="h-1.5 w-1.5 rounded-full bg-emerald-400 shadow-[0_0_6px_rgba(52,211,153,0.8)]" />
            <span>Auto saved 10:45 AM</span>
            <span className="font-bold text-[10px]">✓</span>
          </div>

          {/* Undo / Redo / Help */}
          <div className="flex items-center text-muted-foreground pl-1">
            <button
              type="button"
              className="flex h-6 w-6 items-center justify-center rounded hover:bg-[#121926] hover:text-foreground"
              title="Undo"
              aria-label="Undo"
            >
              <Undo2 size={12} />
            </button>
            <button
              type="button"
              className="flex h-6 w-6 items-center justify-center rounded hover:bg-[#121926] hover:text-foreground"
              title="Redo"
              aria-label="Redo"
            >
              <Redo2 size={12} />
            </button>
            <button
              type="button"
              className="flex h-6 w-6 items-center justify-center rounded hover:bg-[#121926] hover:text-foreground"
              title="Help"
              aria-label="Help"
            >
              <HelpCircle size={12} />
            </button>
          </div>

          {/* Notification Bell */}
          <div className="relative pl-0.5">
            <button
              type="button"
              className="flex h-6 w-6 items-center justify-center rounded text-muted-foreground hover:bg-[#121926] hover:text-foreground"
              title="Notifications"
              aria-label="Notifications"
            >
              <Bell size={13} />
            </button>
            <span className="absolute -top-0.5 -right-0.5 flex h-3 w-3 items-center justify-center rounded-full bg-[#ff8a00] text-[8px] font-bold text-black">
              1
            </span>
          </div>

          {/* User Profile Avatar */}
          <div className="h-6 w-6 overflow-hidden rounded-full border border-border/70 bg-[#162132]">
            <img
              src="https://images.unsplash.com/photo-1534528741775-53994a69daeb?w=64&h=64&fit=crop&crop=faces"
              alt="User"
              className="h-full w-full object-cover"
              onError={(e) => {
                e.currentTarget.style.display = "none";
              }}
            />
          </div>

          {/* Export Button */}
          <button
            type="button"
            className="flex items-center gap-1 rounded-md bg-[#ff8a00] px-3 py-1 text-xs font-bold text-black shadow-[0_0_10px_rgba(255,138,0,0.3)] transition hover:bg-[#ffa133]"
          >
            <Film size={12} className="fill-black" />
            <span>Export</span>
            <ChevronDown size={11} className="stroke-[2.5]" />
          </button>
        </div>
      </header>

      {/* Main Workspace Body */}
      <div className="flex flex-1 min-h-0">
        {/* Left Navigation Rail (Ultra Slim 58px) */}
        <aside className="flex w-[58px] shrink-0 flex-col justify-between border-r border-border/50 bg-[#080c13] py-2 px-1">
          {/* Nav Items */}
          <nav className="flex flex-col gap-1.5">
            {navigation.map(({ id, label, icon: Icon, segment }) => {
              const isActive = screen === id;

              return (
                <NavLink
                  key={id}
                  to={`/projects/${projectId}/${segment}`}
                  className={`flex flex-col items-center justify-center gap-0.5 rounded-lg py-1.5 text-[9px] font-medium transition-all ${
                    isActive
                      ? "border border-[#ff8a00]/50 bg-[#ff8a00]/15 text-[#ff8a00] shadow-[0_0_10px_rgba(255,138,0,0.2)] font-bold"
                      : "text-muted-foreground hover:bg-[#101622] hover:text-foreground"
                  }`}
                  aria-label={label}
                >
                  <Icon size={16} className={isActive ? "text-[#ff8a00]" : "text-muted-foreground"} />
                  <span className="scale-95">{label}</span>
                </NavLink>
              );
            })}
          </nav>

          {/* Bottom Storage Meter */}
          <div className="space-y-0.5 px-0.5 text-center">
            <div className="text-[8px] font-bold uppercase tracking-wider text-muted-foreground">
              Storage
            </div>
            <div className="text-[7.5px] text-muted-foreground/80 leading-tight">128 GB / 500 GB</div>
            <div className="h-0.5 w-full overflow-hidden rounded-full bg-[#162030]">
              <div className="h-full w-1/4 rounded-full bg-[#ff8a00]" />
            </div>
          </div>
        </aside>

        {/* Content View */}
        <main className="flex-1 min-h-0 min-w-0 overflow-hidden bg-[#070a0f]">
          {workspace.error && (
            <div className="border-b border-warning/30 bg-warning-bg px-4 py-1.5 text-xs text-warning">
              {workspace.error}
            </div>
          )}
          {children}
        </main>
      </div>
    </div>
  );
}
