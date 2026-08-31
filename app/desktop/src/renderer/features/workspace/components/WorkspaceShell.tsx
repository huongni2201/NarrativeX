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
    <div className="flex h-full w-full min-h-0 min-w-0 flex-col overflow-hidden bg-background font-sans text-foreground select-none">
      <div className="flex min-h-0 flex-1 overflow-hidden">
        <aside className="flex w-[72px] shrink-0 flex-col border-r border-border-subtle bg-surface-dark px-1.5 py-3">
          <nav className="flex flex-col gap-1" aria-label="Workspace navigation">
            {navigation.map(({ id, label, icon: Icon, segment }) => {
              const isActive = screen === id;
              return (
                <NavLink
                  key={id}
                  to={`/projects/${projectId}/${segment}`}
                  className={`relative flex min-h-[56px] flex-col items-center justify-center gap-1 rounded-md border border-transparent text-[10px] font-medium transition-[background-color,color] duration-150 ${
                    isActive
                      ? "bg-primary-muted text-primary before:absolute before:inset-y-2 before:left-0 before:w-0.5 before:rounded-full before:bg-primary"
                      : "text-text-muted hover:bg-surface-2 hover:text-text-secondary"
                  }`}
                  aria-label={label}
                  aria-current={isActive ? "page" : undefined}
                >
                  <Icon size={18} strokeWidth={1.75} className={isActive ? "text-primary" : "text-text-muted"} />
                  <span className="tracking-tight">{label}</span>
                </NavLink>
              );
            })}
          </nav>
        </aside>

        <main className="flex min-h-0 min-w-0 flex-1 flex-col overflow-hidden bg-background">
          {workspace.error && (
            <div className="border-b border-warning/25 bg-warning-bg px-4 py-2 text-[11px] leading-4 text-warning" role="alert">
              {workspace.error}
            </div>
          )}
          <div className="min-h-0 min-w-0 flex-1 overflow-hidden">{children}</div>
        </main>
      </div>
    </div>
  );
}
