import { ChevronDown } from "lucide-react";
import type { DesktopProject } from "@narrativex/client-contracts";

export function ProjectPicker({ projects, activeProjectId, onChange }: Readonly<{ projects: DesktopProject[]; activeProjectId: string | null; onChange: (projectId: string) => void }>) {
  return (
    <label className="project-picker"><span>Project</span><select value={activeProjectId ?? ""} onChange={(event) => event.currentTarget.value && onChange(event.currentTarget.value)} aria-label="Active project">
      <option value="" disabled>Chọn project</option>
      {projects.map((project) => <option key={project.id} value={project.id}>{project.name}</option>)}
    </select><ChevronDown size={13} /></label>
  );
}
