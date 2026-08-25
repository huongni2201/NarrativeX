import type { DesktopProject } from "@narrativex/client-contracts";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";

export function ProjectPicker({ projects, activeProjectId, onChange }: Readonly<{ projects: DesktopProject[]; activeProjectId: string | null; onChange: (projectId: string) => void }>) {
  return (
    <label className="flex items-center gap-2 text-[10px] text-[var(--text-3)]">
      <span>Project</span>
      <Select value={activeProjectId ?? undefined} onValueChange={onChange}>
        <SelectTrigger className="h-7 min-w-[170px] border-[var(--border)] bg-[var(--surface-2)] px-2 text-xs text-[var(--text)]">
          <SelectValue placeholder="Chọn project" />
        </SelectTrigger>
        <SelectContent>
          {projects.map((project) => <SelectItem key={project.id} value={project.id}>{project.name}</SelectItem>)}
        </SelectContent>
      </Select>
    </label>
  );
}
