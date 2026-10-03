import { useEffect, useState, type FormEvent } from "react";
import {
  Plus,
  RefreshCw,
  Search,
  Star,
  Trash2,
} from "lucide-react";
import type { DesktopProject, ProjectAspectRatio } from "@narrativex/client-contracts";
import { useNavigate } from "react-router-dom";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";

import { Input } from "@/components/ui/input";

import { CreateProjectDialog, DeleteProjectDialog } from "../components/ProjectDialogs";
import { FeaturePage } from "../../workspace/components/FeaturePage";
import { ProjectsEmptyState } from "../components/ProjectsEmptyState";
import { ProjectCard } from "../components/ProjectCard";
import {
  useCreateProject,
  useDeleteProject,
  useProjectsQuery,
  useToggleProjectFavorite,
} from "../queries/projects.queries";
import { useProjectSessionStore } from "../store/project-session.store";

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
  const [searchQuery, setSearchQuery] = useState("");
  const [filterTab, setFilterTab] = useState<"all" | "starred">("all");
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
        <div className="grid min-h-64 place-items-center text-[13px] text-text-muted" role="status">
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
        <div className="grid min-h-64 place-items-center">
          <div className="max-w-md rounded-xl border border-danger/30 bg-danger-bg p-5 text-[13px] text-danger">
            <strong className="block text-[15px] font-semibold">Không thể tải projects</strong>
            <span className="mt-1.5 block leading-relaxed">{projects.error.message}</span>
            <Button variant="outline" size="default" onClick={() => void projects.refetch()} className="mt-4">
              <RefreshCw size={14} /> Thử lại
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

  const allProjects = projects.data.content;
  const projectCount = allProjects.length;
  const starredCount = allProjects.filter((p) => p.isStarred).length;

  const filteredProjects = allProjects.filter((project) => {
    if (filterTab === "starred" && !project.isStarred) return false;
    if (!searchQuery.trim()) return true;
    const query = searchQuery.trim().toLowerCase();
    return (
      project.name.toLowerCase().includes(query) ||
      (project.description && project.description.toLowerCase().includes(query))
    );
  });

  return (
    <>
      <FeaturePage
        eyebrow="Workspace"
        title="Projects"
        description="Tạo, mở và quản lý project trực tiếp trong NarrativeX Desktop."
        actions={
          <div className="flex flex-wrap items-center gap-3">
            <div className="relative w-64 sm:w-72 lg:w-80">
              <Search size={15} className="pointer-events-none absolute left-3 top-1/2 -translate-y-1/2 text-text-dim" />
              <Input
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                placeholder="Tìm kiếm project…"
                className="h-9 pl-9 pr-3 text-[13px]"
              />
            </div>
            <div className="flex items-center rounded-lg border border-border-subtle bg-surface-dark p-0.5">
              <button
                type="button"
                onClick={() => setFilterTab("all")}
                className={`rounded-md px-3.5 py-1 text-[12px] font-medium transition-colors ${
                  filterTab === "all"
                    ? "bg-surface-3 text-foreground shadow-xs"
                    : "text-text-muted hover:text-text-secondary"
                }`}
              >
                All ({projectCount})
              </button>
              <button
                type="button"
                onClick={() => setFilterTab("starred")}
                className={`inline-flex items-center gap-1.5 rounded-md px-3.5 py-1 text-[12px] font-medium transition-colors ${
                  filterTab === "starred"
                    ? "bg-surface-3 text-foreground shadow-xs"
                    : "text-text-muted hover:text-text-secondary"
                }`}
              >
                <Star size={12} className={filterTab === "starred" ? "text-warning fill-current" : ""} />
                Starred ({starredCount})
              </button>
            </div>
            <Button size="default" onClick={() => setIsCreating(true)} className="shadow-primary font-medium">
              <Plus size={15} /> New project
            </Button>
            <Button variant="outline" size="default" onClick={() => void projects.refetch()}>
              <RefreshCw size={14} /> Refresh
            </Button>
          </div>
        }
      >
        {toggleFavorite.isError && (
          <p className="mb-4 border-l-2 border-danger bg-danger-bg px-3 py-2 text-[12px] text-danger" role="alert">
            Không thể cập nhật favorite: {toggleFavorite.error.message}
          </p>
        )}

        {projectCount === 0 ? (
          <ProjectsEmptyState onCreate={(ratio) => {
            if (ratio) setImageAspectRatio(ratio);
            setIsCreating(true);
          }} onRefresh={() => void projects.refetch()} />
        ) : filteredProjects.length === 0 ? (
          <div className="grid min-h-60 place-items-center text-center">
            <div className="max-w-sm rounded-xl border border-border bg-surface-card p-6">
              <p className="text-[15px] font-semibold text-foreground">Không tìm thấy project phù hợp</p>
              <p className="mt-1.5 text-[13px] text-text-muted">Thử tìm với từ khoá khác hoặc xoá bộ lọc đang chọn.</p>
              <Button
                variant="outline"
                size="default"
                className="mt-4"
                onClick={() => {
                  setSearchQuery("");
                  setFilterTab("all");
                }}
              >
                Xoá bộ lọc
              </Button>
            </div>
          </div>
        ) : (
          <div className="mx-auto max-w-[1600px] w-full">
            {/* Quick Workspace Stats Strip */}
            <div className="mb-6 flex flex-wrap items-center justify-between gap-4 border-b border-border-subtle pb-4">
              <div className="flex items-center gap-4 sm:gap-6 text-[13px] text-text-muted">
                <span>Tổng cộng: <strong className="font-semibold text-foreground">{projectCount}</strong> dự án</span>
                <span>•</span>
                <span>Yêu thích: <strong className="font-semibold text-foreground">{starredCount}</strong></span>
                <span>•</span>
                <span>Đang hoạt động: <strong className="font-semibold text-success">{allProjects.filter((p) => p.status === "ACTIVE").length}</strong></span>
              </div>
              <span className="text-[12px] text-text-dim">Mẹo: Bấm vào thẻ để mở thẳng vào timeline dựng video</span>
            </div>

            <div className="grid grid-cols-[repeat(auto-fill,minmax(340px,1fr))] gap-6">
              {filteredProjects.map((project) => (
                <div className="relative min-w-0" key={project.id}>
                  <ProjectCard
                    project={project}
                    onOpen={() => {
                      setActiveProject(project.id);
                      navigate(`/projects/${project.id}/editor`);
                    }}
                  />
                  <div className="absolute right-4 top-4 flex items-center gap-1.5">
                    <button
                      type="button"
                      className="flex size-8 items-center justify-center rounded-lg border border-border-subtle bg-surface-dark/90 text-text-dim backdrop-blur-sm transition-colors hover:border-border hover:bg-surface-3 hover:text-warning disabled:cursor-not-allowed disabled:opacity-50"
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
                        size={14}
                        className={project.isStarred ? "text-warning" : "text-text-dim"}
                        fill={project.isStarred ? "currentColor" : "none"}
                      />
                    </button>
                    <button
                      type="button"
                      className="flex size-8 items-center justify-center rounded-lg border border-border-subtle bg-surface-dark/90 text-text-dim backdrop-blur-sm transition-colors hover:border-danger/30 hover:bg-danger-bg hover:text-danger disabled:cursor-not-allowed disabled:opacity-50"
                      aria-label={`Xoá project ${project.name}`}
                      disabled={deleteProject.isPending}
                      onClick={() => {
                        deleteProject.reset();
                        setProjectToDelete(project);
                      }}
                    >
                      <Trash2 size={14} />
                    </button>
                  </div>
                </div>
              ))}
            </div>
          </div>
        )}
      </FeaturePage>

      <CreateProjectDialog open={isCreating} onOpenChange={setIsCreating}
        name={name} setName={setName} description={description} setDescription={setDescription}
        imageAspectRatio={imageAspectRatio} setImageAspectRatio={setImageAspectRatio}
        isPending={createProject.isPending} error={createProject.error} onSubmit={submitProject} />
      <DeleteProjectDialog project={projectToDelete} onClose={() => setProjectToDelete(null)}
        isPending={deleteProject.isPending} error={deleteProject.error} onConfirm={confirmDeleteProject} />
    </>
  );
}
