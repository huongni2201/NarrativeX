import { useEffect, useState, type FormEvent } from "react";
import { Plus, RefreshCw, Star, Trash2 } from "lucide-react";
import type { DesktopProject, ProjectAspectRatio } from "@narrativex/client-contracts";
import { useNavigate } from "react-router-dom";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogCloseButton,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Textarea } from "@/components/ui/textarea";
import { EmptyState, FeaturePage } from "../../workspace/components/FeaturePage";
import { ProjectCard } from "../components/ProjectCard";
import {
  useCreateProject,
  useDeleteProject,
  useProjectsQuery,
  useToggleProjectFavorite,
} from "../queries/projects.queries";
import { useProjectSessionStore } from "../store/project-session.store";

const ASPECT_RATIOS: ReadonlyArray<{
  value: ProjectAspectRatio;
  label: string;
}> = [
  { value: "16:9", label: "16:9 · Ngang" },
  { value: "9:16", label: "9:16 · Dọc" },
  { value: "1:1", label: "1:1 · Vuông" },
  { value: "4:3", label: "4:3 · Ngang cổ điển" },
  { value: "3:4", label: "3:4 · Dọc cổ điển" },
];

export function ProjectsScreen() {
  const navigate = useNavigate();
  const projects = useProjectsQuery();
  const createProject = useCreateProject();
  const deleteProject = useDeleteProject();
  const toggleFavorite = useToggleProjectFavorite();
  const [isCreating, setIsCreating] = useState(false);
  const [name, setName] = useState("");
  const [description, setDescription] = useState("");
  const [imageAspectRatio, setImageAspectRatio] = useState<ProjectAspectRatio>("16:9");
  const [projectToDelete, setProjectToDelete] = useState<DesktopProject | null>(null);
  const activeProjectId = useProjectSessionStore((state) => state.activeProjectId);
  const setActiveProject = useProjectSessionStore((state) => state.setActiveProject);
  const clearActiveProject = useProjectSessionStore((state) => state.clearActiveProject);

  useEffect(() => {
    const firstProject = projects.data?.content[0];
    if (!activeProjectId && firstProject) setActiveProject(firstProject.id);
  }, [activeProjectId, projects.data, setActiveProject]);

  if (projects.isPending) {
    return (
      <FeaturePage
        eyebrow="Workspace"
        title="Projects"
        description="Tạo, mở và quản lý project trực tiếp trong NarrativeX Desktop."
      >
        <div className="grid min-h-48 place-items-center text-[11px] text-text-muted" role="status">
          Đang tải projects…
        </div>
      </FeaturePage>
    );
  }

  if (projects.isError) {
    return (
      <FeaturePage
        eyebrow="Workspace"
        title="Projects"
        description="Tạo, mở và quản lý project trực tiếp trong NarrativeX Desktop."
      >
        <div className="grid min-h-48 place-items-center">
          <div className="max-w-sm border-l-2 border-danger bg-danger-bg px-4 py-3 text-[11px] text-danger">
            <strong className="block font-semibold">Không thể tải projects</strong>
            <span className="mt-1 block leading-4">{projects.error.message}</span>
            <Button variant="outline" size="sm" onClick={() => void projects.refetch()} className="mt-3">
              <RefreshCw size={12} /> Thử lại
            </Button>
          </div>
        </div>
      </FeaturePage>
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
        imageAspectRatio,
      },
      {
        onSuccess: (project) => {
          setName("");
          setDescription("");
          setImageAspectRatio("16:9");
          setIsCreating(false);
          setActiveProject(project.id);
          navigate(`/projects/${project.id}/editor`);
        },
      },
    );
  }

  function confirmDeleteProject() {
    if (!projectToDelete || deleteProject.isPending) return;
    const project = projectToDelete;
    deleteProject.mutate(project.id, {
      onSuccess: () => {
        if (activeProjectId === project.id) clearActiveProject();
        setProjectToDelete(null);
        toast.success(`Đã xoá project “${project.name}”.`);
      },
    });
  }

  const projectCount = projects.data.content.length;

  return (
    <>
      <FeaturePage
        eyebrow="Workspace"
        title="Projects"
        description="Tạo, mở và quản lý project trực tiếp trong NarrativeX Desktop."
        actions={
          <>
            <span className="mr-1 text-[10px] tabular-nums text-text-dim">{projectCount} projects</span>
            <Button size="sm" onClick={() => setIsCreating(true)}>
              <Plus size={12} /> New project
            </Button>
            <Button variant="outline" size="sm" onClick={() => void projects.refetch()}>
              <RefreshCw size={12} /> Refresh
            </Button>
          </>
        }
      >
        {toggleFavorite.isError && (
          <p className="mb-3 border-l-2 border-danger bg-danger-bg px-2.5 py-2 text-[10px] text-danger" role="alert">
            Không thể cập nhật favorite: {toggleFavorite.error.message}
          </p>
        )}

        {projectCount === 0 ? (
          <EmptyState title="Chưa có project" description="Tạo project mới để bắt đầu workflow trên desktop." />
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
                <div className="absolute right-2 top-2 flex items-center gap-1">
                  <button
                    type="button"
                    className="nx-icon-button size-7 disabled:cursor-not-allowed disabled:opacity-50"
                    aria-label={project.isStarred ? "Remove favorite" : "Add favorite"}
                    disabled={toggleFavorite.isPending || deleteProject.isPending}
                    onClick={() =>
                      toggleFavorite.mutate({
                        projectId: project.id,
                        desiredStarred: !project.isStarred,
                      })
                    }
                  >
                    <Star
                      size={12}
                      className={project.isStarred ? "text-warning" : "text-text-dim"}
                      fill={project.isStarred ? "currentColor" : "none"}
                    />
                  </button>
                  <button
                    type="button"
                    className="nx-icon-button size-7 text-text-dim hover:bg-danger-bg hover:text-danger disabled:cursor-not-allowed disabled:opacity-50"
                    aria-label={`Xoá project ${project.name}`}
                    disabled={deleteProject.isPending}
                    onClick={() => {
                      deleteProject.reset();
                      setProjectToDelete(project);
                    }}
                  >
                    <Trash2 size={12} />
                  </button>
                </div>
              </div>
            ))}
          </div>
        )}
      </FeaturePage>

      <Dialog
        open={isCreating}
        onOpenChange={(open) => {
          if (!open && !createProject.isPending) setIsCreating(false);
        }}
      >
        <DialogContent
          className="w-[min(640px,calc(100vw-32px))] gap-4 bg-surface-panel p-5"
          aria-describedby="create-project-description"
        >
          <DialogCloseButton disabled={createProject.isPending} />
          <DialogHeader className="pr-6 text-left">
            <DialogTitle className="text-[14px] text-foreground">Create project</DialogTitle>
            <DialogDescription id="create-project-description" className="text-[11px] leading-5 text-text-muted">
              Khởi tạo workspace mới rồi mở thẳng vào Editor.
            </DialogDescription>
          </DialogHeader>

          <form className="grid gap-3" onSubmit={submitProject}>
            <div className="grid gap-3 md:grid-cols-[minmax(220px,1.2fr)_minmax(180px,.8fr)]">
              <label className="grid gap-1.5 text-[10px] font-medium text-text-secondary">
                <span>Name</span>
                <Input
                  autoFocus
                  value={name}
                  onChange={(event) => setName(event.target.value)}
                  maxLength={160}
                  placeholder="My next story"
                />
              </label>
              <div className="grid content-start gap-1.5 text-[10px] font-medium text-text-secondary">
                <label htmlFor="project-aspect-ratio">Khung hình</label>
                <Select
                  value={imageAspectRatio}
                  onValueChange={(value) => setImageAspectRatio(value as ProjectAspectRatio)}
                >
                  <SelectTrigger id="project-aspect-ratio" className="w-full">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    {ASPECT_RATIOS.map((ratio) => (
                      <SelectItem key={ratio.value} value={ratio.value}>
                        {ratio.label}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
              <label className="grid gap-1.5 text-[10px] font-medium text-text-secondary md:col-span-2">
                <span>Description</span>
                <Textarea
                  value={description}
                  onChange={(event) => setDescription(event.target.value)}
                  maxLength={2000}
                  placeholder="Optional project description"
                  className="min-h-24"
                />
              </label>
            </div>

            {createProject.isError && (
              <p className="m-0 border-l-2 border-danger bg-danger-bg px-2.5 py-2 text-[10px] text-danger" role="alert">
                {createProject.error.message}
              </p>
            )}

            <div className="flex justify-end gap-2 border-t border-border-subtle pt-3">
              <Button
                type="button"
                variant="outline"
                size="sm"
                disabled={createProject.isPending}
                onClick={() => setIsCreating(false)}
              >
                Cancel
              </Button>
              <Button type="submit" size="sm" disabled={createProject.isPending || !name.trim()}>
                {createProject.isPending ? "Creating…" : "Create project"}
              </Button>
            </div>
          </form>
        </DialogContent>
      </Dialog>

      <Dialog
        open={projectToDelete !== null}
        onOpenChange={(open) => {
          if (!open && !deleteProject.isPending) setProjectToDelete(null);
        }}
      >
        <DialogContent
          className="w-[min(420px,calc(100vw-32px))] gap-3 bg-surface-panel p-5"
          aria-describedby="delete-project-description"
        >
          <DialogCloseButton disabled={deleteProject.isPending} />
          <DialogHeader className="pr-6 text-left">
            <DialogTitle className="text-[14px] text-foreground">Xoá project?</DialogTitle>
            <DialogDescription id="delete-project-description" className="text-[11px] leading-5 text-text-muted">
              Project <strong className="font-semibold text-foreground">{projectToDelete?.name}</strong>{" "}
              sẽ biến mất khỏi workspace. Dữ liệu local vẫn được giữ lại để backup hoặc khôi phục.
            </DialogDescription>
          </DialogHeader>

          {deleteProject.isError && (
            <p className="m-0 border-l-2 border-danger bg-danger-bg px-2.5 py-2 text-[10px] text-danger" role="alert">
              Không thể xoá project: {deleteProject.error.message}
            </p>
          )}

          <div className="flex justify-end gap-2 border-t border-border-subtle pt-3">
            <Button
              variant="outline"
              size="sm"
              disabled={deleteProject.isPending}
              onClick={() => setProjectToDelete(null)}
            >
              Huỷ
            </Button>
            <Button
              variant="destructive"
              size="sm"
              disabled={deleteProject.isPending}
              onClick={confirmDeleteProject}
            >
              <Trash2 size={12} />
              {deleteProject.isPending ? "Đang xoá…" : "Xoá project"}
            </Button>
          </div>
        </DialogContent>
      </Dialog>
    </>
  );
}
