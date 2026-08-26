import type { ReactNode } from "react";
import {
  BookOpen,
  Folder,
  Image as ImageIcon,
  Key,
  Layers3,
  Mic2,
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
  const activeProject = workspace.projects.find((project) => project.id === projectId) ?? null;
  const projectName = activeProject?.name || "NarrativeX Project";

  return (
    <div className="flex h-dvh min-w-0 flex-col bg-background font-sans text-foreground select-none">
      <header className="flex h-11 shrink-0 items-center justify-between gap-3 border-b border-border-subtle bg-surface-dark px-3">
        <div className="flex min-w-0 items-center gap-3">
          <button
            type="button"
            className="flex shrink-0 items-center gap-2 rounded-sm px-1 py-1 font-bold transition hover:bg-surface-2"
            onClick={() => navigate("/projects")}
            aria-label="Back to projects"
          >
            <span className="grid size-5 place-items-center rounded-sm bg-primary text-[11px] font-black text-primary-foreground shadow-[var(--shadow-primary)]">
              N
            </span>
            <span className="text-[11px] font-black tracking-tight text-foreground">NarrativeX</span>
          </button>

          <div className="hidden h-5 w-px bg-border-subtle sm:block" />

          <div className="flex min-w-0 items-center gap-2">
            <span className="hidden text-[10px] text-text-dim xl:inline">Project</span>
            <div
              className="nx-compact-control flex min-w-0 max-w-[300px] items-center gap-1.5 px-2.5 text-[11px] font-medium"
              title={projectName}
              aria-label={`Current project: ${projectName}`}
            >
              <span className="truncate">{projectName}</span>
            </div>
          </div>
        </div>

        <div className="flex shrink-0 items-center gap-1.5">
          <button
            type="button"
            className="ml-1 flex h-7 items-center gap-1.5 rounded-sm bg-primary px-2.5 text-[10px] font-bold text-primary-foreground shadow-[var(--shadow-primary)] transition hover:bg-primary-hover"
            onClick={() => navigate(`/projects/${projectId}/render`)}
          >
            <Sparkles size={12} />
            <span>Render</span>
          </button>
        </div>
      </header>

      <div className="flex min-h-0 flex-1">
        <aside className="flex w-[52px] shrink-0 flex-col border-r border-border-subtle bg-surface-dark px-1 py-2">
          <nav className="flex flex-col gap-1" aria-label="Workspace navigation">
            {navigation.map(({ id, label, icon: Icon, segment }) => {
              const isActive = screen === id;
              return (
                <NavLink
                  key={id}
                  to={`/projects/${projectId}/${segment}`}
                  className={`flex min-h-11 flex-col items-center justify-center gap-0.5 rounded-sm border text-[8px] font-medium transition-colors ${
                    isActive
                      ? "border-primary/35 bg-primary-muted text-primary-hover"
                      : "border-transparent text-text-muted hover:bg-surface-2 hover:text-foreground"
                  }`}
                  aria-label={label}
                  aria-current={isActive ? "page" : undefined}
                >
                  <Icon size={15} />
                  <span>{label}</span>
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
