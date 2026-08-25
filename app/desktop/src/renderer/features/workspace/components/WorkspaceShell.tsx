import type { ReactNode } from "react";
import {
  BookOpen,
  Folder,
  Image as ImageIcon,
  Layers3,
  Mic2,
  Settings2,
  Sparkles,
  UserCircle,
} from "lucide-react";
import { NavLink, useNavigate } from "react-router-dom";
import { ProjectPicker } from "../../projects/components/ProjectPicker";
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
  const activeProject = workspace.projects.find((project) => project.id === projectId) ?? null;

  return (
    <div className="grid h-dvh min-w-[980px] grid-cols-[72px_minmax(0,1fr)] grid-rows-[48px_minmax(0,1fr)_28px] bg-background text-foreground">
      <header className="col-span-full flex items-center gap-4 border-b border-border bg-surface-panel px-3">
        <button
          type="button"
          className="flex items-center gap-2 font-semibold"
          onClick={() => navigate("/projects")}
        >
          <img
            src="/branding/narrativex-icon.png"
            alt="NarrativeX"
            width={22}
            height={22}
            className="size-[22px] rounded object-contain"
          />
          <span>NarrativeX</span>
        </button>
        <div className="min-w-0 max-w-[420px] flex-1">
          <ProjectPicker
            projects={workspace.projects}
            activeProjectId={activeProject?.id ?? projectId}
            onChange={(nextProjectId) => navigate(`/projects/${nextProjectId}/${screen}`)}
          />
        </div>
        <span className="ml-auto text-[10px] text-muted-foreground">
          {workspace.status === "ready"
            ? "Backend synced"
            : workspace.status === "loading"
              ? "Syncing workspace…"
              : workspace.status === "partial"
                ? "Partially synced"
                : workspace.status === "error"
                  ? "Backend unavailable"
                  : "Workspace ready"}
        </span>
      </header>

      <aside className="row-start-2 flex flex-col gap-1 border-r border-border bg-surface-panel p-2">
        {navigation.map(({ id, label, icon: Icon, segment }) => (
          <NavLink
            key={id}
            to={`/projects/${projectId}/${segment}`}
            className={({ isActive }) =>
              `flex min-h-[52px] flex-col items-center justify-center gap-1 rounded-md border text-[9px] transition-colors ${
                isActive || screen === id
                  ? "border-primary/30 bg-primary-muted text-primary-hover"
                  : "border-transparent text-muted-foreground hover:bg-secondary hover:text-foreground"
              }`
            }
            aria-label={label}
          >
            <Icon size={18} />
            <span>{label}</span>
          </NavLink>
        ))}
      </aside>

      <main className="row-start-2 min-h-0 min-w-0 overflow-hidden bg-background">
        {workspace.error && (
          <div className="border-b border-warning/30 bg-warning-bg px-4 py-2 text-[10px] text-warning">
            {workspace.error}
          </div>
        )}
        {children}
      </main>

      <footer className="col-span-full flex items-center justify-between border-t border-border bg-surface-panel px-3 text-[10px] text-muted-foreground">
        <span>{activeProject?.name ?? "NarrativeX project"}</span>
        <span>{workspace.timeline ? `${workspace.timeline.beats.length} visual beats` : "Timeline not loaded"}</span>
      </footer>
    </div>
  );
}
