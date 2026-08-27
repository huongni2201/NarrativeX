import type { ReactNode } from "react";
import {
  BookOpen,
  Clapperboard,
  Folder,
  Image as ImageIcon,
  Layers3,
  Mic2,
  Settings,
  Sparkles,
  UserCircle,
} from "lucide-react";
import { NavLink } from "react-router-dom";
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
  { id: "storyboard", label: "Storyboard", icon: Clapperboard, segment: "storyboard" },
  { id: "characters", label: "Characters", icon: UserCircle, segment: "characters" },
  { id: "images", label: "Media", icon: ImageIcon, segment: "images" },
  { id: "voice", label: "Voice", icon: Mic2, segment: "voice" },
  { id: "assets", label: "Assets", icon: Folder, segment: "assets" },
  { id: "render", label: "Render", icon: Sparkles, segment: "render" },
  { id: "settings", label: "Settings", icon: Settings, segment: "settings" },
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
  return (
    <div className="flex h-full w-full min-h-0 min-w-0 flex-col bg-background font-sans text-foreground select-none overflow-hidden">
      <div className="flex min-h-0 flex-1 overflow-hidden">
        <aside className="flex w-[72px] shrink-0 flex-col border-r border-border-subtle bg-surface-dark px-1.5 py-3">
          <nav className="flex flex-col gap-1.5" aria-label="Workspace navigation">
            {navigation.map(({ id, label, icon: Icon, segment }) => {
              const isActive = screen === id;
              return (
                <NavLink
                  key={id}
                  to={`/projects/${projectId}/${segment}`}
                  className={`flex min-h-[58px] flex-col items-center justify-center gap-1 rounded-lg border text-[10px] font-medium transition-all ${
                    isActive
                      ? "border-primary/50 bg-[#1e1710] text-primary shadow-[0_0_12px_rgba(255,138,0,0.15)]"
                      : "border-transparent text-text-dim hover:bg-surface-2 hover:text-text-secondary"
                  }`}
                  aria-label={label}
                  aria-current={isActive ? "page" : undefined}
                >
                  <Icon size={18} className={isActive ? "text-primary" : "text-text-muted"} />
                  <span className="tracking-tight">{label}</span>
                </NavLink>
              );
            })}
          </nav>
        </aside>

        <main className="flex min-h-0 min-w-0 flex-1 flex-col overflow-hidden bg-background">
          {workspace.error && (
            <div className="border-b border-warning/30 bg-warning-bg px-4 py-1.5 text-xs text-warning">
              {workspace.error}
            </div>
          )}
          <div className="min-h-0 min-w-0 flex-1 overflow-hidden">{children}</div>
        </main>
      </div>
    </div>
  );
}
