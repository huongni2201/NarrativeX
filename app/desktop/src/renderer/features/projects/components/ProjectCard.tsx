import { FolderOpen, Layers3 } from "lucide-react";
import type { DesktopProject } from "@narrativex/client-contracts";

export function ProjectCard({ project, onOpen }: Readonly<{ project: DesktopProject; onOpen: () => void }>) {
  return (
    <button type="button" className="project-card" onClick={onOpen}>
      <div className="project-card-icon"><FolderOpen size={20} /></div>
      <div className="project-card-copy"><strong>{project.name}</strong><span>{project.description || "Chưa có mô tả project."}</span></div>
      <div className="project-card-meta"><span>{project.status}</span><span><Layers3 size={13} /> {project.metrics?.totalChapters ?? 0} chapters</span></div>
    </button>
  );
}
