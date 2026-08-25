import { useEffect, useState, type FormEvent } from "react";
import { FolderOpen, Plus, RefreshCw, Star } from "lucide-react";
import { useNavigate } from "react-router-dom";
import { ProjectCard } from "../components/ProjectCard";
import { useCreateProject, useProjectsQuery, useToggleProjectFavorite } from "../queries/projects.queries";
import { useProjectSessionStore } from "../store/project-session.store";
import "../projects.css";

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

  if (projects.isPending) return <main className="projects-screen"><div className="projects-state">Đang tải projects…</div></main>;
  if (projects.isError) return <main className="projects-screen"><div className="projects-state"><strong>Không thể tải projects</strong><span>{projects.error.message}</span><button type="button" onClick={() => void projects.refetch()}><RefreshCw size={15} /> Thử lại</button></div></main>;

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

  return <main className="projects-screen"><header className="projects-header"><div><span className="eyebrow">Workspace</span><h1>Projects</h1><p>Tạo và mở project trực tiếp trong NarrativeX Desktop.</p></div><div className="projects-header-actions"><button type="button" className="projects-refresh" onClick={() => setIsCreating((value) => !value)}><Plus size={15} /> New project</button><button type="button" className="projects-refresh" onClick={() => void projects.refetch()}><RefreshCw size={15} /> Refresh</button></div></header>
    {isCreating && <form className="project-create-form" onSubmit={(event) => void submitProject(event)}><label><span>Name</span><input autoFocus value={name} onChange={(event) => setName(event.target.value)} maxLength={160} placeholder="My next story" /></label><label><span>Description</span><textarea value={description} onChange={(event) => setDescription(event.target.value)} maxLength={2000} placeholder="Optional project description" /></label>{createProject.isError && <p className="form-error">{createProject.error.message}</p>}<div className="project-form-actions"><button type="button" className="projects-refresh" onClick={() => setIsCreating(false)}>Cancel</button><button type="submit" className="projects-primary" disabled={createProject.isPending || !name.trim()}>{createProject.isPending ? "Creating…" : "Create project"}</button></div></form>}
    {projects.data.content.length === 0 ? <div className="projects-state"><FolderOpen size={25} /><strong>Chưa có project</strong><span>Tạo project mới để bắt đầu workflow trên desktop.</span></div> : <div className="project-grid">{projects.data.content.map((project) => <div className="project-card-wrap" key={project.id}><ProjectCard project={project} onOpen={() => { setActiveProject(project.id); navigate(`/projects/${project.id}/editor`); }} /><button type="button" className="project-favorite" aria-label={project.isStarred ? "Remove favorite" : "Add favorite"} onClick={() => void toggleFavorite.mutateAsync({ projectId: project.id, starred: Boolean(project.isStarred) })}><Star size={14} fill={project.isStarred ? "currentColor" : "none"} /></button></div>)}</div>}
  </main>;
}
