import { useEffect } from "react";
import { FolderOpen, RefreshCw } from "lucide-react";
import { useNavigate } from "react-router-dom";
import { ProjectCard } from "../components/ProjectCard";
import { useProjectsQuery } from "../queries/projects.queries";
import { useProjectSessionStore } from "../store/project-session.store";
import "../projects.css";

export function ProjectsScreen() {
  const navigate = useNavigate();
  const projects = useProjectsQuery();
  const activeProjectId = useProjectSessionStore((state) => state.activeProjectId);
  const setActiveProject = useProjectSessionStore((state) => state.setActiveProject);

  useEffect(() => {
    const firstProject = projects.data?.content[0];
    if (!activeProjectId && firstProject) setActiveProject(firstProject.id);
  }, [activeProjectId, projects.data, setActiveProject]);

  if (projects.isPending) return <main className="projects-screen"><div className="projects-state">Đang tải projects…</div></main>;
  if (projects.isError) return <main className="projects-screen"><div className="projects-state"><strong>Không thể tải projects</strong><span>{projects.error.message}</span><button type="button" onClick={() => void projects.refetch()}><RefreshCw size={15} /> Thử lại</button></div></main>;

  return <main className="projects-screen"><header className="projects-header"><div><span className="eyebrow">Workspace</span><h1>Projects</h1><p>Chọn project để mở workspace desktop.</p></div><button type="button" className="projects-refresh" onClick={() => void projects.refetch()}><RefreshCw size={15} /> Refresh</button></header>
    {projects.data.content.length === 0 ? <div className="projects-state"><FolderOpen size={25} /><strong>Chưa có project</strong><span>Tạo project trong web app hoặc API rồi quay lại đây.</span></div> : <div className="project-grid">{projects.data.content.map((project) => <ProjectCard key={project.id} project={project} onOpen={() => { setActiveProject(project.id); navigate(`/projects/${project.id}/editor`); }} />)}</div>}
  </main>;
}
