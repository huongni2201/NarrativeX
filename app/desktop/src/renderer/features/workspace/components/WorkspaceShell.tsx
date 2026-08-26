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
            <button
              type="button"
              className="nx-compact-control flex min-w-0 max-w-[300px] items-center gap-1.5 px-2.5 text-[11px] font-medium"
              title={projectName}
            >
              <span className="truncate">{projectName}</span>
              <ChevronDown size={11} className="shrink-0 text-text-muted" />
            </button>
          </div>
        </div>

        <div className="hidden shrink-0 items-center rounded-md border border-border-subtle bg-background p-0.5 lg:flex">
          <span className="px-2 text-[9px] font-medium uppercase tracking-wider text-text-dim">Scope</span>
          <button
            type="button"
            className="rounded-sm border border-primary/40 bg-primary-muted px-2.5 py-1 text-[10px] font-semibold text-primary-hover"
          >
            Chapter 01
          </button>
          <button
            type="button"
            className="rounded-sm px-2.5 py-1 text-[10px] font-medium text-text-muted transition hover:bg-surface-2 hover:text-foreground"
          >
            Full Project
          </button>
        </div>

        <div className="flex shrink-0 items-center gap-1.5">
          <div className="hidden items-center gap-1.5 pr-1 text-[9px] text-success 2xl:flex">
            <span className="size-1.5 rounded-full bg-success" />
            <span>Auto saved</span>
          </div>

          <button type="button" className="nx-icon-button" title="Undo" aria-label="Undo">
            <Undo2 size={12} />
          </button>
          <button type="button" className="nx-icon-button" title="Redo" aria-label="Redo">
            <Redo2 size={12} />
          </button>
          <button type="button" className="nx-icon-button" title="Help" aria-label="Help">
            <HelpCircle size={12} />
          </button>

          <div className="relative">
            <button
              type="button"
              className="nx-icon-button"
              title="Notifications"
              aria-label="Notifications"
            >
              <Bell size={13} />
            </button>
            <span className="absolute right-0 top-0 grid size-3 place-items-center rounded-full bg-primary text-[7px] font-bold text-primary-foreground">
              1
            </span>
          </div>

          <button
            type="button"
            className="grid size-7 place-items-center rounded-full border border-border bg-surface-3 text-text-secondary transition hover:border-border-dark hover:text-foreground"
            title="Account"
            aria-label="Account"
          >
            <UserCircle size={16} />
          </button>

          <button
            type="button"
            className="ml-1 flex h-7 items-center gap-1.5 rounded-sm bg-primary px-2.5 text-[10px] font-bold text-primary-foreground shadow-[var(--shadow-primary)] transition hover:bg-primary-hover"
          >
            <Film size={12} />
            <span>Export</span>
            <ChevronDown size={10} />
          </button>
        </div>
      </header>

      <div className="flex min-h-0 flex-1">
        <aside className="flex w-[52px] shrink-0 flex-col justify-between border-r border-border-subtle bg-surface-dark px-1 py-2">
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

          <div className="space-y-1 px-1 pb-1 text-center">
            <span className="block text-[7px] font-semibold uppercase tracking-wider text-text-dim">Storage</span>
            <div className="h-0.5 overflow-hidden rounded-full bg-surface-4" aria-hidden="true">
              <div className="h-full w-1/4 rounded-full bg-primary" />
            </div>
          </div>
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
