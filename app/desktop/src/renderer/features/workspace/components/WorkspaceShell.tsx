import { useEffect, type ReactNode } from "react";
import {
  AlertTriangle,
  ArrowLeft,
  BookOpen,
  BookMarked,
  Folder,
  Layers3,
  Activity,
  AudioLines,
} from "lucide-react";
import { NavLink, useNavigate } from "react-router-dom";
import { Tooltip, TooltipContent, TooltipTrigger } from "@/components/ui/tooltip";
import { ThemeToggle } from "@/components/ThemeToggle";
import type { DesktopWorkspaceState } from "../queries/useProjectWorkspace";
import type { ActivityId } from "../workspace-navigation";
import { ComputeStatusIndicator } from "./ComputeStatusIndicator";
import { JobStatusIndicator } from "./JobStatusIndicator";
import { useProjectGenerationEvents } from "../../generation/realtime/project-events";

const navigation: Array<{
  id: ActivityId;
  label: string;
  icon: typeof Layers3;
  segment: string;
}> = [
  { id: "chapters", label: "Chương", icon: BookOpen, segment: "chapters" },
  { id: "canon", label: "Hồ sơ", icon: BookMarked, segment: "canon" },
  { id: "audio", label: "Âm thanh", icon: AudioLines, segment: "audio" },
  { id: "editor", label: "Biên tập", icon: Layers3, segment: "editor" },
  { id: "assets", label: "Tài nguyên", icon: Folder, segment: "assets" },
  { id: "jobs", label: "Tác vụ", icon: Activity, segment: "jobs" },
];

/**
 * Data-loading state shown beside the project name. "ready" and "empty" show
 * nothing: a permanent "Ready" badge is noise, and an empty project is
 * explained by the screen itself.
 */
const dataStatus: Partial<
  Record<DesktopWorkspaceState["status"], { label: string; hint: string; className: string; dotClassName: string }>
> = {
  loading: {
    label: "Đang tải dữ liệu",
    hint: "Workspace đang tải dữ liệu của project.",
    className: "border-border-subtle bg-surface-2 text-text-secondary",
    dotClassName: "bg-text-muted nx-dot-live",
  },
  partial: {
    label: "Dữ liệu chưa đầy đủ",
    hint: "Một số dữ liệu của workspace chưa tải được. Xem chi tiết ở thông báo bên dưới.",
    className: "border-warning/30 bg-warning-bg text-warning",
    dotClassName: "bg-warning",
  },
  error: {
    label: "Không tải được dữ liệu",
    hint: "Workspace không tải được dữ liệu của project.",
    className: "border-destructive/30 bg-danger-bg text-destructive",
    dotClassName: "bg-destructive",
  },
};

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
  useProjectGenerationEvents(projectId);
  const navigate = useNavigate();

  // Ctrl/Cmd + number jumps between the workspace sections.
  useEffect(() => {
    function onKeyDown(event: KeyboardEvent) {
      if (!(event.ctrlKey || event.metaKey) || event.altKey || event.shiftKey) return;
      const target = navigation[Number(event.key) - 1];
      if (!target) return;
      event.preventDefault();
      navigate(`/projects/${projectId}/${target.segment}`);
    }
    window.addEventListener("keydown", onKeyDown);
    return () => window.removeEventListener("keydown", onKeyDown);
  }, [navigate, projectId]);

  const currentProject = workspace.projects.find((p) => p.id === projectId);
  const projectName = currentProject?.name ?? "NarrativeX Studio";
  const aspectRatio = currentProject?.imageAspectRatio;
  const status = dataStatus[workspace.status ?? "ready"];

  return (
    <div className="flex h-full w-full min-h-0 min-w-0 flex-col overflow-hidden bg-background font-sans text-foreground select-none">
      <header className="flex h-12 shrink-0 items-center justify-between border-b border-border-subtle bg-surface-dark px-4">
        <div className="flex min-w-0 items-center gap-3">
          <NavLink
            to="/projects"
            className="inline-flex items-center gap-2 rounded-md px-3 py-1.5 text-body font-medium text-text-muted transition-colors hover:bg-surface-3 hover:text-foreground"
            title="Quay lại danh sách dự án"
          >
            <ArrowLeft size={16} />
            <span>Dự án</span>
          </NavLink>

          <span className="text-text-dim" aria-hidden="true">/</span>

          <div className="flex min-w-0 items-center gap-2.5">
            <span className="truncate text-[15px] font-semibold tracking-tight text-foreground">{projectName}</span>
            {aspectRatio && (
              <span className="rounded border border-border-subtle bg-surface-3 px-2 py-0.5 font-mono text-caption font-medium text-text-secondary">
                {aspectRatio}
              </span>
            )}
            {status && (
              <span
                className={`inline-flex items-center gap-2 rounded-full border px-2.5 py-0.5 text-caption font-medium ${status.className}`}
                title={status.hint}
              >
                <span className={`size-1.5 rounded-full ${status.dotClassName}`} aria-hidden="true" />
                {status.label}
              </span>
            )}
          </div>
        </div>

        <div className="flex shrink-0 items-center gap-2.5">
          <ComputeStatusIndicator />
          <JobStatusIndicator projectId={projectId} />
          <span className="mx-0.5 h-5 w-px bg-border-subtle" aria-hidden="true" />
          <ThemeToggle />
        </div>
      </header>

      <div className="flex min-h-0 flex-1 overflow-hidden">
        <aside className="flex w-[76px] shrink-0 flex-col border-r border-border-subtle bg-surface-dark px-2 py-3">
          <nav className="flex flex-col gap-1.5" aria-label="Workspace navigation">
            {navigation.map(({ id, label, icon: Icon, segment }, index) => {
              const isActive = screen === id;
              return (
                <Tooltip key={id}>
                  <TooltipTrigger asChild>
                    <NavLink
                      to={`/projects/${projectId}/${segment}`}
                      className={`group relative flex min-h-[56px] flex-col items-center justify-center gap-1 rounded-md py-2 text-caption font-medium transition-colors duration-150 ${
                        isActive
                          ? "bg-primary-muted text-primary before:absolute before:inset-y-2.5 before:-left-2 before:w-[3px] before:rounded-r before:bg-primary"
                          : "text-text-muted hover:bg-surface-2 hover:text-foreground"
                      }`}
                      aria-label={label}
                      aria-current={isActive ? "page" : undefined}
                    >
                      <Icon size={20} strokeWidth={isActive ? 2.1 : 1.75} />
                      <span className="max-w-[64px] truncate text-center">{label}</span>
                    </NavLink>
                  </TooltipTrigger>
                  <TooltipContent side="right">
                    {label} <kbd className="ml-1.5 font-mono text-text-muted">Ctrl+{index + 1}</kbd>
                  </TooltipContent>
                </Tooltip>
              );
            })}
          </nav>
        </aside>

        <main className="flex min-h-0 min-w-0 flex-1 flex-col overflow-hidden bg-background">
          {workspace.error && (
            <div
              className="flex items-start gap-2.5 border-b border-warning/25 bg-warning-bg px-4 py-2.5 text-label text-warning"
              role="alert"
            >
              <AlertTriangle size={15} className="mt-0.5 shrink-0" aria-hidden="true" />
              <p className="min-w-0">
                <strong className="font-semibold">Một phần dữ liệu chưa tải được.</strong>{" "}
                <span className="text-text-secondary">Chi tiết: {workspace.error}</span>
              </p>
            </div>
          )}
          <div key={screen} className="nx-stage-enter min-h-0 min-w-0 flex-1 overflow-hidden">
            {children}
          </div>
        </main>
      </div>
    </div>
  );
}
