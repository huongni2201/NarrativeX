import type { ReactNode } from "react";
import {
  BookOpen,
  ChevronDown,
  Folder,
  Image as ImageIcon,
  Layers3,
  Mic2,
  Settings2,
  Sparkles,
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
  { id: "settings", label: "Settings", icon: Settings2, segment: "settings" },
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

  return (
    <div className="grid h-dvh min-w-[1100px] grid-cols-[100px_minmax(0,1fr)] bg-[#080b10] text-foreground select-none">
      {/* Left Sidebar */}
      <aside className="flex flex-col justify-between border-r border-border/70 bg-[#0c1017] p-2.5">
        {/* Top: Logo & Navigation */}
        <div className="space-y-4">
          {/* Logo Header */}
          <button
            type="button"
            className="flex w-full items-center justify-center gap-0.5 py-2 font-black tracking-wider text-foreground transition hover:opacity-90"
            onClick={() => navigate("/projects")}
            title="NarrativeX Projects"
          >
            <span className="text-[13px] font-black tracking-widest text-white">NARRATIVE</span>
            <span className="text-[14px] font-black text-[#ff8a00]">X</span>
          </button>

          {/* Navigation Items */}
          <nav className="flex flex-col gap-1.5 pt-1">
            {navigation.map(({ id, label, icon: Icon, segment }) => {
              const isActive = screen === id;

              return (
                <NavLink
                  key={id}
                  to={`/projects/${projectId}/${segment}`}
                  className={`flex flex-col items-center justify-center gap-1.5 rounded-xl py-2.5 text-[10px] font-medium transition-all ${
                    isActive
                      ? "bg-gradient-to-b from-[#ff8a00]/20 to-[#ff8a00]/5 text-[#ff8a00] shadow-[0_0_12px_rgba(255,138,0,0.15)] ring-1 ring-[#ff8a00]/30"
                      : "text-muted-foreground hover:bg-[#141b27] hover:text-foreground"
                  }`}
                  aria-label={label}
                >
                  <Icon size={19} className={isActive ? "text-[#ff8a00]" : "text-muted-foreground"} />
                  <span>{label}</span>
                </NavLink>
              );
            })}
          </nav>
        </div>

        {/* Bottom Section: Storage, Status & Workspace selector */}
        <div className="space-y-3 border-t border-border/50 pt-3">
          {/* Storage Gauge */}
          <div className="space-y-1 px-1">
            <div className="flex items-center justify-between text-[9px] font-bold tracking-wider text-muted-foreground uppercase">
              <span>STORAGE</span>
            </div>
            <div className="text-[10px] text-muted-foreground/80">128 GB / 500 GB</div>
            <div className="h-1 w-full overflow-hidden rounded-full bg-[#162030]">
              <div className="h-full w-1/4 rounded-full bg-emerald-400" />
            </div>
          </div>

          {/* Connection Status */}
          <div className="flex items-center gap-1.5 px-1 text-[10px] font-medium text-emerald-400">
            <span className="h-2 w-2 rounded-full bg-emerald-400 shadow-[0_0_8px_rgba(52,211,153,0.8)]" />
            <span>Connected</span>
          </div>

          {/* Workspace dropdown button */}
          <div className="px-0.5">
            <button
              type="button"
              className="flex w-full items-center justify-between rounded-lg border border-border/60 bg-[#121927] px-2 py-1.5 text-left text-[9px] text-muted-foreground transition hover:border-border hover:bg-[#182335] hover:text-foreground"
            >
              <div className="truncate">
                <span className="block text-[8px] text-muted-foreground/60 uppercase">Workspace</span>
                <span className="truncate font-medium text-foreground">Local workspace</span>
              </div>
              <ChevronDown size={11} className="shrink-0 text-muted-foreground" />
            </button>
          </div>
        </div>
      </aside>

      {/* Main Feature Content Screen */}
      <main className="min-h-0 min-w-0 overflow-hidden bg-[#080b10]">
        {workspace.error && (
          <div className="border-b border-warning/30 bg-warning-bg px-4 py-2 text-xs text-warning">
            {workspace.error}
          </div>
        )}
        {children}
      </main>
    </div>
  );
}
