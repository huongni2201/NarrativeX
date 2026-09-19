import type { ReactNode } from "react";
import {
  ArrowLeft,
  BookOpen,
  BookMarked,
  Folder,
  Layers3,
  Activity,
  Settings,
} from "lucide-react";
import { NavLink } from "react-router-dom";
import type { DesktopWorkspaceState } from "../queries/useProjectWorkspace";
import type { ActivityId } from "../workspace-navigation";
import { ComputeStatusIndicator } from "./ComputeStatusIndicator";
import { JobStatusIndicator } from "./JobStatusIndicator";

const navigation: Array<{
  id: ActivityId;
  label: string;
  icon: typeof Layers3;
  segment: string;
}> = [
  { id: "chapters", label: "Chapters", icon: BookOpen, segment: "chapters" },
  { id: "canon", label: "Canon", icon: BookMarked, segment: "canon" },
  { id: "editor", label: "Editor", icon: Layers3, segment: "editor" },
  { id: "assets", label: "Assets", icon: Folder, segment: "assets" },
  { id: "jobs", label: "Jobs", icon: Activity, segment: "jobs" },
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
  const currentProject = workspace.projects.find((p) => p.id === projectId);
  const projectName = currentProject?.name ?? "NarrativeX Studio";
  const aspectRatio = currentProject?.imageAspectRatio;

  return (
    <div className="flex h-full w-full min-h-0 min-w-0 flex-col overflow-hidden bg-background font-sans text-foreground select-none">
      {/* Studio Workspace Top Bar */}
      <header className="flex h-12 shrink-0 items-center justify-between border-b border-border-subtle bg-surface-dark px-4">
        <div className="flex min-w-0 items-center gap-3">
          <NavLink
            to="/projects"
            className="inline-flex items-center gap-2 rounded-md px-3 py-1.5 text-[13px] font-medium text-text-muted transition-colors hover:bg-surface-3 hover:text-foreground"
            title="Quay lại danh sách Projects"
          >
            <ArrowLeft size={16} />
            <span>Projects</span>
          </NavLink>

          <span className="text-border-subtle text-[14px]" aria-hidden="true">/</span>

          <div className="flex min-w-0 items-center gap-2.5">
            <span className="truncate text-[15px] font-semibold tracking-tight text-foreground">
              {projectName}
            </span>
            {aspectRatio && (
              <span className="rounded border border-border-subtle bg-surface-3 px-2.5 py-0.5 font-mono text-[11px] font-medium text-text-secondary">
                {aspectRatio}
              </span>
            )}
          </div>
        </div>

        <div className="flex shrink-0 items-center gap-3.5">
          <ComputeStatusIndicator status="Ready" />
          <JobStatusIndicator projectId={projectId} activeCount={0} />

          <span className="inline-flex items-center gap-2 rounded-full border border-success/20 bg-success-bg px-3 py-1 text-[12px] font-medium text-success">
            <span className="size-2 rounded-full bg-success animate-pulse" aria-hidden="true" />
            {workspace.status || "Ready"}
          </span>
        </div>
      </header>

      <div className="flex min-h-0 flex-1 overflow-hidden">
        <aside className="flex w-[68px] shrink-0 flex-col border-r border-border-subtle bg-surface-dark px-1.5 py-2.5">
          <nav className="flex flex-col gap-1.5" aria-label="Workspace navigation">
            {navigation.map(({ id, label, icon: Icon, segment }) => {
              const isActive = screen === id;
              return (
                <NavLink
                  key={id}
                  to={`/projects/${projectId}/${segment}`}
                  className={`group relative flex min-h-[50px] flex-col items-center justify-center gap-1 rounded-md border border-transparent py-1.5 text-[10px] font-medium uppercase tracking-wider transition-all duration-150 ${
                    isActive
                      ? "bg-primary-muted text-primary before:absolute before:inset-y-2 before:left-0 before:w-[2.5px] before:rounded-r before:bg-primary shadow-[inset_0_1px_0_rgba(255,255,255,0.06)]"
                      : "text-text-muted hover:bg-surface-2 hover:text-text-secondary"
                  }`}
                  aria-label={label}
                  aria-current={isActive ? "page" : undefined}
                >
                  <Icon size={18} strokeWidth={isActive ? 2 : 1.75} className={isActive ? "text-primary" : "text-text-muted group-hover:text-text-secondary"} />
                  <span className="truncate max-w-[58px] text-center">{label}</span>
                </NavLink>
              );
            })}
          </nav>
        </aside>

        <main className="flex min-h-0 min-w-0 flex-1 flex-col overflow-hidden bg-background">
          {workspace.error && (
            <div className="border-b border-warning/25 bg-warning-bg px-4 py-2 text-[12px] leading-4 text-warning" role="alert">
              {workspace.error}
            </div>
          )}
          <div className="min-h-0 min-w-0 flex-1 overflow-hidden">{children}</div>
        </main>
      </div>
    </div>
  );
}
