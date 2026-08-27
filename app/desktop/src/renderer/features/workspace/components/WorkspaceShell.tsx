import type { ReactNode } from "react";
import {
  BookOpen,
  ChevronDown,
  CircleHelp,
  Folder,
  Image as ImageIcon,
  Layers3,
  Mic2,
  Redo2,
  Settings,
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
  const navigate = useNavigate();
  const activeProject = workspace.projects.find((project) => project.id === projectId) ?? null;
  const projectName = activeProject?.name || "ZXCXC";

  return (
    <div className="flex h-full w-full min-h-0 min-w-0 flex-col bg-background font-sans text-foreground select-none overflow-hidden">
      <header className="flex h-14 shrink-0 items-center justify-between gap-4 border-b border-border-subtle bg-surface-dark px-5">
        <div className="flex min-w-0 items-center gap-6">
          <button
            type="button"
            className="flex shrink-0 items-center gap-2.5 rounded-md px-1 py-1 font-bold transition hover:opacity-90"
            onClick={() => navigate("/projects")}
            aria-label="Back to projects"
          >
            <span className="grid size-7 place-items-center rounded-md bg-primary text-[15px] font-black text-white shadow-[var(--shadow-primary)]">
              N
            </span>
            <span className="text-[15px] font-black tracking-tight text-foreground">NarrativeX</span>
          </button>

          <div className="flex min-w-0 items-center gap-2.5">
            <span className="text-[12px] text-text-dim">Project</span>
            <div
              className="flex h-8 min-w-0 items-center gap-2 rounded-md border border-border-subtle bg-surface-input px-3 text-[12px] font-medium text-text-secondary transition hover:border-border hover:bg-surface-2"
              title={projectName}
              aria-label={`Current project: ${projectName}`}
            >
              <span className="truncate">{projectName}</span>
              <ChevronDown size={13} className="shrink-0 text-text-muted" aria-hidden="true" />
            </div>
          </div>
        </div>

        <div className="flex shrink-0 items-center gap-2">
          <button type="button" className="nx-icon-button size-8 text-text-muted hover:text-foreground" title="Undo" aria-label="Undo">
            <Undo2 size={16} />
          </button>
          <button type="button" className="nx-icon-button size-8 text-text-muted hover:text-foreground" title="Redo" aria-label="Redo">
            <Redo2 size={16} />
          </button>
          <button type="button" className="nx-icon-button size-8 text-text-muted hover:text-foreground" title="Help" aria-label="Help">
            <CircleHelp size={16} />
          </button>
          <button
            type="button"
            className="ml-2 flex h-9 items-center gap-2 rounded-md bg-primary px-4 text-[12px] font-bold text-white shadow-[var(--shadow-primary)] transition hover:bg-primary-hover active:scale-95"
            onClick={() => navigate(`/projects/${projectId}/render`)}
          >
            <Sparkles size={14} />
            <span>Render</span>
          </button>
        </div>
      </header>

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

        <main className="min-h-0 min-w-0 flex-1 overflow-hidden bg-background">
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
