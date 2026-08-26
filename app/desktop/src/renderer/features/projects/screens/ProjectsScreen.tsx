import { useEffect, useState, type FormEvent } from "react";
import { FolderOpen, Plus, RefreshCw, Star } from "lucide-react";
import { useNavigate } from "react-router-dom";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { ProjectCard } from "../components/ProjectCard";
import {
  useCreateProject,
  useProjectsQuery,
  useToggleProjectFavorite,
} from "../queries/projects.queries";
import { useProjectSessionStore } from "../store/project-session.store";

export function ProjectsScreen() {
  const navigate = useNavigate();
  const projects = useProjectsQuery();
  const createProject = useCreateProject();
  const toggleFavorite = useToggleProjectFavorite();
  const [isCreating, setIsCreating] = useState(false);
  const [name, setName] = useState("");
  const [description, setDescription] = useState("");
  const activeProjectId = useProjectSessionStore((state) => state.activeProjectId);
  const setActiveProject = useProjectSessionStore((state) => state.setActiveProject);

  useEffect(() => {
    const firstProject = projects.data?.content[0];
    if (!activeProjectId && firstProject) setActiveProject(firstProject.id);
  }, [activeProjectId, projects.data, setActiveProject]);

  if (projects.isPending) {
    return (
      <main className="grid h-full place-items-center bg-background p-8 text-[10px] text-text-muted">
        Đang tải projects…
      </main>
    );
  }

  if (projects.isError) {
    return (
      <main className="grid h-full place-items-center bg-background p-8">
        <div className="grid max-w-sm justify-items-center gap-2 rounded-md border border-border bg-surface-panel p-5 text-center text-[10px] text-text-muted">
          <strong className="text-[11px] text-foreground">Không thể tải projects</strong>
          <span>{projects.error.message}</span>
          <Button variant="outline" size="sm" onClick={() => void projects.refetch()} className="h-8 text-[10px]">
            <RefreshCw size={12} /> Thử lại
          </Button>
        </div>
      </main>
    );
  }

  function submitProject(event: FormEvent) {
    event.preventDefault();
    const projectName = name.trim();
    if (!projectName || createProject.isPending) return;

    createProject.mutate(
      {
        name: projectName,
        description: description.trim() || undefined,
      },
      {
        onSuccess: (project) => {
          setName("");
          setDescription("");
          setIsCreating(false);
          setActiveProject(project.id);
          navigate(`/projects/${project.id}/editor`);
        },
      },
    );
  }

  const projectCount = projects.data.content.length;

  return (
    <main className="grid h-full min-h-0 grid-rows-[auto_minmax(0,1fr)] bg-background text-foreground">
      <header className="flex min-h-14 items-center justify-between gap-4 border-b border-border-subtle bg-surface-dark px-5 py-2.5">
        <div className="min-w-0">
          <div className="flex items-center gap-2">
            <span className="text-[8px] font-bold uppercase tracking-[0.14em] text-text-dim">Workspace</span>
            <span className="h-3 w-px bg-border-subtle" aria-hidden="true" />
            <h1 className="text-sm font-semibold text-foreground">Projects</h1>
            <span className="rounded-sm border border-border bg-surface-2 px-1.5 py-0.5 text-[8px] text-text-muted">
              {projectCount}
            </span>
          </div>
          <p className="mt-1 text-[10px] text-text-muted">
            Tạo, mở và quản lý project trực tiếp trong NarrativeX Desktop.
          </p>
        </div>

        <div className="flex shrink-0 items-center gap-2">
          <Button
            size="sm"
            onClick={() => setIsCreating((value) => !value)}
            className="h-8 gap-1.5 px-3 text-[10px]"
          >
            <Plus size={12} /> New project
          </Button>
          <Button
            variant="outline"
            size="sm"
            onClick={() => void projects.refetch()}
            className="h-8 gap-1.5 border-border bg-surface-input px-3 text-[10px] text-text-secondary hover:bg-surface-2"
          >
            <RefreshCw size={12} /> Refresh
          </Button>
        </div>
      </header>

      <div className="min-h-0 overflow-auto p-4">
        {isCreating && (
          <form
            className="mb-4 grid max-w-2xl gap-3 rounded-md border border-border bg-surface-panel p-3"
            onSubmit={submitProject}
          >
            <div className="flex items-start justify-between gap-4 border-b border-border-subtle pb-2.5">
              <div>
                <h2 className="text-[11px] font-semibold text-foreground">Create project</h2>
                <p className="mt-0.5 text-[9px] text-text-muted">Khởi tạo workspace mới rồi mở thẳng vào Editor.</p>
              </div>
              <span className="rounded-sm border border-primary/25 bg-primary-muted px-1.5 py-0.5 text-[8px] font-medium text-primary-hover">
                New
              </span>
            </div>

            <div className="grid gap-3 md:grid-cols-[minmax(220px,.8fr)_minmax(0,1.2fr)]">
              <label className="grid gap-1 text-[9px] font-medium text-text-secondary">
                <span>Name</span>
                <Input
                  autoFocus
                  value={name}
                  onChange={(event) => setName(event.target.value)}
                  maxLength={160}
                  placeholder="My next story"
                  className="h-8 border-border bg-surface-input text-[10px]"
                />
              </label>
              <label className="grid gap-1 text-[9px] font-medium text-text-secondary">
                <span>Description</span>
                <Textarea
                  value={description}
                  onChange={(event) => setDescription(event.target.value)}
                  maxLength={2000}
                  placeholder="Optional project description"
                  className="min-h-16 border-border bg-surface-input text-[10px]"
                />
              </label>
            </div>

            {createProject.isError && (
              <p className="m-0 rounded-sm border border-danger-border bg-danger-bg px-2 py-1.5 text-[9px] text-danger" role="alert">
                {createProject.error.message}
              </p>
            )}

            <div className="flex justify-end gap-2 border-t border-border-subtle pt-2.5">
              <Button
                type="button"
                variant="outline"
                size="sm"
                onClick={() => setIsCreating(false)}
                className="h-8 text-[10px]"
              >
                Cancel
              </Button>
              <Button
                type="submit"
                size="sm"
                disabled={createProject.isPending || !name.trim()}
                className="h-8 text-[10px]"
              >
                {createProject.isPending ? "Creating…" : "Create project"}
              </Button>
            </div>
          </form>
        )}

        {toggleFavorite.isError && (
          <p className="mb-3 rounded-sm border border-danger-border bg-danger-bg px-2 py-1.5 text-[9px] text-danger" role="alert">
            Không thể cập nhật favorite: {toggleFavorite.error.message}
          </p>
        )}

        {projectCount === 0 ? (
          <div className="grid min-h-56 place-content-center justify-items-center gap-2 rounded-md border border-dashed border-border bg-surface-panel text-center text-[10px] text-text-muted">
            <FolderOpen size={22} />
            <strong className="text-[11px] text-foreground">Chưa có project</strong>
            <span>Tạo project mới để bắt đầu workflow trên desktop.</span>
          </div>
        ) : (
          <div className="grid grid-cols-[repeat(auto-fill,minmax(250px,1fr))] gap-2.5">
            {projects.data.content.map((project) => (
              <div className="relative min-w-0" key={project.id}>
                <ProjectCard
                  project={project}
                  onOpen={() => {
                    setActiveProject(project.id);
                    navigate(`/projects/${project.id}/editor`);
                  }}
                />
                <button
                  type="button"
                  className="nx-icon-button absolute right-2 top-2 size-6 disabled:cursor-not-allowed disabled:opacity-50"
                  aria-label={project.isStarred ? "Remove favorite" : "Add favorite"}
                  disabled={toggleFavorite.isPending}
                  onClick={() =>
                    toggleFavorite.mutate({
                      projectId: project.id,
                      starred: Boolean(project.isStarred),
                    })
                  }
                >
                  <Star
                    size={12}
                    className={project.isStarred ? "text-warning" : "text-text-dim"}
                    fill={project.isStarred ? "currentColor" : "none"}
                  />
                </button>
              </div>
            ))}
          </div>
        )}
      </div>
    </main>
  );
}
