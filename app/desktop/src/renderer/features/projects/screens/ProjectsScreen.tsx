import { useEffect, useState, type FormEvent } from "react";
import {
  Clapperboard,
  Film,
  Layers,
  Plus,
  RefreshCw,
  Search,
  Sparkles,
  Star,
  Trash2,
} from "lucide-react";
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
          /* Creative Studio Launchpad for Empty State on 24-inch Screens */
          <div className="mx-auto max-w-5xl py-4 sm:py-6">
            {/* Hero Launchpad Card */}
            <div className="relative overflow-hidden rounded-2xl border border-border/80 bg-gradient-to-b from-surface-elevated/90 via-surface-panel/80 to-surface-dark/95 p-8 sm:p-10 text-center shadow-[0_20px_50px_-15px_rgba(0,0,0,0.7)] backdrop-blur-sm">
              <div className="pointer-events-none absolute -top-24 left-1/2 -translate-x-1/2 size-72 rounded-full bg-primary/15 blur-3xl" />

              <div className="relative z-10 flex flex-col items-center">
                <div className="mb-4 inline-flex size-14 items-center justify-center rounded-2xl border border-primary/30 bg-primary-muted text-primary shadow-lg shadow-primary/20">
                  <Sparkles size={28} />
                </div>

                <h2 className="text-2xl sm:text-3xl font-bold tracking-tight text-foreground">
                  Chào mừng đến với NarrativeX Studio
                </h2>
                <p className="mt-2.5 max-w-xl text-[14px] leading-relaxed text-text-muted">
                  Không gian làm việc kịch bản, nhân vật, hình ảnh AI và dựng video tự động. Khởi tạo project để bắt đầu workflow trên desktop.
                </p>

                <div className="mt-6 flex flex-wrap items-center justify-center gap-3">
                  <Button size="lg" className="shadow-primary px-6 text-[14px]" onClick={() => setIsCreating(true)}>
                    <Plus size={16} /> Tạo project mới
                  </Button>
                  <Button variant="outline" size="lg" className="px-5 text-[14px]" onClick={() => void projects.refetch()}>
                    <RefreshCw size={14} /> Tải lại danh sách
                  </Button>
                </div>
              </div>
            </div>

            {/* Quick-Start Aspect Ratio Starter Templates */}
            <div className="mt-8">
              <div className="mb-3.5">
                <h3 className="text-[14px] font-semibold text-foreground">Bắt đầu nhanh theo định dạng khung hình</h3>
                <p className="text-[12px] text-text-muted">Chọn định dạng video phù hợp để khởi tạo project ngay lập tức.</p>
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
                {/* 16:9 Card */}
                <button
                  type="button"
                  onClick={() => {
                    setImageAspectRatio("16:9");
                    setIsCreating(true);
                  }}
                  className="group flex flex-col rounded-xl border border-border bg-surface-card p-5 text-left transition-all duration-200 hover:border-primary/50 hover:bg-surface-2 hover:shadow-lg cursor-pointer"
                >
                  <div className="flex items-center justify-between">
                    <div className="flex size-10 items-center justify-center rounded-lg border border-border-subtle bg-surface-dark text-text-secondary group-hover:border-primary/40 group-hover:text-primary">
                      <Film size={20} />
                    </div>
                    <span className="rounded-md border border-border-subtle bg-surface-dark px-2 py-0.5 font-mono text-[11px] font-semibold text-text-secondary">
                      16:9
                    </span>
                  </div>
                  <strong className="mt-3.5 text-[15px] font-semibold text-foreground group-hover:text-primary transition-colors">
                    Video Ngang Cinematic
                  </strong>
                  <p className="mt-1 text-[12.5px] leading-relaxed text-text-muted">
                    Tối ưu cho YouTube, phim ngắn, tài liệu diễn họa và màn hình ngang tiêu chuẩn.
                  </p>
                </button>

                {/* 9:16 Card */}
                <button
                  type="button"
                  onClick={() => {
                    setImageAspectRatio("9:16");
                    setIsCreating(true);
                  }}
                  className="group flex flex-col rounded-xl border border-border bg-surface-card p-5 text-left transition-all duration-200 hover:border-primary/50 hover:bg-surface-2 hover:shadow-lg cursor-pointer"
                >
                  <div className="flex items-center justify-between">
                    <div className="flex size-10 items-center justify-center rounded-lg border border-border-subtle bg-surface-dark text-text-secondary group-hover:border-primary/40 group-hover:text-primary">
                      <Clapperboard size={20} />
                    </div>
                    <span className="rounded-md border border-border-subtle bg-surface-dark px-2 py-0.5 font-mono text-[11px] font-semibold text-text-secondary">
                      9:16
                    </span>
                  </div>
                  <strong className="mt-3.5 text-[15px] font-semibold text-foreground group-hover:text-primary transition-colors">
                    Video Dọc Shorts & Reels
                  </strong>
                  <p className="mt-1 text-[12.5px] leading-relaxed text-text-muted">
                    Tối ưu cho TikTok, YouTube Shorts và Instagram Reels với phụ đề dynamic.
                  </p>
                </button>

                {/* 1:1 Card */}
                <button
                  type="button"
                  onClick={() => {
                    setImageAspectRatio("1:1");
                    setIsCreating(true);
                  }}
                  className="group flex flex-col rounded-xl border border-border bg-surface-card p-5 text-left transition-all duration-200 hover:border-primary/50 hover:bg-surface-2 hover:shadow-lg cursor-pointer"
                >
                  <div className="flex items-center justify-between">
                    <div className="flex size-10 items-center justify-center rounded-lg border border-border-subtle bg-surface-dark text-text-secondary group-hover:border-primary/40 group-hover:text-primary">
                      <Layers size={20} />
                    </div>
                    <span className="rounded-md border border-border-subtle bg-surface-dark px-2 py-0.5 font-mono text-[11px] font-semibold text-text-secondary">
                      1:1 / 4:3
                    </span>
                  </div>
                  <strong className="mt-3.5 text-[15px] font-semibold text-foreground group-hover:text-primary transition-colors">
                    Khung Vuông & Cổ Điển
                  </strong>
                  <p className="mt-1 text-[12.5px] leading-relaxed text-text-muted">
                    Phù hợp cho mạng xã hội, poster nghệ thuật, visual podcast và phong cách retro.
                  </p>
                </button>
              </div>
            </div>

            {/* Workflow Steps Infographic */}
            <div className="mt-8 rounded-xl border border-border-subtle bg-surface-dark/40 p-5">
              <span className="text-[11px] font-semibold uppercase tracking-wider text-text-dim">Quy trình sản xuất 3 bước</span>
              <div className="mt-3 grid grid-cols-1 sm:grid-cols-3 gap-4 text-[12.5px]">
                <div className="flex items-start gap-3">
                  <span className="flex size-6 shrink-0 items-center justify-center rounded-full bg-primary/20 text-primary font-bold text-[12px]">1</span>
                  <div>
                    <strong className="block text-foreground font-medium">Soạn kịch bản & phân tích</strong>
                    <span className="text-text-muted text-[12px]">Tự động tách cảnh, trích xuất nhân vật và định hình bối cảnh.</span>
                  </div>
                </div>
                <div className="flex items-start gap-3">
                  <span className="flex size-6 shrink-0 items-center justify-center rounded-full bg-primary/20 text-primary font-bold text-[12px]">2</span>
                  <div>
                    <strong className="block text-foreground font-medium">Duyệt Canon & giọng đọc</strong>
                    <span className="text-text-muted text-[12px]">Khoá diện mạo nhân vật và thiết lập giọng đọc lồng tiếng chuẩn xác.</span>
                  </div>
                </div>
                <div className="flex items-start gap-3">
                  <span className="flex size-6 shrink-0 items-center justify-center rounded-full bg-primary/20 text-primary font-bold text-[12px]">3</span>
                  <div>
                    <strong className="block text-foreground font-medium">Visual Beats & Render</strong>
                    <span className="text-text-muted text-[12px]">Sinh ảnh AI theo nhịp thời gian narration và xuất video thành phẩm.</span>
                  </div>
                </div>
              </div>
            </div>
          </div>
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

      <Dialog
        open={isCreating}
        onOpenChange={(open) => {
          if (!open && !createProject.isPending) setIsCreating(false);
        }}
      >
        <DialogContent
          className="w-[min(680px,calc(100vw-32px))] gap-5 bg-surface-panel p-6"
          aria-describedby="create-project-description"
        >
          <DialogCloseButton disabled={createProject.isPending} />
          <DialogHeader className="pr-6 text-left">
            <DialogTitle className="text-[18px] font-bold text-foreground">Create project</DialogTitle>
            <DialogDescription id="create-project-description" className="text-[13px] leading-relaxed text-text-muted">
              Khởi tạo workspace mới rồi mở thẳng vào Editor.
            </DialogDescription>
          </DialogHeader>

          <form className="grid gap-4" onSubmit={submitProject}>
            <div className="grid gap-4 md:grid-cols-[minmax(240px,1.2fr)_minmax(200px,.8fr)]">
              <label className="grid gap-2 text-[12px] font-medium text-text-secondary">
                <span>Tên project</span>
                <Input
                  autoFocus
                  value={name}
                  onChange={(event) => setName(event.target.value)}
                  maxLength={160}
                  placeholder="My next story"
                  className="h-10 text-[13.5px]"
                />
              </label>
              <div className="grid content-start gap-2 text-[12px] font-medium text-text-secondary">
                <label htmlFor="project-aspect-ratio">Khung hình</label>
                <div className="grid grid-cols-5 gap-1.5 mb-1">
                  {ASPECT_RATIOS.map((ratio) => {
                    const isSelected = imageAspectRatio === ratio.value;
                    return (
                      <button
                        key={ratio.value}
                        type="button"
                        onClick={() => setImageAspectRatio(ratio.value)}
                        className={`group flex flex-col items-center justify-center gap-1.5 rounded-lg border p-2 text-center transition-all cursor-pointer ${
                          isSelected
                            ? "border-primary bg-primary/10 text-primary shadow-xs"
                            : "border-border-subtle bg-surface-dark text-text-muted hover:border-border hover:bg-surface-3 hover:text-text-secondary"
                        }`}
                        title={ratio.label}
                      >
                        <div className="flex h-5 items-center justify-center">
                          <div
                            className={`rounded-xs border transition-colors ${
                              isSelected
                                ? "border-primary bg-primary/25"
                                : "border-border-subtle bg-surface-2 group-hover:border-border"
                            }`}
                            style={{
                              width: ratio.value === "16:9" ? "22px" : ratio.value === "9:16" ? "12px" : ratio.value === "1:1" ? "16px" : ratio.value === "4:3" ? "20px" : "15px",
                              height: ratio.value === "16:9" ? "12px" : ratio.value === "9:16" ? "20px" : ratio.value === "1:1" ? "16px" : ratio.value === "4:3" ? "15px" : "19px",
                            }}
                          />
                        </div>
                        <span className="font-mono text-[10px] font-semibold">{ratio.value}</span>
                      </button>
                    );
                  })}
                </div>
                <Select
                  value={imageAspectRatio}
                  onValueChange={(value) => setImageAspectRatio(value as ProjectAspectRatio)}
                >
                  <SelectTrigger id="project-aspect-ratio" className="w-full h-10 text-[13px]">
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
              <label className="grid gap-2 text-[12px] font-medium text-text-secondary md:col-span-2">
                <span>Mô tả (tuỳ chọn)</span>
                <Textarea
                  value={description}
                  onChange={(event) => setDescription(event.target.value)}
                  maxLength={2000}
                  placeholder="Mô tả tóm tắt về nội dung dự án..."
                  className="min-h-24"
                />
              </label>
            </div>

            {createProject.isError && (
              <p className="m-0 border-l-2 border-danger bg-danger-bg px-3 py-2 text-[12px] text-danger" role="alert">
                {createProject.error.message}
              </p>
            )}

            <div className="flex justify-end gap-3 border-t border-border-subtle pt-4">
              <Button
                type="button"
                variant="outline"
                size="default"
                disabled={createProject.isPending}
                onClick={() => setIsCreating(false)}
              >
                Cancel
              </Button>
              <Button type="submit" size="default" disabled={createProject.isPending || !name.trim()}>
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
          className="w-[min(460px,calc(100vw-32px))] gap-4 bg-surface-panel p-6"
          aria-describedby="delete-project-description"
        >
          <DialogCloseButton disabled={deleteProject.isPending} />
          <DialogHeader className="pr-6 text-left">
            <DialogTitle className="text-[16px] font-bold text-foreground">Xoá project?</DialogTitle>
            <DialogDescription id="delete-project-description" className="text-[13px] leading-relaxed text-text-muted">
              Project <strong className="font-semibold text-foreground">{projectToDelete?.name}</strong>{" "}
              sẽ biến mất khỏi workspace. Dữ liệu local vẫn được giữ lại để backup hoặc khôi phục.
            </DialogDescription>
          </DialogHeader>

          {deleteProject.isError && (
            <p className="m-0 border-l-2 border-danger bg-danger-bg px-3 py-2 text-[12px] text-danger" role="alert">
              Không thể xoá project: {deleteProject.error.message}
            </p>
          )}

          <div className="flex justify-end gap-3 border-t border-border-subtle pt-4">
            <Button
              variant="outline"
              size="default"
              disabled={deleteProject.isPending}
              onClick={() => setProjectToDelete(null)}
            >
              Huỷ
            </Button>
            <Button
              variant="destructive"
              size="default"
              disabled={deleteProject.isPending}
              onClick={confirmDeleteProject}
            >
              <Trash2 size={14} />
              {deleteProject.isPending ? "Đang xoá…" : "Xoá project"}
            </Button>
          </div>
        </DialogContent>
      </Dialog>
    </>
  );
}
