import { useEffect, useState, type FormEvent } from "react";
import { FolderOpen, Plus, RefreshCw, Star } from "lucide-react";
import { useNavigate } from "react-router-dom";
import { ProjectCard } from "../components/ProjectCard";
import { useCreateProject, useProjectsQuery, useToggleProjectFavorite } from "../queries/projects.queries";
import { useProjectSessionStore } from "../store/project-session.store";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";

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

  if (projects.isPending) return <main className="grid min-h-full place-items-center bg-[var(--bg)] p-10 text-sm text-[var(--text-3)]">Đang tải projects…</main>;
  if (projects.isError) return <main className="grid min-h-full place-items-center bg-[var(--bg)] p-10"><div className="grid max-w-sm justify-items-center gap-2 text-center text-[var(--text-3)]"><strong className="text-[var(--text)]">Không thể tải projects</strong><span>{projects.error.message}</span><Button variant="outline" size="sm" onClick={() => void projects.refetch()}><RefreshCw size={15} /> Thử lại</Button></div></main>;

  async function submitProject(event: FormEvent) {
    event.preventDefault();
    if (!name.trim()) return;
    const project = await createProject.mutateAsync({ name: name.trim(), description: description.trim() || undefined });
    setName("");
    setDescription("");
    setIsCreating(false);
    setActiveProject(project.id);
    navigate(`/projects/${project.id}/editor`);
  }

  return <main className="min-h-full overflow-auto bg-[var(--bg)] p-10 md:p-14"><header className="mb-7 flex items-end justify-between gap-5"><div><span className="block text-[9px] font-bold uppercase tracking-[.13em] text-[var(--text-3)]">Workspace</span><h1 className="mt-1 text-[27px] font-semibold text-[var(--text)]">Projects</h1><p className="mt-1 text-sm text-[var(--text-3)]">Tạo và mở project trực tiếp trong NarrativeX Desktop.</p></div><div className="flex gap-2"><Button variant="outline" size="sm" onClick={() => setIsCreating((value) => !value)}><Plus size={15} /> New project</Button><Button variant="outline" size="sm" onClick={() => void projects.refetch()}><RefreshCw size={15} /> Refresh</Button></div></header>
    {isCreating && <form className="mb-6 grid max-w-xl gap-3 rounded-lg border border-[var(--border)] bg-[var(--surface)] p-[18px]" onSubmit={(event) => void submitProject(event)}><label className="grid gap-1.5 text-[11px] text-[var(--text-2)]"><span>Name</span><Input autoFocus value={name} onChange={(event) => setName(event.target.value)} maxLength={160} placeholder="My next story" /></label><label className="grid gap-1.5 text-[11px] text-[var(--text-2)]"><span>Description</span><Textarea value={description} onChange={(event) => setDescription(event.target.value)} maxLength={2000} placeholder="Optional project description" className="min-h-[76px]" /></label>{createProject.isError && <p className="m-0 text-[11px] text-[var(--danger)]">{createProject.error.message}</p>}<div className="flex justify-end gap-2"><Button type="button" variant="outline" size="sm" onClick={() => setIsCreating(false)}>Cancel</Button><Button type="submit" size="sm" disabled={createProject.isPending || !name.trim()}>{createProject.isPending ? "Creating…" : "Create project"}</Button></div></form>}
    {projects.data.content.length === 0 ? <div className="grid min-h-[260px] place-content-center justify-items-center gap-2 text-center text-[var(--text-3)]"><FolderOpen size={25} /><strong className="text-[var(--text)]">Chưa có project</strong><span>Tạo project mới để bắt đầu workflow trên desktop.</span></div> : <div className="grid grid-cols-[repeat(auto-fill,minmax(270px,1fr))] gap-3.5">{projects.data.content.map((project) => <div className="relative min-w-0" key={project.id}><ProjectCard project={project} onOpen={() => { setActiveProject(project.id); navigate(`/projects/${project.id}/editor`); }} /><button type="button" className="absolute right-3 top-3 text-[var(--text-3)] transition-colors hover:text-[var(--amber)]" aria-label={project.isStarred ? "Remove favorite" : "Add favorite"} onClick={() => void toggleFavorite.mutateAsync({ projectId: project.id, starred: Boolean(project.isStarred) })}><Star size={14} fill={project.isStarred ? "currentColor" : "none"} /></button></div>)}</div>}
  </main>;
}
